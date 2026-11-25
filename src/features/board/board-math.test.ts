import { describe, expect, it } from "vitest";
import type { Board, BoardShift } from "@/server/db/queries";
import { addPerson, coverageSentence, emptyFilterTitle, gridColumns, packLanes, removePerson, timeToX } from "./board-math";

function shift(id: number, startTime: string, endTime: string, extra: Partial<BoardShift> = {}): BoardShift {
  return {
    id,
    locationId: 1,
    locationName: "Gate A",
    roleId: 1,
    roleName: "steward",
    requiresSia: false,
    startsAt: "",
    endsAt: "",
    startTime,
    endTime,
    slots: 2,
    filled: 1,
    status: "short",
    notes: null,
    version: 1,
    assigned: [{ assignmentId: 1, staffId: 1, name: "Ana Tamm" }],
    assignedToMe: false,
    requests: [],
    ...extra,
  };
}

describe("timeline geometry", () => {
  it("puts 07:00 at 0 and 13:40 at 373px on the 56px grid", () => {
    expect(timeToX(7 * 60)).toBe(0);
    expect(timeToX(13 * 60 + 40)).toBeCloseTo(373.33, 1);
    expect(timeToX(23 * 60 + 30)).toBe(896);
  });

  it("maps a shift to quarter-hour grid columns and clips past 23:00", () => {
    expect(gridColumns(shift(1, "07:00", "13:00"))).toEqual({ start: 1, end: 25 });
    expect(gridColumns(shift(2, "22:00", "02:00"))).toEqual({ start: 61, end: 65 });
  });
});

describe("packLanes", () => {
  it("reuses a lane when the next shift starts as the last one ends", () => {
    const { lanes, count } = packLanes([shift(1, "07:00", "13:00"), shift(2, "13:00", "19:00"), shift(3, "10:00", "16:00")]);
    expect(lanes.get(1)).toBe(0);
    expect(lanes.get(3)).toBe(1);
    expect(lanes.get(2)).toBe(0);
    expect(count).toBe(2);
  });
});

describe("optimistic changes", () => {
  const base: Board = {
    viewer: { role: "manager" },
    event: { id: 1, name: "Autumn race day", venue: "Riverbank Racecourse", startsOn: "2026-12-05", endsOn: "2026-12-05", timezone: "Europe/London" },
    date: "2026-12-05",
    locations: [],
    roles: [],
    shifts: [shift(1, "14:00", "16:00"), shift(2, "07:00", "09:00")],
    coverage: [
      { hour: "07:00", needed: 2, assigned: 1 },
      { hour: "14:00", needed: 2, assigned: 1 },
      { hour: "15:00", needed: 2, assigned: 1 },
    ],
    summary: { shifts: 2, covered: 0 },
  };

  it("fills the shift, the hours it covers and the summary, and leaves other shifts alone", () => {
    const next = addPerson(base, 1, { assignmentId: -1, staffId: 9, name: "Kofi Mensah" });
    expect(next.shifts[0]).toMatchObject({ filled: 2, status: "covered" });
    expect(next.shifts[1]).toBe(base.shifts[1]);
    expect(next.coverage.map((h) => h.assigned)).toEqual([1, 2, 2]);
    expect(next.summary.covered).toBe(1);
  });

  it("undoes cleanly", () => {
    const next = removePerson(addPerson(base, 1, { assignmentId: -1, staffId: 9, name: "Kofi Mensah" }), 1, 9);
    expect(next.shifts[0]).toMatchObject({ filled: 1, status: "short" });
    expect(next.coverage).toEqual(base.coverage);
    expect(next.summary).toEqual(base.summary);
  });
});

describe("sentences", () => {
  it("names the short span and the worst hours", () => {
    expect(
      coverageSentence([
        { hour: "10:00", needed: 4, assigned: 2 },
        { hour: "14:00", needed: 10, assigned: 4 },
        { hour: "15:00", needed: 10, assigned: 4 },
        { hour: "22:00", needed: 2, assigned: 1 },
      ]),
    ).toBe("Short 10:00 to 23:00. Worst at 14:00 and 15:00, 6 short.");
    expect(coverageSentence([{ hour: "14:00", needed: 4, assigned: 4 }])).toBe("Every hour is covered.");
  });

  it("describes an empty filter in words", () => {
    expect(emptyFilterTitle({ onlyShort: true, roleName: null, locationName: "Gate A" })).toBe("No short shifts at Gate A");
  });
});
