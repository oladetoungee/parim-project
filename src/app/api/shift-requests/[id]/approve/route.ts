import { approveShiftRequestSchema, idParamsSchema } from "@/lib/schemas";
import { getDb } from "@/server/db/client";
import { errorResponse, json, parseWith, readJsonBody, route } from "@/server/http";
import { withIdempotency } from "@/server/idempotency";
import { approveShiftRequest } from "@/server/shift-requests";
import { actorOf, requireManager } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

/** Approves a request through the same locked assign transaction as POST /api/assignments. */
export const POST = route<Context>(async (request, { params }) => {
  const actor = actorOf(requireManager(request));
  const { id } = parseWith(idParamsSchema, await params);
  const { raw, value } = await readJsonBody(request);
  const body = parseWith(approveShiftRequestSchema, value);

  return withIdempotency(request, { actor, rawBody: raw }, async () => {
    const outcome = await approveShiftRequest(getDb(), id, body.overrideReason, actor);
    if (!outcome.ok) return errorResponse(outcome.status, outcome.code, outcome.message, outcome.details);
    return json({ request: outcome.request, assignment: outcome.assignment, notes: outcome.notes }, 201);
  });
});
