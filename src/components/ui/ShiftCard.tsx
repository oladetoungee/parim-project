"use client";

import { cva } from "class-variance-authority";
import { memo, useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { AvatarStack, type AvatarPerson } from "./Avatar";
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

/* Figma: Shift card. Properties: status, state (default, hover, focus, selected, drop-valid, drop-invalid, loading). */
const cardVariants = cva(
  [
    "group/card relative flex w-60 flex-col rounded-4 border bg-canvas p-3 text-left",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  ],
  {
    variants: {
      status: {
        open: "",
        "partly-filled": "",
        filled: "",
        conflict: "",
        draft: "border-dashed",
      },
      state: {
        default: "border-hairline hover:border-[color-mix(in_srgb,var(--text-primary)_32%,transparent)]",
        selected: "border-accent shadow-[inset_0_0_0_1px_var(--accent-default)]",
        "drop-valid": "border-2 border-dashed border-accent bg-[color-mix(in_srgb,var(--accent-default)_5%,var(--bg-canvas))] p-[11px]",
        "drop-invalid": "border-hairline",
      },
    },
    defaultVariants: { status: "open", state: "default" },
  },
);

const edgeColour: Record<ShiftStatus, string> = {
  open: "bg-need-outline",
  "partly-filled": "bg-short",
  filled: "bg-covered",
  conflict: "bg-conflict",
  draft: "bg-need-outline",
};

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
  shake = false,
  className,
  type = "button",
  ...props
}: ShiftCardProps) {
  const reasonId = useId();
  const nextDay = endsNextDay(start, end);
  const badge = badgeFor[status];
  const state = drop === "valid" ? "drop-valid" : drop === "invalid" ? "drop-invalid" : selected ? "selected" : "default";
  const showEdge = state === "default" || state === "drop-invalid";
  const dim = state === "drop-invalid";

  const label = [
    role,
    location,
    `${start} to ${end}${nextDay ? ", ends next day" : ""}`,
    `${filled} of ${needed} filled`,
    badgeLabels[badge],
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type={type}
      aria-label={label}
      aria-haspopup="dialog"
      data-selected={selected || undefined}
      aria-describedby={dim && dropReason ? reasonId : undefined}
      data-status={status}
      data-state={state}
      className={cn(
        cardVariants({ status, state }),
        shake && "motion-shake",
        className,
      )}
      {...props}
    >
      {showEdge ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-[-1px] bottom-[-1px] left-[-1px] w-0.5 rounded-l-4",
            edgeColour[status],
            dim && "opacity-40",
          )}
        />
      ) : null}

      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-14 leading-5 font-semibold text-ink">{role}</span>
        <span className="shrink-0 text-14 leading-5 font-medium text-ink tabular">
          {filled} of {needed}
        </span>
      </span>
      <span className="mt-1 text-12 leading-4 text-muted tabular">
        {start}–{end}
        {nextDay ? " next day" : null}
      </span>

      <span className={cn("mt-3 flex min-h-7 items-center justify-between gap-2", dim && "opacity-40")}>
        <AvatarStack people={people} />
        <Badge status={badge} className="ml-auto" />
      </span>

      {dim && dropReason ? (
        <span id={reasonId} className="mt-2 text-12 leading-4 text-muted">
          {dropReason}
        </span>
      ) : null}
    </button>
  );
}

/** Memoised: the board renders 42 and a drop should re-render one. */
export const ShiftCard = memo(ShiftCardImpl);

/** Loading placeholder with the same footprint as a card. */
export function ShiftCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex w-60 flex-col rounded-4 border border-hairline p-3", className)}>
      <span className="flex h-5 items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-8" />
      </span>
      <span className="mt-1 flex h-4 items-center">
        <Skeleton className="h-2.5 w-20" />
      </span>
      <span className="mt-3 flex h-7 items-center justify-between">
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-2.5 w-14" />
      </span>
    </div>
  );
}
