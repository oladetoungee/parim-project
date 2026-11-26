// Thin fetch layer over the REST routes. Every error comes back as an ApiError
// with the server's code and message, so callers branch on `code`, not status.

import type { RuleBreak } from "@/lib/rules";
import type { ActivityItem, Board, StaffListItem } from "@/server/db/queries";

export const EVENT_ID = 1;

export type ErrorDetails = {
  breaks?: RuleBreak[];
  takenBy?: { staffId: number; name: string } | null;
  [key: string]: unknown;
} | null;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ErrorDetails = null,
  ) {
    super(message);
  }

  /** Worth retrying with the same Idempotency-Key: the server never finished the write. */
  get retryable() {
    return this.status === 0 || this.status >= 500;
  }
}

const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin", ...init });
  } catch {
    throw new ApiError(0, "network", NETWORK_MESSAGE);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error;
    throw new ApiError(response.status, error?.code ?? "unknown", error?.message ?? "Something went wrong. Try again.", error?.details ?? null);
  }
  return body as T;
}

/**
 * Query string the demo states menu adds to writes: ?latency=2000 for a slow
 * network, ?fail=1 for a failed save. The API honours both when DEMO_FLAGS=1.
 */
export type WriteFlags = { latency?: number; fail?: boolean };

function withFlags(path: string, flags: WriteFlags) {
  const params = new URLSearchParams();
  if (flags.latency) params.set("latency", String(flags.latency));
  if (flags.fail) params.set("fail", "1");
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

type WriteOptions = { flags: WriteFlags; idempotencyKey?: string; body?: unknown };

function write<T>(method: "POST" | "PATCH" | "DELETE", path: string, { flags, idempotencyKey, body }: WriteOptions) {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return call<T>(withFlags(path, flags), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------- reads

export const boardKey = ["board", EVENT_ID] as const;
export const staffKey = (q: string) => ["staff", EVENT_ID, q] as const;
export const activityKey = (shiftId: number) => ["activity", EVENT_ID, shiftId] as const;

/** The board read takes the same demo flags as the writes: ?fail=1 for "Error loading", ?latency=2000 for a slow network. */
export function fetchBoard(flags: WriteFlags = {}) {
  return call<Board>(withFlags(`/api/events/${EVENT_ID}/board`, flags));
}

export function fetchStaff(q: string) {
  const params = new URLSearchParams({ eventId: String(EVENT_ID), limit: "200" });
  if (q) params.set("q", q);
  return call<{ items: StaffListItem[] }>(`/api/staff?${params}`).then((r) => r.items);
}

/** Dates arrive as ISO strings over JSON. */
export type Activity = Omit<ActivityItem, "createdAt"> & { createdAt: string };

export function fetchActivity(shiftId: number) {
  return call<{ items: Activity[]; nextCursor: number | null }>(`/api/events/${EVENT_ID}/activity?shiftId=${shiftId}&limit=20`);
}

// ---------------------------------------------------------------- writes

export type AssignmentRow = {
  id: number;
  shiftId: number;
  staffId: number;
  overrideReason: string | null;
};

export function postAssignment(
  body: { shiftId: number; staffId: number; overrideReason?: string | null },
  options: { flags: WriteFlags; idempotencyKey: string },
) {
  return write<{ assignment: AssignmentRow; notes: RuleBreak[] }>("POST", "/api/assignments", { ...options, body });
}

export function deleteAssignment(id: number, options: { flags: WriteFlags; idempotencyKey: string }) {
  return write<{ assignment: AssignmentRow }>("DELETE", `/api/assignments/${id}`, options);
}

export type ShiftPatch = {
  version: number;
  roleId?: number;
  startTime?: string;
  endTime?: string;
  slots?: number;
  notes?: string | null;
  overrideReason?: string | null;
};

export function patchShift(id: number, body: ShiftPatch, options: { flags: WriteFlags; idempotencyKey: string }) {
  return write<{ shift: unknown }>("PATCH", `/api/shifts/${id}`, { ...options, body });
}

export function postShiftRequest(shiftId: number, options: { flags: WriteFlags; idempotencyKey: string }) {
  return write<{ request: { id: number } }>("POST", "/api/shift-requests", { ...options, body: { shiftId } });
}

export function approveShiftRequest(requestId: number, overrideReason: string | null, options: { flags: WriteFlags; idempotencyKey: string }) {
  return write<{ assignment: AssignmentRow }>("POST", `/api/shift-requests/${requestId}/approve`, {
    ...options,
    body: overrideReason ? { overrideReason } : {},
  });
}

export function postSession(role: "manager" | "worker") {
  return write<{ session: Board["viewer"]; staff: { id: number; name: string } | null }>("POST", "/api/session", {
    flags: {},
    body: { role },
  });
}
