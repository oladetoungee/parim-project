import { DndContext } from "@dnd-kit/core";
import { cleanup, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardShift } from "@/server/db/queries";
import { idleView, LocationRow, type CardView } from "./Timeline";

// Counts every render of a shift card, by shift id, through a wrapper around
// the real component. The board's memo sits above it in BoardShiftCard, so a
// card that the memo skips never reaches the wrapper.
const renders = vi.hoisted(() => [] as number[]);
vi.mock("@/components/ui/ShiftCard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/ShiftCard")>();
  function CountingShiftCard(props: ComponentProps<typeof actual.ShiftCard>) {
    renders.push(Number((props as Record<string, unknown>)["data-shift-id"]));
    return <actual.ShiftCard {...props} />;
  }
  return { ...actual, ShiftCard: CountingShiftCard };
});

afterEach(cleanup);
beforeEach(() => {
  renders.length = 0;
});

function shift(id: number, startTime: string, endTime: string, filled: number): BoardShift {
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
    slots: 4,
    filled,
    status: filled >= 4 ? "covered" : filled === 0 ? "open" : "short",
    notes: null,
    version: 1,
    assigned: Array.from({ length: filled }, (_, i) => ({ assignmentId: id * 10 + i, staffId: id * 10 + i, name: `Person ${id}${i}` })),
    assignedToMe: false,
    requests: [],
  };
}

const onOpen = () => undefined;

function row(shifts: BoardShift[], views: Map<number, CardView>) {
  return (
    <DndContext>
      <LocationRow name="Gate A" covered={0} total={shifts.length} shifts={shifts} views={views} onOpen={onOpen} />
    </DndContext>
  );
}

describe("board re-render scope", () => {
  it("a drag re-renders no card, and a drop re-renders only the card it landed on", () => {
    const shifts = [shift(1, "07:00", "11:00", 1), shift(2, "11:00", "15:00", 2), shift(3, "15:00", "19:00", 0)];
    const idle = new Map(shifts.map((s) => [s.id, { ...idleView }]));
    const { container, rerender } = render(row(shifts, idle));
    expect([...renders].sort()).toEqual([1, 2, 3]);

    // Pick someone up: every card becomes a valid or invalid target.
    renders.length = 0;
    const dragging = new Map<number, CardView>([
      [1, { ...idleView, drop: "invalid", dropReason: "Can't assign" }],
      [2, { ...idleView, drop: "valid" }],
      [3, { ...idleView, drop: "valid" }],
    ]);
    rerender(row(shifts, dragging));
    expect(renders).toEqual([]);
    expect(container.querySelectorAll('[data-drop="valid"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-drop="invalid"]')).toHaveLength(1);

    // Drop on shift 2: the cache swaps that one shift object, the drag state clears.
    renders.length = 0;
    const after = [shifts[0], { ...shift(2, "11:00", "15:00", 3) }, shifts[2]];
    rerender(row(after, new Map(after.map((s) => [s.id, { ...idleView }]))));
    expect(renders).toEqual([2]);
    expect(container.querySelector("[data-drop]")).toBeNull();
  });
});
