"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string> = { value: T; label: string };

const rootVariants = cva(
  "relative grid rounded-4 border border-hairline bg-canvas p-0.5",
  {
    variants: {
      size: { sm: "h-8 text-12", md: "h-10 text-14" },
    },
    defaultVariants: { size: "md" },
  },
);

type SegmentedControlProps<T extends string> = VariantProps<typeof rootVariants> & {
  options: readonly SegmentedOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  "aria-label": string;
  disabled?: boolean;
  className?: string;
};

/**
 * Single choice between two to four options, as a radio group.
 * Arrow keys move and select. The indicator slides with transform only.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  defaultValue,
  onValueChange,
  size,
  disabled,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  const [inner, setInner] = useState<T>(defaultValue ?? options[0].value);
  const current = value ?? inner;
  const index = Math.max(0, options.findIndex((o) => o.value === current));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(i: number) {
    const next = options[i];
    if (!next) return;
    if (value === undefined) setInner(next.value);
    onValueChange?.(next.value);
    refs.current[i]?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    const last = options.length - 1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      select(index === last ? 0 : index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      select(index === 0 ? last : index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      select(0);
    } else if (e.key === "End") {
      e.preventDefault();
      select(last);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className={cn(rootVariants({ size }), disabled && "opacity-50", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="motion-indicator pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-2 bg-ink"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option, i) => {
        const checked = i === index;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => select(i)}
            className={cn(
              "relative z-10 rounded-2 px-3 font-medium whitespace-nowrap",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              "disabled:cursor-not-allowed",
              checked ? "text-canvas" : "text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
