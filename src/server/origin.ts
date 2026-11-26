import { HttpError } from "./http";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Refuses a write whose Origin (or, failing that, Referer) isn't this host.
 * Browsers always send Origin on cross-site and same-origin POST, PATCH and
 * DELETE, so a missing header means a non-browser client or a stripped
 * request; both are refused too. This sits on top of the SameSite=Lax cookie
 * and the JSON content type check, so a CSRF attempt has to beat all three.
 *
 * The host is read the way Next's own Server Actions check reads it:
 * x-forwarded-host (set by the platform proxy), then Host.
 */
export function assertSameOrigin(request: Request) {
  if (!UNSAFE_METHODS.has(request.method)) return;

  const source = request.headers.get("origin") ?? request.headers.get("referer");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  if (!source || hostOf(source) !== host) {
    throw new HttpError(403, "bad_origin", "This request didn't come from ParimShift, so it was refused.");
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null; // includes the literal "null" Origin from sandboxed frames
  }
}
