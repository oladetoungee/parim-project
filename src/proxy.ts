import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_SESSION, encodeSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/session";

/**
 * Gives a first-time visitor the default manager session, so the board loads
 * without a login step. API routes are left out on purpose: they never mint a
 * session, they only read one (see src/server/session.ts).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const token = encodeSession(DEFAULT_SESSION);
  // Set it on the request too, so this first render already sees the session.
  request.cookies.set(SESSION_COOKIE, token);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

export const config = {
  // Pages only: skip API routes, Next internals and files with an extension.
  matcher: ["/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
