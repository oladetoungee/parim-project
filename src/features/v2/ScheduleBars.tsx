"use client";

import Link from "next/link";
import { useId } from "react";
import { CoverageStrip, type HourCoverage } from "@/components/ui/CoverageStrip";
import { Select } from "@/components/ui/Field";
import { capitalise, longDate, TIMELINE_WIDTH } from "@/features/board/board-math";
import { HeavyLight } from "@/features/board/BoardHeader";
import { GUTTER_WIDTH } from "@/features/board/Timeline";
import { cn } from "@/lib/cn";
import type { Board, BoardShift } from "@/server/db/queries";

export type StatusFilter = "all" | "open" | "short" | "covered";

export type ScheduleFilters = { roleId: number | null; locationId: number | null; status: StatusFilter };

export const noScheduleFilters: ScheduleFilters = { roleId: null, locationId: null, status: "all" };

export function matchesSchedule(shift: BoardShift, filters: ScheduleFilters) {
  if (filters.roleId !== null && shift.roleId !== filters.roleId) return false;
  if (filters.locationId !== null && shift.locationId !== filters.locationId) return false;
  if (filters.status !== "all" && shift.status !== filters.status) return false;
  return true;
}

/** "No short steward shifts at Gate A" */
export function noMatchTitle(board: Board, filters: ScheduleFilters) {
  const role = board.roles.find((r) => r.id === filters.roleId)?.name ?? null;
  const location = board.locations.find((l) => l.id === filters.locationId)?.name ?? null;
  const words = ["No", filters.status === "all" ? null : filters.status, role, "shifts"].filter(Boolean).join(" ");
  return location ? `${words} at ${location}` : words;
}

/**
 * Everything the old header, day switcher and filter row did, in one row:
 * which event, which day, the two filters, and how much is covered.
 */
export function ScheduleToolbar({
  board,
  filters,
  onChange,
}: {
  board: Board;
  filters: ScheduleFilters;
  onChange: (filters: ScheduleFilters) => void;
}) {
  const roleId = useId();
  const locationId = useId();
  const { covered, shifts } = board.summary;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-col">
        <h1 className="font-display text-20 leading-7 tracking-[-0.02em] text-ink">
          <HeavyLight text={board.event.name} />
        </h1>
        <p className="text-12 text-muted">
          {longDate(board.date)}, {board.event.venue}
        </p>
      </div>
      <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-2">
        <label htmlFor={roleId} className="sr-only">
          Role
        </label>
        <Select
          id={roleId}
          className="h-8 w-40"
          value={filters.roleId ?? ""}
          onChange={(e) => onChange({ ...filters, roleId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">All roles</option>
          {board.roles.map((r) => (
            <option key={r.id} value={r.id}>
              {capitalise(r.name)}
            </option>
          ))}
        </Select>
        <label htmlFor={locationId} className="sr-only">
          Location
        </label>
        <Select
          id={locationId}
          className="h-8 w-40"
          value={filters.locationId ?? ""}
          onChange={(e) => onChange({ ...filters, locationId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">All locations</option>
          {board.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
      <p className="ml-auto text-14 text-muted">
        <span className="font-display text-20 leading-7 font-bold tracking-[-0.02em] text-ink tabular">
          {covered} of {shifts}
        </span>{" "}
        shifts covered
      </p>
    </div>
  );
}

/** The strip over the same 56px hours as the timeline. Its bars are 4px apart, so it is one gap narrower. */
const STRIP_GAP = 4;

export function CoverageRow({
  hours,
  activeHour,
  onActiveHourChange,
}: {
  hours: readonly HourCoverage[];
  activeHour: number | null;
  onActiveHourChange: (hour: number | null) => void;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex items-start">
      <h2 id={headingId} className="shrink-0 pr-4 text-12 text-muted" style={{ width: GUTTER_WIDTH }}>
        People needed by hour
      </h2>
      <div className="shrink-0" style={{ width: TIMELINE_WIDTH - STRIP_GAP }}>
        <CoverageStrip hours={hours} activeHour={activeHour} onActiveHourChange={onActiveHourChange} barHeight={40} />
      </div>
    </section>
  );
}

/**
 * The bar along the bottom of the schedule: how many shifts are in each
 * state, and each count is the filter for it. Requests waiting link to their
 * own page.
 */
export function StatusBar({
  board,
  status,
  onStatusChange,
}: {
  board: Board;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
}) {
  const count = (s: BoardShift["status"]) => board.shifts.filter((x) => x.status === s).length;
  const options: { value: StatusFilter; label: string; n: number; dot?: string }[] = [
    { value: "all", label: "All", n: board.shifts.length },
    { value: "open", label: "Open", n: count("open"), dot: "bg-open" },
    { value: "short", label: "Short", n: count("short"), dot: "bg-short" },
    { value: "covered", label: "Covered", n: count("covered"), dot: "bg-covered" },
  ];
  const places = board.shifts.reduce((n, s) => n + Math.max(0, s.slots - s.filled), 0);
  const waiting = board.shifts.reduce((n, s) => n + s.requests.length, 0);

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-hairline bg-canvas px-4 py-2 md:-mx-8 md:px-8">
      <div role="group" aria-label="Show shifts" className="flex flex-wrap items-center gap-1">
        {options.map((o) => {
          const on = status === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              disabled={o.n === 0 && o.value !== "all"}
              onClick={() => onStatusChange(on && o.value !== "all" ? "all" : o.value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-4 px-2 text-14 tabular sm:gap-2 sm:px-3",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "disabled:cursor-not-allowed disabled:text-subtle",
                on ? "bg-ink font-medium text-canvas" : "text-ink hover:bg-hover",
              )}
            >
              {o.dot ? <span aria-hidden className={cn("size-2 rounded-full", o.dot)} /> : null}
              {o.label}
              <span className={on ? "text-canvas" : "text-muted"}>{o.n}</span>
            </button>
          );
        })}
      </div>
      <p className="hidden text-14 text-muted tabular sm:block">
        {places === 0 ? "Every place is filled" : `${places} ${places === 1 ? "place" : "places"} to fill`}
      </p>
      {board.viewer.role === "manager" ? (
        <Link
          href="/v2/requests"
          className={cn(
            "ml-auto text-14 tabular underline-offset-4 hover:underline",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            waiting > 0 ? "font-medium text-ink" : "text-muted",
          )}
        >
          {waiting === 0 ? "No requests waiting" : `${waiting} ${waiting === 1 ? "request" : "requests"} waiting`}
        </Link>
      ) : null}
    </div>
  );
}
