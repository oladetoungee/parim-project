import { describe, expect, it } from "vitest";
import {
  type BookedShift,
  checkAssignment,
  hoursInWeek,
  type RuleCode,
  type RuleInput,
  type RuleShift,
  type RuleStaff,
  siaStatus,
} from "@/lib/rules";
import { resolveShiftTimes } from "@/lib/time";

const TZ = "Europe/London";
const STEWARD = 1;
const SECURITY = 3;

function times(date: string, start: string, end: string) {
  return resolveShiftTimes(date, start, end, TZ);
}

function shift(overrides: Partial<RuleShift> & { date?: string; start?: string; end?: string } = {}): RuleShift {
  const { date = "2026-12-05", start = "10:00", end = "16:00", ...rest } = overrides;
  return {
    id: 100,
    ...times(date, start, end),
    locationName: "Gate A",
    roleId: STEWARD,
    roleName: "steward",
    requiresSia: false,
    slots: 4,
    filled: 2,
    ...rest,
  };
}

function staff(overrides: Partial<RuleStaff> = {}): RuleStaff {
  return {
    id: 7,
    name: "Ana Tamm",
    roleId: STEWARD,
    roleName: "steward",
    weeklyHourLimit: 48,
    licences: [],
    ...overrides,
  };
}

function booked(date: string, start: string, end: string, locationName = "Bar 2", shiftId = 200): BookedShift {
  return { shiftId, locationName, ...times(date, start, end) };
}

function securityShift(overrides: Partial<RuleShift> & { date?: string; start?: string; end?: string } = {}) {
  return shift({ locationName: "Security", roleId: SECURITY, roleName: "security", requiresSia: true, ...overrides });
}

function guard(expiresOn?: string) {
  return staff({
    name: "Rasmus Kask",
    roleId: SECURITY,
    roleName: "security",
    licences: expiresOn ? [{ kind: "SIA", expiresOn }] : [],
  });
}

function run(input: Partial<RuleInput>) {
  return checkAssignment({ shift: shift(), staff: staff(), booked: [], timezone: TZ, ...input });
}

function codes(input: Partial<RuleInput>): RuleCode[] {
  return run(input).map((b) => b.code);
}

describe("checkAssignment", () => {
  const cases: { name: string; input: Partial<RuleInput>; expected: RuleCode[] }[] = [
    { name: "a clean assignment", input: {}, expected: [] },

    // role
    { name: "role mismatch", input: { staff: staff({ roleId: 2, roleName: "bar staff" }) }, expected: ["role_mismatch"] },

    // full
    { name: "one slot left", input: { shift: shift({ slots: 4, filled: 3 }) }, expected: [] },
    { name: "shift full", input: { shift: shift({ slots: 4, filled: 4 }) }, expected: ["shift_full"] },

    // overlap
    { name: "overlapping shift", input: { booked: [booked("2026-12-05", "12:00", "18:00")] }, expected: ["overlap"] },
    { name: "the same shift is not an overlap with itself", input: { booked: [{ ...booked("2026-12-05", "10:00", "16:00"), shiftId: 100 }] }, expected: [] },
    {
      name: "midnight crossover: 22:00 to 02:00 overlaps 01:00 to 05:00 next day",
      input: { shift: shift({ start: "22:00", end: "02:00" }), booked: [booked("2026-12-06", "01:00", "05:00")] },
      expected: ["overlap"],
    },
    {
      name: "midnight crossover: a 00:30 start overlaps last night's 23:00 to 01:00",
      input: { shift: shift({ date: "2026-12-06", start: "00:30", end: "04:00" }), booked: [booked("2026-12-05", "23:00", "01:00")] },
      expected: ["overlap"],
    },

    // rest
    {
      name: "back to back shifts give zero rest",
      input: { booked: [booked("2026-12-05", "16:00", "20:00")] },
      expected: ["rest_too_short"],
    },
    {
      name: "rest gap across two days: 23:30 finish, 07:00 start is 7h30m",
      input: { shift: shift({ start: "07:00", end: "13:00" }), booked: [booked("2026-12-04", "17:00", "23:30")] },
      expected: ["rest_too_short"],
    },
    {
      name: "rest gap across two days: exactly 11 hours is fine",
      input: { shift: shift({ start: "10:30", end: "16:00" }), booked: [booked("2026-12-04", "17:00", "23:30")] },
      expected: [],
    },
    {
      name: "rest gap after this shift: overnight end 02:00, next start 12:00",
      input: { shift: shift({ start: "20:00", end: "02:00" }), booked: [booked("2026-12-06", "12:00", "18:00")] },
      expected: ["rest_too_short"],
    },

    // SIA
    { name: "SIA not needed for stewards", input: {}, expected: [] },
    { name: "SIA missing", input: { shift: securityShift(), staff: guard() }, expected: ["sia_missing"] },
    { name: "SIA valid for months", input: { shift: securityShift(), staff: guard("2027-06-30") }, expected: [] },
    { name: "SIA expired the day before", input: { shift: securityShift(), staff: guard("2026-12-04") }, expected: ["sia_expired"] },
    { name: "SIA expiring exactly on the shift date still covers it", input: { shift: securityShift(), staff: guard("2026-12-05") }, expected: ["sia_expiring"] },
    { name: "SIA expiring in 14 days", input: { shift: securityShift(), staff: guard("2026-12-19") }, expected: ["sia_expiring"] },
    { name: "SIA expiring in 15 days", input: { shift: securityShift(), staff: guard("2026-12-20") }, expected: [] },
    {
      name: "SIA expiring on the start day of an overnight shift is expired by the end",
      input: { shift: securityShift({ start: "20:00", end: "02:00" }), staff: guard("2026-12-05") },
      expected: ["sia_expired"],
    },

    // weekly hours, week of Mon 30 Nov to Sun 6 Dec 2026
    {
      name: "exactly 48 hours is allowed",
      input: {
        // 4 x 10.5h = 42h earlier in the week, plus this 6h shift = 48h
        booked: ["11-30", "12-01", "12-02", "12-03"].map((d, i) => booked(`2026-${d}`, "08:00", "18:30", "Car park", 300 + i)),
      },
      expected: [],
    },
    {
      name: "48.5 hours is over the limit",
      input: {
        booked: ["11-30", "12-01", "12-02", "12-03"].map((d, i) => booked(`2026-${d}`, "08:00", "18:30", "Car park", 300 + i)),
        shift: shift({ start: "10:00", end: "16:30" }),
      },
      expected: ["weekly_hours"],
    },
    {
      name: "hours from the previous week don't count",
      input: {
        booked: ["11-23", "11-24", "11-25", "11-26", "11-27"].map((d, i) => booked(`2026-${d}`, "08:00", "20:00", "Car park", 300 + i)),
      },
      expected: [],
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    expect(codes(input)).toEqual(expected);
  });

  it("puts blocks before warnings and info", () => {
    const result = run({
      shift: securityShift({ start: "07:00", end: "13:00", slots: 2, filled: 2 }),
      staff: guard("2026-12-10"),
      booked: [booked("2026-12-04", "17:00", "23:30")],
    });
    expect(result.map((b) => b.severity)).toEqual(["block", "warn", "info"]);
  });
});

describe("messages use real names and local times", () => {
  it.each([
    {
      name: "overlap",
      input: { booked: [booked("2026-12-05", "12:00", "18:00")] },
      message: "Ana Tamm is already on Bar 2, 12:00 to 18:00.",
    },
    {
      name: "overlap on another day names the day",
      input: { shift: shift({ start: "22:00", end: "02:00" }), booked: [booked("2026-12-06", "01:00", "05:00")] },
      message: "Ana Tamm is already on Bar 2, 01:00 to 05:00 on Sun 6 Dec.",
    },
    {
      name: "rest",
      input: { shift: shift({ start: "07:00", end: "13:00" }), booked: [booked("2026-12-04", "17:00", "23:30")] },
      message: "Ana Tamm finishes Bar 2 at 23:30 on Fri 4 Dec, leaving 7 hours 30 minutes of rest before this shift. The minimum is 11 hours.",
    },
    {
      name: "full",
      input: { shift: shift({ filled: 4 }) },
      message: "Gate A 10:00 to 16:00 is full, 4 of 4 filled.",
    },
    {
      name: "role",
      input: { staff: staff({ roleId: 2, roleName: "bar staff" }) },
      message: "Ana Tamm's role is bar staff. This shift needs steward.",
    },
    {
      name: "SIA expired",
      input: { shift: securityShift(), staff: guard("2026-11-30") },
      message: "Rasmus Kask's SIA licence expired on 30 Nov 2026.",
    },
    {
      name: "SIA expiring on the day",
      input: { shift: securityShift(), staff: guard("2026-12-05") },
      message: "Rasmus Kask's SIA licence expires on 5 Dec 2026, on the day of this shift.",
    },
    {
      name: "weekly hours",
      input: {
        booked: ["11-30", "12-01", "12-02", "12-03", "12-04"].map((d, i) => booked(`2026-${d}`, "08:00", "17:00", "Car park", 300 + i)),
      },
      message: "Ana Tamm would work 51 hours in the week of Mon 30 Nov, over the 48 hour limit.",
    },
  ])("$name", ({ input, message }) => {
    expect(run(input).map((b) => b.message)).toContain(message);
  });
});

describe("siaStatus", () => {
  it.each([
    { licences: [], status: "none" },
    { licences: [{ kind: "SIA", expiresOn: "2026-12-04" }], status: "expired" },
    { licences: [{ kind: "SIA", expiresOn: "2026-12-05" }], status: "expiring" },
    { licences: [{ kind: "SIA", expiresOn: "2027-12-05" }], status: "valid" },
    { licences: [{ kind: "First aid", expiresOn: "2027-12-05" }], status: "none" },
    // a renewed licence wins over the old one
    { licences: [{ kind: "SIA", expiresOn: "2026-01-01" }, { kind: "SIA", expiresOn: "2028-01-01" }], status: "valid" },
  ])("$status for $licences.length licences", ({ licences, status }) => {
    expect(siaStatus(licences, "2026-12-05").status).toBe(status);
  });
});

describe("hoursInWeek", () => {
  it("counts an overnight shift in the week it starts", () => {
    const sundayNight = booked("2026-12-06", "22:00", "06:00");
    expect(hoursInWeek([sundayNight], "2026-12-05", TZ)).toBe(8);
    expect(hoursInWeek([sundayNight], "2026-12-07", TZ)).toBe(0);
  });
});
