"use client";

import { memo, useId, type ComponentProps, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { initials, type AvatarPerson } from "./Avatar";
import { Badge, badgeLabels, type BadgeStatus } from "./Badge";
import { Skeleton } from "./Skeleton";
import { endsNextDay } from "./time";

export type ShiftStatus = "open" | "partly-filled" | "filled" | "conflict" | "draft";
export type ShiftDropState = "none" | "valid" | "invalid";

const badgeFor: Record<ShiftStatus, BadgeStatus> = {
  open: "open",
  "partly-filled": "short",
  filled: "covered",
  conflict: "conflict",
  draft: "draft",
};

/** Places shown before "+N": 5, or 3 when the card is narrower than 200px. */
const MAX_PLACES = 5;
const MAX_PLACES_NARROW = 3;

type TicketState = "default" | "selected" | "drop-valid" | "drop-invalid";

/*
 * Figma: Shift card (ticket). Properties: status, state (default, hover,
 * focus, selected, drop-valid, drop-invalid, loading).
 *
 * The outer element is the button and carries the focus ring and the shake.
 * The inner "ticket" carries the surface and border and is masked so the two
 * notches show the page through. --line is the colour of the border and the
 * notch strokes; --line-w is the stroke width (2px for selected and drop-valid).
 */
function ticketStyle(status: ShiftStatus, state: TicketState) {
  const line =
    state === "selected" || state === "drop-valid"
      ? "[--line:var(--accent-default)]"
      : status === "conflict"
        ? "[--line:var(--status-conflict)]"
        : "[--line:var(--border-hairline)] group-hover/card:[--line:color-mix(in_srgb,var(--text-primary)_32%,transparent)]";
  const width = state === "selected" || state === "drop-valid" ? "[--line-w:2px]" : "[--line-w:1px]";
  const dashed = status === "draft" || state === "drop-valid";
  return { line, width, dashed };
}

export type ShiftCardProps = Omit<ComponentProps<"button">, "children"> & {
  role: string;
  /** "HH:MM". An end before the start means the shift ends next day. */
  start: string;
  end: string;
  filled: number;
  needed: number;
  status: ShiftStatus;
  people?: readonly AvatarPerson[];
  location?: string;
  selected?: boolean;
  drop?: ShiftDropState;
  /** Shown when drop is "invalid", for example "Can't assign: Ana Tamm is on Bar 2, 12:00 to 18:00". */
  dropReason?: string;
  /** People on this shift who clash with another shift. They get a conflict ring. */
  clashStaffIds?: readonly string[];
  /** Plays the conflict shake once. Reduced motion keeps the outline only. */
  shake?: boolean;
};

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
  drop = "none",
  dropReason,
  clashStaffIds,
  shake = false,
  className,
  type = "button",
  ...props
}: ShiftCardProps) {
  const reasonId = useId();
  const nextDay = endsNextDay(start, end);
  const badge = badgeFor[status];
  const state: TicketState =
    drop === "valid" ? "drop-valid" : drop === "invalid" ? "drop-invalid" : selected ? "selected" : "default";
  const { line, width, dashed } = ticketStyle(status, state);

  const clash = new Set(clashStaffIds ?? []);
  // Clashing people first, so they stay visible when places overflow.
  const sorted = [...people].sort((a, b) => Number(clash.has(b.id)) - Number(clash.has(a.id)));
  // If fewer people than the filled count were passed, the rest show as unnamed faces.
  const faces: AvatarPerson[] = [
    ...sorted,
    ...Array.from({ length: Math.max(0, filled - sorted.length) }, (_, i) => ({ id: `filled-${i}` })),
  ];
  const openCount = Math.max(0, needed - Math.max(filled, faces.length));
  const places: ({ kind: "face"; person: AvatarPerson } | { kind: "open"; key: string })[] = [
    ...faces.map((person) => ({ kind: "face" as const, person })),
    ...Array.from({ length: openCount }, (_, i) => ({ kind: "open" as const, key: `open-${i}` })),
  ];
  const total = places.length;
  const clashNames = faces.filter((p) => clash.has(p.id) && p.name).map((p) => p.name);

  const label = [
    role,
    location,
    `${start} to ${end}${nextDay ? ", ends next day" : ""}`,
    `${filled} of ${needed} filled`,
    openCount > 0 ? `${openCount} ${openCount === 1 ? "place" : "places"} open` : null,
    badgeLabels[badge],
    clashNames.length > 0 ? `clash: ${clashNames.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type={type}
      aria-label={label}
      aria-haspopup="dialog"
      aria-describedby={state === "drop-invalid" && dropReason ? reasonId : undefined}
      data-status={status}
      data-state={state}
      data-selected={selected || undefined}
      className={cn(
        "group/card block w-60 rounded-4 text-left",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        shake && "motion-shake",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "ticket-mask @container relative flex w-full flex-col rounded-4 border border-[color:var(--line)] bg-canvas",
          line,
          width,
          dashed && "border-dashed",
          state === "drop-valid" && "bg-[color-mix(in_srgb,var(--accent-default)_5%,var(--bg-canvas))]",
        )}
      >
        {state === "selected" || state === "drop-valid" ? (
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute -inset-px rounded-4 border-2 border-accent", dashed && "border-dashed")}
          />
        ) : null}
        <Notch side="left" dashed={status === "draft"} />
        <Notch side="right" dashed={status === "draft"} />

        <span className="flex flex-col px-3 pt-2.5 pb-2">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-14 leading-5 font-semibold text-ink">{role}</span>
            <span className="shrink-0 text-14 leading-5 font-medium text-ink tabular">
              {filled} of {needed}
            </span>
          </span>
          <span className="text-12 leading-4 text-muted tabular">
            {start}–{end}
            {nextDay ? " next day" : null}
          </span>
        </span>

        <span aria-hidden="true" className="relative mx-3 block border-t border-dashed border-need-outline" />

        <span className={cn("flex items-center justify-between gap-2 px-3 pt-2 pb-2.5", state === "drop-invalid" && "opacity-35")}>
          <span aria-hidden="true" className="flex min-w-0 items-center">
            {places.slice(0, MAX_PLACES).map((place, i) => {
              const narrowHidden = i >= MAX_PLACES_NARROW ? "@max-[200px]:hidden" : "";
              const prev = places[i - 1];
              const gap = i === 0 ? "" : place.kind === "face" && prev?.kind === "face" ? "-ml-1" : "ml-1";
              return place.kind === "face" ? (
                <Face key={place.person.id} person={place.person} clash={clash.has(place.person.id)} className={cn(gap, narrowHidden)} />
              ) : (
                <span
                  key={place.key}
                  className={cn("size-6 shrink-0 rounded-full border border-dashed border-need-outline", gap, narrowHidden)}
                />
              );
            })}
            {total > MAX_PLACES ? (
              <span className="ml-1.5 hidden text-12 font-medium text-muted tabular @min-[200px]:inline">
                +{total - MAX_PLACES}
              </span>
            ) : null}
            {total > MAX_PLACES_NARROW ? (
              <span className="ml-1.5 text-12 font-medium text-muted tabular @min-[200px]:hidden">
                +{total - MAX_PLACES_NARROW}
              </span>
            ) : null}
          </span>
          <Badge status={badge} className="ml-auto" />
        </span>

        {state === "drop-invalid" && dropReason ? (
          <span id={reasonId} className="-mt-1 px-3 pb-2.5 text-12 leading-4 text-muted">
            {dropReason}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** Stroke for a notch: the inner half of a ring centred on the card edge at the tear line. */
function Notch({ side, dashed }: { side: "left" | "right"; dashed?: boolean }) {
  const style: CSSProperties = {
    width: "calc(14px + 2 * var(--line-w))",
    height: "calc(14px + 2 * var(--line-w))",
    top: "calc(var(--tear) - 1px - 7px - var(--line-w))",
    [side]: "calc(-1px - 7px - var(--line-w))",
    borderWidth: "var(--line-w)",
  };
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute rounded-full border-[color:var(--line)]", dashed ? "border-dashed" : "border-solid")}
      style={style}
    />
  );
}

function Face({ person, clash, className }: { person: AvatarPerson; clash: boolean; className?: string }) {
  return (
    <span
      data-clash={clash || undefined}
      className={cn(
        "relative inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-paper text-12 leading-none font-medium select-none",
        clash ? "text-conflict ring-[1.5px] ring-conflict" : "text-muted ring-2 ring-canvas",
        className,
      )}
    >
      {person.name ? initials(person.name) : ""}
    </span>
  );
}

/** Memoised: the board renders 42 and a drop should re-render one. */
export const ShiftCard = memo(ShiftCardImpl);

/** Loading placeholder with the ticket's structure and footprint. */
export function ShiftCardSkeleton({ className, places = 4 }: { className?: string; places?: number }) {
  return (
    <div aria-hidden="true" className={cn("w-60", className)}>
      <span className="ticket-mask relative flex w-full flex-col rounded-4 border border-hairline bg-canvas [--line-w:1px] [--line:var(--border-hairline)]">
        <Notch side="left" />
        <Notch side="right" />
        <span className="flex flex-col px-3 pt-2.5 pb-2">
          <span className="flex h-5 items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-8" />
          </span>
          <span className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-20" />
          </span>
        </span>
        <span className="mx-3 block border-t border-dashed border-hairline" />
        <span className="flex items-center justify-between px-3 pt-2 pb-2.5">
          <span className="flex items-center gap-1">
            {Array.from({ length: Math.min(places, MAX_PLACES) }, (_, i) => (
              <Skeleton key={i} className="size-6 rounded-full" />
            ))}
          </span>
          <Skeleton className="h-2.5 w-14" />
        </span>
      </span>
    </div>
  );
}
