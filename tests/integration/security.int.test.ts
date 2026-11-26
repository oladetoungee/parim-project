import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { call, manager } from "./helpers";
import { PATCH as patchShift } from "@/app/api/shifts/[id]/route";
import { POST as postSession } from "@/app/api/session/route";
import { POST as assign } from "@/app/api/assignments/route";
import { sessionCookieHeader } from "@/server/session";

// None of these reach the database: each request is refused, or fails
// validation, before a query runs. The rate limit tests use the real Upstash
// Redis from .env.local, under a prefix no other run shares.

beforeAll(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

describe("origin check on real routes", () => {
  it("refuses a cross-site assign with 403 bad_origin before touching the data", async () => {
    const res = await call(assign, {
      method: "POST",
      path: "/api/assignments",
      body: { shiftId: 1, staffId: 1 },
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("bad_origin");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("refuses POST /api/session from another site, so it can't swap your role", async () => {
    const res = await call(postSession, { method: "POST", path: "/api/session", body: { role: "worker" }, session: null, headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(403);
  });
});

describe("body limit on real routes", () => {
  it("refuses a 17 KB shift edit with 413", async () => {
    const res = await call(patchShift, {
      method: "PATCH",
      path: "/api/shifts/1",
      params: { id: "1" },
      body: { version: 1, notes: "x".repeat(17 * 1024) },
    });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("payload_too_large");
  });
});

describe("rate limits", () => {
  beforeAll(() => {
    process.env.RATE_LIMIT = "on";
    process.env.RATE_LIMIT_PREFIX = `rl-test:${randomUUID()}`;
    process.env.RATE_LIMIT_WRITES_PER_MIN = "2";
    process.env.RATE_LIMIT_SESSIONS_PER_MIN = "2";
  });
  afterEach(() => vi.mocked(console.warn).mockClear());
  afterAll(() => {
    process.env.RATE_LIMIT = "off";
    delete process.env.RATE_LIMIT_PREFIX;
    delete process.env.RATE_LIMIT_WRITES_PER_MIN;
    delete process.env.RATE_LIMIT_SESSIONS_PER_MIN;
  });

  it("gives a session 429 rate_limited with Retry-After once it's over the write limit", async () => {
    const cookie = sessionCookieHeader(manager);
    // An invalid body fails validation (422) after the limiter counts it, so nothing is written.
    const edit = () => call(patchShift, { method: "PATCH", path: "/api/shifts/1", params: { id: "1" }, body: {}, session: null, headers: { cookie } });

    expect((await edit()).status).toBe(422);
    expect((await edit()).status).toBe(422);
    const limited = await edit();
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("rate_limited");
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);

    // Another session has its own bucket.
    const other = await call(patchShift, { method: "PATCH", path: "/api/shifts/1", params: { id: "1" }, body: {} });
    expect(other.status).toBe(422);
  });

  it("limits POST /api/session per IP, whatever the cookie", async () => {
    const headers = { "x-forwarded-for": "203.0.113.7" };
    const signIn = () => call(postSession, { method: "POST", path: "/api/session", body: { role: "manager" }, headers });

    expect((await signIn()).status).toBe(200);
    expect((await signIn()).status).toBe(200);
    expect((await signIn()).status).toBe(429);

    // A different IP is unaffected.
    const elsewhere = await call(postSession, { method: "POST", path: "/api/session", body: { role: "manager" }, headers: { "x-forwarded-for": "198.51.100.4" } });
    expect(elsewhere.status).toBe(200);
  });
});
