/**
 * Motion tokens for code that has to wait on an animation (unmount after an
 * exit, patch a cache after a face leaves). Values come from the CSS custom
 * properties in src/styles/tokens.css, which mirror tokens/tokens.json, so
 * the timing in TypeScript can't drift from the timing in CSS. The fallbacks
 * are the same token values, for the server and for tests without styles.
 */
export type DurationToken = "instant" | "quick" | "base" | "slow";

const fallback: Record<DurationToken, number> = {
  instant: 100,
  quick: 150,
  base: 220,
  slow: 320,
};

/** "--duration-base" read off :root, in milliseconds. */
export function duration(token: DurationToken): number {
  if (typeof window === "undefined") return fallback[token];
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--duration-${token}`).trim();
  const ms = raw.endsWith("ms") ? parseFloat(raw) : raw.endsWith("s") ? parseFloat(raw) * 1000 : NaN;
  return Number.isFinite(ms) ? ms : fallback[token];
}

/** Resolves after the named duration, so a caller can let an exit play before it changes the data. */
export function afterMotion(token: DurationToken): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, duration(token)));
}
