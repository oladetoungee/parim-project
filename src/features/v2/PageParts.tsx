"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppBase } from "./app-base";

export function PageHeader({ title, line }: { title: string; line: string }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-24 leading-8 font-bold tracking-[-0.02em] text-ink md:text-32 md:leading-9">{title}</h1>
      <p className="text-14 text-muted">{line}</p>
    </header>
  );
}

/** People and Requests are for managers. A worker who lands on one gets sent back to their shifts. */
export function ManagerOnly({ page }: { page: string }) {
  const base = useAppBase();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <EmptyState
        title={`${page} is for managers`}
        description="You're viewing as a worker. Switch to Manager in the app bar to see this page."
        actions={
          <Link href={`${base}/schedule`} className="text-14 font-medium text-ink underline underline-offset-4">
            Go to my shifts
          </Link>
        }
      />
    </main>
  );
}
