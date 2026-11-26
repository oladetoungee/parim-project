import { expect, type Page } from "@playwright/test";

/**
 * Picks a role. The first page load gets a session cookie from src/proxy.ts.
 * The API refuses writes without a same-origin Origin header, which a browser
 * adds itself but Playwright's request client doesn't.
 */
export async function signInAs(page: Page, role: "manager" | "worker") {
  await page.goto("/");
  const response = await page.request.post("/api/session", {
    data: { role },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(response.ok()).toBe(true);
}
