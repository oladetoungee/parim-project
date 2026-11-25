import { count, eq } from "drizzle-orm";
import type { UpdateShiftBody } from "@/lib/schemas";
import { localDate, resolveShiftTimes } from "@/lib/time";
import { type Db, runTransaction } from "./db/client";
import { assignment, auditLog, event, role, shift, type ShiftRow } from "./db/schema";

type Failure = { ok: false; status: 404 | 409 | 422; code: string; message: string; details: unknown };
export type UpdateShiftOutcome = { ok: true; shift: ShiftRow } | Failure;

type Change = { from: unknown; to: unknown };

/**
 * Edits a shift with optimistic concurrency: the client sends the version it
 * read, and a stale version gets 409 with the current shift so the form can
 * show what changed.
 */
export function updateShift(db: Db, shiftId: number, body: UpdateShiftBody, actor: string): Promise<UpdateShiftOutcome> {
  return runTransaction(
    db,
    async (tx): Promise<UpdateShiftOutcome> => {
      // Locked so the slots check below can't race an assign to the same shift.
      const [current] = await tx.select().from(shift).where(eq(shift.id, shiftId)).for("update");
      if (!current) return { ok: false, status: 404, code: "shift_not_found", message: "That shift doesn't exist any more.", details: null };
      if (current.version !== body.version) {
        return {
          ok: false,
          status: 409,
          code: "stale_version",
          message: "Someone else changed this shift while you were editing. Check the latest version and try again.",
          details: { current },
        };
      }

      const next: Partial<ShiftRow> = {};
      if (body.startTime !== undefined && body.endTime !== undefined) {
        const [ev] = await tx.select({ timezone: event.timezone }).from(event).where(eq(event.id, current.eventId));
        Object.assign(next, resolveShiftTimes(localDate(current.startsAt, ev.timezone), body.startTime, body.endTime, ev.timezone));
      }
      if (body.slots !== undefined) {
        const [{ filled }] = await tx.select({ filled: count() }).from(assignment).where(eq(assignment.shiftId, shiftId));
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
        if (!found) return { ok: false, status: 422, code: "validation_failed", message: "That role doesn't exist.", details: { issues: [{ path: "roleId", message: "Unknown role." }] } };
        next.roleId = body.roleId;
      }
      if (body.notes !== undefined) next.notes = body.notes || null;

      const changes = diff(current, next);
      if (Object.keys(changes).length === 0) return { ok: true, shift: current };

      await tx.update(shift).set({ ...next, version: current.version + 1 }).where(eq(shift.id, shiftId));
      await tx.insert(auditLog).values({
        eventId: current.eventId,
        shiftId,
        actor,
        action: "shift.updated",
        payload: { shiftId, version: current.version + 1, changes },
      });
      const [updated] = await tx.select().from(shift).where(eq(shift.id, shiftId));
      return { ok: true, shift: updated };
    },
  );
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
