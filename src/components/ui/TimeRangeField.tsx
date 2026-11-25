"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { controlVariants } from "./Field";
import { durationMinutes, endsNextDay, formatDuration } from "./time";

export type TimeRange = { start: string; end: string };

type TimeRangeFieldProps = {
  label?: string;
  value?: TimeRange;
  defaultValue?: TimeRange;
  onChange?: (value: TimeRange) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
};

/**
 * Start and end time. An end earlier than the start is valid and means the
 * shift ends the next day, which the field says in words.
 */
export function TimeRangeField({
  label = "Time",
  value,
  defaultValue = { start: "", end: "" },
  onChange,
  error,
  disabled,
  className,
  name,
}: TimeRangeFieldProps) {
  const [inner, setInner] = useState<TimeRange>(defaultValue);
  const range = value ?? inner;
  const id = useId();
  const startId = `${id}-start`;
  const endId = `${id}-end`;
  const noteId = `${id}-note`;

  const nextDay = endsNextDay(range.start, range.end);
  const hasBoth = Boolean(range.start && range.end);

  function update(patch: Partial<TimeRange>) {
    const next = { ...range, ...patch };
    if (value === undefined) setInner(next);
    onChange?.(next);
  }

  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)} disabled={disabled}>
      <legend className="mb-1.5 text-14 font-medium text-ink">{label}</legend>
      <div className="flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={startId} className="text-12 text-muted">
            Starts
          </label>
          <input
            id={startId}
            name={name ? `${name}.start` : undefined}
            type="time"
            step={900}
            value={range.start}
            onChange={(e) => update({ start: e.target.value })}
            aria-describedby={noteId}
            aria-invalid={error ? true : undefined}
            className={cn(controlVariants({ invalid: Boolean(error) }), "tabular")}
          />
        </div>
        <span aria-hidden="true" className="pb-2.5 text-muted">
          to
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={endId} className="text-12 text-muted">
            Ends
          </label>
          <input
            id={endId}
            name={name ? `${name}.end` : undefined}
            type="time"
            step={900}
            value={range.end}
            onChange={(e) => update({ end: e.target.value })}
            aria-describedby={noteId}
            aria-invalid={error ? true : undefined}
            className={cn(controlVariants({ invalid: Boolean(error) }), "tabular")}
          />
        </div>
      </div>
      <p id={noteId} aria-live="polite" className={cn("text-12 tabular", error ? "font-medium text-conflict" : "text-muted")}>
        {error
          ? error
          : hasBoth
            ? nextDay
              ? `Ends next day, ${formatDuration(durationMinutes(range.start, range.end))}`
              : formatDuration(durationMinutes(range.start, range.end))
            : null}
      </p>
    </fieldset>
  );
}
