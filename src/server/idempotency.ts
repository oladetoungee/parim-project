// Idempotency keys for writes. A client sends `Idempotency-Key: <uuid>` and a
// retry with the same key gets the first response back instead of running the
// write again. Stored in Redis as idem:{key} for 24 hours.
//
// Flow:
//   1. SET idem:{key} {state: "pending"} NX. Only one request can win this, so
//      two copies arriving together can't both run the write.
//   2. The winner runs the handler and overwrites the key with {status, body}.
//   3. A later copy finds "done" and replays it, or finds "pending" and gets 409.
// The fingerprint (actor, method, path, body) stops a key being reused for a
// different request, which would otherwise replay the wrong answer.

import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";
import { errorResponse, HttpError } from "./http";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";
const DONE_TTL_SECONDS = 60 * 60 * 24;
// Short, so a crashed request doesn't lock its key for a day.
const PENDING_TTL_SECONDS = 60;
const KEY_PATTERN = /^[A-Za-z0-9_:-]{8,128}$/;

type Stored =
  | { state: "pending"; fingerprint: string }
  | { state: "done"; fingerprint: string; status: number; body: unknown };

function fingerprintOf(request: Request, actor: string, rawBody: string) {
  const { pathname } = new URL(request.url);
  return createHash("sha256").update(`${actor}\n${request.method} ${pathname}\n${rawBody}`).digest("hex");
}

function readKey(request: Request): string | null {
  const key = request.headers.get(IDEMPOTENCY_HEADER);
  if (key === null) return null;
  if (!KEY_PATTERN.test(key)) {
    throw new HttpError(422, "invalid_idempotency_key", "Idempotency-Key must be 8 to 128 letters, digits, dashes, underscores or colons.");
  }
  return key;
}

/**
 * Runs `handler` at most once per Idempotency-Key. Without the header it just
 * runs. 5xx responses and thrown errors release the key so a retry can run.
 */
export async function withIdempotency(
  request: Request,
  { actor, rawBody }: { actor: string; rawBody: string },
  handler: () => Promise<Response>,
): Promise<Response> {
  const key = readKey(request);
  if (!key) return handler();

  const redisKey = `idem:${key}`;
  const fingerprint = fingerprintOf(request, actor, rawBody);
  const pending: Stored = { state: "pending", fingerprint };
  const claimed = await redis.set(redisKey, pending, { nx: true, ex: PENDING_TTL_SECONDS });

  if (claimed !== "OK") return replay(await redis.get<Stored>(redisKey), fingerprint);

  let response: Response;
  try {
    response = await handler();
  } catch (error) {
    await redis.del(redisKey);
    throw error;
  }

  if (response.status >= 500) {
    await redis.del(redisKey);
    return response;
  }
  const done: Stored = { state: "done", fingerprint, status: response.status, body: await response.clone().json() };
  await redis.set(redisKey, done, { ex: DONE_TTL_SECONDS });
  return response;
}

function replay(stored: Stored | null, fingerprint: string): Response {
  // The pending claim expired between our SET and GET. Rare; ask for a retry.
  if (!stored) {
    return errorResponse(409, "idempotency_in_progress", "This request is still being processed. Try again in a moment.");
  }
  if (stored.fingerprint !== fingerprint) {
    return errorResponse(422, "idempotency_key_reused", "This Idempotency-Key was already used for a different request.");
  }
  if (stored.state === "pending") {
    return errorResponse(409, "idempotency_in_progress", "This request is still being processed. Try again in a moment.");
  }
  return Response.json(stored.body, { status: stored.status, headers: { "Idempotent-Replayed": "true" } });
}
