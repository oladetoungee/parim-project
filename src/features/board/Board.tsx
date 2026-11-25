"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  useDndMonitor,
  MeasuringStrategy,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StaffRow } from "@/components/ui/StaffRow";
import { useToast } from "@/components/ui/Toast";
import { blocks, checkAssignment, type BookedShift } from "@/lib/rules";
import type { Board, BoardShift, StaffListItem } from "@/server/db/queries";
import { DemoStatesMenu, RoleSwitch } from "./BoardControls";
import { BoardFilters, CoverageSection, CoverageSummary, EventHeader, noFilters, type Filters } from "./BoardHeader";
import { BoardSkeleton } from "./BoardSkeleton";
import { capitalise, emptyFilterTitle, hourOf, overlapsHour, packLanes, shiftSpan } from "./board-math";
import {
  boardAnnouncements,
  boardCollision,
  idFrom,
  judge,
  PICK_UP_CODE,
  screenReaderInstructions,
  shiftKeyboardCoordinates,
  type DropCheck,
  type KeyboardTarget,
} from "./dnd";
import { useDemoState } from "./demo-state";
import { MOBILE_QUERY, useDebounced, useMediaQuery } from "./hooks";
import { OverrideDialog } from "./OverrideDialog";
import { useBoard, useStaff } from "./queries";
import { ShiftDrawer } from "./ShiftDrawer";
import { rowLicence, StaffPanel } from "./StaffPanel";
import { StaffSheet } from "./StaffSheet";
import { BoardShiftCard, idleView, LocationRow, TimelineGrid, type CardView } from "./Timeline";
import { TopBar } from "@/features/shell/TopBar";
import { cn } from "@/lib/cn";
import { useBoardWrites, type OverrideRequest } from "./useBoardWrites";
import { WorkerPanel, workerIdentity } from "./WorkerPanel";

/** How long a blocked card keeps its red outline after the shake. */
const CONFLICT_MS = 2400;

/** Same as the seeded board with every shift taken away, for the "Empty event" demo state. */
function emptied(board: Board): Board {
  return {
    ...board,
    shifts: [],
    coverage: board.coverage.map((h) => ({ ...h, needed: 0, assigned: 0 })),
    summary: { shifts: 0, covered: 0 },
  };
}

function matches(shift: BoardShift, filters: Filters) {
  if (filters.roleId !== null && shift.roleId !== filters.roleId) return false;
  if (filters.locationId !== null && shift.locationId !== filters.locationId) return false;
  if (filters.onlyShort && shift.status === "covered") return false;
  return true;
}

/** Shifts a person is on: the staff list's copy, plus anything the board shows them on now (optimistic drops included). */
function bookedFor(person: StaffListItem, shifts: readonly BoardShift[]): BookedShift[] {
  const booked = new Map(person.booked.map((b) => [b.shiftId, b]));
  for (const s of shifts) {
    const onIt = s.assigned.some((p) => p.staffId === person.id);
    if (onIt) booked.set(s.id, { shiftId: s.id, startsAt: s.startsAt, endsAt: s.endsAt, locationName: s.locationName });
    else booked.delete(s.id);
  }
  return [...booked.values()];
}

/**
 * State a keyboard drag needs outside React: which shift it is over (the
 * arrow keys set it, collision detection reads it) and the current list of
 * valid targets. Held in one object so dnd-kit's callbacks always see it.
 */
function createKeyboardDrag() {
  let target: number | null = null;
  let valid: (staffId: number) => KeyboardTarget[] = () => [];
  return {
    getTarget: () => target,
    setTarget: (id: number | null) => {
      target = id;
    },
    targets: (staffId: number) => valid(staffId),
    setTargets: (fn: (staffId: number) => KeyboardTarget[]) => {
      valid = fn;
    },
  };
}

export function BoardScreen() {
  const { toast } = useToast();
  const demo = useDemoState();
  const boardQuery = useBoard();
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const loaded = boardQuery.data;
  const board = useMemo(() => (loaded && demo.state === "empty" ? emptied(loaded) : loaded), [loaded, demo.state]);
  const manager = board?.viewer.role === "manager";

  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim(), 150);
  const staffQuery = useStaff(query, manager);
  const allStaff = useStaff("", manager);

  const [filters, setFilters] = useState<Filters>(noFilters);
  const [activeHour, setActiveHour] = useState<number | null>(null);
  const [openShiftId, setOpenShiftId] = useState<number | null>(null);
  const [sheetShiftId, setSheetShiftId] = useState<number | null>(null);
  const [override, setOverride] = useState<OverrideRequest | null>(null);
  const [conflict, setConflict] = useState<{ shiftId: number; staffId: number } | null>(null);
  const [dragging, setDragging] = useState<StaffListItem | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!conflict) return;
    const timer = window.setTimeout(() => setConflict(null), CONFLICT_MS);
    return () => window.clearTimeout(timer);
  }, [conflict]);

  const writes = useBoardWrites({
    onNeedsOverride: setOverride,
    onBlocked: useCallback((shiftId: number, staffId: number) => setConflict({ shiftId, staffId }), []),
  });

  // ------------------------------------------------------------ derived data

  const shifts = useMemo(() => board?.shifts ?? [], [board]);
  const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);
  const staffById = useMemo(() => {
    const map = new Map<number, StaffListItem>();
    for (const item of allStaff.data ?? []) map.set(item.id, item);
    for (const item of staffQuery.data ?? []) map.set(item.id, item);
    return map;
  }, [allStaff.data, staffQuery.data]);

  const visible = useMemo(() => shifts.filter((s) => matches(s, filters)), [shifts, filters]);

  const sections = useMemo(() => {
    if (!board) return [];
    return board.locations
      .filter((l) => filters.locationId === null || l.id === filters.locationId)
      .map((l) => {
        const all = shifts.filter((s) => s.locationId === l.id);
        return {
          id: l.id,
          name: l.name,
          total: all.length,
          covered: all.filter((s) => s.status === "covered").length,
          shifts: visible.filter((s) => s.locationId === l.id),
        };
      })
      .filter((section) => section.shifts.length > 0);
  }, [board, shifts, visible, filters.locationId]);

  /** Reading order for the keyboard: location by location, then lane by lane as drawn. */
  const keyboardOrder = useMemo(
    () => sections.flatMap((section, row) => packLanes(section.shifts).ordered.map((s) => ({ id: s.id, row }))),
    [sections],
  );

  const check = useCallback(
    (staffId: number, shiftId: number): DropCheck => {
      const person = staffById.get(staffId);
      const shift = shiftById.get(shiftId);
      if (!person || !shift || !board) return { valid: false, breaks: [], reason: "Can't assign: this person or shift is no longer on the board." };
      return judge(
        checkAssignment({
          shift,
          staff: person,
          booked: bookedFor(person, shifts),
          timezone: board.event.timezone,
        }),
      );
    },
    [staffById, shiftById, shifts, board],
  );

  /** What each card shows: drop state while dragging, dim outside the picked hour, the conflict outline. */
  const views = useMemo(() => {
    const map = new Map<number, CardView>();
    for (const s of visible) {
      let view = idleView;
      if (dragging) {
        const result = check(dragging.id, s.id);
        view = { ...view, drop: result.valid ? "valid" : "invalid", dropReason: result.reason };
      }
      if (activeHour !== null && !overlapsHour(s, activeHour)) view = { ...view, dimmed: true };
      if (sheetShiftId === s.id) view = { ...view, selected: true };
      if (conflict?.shiftId === s.id) view = { ...view, clashStaffId: conflict.staffId };
      map.set(s.id, view);
    }
    return map;
  }, [visible, dragging, check, activeHour, conflict, sheetShiftId]);

  // ------------------------------------------------------------ drag and drop

  /** Shifts a person can go on, in keyboard order. */
  const validTargets = useCallback(
    (staffId: number): KeyboardTarget[] => keyboardOrder.filter((t) => check(staffId, t.id).valid),
    [keyboardOrder, check],
  );

  // dnd-kit keeps the coordinate getter and collision detection from the
  // start of a drag, so both read the latest targets through one stable object.
  const [keyboard] = useState(createKeyboardDrag);
  useEffect(() => keyboard.setTargets(validTargets), [keyboard, validTargets]);
  const collision = useMemo(() => boardCollision(keyboard.getTarget), [keyboard]);
  const coordinateGetter = useMemo(
    () => shiftKeyboardCoordinates(keyboard.targets, { get: keyboard.getTarget, set: keyboard.setTarget }),
    [keyboard],
  );
  const sensors = useSensors(
    // Mouse only: on touch screens people tap a shift and then a person instead.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

  const announcements = useMemo(
    () =>
      boardAnnouncements({
        person: (id) => staffById.get(idFrom(id)),
        shift: (id) => shiftById.get(idFrom(id)),
        check,
        validCount: (staffId) => validTargets(staffId).length,
      }),
    [staffById, shiftById, check, validTargets],
  );

  /** Keyboard drags pin the staff list so dnd-kit's arrow-key scrolling can't move it. Undone on drop or cancel. */
  const pinList = useCallback(() => {
    if (listRef.current) listRef.current.style.overflowY = "hidden";
  }, []);
  const unpinList = () => {
    if (listRef.current) listRef.current.style.overflowY = "";
  };

  function onDragStart({ active, activatorEvent }: DragStartEvent) {
    keyboard.setTarget(null);
    setDragging(staffById.get(idFrom(active.id)) ?? null);
    if (activatorEvent instanceof KeyboardEvent) {
      // Go straight to the first shift this person can take. The keyboard
      // sensor starts listening on the next task, so send the move after it.
      window.setTimeout(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { code: PICK_UP_CODE, key: PICK_UP_CODE, bubbles: true }));
      }, 30);
    }
  }

  function endDrag() {
    keyboard.setTarget(null);
    unpinList();
    setDragging(null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    endDrag();
    if (!over) return;
    const person = staffById.get(idFrom(active.id));
    const shift = shiftById.get(idFrom(over.id));
    if (!person || !shift) return;
    const result = check(person.id, shift.id);
    if (!result.valid) {
      setConflict({ shiftId: shift.id, staffId: person.id });
      toast({ variant: "error", title: `Can't assign ${person.name}`, description: blocks(result.breaks)[0]?.message ?? result.reason });
      return;
    }
    writes.assign(shift, { id: person.id, name: person.name });
  }

  // ------------------------------------------------------------ handlers

  const openShift = useCallback(
    (shiftId: number) => {
      if (isMobile && manager) setSheetShiftId(shiftId);
      else setOpenShiftId(shiftId);
    },
    [isMobile, manager],
  );

  /**
   * The drawer, sheet and dialog open from state, with no Radix Trigger, so
   * Radix has nothing to hand focus back to on close. Put it on the card.
   */
  function focusShift(shiftId: number | null | undefined) {
    if (shiftId == null) return;
    window.setTimeout(() => document.querySelector<HTMLElement>(`button[data-shift-id="${shiftId}"]`)?.focus(), 0);
  }

  function retryBoard() {
    if (demo.state === "error") demo.setState("normal");
    else void boardQuery.refetch();
  }

  function leaveEmptyState() {
    demo.setState("normal");
    toast({
      variant: "success",
      title: "Back to the seeded race day",
      description: "This demo has one event, so both buttons bring its shifts back.",
    });
  }

  const me = board ? workerIdentity(board) : null;

  // ------------------------------------------------------------ render

  const topBar = (
    <TopBar current="board">
      <RoleSwitch
        role={board?.viewer.role}
        onSwitched={() => {
          setOpenShiftId(null);
          setSheetShiftId(null);
          setFilters(noFilters);
        }}
      />
      <DemoStatesMenu />
    </TopBar>
  );

  let content: ReactNode;
  if (demo.state === "loading" || (boardQuery.isPending && !board)) {
    content = (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <BoardSkeleton />
      </div>
    );
  } else if (!board) {
    content = (
      <div className="px-4 py-6 md:px-8">
        <ErrorState
          title="Couldn't load the board"
          description={boardQuery.error?.message}
          onRetry={retryBoard}
          retrying={boardQuery.isFetching}
        />
      </div>
    );
  } else {
    const staffCount = manager ? (allStaff.data?.length ?? null) : null;
    const stripHours = board.coverage.map((h) => ({ hour: hourOf(h.hour), needed: h.needed, assigned: h.assigned }));
    const refreshFailed = boardQuery.isError ? (
      <ErrorState
        title="Couldn't refresh the board"
        description={`Showing the shifts as they were at ${new Date(boardQuery.dataUpdatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. ${boardQuery.error?.message ?? ""}`}
        onRetry={retryBoard}
        retrying={boardQuery.isFetching}
      />
    ) : null;

    const emptyEvent = board.shifts.length === 0;
    // Mobile lists what still needs people first, before the locations.
    const needsPeople = visible.filter((s) => s.status !== "covered").sort((a, b) => shiftSpan(a).start - shiftSpan(b).start);
    const noMatches = !emptyEvent && sections.length === 0;
    const filterNames = {
      onlyShort: filters.onlyShort,
      roleName: board.roles.find((r) => r.id === filters.roleId)?.name ?? null,
      locationName: board.locations.find((l) => l.id === filters.locationId)?.name ?? null,
    };

    const boardBody = emptyEvent ? (
      <EmptyState
        title="No shifts yet"
        description={`Add the first shift for ${board.event.name}, or copy the shifts from your last event and adjust them.`}
        actions={
          manager ? (
            <>
              <Button variant="primary" onClick={leaveEmptyState}>
                Create first shift
              </Button>
              <Button variant="secondary" onClick={leaveEmptyState}>
                Copy from last event
              </Button>
            </>
          ) : undefined
        }
      />
    ) : noMatches ? (
      <EmptyState
        title={emptyFilterTitle(filterNames)}
        description="Every shift that matches these filters is covered or doesn't exist."
        actions={<Button onClick={() => setFilters(noFilters)}>Clear filters</Button>}
      />
    ) : isMobile ? (
      <MobileList sections={sections} needsPeople={needsPeople} views={views} onOpen={openShift} />
    ) : (
      <div className="overflow-x-auto pb-2">
        <TimelineGrid>
          {sections.map((section) => (
            <LocationRow
              key={section.id}
              name={section.name}
              covered={section.covered}
              total={section.total}
              shifts={section.shifts}
              views={views}
              onOpen={openShift}
            />
          ))}
        </TimelineGrid>
      </div>
    );

    const main = (
      <main className="flex min-w-0 flex-1 flex-col gap-8 px-4 py-6 md:px-8 md:py-8">
        <EventHeader board={board} staffCount={staffCount} />
        {refreshFailed}
        {isMobile ? (
          <CoverageSummary board={board} />
        ) : (
          // The padding is room for the hour popover above the bars; the equal
          // negative margin keeps the section 32px under the header like the others.
          <div className="pointer-events-none -mt-12 overflow-x-auto pt-12">
            <div className="pointer-events-auto">
              <CoverageSection hours={stripHours} activeHour={activeHour} onActiveHourChange={setActiveHour} />
            </div>
          </div>
        )}
        {emptyEvent ? null : <BoardFilters board={board} filters={filters} onChange={setFilters} />}
        <div>
          <h2 className="sr-only">Shifts by location</h2>
          {boardBody}
        </div>
      </main>
    );

    const side = manager ? (
      isMobile ? null : (
        <div className="sticky top-0 flex h-screen w-[320px] shrink-0 flex-col border-l border-hairline">
          <StaffPanel
            search={search}
            onSearchChange={setSearch}
            items={staffQuery.data}
            loading={staffQuery.isPending}
            error={staffQuery.isError}
            onRetry={() => void staffQuery.refetch()}
            eventDate={board.date}
            draggingStaffId={dragging?.id ?? null}
            listRef={listRef}
            onKeyboardPickUp={pinList}
          />
        </div>
      )
    ) : (
      <div className="w-full shrink-0 border-hairline md:w-[320px] md:border-l">
        <WorkerPanel board={board} onOpen={openShift} onRequest={(s) => me && writes.request(s, me)} />
      </div>
    );

    content = (
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        accessibility={{ announcements, screenReaderInstructions }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={endDrag}
      >
        <div className={cn("animate-fade-in", manager ? "flex items-start" : "flex flex-col-reverse md:flex-row md:items-start")}>
          {main}
          {side}
        </div>
        {/*
         * No drop animation on the overlay: on a valid drop the face springs
         * into the card instead (ShiftCard), and flying the row back to the
         * panel would read as a failed drop.
         */}
        <DragOverlay dropAnimation={null}>
          {dragging ? <LiftedRow person={dragging} eventDate={board.date} /> : null}
        </DragOverlay>
        <ShiftDrawer
          board={board}
          shift={openShiftId === null ? null : (shiftById.get(openShiftId) ?? null)}
          onClose={() => {
            focusShift(openShiftId);
            setOpenShiftId(null);
          }}
          onRemove={writes.remove}
          onApprove={writes.approve}
        />
        {manager && isMobile ? (
          <StaffSheet
            shift={sheetShiftId === null ? null : (shiftById.get(sheetShiftId) ?? null)}
            onClose={() => {
              focusShift(sheetShiftId);
              setSheetShiftId(null);
            }}
            items={staffQuery.data}
            search={search}
            onSearchChange={setSearch}
            eventDate={board.date}
            check={check}
            onPick={(shift, person) => {
              focusShift(shift.id);
              setSheetShiftId(null);
              writes.assign(shift, { id: person.id, name: person.name });
            }}
            onOpenDetails={(id) => {
              setSheetShiftId(null);
              setOpenShiftId(id);
            }}
          />
        ) : null}
        <OverrideDialog
          request={override}
          onClose={() => {
            focusShift(override?.shift.id);
            setOverride(null);
          }}
        />
      </DndContext>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {topBar}
      {content}
    </div>
  );
}

/**
 * The staff row under the pointer. Lifted 2px with a shadow, and tilted 1.5°
 * toward the way it is moving: the sign of the horizontal drag delta, set on
 * the rotate property so it doesn't fight the lift's translate. Reduced
 * motion drops the tilt and the lift and keeps the shadow (globals.css).
 */
function LiftedRow({ person, eventDate }: { person: StaffListItem; eventDate: string }) {
  const [direction, setDirection] = useState<1 | -1>(1);
  useDndMonitor({
    onDragMove: ({ delta }) => {
      if (delta.x !== 0) setDirection(delta.x < 0 ? -1 : 1);
    },
  });
  return (
    <StaffRow
      name={person.name}
      role={capitalise(person.roleName)}
      licence={rowLicence(person, eventDate)}
      hoursThisWeek={person.hoursThisWeek}
      maxHours={person.weeklyHourLimit}
      state="picked-up"
      aria-hidden="true"
      tabIndex={-1}
      style={{ rotate: `${direction * 1.5}deg` }}
    />
  );
}

type MobileSection = { id: number; name: string; total: number; covered: number; shifts: BoardShift[] };

/**
 * Mobile board: "Needs people (4)" first, with every short and open shift in
 * start order, then the locations with what is already covered. With "Only
 * short shifts" on, the group is all there is.
 */
function MobileList({
  sections,
  needsPeople,
  views,
  onOpen,
}: {
  sections: readonly MobileSection[];
  needsPeople: readonly BoardShift[];
  views: ReadonlyMap<number, CardView>;
  onOpen: (shiftId: number) => void;
}) {
  const card = (s: BoardShift) => {
    const view = views.get(s.id) ?? idleView;
    return (
      <li key={s.id}>
        <BoardShiftCard shift={s} dimmed={view.dimmed} selected={view.selected} clashStaffId={view.clashStaffId} onOpen={onOpen} />
      </li>
    );
  };
  const rest = sections
    .map((section) => ({ ...section, covered: section.covered, list: section.shifts.filter((s) => s.status === "covered") }))
    .filter((section) => section.list.length > 0);
  return (
    <div className="flex flex-col">
      {needsPeople.length > 0 ? (
        <section aria-labelledby="needs-people" className="flex flex-col gap-3 border-b border-hairline pb-5 last:border-b-0">
          <h3 id="needs-people" className="text-16 leading-6 font-semibold text-ink">
            Needs people <span className="font-normal text-short tabular">({needsPeople.length})</span>
          </h3>
          <ul className="flex flex-col gap-3">{needsPeople.map(card)}</ul>
        </section>
      ) : null}
      {rest.map((section) => (
        <section key={section.id} aria-label={section.name} className="flex flex-col gap-3 border-b border-hairline py-5 last:border-b-0">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-16 leading-6 font-semibold text-ink">{section.name}</h3>
            <p className="text-12 text-muted tabular">
              {section.covered} of {section.total} shifts covered
            </p>
          </div>
          <ul className="flex flex-col gap-3">{[...section.list].sort((a, b) => shiftSpan(a).start - shiftSpan(b).start).map(card)}</ul>
        </section>
      ))}
    </div>
  );
}
