import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assignmentCount, call, createShift, createStaff, idempotencyKey, resetDatabase } from "./helpers";
import { POST as assign } from "@/app/api/assignments/route";
import { closeDb } from "@/server/db/client";

beforeAll(resetDatabase);
afterAll(closeDb);

function postAssignment(body: unknown, key: string) {
  return call(assign, { method: "POST", path: "/api/assignments", body, headers: { "Idempotency-Key": key } });
}

describe("Idempotency-Key on POST /api/assignments", () => {
  it("returns the same response for the same key and makes one row", async () => {
    const shiftId = await createShift();
    const person = await createStaff("steward");
    const key = idempotencyKey();

    const first = await postAssignment({ shiftId, staffId: person.id }, key);
    const retry = await postAssignment({ shiftId, staffId: person.id }, key);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body).toEqual(first.body);
    expect(retry.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await assignmentCount(shiftId)).toBe(1);
  });

  it("lets only one of two simultaneous copies run", async () => {
    const shiftId = await createShift();
    const person = await createStaff("steward");
    const key = idempotencyKey();

    const results = await Promise.all([
      postAssignment({ shiftId, staffId: person.id }, key),
      postAssignment({ shiftId, staffId: person.id }, key),
    ]);

    // One runs. The other either waits out as "in progress" or, if it came
    // second enough, replays the stored 201. Never a second insert.
    const statuses = results.map((r) => r.status).sort();
    expect(statuses[0]).toBe(201);
    if (statuses[1] === 409) {
      expect(results.find((r) => r.status === 409)!.body.error.code).toBe("idempotency_in_progress");
    } else {
      expect(statuses[1]).toBe(201);
    }
    expect(await assignmentCount(shiftId)).toBe(1);
  });

  it("without a key, a retry is a new request", async () => {
    const shiftId = await createShift();
    const person = await createStaff("steward");
    const body = { shiftId, staffId: person.id };

    const first = await call(assign, { method: "POST", path: "/api/assignments", body });
    const second = await call(assign, { method: "POST", path: "/api/assignments", body });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("already_assigned");
  });

  it("rejects the same key for a different body", async () => {
    const shiftId = await createShift();
    const ana = await createStaff("steward");
    const ben = await createStaff("steward");
    const key = idempotencyKey();

    await postAssignment({ shiftId, staffId: ana.id }, key);
    const reused = await postAssignment({ shiftId, staffId: ben.id }, key);

    expect(reused.status).toBe(422);
    expect(reused.body.error.code).toBe("idempotency_key_reused");
    expect(await assignmentCount(shiftId)).toBe(1);
  });

  it("rejects a malformed key", async () => {
    const res = await postAssignment({ shiftId: 1, staffId: 1 }, "no");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invalid_idempotency_key");
  });
});
