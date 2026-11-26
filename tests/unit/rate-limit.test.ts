import { afterAll, beforeAll, expect, it, vi } from "vitest";

// A real client pointed at a closed port, as if Upstash were down.
vi.mock("@/lib/redis", async () => {
  const { Redis } = await import("@upstash/redis");
  return { redis: new Redis({ url: "http://127.0.0.1:9", token: "unused", retry: false }) };
});

const { enforceRateLimit } = await import("@/server/rate-limit");

beforeAll(() => {
  process.env.SESSION_SECRET = "unit-test-secret-at-least-16";
  delete process.env.RATE_LIMIT;
});
afterAll(() => vi.restoreAllMocks());

it("lets the request through when Redis is down, and logs that it did", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(enforceRateLimit(new Request("http://localhost/api/x", { method: "POST" }), "write")).resolves.toBeUndefined();
  expect(JSON.parse(error.mock.calls[0][0] as string)).toEqual({
    level: "error",
    event: "rate_limit_unavailable",
    kind: "write",
    cause: "TypeError",
  });
});
