// Assignment rules. Pure functions with no database access, so the board can
// run them for instant feedback and the server can run them again inside the
// assign transaction. The server's answer wins.

import {
  addDays,
  daysBetween,
  formatDate,
  formatDay,
  formatDuration,
  HOUR_MS,
  hoursBetween,
  type Instant,
  localDate,
  localTime,
  normaliseEnd,
  toDate,
  weekStart,
} from "./time";

/**
 * block: the assignment can't happen.
 * warn: a manager can go ahead with a written reason (stored in the audit log).
 * info: worth showing, needs nothing (an SIA licence that expires soon).
 */
export type Severity = "block" | "warn" | "info";

export type RuleCode =
  | "role_mismatch"
  | "shift_full"
  | "overlap"
  | "rest_too_short"
  | "sia_missing"
  | "sia_expired"
  | "sia_expiring"
  | "weekly_hours";

export type RuleBreak = { code: RuleCode; severity: Severity; message: string };

export type RuleShift = {
  id: number;
  startsAt: Instant;
  endsAt: Instant;
  locationName: string;
  roleId: number;
  roleName: string;
  requiresSia: boolean;
  slots: number;
  filled: number;
};

export type RuleLicence = { kind: string; expiresOn: string };

export type RuleStaff = {
  id: number;
  name: string;
  roleId: number;
  roleName: string;
  weeklyHourLimit: number;
  licences: RuleLicence[];
};

/** Another shift the person is already on. */
export type BookedShift = {
  shiftId: number;
  startsAt: Instant;
  endsAt: Instant;
  locationName: string;
};

export type RuleInput = {
  shift: RuleShift;
  staff: RuleStaff;
  booked: BookedShift[];
  timezone: string;
};

export const MIN_REST_HOURS = 11;
export const SIA_WARNING_DAYS = 14;
export const SIA_KIND = "SIA";

type Interval = { start: Date; end: Date };

function interval(startsAt: Instant, endsAt: Instant): Interval {
  const start = toDate(startsAt);
  return { start, end: normaliseEnd(start, toDate(endsAt)) };
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

/** "12:00 to 18:00", with the day added when it isn't the shift's own day. */
function describeTimes(target: Interval, onDay: string, timezone: string) {
  const times = `${localTime(target.start, timezone)} to ${localTime(target.end, timezone)}`;
  const day = localDate(target.start, timezone);
  return day === onDay ? times : `${times} on ${formatDay(day)}`;
}

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export function checkRoleMatch({ shift, staff }: RuleInput): RuleBreak[] {
  if (staff.roleId === shift.roleId) return [];
  return [
    {
      code: "role_mismatch",
      severity: "block",
      message: `${staff.name}'s role is ${staff.roleName}. This shift needs ${shift.roleName}.`,
    },
  ];
}

export function checkShiftFull({ shift, timezone }: RuleInput): RuleBreak[] {
  if (shift.filled < shift.slots) return [];
  const span = interval(shift.startsAt, shift.endsAt);
  const times = `${localTime(span.start, timezone)} to ${localTime(span.end, timezone)}`;
  return [
    {
      code: "shift_full",
      severity: "block",
      message: `${shift.locationName} ${times} is full, ${shift.filled} of ${shift.slots} filled.`,
    },
  ];
}

export function checkOverlap({ shift, staff, booked, timezone }: RuleInput): RuleBreak[] {
  const span = interval(shift.startsAt, shift.endsAt);
  const day = localDate(span.start, timezone);
  return others(booked, shift.id)
    .map((other) => ({ other, otherSpan: interval(other.startsAt, other.endsAt) }))
    .filter(({ otherSpan }) => overlaps(span, otherSpan))
    .map(({ other, otherSpan }) => ({
      code: "overlap" as const,
      severity: "block" as const,
      message: `${staff.name} is already on ${other.locationName}, ${describeTimes(otherSpan, day, timezone)}.`,
    }));
}

export function checkRest({ shift, staff, booked, timezone }: RuleInput): RuleBreak[] {
  const span = interval(shift.startsAt, shift.endsAt);
  const minRestMs = MIN_REST_HOURS * HOUR_MS;
  const breaks: RuleBreak[] = [];

  for (const other of others(booked, shift.id)) {
    const otherSpan = interval(other.startsAt, other.endsAt);
    if (overlaps(span, otherSpan)) continue; // already a block, no need to say it twice

    const otherIsBefore = otherSpan.end <= span.start;
    const gapMs = otherIsBefore
      ? span.start.getTime() - otherSpan.end.getTime()
      : otherSpan.start.getTime() - span.end.getTime();
    if (gapMs >= minRestMs) continue;

    const rest = formatDuration(gapMs);
    const message = otherIsBefore
      ? `${staff.name} finishes ${other.locationName} at ${localTime(otherSpan.end, timezone)} on ${formatDay(localDate(otherSpan.end, timezone))}, leaving ${rest} of rest before this shift. The minimum is ${MIN_REST_HOURS} hours.`
      : `${staff.name} starts ${other.locationName} at ${localTime(otherSpan.start, timezone)} on ${formatDay(localDate(otherSpan.start, timezone))}, only ${rest} after this shift ends. The minimum is ${MIN_REST_HOURS} hours.`;
    breaks.push({ code: "rest_too_short", severity: "warn", message });
  }
  return breaks;
}

export type LicenceStatus = "none" | "valid" | "expiring" | "expired";

/**
 * SIA licence status on a calendar day. A licence is valid up to and including
 * its expiry date, so one that expires on the shift date still covers it.
 */
export function siaStatus(licences: RuleLicence[], onDate: string): { status: LicenceStatus; expiresOn: string | null } {
  const sia = licences
    .filter((l) => l.kind === SIA_KIND)
    .sort((a, b) => b.expiresOn.localeCompare(a.expiresOn))[0];
  if (!sia) return { status: "none", expiresOn: null };
  const daysLeft = daysBetween(onDate, sia.expiresOn);
  if (daysLeft < 0) return { status: "expired", expiresOn: sia.expiresOn };
  if (daysLeft <= SIA_WARNING_DAYS) return { status: "expiring", expiresOn: sia.expiresOn };
  return { status: "valid", expiresOn: sia.expiresOn };
}

export function checkSia({ shift, staff, timezone }: RuleInput): RuleBreak[] {
  if (!shift.requiresSia) return [];
  const span = interval(shift.startsAt, shift.endsAt);
  // Checked against the day the shift ends, so an overnight shift can't run
  // past midnight on a licence that expired at the end of the start day.
  const lastDay = localDate(span.end, timezone);
  const { status, expiresOn } = siaStatus(staff.licences, lastDay);

  if (status === "none") {
    return [{ code: "sia_missing", severity: "block", message: `${staff.name} has no SIA licence. ${shift.roleName} shifts need one.` }];
  }
  if (status === "expired") {
    return [{ code: "sia_expired", severity: "block", message: `${staff.name}'s SIA licence expired on ${formatDate(expiresOn!)}.` }];
  }
  if (status === "expiring") {
    const daysLeft = daysBetween(localDate(span.start, timezone), expiresOn!);
    const when = daysLeft === 0 ? "on the day of this shift" : `in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;
    return [{ code: "sia_expiring", severity: "info", message: `${staff.name}'s SIA licence expires on ${formatDate(expiresOn!)}, ${when}.` }];
  }
  return [];
}

/**
 * Hours from shifts that start in the Monday to Sunday week (event timezone)
 * containing `date`. Overnight shifts count in the week they start.
 */
export function hoursInWeek(booked: BookedShift[], date: string, timezone: string): number {
  const monday = weekStart(date);
  const nextMonday = addDays(monday, 7);
  return booked
    .map((b) => interval(b.startsAt, b.endsAt))
    .filter((span) => {
      const day = localDate(span.start, timezone);
      return day >= monday && day < nextMonday;
    })
    .reduce((total, span) => total + hoursBetween(span.start, span.end), 0);
}

export function checkWeeklyHours({ shift, staff, booked, timezone }: RuleInput): RuleBreak[] {
  const span = interval(shift.startsAt, shift.endsAt);
  const day = localDate(span.start, timezone);
  const total = hoursInWeek(others(booked, shift.id), day, timezone) + hoursBetween(span.start, span.end);
  if (total <= staff.weeklyHourLimit) return [];
  return [
    {
      code: "weekly_hours",
      severity: "warn",
      message: `${staff.name} would work ${formatHours(total)} hours in the week of ${formatDay(weekStart(day))}, over the ${staff.weeklyHourLimit} hour limit.`,
    },
  ];
}

function others(booked: BookedShift[], shiftId: number) {
  return booked.filter((b) => b.shiftId !== shiftId);
}

const RULES = [checkRoleMatch, checkShiftFull, checkOverlap, checkSia, checkRest, checkWeeklyHours];

/** Every rule break for putting `staff` on `shift`, blocks first. */
export function checkAssignment(input: RuleInput): RuleBreak[] {
  const order: Record<Severity, number> = { block: 0, warn: 1, info: 2 };
  return RULES.flatMap((rule) => rule(input)).sort((a, b) => order[a.severity] - order[b.severity]);
}

export function blocks(breaks: RuleBreak[]) {
  return breaks.filter((b) => b.severity === "block");
}

export function warnings(breaks: RuleBreak[]) {
  return breaks.filter((b) => b.severity === "warn");
}
