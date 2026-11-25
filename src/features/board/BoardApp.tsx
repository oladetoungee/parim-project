"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { BoardScreen } from "./Board";
import { DemoStateProvider } from "./demo-state";

/** The board's client boundary: one query client per browser tab, toasts, and the demo states. */
export function BoardApp() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: true },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <DemoStateProvider>
          <BoardScreen />
        </DemoStateProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
