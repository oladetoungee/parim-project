import type { z } from "zod";
import { demoResponse } from "./demo";

/** The one error shape every route returns. */
export type ErrorBody = { error: { code: string; message: string; details: unknown } };

/** Thrown from helpers to stop a handler with a specific response. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers });
}

export function errorResponse(status: number, code: string, message: string, details: unknown = null) {
  const body: ErrorBody = { error: { code, message, details } };
  return json(body, status);
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
 * An empty body counts as `{}` so bodiless POSTs (approve) still validate.
 */
export async function readJsonBody(request: Request): Promise<{ raw: string; value: unknown }> {
  const raw = await request.text();
  if (raw.trim() === "") return { raw, value: {} };
  try {
    return { raw, value: JSON.parse(raw) };
  } catch {
    throw new HttpError(400, "invalid_json", "The request body is not valid JSON.");
  }
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/**
 * Wraps a route handler: applies the demo latency and failure flags, turns a
 * thrown HttpError into its response, and hides unexpected errors behind a 500.
 */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      const demo = await demoResponse(request);
      if (demo) return demo;
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error.status, error.code, error.message, error.details);
      }
      console.error(error);
      return errorResponse(500, "internal_error", "Something went wrong on our side. Try again.");
    }
  };
}
