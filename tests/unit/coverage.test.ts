import { describe, expect, it } from "vitest";
import { coverageByHour } from "@/server/db/queries";
import { resolveShiftTimes } from "@/lib/time";

const TZ = "Europe/London";
const at = (start: string, end: string) => resolveShiftTimes("2026-12-05", start, end, TZ);

describe("coverageByHour", () => {
  it("counts a shift in every hour it overlaps, from 07:00 to 23:00", () => {
    const hours = coverageByHour(
      [
        { ...at("07:00", "09:00"), slots: 4, filled: 4 },
        { ...at("08:30", "10:00"), slots: 2, filled: 1 },
      ],
      "2026-12-05",
      TZ,
    );
    expect(hours).toHaveLength(16);
    expect(hours.slice(0, 4)).toEqual([
      { hour: "07:00", needed: 4, assigned: 4 },
      { hour: "08:00", needed: 6, assigned: 5 },
      { hour: "09:00", needed: 2, assigned: 1 },
      { hour: "10:00", needed: 0, assigned: 0 },
    ]);
  });
});
