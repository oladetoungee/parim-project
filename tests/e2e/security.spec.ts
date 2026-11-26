import { expect, test } from "@playwright/test";

const expected = {
  "content-security-policy": /default-src 'self'.*frame-ancestors 'none'/,
  "strict-transport-security": /max-age=\d+/,
  "x-content-type-options": /^nosniff$/,
  "referrer-policy": /^strict-origin-when-cross-origin$/,
  "permissions-policy": /camera=\(\), microphone=\(\), geolocation=\(\)/,
  "cross-origin-opener-policy": /^same-origin$/,
};

for (const path of ["/", "/board", "/decisions", "/api/session"]) {
  test(`${path} sends the security headers`, async ({ request }) => {
    const response = await request.get(path);
    const headers = response.headers();
    for (const [name, pattern] of Object.entries(expected)) expect(headers[name], name).toMatch(pattern);
    expect(headers["x-powered-by"]).toBeUndefined();
    if (path.startsWith("/api/")) expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
}

test("the board loads under the CSP with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/board");
  await expect(page.getByText("shifts covered", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a cross-site write is refused with 403 bad_origin", async ({ page }) => {
  await page.goto("/");
  const response = await page.request.post("/api/session", {
    data: { role: "worker" },
    headers: { origin: "https://evil.example" },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("bad_origin");
});
