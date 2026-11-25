"use client";

import { cva } from "class-variance-authority";
import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ChevronDownIcon } from "./icons";

type FieldContextValue = {
  id: string;
  hintId?: string;
  errorId?: string;
  invalid: boolean;
  required: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export function useField() {
  return useContext(FieldContext);
}

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Pass to link an existing control id instead of a generated one. */
  id?: string;
  className?: string;
  children: ReactNode;
};

/* Figma: Input with label. Properties: state (default, hover, focus, error, disabled), hint (bool). */
export function Field({ label, hint, error, required = false, id, className, children }: FieldProps) {
  const generated = useId();
  const controlId = id ?? `field${generated}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <FieldContext.Provider value={{ id: controlId, hintId, errorId, invalid: Boolean(error), required }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={controlId} className="text-14 font-medium text-ink">
          {label}
          {required ? (
            <span className="text-muted">
              <span aria-hidden="true"> *</span>
              <span className="sr-only"> (required)</span>
            </span>
          ) : null}
        </label>
        {children}
        {hint && !error ? (
          <p id={hintId} className="text-12 text-muted">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-12 font-medium text-conflict">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export const controlVariants = cva(
  [
    "h-10 w-full rounded-4 border bg-canvas px-3 text-14 text-ink",
    "placeholder:text-subtle",
    "hover:border-ink",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:cursor-not-allowed disabled:border-hairline disabled:bg-paper disabled:text-subtle",
  ],
  {
    variants: {
      invalid: {
        false: "border-strong",
        true: "border-conflict hover:border-conflict",
      },
    },
    defaultVariants: { invalid: false },
  },
);

function useControlProps(props: { id?: string; "aria-describedby"?: string; "aria-invalid"?: ComponentProps<"input">["aria-invalid"]; required?: boolean }) {
  const field = useField();
  const describedBy = [props["aria-describedby"], field?.errorId ?? field?.hintId].filter(Boolean).join(" ") || undefined;
  const invalid = field?.invalid ?? (props["aria-invalid"] === true || props["aria-invalid"] === "true");
  return {
    id: props.id ?? field?.id,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
    required: props.required ?? field?.required,
    invalid,
  };
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  const { invalid, ...control } = useControlProps(props);
  return <input {...props} {...control} className={cn(controlVariants({ invalid }), className)} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  const { invalid, ...control } = useControlProps(props);
  return (
    <div className="relative">
      <select
        {...props}
        {...control}
        className={cn(controlVariants({ invalid }), "appearance-none pr-9", className)}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
    </div>
  );
}
