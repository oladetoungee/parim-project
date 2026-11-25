"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type HourCoverage = {
  /** Hour of day the bar starts at, 7 for 07:00. */
  hour: number;
  needed: number;
  assigned: number;
};

type CoverageStripProps = {
  hours: readonly HourCoverage[];
  /** Controlled highlight, so the board can light up the shifts in that hour. */
  activeHour?: number | null;
  onActiveHourChange?: (hour: number | null) => void;
  /** Height of the tallest bar in px. */
  barHeight?: number;
  className?: string;
};

const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

export function describeHour({ hour, needed, assigned }: HourCoverage) {
  const short = Math.max(0, needed - assigned);
  const range = `${hh(hour)} to ${hh(hour + 1)}`;
  const detail =
    needed === 0
      ? "No staff needed."
      : short > 0
        ? `${assigned} of ${needed} staff, ${short} short.`
        : `${assigned} of ${needed} staff, covered.`;
  return { range, detail, short };
}

/*
 * Figma: Coverage strip. One bar per hour. The 1px outline is sized to the
 * need; inside it the assigned part sits at the bottom in data/assigned and
 * the shortfall shows in status/short above it. Covered hours carry no colour.
 * Each bar is a button: one tab stop for the strip, arrow keys between hours.
 * Keyboard focus draws the standard accent ring around the bar; the active
 * (hovered or focused) hour also gets a 2px ink border.
 */
export function CoverageStrip({
  hours,
  activeHour,
  onActiveHourChange,
  barHeight = 72,
  className,
}: CoverageStripProps) {
  const [innerActive, setInnerActive] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = activeHour !== undefined ? activeHour : innerActive;
  const maxNeeded = Math.max(1, ...hours.map((h) => h.needed));

  function setActive(hour: number | null) {
    if (activeHour === undefined) setInnerActive(hour);
    onActiveHourChange?.(hour);
  }

  function move(i: number) {
    const next = Math.min(hours.length - 1, Math.max(0, i));
    setFocusIndex(next);
    refs.current[next]?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      move(focusIndex + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(focusIndex - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(hours.length - 1);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="group"
        aria-label="Coverage by hour"
        onKeyDown={onKeyDown}
        onMouseLeave={() => setActive(null)}
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}
      >
        {hours.map((h, i) => {
          const { range, detail, short } = describeHour(h);
          const isActive = active === h.hour;
          const needHeight = Math.round((h.needed / maxNeeded) * barHeight);
          const ratio = h.needed === 0 ? 0 : Math.min(1, h.assigned / h.needed);
          return (
            <button
              key={h.hour}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              tabIndex={i === focusIndex ? 0 : -1}
              aria-label={`${range}, ${detail}`}
              aria-pressed={isActive}
              data-short={short > 0 || undefined}
              onFocus={() => {
                setFocusIndex(i);
                setActive(h.hour);
              }}
              onBlur={() => setActive(null)}
              onMouseEnter={() => setActive(h.hour)}
              className="group/bar relative flex min-w-0 flex-col items-stretch focus:outline-none focus-visible:outline-none"
            >
              {isActive ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "motion-popover pointer-events-none absolute bottom-full z-20 mb-2 rounded-8 border border-hairline bg-raised px-3 py-2 text-left whitespace-nowrap shadow-lifted",
                    i < 2 ? "left-0" : i > hours.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2",
                  )}
                  data-state="open"
                >
                  <span className="block text-12 font-medium text-ink tabular">{range}</span>
                  <span className="block text-12 text-muted tabular">{detail}</span>
                </span>
              ) : null}

              <span className="flex flex-col justify-end" style={{ height: barHeight + 20 }}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mb-1 h-4 text-center text-12 leading-4 font-medium text-short tabular",
                    short === 0 && "invisible",
                  )}
                >
                  {short > 0 ? `${short} short` : "0"}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative block border border-need-outline",
                    "group-focus-visible/bar:outline-2 group-focus-visible/bar:outline-offset-2 group-focus-visible/bar:outline-ring",
                    short > 0 ? "bg-short" : "bg-transparent",
                    h.needed === 0 && "border-hairline",
                  )}
                  style={{ height: Math.max(needHeight, 2) }}
                >
                  <span className="absolute inset-0 overflow-hidden">
                    <span
                      className="absolute inset-0 origin-bottom bg-assigned transition-transform duration-base ease-standard motion-reduce:transition-none"
                      style={{ transform: `scaleY(${ratio})` }}
                    />
                  </span>
                  {isActive ? (
                    <span className="pointer-events-none absolute -inset-px border-2 border-ink" data-active="true" />
                  ) : null}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-2 text-center text-12 leading-4 tabular",
                  isActive ? "font-medium text-ink" : "text-muted",
                )}
              >
                {hh(h.hour)}
              </span>
            </button>
          );
        })}
      </div>

      <ul className="flex flex-wrap items-center gap-4 text-12 text-muted" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 bg-assigned" />
          Assigned
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 bg-short" />
          Short
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 border border-need-outline" />
          Needed
        </li>
      </ul>
    </div>
  );
}
