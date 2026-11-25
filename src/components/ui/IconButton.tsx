"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

/* Figma: Icon button. Properties: variant, size. */
export const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center rounded-4 border",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:cursor-not-allowed disabled:text-subtle disabled:hover:bg-transparent",
  ],
  {
    variants: {
      variant: {
        ghost: "border-transparent text-muted hover:bg-hover hover:text-ink active:bg-pressed",
        secondary: "border-hairline text-ink hover:bg-hover active:bg-pressed",
      },
      size: {
        sm: "size-8",
        md: "size-10",
      },
    },
    defaultVariants: { variant: "ghost", size: "sm" },
  },
);

type IconButtonProps = Omit<ComponentProps<"button">, "aria-label" | "children"> &
  VariantProps<typeof iconButtonVariants> & {
    /** Required. Used as the accessible name and the tooltip text. */
    label: string;
    icon: ReactNode;
    tooltipSide?: "top" | "right" | "bottom" | "left";
  };

export function IconButton({
  label,
  icon,
  variant,
  size,
  className,
  tooltipSide,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={label} side={tooltipSide}>
      <button
        type={type}
        aria-label={label}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
