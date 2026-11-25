"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function BoardError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="px-4 py-8 md:px-8">
      <ErrorState title="The board stopped working" description="Something broke while drawing it. Nothing you saved is lost." onRetry={retry} />
    </main>
  );
}
