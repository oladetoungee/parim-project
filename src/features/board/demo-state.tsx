"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { WriteFlags } from "./api";

/**
 * The "Demo states" menu. Loading and Empty are drawn by the client; the
 * other three go through the real API with its demo flags, so a reviewer sees
 * the actual 2 second wait or the actual 503 and rollback.
 */
export type DemoState = "normal" | "loading" | "empty" | "error" | "slow" | "fail";

export const demoStates: { value: DemoState; label: string; hint: string }[] = [
  { value: "normal", label: "Normal", hint: "The seeded race day." },
  { value: "loading", label: "Loading", hint: "The skeleton shown while the board loads." },
  { value: "empty", label: "Empty event", hint: "An event with no shifts yet." },
  { value: "error", label: "Error loading", hint: "The next refresh fails. Loaded data stays." },
  { value: "slow", label: "Slow network", hint: "Every save and refresh waits 2 seconds." },
  { value: "fail", label: "Save fails", hint: "Every save returns a 503." },
];

type DemoContextValue = {
  state: DemoState;
  setState: (state: DemoState) => void;
  /** Flags for every write. */
  flags: WriteFlags;
  /** Flags for the board read. Only "Error loading" fails it; a slow network slows it too. */
  readFlags: WriteFlags;
};

export const SLOW_MS = 2000;

export function writeFlagsFor(state: DemoState): WriteFlags {
  if (state === "slow") return { latency: SLOW_MS };
  if (state === "fail") return { fail: true };
  return {};
}

export function readFlagsFor(state: DemoState): WriteFlags {
  if (state === "slow") return { latency: SLOW_MS };
  if (state === "error") return { fail: true };
  return {};
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>("normal");
  const value = useMemo<DemoContextValue>(
    () => ({ state, setState, flags: writeFlagsFor(state), readFlags: readFlagsFor(state) }),
    [state],
  );
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoState() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemoState needs a <DemoStateProvider> above it.");
  return ctx;
}
