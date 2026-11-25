import { idParamsSchema } from "@/lib/schemas";
import { removeAssignment } from "@/server/assign";
import { getDb } from "@/server/db/client";
import { errorResponse, json, parseWith, route } from "@/server/http";
import { withIdempotency } from "@/server/idempotency";
import { actorOf, requireManager } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

/** Removes an assignment and returns the deleted row, so Undo can post it back. */
export const DELETE = route<Context>(async (request, { params }) => {
  const actor = actorOf(requireManager(request));
  const { id } = parseWith(idParamsSchema, await params);

  return withIdempotency(request, { actor, rawBody: "" }, async () => {
    const outcome = await removeAssignment(getDb(), id, actor);
    if (!outcome.ok) return errorResponse(outcome.status, outcome.code, outcome.message, outcome.details);
    return json({ assignment: outcome.assignment });
  });
});
