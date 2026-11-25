import { asc, count, eq, inArray } from "drizzle-orm";
import { blocks, checkAssignment, type RuleBreak, warnings } from "@/lib/rules";
import type { UpdateShiftBody } from "@/lib/schemas";
import { localDate, resolveShiftTimes } from "@/lib/time";
import { loadRuleInput } from "./assign";
import { type Db, runTransaction, type Tx } from "./db/client";
import { assignment, auditLog, event, role, shift, type ShiftRow, staff } from "./db/schema";

type Failure = { ok: false; status: 404 | 409 | 422; code: string; message: string; details: unknown };
export type UpdateShiftOutcome = { ok: true; shift: ShiftRow } | Failure;

type Change = { from: unknown; to: unknown };
type PersonBreaks = { staffId: number; name: string; breaks: RuleBreak[] };

/**
 * Edits a shift with optimistic concurrency: the client sends the version it
 * read, and a stale version gets 409 with the current shift so the form can
 * show what changed. A change of times or role re-runs the rules for everyone
 * already on the shift, the same way an assign would.
 */
export function updateShift(db: Db, shiftId: number, body: UpdateShiftBody, actor: string): Promise<UpdateShiftOutcome> {
  return runTransaction(db, async (tx, attempt): Promise<UpdateShiftOutcome> => {
    // Locked so the slots check and the rule re-check can't race an assign to this shift.
    const [current] = await tx.select().from(shift).where(eq(shift.id, shiftId)).for("update");
    if (!current) return { ok: false, status: 404, code: "shift_not_found", message: "That shift doesn't exist any more.", details: null };

    // A retry that finds version + 1 may be looking at its own lost commit.
    const maybeOurs = attempt.isRetry && current.version === body.version + 1;
    if (current.version !== body.version && !maybeOurs) return stale(current);

    const next = await requestedChanges(tx, current, body);
    if ("ok" in next) return next;
    const changes = diff(current, next);
    if (maybeOurs) return Object.keys(changes).length === 0 ? { ok: true, shift: current } : stale(current);
    if (Object.keys(changes).length === 0) return { ok: true, shift: current };

    let overridden: RuleBreak[] = [];
    if ("startsAt" in changes || "endsAt" in changes || "roleId" in changes) {
      const people = await recheckAssigned(tx, { ...current, ...next });
      const blocking = people.filter((p) => blocks(p.breaks).length > 0);
      if (blocking.length > 0) {
        return { ok: false, status: 409, code: "rule_blocked", message: blocks(blocking[0].breaks)[0].message, details: { people } };
      }
      overridden = people.flatMap((p) => warnings(p.breaks));
      if (overridden.length > 0 && !body.overrideReason) {
        return { ok: false, status: 409, code: "needs_override", message: "This change gives people on the shift warnings. Add a reason to go ahead.", details: { people } };
      }
    }

    await tx.update(shift).set({ ...next, version: current.version + 1 }).where(eq(shift.id, shiftId));
    await tx.insert(auditLog).values({
      eventId: current.eventId,
      shiftId,
      actor,
      action: "shift.updated",
      payload: {
        shiftId,
        version: current.version + 1,
        changes,
        overrideReason: overridden.length > 0 ? body.overrideReason : null,
        overridden: [...new Set(overridden.map((b) => b.code))],
      },
    });
    const [updated] = await tx.select().from(shift).where(eq(shift.id, shiftId));
    return { ok: true, shift: updated };
  });
}

function stale(current: ShiftRow): Failure {
  return {
    ok: false,
    status: 409,
    code: "stale_version",
    message: "Someone else changed this shift while you were editing. Check the latest version and try again.",
    details: { current },
  };
}

/** The columns the body asks to change, or a failure if one of them can't be applied. */
async function requestedChanges(tx: Tx, current: ShiftRow, body: UpdateShiftBody): Promise<Partial<ShiftRow> | Failure> {
  const next: Partial<ShiftRow> = {};
  if (body.startTime !== undefined && body.endTime !== undefined) {
    const [ev] = await tx.select({ timezone: event.timezone }).from(event).where(eq(event.id, current.eventId));
    Object.assign(next, resolveShiftTimes(localDate(current.startsAt, ev.timezone), body.startTime, body.endTime, ev.timezone));
  }
  if (body.slots !== undefined) {
    const [{ filled }] = await tx.select({ filled: count() }).from(assignment).where(eq(assignment.shiftId, current.id));
    if (body.slots < filled) {
      return {
        ok: false,
        status: 409,
        code: "slots_below_filled",
        message: `${filled} people are already on this shift. Remove someone before cutting it to ${body.slots}.`,
        details: { filled },
      };
    }
    next.slots = body.slots;
  }
  if (body.roleId !== undefined) {
    const [found] = await tx.select({ id: role.id }).from(role).where(eq(role.id, body.roleId));
    if (!found) {
      return { ok: false, status: 422, code: "validation_failed", message: "That role doesn't exist.", details: { issues: [{ path: "roleId", message: "Unknown role." }] } };
    }
    next.roleId = body.roleId;
  }
  if (body.notes !== undefined) next.notes = body.notes || null;
  return next;
}

/** Rule breaks for each person on the shift if it became `candidate`. Only people with something to say are returned. */
async function recheckAssigned(tx: Tx, candidate: ShiftRow): Promise<PersonBreaks[]> {
  const onShift = await tx.select({ staffId: assignment.staffId }).from(assignment).where(eq(assignment.shiftId, candidate.id));
  if (onShift.length === 0) return [];

  // Same lock order as assign: shift (held already), then staff, in id order so
  // two edits sharing people can't deadlock. This stops someone being booked
  // elsewhere at the new times while we check.
  const people = await tx
    .select()
    .from(staff)
    .where(inArray(staff.id, onShift.map((a) => a.staffId)))
    .orderBy(asc(staff.id))
    .for("update");

  const results: PersonBreaks[] = [];
  for (const person of people) {
    // Slots are checked separately (slots_below_filled), so "full" isn't a break here.
    const breaks = checkAssignment(await loadRuleInput(tx, candidate, person)).filter((b) => b.code !== "shift_full");
    if (breaks.some((b) => b.severity !== "info")) results.push({ staffId: person.id, name: person.name, breaks });
  }
  return results;
}

function comparable(value: unknown) {
  return value instanceof Date ? value.toISOString() : value;
}

function diff(current: ShiftRow, next: Partial<ShiftRow>): Record<string, Change> {
  const changes: Record<string, Change> = {};
  for (const [key, to] of Object.entries(next)) {
    const from = current[key as keyof ShiftRow];
    if (comparable(from) !== comparable(to)) changes[key] = { from: comparable(from), to: comparable(to) };
  }
  return changes;
}
