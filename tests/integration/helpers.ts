import { TEST_DATABASE_URL } from "./env";
import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { connectWithRetry, migrateConnection } from "../../scripts/migrate";
import { SEED, seedConnection } from "../../scripts/seed";
import { resolveShiftTimes } from "@/lib/time";
import { getDb, isConnectionDropped, runTransaction } from "@/server/db/client";
import { assignment, auditLog, licence, location, role, shift, staff } from "@/server/db/schema";
import { DEMO_WORKER_EMAIL, type Session, sessionCookieHeader } from "@/server/session";

export { SEED };

/**
 * Migrates and reseeds the test database over one connection. Truncate plus
 * insert is safe to repeat, so a dropped connection starts it again on a new one.
 */
// No parameters: vitest parses the arguments of a function passed straight to beforeAll.
export async function resetDatabase() {
  const attempts = 3;
  for (let attempt = 1; ; attempt++) {
    const connection = await connectWithRetry(TEST_DATABASE_URL);
    try {
      await migrateConnection(connection);
      await seedConnection(connection);
      return;
    } catch (error) {
      if (attempt >= attempts || !isConnectionDropped(error)) throw error;
    } finally {
      connection.destroy();
    }
  }
}

export const manager: Session = { role: "manager" };

/**
 * Fixture writes go through runTransaction too, so a dropped connection to the
 * remote test database is retried rather than failing the test. (Plain
 * pool.query only retries SELECTs.)
 */
function write<T>(work: Parameters<typeof runTransaction<T>>[1]) {
  return runTransaction(getDb(), work);
}

type CallOptions = {
  method?: string;
  path: string;
  body?: unknown;
  session?: Session | null;
  headers?: Record<string, string>;
  params?: Record<string, string>;
};

type RouteHandler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Calls a route handler directly with a real Request. No server involved. */
export async function call(handler: unknown, options: CallOptions) {
  const headers: Record<string, string> = { ...options.headers };
  if (options.session !== null) headers.cookie = sessionCookieHeader(options.session ?? manager);
  if (options.body !== undefined) headers["content-type"] ??= "application/json";

  const request = new Request(`http://localhost${options.path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const response = await (handler as RouteHandler)(request, { params: Promise.resolve(options.params ?? {}) });
  return { status: response.status, headers: response.headers, body: await response.json() };
}

export async function roleId(name: string) {
  const [row] = await getDb().select().from(role).where(eq(role.name, name));
  return row.id;
}

export async function locationId(name: string) {
  const [row] = await getDb().select().from(location).where(and(eq(location.eventId, SEED.eventId), eq(location.name, name)));
  return row.id;
}

/** A fresh person with no shifts, so tests don't depend on who the seed placed where. */
export async function createStaff(roleName: string, name = `Test Person ${randomUUID().slice(0, 8)}`, siaExpiresOn?: string) {
  const role = await roleId(roleName);
  return write(async (tx) => {
    const [{ id }] = await tx
      .insert(staff)
      .values({ name, roleId: role, email: `${randomUUID()}@example.com`, weeklyHourLimit: 48 })
      .$returningId();
    if (siaExpiresOn) {
      await tx.insert(licence).values({ staffId: id, kind: "SIA", number: `SIA-TEST-${id}`, expiresOn: siaExpiresOn });
    }
    return { id, name };
  });
}

/** A fresh shift on race day. Times are local to the event. */
export async function createShift(options: { roleName?: string; locationName?: string; start?: string; end?: string; slots?: number; date?: string } = {}) {
  const { roleName = "steward", locationName = "Gate A", start = "14:00", end = "16:00", slots = 2, date = SEED.date } = options;
  const values = {
    eventId: SEED.eventId,
    locationId: await locationId(locationName),
    roleId: await roleId(roleName),
    ...resolveShiftTimes(date, start, end, SEED.timezone),
    slots,
  };
  return write(async (tx) => (await tx.insert(shift).values(values).$returningId())[0].id);
}

/** Puts someone on a shift directly, skipping the API. */
export async function placeDirectly(shiftId: number, staffId: number) {
  await write((tx) => tx.insert(assignment).values({ shiftId, staffId, createdBy: "test" }));
}

export async function assignmentCount(shiftId: number) {
  const [{ n }] = await getDb().select({ n: count() }).from(assignment).where(eq(assignment.shiftId, shiftId));
  return n;
}

export async function auditRows(shiftId: number) {
  return getDb().select().from(auditLog).where(eq(auditLog.shiftId, shiftId));
}

export async function demoWorker(): Promise<Session & { role: "worker" }> {
  const [row] = await getDb().select().from(staff).where(eq(staff.email, DEMO_WORKER_EMAIL));
  return { role: "worker", staffId: row.id };
}

export function idempotencyKey() {
  return `test-${randomUUID()}`;
}
