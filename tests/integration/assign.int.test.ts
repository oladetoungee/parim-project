import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createShift, createStaff, call, assignmentCount, auditRows, demoWorker, placeDirectly, resetDatabase, SEED } from "./helpers";
import { POST as assign } from "@/app/api/assignments/route";
import { DELETE as unassign } from "@/app/api/assignments/[id]/route";
import { sql } from "drizzle-orm";
import { assignInTransaction } from "@/server/assign";
import { closeDb, getDb, runTransaction } from "@/server/db/client";

beforeAll(resetDatabase);
afterAll(closeDb);

function postAssignment(body: unknown, session?: Parameters<typeof call>[1]["session"]) {
  return call(assign, { method: "POST", path: "/api/assignments", body, session });
}

describe("POST /api/assignments", () => {
  it("assigns, returns 201 and writes an audit row", async () => {
    const shiftId = await createShift();
    const person = await createStaff("steward", "Kertu Lepik");

    const res = await postAssignment({ shiftId, staffId: person.id });

    expect(res.status).toBe(201);
    expect(res.body.assignment).toMatchObject({ shiftId, staffId: person.id, createdBy: "manager", overrideReason: null });
    expect(await assignmentCount(shiftId)).toBe(1);

    const audit = await auditRows(shiftId);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ eventId: SEED.eventId, actor: "manager", action: "assignment.created" });
    expect(audit[0].payload).toMatchObject({ assignmentId: res.body.assignment.id, staffId: person.id, staffName: "Kertu Lepik" });
  });

  it("returns 409 rule_blocked for a role mismatch and writes nothing", async () => {
    const shiftId = await createShift({ roleName: "steward" });
    const barman = await createStaff("bar staff", "Oliver Price");

    const res = await postAssignment({ shiftId, staffId: barman.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("rule_blocked");
    expect(res.body.error.details.breaks).toEqual([
      { code: "role_mismatch", severity: "block", message: "Oliver Price's role is bar staff. This shift needs steward." },
    ]);
    expect(await assignmentCount(shiftId)).toBe(0);
    expect(await auditRows(shiftId)).toHaveLength(0);
  });

  it("returns 409 with the overlap in plain English", async () => {
    const first = await createShift({ locationName: "Bar 2", roleName: "bar staff", start: "12:00", end: "18:00" });
    const second = await createShift({ locationName: "Bar 1", roleName: "bar staff", start: "14:00", end: "16:00" });
    const person = await createStaff("bar staff", "Liis Kuusk");
    await placeDirectly(first, person.id);

    const res = await postAssignment({ shiftId: second, staffId: person.id });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Liis Kuusk is already on Bar 2, 12:00 to 18:00.");
  });

  it("blocks security staff whose SIA licence has expired", async () => {
    const shiftId = await createShift({ locationName: "Security", roleName: "security" });
    const guard = await createStaff("security", "Mart Vaher", "2026-12-01");

    const res = await postAssignment({ shiftId, staffId: guard.id });

    expect(res.status).toBe(409);
    expect(res.body.error.details.breaks.map((b: { code: string }) => b.code)).toEqual(["sia_expired"]);
  });

  it("needs an override reason for a rest warning, then stores it", async () => {
    const lateShift = await createShift({ date: "2026-12-04", start: "17:00", end: "23:30" });
    const earlyShift = await createShift({ start: "07:00", end: "13:00" });
    const person = await createStaff("steward", "Toomas Saar");
    await placeDirectly(lateShift, person.id);

    const withoutReason = await postAssignment({ shiftId: earlyShift, staffId: person.id });
    expect(withoutReason.status).toBe(409);
    expect(withoutReason.body.error.code).toBe("needs_override");
    expect(withoutReason.body.error.details.breaks[0]).toMatchObject({ code: "rest_too_short", severity: "warn" });

    const withReason = await postAssignment({ shiftId: earlyShift, staffId: person.id, overrideReason: "Agreed with Toomas, covering sickness" });
    expect(withReason.status).toBe(201);
    expect(withReason.body.assignment.overrideReason).toBe("Agreed with Toomas, covering sickness");
    const [audit] = await auditRows(earlyShift);
    expect(audit.payload).toMatchObject({ overrideReason: "Agreed with Toomas, covering sickness", overridden: ["rest_too_short"] });
  });

  it("returns 409 already_assigned for the same person twice", async () => {
    const shiftId = await createShift();
    const person = await createStaff("steward");
    await postAssignment({ shiftId, staffId: person.id });

    const again = await postAssignment({ shiftId, staffId: person.id });

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("already_assigned");
    expect(await assignmentCount(shiftId)).toBe(1);
  });

  it("returns 403 for a worker, even with a valid body", async () => {
    const shiftId = await createShift();
    const person = await createStaff("steward");

    const res = await postAssignment({ shiftId, staffId: person.id }, await demoWorker());

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "forbidden", message: "Only a manager can do this.", details: null } });
    expect(await assignmentCount(shiftId)).toBe(0);
  });

  it("returns 401 for a tampered cookie", async () => {
    const res = await call(assign, { method: "POST", path: "/api/assignments", body: {}, session: null, headers: { cookie: "parimshift_session=eyJyb2xlIjoibWFuYWdlciJ9.forged" } });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("invalid_session");
  });

  it("returns 401 no_session without a cookie, so a cross-site post can't write", async () => {
    const shiftId = await createShift();
    const person = await createStaff("steward");
    const res = await postAssignment({ shiftId, staffId: person.id }, null);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("no_session");
    expect(await assignmentCount(shiftId)).toBe(0);
  });

  it("returns 415 unless the body is sent as JSON", async () => {
    const res = await call(assign, { method: "POST", path: "/api/assignments", body: { shiftId: 1, staffId: 1 }, headers: { "content-type": "text/plain" } });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("unsupported_media_type");
  });

  it("returns 422 with details for a bad body", async () => {
    const res = await postAssignment({ shiftId: "abc" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("validation_failed");
    expect(res.body.error.details.issues.map((i: { path: string }) => i.path)).toEqual(["shiftId", "staffId"]);
  });

  it("returns 404 for a shift that doesn't exist", async () => {
    const person = await createStaff("steward");
    const res = await postAssignment({ shiftId: 999_999, staffId: person.id });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("shift_not_found");
  });
});

describe("DELETE /api/assignments/:id", () => {
  it("returns the deleted row so Undo can restore it", async () => {
    const shiftId = await createShift();
    const person = await createStaff("steward", "Grace Holland");
    const created = await postAssignment({ shiftId, staffId: person.id });
    const id = String(created.body.assignment.id);

    const removed = await call(unassign, { method: "DELETE", path: `/api/assignments/${id}`, params: { id } });
    expect(removed.status).toBe(200);
    expect(removed.body.assignment).toEqual(created.body.assignment);
    expect(await assignmentCount(shiftId)).toBe(0);
    expect((await auditRows(shiftId)).map((r) => r.action).sort()).toEqual(["assignment.created", "assignment.removed"]);

    const undo = await postAssignment({ shiftId, staffId: person.id });
    expect(undo.status).toBe(201);

    const twice = await call(unassign, { method: "DELETE", path: `/api/assignments/${id}`, params: { id } });
    expect(twice.status).toBe(404);
  });

  it("returns 403 for a worker", async () => {
    const res = await call(unassign, { method: "DELETE", path: "/api/assignments/1", params: { id: "1" }, session: await demoWorker() });
    expect(res.status).toBe(403);
  });
});

describe("transaction retries", () => {
  it("reports success when a retry finds its own lost commit", async () => {
    const shiftId = await createShift();
    const person = await createStaff("steward");
    const startedAt = new Date();
    const first = await runTransaction(getDb(), (tx) => assignInTransaction(tx, { shiftId, staffId: person.id }, "manager", { isRetry: false, startedAt }));
    expect(first.ok).toBe(true);

    // As if the COMMIT landed but its reply was lost, and runTransaction tried again.
    const retry = await runTransaction(getDb(), (tx) => assignInTransaction(tx, { shiftId, staffId: person.id }, "manager", { isRetry: true, startedAt }));
    expect(retry).toMatchObject({ ok: true, assignment: { id: first.ok ? first.assignment.id : -1 } });
    expect(await assignmentCount(shiftId)).toBe(1);
  });

  it("still says already_assigned when the existing row is older than the request", async () => {
    const shiftId = await createShift();
    const person = await createStaff("steward");
    await placeDirectly(shiftId, person.id);
    const retry = await runTransaction(getDb(), (tx) =>
      assignInTransaction(tx, { shiftId, staffId: person.id }, "manager", { isRetry: true, startedAt: new Date() }),
    );
    expect(retry).toMatchObject({ ok: false, code: "already_assigned" });
  });

  it("waits at most 5 seconds for a row lock", async () => {
    const [rows] = (await getDb().execute(sql`SELECT @@SESSION.innodb_lock_wait_timeout AS seconds`)) as unknown as [{ seconds: number }[]];
    expect(Number(rows[0].seconds)).toBe(5);
  });
});
