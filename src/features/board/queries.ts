"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ApiError, activityKey, boardKey, fetchActivity, fetchBoard, fetchStaff, staffKey } from "./api";
import { useDemoState } from "./demo-state";

export function useBoard() {
  const { state } = useDemoState();
  const failing = state === "error";
  const query = useQuery({
    queryKey: boardKey,
    // The "Error loading" demo state sends ?fail=1, so the failure is a real 503.
    queryFn: () => fetchBoard({ fail: failing }),
    retry: (count, error) => !(error instanceof ApiError && error.code === "demo_failure") && count < 2,
  });

  // Entering the error state triggers a refetch, which fails with the data still on screen.
  const { refetch } = query;
  useEffect(() => {
    if (failing) void refetch();
  }, [failing, refetch]);

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
