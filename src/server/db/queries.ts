// Read queries for the board, the staff panel and the activity feed.

import { and, asc, desc, eq, gte, inArray, like, lt, type SQL } from "drizzle-orm";
import { type BookedShift, hoursInWeek, type LicenceStatus, type RuleLicence, siaStatus } from "@/lib/rules";
import { addDays, type Instant, localTime, toDate, weekStart, zonedToUtc } from "@/lib/time";
import type { Session } from "../session";
import type { Db } from "./client";
import { assignment, auditLog, event, type EventRow, licence, location, role, shift, shiftRequest, staff } from "./schema";

export const COVERAGE_FIRST_HOUR = 7;
export const COVERAGE_LAST_HOUR = 23; // exclusive: the last bar is 22:00 to 23:00

export type ShiftStatus = "covered" | "short" | "open";

export type BoardPerson = { assignmentId: number; staffId: number; name: string };

export type BoardShift = {
  id: number;
  locationId: number;
  locationName: string;
  roleId: number;
  roleName: string;
  requiresSia: boolean;
  startsAt: string;
  endsAt: string;
  /** "HH:MM" in the event timezone, for display and the edit form. */
  startTime: string;
  endTime: string;
  slots: number;
  filled: number;
  status: ShiftStatus;
  notes: string | null;
  version: number;
  /** Managers see everyone. Workers see only themselves; other names are stripped here, on the server. */
  assigned: BoardPerson[];
  assignedToMe: boolean;
  /** Pending requests. Managers see all, workers only their own. */
  requests: { requestId: number; staffId: number; name: string }[];
};

export type CoverageHour = { hour: string; needed: number; assigned: number };

export type Board = {
  viewer: Session;
  event: EventRow;
  date: string;
  locations: { id: number; name: string; sortOrder: number }[];
  roles: { id: number; name: string; requiresSia: boolean }[];
  shifts: BoardShift[];
  coverage: CoverageHour[];
  summary: { shifts: number; covered: number };
};

export function getEvent(db: Db, eventId: number): Promise<EventRow | undefined> {
  return db.select().from(event).where(eq(event.id, eventId)).then((rows) => rows[0]);
}

function shiftStatus(filled: number, slots: number): ShiftStatus {
  if (filled >= slots) return "covered";
  return filled === 0 ? "open" : "short";
}

/**
 * Staff needed against staff assigned for each hour from 07:00 to 23:00. A
 * shift counts towards every hour it overlaps.
 */
export function coverageByHour(
  shifts: { startsAt: Instant; endsAt: Instant; slots: number; filled: number }[],
  date: string,
  timezone: string,
): CoverageHour[] {
  const hours: CoverageHour[] = [];
  for (let h = COVERAGE_FIRST_HOUR; h < COVERAGE_LAST_HOUR; h++) {
    const label = `${String(h).padStart(2, "0")}:00`;
    const start = zonedToUtc(date, label, timezone);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const inHour = shifts.filter((s) => toDate(s.startsAt) < end && start < toDate(s.endsAt));
    hours.push({
      hour: label,
      needed: inHour.reduce((sum, s) => sum + s.slots, 0),
      assigned: inHour.reduce((sum, s) => sum + Math.min(s.filled, s.slots), 0),
    });
  }
  return hours;
}

export async function getBoard(db: Db, eventId: number, viewer: Session, date?: string): Promise<Board | null> {
  const ev = await getEvent(db, eventId);
  if (!ev) return null;
  const day = date ?? ev.startsOn;
  const dayStart = zonedToUtc(day, "00:00", ev.timezone);
  const dayEnd = zonedToUtc(addDays(day, 1), "00:00", ev.timezone);

  const [locations, roles, shifts] = await Promise.all([
    db.select({ id: location.id, name: location.name, sortOrder: location.sortOrder }).from(location).where(eq(location.eventId, eventId)).orderBy(asc(location.sortOrder)),
    db.select({ id: role.id, name: role.name, requiresSia: role.requiresSia }).from(role).orderBy(asc(role.id)),
    db
      .select()
      .from(shift)
      .where(and(eq(shift.eventId, eventId), gte(shift.startsAt, dayStart), lt(shift.startsAt, dayEnd)))
      .orderBy(asc(shift.startsAt), asc(shift.id)),
  ]);

  const shiftIds = shifts.map((s) => s.id);
  const [people, requests] = shiftIds.length
    ? await Promise.all([
        db
          .select({ shiftId: assignment.shiftId, assignmentId: assignment.id, staffId: staff.id, name: staff.name })
          .from(assignment)
          .innerJoin(staff, eq(staff.id, assignment.staffId))
          .where(inArray(assignment.shiftId, shiftIds))
          .orderBy(asc(assignment.createdAt), asc(assignment.id)),
        db
          .select({ shiftId: shiftRequest.shiftId, requestId: shiftRequest.id, staffId: staff.id, name: staff.name })
          .from(shiftRequest)
          .innerJoin(staff, eq(staff.id, shiftRequest.staffId))
          .where(and(inArray(shiftRequest.shiftId, shiftIds), eq(shiftRequest.status, "pending"))),
      ])
    : [[], []];

  const myId = viewer.role === "worker" ? viewer.staffId : null;
  const visible = <T extends { staffId: number }>(rows: T[]) => (myId === null ? rows : rows.filter((r) => r.staffId === myId));
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const roleById = new Map(roles.map((r) => [r.id, r]));

  const boardShifts: BoardShift[] = shifts.map((s) => {
    const onShift = people.filter((p) => p.shiftId === s.id);
    const shiftRole = roleById.get(s.roleId)!;
    return {
      id: s.id,
      locationId: s.locationId,
      locationName: locationName.get(s.locationId) ?? "",
      roleId: s.roleId,
      roleName: shiftRole.name,
      requiresSia: shiftRole.requiresSia,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      startTime: localTime(s.startsAt, ev.timezone),
      endTime: localTime(s.endsAt, ev.timezone),
      slots: s.slots,
      filled: onShift.length,
      status: shiftStatus(onShift.length, s.slots),
      notes: s.notes,
      version: s.version,
      assigned: visible(onShift).map(({ assignmentId, staffId, name }) => ({ assignmentId, staffId, name })),
      assignedToMe: myId !== null && onShift.some((p) => p.staffId === myId),
      requests: visible(requests.filter((r) => r.shiftId === s.id)).map(({ requestId, staffId, name }) => ({ requestId, staffId, name })),
    };
  });

  return {
    viewer,
    event: ev,
    date: day,
    locations,
    roles,
    shifts: boardShifts,
    coverage: coverageByHour(boardShifts, day, ev.timezone),
    summary: { shifts: boardShifts.length, covered: boardShifts.filter((s) => s.status === "covered").length },
  };
}

export type StaffListItem = {
  id: number;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
  weeklyHourLimit: number;
  licences: RuleLicence[];
  licence: { status: LicenceStatus; expiresOn: string | null };
  hoursThisWeek: number;
  /** Shifts around the event week, so the board can run rules.ts before the drop. */
  booked: BookedShift[];
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Staff for the panel: search by name, filter by role, with licence status and hours in the event's week. Up to `limit` rows (default 50). */
export async function searchStaff(db: Db, query: { eventId: number; q?: string; role?: number; limit: number }): Promise<StaffListItem[] | null> {
  const ev = await getEvent(db, query.eventId);
  if (!ev) return null;

  const filters: SQL[] = [];
  if (query.q) filters.push(like(staff.name, `%${escapeLike(query.q)}%`));
  if (query.role) filters.push(eq(staff.roleId, query.role));

  const people = await db
    .select({ id: staff.id, name: staff.name, email: staff.email, roleId: staff.roleId, roleName: role.name, weeklyHourLimit: staff.weeklyHourLimit })
    .from(staff)
    .innerJoin(role, eq(role.id, staff.roleId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(staff.name), asc(staff.id))
    .limit(query.limit);
  if (people.length === 0) return [];

  // The event's Monday to Sunday week, plus a day either side for rest gaps.
  const monday = weekStart(ev.startsOn);
  const from = zonedToUtc(addDays(monday, -1), "00:00", ev.timezone);
  const to = zonedToUtc(addDays(monday, 8), "00:00", ev.timezone);
  const ids = people.map((p) => p.id);

  const [licences, booked] = await Promise.all([
    db.select({ staffId: licence.staffId, kind: licence.kind, expiresOn: licence.expiresOn }).from(licence).where(inArray(licence.staffId, ids)),
    db
      .select({ staffId: assignment.staffId, shiftId: shift.id, startsAt: shift.startsAt, endsAt: shift.endsAt, locationName: location.name })
      .from(assignment)
      .innerJoin(shift, eq(shift.id, assignment.shiftId))
      .innerJoin(location, eq(location.id, shift.locationId))
      .where(and(inArray(assignment.staffId, ids), gte(shift.startsAt, from), lt(shift.startsAt, to))),
  ]);

  return people.map((p) => {
    const mine = licences.filter((l) => l.staffId === p.id).map(({ kind, expiresOn }) => ({ kind, expiresOn }));
    const shifts = booked
      .filter((b) => b.staffId === p.id)
      .map(({ shiftId, startsAt, endsAt, locationName }) => ({ shiftId, startsAt, endsAt, locationName }));
    return {
      ...p,
      licences: mine,
      licence: siaStatus(mine, ev.startsOn),
      hoursThisWeek: hoursInWeek(shifts, ev.startsOn, ev.timezone),
      booked: shifts,
    };
  });
}

export type ActivityItem = {
  id: number;
  shiftId: number | null;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

/** Audit log for an event, newest first. The cursor is the last id seen. */
export async function listActivity(
  db: Db,
  query: { eventId: number; cursor?: number; limit: number; shiftId?: number },
): Promise<{ items: ActivityItem[]; nextCursor: number | null }> {
  const filters: SQL[] = [eq(auditLog.eventId, query.eventId)];
  if (query.shiftId) filters.push(eq(auditLog.shiftId, query.shiftId));
  if (query.cursor) filters.push(lt(auditLog.id, query.cursor));

  // Fetch one extra row to know whether there is another page.
  const rows = await db
    .select({ id: auditLog.id, shiftId: auditLog.shiftId, actor: auditLog.actor, action: auditLog.action, payload: auditLog.payload, createdAt: auditLog.createdAt })
    .from(auditLog)
    .where(and(...filters))
    .orderBy(desc(auditLog.id))
    .limit(query.limit + 1);

  const items = rows.slice(0, query.limit);
  return { items, nextCursor: rows.length > query.limit ? items[items.length - 1].id : null };
}
