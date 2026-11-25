import { activityQuerySchema, idParamsSchema } from "@/lib/schemas";
import { getDb } from "@/server/db/client";
import { getEvent, listActivity } from "@/server/db/queries";
import { errorResponse, json, parseQuery, parseWith, route } from "@/server/http";
import { requireManager } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

/** Audit log, newest first. Pass ?cursor=<nextCursor> for the next page, ?shiftId for one shift. */
export const GET = route<Context>(async (request, { params }) => {
  requireManager(request);
  const { id } = parseWith(idParamsSchema, await params);
  const query = parseQuery(activityQuerySchema, request);

  const db = getDb();
  if (!(await getEvent(db, id))) return errorResponse(404, "event_not_found", "That event doesn't exist.");
  return json(await listActivity(db, { eventId: id, ...query }));
});
