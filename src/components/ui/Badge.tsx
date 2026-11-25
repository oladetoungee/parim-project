import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type BadgeStatus = "covered" | "short" | "conflict" | "open" | "draft";

export const badgeLabels: Record<BadgeStatus, string> = {
  covered: "Covered",
  short: "Short",
  conflict: "Conflict",
  open: "Open",
  draft: "Draft",
};

const wordColours: Record<BadgeStatus, string> = {
  covered: "text-covered",
  short: "text-short",
  conflict: "text-conflict",
  open: "text-ink",
  draft: "text-muted",
};

type BadgeProps = Omit<ComponentProps<"span">, "children"> & {
  status: BadgeStatus;
};

/*
 * Figma: Badge. Property: status. An 8px dot and the status word, gap 6.
 * No tinted ground. The word is always there, so colour is never the only signal.
 */
export function Badge({ status, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-12 font-medium whitespace-nowrap",
        wordColours[status],
        className,
      )}
      data-status={status}
      {...props}
    >
      <StatusDot status={status} />
      {badgeLabels[status]}
    </span>
  );
}

const dotStyles: Record<BadgeStatus, string> = {
  covered: "bg-covered",
  short: "bg-short",
  conflict: "bg-conflict",
  open: "border-[1.5px] border-ink",
  draft: "border-[1.5px] border-dashed border-muted",
};

/** 8px status marker. Decorative: always sits next to a text label. */
export function StatusDot({ status, className }: { status: BadgeStatus; className?: string }) {
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", dotStyles[status], className)} />;
}
