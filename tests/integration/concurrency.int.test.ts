import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assignmentCount, call, createShift, createStaff, placeDirectly, resetDatabase } from "./helpers";
import { POST as assign } from "@/app/api/assignments/route";
import { closeDb } from "@/server/db/client";

beforeAll(resetDatabase);
afterAll(closeDb);

function postAssignment(shiftId: number, staffId: number) {
  return call(assign, { method: "POST", path: "/api/assignments", body: { shiftId, staffId } });
}

const ROUNDS = 6;

describe("two managers, one last slot", () => {
  it.each(Array.from({ length: ROUNDS }, (_, i) => i + 1))("round %i: exactly one 201 and one 409 shift_full", async () => {
    // 3 of 4 filled, like the spec's example.
    const shiftId = await createShift({ slots: 4 });
    for (let i = 0; i < 3; i++) await placeDirectly(shiftId, (await createStaff("steward")).id);
    const ana = await createStaff("steward");
    const ben = await createStaff("steward");

    const results = await Promise.all([postAssignment(shiftId, ana.id), postAssignment(shiftId, ben.id)]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    const winner = results.find((r) => r.status === 201)!;
    const loser = results.find((r) => r.status === 409)!;
    expect(loser.body.error.code).toBe("shift_full");
    expect(loser.body.error.message).toBe("Gate A 14:00 to 16:00 is full, 4 of 4 filled.");
    // The toast can name who got the slot.
    expect(loser.body.error.details.takenBy.staffId).toBe(winner.body.assignment.staffId);
    expect(await assignmentCount(shiftId)).toBe(4);
  });
});

describe("one person, two overlapping shifts at once", () => {
  it.each(Array.from({ length: 3 }, (_, i) => i + 1))("round %i: only one assignment goes through", async () => {
    const gateA = await createShift({ locationName: "Gate A", start: "12:00", end: "18:00" });
    const gateB = await createShift({ locationName: "Gate B", start: "14:00", end: "20:00" });
    const person = await createStaff("steward");

    const results = await Promise.all([postAssignment(gateA, person.id), postAssignment(gateB, person.id)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.details.breaks[0].code).toBe("overlap");
    expect((await assignmentCount(gateA)) + (await assignmentCount(gateB))).toBe(1);
  });
});
