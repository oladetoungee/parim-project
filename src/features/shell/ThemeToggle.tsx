"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { applyTheme, currentTheme, saveTheme, savedTheme, systemTheme, type Theme } from "./theme";

// The <html> attribute is the source of truth: the head script sets it before
// React loads, so the toggle reads it rather than keeping its own copy.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Sun in dark mode, moon in light: the icon shows where a click takes you. */
export function ThemeToggle({ className }: { className?: string }) {
  // null on the server, so the first client render matches the HTML.
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);

  // React's dev-only remount resets <html> attributes; put the theme back before paint.
  useLayoutEffect(() => applyTheme(savedTheme() ?? systemTheme()), []);

  // With no saved choice, keep following the OS when it switches.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      if (!savedTheme()) applyTheme(systemTheme());
    };
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <IconButton
      label={theme === null ? "Change theme" : `Switch to ${next} theme`}
      tooltipSide="bottom"
      className={className}
      onClick={() => {
        saveTheme(next);
        applyTheme(next);
      }}
      icon={
        <>
          {/* Both icons render and CSS picks one, so the right icon shows before hydration. */}
          <MoonIcon className="dark:hidden" />
          <SunIcon className="hidden dark:block" />
        </>
      }
    />
  );
}
