"use client";

import { memo, useId, useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { initials, type AvatarPerson } from "./Avatar";
import { Badge, type BadgeStatus } from "./Badge";
import { Skeleton } from "./Skeleton";
import { endsNextDay } from "./time";

export type ShiftStatus = "open" | "partly-filled" | "filled" | "conflict" | "draft";
export type ShiftDropState = "none" | "valid" | "invalid";

/** A person on the card. `leaving` plays the exit before the data drops them (rollback, undo). */
export type ShiftCardPerson = AvatarPerson & { leaving?: boolean };

const badgeFor: Record<ShiftStatus, BadgeStatus> = {
  open: "open",
  "partly-filled": "short",
  filled: "covered",
  conflict: "conflict",
  draft: "draft",
};

/**
 * Places shown before "+N": 4 on a card 200px or wider, 3 under 200px, and
 * under 150px (a two-hour shift is 108px) 3 if that is all there are,
 * otherwise 2 and "+N".
 */
const MAX_PLACES = 4;
const MAX_PLACES_NARROW = 3;
const MAX_PLACES_COMPACT = 2;
/** Baseline segments. Past 12 places each segment would be a hairline sliver. */
const MAX_SEGMENTS = 12;

type CardState = "default" | "selected" | "drop-valid" | "drop-invalid";

/*
 * Figma: Shift card. Properties: status, state (default, hover, focus,
 * selected, drop-valid, drop-invalid, loading).
 *
 * The outer element is the button and carries the focus ring and the shake.
 * The inner surface carries the canvas fill and the 1px border; --line is the
 * border colour. Selected and drop-valid lay a 2px accent ring over it.
 *
 * Drag states come from a data-drop attribute, on the button itself (the
 * `drop` prop, for the gallery) or on any wrapper (the board), and are styled
 * in globals.css. The board never passes `drop`, so a drag re-renders no card.
 */
function lineFor(status: ShiftStatus, selected: boolean) {
  return selected
    ? "[--line:var(--accent-default)]"
    : status === "conflict"
      ? "[--line:var(--status-conflict)]"
      : "[--line:var(--border-hairline)] group-hover/card:[--line:color-mix(in_srgb,var(--text-primary)_32%,transparent)]";
}

/**
 * Filled and open segments for the baseline. Up to 12 places it is one
 * segment per place. Past that the split is scaled to 12, keeping at least one
 * amber segment while a place is open and at least one filled while anyone is on.
 */
function baselineSegments(filled: number, total: number) {
  if (total <= MAX_SEGMENTS) return { filled, total };
  const open = total - filled;
  let scaled = Math.round((filled / total) * MAX_SEGMENTS);
  if (open > 0) scaled = Math.min(scaled, MAX_SEGMENTS - 1);
  if (filled > 0) scaled = Math.max(scaled, 1);
  return { filled: scaled, total: MAX_SEGMENTS };
}

export type ShiftCardProps = Omit<ComponentProps<"button">, "children"> & {
  role: string;
  /** "HH:MM". An end before the start means the shift ends next day. */
  start: string;
  end: string;
  filled: number;
  needed: number;
  status: ShiftStatus;
  people?: readonly ShiftCardPerson[];
  location?: string;
  selected?: boolean;
  /** For a card shown on its own. On the board the droppable wrapper sets data-drop instead. */
  drop?: ShiftDropState;
  /** Shown when drop is "invalid", for example "Can't assign: Ana Tamm is on Bar 2, 12:00 to 18:00". */
  dropReason?: string;
  /** People on this shift who clash with another shift. They get a conflict ring. */
  clashStaffIds?: readonly string[];
  /** Plays the conflict shake once. Reduced motion keeps the outline only. */
  shake?: boolean;
  /**
   * Space in px kept free at the right of the bottom row for a control laid
   * over it (the worker's Request shift). The badge word moves to the accessible
   * name only; the amber count still carries the status.
   */
  stubActionWidth?: number;
};

/**
 * Remembers which values were already showing, so only a change animates:
 * on first render nothing is "new", afterwards anything not seen before is.
 * The adjust-state-during-render pattern, so no effect and no extra commit.
 */
function useChangeTracker(ids: readonly string[]) {
  const key = ids.join("|");
  const [state, setState] = useState(() => ({ key, entered: new Set<string>() }));
  if (state.key !== key) {
    const before = new Set(state.key.split("|"));
    setState({ key, entered: new Set(ids.filter((id) => !before.has(id))) });
  }
  return state.entered;
}

/** The previous value once it has changed, for crossfades and count ticks. */
function usePrevious<T>(value: T) {
  const [state, setState] = useState<{ current: T; previous: T | null; changes: number }>({ current: value, previous: null, changes: 0 });
  if (!Object.is(state.current, value)) setState({ current: value, previous: state.current, changes: state.changes + 1 });
  return state;
}

function ShiftCardImpl({
  role,
  start,
  end,
  filled,
  needed,
  status,
  people = [],
  location,
  selected = false,
  drop,
  dropReason,
  clashStaffIds,
  shake = false,
  stubActionWidth,
  className,
  type = "button",
  ...props
}: ShiftCardProps) {
  const reasonId = useId();
  const nextDay = endsNextDay(start, end);
  const badge = badgeFor[status];
  const state: CardState =
    drop === "valid" ? "drop-valid" : drop === "invalid" ? "drop-invalid" : selected ? "selected" : "default";

  const clash = new Set(clashStaffIds ?? []);
  // Clashing people first, so they stay visible when places overflow.
  const sorted = [...people].sort((a, b) => Number(clash.has(b.id)) - Number(clash.has(a.id)));
  // If fewer people than the filled count were passed, the rest show as unnamed faces.
  const faces: ShiftCardPerson[] = [
    ...sorted,
    ...Array.from({ length: Math.max(0, filled - sorted.length) }, (_, i) => ({ id: `filled-${i}` })),
  ];
  const openCount = Math.max(0, needed - Math.max(filled, faces.length));
  const places: ({ kind: "face"; person: ShiftCardPerson } | { kind: "open"; key: string })[] = [
    ...faces.map((person) => ({ kind: "face" as const, person })),
    ...Array.from({ length: openCount }, (_, i) => ({ kind: "open" as const, key: `open-${i}` })),
  ];
  const total = places.length;
  const compactMax = total <= MAX_PLACES_NARROW ? MAX_PLACES_NARROW : MAX_PLACES_COMPACT;
  const clashNames = faces.filter((p) => clash.has(p.id) && p.name).map((p) => p.name);
  const segments = baselineSegments(faces.length, total);

  const entered = useChangeTracker(faces.map((f) => f.id));
  const count = usePrevious(filled);
  const badgeHistory = usePrevious(badge);
  // Short and open cards: the count is the status signal that survives every width.
  const countShort = status === "partly-filled" || status === "open";

  return (
    <button
      type={type}
      aria-haspopup="dialog"
      aria-describedby={state === "drop-invalid" && dropReason ? reasonId : undefined}
      data-status={status}
      data-state={state}
      data-drop={drop && drop !== "none" ? drop : undefined}
      data-selected={selected || undefined}
      className={cn(
        "shift-card group/card @container block w-60 rounded-4 text-left",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        shake && "motion-shake",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "shift-card-surface relative flex w-full flex-col rounded-4 border border-[color:var(--line)] bg-canvas px-3 pt-3",
          lineFor(status, selected),
          status === "draft" && "border-dashed",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "shift-card-ring pointer-events-none absolute -inset-px rounded-4 border-2 border-accent",
            selected ? "block" : "hidden",
          )}
        />

        {/*
         * The accessible name is this content plus the visually hidden parts,
         * read in DOM order: "Steward, Gate A, 10:00–16:00, 2 of 4 filled,
         * 2 places open, Short". The grid places role, count and time.
         */}
        <span className="shift-card-head">
          <span data-part="role" className="truncate text-14 leading-5 font-semibold text-ink">
            {role}
            <span className="sr-only">,{location ? ` ${location},` : null}</span>
          </span>{" "}
          <span data-part="time" className="truncate text-12 leading-4 text-muted tabular">
            {start}–{end}
            {nextDay ? " next day" : null}
            <span className="sr-only">,</span>
          </span>{" "}
          <span
            data-part="count"
            className={cn(
              "shrink-0 justify-self-end text-14 leading-5 font-medium tabular",
              countShort ? "text-short" : "text-ink",
            )}
          >
            <span className="inline-flex overflow-hidden">
              <span key={filled} className={count.changes > 0 ? "motion-tick" : undefined}>
                {filled}
              </span>
            </span>{" "}
            of {needed}{" "}
            <span className="sr-only">filled{openCount > 0 ? `, ${openCount} ${openCount === 1 ? "place" : "places"} open` : null},</span>
          </span>
        </span>{" "}

        <span
          className="mt-2 flex h-6 items-center justify-between gap-2"
          style={stubActionWidth ? { paddingRight: stubActionWidth + 8 } : undefined}
        >
          <span aria-hidden="true" className="flex min-w-0 items-center">
            {places.slice(0, MAX_PLACES).map((place, i) => {
              const hide = cn(i >= MAX_PLACES_NARROW && "@max-[200px]:hidden", i >= compactMax && "@max-[150px]:hidden");
              const prev = places[i - 1];
              const gap = i === 0 ? "" : place.kind === "face" && prev?.kind === "face" ? "-ml-0.5" : "ml-1";
              return place.kind === "face" ? (
                <Face
                  key={place.person.id}
                  person={place.person}
                  clash={clash.has(place.person.id)}
                  entering={entered.has(place.person.id)}
                  className={cn(gap, hide)}
                />
              ) : (
                <span
                  key={place.key}
                  className={cn("shift-card-seat size-6 shrink-0 rounded-full border border-dashed border-need-outline", gap, hide)}
                />
              );
            })}
            {total > MAX_PLACES ? (
              <span className="ml-1.5 hidden text-12 font-medium text-muted tabular @min-[200px]:inline">+{total - MAX_PLACES}</span>
            ) : null}
            {total > MAX_PLACES_NARROW ? (
              <span className="ml-1.5 hidden text-12 font-medium text-muted tabular @min-[150px]:@max-[200px]:inline">
                +{total - MAX_PLACES_NARROW}
              </span>
            ) : null}
            {total > compactMax ? (
              <span className="ml-1 hidden text-12 font-medium text-muted tabular @max-[150px]:inline">+{total - compactMax}</span>
            ) : null}
          </span>
          <BadgeSwap
            status={badge}
            previous={badgeHistory.changes > 0 ? badgeHistory.previous : null}
            changes={badgeHistory.changes}
            hidden={Boolean(stubActionWidth)}
          />
          {clashNames.length > 0 ? <span className="sr-only">, clash: {clashNames.join(", ")}</span> : null}
        </span>

        {state === "drop-invalid" && dropReason ? (
          <span id={reasonId} className="mt-2 text-12 leading-4 text-muted">
            {dropReason}
          </span>
        ) : null}

        <Baseline filled={segments.filled} total={segments.total} />
      </span>
    </button>
  );
}

/**
 * One 3px segment per place, flush on the card's bottom edge: data-assigned
 * where a place is filled, status-short where it is open. Decorative; the
 * accessible name already says how many places are open. Positioned so it
 * paints over the selected ring's inner pixel.
 */
function Baseline({ filled, total }: { filled: number; total: number }) {
  if (total === 0) return null;
  return (
    <span aria-hidden="true" className="shift-card-baseline relative mt-2.5 flex h-[3px] gap-[3px]">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("grow basis-0", i < filled ? "bg-assigned" : "bg-short")} />
      ))}
    </span>
  );
}

/**
 * The status word. On a change the old word fades out under the new one.
 * Under 200px, or when the bottom row holds an action, the word is visually
 * hidden and stays in the accessible name.
 */
function BadgeSwap({
  status,
  previous,
  changes,
  hidden,
}: {
  status: BadgeStatus;
  previous: BadgeStatus | null;
  changes: number;
  hidden: boolean;
}) {
  const visibility = hidden ? "sr-only" : "@max-[200px]:sr-only";
  return (
    <span className={cn("ml-auto grid shrink-0 justify-items-end", visibility)}>
      {previous && previous !== status ? (
        <Badge key={`out-${changes}`} status={previous} aria-hidden="true" className="motion-crossfade-out [grid-area:1/1]" />
      ) : null}
      <Badge key={`in-${changes}`} status={status} className={cn("[grid-area:1/1]", changes > 0 && "motion-crossfade-in")} />
    </span>
  );
}

/** Head and shoulders, for a person the viewer may not see (worker view). */
function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" className="text-subtle">
      <circle cx="12" cy="9.5" r="3.5" fill="currentColor" />
      <path d="M5.5 20.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" fill="currentColor" />
    </svg>
  );
}

/*
 * 24px face, 2px canvas ring, 2px overlap, 10px Medium initials. A face that
 * joins after the card first rendered scales in with the drop spring; one
 * marked leaving slides back toward the staff panel and fades.
 */
function Face({
  person,
  clash,
  entering,
  className,
}: {
  person: ShiftCardPerson;
  clash: boolean;
  entering: boolean;
  className?: string;
}) {
  return (
    <span
      data-clash={clash || undefined}
      data-leaving={person.leaving || undefined}
      className={cn(
        "shift-card-seat relative inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper text-[10px] leading-none font-medium tracking-[-0.01em] select-none",
        clash ? "text-conflict ring-[1.5px] ring-conflict" : "text-muted ring-2 ring-canvas",
        person.leaving ? "motion-face-out" : entering ? "motion-face-in" : undefined,
        className,
      )}
    >
      {person.name ? <span className="face-initials">{initials(person.name)}</span> : <PersonGlyph />}
    </span>
  );
}

/** Memoised: the board renders 42 and a drop should re-render one. */
export const ShiftCard = memo(ShiftCardImpl);

/** Loading placeholder with the card's structure and footprint. */
export function ShiftCardSkeleton({ className, places = 4 }: { className?: string; places?: number }) {
  const seats = Math.min(places, MAX_PLACES);
  return (
    <div aria-hidden="true" className={cn("w-60", className)}>
      <span className="relative flex w-full flex-col rounded-4 border border-hairline bg-canvas px-3 pt-3">
        <span className="flex flex-col gap-1">
          <span className="flex h-5 items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-8" />
          </span>
          <span className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-20" />
          </span>
        </span>
        <span className="mt-2 flex h-6 items-center justify-between">
          <span className="flex items-center gap-1">
            {Array.from({ length: seats }, (_, i) => (
              <Skeleton key={i} className="size-6 rounded-full" />
            ))}
          </span>
          <Skeleton className="h-2.5 w-14" />
        </span>
        <span className="mt-2.5 flex h-[3px] gap-[3px]">
          {Array.from({ length: Math.min(places, MAX_SEGMENTS) }, (_, i) => (
            <Skeleton key={i} className="h-full grow basis-0 rounded-none" />
          ))}
        </span>
      </span>
    </div>
  );
}
