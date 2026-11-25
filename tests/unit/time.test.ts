import { describe, expect, it } from "vitest";
import { addDays, formatDuration, localDate, localTime, resolveShiftTimes, weekStart, zonedToUtc } from "@/lib/time";

const TZ = "Europe/London";

describe("zonedToUtc", () => {
  it.each([
    { date: "2026-12-05", time: "07:00", iso: "2026-12-05T07:00:00.000Z" }, // GMT
    { date: "2026-07-04", time: "07:00", iso: "2026-07-04T06:00:00.000Z" }, // BST
    { date: "2026-03-29", time: "03:00", iso: "2026-03-29T02:00:00.000Z" }, // first hour of BST
  ])("$date $time London is $iso", ({ date, time, iso }) => {
    expect(zonedToUtc(date, time, TZ).toISOString()).toBe(iso);
  });

  it("round trips through localDate and localTime", () => {
    const instant = zonedToUtc("2026-07-04", "23:30", TZ);
    expect(localDate(instant, TZ)).toBe("2026-07-04");
    expect(localTime(instant, TZ)).toBe("23:30");
  });
});

describe("resolveShiftTimes", () => {
  it("treats an end before the start as the next day", () => {
    const { startsAt, endsAt } = resolveShiftTimes("2026-12-05", "22:00", "02:00", TZ);
    expect(startsAt.toISOString()).toBe("2026-12-05T22:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-12-06T02:00:00.000Z");
  });

  it("keeps a same-day shift on the same day", () => {
    const { endsAt } = resolveShiftTimes("2026-12-05", "07:00", "13:00", TZ);
    expect(endsAt.toISOString()).toBe("2026-12-05T13:00:00.000Z");
  });
});

describe("calendar helpers", () => {
  it.each([
    { date: "2026-12-05", monday: "2026-11-30" }, // Saturday
    { date: "2026-12-06", monday: "2026-11-30" }, // Sunday
    { date: "2026-11-30", monday: "2026-11-30" }, // Monday
  ])("week of $date starts $monday", ({ date, monday }) => {
    expect(weekStart(date)).toBe(monday);
  });

  it("adds days across a month end", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });

  it.each([
    { ms: 7.5 * 3_600_000, text: "7 hours 30 minutes" },
    { ms: 11 * 3_600_000, text: "11 hours" },
    { ms: 45 * 60_000, text: "45 minutes" },
    { ms: 0, text: "0 minutes" },
  ])("formats $text", ({ ms, text }) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
