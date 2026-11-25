// Demo login. The Manager / Worker switch sets a signed cookie, and every
// route reads the role from that cookie, never from the request body.
//
// Cookie value: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, SESSION_SECRET))
//
// Every API route, reads included, needs the cookie: no cookie is 401
// no_session, a cookie that fails verification is 401 invalid_session. The
// first page load gets a manager cookie from src/proxy.ts, so the board works
// straight away. The cookie is SameSite=Lax, so a cross-site POST arrives
// without it and is refused.

import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";

export type Session = { role: "manager" } | { role: "worker"; staffId: number };

export const SESSION_COOKIE = "shiftline_session";
/** The seeded worker the switch logs in as, unless a staffId is given. */
export const DEMO_WORKER_EMAIL = "ana.tamm@example.com";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** What src/proxy.ts hands out on the first page load. */
export const DEFAULT_SESSION: Session = { role: "manager" };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) throw new Error("SESSION_SECRET must be set (16+ characters)");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string): Session | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data?.role === "manager") return { role: "manager" };
    if (data?.role === "worker" && Number.isInteger(data.staffId) && data.staffId > 0) {
      return { role: "worker", staffId: data.staffId };
    }
    return null;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** The session, or null when there is no cookie. A bad cookie is 401. */
export function readSession(request: Request): Session | null {
  const token = readCookie(request, SESSION_COOKIE);
  if (token === undefined) return null;
  const session = decodeSession(token);
  if (!session) throw new HttpError(401, "invalid_session", "Your session is not valid. Switch role again to start a new one.");
  return session;
}

export function getSession(request: Request): Session {
  const session = readSession(request);
  if (!session) throw new HttpError(401, "no_session", "No session. Reload the page or switch role to start one.");
  return session;
}

export function requireManager(request: Request): Session & { role: "manager" } {
  const session = getSession(request);
  if (session.role !== "manager") throw new HttpError(403, "forbidden", "Only a manager can do this.");
  return session;
}

export function requireWorker(request: Request): Session & { role: "worker" } {
  const session = getSession(request);
  if (session.role !== "worker") throw new HttpError(403, "forbidden", "Only a shift worker can request a shift.");
  return session;
}

/** Who did it, as written to assignment.created_by and audit_log.actor. */
export function actorOf(session: Session): string {
  return session.role === "manager" ? "manager" : `worker:${session.staffId}`;
}

/** Cookie attributes, shared by POST /api/session and src/proxy.ts. */
export function sessionCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
  };
}

/** The Set-Cookie header value for a session. */
export function sessionSetCookie(session: Session): string {
  const options = sessionCookieOptions();
  const parts = [`${SESSION_COOKIE}=${encodeSession(session)}`, `Path=${options.path}`, "HttpOnly", "SameSite=Lax", `Max-Age=${options.maxAge}`];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

/** A Cookie request header for a session. Used by tests and scripts. */
export function sessionCookieHeader(session: Session): string {
  return `${SESSION_COOKIE}=${encodeSession(session)}`;
}
