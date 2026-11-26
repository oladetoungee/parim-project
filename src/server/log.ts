// One JSON line per failed API request, so logs can be searched by requestId
// and counted by code. No bodies, cookies, names or emails: only what's here.

type Level = "warn" | "error";

export type RequestLog = {
  level: Level;
  requestId: string;
  /** Method and path with ids collapsed, e.g. "PATCH /api/shifts/:id". */
  route: string;
  code: string;
  status: number;
  ms: number;
  /** For 500s: the error class or driver code (e.g. ER_DUP_ENTRY), never its message. */
  cause?: string;
};

export function logRequest(entry: RequestLog) {
  const line = JSON.stringify(entry);
  if (entry.level === "error") console.error(line);
  else console.warn(line);
}

/** A non-HTTP event worth knowing about, such as the rate limiter failing open. */
export function logEvent(level: Level, event: string, fields: Record<string, string | number> = {}) {
  const line = JSON.stringify({ level, event, ...fields });
  if (level === "error") console.error(line);
  else console.warn(line);
}

export function routeName(request: Request): string {
  const { pathname } = new URL(request.url);
  return `${request.method} ${pathname.replace(/\/\d+(?=\/|$)/g, "/:id")}`;
}

/** Something safe to log about an unexpected error: a code or class name, not the message. */
export function causeOf(error: unknown): string {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return error instanceof Error ? error.name : typeof error;
}
