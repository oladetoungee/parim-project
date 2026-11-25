import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/* Figma: Button. Properties: variant (primary, secondary, ghost), size, state (via :hover, :focus-visible, :active, disabled, loading). */
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap select-none",
    "rounded-4 border font-medium",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:cursor-not-allowed aria-busy:cursor-progress",
  ],
  {
    variants: {
      variant: {
        primary: [
          "border-transparent bg-accent text-accent-on",
          "hover:bg-accent-hover active:bg-accent-hover",
          "disabled:bg-pressed disabled:text-subtle",
        ],
        secondary: [
          "border-hairline bg-transparent text-ink",
          "hover:bg-hover active:bg-pressed",
          "disabled:bg-transparent disabled:text-subtle",
        ],
        ghost: [
          "border-transparent bg-transparent text-ink",
          "hover:bg-hover active:bg-pressed",
          "disabled:bg-transparent disabled:text-subtle",
        ],
      },
      size: {
        sm: "h-8 px-3 text-14",
        md: "h-10 px-4 text-14",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Keeps the button's width, hides the label and shows a small spinner. */
    loading?: boolean;
  };

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-0")}>
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 inline-flex items-center justify-center" aria-hidden="true">
          <Spinner />
        </span>
      ) : null}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      className={cn("animate-spin motion-reduce:animate-none", className)}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
