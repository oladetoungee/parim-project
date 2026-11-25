import { createAssignmentSchema } from "@/lib/schemas";
import { assignStaff } from "@/server/assign";
import { getDb } from "@/server/db/client";
import { errorResponse, json, parseWith, readJsonBody, route } from "@/server/http";
import { withIdempotency } from "@/server/idempotency";
import { actorOf, requireManager } from "@/server/session";

/**
 * Assigns a person to a shift inside the locked transaction.
 * 201 created, 409 with rule breaks, 403 for workers, 422 for a bad body.
 */
export const POST = route(async (request) => {
  const actor = actorOf(requireManager(request));
  const { raw, value } = await readJsonBody(request);
  const body = parseWith(createAssignmentSchema, value);

  return withIdempotency(request, { actor, rawBody: raw }, async () => {
    const outcome = await assignStaff(getDb(), body, actor);
    if (!outcome.ok) return errorResponse(outcome.status, outcome.code, outcome.message, outcome.details);
    return json({ assignment: outcome.assignment, notes: outcome.notes }, 201);
  });
});
