import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

export type Db = MySql2Database<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type Cached = { pool: mysql.Pool; db: Db };

// Next.js dev reloads modules on every change. Keeping the pool on globalThis
// stops each reload from opening a new set of connections.
const globalForDb = globalThis as unknown as { shiftlineDb?: Cached };

export function createPool(url: string) {
  return retryReadsOnDroppedConnection(mysql.createPool({
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
  }));
}

/**
 * Retries a query once when its connection was dropped. Drizzle sends
 * pool.query only outside transactions (a transaction runs on a connection it
 * checked out), and outside transactions the app only reads, so a retry can't
 * repeat a write. Writes get their own retry in runTransaction.
 */
function retryReadsOnDroppedConnection(pool: mysql.Pool): mysql.Pool {
  const query = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
  const retrying = async (...args: unknown[]) => {
    try {
      return await query(...args);
    } catch (error) {
      if (!isConnectionDropped(error)) throw error;
      return query(...args);
    }
  };
  pool.query = retrying as unknown as mysql.Pool["query"];
  return pool;
}

export function getDb(): Db {
  if (!globalForDb.shiftlineDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const pool = createPool(url);
    globalForDb.shiftlineDb = { pool, db: drizzle({ client: pool, schema, mode: "default" }) };
  }
  return globalForDb.shiftlineDb.db;
}

export async function closeDb() {
  const cached = globalForDb.shiftlineDb;
  globalForDb.shiftlineDb = undefined;
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

/**
 * Runs a READ COMMITTED transaction, retrying up to twice on a deadlock or a
 * dropped connection. MySQL rolls back the failed attempt, so a retry starts
 * clean. Even if a commit landed and only its reply was lost, the retry can't
 * write twice: the unique keys, the "already assigned" check and the version
 * check turn it into a 409.
 *
 * READ COMMITTED because callers lock a row and then read others: each read
 * then sees what the previous lock holder committed, where REPEATABLE READ
 * could keep an older snapshot.
 */
export async function runTransaction<T>(db: Db, work: (tx: Tx) => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction(work, { isolationLevel: "read committed" });
    } catch (error) {
      if (attempt >= attempts || !isRetryableError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}
