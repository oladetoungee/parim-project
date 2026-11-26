import type { z } from "zod";
import { demoResponse } from "./demo";
import { causeOf, logRequest, routeName } from "./log";
import { assertSameOrigin } from "./origin";
import { enforceRateLimit, type LimitKind } from "./rate-limit";

/** Every API response carries one, and every error log line repeats it. */
export const REQUEST_ID_HEADER = "X-Request-Id";
/** The largest JSON body any route accepts. The biggest real one is under 1 KB. */
export const MAX_BODY_BYTES = 16 * 1024;

/** The one error shape every route returns. */
export type ErrorBody = { error: { code: string; message: string; details: unknown } };

/** Thrown from helpers to stop a handler with a specific response. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown = null,
    readonly headers?: HeadersInit,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers });
}

export function errorResponse(status: number, code: string, message: string, details: unknown = null, headers?: HeadersInit) {
  const body: ErrorBody = { error: { code, message, details } };
  return json(body, status, headers);
}

function validationError(error: z.ZodError) {
  const issues = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  return new HttpError(422, "validation_failed", "Some fields are missing or not valid.", { issues });
}

export function parseWith<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function parseQuery<S extends z.ZodType>(schema: S, request: Request): z.output<S> {
  return parseWith(schema, Object.fromEntries(new URL(request.url).searchParams));
}

/**
 * Reads the body once and keeps the raw text, which idempotency fingerprints.
 * The JSON content type is required: an HTML form on another site can't send
 * it without a CORS preflight, which this API never answers.
 * Bodies over MAX_BODY_BYTES are refused with 413 without being read in full.
 * An empty body counts as `{}` so bodiless POSTs (approve) still validate.
 */
export async function readJsonBody(request: Request): Promise<{ raw: string; value: unknown }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(contentType)) {
    throw new HttpError(415, "unsupported_media_type", "Send the request body as JSON, with Content-Type: application/json.");
  }
  const raw = await readCapped(request, MAX_BODY_BYTES);
  if (raw.trim() === "") return { raw, value: {} };
  try {
    return { raw, value: JSON.parse(raw) };
  } catch {
    throw new HttpError(400, "invalid_json", "The request body is not valid JSON.");
  }
}

/** Reads the body as text, stopping at `limit` bytes. Content-Length is checked first but not trusted. */
async function readCapped(request: Request, limit: number): Promise<string> {
  const tooLarge = () => new HttpError(413, "payload_too_large", `The request body is over ${limit / 1024} KB.`);
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge();
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

type RouteOptions = {
  /** Which rate limit a write counts against. Reads are never limited. Default "write". */
  limit?: LimitKind;
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Wraps a route handler. In order: tags the request with an id, checks the
 * Origin and rate limit on writes, applies the demo latency and failure flags,
 * then runs the handler. A thrown HttpError becomes its response; anything
 * else becomes a generic 500 that carries the request id and nothing else.
 * Every failed response is logged as one JSON line.
 */
export function route<C = unknown>(handler: Handler<C>, options: RouteOptions = {}): Handler<C> {
  return async (request, context) => {
    const started = performance.now();
    const requestId = crypto.randomUUID();
    let cause: string | undefined;
    let response: Response;

    try {
      if (WRITE_METHODS.has(request.method)) {
        assertSameOrigin(request);
        await enforceRateLimit(request, options.limit ?? "write");
      }
      response = (await demoResponse(request)) ?? (await handler(request, context));
    } catch (error) {
      if (error instanceof HttpError) {
        response = errorResponse(error.status, error.code, error.message, error.details, error.headers);
      } else if (isLockWaitTimeout(error)) {
        response = errorResponse(503, "busy", "Someone else is changing this shift right now. Try again in a moment.");
      } else {
        cause = causeOf(error);
        // The full error stays out of production logs: driver messages can quote row values.
        if (process.env.NODE_ENV === "development") console.error(error);
        response = errorResponse(500, "internal_error", "Something went wrong on our side. Try again.", { requestId });
      }
    }

    response.headers.set(REQUEST_ID_HEADER, requestId);
    if (response.status >= 400) {
      logRequest({
        level: response.status >= 500 ? "error" : "warn",
        requestId,
        route: routeName(request),
        code: await errorCode(response),
        status: response.status,
        ms: Math.round(performance.now() - started),
        ...(cause ? { cause } : {}),
      });
    }
    return response;
  };
}

async function errorCode(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as Partial<ErrorBody>;
    return body.error?.code ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** innodb_lock_wait_timeout ran out (see src/server/db/client.ts). Nothing was written. */
function isLockWaitTimeout(error: unknown): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "ER_LOCK_WAIT_TIMEOUT") return true;
  }
  return false;
}
