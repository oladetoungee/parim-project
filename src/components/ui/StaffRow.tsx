import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "./Avatar";
import { StatusDot } from "./Badge";

export type LicenceStatus =
  | { status: "valid" }
  | { status: "expiring"; daysLeft: number }
  | { status: "expired" };

/* Figma: Staff row. Properties: state (default, hover, focus, picked-up, disabled). */
const rowVariants = cva(
  [
    "relative flex w-full items-center gap-3 border-b border-hairline bg-canvas px-3 py-2.5 text-left",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
  ],
  {
    variants: {
      state: {
        default: "cursor-grab hover:bg-hover",
        "picked-up":
          "motion-lift z-10 cursor-grabbing rounded-4 border-transparent bg-raised shadow-lifted -translate-y-0.5 rotate-[1.5deg]",
        disabled: "cursor-not-allowed text-subtle",
      },
    },
    defaultVariants: { state: "default" },
  },
);

export type StaffRowProps = Omit<ComponentProps<"div">, "children"> & {
  name: string;
  role: string;
  /** Only for roles that need one (SIA for security). */
  licence?: LicenceStatus;
  hoursThisWeek: number;
  /** Weekly limit before a warning. */
  maxHours?: number;
  state?: "default" | "picked-up" | "disabled";
};

function licenceText(l: LicenceStatus) {
  if (l.status === "valid") return "SIA valid";
  if (l.status === "expired") return "SIA expired";
  return `SIA expires in ${l.daysLeft} ${l.daysLeft === 1 ? "day" : "days"}`;
}

export function StaffRow({
  name,
  role,
  licence,
  hoursThisWeek,
  maxHours = 48,
  state = "default",
  className,
  ...props
}: StaffRowProps) {
  const over = hoursThisWeek > maxHours;
  return (
    <div
      tabIndex={state === "disabled" ? -1 : 0}
      aria-disabled={state === "disabled" || undefined}
      data-state={state}
      className={cn(rowVariants({ state }), className)}
      {...props}
    >
      <Avatar name={name} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-14 leading-5 font-semibold", state === "disabled" ? "text-subtle" : "text-ink")}>
          {name}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-12 leading-4 text-muted">
          <span className="truncate">{role}</span>
          {licence ? (
            <>
              <span aria-hidden="true">,</span>
              <LicenceLabel licence={licence} />
            </>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className={cn("text-14 leading-5 font-medium tabular", over ? "text-short" : "text-ink")}>
          {hoursThisWeek} h
        </span>
        <span className={cn("text-12 leading-4", over ? "font-medium text-short" : "text-muted")}>
          {over ? `Over ${maxHours} h` : "This week"}
        </span>
      </span>
    </div>
  );
}

function LicenceLabel({ licence }: { licence: LicenceStatus }) {
  const text = licenceText(licence);
  if (licence.status === "valid") return <span className="truncate">{text}</span>;
  const status = licence.status === "expired" ? "conflict" : "short";
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 font-medium", status === "conflict" ? "text-conflict" : "text-short")}>
      <StatusDot status={status} className="size-1.5" />
      <span className="truncate">{text}</span>
    </span>
  );
}
