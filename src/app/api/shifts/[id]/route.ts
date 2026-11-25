import { idParamsSchema, updateShiftSchema } from "@/lib/schemas";
import { getDb } from "@/server/db/client";
import { errorResponse, json, parseWith, readJsonBody, route } from "@/server/http";
import { withIdempotency } from "@/server/idempotency";
import { updateShift } from "@/server/shifts";
import { actorOf, requireManager } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

/** Edits role, times, slots or notes. 409 stale_version when `version` is out of date. */
export const PATCH = route<Context>(async (request, { params }) => {
  const actor = actorOf(requireManager(request));
  const { id } = parseWith(idParamsSchema, await params);
  const { raw, value } = await readJsonBody(request);
  const body = parseWith(updateShiftSchema, value);

  return withIdempotency(request, { actor, rawBody: raw }, async () => {
    const outcome = await updateShift(getDb(), id, body, actor);
    if (!outcome.ok) return errorResponse(outcome.status, outcome.code, outcome.message, outcome.details);
    return json({ shift: outcome.shift });
  });
});
