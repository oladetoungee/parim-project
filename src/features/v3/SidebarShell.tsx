"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DemoStatesMenu, RoleSwitch } from "@/features/board/BoardControls";
import { useBoard } from "@/features/board/queries";
import { ThemeToggle } from "@/features/shell/ThemeToggle";
import { FIGMA_URL } from "@/features/story/content";
import { AppBase } from "@/features/v2/app-base";
import { AppBar, AppProviders } from "@/features/v2/AppShell";
import { cn } from "@/lib/cn";

const BASE = "/v3";

/**
 * The third layout: a sidebar, the way Deputy and 7shifts do it, so the
 * places you can go are always in the same spot. Under 1024px the sidebar
 * gives way to the top bar from /v2, which fits a phone.
 *
 * data-quiet-covered: a covered card already says so with its green dot,
 * full baseline and "3 of 3", so the word is dropped here (screen readers
 * still hear it). See globals.css.
 */
export function SidebarShell({ children }: { children: ReactNode }) {
  return (
    <AppBase value={BASE}>
      <AppProviders>
        <div data-quiet-covered className="flex min-h-full flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppBar className="lg:hidden" />
            {children}
          </div>
        </div>
      </AppProviders>
    </AppBase>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const board = useBoard().data;
  const role = board?.viewer.role;
  const manager = role !== "worker";
  const waiting = board ? board.shifts.reduce((n, s) => n + s.requests.length, 0) : 0;

  const links = [
    { href: `${BASE}/schedule`, label: manager ? "Schedule" : "My shifts", show: true },
    { href: `${BASE}/people`, label: "People", show: manager },
    { href: `${BASE}/requests`, label: "Requests", count: waiting, show: manager },
  ];

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-hairline bg-canvas px-4 pt-5 pb-6 lg:flex">
      <Link
        href={BASE}
        className="self-start px-2 font-display text-20 leading-7 tracking-[-0.02em] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="font-bold">Parim</span>
        <span className="font-light">Shift</span>
      </Link>

      <div className="mt-6 px-2">
        <p className="text-14 font-semibold text-ink">{board?.event.name ?? "Autumn race day"}</p>
        <p className="text-12 text-muted">{board ? board.event.venue : "Riverbank Racecourse"}</p>
      </div>

      <nav aria-label="Main" className="mt-6">
        <ul className="flex flex-col gap-0.5">
          {links
            .filter((l) => l.show)
            .map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center justify-between rounded-4 px-2 text-14",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      active ? "bg-hover font-semibold text-ink" : "font-medium text-muted hover:bg-hover hover:text-ink",
                    )}
                  >
                    {l.label}
                    {l.count ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-short-tint px-1.5 text-12 font-semibold text-ink tabular">
                        {l.count}
                        <span className="sr-only"> waiting</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-hairline px-2 pt-4">
        <nav aria-label="About this build">
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-12">
            <AboutLink href={BASE}>The story</AboutLink>
            <AboutLink href="/decisions">Decisions</AboutLink>
            <AboutLink href="/system">Design system</AboutLink>
            <AboutLink href={FIGMA_URL}>Figma</AboutLink>
          </ul>
        </nav>
        <p className="mt-2 text-12 text-muted">Viewing as</p>
        <RoleSwitch role={role} onSwitched={() => {}} />
        <div className="flex items-center justify-between">
          <DemoStatesMenu />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

function AboutLink({ href, children }: { href: string; children: ReactNode }) {
  const className =
    "text-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return (
    <li>
      {href.startsWith("http") ? (
        <a href={href} target="_blank" rel="noreferrer" className={className}>
          {children}
        </a>
      ) : (
        <Link href={href} className={className}>
          {children}
        </Link>
      )}
    </li>
  );
}
