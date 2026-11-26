import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

export type Db = MySql2Database<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type Cached = { pool: mysql.Pool; db: Db };

// Next.js dev reloads modules on every change. Keeping the pool on globalThis
// stops each reload from opening a new set of connections.
const globalForDb = globalThis as unknown as { parimshiftDb?: Cached };

// How long a statement waits for a row lock before failing (MySQL's default is 50s).
// Kept well under the 60s idempotency claim, so a request stuck behind a lock
// fails and releases its key instead of outliving it. The route turns the
// error into 503 busy.
const LOCK_WAIT_TIMEOUT_SECONDS = 5;

export function createPool(url: string) {
  const pool = mysql.createPool({
    uri: url,
    connectionLimit: 10,
    // Railway's TCP proxy drops idle connections. Keep-alive plus a short idle
    // timeout means the pool hands out live sockets, not ones that reset on use.
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    maxIdle: 4,
    idleTimeout: 20_000,
    // Belt and braces: Drizzle already maps datetimes as UTC, this keeps raw queries UTC too.
    timezone: "Z",
  });
  // Runs once per new connection, queued ahead of anything else sent on it.
  pool.on("connection", (connection) => {
    connection.query(`SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_TIMEOUT_SECONDS}`);
  });
  return retrySelectsOnDroppedConnection(pool);
}

function isSelect(args: unknown[]): boolean {
  const first = args[0];
  const text = typeof first === "string" ? first : (first as { sql?: string } | undefined)?.sql;
  return typeof text === "string" && /^\s*select\b/i.test(text);
}

/**
 * Retries a SELECT once when its connection was dropped. Only pool.query is
 * wrapped, which Drizzle uses outside transactions; anything that isn't a
 * SELECT fails as it would have. Writes get their retry in runTransaction.
 */
function retrySelectsOnDroppedConnection(pool: mysql.Pool): mysql.Pool {
  const query = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
  const retrying = async (...args: unknown[]) => {
    try {
      return await query(...args);
    } catch (error) {
      if (!isSelect(args) || !isConnectionDropped(error)) throw error;
      return query(...args);
    }
  };
  pool.query = retrying as unknown as mysql.Pool["query"];
  return pool;
}

export function getDb(): Db {
  if (!globalForDb.parimshiftDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const pool = createPool(url);
    globalForDb.parimshiftDb = { pool, db: drizzle({ client: pool, schema, mode: "default" }) };
  }
  return globalForDb.parimshiftDb.db;
}

export async function closeDb() {
  const cached = globalForDb.parimshiftDb;
  globalForDb.parimshiftDb = undefined;
  await cached?.pool.end();
}

const DROPPED_CONNECTION_CODES = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST"]);

/** Drizzle wraps driver errors, so look through the causes too. */
function someCause(error: unknown, test: (e: { code?: string; message?: string }) => boolean): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if (test(e as { code?: string; message?: string })) return true;
  }
  return false;
}

export function isConnectionDropped(error: unknown): boolean {
  return someCause(error, (e) => DROPPED_CONNECTION_CODES.has(e.code ?? "") || Boolean(e.message?.includes("connection is in closed state")));
}

/** A deadlock or a dropped connection: the attempt was rolled back and can run again. */
export function isRetryableError(error: unknown): boolean {
  return isConnectionDropped(error) || someCause(error, (e) => e.code === "ER_LOCK_DEADLOCK");
}

/** Passed to each attempt of a transaction. */
export type Attempt = {
  /** True on attempts after the first: the previous one may have committed before its reply was lost. */
  isRetry: boolean;
  /** When the first attempt started, by this server's clock. */
  startedAt: Date;
};

/**
 * Runs a READ COMMITTED transaction, retrying up to twice on a deadlock or a
 * dropped connection. A failed attempt is rolled back, so a retry starts clean,
 * with one exception: the COMMIT itself can succeed and only its reply get
 * lost. Callers handle that with `attempt.isRetry`: they look for their own
 * effect (a row they would have written since `startedAt`) and report success
 * instead of a misleading 409.
 *
 * READ COMMITTED because callers lock a row and then read others: each read
 * then sees what the previous lock holder committed, where REPEATABLE READ
 * could keep an older snapshot.
 */
export async function runTransaction<T>(db: Db, work: (tx: Tx, attempt: Attempt) => Promise<T>, attempts = 3): Promise<T> {
  const startedAt = new Date();
  for (let n = 1; ; n++) {
    try {
      return await db.transaction((tx) => work(tx, { isRetry: n > 1, startedAt }), { isolationLevel: "read committed" });
    } catch (error) {
      if (n >= attempts || !isRetryableError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * n));
    }
  }
}
