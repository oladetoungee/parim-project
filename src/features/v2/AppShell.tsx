"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { ChevronDownIcon } from "@/components/ui/icons";
import { ToastProvider } from "@/components/ui/Toast";
import { DemoStatesMenu, RoleSwitch } from "@/features/board/BoardControls";
import { DemoStateProvider } from "@/features/board/demo-state";
import { useBoard } from "@/features/board/queries";
import { ThemeToggle } from "@/features/shell/ThemeToggle";
import { cn } from "@/lib/cn";
import { useAppBase } from "./app-base";

/**
 * The second layout, for comparing with /board. One query client for the
 * three pages, so moving between Schedule, People and Requests never refetches
 * the board, and the demo state carries across.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <div className="flex min-h-full flex-1 flex-col">
        <AppBar />
        {children}
      </div>
    </AppProviders>
  );
}

/** The query client, toasts and demo state both app layouts need. */
export function AppProviders({ children }: { children: ReactNode }) {
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
        <DemoStateProvider>{children}</DemoStateProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

type NavLink = { href: string; label: string; count?: number; managerOnly?: boolean };

export function AppBar({ className }: { className?: string }) {
  const pathname = usePathname();
  const base = useAppBase();
  const board = useBoard().data;
  const role = board?.viewer.role;
  const manager = role !== "worker";
  const waiting = board ? board.shifts.reduce((n, s) => n + s.requests.length, 0) : undefined;

  const links: NavLink[] = [
    { href: `${base}/schedule`, label: manager ? "Schedule" : "My shifts" },
    { href: `${base}/people`, label: "People", managerOnly: true },
    { href: `${base}/requests`, label: "Requests", count: waiting, managerOnly: true },
  ];

  return (
    <header
      className={cn(
        "flex shrink-0 flex-wrap items-center border-b border-hairline bg-canvas px-4 sm:h-14 sm:flex-nowrap sm:gap-8 md:px-8",
        className,
      )}
    >
      <Link
        href="/"
        className="inline-flex h-14 items-center font-display text-20 leading-7 tracking-[-0.02em] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="font-bold">Parim</span>
        <span className="font-light">Shift</span>
      </Link>
      <nav
        aria-label="Main"
        className="order-last -mx-4 flex basis-[calc(100%+2rem)] items-center justify-between border-t border-hairline px-4 sm:order-none sm:mx-0 sm:basis-auto sm:border-t-0 sm:px-0"
      >
        <ul className="flex items-center gap-6">
          {links
            .filter((link) => manager || !link.managerOnly)
            .map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex h-10 items-center gap-2 text-14 font-medium sm:h-14",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      active
                        ? "text-ink after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-ink"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    {link.label}
                    {link.count ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-short-tint px-1.5 text-12 font-semibold text-ink tabular">
                        {link.count}
                        <span className="sr-only"> waiting</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
        </ul>
        {/* On a phone the toggle sits at the end of this row, where there is room for it. */}
        <ThemeToggle className="sm:hidden" />
      </nav>
      <div className="ml-auto flex h-14 items-center gap-2 md:gap-3">
        <RoleSwitch role={role} onSwitched={() => {}} />
        <DemoStatesMenu />
        <AboutMenu />
        <ThemeToggle className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}

const aboutLinks = [
  { href: "/board", label: "Original board", hint: "The first layout, to compare." },
  { href: "/system", label: "Design system", hint: "Every component and its states." },
  { href: "/decisions", label: "Decisions", hint: "The trade-offs behind the build." },
];

/** The pages about the build sit here, out of the way of the product. */
function AboutMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden gap-1.5 lg:inline-flex")}>
        About this build
        <ChevronDownIcon className="text-muted" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          className="motion-popover z-50 w-64 rounded-8 border border-hairline bg-raised p-1 shadow-lifted"
        >
          {aboutLinks.map((link) => (
            <Menu.Item key={link.href} asChild>
              <Link
                href={link.href}
                className="flex flex-col gap-0.5 rounded-2 px-3 py-2 outline-hidden select-none data-[highlighted]:bg-hover"
              >
                <span className="text-14 font-medium text-ink">{link.label}</span>
                <span className="text-12 text-muted">{link.hint}</span>
              </Link>
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
