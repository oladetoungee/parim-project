// Sliding-window rate limits on writes, stored in Upstash Redis.
//
//   write    60 a minute per session (per IP when there's no valid cookie)
//   session  10 a minute per IP, on POST /api/session, which mints sessions
//
// Env:
//   RATE_LIMIT=off               turns it off (the test suites set this)
//   RATE_LIMIT_WRITES_PER_MIN    overrides 60
//   RATE_LIMIT_SESSIONS_PER_MIN  overrides 10
//   RATE_LIMIT_PREFIX            Redis key prefix, default "rl"
//
// If Redis is unreachable the request goes through and the failure is logged:
// a rate limiter outage shouldn't take the board down with it.

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import { HttpError } from "./http";
import { logEvent } from "./log";
import { sessionIdOf } from "./session";

export type LimitKind = "write" | "session";

const DEFAULTS: Record<LimitKind, { env: string; perMinute: number }> = {
  write: { env: "RATE_LIMIT_WRITES_PER_MIN", perMinute: 60 },
  session: { env: "RATE_LIMIT_SESSIONS_PER_MIN", perMinute: 10 },
};

// Limits are read from env per call so a test can lower them; limiters are
// cached by their settings so a normal process builds each one once.
const limiters = new Map<string, Ratelimit>();

function limiterFor(kind: LimitKind): Ratelimit {
  const { env, perMinute } = DEFAULTS[kind];
  const limit = Number(process.env[env]) || perMinute;
  const prefix = `${process.env.RATE_LIMIT_PREFIX ?? "rl"}:${kind}`;
  const cacheKey = `${prefix}:${limit}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({ redis, prefix, limiter: Ratelimit.slidingWindow(limit, "1 m"), timeout: 1000 });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

/**
 * The client's IP. On Vercel x-forwarded-for is written by the platform, so
 * its first entry is the real client; elsewhere it's only as good as the proxy.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function identifierFor(kind: LimitKind, request: Request): string {
  if (kind === "write") {
    const sid = sessionIdOf(request);
    if (sid) return `sid:${sid}`;
  }
  return `ip:${clientIp(request)}`;
}

/** Throws 429 rate_limited with Retry-After once the caller is over its limit. */
export async function enforceRateLimit(request: Request, kind: LimitKind) {
  if (process.env.RATE_LIMIT === "off") return;

  let result: Awaited<ReturnType<Ratelimit["limit"]>>;
  try {
    result = await limiterFor(kind).limit(identifierFor(kind, request));
  } catch (error) {
    logEvent("error", "rate_limit_unavailable", { kind, cause: error instanceof Error ? error.name : "unknown" });
    return;
  }
  if (result.reason === "timeout") logEvent("warn", "rate_limit_timeout", { kind });
  if (result.success) return;

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  throw new HttpError(429, "rate_limited", `Too many changes in a short time. Try again in ${retryAfter} seconds.`, null, {
    "Retry-After": String(retryAfter),
  });
}
