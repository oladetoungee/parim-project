"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { StatusDot } from "./Badge";
import { CloseIcon } from "./icons";
import { duration } from "./motion";

export type ToastVariant = "success" | "error" | "undo";

export type ToastOptions = {
  variant: ToastVariant;
  title: string;
  description?: string;
  /** Undo for "undo", Retry for "error". */
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds. Undo defaults to 5000 and shows a countdown bar. */
  duration?: number;
};

type ToastItem = ToastOptions & { id: number; open: boolean };

type ToastApi = {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast needs a <ToastProvider> above it.");
  return ctx;
}

const defaultDuration: Record<ToastVariant, number> = {
  success: 4000,
  error: 8000,
  undo: 5000,
};

const defaultAction: Partial<Record<ToastVariant, string>> = {
  error: "Retry",
  undo: "Undo",
};

/** Holds the toast queue and renders the viewport, bottom right. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, open: false } : t)));
    // Unmount once the exit (toast-out, duration/quick) has played, plus a frame.
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), duration("quick") + 16);
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setItems((list) => [...list, { ...options, id, open: true }]);
    return id;
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      <ToastPrimitive.Provider swipeDirection="right" label="Notification">
        {children}
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
        <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-[100] flex w-full max-w-[400px] flex-col gap-2 p-4 outline-hidden sm:p-6" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

const dotFor: Record<ToastVariant, "covered" | "conflict" | null> = {
  success: "covered",
  error: "conflict",
  undo: null,
};

/* Figma: Toast. Property: variant (success, error, undo). */
export function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const duration = item.duration ?? defaultDuration[item.variant];
  const actionLabel = item.actionLabel ?? defaultAction[item.variant];
  const dot = dotFor[item.variant];

  return (
    <ToastPrimitive.Root
      open={item.open}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      duration={duration}
      type={item.variant === "error" ? "foreground" : "background"}
      onPause={() => setPaused(true)}
      onResume={() => setPaused(false)}
      className="motion-toast relative flex items-start gap-3 overflow-hidden rounded-8 border border-hairline bg-raised py-3 pr-2 pl-4 shadow-lifted"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5">
        <ToastPrimitive.Title className="flex items-center gap-2 text-14 leading-5 font-medium text-ink">
          {dot ? <StatusDot status={dot} /> : null}
          {item.title}
        </ToastPrimitive.Title>
        {item.description ? (
          <ToastPrimitive.Description className={cn("text-14 text-muted", dot && "pl-4")}>
            {item.description}
          </ToastPrimitive.Description>
        ) : null}
      </div>
      {actionLabel && item.onAction ? (
        <ToastPrimitive.Action
          altText={`${actionLabel}: ${item.title}`}
          onClick={item.onAction}
          className="inline-flex h-8 shrink-0 items-center rounded-4 px-3 text-14 font-semibold text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-pressed"
        >
          {actionLabel}
        </ToastPrimitive.Action>
      ) : null}
      <ToastPrimitive.Close
        aria-label="Dismiss"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-4 text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <CloseIcon />
      </ToastPrimitive.Close>
      {item.variant === "undo" ? (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-hairline">
          <span
            className="motion-countdown absolute inset-0 bg-ink"
            data-paused={paused}
            style={{ ["--countdown" as string]: `${duration}ms` }}
          />
        </span>
      ) : null}
    </ToastPrimitive.Root>
  );
}
