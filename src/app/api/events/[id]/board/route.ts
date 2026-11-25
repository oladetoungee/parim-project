import { boardQuerySchema, idParamsSchema } from "@/lib/schemas";
import { getDb } from "@/server/db/client";
import { getBoard } from "@/server/db/queries";
import { errorResponse, json, parseQuery, parseWith, route } from "@/server/http";
import { getSession } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

/** Event, locations, shifts with fill counts and coverage by hour. Both roles. */
export const GET = route<Context>(async (request, { params }) => {
  const session = getSession(request);
  const { id } = parseWith(idParamsSchema, await params);
  const { date } = parseQuery(boardQuerySchema, request);

  const board = await getBoard(getDb(), id, session, date);
  if (!board) return errorResponse(404, "event_not_found", "That event doesn't exist.");
  return json(board);
});
