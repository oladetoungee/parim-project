import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  /** Buttons. The first one should be the main way forward. */
  actions?: ReactNode;
  className?: string;
};

/* Left aligned, no illustration. Says what's missing and what to do next. */
export function EmptyState({ title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={cn("flex max-w-md flex-col items-start gap-2 py-12", className)}>
      <h2 className="font-display text-20 font-bold tracking-[-0.01em] text-ink">{title}</h2>
      {description ? <p className="text-14 text-muted">{description}</p> : null}
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
