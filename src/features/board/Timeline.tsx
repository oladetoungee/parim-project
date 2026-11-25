"use client";

import { useDroppable } from "@dnd-kit/core";
import { memo, useMemo, type CSSProperties, type ReactNode } from "react";
import { ShiftCard, type ShiftDropState, type ShiftStatus as CardStatus } from "@/components/ui/ShiftCard";
import { cn } from "@/lib/cn";
import type { BoardShift } from "@/server/db/queries";
import {
  capitalise,
  DEMO_NOW,
  gridColumns,
  HOUR_WIDTH,
  packLanes,
  TIMELINE_COLUMNS,
  TIMELINE_HOURS,
  TIMELINE_WIDTH,
  timeToX,
  toMinutes,
} from "./board-math";
import { shiftDropId } from "./dnd";

/** Width of the label column on the left. The coverage strip starts after it too. */
export const GUTTER_WIDTH = 152;

const cardStatus: Record<BoardShift["status"], CardStatus> = {
  covered: "filled",
  short: "partly-filled",
  open: "open",
};

export type CardView = {
  drop: ShiftDropState;
  dropReason?: string;
  /** Outside the hour picked on the coverage strip. */
  dimmed: boolean;
  selected: boolean;
  /** Set for a moment after a rule blocked a drop: that person gets the conflict ring. */
  clashStaffId?: number;
};

export const idleView: CardView = { drop: "none", dimmed: false, selected: false };

type BoardShiftCardProps = Pick<CardView, "dimmed" | "selected" | "clashStaffId"> & {
  shift: BoardShift;
  onOpen: (shiftId: number) => void;
  /** Room kept in the stub for a control laid over it (the worker's Request shift). */
  stubActionWidth?: number;
};

/** A person in the cache can be marked leaving: their face plays the exit before they are dropped. */
type CachedPerson = BoardShift["assigned"][number] & { leaving?: boolean };

/**
 * One shift on the board. Every prop is a primitive or the shift object,
 * which TanStack Query keeps by reference until that shift changes, so the
 * memo holds and a drop re-renders one card. Drag state is not a prop: the
 * droppable wrapper carries it as data-drop and CSS restyles the card.
 */
export const BoardShiftCard = memo(function BoardShiftCard({
  shift,
  dimmed,
  selected,
  clashStaffId,
  onOpen,
  stubActionWidth,
}: BoardShiftCardProps) {
  const people = useMemo(
    () => shift.assigned.map((p: CachedPerson) => ({ id: String(p.staffId), name: p.name, leaving: p.leaving })),
    [shift.assigned],
  );
  const clashStaffIds = useMemo(() => (clashStaffId === undefined ? undefined : [String(clashStaffId)]), [clashStaffId]);
  const conflict = clashStaffId !== undefined;
  return (
    <div className={cn("relative transition-opacity duration-quick ease-standard", dimmed && "opacity-30")}>
      <ShiftCard
        role={capitalise(shift.roleName)}
        location={shift.locationName}
        start={shift.startTime}
        end={shift.endTime}
        filled={shift.filled}
        needed={shift.slots}
        status={conflict ? "conflict" : cardStatus[shift.status]}
        people={people}
        selected={selected}
        clashStaffIds={clashStaffIds}
        shake={conflict}
        stubActionWidth={stubActionWidth}
        onClick={() => onOpen(shift.id)}
        className="w-full"
        data-shift-id={shift.id}
      />
    </div>
  );
});

/**
 * A card that accepts staff dropped on it. It re-renders as a drag starts,
 * moves and ends; the memoised card inside does not, because the drag state
 * goes on this wrapper as data attributes. The reason a drop is blocked shows
 * above the card while it is the target, instead of growing every card.
 */
function DroppableShift({ shift, view, onOpen, style }: { shift: BoardShift; view: CardView; onOpen: (id: number) => void; style: CSSProperties }) {
  const { setNodeRef, isOver } = useDroppable({ id: shiftDropId(shift.id) });
  const dragging = view.drop !== "none";
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative min-w-0 pr-1"
      data-drop={dragging ? view.drop : undefined}
      data-drop-over={dragging && isOver ? "" : undefined}
    >
      {isOver && view.drop === "invalid" && view.dropReason ? (
        <span
          role="tooltip"
          className="motion-popover pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-max max-w-72 rounded-2 bg-ink px-2 py-1 text-12 font-medium text-canvas shadow-lifted"
          data-state="open"
        >
          {view.dropReason}
        </span>
      ) : null}
      <BoardShiftCard shift={shift} dimmed={view.dimmed} selected={view.selected} clashStaffId={view.clashStaffId} onOpen={onOpen} />
    </div>
  );
}

type LocationRowProps = {
  name: string;
  /** "5 of 7 shifts covered", counted on every shift at the location, not just the filtered ones. */
  covered: number;
  total: number;
  shifts: readonly BoardShift[];
  views: ReadonlyMap<number, CardView>;
  onOpen: (shiftId: number) => void;
};

/**
 * One location. Shifts sit on a 64 column grid (15 minutes each, 14px, so
 * 56px an hour) and are packed into lanes. Grid placement rather than
 * absolute top offsets, so a lane grows to fit the ticket whatever its height.
 */
export function LocationRow({ name, covered, total, shifts, views, onOpen }: LocationRowProps) {
  const { lanes, ordered } = useMemo(() => packLanes(shifts), [shifts]);
  const headingId = `location-${name.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="flex border-b border-hairline py-4 last:border-b-0">
      <div className="flex shrink-0 flex-col gap-0.5 pr-4" style={{ width: GUTTER_WIDTH }}>
        <h3 id={headingId} className="text-16 leading-6 font-semibold text-ink">
          {name}
        </h3>
        <p className="text-12 text-muted tabular">
          {covered} of {total} shifts covered
        </p>
      </div>
      <div
        role="list"
        aria-label={`${name} shifts`}
        className="grid shrink-0 gap-y-2"
        style={{ width: TIMELINE_WIDTH, gridTemplateColumns: `repeat(${TIMELINE_COLUMNS}, minmax(0, 1fr))` }}
      >
        {ordered.map((shift) => {
          const cols = gridColumns(shift);
          return (
            <div key={shift.id} role="listitem" className="contents">
              <DroppableShift
                shift={shift}
                view={views.get(shift.id) ?? idleView}
                onOpen={onOpen}
                style={{ gridColumn: `${cols.start} / ${cols.end}`, gridRow: (lanes.get(shift.id) ?? 0) + 1 }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Hour gridlines and the "now" line, drawn once behind every location row.
 * Both sit under the cards, so the line reads through the gaps without
 * striking through a ticket.
 */
export function TimelineGrid({ children }: { children: ReactNode }) {
  const nowX = timeToX(toMinutes(DEMO_NOW));
  return (
    <div className="relative pt-6" style={{ width: GUTTER_WIDTH + TIMELINE_WIDTH }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0" style={{ left: GUTTER_WIDTH, width: TIMELINE_WIDTH }}>
        {Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => (
          <span key={i} className="absolute top-6 bottom-0 w-px bg-hairline" style={{ left: i * HOUR_WIDTH }} />
        ))}
        <span className="absolute top-6 bottom-0 w-px bg-ink" style={{ left: nowX }} />
        <span className="absolute top-0 -translate-x-1/2 text-12 leading-4 font-medium text-ink tabular" style={{ left: nowX }}>
          Now {DEMO_NOW}
        </span>
      </div>
      <p className="sr-only">The time on the board is {DEMO_NOW}.</p>
      <div className="relative">{children}</div>
    </div>
  );
}
