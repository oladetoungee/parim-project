import { staffQuerySchema } from "@/lib/schemas";
import { getDb } from "@/server/db/client";
import { searchStaff } from "@/server/db/queries";
import { errorResponse, json, parseQuery, route } from "@/server/http";
import { requireManager } from "@/server/session";

/** Staff panel: ?eventId (required), ?q name search, ?role role id, ?limit (default 50, max 200). */
export const GET = route(async (request) => {
  requireManager(request);
  const query = parseQuery(staffQuerySchema, request);

  const items = await searchStaff(getDb(), query);
  if (!items) return errorResponse(404, "event_not_found", "That event doesn't exist.");
  return json({ items });
});
