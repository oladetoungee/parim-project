"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Draws its children at a fixed size and scales them to the box's width, so a
 * scene is laid out once at 1200 by 720 and stays pixel-true at any size.
 */
export function Scaled({
  width,
  height,
  children,
  className,
}: {
  width: number;
  height: number;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={ref} className={cn("relative w-full overflow-hidden", className)} style={{ aspectRatio: `${width} / ${height}` }}>
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          visibility: scale ? undefined : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export const SCREEN_W = 1200;
export const SCREEN_H = 720;

const frameShadow: CSSProperties = {
  boxShadow: "0 1px 2px rgb(0 0 0 / 0.12), 0 24px 64px -16px rgb(0 0 0 / 0.35), 0 0 0 1px rgb(0 0 0 / 0.08)",
};

/**
 * A browser window with the product inside. The whole thing is a picture of
 * the app: hidden from assistive tech and out of the tab order, since the
 * chapter's headline and line already say what it shows.
 */
export function BrowserFrame({
  path,
  theme = "light",
  width = SCREEN_W,
  height = SCREEN_H,
  children,
  className,
}: {
  path: string;
  theme?: "light" | "dark";
  /** The size the screen is drawn at. Smaller means bigger text in the same frame. */
  width?: number;
  height?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-theme={theme}
      data-quiet-covered
      aria-hidden="true"
      inert
      className={cn(
        "w-full overflow-hidden rounded-[14px] bg-canvas text-ink select-none",
        theme === "dark" && "ring-1 ring-[rgb(255_255_255/0.16)]",
        className,
      )}
      style={frameShadow}
    >
      <div className="flex h-8 items-center gap-1.5 border-b border-hairline bg-paper px-3">
        <span className="size-2.5 rounded-full bg-hairline" />
        <span className="size-2.5 rounded-full bg-hairline" />
        <span className="size-2.5 rounded-full bg-hairline" />
        <span className="mx-auto hidden rounded-full bg-canvas px-4 py-0.5 text-12 text-muted sm:block">
          parimshift.gbemisolaoladetoun.com{path}
        </span>
        <span className="w-[46px]" />
      </div>
      <Scaled width={width} height={height}>
        {children}
      </Scaled>
    </div>
  );
}
