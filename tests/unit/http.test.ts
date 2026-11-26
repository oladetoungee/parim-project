import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MAX_BODY_BYTES, readJsonBody, REQUEST_ID_HEADER, route } from "@/server/http";

beforeAll(() => {
  process.env.RATE_LIMIT = "off";
  process.env.SESSION_SECRET = "unit-test-secret-at-least-16";
});

afterEach(() => vi.restoreAllMocks());

const echo = route(async (request) => Response.json((await readJsonBody(request)).value));

function post(path: string, init: { origin?: string | null; referer?: string; body?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.origin !== null) headers.origin = init.origin ?? "http://localhost";
  if (init.referer) headers.referer = init.referer;
  return new Request(`http://localhost${path}`, { method: "POST", headers, body: init.body ?? "{}" });
}

describe("route() origin check", () => {
  it("lets a same-origin write through", async () => {
    expect((await echo(post("/api/x"), {})).status).toBe(200);
  });

  it("refuses a write from another origin with 403 bad_origin", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await echo(post("/api/x", { origin: "https://evil.example" }), {});
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("bad_origin");
  });

  it("refuses a write with no Origin or Referer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await echo(post("/api/x", { origin: null }), {})).status).toBe(403);
  });

  it("falls back to Referer when Origin is missing", async () => {
    expect((await echo(post("/api/x", { origin: null, referer: "http://localhost/board" }), {})).status).toBe(200);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await echo(post("/api/x", { origin: null, referer: "https://evil.example/board" }), {})).status).toBe(403);
  });

  it("doesn't check reads", async () => {
    const read = route(async () => Response.json({ ok: true }));
    expect((await read(new Request("http://localhost/api/x"), {})).status).toBe(200);
  });
});

describe("route() body limit", () => {
  it("refuses a body over 16 KB with 413, even without Content-Length", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = JSON.stringify({ notes: "x".repeat(MAX_BODY_BYTES) });
    const response = await echo(post("/api/x", { body }), {});
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("payload_too_large");
  });

  it("accepts a body at the limit", async () => {
    const body = JSON.stringify({ notes: "x".repeat(MAX_BODY_BYTES - 20) });
    expect((await echo(post("/api/x", { body }), {})).status).toBe(200);
  });
});

describe("route() request ids and logs", () => {
  it("puts an X-Request-Id on every response", async () => {
    const response = await echo(post("/api/x"), {});
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("hides an unexpected error behind a generic 500 that carries the request id", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const crash = route(async () => {
      throw Object.assign(new Error("Duplicate entry 'ana.tamm@example.com' for key 'email'"), { code: "ER_DUP_ENTRY" });
    });

    const response = await crash(new Request("http://localhost/api/shifts/12"), {});
    const body = await response.json();
    const requestId = response.headers.get(REQUEST_ID_HEADER);

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: { code: "internal_error", message: "Something went wrong on our side. Try again.", details: { requestId } },
    });

    expect(error).toHaveBeenCalledTimes(1);
    const line = JSON.parse(error.mock.calls[0][0] as string);
    expect(line).toEqual({
      level: "error",
      requestId,
      route: "GET /api/shifts/:id",
      code: "internal_error",
      status: 500,
      ms: expect.any(Number),
      cause: "ER_DUP_ENTRY",
    });
    // The driver message quotes row values; it must not reach the log or the response.
    expect(JSON.stringify(line) + JSON.stringify(body)).not.toContain("example.com");
  });
});
