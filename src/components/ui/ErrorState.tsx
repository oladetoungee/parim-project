import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { StatusDot } from "./Badge";

type ErrorStateProps = {
  title: string;
  description?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
  className?: string;
};

/* Inline error. Sits where the failed content would be; anything already loaded stays on screen. */
export function ErrorState({
  title,
  description,
  onRetry,
  retrying = false,
  retryLabel = "Retry",
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-wrap items-start gap-x-6 gap-y-3 py-4", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-center gap-2 text-14 font-semibold text-ink">
          <StatusDot status="conflict" />
          {title}
        </p>
        {description ? <p className="pl-4 text-14 text-muted">{description}</p> : null}
      </div>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry} loading={retrying}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
