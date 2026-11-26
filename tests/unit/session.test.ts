import { beforeAll, describe, expect, it } from "vitest";
import { decodeSession, encodeSession, getSession, requireManager, sessionIdOf, sessionSetCookie } from "@/server/session";

beforeAll(() => {
  process.env.SESSION_SECRET = "unit-test-secret-at-least-16";
});

function requestWith(cookie?: string) {
  return new Request("http://localhost/api/x", { headers: cookie ? { cookie } : {} });
}

describe("session cookie", () => {
  it("round trips a worker session", () => {
    expect(decodeSession(encodeSession({ role: "worker", staffId: 12 }))).toEqual({ role: "worker", staffId: 12 });
  });

  it("rejects a tampered payload", () => {
    const [, signature] = encodeSession({ role: "worker", staffId: 12 }).split(".");
    const forged = Buffer.from(JSON.stringify({ role: "manager" })).toString("base64url");
    expect(decodeSession(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects a cookie signed with another secret", () => {
    const token = encodeSession({ role: "manager" });
    process.env.SESSION_SECRET = "a-different-secret-entirely";
    expect(decodeSession(token)).toBeNull();
    process.env.SESSION_SECRET = "unit-test-secret-at-least-16";
  });

  it("refuses a request with no cookie, and a bad cookie, with 401", () => {
    expect(() => getSession(requestWith())).toThrowError(expect.objectContaining({ status: 401, code: "no_session" }));
    expect(() => getSession(requestWith("parimshift_session=nope"))).toThrowError(expect.objectContaining({ status: 401, code: "invalid_session" }));
  });

  it("gives workers 403 on manager routes", () => {
    const cookie = `parimshift_session=${encodeSession({ role: "worker", staffId: 3 })}`;
    expect(() => requireManager(requestWith(cookie))).toThrowError(expect.objectContaining({ status: 403, code: "forbidden" }));
  });

  it("sets HttpOnly, SameSite=Lax, Path=/ and an 8 hour Max-Age", () => {
    const cookie = sessionSetCookie({ role: "manager" });
    expect(cookie).toMatch(/; Path=\/; HttpOnly; SameSite=Lax; Max-Age=28800/);
  });

  it("gives each session its own id for rate limiting, and only trusts a signed one", () => {
    const a = sessionIdOf(requestWith(`parimshift_session=${encodeSession({ role: "manager" })}`));
    const b = sessionIdOf(requestWith(`parimshift_session=${encodeSession({ role: "manager" })}`));
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);

    const forged = Buffer.from(JSON.stringify({ role: "manager", sid: "chosen" })).toString("base64url");
    expect(sessionIdOf(requestWith(`parimshift_session=${forged}.bad`))).toBeNull();
  });
});
