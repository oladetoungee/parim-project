import { eq } from "drizzle-orm";
import { sessionBodySchema } from "@/lib/schemas";
import { getDb } from "@/server/db/client";
import { staff } from "@/server/db/schema";
import { HttpError, json, parseWith, readJsonBody, route } from "@/server/http";
import { DEMO_WORKER_EMAIL, readSession, type Session, sessionSetCookie } from "@/server/session";

/** The current session (null if there is none), so the role switch can show where it is. */
export const GET = route(async (request) => {
  return json({ session: readSession(request) });
});

/**
 * Switches role. Sets the signed cookie that every other route reads. Needs no
 * existing session; the JSON content type keeps a cross-site form from calling it.
 */
export const POST = route(async (request) => {
  const body = parseWith(sessionBodySchema, (await readJsonBody(request)).value);

  let session: Session = { role: "manager" };
  let person: { id: number; name: string } | null = null;
  if (body.role === "worker") {
    const where = body.staffId ? eq(staff.id, body.staffId) : eq(staff.email, DEMO_WORKER_EMAIL);
    [person = null] = await getDb().select({ id: staff.id, name: staff.name }).from(staff).where(where);
    if (!person) throw new HttpError(404, "staff_not_found", "There is no staff member to sign in as.");
    session = { role: "worker", staffId: person.id };
  }

  return json({ session, staff: person }, 200, { "Set-Cookie": sessionSetCookie(session) });
});
