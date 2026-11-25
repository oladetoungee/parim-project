// Time helpers shared by client and server. Instants are UTC Dates; calendar
// days and clock times are strings in an IANA timezone ("Europe/London").
// Built on Intl so there is no date library to ship to the client.

export type Instant = Date | string;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function toDate(value: Instant): Date {
  return value instanceof Date ? value : new Date(value);
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsIn(instant: Date, timezone: string): Parts {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(timezone, formatter);
  }
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(formatter.formatToParts(instant).find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" of the instant in the timezone. */
export function localDate(value: Instant, timezone: string): string {
  const p = partsIn(toDate(value), timezone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:MM" (24 hour) of the instant in the timezone. */
export function localTime(value: Instant, timezone: string): string {
  const p = partsIn(toDate(value), timezone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Converts a wall-clock date and time in a timezone to the UTC instant. */
export function zonedToUtc(date: string, time: string, timezone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Guess with the offset at the wall time, then correct once for DST edges.
  let utc = wallAsUtc - offsetMs(new Date(wallAsUtc), timezone);
  utc = wallAsUtc - offsetMs(new Date(utc), timezone);
  return new Date(utc);
}

function offsetMs(instant: Date, timezone: string): number {
  const p = partsIn(instant, timezone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return wall - Math.floor(instant.getTime() / 60_000) * 60_000;
}

/**
 * A shift entered as a date plus "HH:MM" start and end. An end at or before the
 * start means the shift ends the next day, so 22:00 to 02:00 is four hours.
 */
export function resolveShiftTimes(date: string, start: string, end: string, timezone: string) {
  const startsAt = zonedToUtc(date, start, timezone);
  const endDate = end <= start ? addDays(date, 1) : date;
  return { startsAt, endsAt: zonedToUtc(endDate, end, timezone) };
}

/** Treats an end at or before the start as "ends next day". */
export function normaliseEnd(startsAt: Date, endsAt: Date): Date {
  return endsAt.getTime() > startsAt.getTime() ? endsAt : new Date(endsAt.getTime() + DAY_MS);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`, both "YYYY-MM-DD". Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The Monday of the week that contains the date. */
export function weekStart(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 is Sunday
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

/** "Fri 4 Dec" */
export function formatDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "4 Dec 2026" */
export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "7 hours 30 minutes", "11 hours", "45 minutes" */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const h = hours === 1 ? "1 hour" : `${hours} hours`;
  const m = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  if (hours === 0) return m;
  return minutes === 0 ? h : `${h} ${m}`;
}

export function hoursBetween(startsAt: Date, endsAt: Date): number {
  return (endsAt.getTime() - startsAt.getTime()) / HOUR_MS;
}

export { HOUR_MS, DAY_MS };
