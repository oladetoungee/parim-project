import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./ThemeToggle";

export type Section = "board" | "system" | "decisions";

const links: { href: string; label: string; section: Section }[] = [
  { href: "/board", label: "Board", section: "board" },
  { href: "/system", label: "System", section: "system" },
  { href: "/decisions", label: "Decisions", section: "decisions" },
];

type TopBarProps = {
  current?: Section;
  /** Page controls on the right. The board puts the role switch and demo states here. */
  children?: ReactNode;
  className?: string;
};

/**
 * Shared by the board, the system page and the decisions page. From 640px
 * up it is one 56px row. Under 640px the links drop to a compact 40px second
 * row with a hairline above, so System and Decisions stay reachable on a phone.
 * The theme toggle sits last on the right: after the page controls from 640px
 * up, at the end of the links row on a phone, where the board's controls
 * leave no room for it. Only one of the two is ever displayed.
 */
export function TopBar({ current, children, className }: TopBarProps) {
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
      <div className="order-last -mx-4 flex basis-[calc(100%+2rem)] items-center justify-between border-t border-hairline px-4 sm:order-none sm:mx-0 sm:basis-auto sm:border-t-0 sm:px-0">
        <nav aria-label="Main">
          <ul className="flex items-center gap-6">
            {links.map((link) => {
              const active = link.section === current;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex h-10 items-center text-14 font-medium sm:h-14",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      active
                        ? "text-ink after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-ink"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <ThemeToggle className="sm:hidden" />
      </div>
      <div className="ml-auto flex h-14 items-center gap-2 md:gap-3">
        {children}
        <ThemeToggle className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}
