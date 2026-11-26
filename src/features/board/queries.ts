"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ApiError, activityKey, boardKey, fetchActivity, fetchBoard, fetchStaff, staffKey } from "./api";
import { useDemoState } from "./demo-state";

export function useBoard() {
  const { state, readFlags } = useDemoState();
  const query = useQuery({
    queryKey: boardKey,
    // "Error loading" sends ?fail=1 and "Slow network" ?latency=2000, so both are real responses.
    // The flags are read when the fetch runs, never stored in the key: there is one board in the cache.
    queryFn: () => fetchBoard(readFlags),
    retry: (count, error) => !(error instanceof ApiError && error.code === "demo_failure") && count < 2,
  });

  // A failed fetch leaves the query in its error state until a fetch succeeds,
  // so the board refetches whenever "Error loading" is switched on or off:
  // on, the refetch fails with the loaded data still on screen; off, the clean
  // refetch clears the error. Without the second half the banner outlived the state.
  const { refetch } = query;
  const previous = useRef(state);
  useEffect(() => {
    const was = previous.current;
    previous.current = state;
    if (was !== state && (state === "error" || was === "error")) void refetch();
  }, [state, refetch]);

  return query;
}

export function useStaff(q: string, enabled: boolean) {
  return useQuery({
    queryKey: staffKey(q),
    queryFn: () => fetchStaff(q),
    enabled,
    // Keep the last list on screen while the next search runs.
    placeholderData: keepPreviousData,
  });
}

export function useActivity(shiftId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: activityKey(shiftId ?? 0),
    queryFn: () => fetchActivity(shiftId!),
    enabled: enabled && shiftId !== null,
  });
}
