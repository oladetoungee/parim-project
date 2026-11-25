import { createShiftRequestSchema } from "@/lib/schemas";
import { getDb } from "@/server/db/client";
import { errorResponse, json, parseWith, readJsonBody, route } from "@/server/http";
import { withIdempotency } from "@/server/idempotency";
import { createShiftRequest } from "@/server/shift-requests";
import { actorOf, requireWorker } from "@/server/session";

/** A worker requests an open shift. The staff id comes from the cookie, never the body. */
export const POST = route(async (request) => {
  const session = requireWorker(request);
  const actor = actorOf(session);
  const { raw, value } = await readJsonBody(request);
  const body = parseWith(createShiftRequestSchema, value);

  return withIdempotency(request, { actor, rawBody: raw }, async () => {
    const outcome = await createShiftRequest(getDb(), body.shiftId, session.staffId, actor);
    if (!outcome.ok) return errorResponse(outcome.status, outcome.code, outcome.message, outcome.details);
    return json({ request: outcome.request, notes: outcome.notes }, 201);
  });
});
