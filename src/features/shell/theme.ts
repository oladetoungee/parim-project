// Light and dark. With no saved choice the theme follows prefers-color-scheme;
// a click on the toggle saves "light" or "dark" to localStorage. The tokens
// switch on data-theme="dark" on <html> (src/styles/tokens.css), which also
// sets color-scheme so native controls and scrollbars match.

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "parimshift-theme";

/**
 * Runs in <head> before first paint (see src/app/layout.tsx), so a dark
 * visitor never sees a white frame. Kept tiny and dependency free; storage
 * access is wrapped because it throws in some private modes.
 */
export const themeScript = `(function(){var t;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t})()`;

export function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage is blocked. The choice still applies until the page reloads.
  }
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
