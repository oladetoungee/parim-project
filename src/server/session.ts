// Demo login. The Manager / Worker switch sets a signed cookie, and every
// route reads the role from that cookie, never from the request body.
//
// Cookie value: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, SESSION_SECRET))
//
// A request with no cookie is treated as the manager. The switch has no
// password, so anyone can become the manager anyway; defaulting saves the first
// page load a round trip. A cookie that is present but fails verification is
// rejected with 401 rather than quietly downgraded.

import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";

export type Session = { role: "manager" } | { role: "worker"; staffId: number };

export const SESSION_COOKIE = "shiftline_session";
/** The seeded worker the switch logs in as, unless a staffId is given. */
export const DEMO_WORKER_EMAIL = "ana.tamm@example.com";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_SESSION: Session = { role: "manager" };

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

export function getSession(request: Request): Session {
  const token = readCookie(request, SESSION_COOKIE);
  if (token === undefined) return DEFAULT_SESSION;
  const session = decodeSession(token);
  if (!session) throw new HttpError(401, "invalid_session", "Your session is not valid. Switch role again to start a new one.");
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

/** The Set-Cookie header value for a session. */
export function sessionSetCookie(session: Session): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeSession(session)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** A Cookie request header for a session. Used by tests and scripts. */
export function sessionCookieHeader(session: Session): string {
  return `${SESSION_COOKIE}=${encodeSession(session)}`;
}
