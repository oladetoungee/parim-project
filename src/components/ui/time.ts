/** "HH:MM" helpers shared by TimeRangeField and ShiftCard. */

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** An end earlier than the start means the shift ends the next day. */
export function endsNextDay(start: string, end: string): boolean {
  if (!start || !end) return false;
  return toMinutes(end) < toMinutes(start);
}

/** Length in minutes, crossing midnight when needed. */
export function durationMinutes(start: string, end: string): number {
  const diff = toMinutes(end) - toMinutes(start);
  return diff < 0 ? diff + 24 * 60 : diff;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
