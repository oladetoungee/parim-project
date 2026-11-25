import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

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

/** Shared by the board, the system page and the decisions page. */
export function TopBar({ current, children, className }: TopBarProps) {
  return (
    <header className={cn("flex h-14 shrink-0 items-center gap-6 border-b border-hairline bg-canvas px-4 md:gap-8 md:px-8", className)}>
      <Link
        href="/"
        className="font-display text-20 leading-7 tracking-[-0.02em] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="font-bold">Parim</span>
        <span className="font-light">Shift</span>
      </Link>
      <nav aria-label="Main" className="hidden sm:block">
        <ul className="flex items-center gap-6">
          {links.map((link) => {
            const active = link.section === current;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-14 items-center text-14 font-medium",
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
      {children ? <div className="ml-auto flex items-center gap-2 md:gap-3">{children}</div> : null}
    </header>
  );
}
