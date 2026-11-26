import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { call, createShift, createStaff, demoWorker, manager, placeDirectly, resetDatabase, SEED } from "./helpers";
import { GET as board } from "@/app/api/events/[id]/board/route";
import { GET as activity } from "@/app/api/events/[id]/activity/route";
import { GET as staffList } from "@/app/api/staff/route";
import { PATCH as patchShift } from "@/app/api/shifts/[id]/route";
import { POST as requestShift } from "@/app/api/shift-requests/route";
import { POST as approve } from "@/app/api/shift-requests/[id]/approve/route";
import { GET as getSession, POST as postSession } from "@/app/api/session/route";
import { closeDb } from "@/server/db/client";
import type { Board, BoardShift, StaffListItem } from "@/server/db/queries";

beforeAll(resetDatabase);
afterAll(closeDb);

const eventId = String(SEED.eventId);
const boardPath = `/api/events/${eventId}/board`;

describe("GET /api/events/:id/board", () => {
  // Runs first, while the data is exactly the seed.
  it("returns the seeded race day for a manager", async () => {
    const res = await call(board, { path: boardPath, params: { id: eventId } });
    const body = res.body as Board;

    expect(res.status).toBe(200);
    expect(body.event.name).toBe("Autumn race day");
    expect(body.locations.map((l) => l.name)).toEqual(["Gate A", "Gate B", "Bar 1", "Bar 2", "Security", "Car park"]);
    expect(body.summary).toEqual({ shifts: 42, covered: 38 });
    expect(body.coverage).toHaveLength(16);
    expect(body.coverage[0].hour).toBe("07:00");
    expect(body.coverage[15].hour).toBe("22:00");

    // The understaffed gap is 14:00 to 16:00 and nowhere else.
    const shortHours = body.coverage.filter((h) => h.assigned < h.needed).map((h) => h.hour);
    expect(shortHours).toEqual(["14:00", "15:00"]);

    const named = body.shifts.flatMap((s) => s.assigned).filter((p) => p.name);
    expect(named.length).toBeGreaterThan(90);
  });

  it("strips other people's names for a worker, on the server", async () => {
    const worker = await demoWorker();
    const res = await call(board, { path: boardPath, params: { id: eventId }, session: worker });
    const body = res.body as Board;

    expect(res.status).toBe(200);
    const everyone = body.shifts.flatMap((s) => s.assigned);
    expect(everyone.every((p) => p.staffId === worker.staffId)).toBe(true);
    const mine = body.shifts.filter((s: BoardShift) => s.assignedToMe);
    expect(mine).toHaveLength(1);
    expect(mine[0].assigned[0].name).toBe("Ana Tamm");
    // Counts stay, so the worker still sees what's open.
    expect(body.summary).toEqual({ shifts: 42, covered: 38 });
    expect(JSON.stringify(body)).not.toContain("Kadri");
  });

  it("returns 404 for an unknown event and 422 for a bad id", async () => {
    expect((await call(board, { path: "/api/events/999/board", params: { id: "999" } })).status).toBe(404);
    expect((await call(board, { path: "/api/events/abc/board", params: { id: "abc" } })).status).toBe(422);
  });
});

describe("GET /api/staff", () => {
  it("searches by name with licence status and hours this week", async () => {
    const res = await call(staffList, { path: `/api/staff?eventId=${eventId}&q=ana%20tamm` });
    expect(res.status).toBe(200);
    const [ana] = res.body.items as StaffListItem[];
    expect(ana).toMatchObject({ name: "Ana Tamm", roleName: "steward", hoursThisWeek: 6, licence: { status: "none" } });
    expect(ana.booked).toHaveLength(1);
  });

  it("shows expired and expiring SIA licences", async () => {
    const res = await call(staffList, { path: `/api/staff?eventId=${eventId}&role=3` });
    const statuses = (res.body.items as StaffListItem[]).map((s) => s.licence.status);
    expect(statuses.filter((s) => s === "expired")).toHaveLength(2);
    expect(statuses.filter((s) => s === "expiring")).toHaveLength(3);
  });

  it("returns 50 people by default and honours ?limit", async () => {
    const all = await call(staffList, { path: `/api/staff?eventId=${eventId}` });
    expect(all.body.items).toHaveLength(50);
    const five = await call(staffList, { path: `/api/staff?eventId=${eventId}&limit=5` });
    expect(five.body.items).toHaveLength(5);
    expect((await call(staffList, { path: `/api/staff?eventId=${eventId}&limit=500` })).status).toBe(422);
  });

  it("is manager only, and validates the query", async () => {
    expect((await call(staffList, { path: `/api/staff?eventId=${eventId}`, session: await demoWorker() })).status).toBe(403);
    const bad = await call(staffList, { path: "/api/staff" });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details.issues[0].path).toBe("eventId");
  });
});

describe("GET /api/events/:id/activity", () => {
  it("pages newest first with a cursor", async () => {
    const first = await call(activity, { path: `/api/events/${eventId}/activity?limit=5`, params: { id: eventId } });
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(5);
    const ids = first.body.items.map((i: { id: number }) => i.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));

    const second = await call(activity, { path: `/api/events/${eventId}/activity?limit=5&cursor=${first.body.nextCursor}`, params: { id: eventId } });
    expect(second.body.items[0].id).toBeLessThan(ids[4]);
  });

  it("filters to one shift", async () => {
    const res = await call(activity, { path: `/api/events/${eventId}/activity?shiftId=1`, params: { id: eventId } });
    expect(res.body.items.every((i: { shiftId: number }) => i.shiftId === 1)).toBe(true);
    expect(res.body.nextCursor).toBeNull();
  });

  it("is manager only", async () => {
    const res = await call(activity, { path: `/api/events/${eventId}/activity`, params: { id: eventId }, session: await demoWorker() });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/shifts/:id", () => {
  it("updates with the right version, bumps it, and treats an earlier end as next day", async () => {
    const id = String(await createShift({ start: "18:00", end: "22:00" }));
    const res = await call(patchShift, { method: "PATCH", path: `/api/shifts/${id}`, params: { id }, body: { version: 1, startTime: "22:00", endTime: "02:00", slots: 3 } });

    expect(res.status).toBe(200);
    expect(res.body.shift).toMatchObject({ version: 2, slots: 3, startsAt: "2026-12-05T22:00:00.000Z", endsAt: "2026-12-06T02:00:00.000Z" });
  });

  it("returns 409 stale_version for an out of date edit", async () => {
    const id = String(await createShift());
    await call(patchShift, { method: "PATCH", path: `/api/shifts/${id}`, params: { id }, body: { version: 1, slots: 3 } });

    const stale = await call(patchShift, { method: "PATCH", path: `/api/shifts/${id}`, params: { id }, body: { version: 1, slots: 4 } });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("stale_version");
    expect(stale.body.error.details.current.slots).toBe(3);
  });

  it("won't cut slots below the people already on the shift", async () => {
    const shiftId = await createShift({ slots: 3 });
    await placeDirectly(shiftId, (await createStaff("steward")).id);
    await placeDirectly(shiftId, (await createStaff("steward")).id);
    const id = String(shiftId);

    const res = await call(patchShift, { method: "PATCH", path: `/api/shifts/${id}`, params: { id }, body: { version: 1, slots: 1 } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("slots_below_filled");
  });

  it("blocks a time change that makes someone on the shift overlap another shift", async () => {
    const id = String(await createShift({ locationName: "Gate A", start: "10:00", end: "12:00" }));
    const elsewhere = await createShift({ locationName: "Gate B", start: "13:00", end: "15:00" });
    const person = await createStaff("steward", "Jaan Oja");
    await placeDirectly(Number(id), person.id);
    await placeDirectly(elsewhere, person.id);

    const res = await call(patchShift, { method: "PATCH", path: `/api/shifts/${id}`, params: { id }, body: { version: 1, startTime: "12:00", endTime: "14:00" } });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("rule_blocked");
    expect(res.body.error.message).toBe("Jaan Oja is already on Gate B, 13:00 to 15:00.");
    expect(res.body.error.details.people).toEqual([
      { staffId: person.id, name: "Jaan Oja", breaks: [{ code: "overlap", severity: "block", message: "Jaan Oja is already on Gate B, 13:00 to 15:00." }] },
    ]);
  });

  it("blocks a role change to security when someone on the shift has no SIA licence", async () => {
    const id = String(await createShift({ roleName: "steward" }));
    const person = await createStaff("steward", "Megan Lloyd");
    await placeDirectly(Number(id), person.id);

    const res = await call(patchShift, { method: "PATCH", path: `/api/shifts/${id}`, params: { id }, body: { version: 1, roleId: 3 } });

    expect(res.status).toBe(409);
    const codes = res.body.error.details.people[0].breaks.map((b: { code: string }) => b.code);
    expect(codes).toEqual(expect.arrayContaining(["role_mismatch", "sia_missing"]));
  });

  it("needs a reason when new times cut someone's rest, then saves it", async () => {
    const id = String(await createShift({ start: "12:00", end: "16:00" }));
    const late = await createShift({ date: "2026-12-04", start: "18:00", end: "23:30" });
    const person = await createStaff("steward");
    await placeDirectly(Number(id), person.id);
    await placeDirectly(late, person.id);

    const body = { version: 1, startTime: "07:00", endTime: "11:00" };
    const noReason = await call(patchShift, { method: "PATCH", path: `/api/shifts/${id}`, params: { id }, body });
    expect(noReason.status).toBe(409);
    expect(noReason.body.error.code).toBe("needs_override");

    const withReason = await call(patchShift, { method: "PATCH", path: `/api/shifts/${id}`, params: { id }, body: { ...body, overrideReason: "Gates open early" } });
    expect(withReason.status).toBe(200);
    expect(withReason.body.shift.version).toBe(2);
  });

  it("returns 422 for half a time range and 403 for a worker", async () => {
    const id = String(await createShift());
    const half = await call(patchShift, { method: "PATCH", path: `/api/shifts/${id}`, params: { id }, body: { version: 1, startTime: "09:00" } });
    expect(half.status).toBe(422);
    const worker = await call(patchShift, { method: "PATCH", path: `/api/shifts/${id}`, params: { id }, body: { version: 1, slots: 2 }, session: await demoWorker() });
    expect(worker.status).toBe(403);
  });
});

describe("shift requests", () => {
  it("lets a worker request an open shift and a manager approve it", async () => {
    const worker = await demoWorker();
    const shiftId = await createShift({ start: "18:00", end: "22:00" });

    const requested = await call(requestShift, { method: "POST", path: "/api/shift-requests", body: { shiftId }, session: worker });
    expect(requested.status).toBe(201);
    expect(requested.body.request).toMatchObject({ shiftId, staffId: worker.staffId, status: "pending" });

    const again = await call(requestShift, { method: "POST", path: "/api/shift-requests", body: { shiftId }, session: worker });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("already_requested");

    // Ana finishes at 13:00, so 18:00 leaves 5 hours of rest: the manager has to give a reason.
    expect(requested.body.notes.map((n: { code: string }) => n.code)).toEqual(["rest_too_short"]);
    const id = String(requested.body.request.id);
    const noReason = await call(approve, { method: "POST", path: `/api/shift-requests/${id}/approve`, params: { id }, body: {} });
    expect(noReason.status).toBe(409);
    expect(noReason.body.error.code).toBe("needs_override");

    const approved = await call(approve, { method: "POST", path: `/api/shift-requests/${id}/approve`, params: { id }, body: { overrideReason: "Ana asked for the evening" } });
    expect(approved.status).toBe(201);
    expect(approved.body.request.status).toBe("approved");
    expect(approved.body.assignment).toMatchObject({ shiftId, staffId: worker.staffId });

    const twice = await call(approve, { method: "POST", path: `/api/shift-requests/${id}/approve`, params: { id }, body: {} });
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe("request_not_pending");
  });

  it("refuses a request that breaks a blocking rule", async () => {
    const shiftId = await createShift({ start: "10:00", end: "14:00" }); // overlaps Ana's 07:00 to 13:00
    const res = await call(requestShift, { method: "POST", path: "/api/shift-requests", body: { shiftId }, session: await demoWorker() });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Ana Tamm is already on Gate A, 07:00 to 13:00.");
  });

  it("never shows a worker who took a full shift", async () => {
    const shiftId = await createShift({ slots: 1 });
    await placeDirectly(shiftId, (await createStaff("steward", "Freya Campbell")).id);

    const res = await call(requestShift, { method: "POST", path: "/api/shift-requests", body: { shiftId }, session: await demoWorker() });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("shift_full");
    expect(res.body.error.details).not.toHaveProperty("takenBy");
    expect(JSON.stringify(res.body)).not.toContain("Freya");
  });

  it("tells a worker who is already on the shift", async () => {
    const worker = await demoWorker();
    const shiftId = await createShift({ start: "18:00", end: "22:00" });
    await placeDirectly(shiftId, worker.staffId);
    const res = await call(requestShift, { method: "POST", path: "/api/shift-requests", body: { shiftId }, session: worker });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_assigned");
  });

  it("returns shift_full when approving a request for a shift that has since filled", async () => {
    const shiftId = await createShift({ slots: 1, start: "19:00", end: "23:00" });
    const requester = await createStaff("steward");
    const requested = await call(requestShift, { method: "POST", path: "/api/shift-requests", body: { shiftId }, session: { role: "worker", staffId: requester.id } });
    expect(requested.status).toBe(201);
    await placeDirectly(shiftId, (await createStaff("steward")).id);

    const id = String(requested.body.request.id);
    const res = await call(approve, { method: "POST", path: `/api/shift-requests/${id}/approve`, params: { id }, body: {} });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("shift_full");
  });

  it("is worker only to request, manager only to approve", async () => {
    const shiftId = await createShift();
    expect((await call(requestShift, { method: "POST", path: "/api/shift-requests", body: { shiftId }, session: manager })).status).toBe(403);
    expect((await call(approve, { method: "POST", path: "/api/shift-requests/1/approve", params: { id: "1" }, body: {}, session: await demoWorker() })).status).toBe(403);
  });
});

describe("POST /api/session", () => {
  it("sets a signed cookie for the demo worker that the other routes accept", async () => {
    const res = await call(postSession, { method: "POST", path: "/api/session", body: { role: "worker" }, session: null });
    expect(res.status).toBe(200);
    expect(res.body.staff.name).toBe("Ana Tamm");

    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/^parimshift_session=[^;]+; Path=\/; HttpOnly; SameSite=Lax/);
    const cookie = setCookie.split(";")[0];

    const me = await call(getSession, { path: "/api/session", session: null, headers: { cookie } });
    expect(me.body.session).toEqual({ role: "worker", staffId: res.body.staff.id });
  });

  it("rejects an unknown role", async () => {
    const res = await call(postSession, { method: "POST", path: "/api/session", body: { role: "admin" }, session: null });
    expect(res.status).toBe(422);
  });
});

describe("demo flags", () => {
  it("?fail=1 fails before anything runs", async () => {
    const res = await call(board, { path: `${boardPath}?fail=1`, params: { id: eventId } });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("demo_failure");
  });

  it("?latency delays the response", async () => {
    const started = Date.now();
    await call(getSession, { path: "/api/session?latency=300" });
    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
  });
});
