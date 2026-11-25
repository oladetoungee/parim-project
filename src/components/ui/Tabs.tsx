"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

/*
 * Tab list with a 2px underline that slides to the active tab. The indicator
 * is a 1px-wide bar moved with translateX and scaleX, so only transform animates.
 */
export function TabsList({ className, children, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;

    let first = true;
    const place = () => {
      const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!active) {
        indicator.style.opacity = "0";
        return;
      }
      if (first) indicator.style.transition = "none";
      indicator.style.opacity = "1";
      indicator.style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth})`;
      if (first) {
        // Force the jump to apply, then let later moves animate.
        void indicator.offsetWidth;
        indicator.style.transition = "";
        first = false;
      }
    };

    place();
    const mutations = new MutationObserver(place);
    mutations.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
    const resize = new ResizeObserver(place);
    resize.observe(list);
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={listRef}
      className={cn("relative flex items-stretch gap-6 border-b border-hairline", className)}
      {...props}
    >
      {children}
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className="motion-indicator pointer-events-none absolute bottom-[-1px] left-0 h-0.5 w-px origin-left bg-ink opacity-0"
      />
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px inline-flex h-10 items-center text-14 font-medium text-muted",
        "hover:text-ink data-[state=active]:text-ink",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:text-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("pt-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}
      {...props}
    />
  );
}
