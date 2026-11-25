import { and, eq, gte } from "drizzle-orm";
import { checkAssignment, type RuleBreak } from "@/lib/rules";
import { assignInTransaction, type AssignOutcome, blockingFailure, isDuplicateKeyError, loadRuleInput } from "./assign";
import { type Db, runTransaction, type Tx } from "./db/client";
import { assignment, auditLog, shift, shiftRequest, type ShiftRequestRow, staff } from "./db/schema";

type Failure = { ok: false; status: 404 | 409; code: string; message: string; details: unknown };

export type CreateRequestOutcome = { ok: true; request: ShiftRequestRow; notes: RuleBreak[] } | Failure;

/**
 * A worker asks for an open shift. The same rules run, without locks: blocks
 * (full, wrong role, overlap, licence) stop the request, warnings are left for
 * the manager to judge when approving. The caller is a worker, so no failure
 * may carry anyone else's name.
 */
export async function createShiftRequest(db: Db, shiftId: number, staffId: number, actor: string): Promise<CreateRequestOutcome> {
  const [[target], [person]] = await Promise.all([
    db.select().from(shift).where(eq(shift.id, shiftId)),
    db.select().from(staff).where(eq(staff.id, staffId)),
  ]);
  if (!target) return { ok: false, status: 404, code: "shift_not_found", message: "That shift doesn't exist any more.", details: null };
  if (!person) return { ok: false, status: 404, code: "staff_not_found", message: "Your staff record wasn't found.", details: null };

  const [onShift] = await db
    .select({ id: assignment.id })
    .from(assignment)
    .where(and(eq(assignment.shiftId, shiftId), eq(assignment.staffId, staffId)));
  if (onShift) return { ok: false, status: 409, code: "already_assigned", message: "You're already on this shift.", details: null };

  const breaks = checkAssignment(await loadRuleInput(db, target, person));
  const blocked = await blockingFailure(db, breaks, target.id, { revealTakenBy: false });
  if (blocked) return blocked;

  const duplicate: Failure = { ok: false, status: 409, code: "already_requested", message: "You've already requested this shift.", details: null };
  return runTransaction(db, async (tx, attempt): Promise<CreateRequestOutcome> => {
    let id: number;
    try {
      [{ id }] = await tx.insert(shiftRequest).values({ shiftId, staffId }).$returningId();
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      // On a retry, a request made since the first attempt began is our own lost commit.
      const [ours] = attempt.isRetry
        ? await tx
            .select()
            .from(shiftRequest)
            .where(and(eq(shiftRequest.shiftId, shiftId), eq(shiftRequest.staffId, staffId), gte(shiftRequest.createdAt, attempt.startedAt)))
        : [];
      return ours ? { ok: true, request: ours, notes: breaks.filter((b) => b.severity !== "block") } : duplicate;
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

/**
 * Approving runs the same locked assign transaction, then marks the request
 * approved. If the shift has filled since the request was made, approval
 * returns 409 shift_full and the request stays pending.
 */
export function approveShiftRequest(db: Db, requestId: number, overrideReason: string | null | undefined, actor: string): Promise<ApproveOutcome> {
  return runTransaction(
    db,
    async (tx, attempt): Promise<ApproveOutcome> => {
      // Lock the request so two managers can't approve it at once.
      // Lock order is request, then shift, then staff (inside assign).
      const [request] = await tx.select().from(shiftRequest).where(eq(shiftRequest.id, requestId)).for("update");
      if (!request) return { ok: false, status: 404, code: "request_not_found", message: "That shift request doesn't exist.", details: null };
      if (attempt.isRetry && request.status === "approved") {
        const recovered = await ourAssignment(tx, request, actor, attempt.startedAt);
        if (recovered) return { ok: true, assignment: recovered, notes: [], request };
      }
      if (request.status !== "pending") {
        return { ok: false, status: 409, code: "request_not_pending", message: `This request was already ${request.status}.`, details: null };
      }

      const outcome = await assignInTransaction(tx, { shiftId: request.shiftId, staffId: request.staffId, overrideReason }, actor, attempt);
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

/** The assignment this approval wrote, if an earlier attempt committed it. */
async function ourAssignment(tx: Tx, request: ShiftRequestRow, actor: string, since: Date) {
  const [row] = await tx
    .select()
    .from(assignment)
    .where(
      and(
        eq(assignment.shiftId, request.shiftId),
        eq(assignment.staffId, request.staffId),
        eq(assignment.createdBy, actor),
        gte(assignment.createdAt, since),
      ),
    );
  return row ?? null;
}
