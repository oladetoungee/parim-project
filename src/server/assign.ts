// The assign transaction. See BUILD-SPEC.md section 4, "Assigning under concurrency".

import { and, count, desc, eq, gte, lte, ne } from "drizzle-orm";
import { blocks, checkAssignment, type RuleBreak, type RuleInput, warnings } from "@/lib/rules";
import { DAY_MS } from "@/lib/time";
import { type Db, runTransaction, type Tx } from "./db/client";
import { assignment, auditLog, event, licence, location, role, shift, type ShiftRow, staff, type StaffRow } from "./db/schema";

type Executor = Db | Tx;

export type AssignInput = { shiftId: number; staffId: number; overrideReason?: string | null };

export type AssignFailure = {
  ok: false;
  status: 404 | 409;
  code: string;
  message: string;
  details: { breaks: RuleBreak[]; takenBy?: { staffId: number; name: string } | null } | null;
};

export type AssignSuccess = {
  ok: true;
  assignment: typeof assignment.$inferSelect;
  /** Warnings that were overridden, plus info notes such as a licence expiring soon. */
  notes: RuleBreak[];
};

export type AssignOutcome = AssignSuccess | AssignFailure;

function fail(status: 404 | 409, code: string, message: string, details: AssignFailure["details"] = null): AssignFailure {
  return { ok: false, status, code, message, details };
}

/** Loads everything rules.ts needs to judge putting `person` on `target`. */
export async function loadRuleInput(db: Executor, target: ShiftRow, person: StaffRow): Promise<RuleInput> {
  const [[shiftRole], [personRole], [place], [ev], [{ filled }], licences] = await Promise.all([
    db.select().from(role).where(eq(role.id, target.roleId)),
    db.select().from(role).where(eq(role.id, person.roleId)),
    db.select().from(location).where(eq(location.id, target.locationId)),
    db.select().from(event).where(eq(event.id, target.eventId)),
    db.select({ filled: count() }).from(assignment).where(eq(assignment.shiftId, target.id)),
    db.select({ kind: licence.kind, expiresOn: licence.expiresOn }).from(licence).where(eq(licence.staffId, person.id)),
  ]);

  // A week either side covers the rest gap and the Monday to Sunday hours window.
  const from = new Date(target.startsAt.getTime() - 8 * DAY_MS);
  const to = new Date(target.endsAt.getTime() + 8 * DAY_MS);
  const booked = await db
    .select({ shiftId: shift.id, startsAt: shift.startsAt, endsAt: shift.endsAt, locationName: location.name })
    .from(assignment)
    .innerJoin(shift, eq(shift.id, assignment.shiftId))
    .innerJoin(location, eq(location.id, shift.locationId))
    .where(and(eq(assignment.staffId, person.id), ne(shift.id, target.id), gte(shift.startsAt, from), lte(shift.startsAt, to)));

  return {
    shift: {
      id: target.id,
      startsAt: target.startsAt,
      endsAt: target.endsAt,
      locationName: place.name,
      roleId: shiftRole.id,
      roleName: shiftRole.name,
      requiresSia: shiftRole.requiresSia,
      slots: target.slots,
      filled,
    },
    staff: {
      id: person.id,
      name: person.name,
      roleId: personRole.id,
      roleName: personRole.name,
      weeklyHourLimit: person.weeklyHourLimit,
      licences,
    },
    booked,
    timezone: ev.timezone,
  };
}

/** The person who took the last slot, for the "someone else took the slot" toast. */
async function lastAssigned(db: Executor, shiftId: number) {
  const [row] = await db
    .select({ staffId: staff.id, name: staff.name })
    .from(assignment)
    .innerJoin(staff, eq(staff.id, assignment.staffId))
    .where(eq(assignment.shiftId, shiftId))
    .orderBy(desc(assignment.createdAt), desc(assignment.id))
    .limit(1);
  return row ?? null;
}

/** A failure for the first blocking rule, or null when nothing blocks. */
export async function blockingFailure(db: Executor, breaks: RuleBreak[], shiftId: number) {
  const blocking = blocks(breaks);
  const full = blocking.find((b) => b.code === "shift_full");
  if (full) {
    // Its own code, because the board treats it differently: refresh the card and say who got the slot.
    return fail(409, "shift_full", full.message, { breaks, takenBy: await lastAssigned(db, shiftId) });
  }
  if (blocking.length > 0) return fail(409, "rule_blocked", blocking[0].message, { breaks });
  return null;
}

export function isDuplicateKeyError(error: unknown): boolean {
  // Drizzle wraps the mysql2 error, so look at the cause as well.
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") return true;
  }
  return false;
}

/** Assigns inside an open transaction. Start it with runTransaction (READ COMMITTED). */
export async function assignInTransaction(tx: Tx, input: AssignInput, actor: string): Promise<AssignOutcome> {
  // Lock the shift row. Every assign to this shift queues here, so the count
  // below can't change under us and the last slot can only be taken once.
  const [target] = await tx.select().from(shift).where(eq(shift.id, input.shiftId)).for("update");
  if (!target) return fail(404, "shift_not_found", "That shift doesn't exist any more.");

  // Lock the person too, so two shifts can't each take them at overlapping times.
  // Always shift first, then staff: one fixed order means no deadlock.
  const [person] = await tx.select().from(staff).where(eq(staff.id, input.staffId)).for("update");
  if (!person) return fail(404, "staff_not_found", "That person doesn't exist any more.");

  const [existing] = await tx
    .select({ id: assignment.id })
    .from(assignment)
    .where(and(eq(assignment.shiftId, target.id), eq(assignment.staffId, person.id)));
  if (existing) return fail(409, "already_assigned", `${person.name} is already on this shift.`);

  const breaks = checkAssignment(await loadRuleInput(tx, target, person));
  const blocked = await blockingFailure(tx, breaks, target.id);
  if (blocked) return blocked;

  const overridden = warnings(breaks);
  if (overridden.length > 0 && !input.overrideReason) {
    return fail(409, "needs_override", "This assignment has warnings. Add a reason to go ahead.", { breaks });
  }
  const overrideReason = overridden.length > 0 ? input.overrideReason! : null;

  let id: number;
  try {
    [{ id }] = await tx
      .insert(assignment)
      .values({ shiftId: target.id, staffId: person.id, overrideReason, createdBy: actor })
      .$returningId();
  } catch (error) {
    // The unique (shift_id, staff_id) index is the last line of defence.
    if (isDuplicateKeyError(error)) return fail(409, "already_assigned", `${person.name} is already on this shift.`);
    throw error;
  }

  await tx.insert(auditLog).values({
    eventId: target.eventId,
    shiftId: target.id,
    actor,
    action: "assignment.created",
    payload: {
      assignmentId: id,
      shiftId: target.id,
      staffId: person.id,
      staffName: person.name,
      overrideReason,
      overridden: overridden.map((b) => b.code),
    },
  });

  const [created] = await tx.select().from(assignment).where(eq(assignment.id, id));
  return { ok: true, assignment: created, notes: breaks.filter((b) => b.severity !== "block") };
}

export function assignStaff(db: Db, input: AssignInput, actor: string): Promise<AssignOutcome> {
  return runTransaction(db, (tx) => assignInTransaction(tx, input, actor));
}

export type RemoveOutcome =
  | { ok: true; assignment: typeof assignment.$inferSelect }
  | { ok: false; status: 404; code: string; message: string; details: null };

/** Deletes an assignment and returns the deleted row so Undo can restore it. */
export function removeAssignment(db: Db, assignmentId: number, actor: string): Promise<RemoveOutcome> {
  return runTransaction(db, async (tx): Promise<RemoveOutcome> => {
    const [row] = await tx
      .select({ assignment, eventId: shift.eventId, staffName: staff.name })
      .from(assignment)
      .innerJoin(shift, eq(shift.id, assignment.shiftId))
      .innerJoin(staff, eq(staff.id, assignment.staffId))
      .where(eq(assignment.id, assignmentId));
    const notFound = { ok: false, status: 404, code: "assignment_not_found", message: "That assignment was already removed.", details: null } as const;
    if (!row) return notFound;

    // No FOR UPDATE here: a locking read with joins would also lock the shift and
    // staff rows, in a different order from assign. The delete's own row count
    // tells us if a parallel remove got there first.
    const [result] = await tx.delete(assignment).where(eq(assignment.id, assignmentId));
    if (result.affectedRows === 0) return notFound;
    await tx.insert(auditLog).values({
      eventId: row.eventId,
      shiftId: row.assignment.shiftId,
      actor,
      action: "assignment.removed",
      payload: {
        assignmentId,
        shiftId: row.assignment.shiftId,
        staffId: row.assignment.staffId,
        staffName: row.staffName,
        overrideReason: row.assignment.overrideReason,
      },
    });
    return { ok: true, assignment: row.assignment };
  });
}
