// Pure helpers for the board: where a shift sits on the timeline, which lane
// it goes in, and the sentences the header and mobile view print. No React,
// no fetch, so they are unit tested directly.

import type { Board, BoardPerson, BoardShift, CoverageHour, ShiftStatus } from "@/server/db/queries";

/** The timeline runs 07:00 to 23:00 at 56px an hour, the same grid as the coverage strip. */
export const TIMELINE_START_HOUR = 7;
export const TIMELINE_END_HOUR = 23;
export const HOUR_WIDTH = 56;
export const TIMELINE_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR;
export const TIMELINE_WIDTH = TIMELINE_HOURS * HOUR_WIDTH;
/** Quarter-hour columns. Shifts snap to 15 minutes in the edit form. */
export const SLOT_MINUTES = 15;
export const TIMELINE_COLUMNS = (TIMELINE_HOURS * 60) / SLOT_MINUTES;

/**
 * The demo always runs at 13:40 on event day, so the "now" line sits in the
 * 14:00 gap instead of wherever the reviewer's clock happens to be.
 */
export const DEMO_NOW = "13:40";

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Start and end in minutes after midnight on the shift's day. An end at or before the start runs past midnight. */
export function shiftSpan(shift: Pick<BoardShift, "startTime" | "endTime">) {
  const start = toMinutes(shift.startTime);
  let end = toMinutes(shift.endTime);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

/** Pixels from the left edge of the timeline. */
export function timeToX(minutes: number): number {
  const clamped = Math.min(Math.max(minutes, TIMELINE_START_HOUR * 60), TIMELINE_END_HOUR * 60);
  return ((clamped - TIMELINE_START_HOUR * 60) / 60) * HOUR_WIDTH;
}

/** 1-based CSS grid columns for a shift, clipped to the visible day. */
export function gridColumns(shift: Pick<BoardShift, "startTime" | "endTime">) {
  const { start, end } = shiftSpan(shift);
  const toColumn = (minutes: number) =>
    Math.round((Math.min(Math.max(minutes, TIMELINE_START_HOUR * 60), TIMELINE_END_HOUR * 60) - TIMELINE_START_HOUR * 60) / SLOT_MINUTES);
  const from = toColumn(start);
  const to = Math.max(from + 1, toColumn(end));
  return { start: from + 1, end: to + 1 };
}

/**
 * Greedy interval packing: earliest start first, each shift goes in the first
 * lane that is free by the time it starts. Touching shifts (one ends at 13:00,
 * the next starts at 13:00) share a lane.
 */
export function packLanes<T extends Pick<BoardShift, "id" | "startTime" | "endTime">>(shifts: readonly T[]) {
  const sorted = [...shifts].sort((a, b) => {
    const sa = shiftSpan(a);
    const sb = shiftSpan(b);
    return sa.start - sb.start || sa.end - sb.end || a.id - b.id;
  });
  const laneEnds: number[] = [];
  const lanes = new Map<number, number>();
  for (const s of sorted) {
    const { start, end } = shiftSpan(s);
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    lanes.set(s.id, lane);
  }
  return { lanes, count: laneEnds.length, ordered: sorted };
}

export function overlapsHour(shift: Pick<BoardShift, "startTime" | "endTime">, hour: number) {
  const { start, end } = shiftSpan(shift);
  return start < (hour + 1) * 60 && hour * 60 < end;
}

export function hourOf(label: string) {
  return Number(label.slice(0, 2));
}

export function statusFor(filled: number, slots: number): ShiftStatus {
  if (filled >= slots) return "covered";
  return filled === 0 ? "open" : "short";
}

function withPeople(shift: BoardShift, assigned: BoardPerson[], filled: number): BoardShift {
  return { ...shift, assigned, filled, status: statusFor(filled, shift.slots) };
}

/** Coverage and summary after one shift's fill changed. Other hours keep their objects. */
function recount(board: Board, before: BoardShift, after: BoardShift): Board {
  const delta = Math.min(after.filled, after.slots) - Math.min(before.filled, before.slots);
  const coverage: CoverageHour[] =
    delta === 0
      ? board.coverage
      : board.coverage.map((h) => (overlapsHour(after, hourOf(h.hour)) ? { ...h, assigned: h.assigned + delta } : h));
  const covered = board.summary.covered + (after.status === "covered" ? 1 : 0) - (before.status === "covered" ? 1 : 0);
  return {
    ...board,
    shifts: board.shifts.map((s) => (s.id === after.id ? after : s)),
    coverage,
    summary: { ...board.summary, covered },
  };
}

/** Puts a person on a shift in the cached board. Only the one shift object changes, so only its card re-renders. */
export function addPerson(board: Board, shiftId: number, person: BoardPerson): Board {
  const before = board.shifts.find((s) => s.id === shiftId);
  if (!before) return board;
  const existing = before.assigned.find((p) => p.staffId === person.staffId) as LeavingPerson | undefined;
  // Still on the card mid-exit (a quick retry or override): keep them, stop the exit.
  if (existing?.leaving) return setLeaving(board, shiftId, person.staffId, false);
  if (existing) return board;
  return recount(board, before, withPeople(before, [...before.assigned, person], before.filled + 1));
}

export function removePerson(board: Board, shiftId: number, staffId: number): Board {
  const before = board.shifts.find((s) => s.id === shiftId);
  if (!before) return board;
  const assigned = before.assigned.filter((p) => p.staffId !== staffId);
  if (assigned.length === before.assigned.length) return board;
  return recount(board, before, withPeople(before, assigned, Math.max(0, before.filled - 1)));
}

/**
 * The cache can mark a person as leaving: the card plays their exit (back
 * toward the staff panel) and the write hook drops them once it has played.
 * Only the one shift object changes, and the fill count holds until then.
 */
export type LeavingPerson = BoardPerson & { leaving?: boolean };

export function setLeaving(board: Board, shiftId: number, staffId: number, leaving: boolean): Board {
  const shift = board.shifts.find((s) => s.id === shiftId);
  if (!shift?.assigned.some((p) => p.staffId === staffId)) return board;
  return {
    ...board,
    shifts: board.shifts.map((s) =>
      s.id === shiftId
        ? { ...s, assigned: s.assigned.map((p) => (p.staffId === staffId ? ({ ...p, leaving } as LeavingPerson) : p)) }
        : s,
    ),
  };
}

/** Drops a person marked leaving. Someone put back on the shift since (Retry, Undo) stays. */
export function removeLeaving(board: Board, shiftId: number, staffId: number): Board {
  const shift = board.shifts.find((s) => s.id === shiftId);
  const person = shift?.assigned.find((p) => p.staffId === staffId) as LeavingPerson | undefined;
  return person?.leaving ? removePerson(board, shiftId, staffId) : board;
}

/** Swaps the temporary id of an optimistic person for the real assignment id. */
export function confirmPerson(board: Board, shiftId: number, staffId: number, assignmentId: number): Board {
  return {
    ...board,
    shifts: board.shifts.map((s) =>
      s.id === shiftId
        ? { ...s, assigned: s.assigned.map((p) => (p.staffId === staffId ? { ...p, assignmentId } : p)) }
        : s,
    ),
  };
}

// ---------------------------------------------------------------- sentences

/** "Saturday 5 December" */
export function longDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "Sat 5" */
export function shortDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric" });
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Saturday 5 December, Riverbank Racecourse. 6 locations, 42 shifts, 120 staff." */
export function eventLine(board: Board, staffCount: number | null) {
  const counts = [plural(board.locations.length, "location"), plural(board.shifts.length, "shift")];
  if (staffCount !== null) counts.push(`${staffCount} staff`);
  return `${longDate(board.date)}, ${board.event.venue}. ${counts.join(", ")}.`;
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** "Short 10:00 to 23:00. Worst at 14:00 and 15:00, 6 short." Used where the strip doesn't fit. */
export function coverageSentence(coverage: readonly CoverageHour[]) {
  const short = coverage
    .map((h) => ({ hour: hourOf(h.hour), short: Math.max(0, h.needed - h.assigned) }))
    .filter((h) => h.short > 0);
  if (short.length === 0) return "Every hour is covered.";

  const first = short[0].hour;
  const last = short[short.length - 1].hour + 1;
  const worst = Math.max(...short.map((h) => h.short));
  const worstHours = short.filter((h) => h.short === worst).map((h) => hh(h.hour));
  const listed = worstHours.length === 1 ? worstHours[0] : `${worstHours.slice(0, -1).join(", ")} and ${worstHours[worstHours.length - 1]}`;
  if (worstHours.length === short.length) {
    return short.length === 1 ? `Short ${hh(first)} to ${hh(last)}, ${worst} short.` : `Short ${hh(first)} to ${hh(last)}, ${worst} short each hour.`;
  }
  return `Short ${hh(first)} to ${hh(last)}. Worst at ${listed}, ${worst} short.`;
}

/** "No short steward shifts at Gate A" */
export function emptyFilterTitle(filters: { onlyShort: boolean; roleName: string | null; locationName: string | null }) {
  const words = ["No", filters.onlyShort ? "short" : null, filters.roleName, "shifts"].filter(Boolean).join(" ");
  return filters.locationName ? `${words} at ${filters.locationName}` : words;
}

/** "Gate A 13:00 to 19:00" */
export function shiftPlace(shift: Pick<BoardShift, "locationName" | "startTime" | "endTime">) {
  return `${shift.locationName} ${shift.startTime} to ${shift.endTime}`;
}

/** "steward" becomes "Steward" for labels that start a line. */
export function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
