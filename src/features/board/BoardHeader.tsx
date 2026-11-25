"use client";

import { useId } from "react";
import { CoverageStrip, type HourCoverage } from "@/components/ui/CoverageStrip";
import { Select } from "@/components/ui/Field";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/time";
import type { Board } from "@/server/db/queries";
import { capitalise, coverageSentence, eventLine, shortDay, TIMELINE_WIDTH } from "./board-math";
import { GUTTER_WIDTH } from "./Timeline";

/** "Autumn race day": the first word heavy, the rest light. */
export function HeavyLight({ text, className }: { text: string; className?: string }) {
  const [first, ...rest] = text.split(" ");
  return (
    <span className={className}>
      <span className="font-bold">{first}</span>
      {rest.length ? <span className="font-light"> {rest.join(" ")}</span> : null}
    </span>
  );
}

const DAY_UNAVAILABLE = "Only Saturday is set up in this demo";

/** The event day and one either side. Only the event day has shifts in the seed. */
function DaySwitcher({ date }: { date: string }) {
  const days = [addDays(date, -1), date, addDays(date, 1)];
  return (
    <div role="group" aria-label="Day" className="flex items-center gap-1">
      {days.map((day) => {
        const current = day === date;
        const label = shortDay(day);
        const button = (
          <button
            type="button"
            aria-current={current ? "date" : undefined}
            aria-disabled={current ? undefined : true}
            className={cn(
              "inline-flex h-8 items-center rounded-4 px-3 text-14 tabular",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              current ? "bg-ink font-medium text-canvas" : "cursor-not-allowed text-muted",
            )}
          >
            {label}
            {current ? null : <span className="sr-only">. {DAY_UNAVAILABLE}.</span>}
          </button>
        );
        if (current) return <span key={day}>{button}</span>;
        return (
          <Tooltip key={day} content={DAY_UNAVAILABLE} side="bottom">
            {button}
          </Tooltip>
        );
      })}
    </div>
  );
}

export function EventHeader({ board, staffCount }: { board: Board; staffCount: number | null }) {
  const { covered, shifts } = board.summary;
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="font-display text-24 leading-8 tracking-[-0.02em] text-ink md:text-32 md:leading-9">
          <HeavyLight text={board.event.name} />
        </h1>
        <p className="text-14 text-muted">{eventLine(board, staffCount)}</p>
      </div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <DaySwitcher date={board.date} />
        <p className="flex flex-col">
          <span className="font-display text-24 leading-8 font-bold tracking-[-0.02em] text-ink tabular md:text-32 md:leading-9">
            {covered} of {shifts}
          </span>
          <span className="text-14 text-muted">shifts covered</span>
        </p>
      </div>
    </header>
  );
}

/**
 * The strip spans the same 56px hours as the timeline below it, so a bar sits
 * over the shifts it counts. CoverageStrip lays its bars out as a grid with a
 * 4px gap, so its width is 16 hours less one gap: every bar then starts on an
 * hour line.
 */
const STRIP_GAP = 4;

export function CoverageSection({
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
    <section aria-labelledby={headingId} className="flex">
      <div className="shrink-0 pr-4" style={{ width: GUTTER_WIDTH }}>
        <h2 id={headingId} className="text-16 leading-6 font-semibold text-ink">
          Coverage by hour
        </h2>
        <p className="mt-0.5 text-12 text-muted">Point at an hour to pick out its shifts.</p>
      </div>
      <div className="shrink-0" style={{ width: TIMELINE_WIDTH - STRIP_GAP }}>
        <CoverageStrip hours={hours} activeHour={activeHour} onActiveHourChange={onActiveHourChange} barHeight={56} />
      </div>
    </section>
  );
}

/** Mobile: the strip doesn't fit, so the same data becomes a sentence. */
export function CoverageSummary({ board }: { board: Board }) {
  return (
    <section aria-label="Coverage by hour" className="flex flex-col gap-1">
      <h2 className="text-16 leading-6 font-semibold text-ink">Coverage by hour</h2>
      <p className="text-14 text-ink">{coverageSentence(board.coverage)}</p>
    </section>
  );
}

export type Filters = { roleId: number | null; locationId: number | null; onlyShort: boolean };

export const noFilters: Filters = { roleId: null, locationId: null, onlyShort: false };

export function BoardFilters({
  board,
  filters,
  onChange,
}: {
  board: Board;
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const roleId = useId();
  const locationId = useId();
  const shortId = useId();
  const allCovered = board.summary.covered === board.summary.shifts;
  return (
    <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor={roleId} className="text-14 text-muted">
          Role
        </label>
        <Select
          id={roleId}
          className="h-8 w-44"
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
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={locationId} className="text-14 text-muted">
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
      <div className="flex items-center gap-2">
        <input
          id={shortId}
          type="checkbox"
          className="size-4 accent-[var(--accent-default)] disabled:cursor-not-allowed"
          checked={filters.onlyShort && !allCovered}
          disabled={allCovered}
          onChange={(e) => onChange({ ...filters, onlyShort: e.target.checked })}
        />
        <label htmlFor={shortId} className={cn("text-14", allCovered ? "text-subtle" : "text-ink")}>
          Only short shifts
        </label>
      </div>
    </div>
  );
}
