import { and, eq } from "drizzle-orm";
import { checkAssignment, type RuleBreak } from "@/lib/rules";
import { assignInTransaction, type AssignOutcome, blockingFailure, isDuplicateKeyError, loadRuleInput } from "./assign";
import { type Db, runTransaction } from "./db/client";
import { auditLog, shift, shiftRequest, type ShiftRequestRow, staff } from "./db/schema";

type Failure = { ok: false; status: 404 | 409; code: string; message: string; details: unknown };

export type CreateRequestOutcome = { ok: true; request: ShiftRequestRow; notes: RuleBreak[] } | Failure;

/**
 * A worker asks for an open shift. The same rules run, without locks: blocks
 * (full, wrong role, overlap, licence) stop the request, warnings are left for
 * the manager to judge when approving.
 */
export async function createShiftRequest(db: Db, shiftId: number, staffId: number, actor: string): Promise<CreateRequestOutcome> {
  const [[target], [person]] = await Promise.all([
    db.select().from(shift).where(eq(shift.id, shiftId)),
    db.select().from(staff).where(eq(staff.id, staffId)),
  ]);
  if (!target) return { ok: false, status: 404, code: "shift_not_found", message: "That shift doesn't exist any more.", details: null };
  if (!person) return { ok: false, status: 404, code: "staff_not_found", message: "Your staff record wasn't found.", details: null };

  const breaks = checkAssignment(await loadRuleInput(db, target, person));
  const blocked = await blockingFailure(db, breaks, target.id);
  if (blocked) return blocked;

  const duplicate: Failure = { ok: false, status: 409, code: "already_requested", message: "You've already requested this shift.", details: null };
  return runTransaction(db, async (tx): Promise<CreateRequestOutcome> => {
    let id: number;
    try {
      [{ id }] = await tx.insert(shiftRequest).values({ shiftId, staffId }).$returningId();
    } catch (error) {
      if (isDuplicateKeyError(error)) return duplicate;
      throw error;
    }
    await tx.insert(auditLog).values({
      eventId: target.eventId,
      shiftId,
      actor,
      action: "shift_request.created",
      payload: { requestId: id, shiftId, staffId, staffName: person.name },
    });
    const [request] = await tx.select().from(shiftRequest).where(eq(shiftRequest.id, id));
    return { ok: true, request, notes: breaks.filter((b) => b.severity !== "block") };
  });
}

export type ApproveOutcome = (AssignOutcome & { request?: ShiftRequestRow }) | Failure;

/** Approving runs the same locked assign transaction, then marks the request approved. */
export function approveShiftRequest(db: Db, requestId: number, overrideReason: string | null | undefined, actor: string): Promise<ApproveOutcome> {
  return runTransaction(
    db,
    async (tx): Promise<ApproveOutcome> => {
      // Lock the request so two managers can't approve it at once.
      // Lock order is request, then shift, then staff (inside assign).
      const [request] = await tx.select().from(shiftRequest).where(eq(shiftRequest.id, requestId)).for("update");
      if (!request) return { ok: false, status: 404, code: "request_not_found", message: "That shift request doesn't exist.", details: null };
      if (request.status !== "pending") {
        return { ok: false, status: 409, code: "request_not_pending", message: `This request was already ${request.status}.`, details: null };
      }

      const outcome = await assignInTransaction(tx, { shiftId: request.shiftId, staffId: request.staffId, overrideReason }, actor);
      if (!outcome.ok) return outcome;

      await tx
        .update(shiftRequest)
        .set({ status: "approved" })
        .where(and(eq(shiftRequest.id, requestId), eq(shiftRequest.status, "pending")));
      const [target] = await tx.select({ eventId: shift.eventId }).from(shift).where(eq(shift.id, request.shiftId));
      await tx.insert(auditLog).values({
        eventId: target.eventId,
        shiftId: request.shiftId,
        actor,
        action: "shift_request.approved",
        payload: { requestId, shiftId: request.shiftId, staffId: request.staffId, assignmentId: outcome.assignment.id },
      });
      return { ...outcome, request: { ...request, status: "approved" } };
    },
  );
}
