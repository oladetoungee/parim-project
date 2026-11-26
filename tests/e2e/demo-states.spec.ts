import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

async function pick(page: Page, label: string) {
  await page.getByRole("button", { name: /^Demo states/ }).click();
  await page.getByRole("menuitemradio", { name: new RegExp(`^${label}`) }).click();
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, "manager");
  await page.goto("/board");
  await expect(page.getByRole("heading", { name: "Shifts by location" })).toBeAttached();
});

test("Error loading keeps the board on screen, and Normal clears the error", async ({ page }) => {
  await pick(page, "Error loading");
  const banner = page.getByRole("alert").filter({ hasText: "Couldn't refresh the board" });
  await expect(banner).toBeVisible();
  await expect(page.locator("button[data-shift-id]").first()).toBeVisible();

  const refetch = page.waitForResponse((r) => r.url().endsWith("/api/events/1/board") && r.ok());
  await pick(page, "Normal");
  await refetch;
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Demo states", exact: true })).toBeVisible();
});

test("Slow network says so, and the board refetch waits 2 seconds", async ({ page }) => {
  await pick(page, "Slow network");
  await expect(page.getByRole("status").filter({ hasText: "Slow network: saves take 2 seconds." })).toBeVisible();

  // The real API flag, not a client-side timer.
  const started = Date.now();
  const response = await page.request.get("/api/events/1/board?latency=2000");
  expect(response.ok()).toBe(true);
  expect(Date.now() - started).toBeGreaterThanOrEqual(1900);

  await page.getByRole("button", { name: "Back to normal" }).click();
  await expect(page.getByText("Slow network: saves take 2 seconds.")).toHaveCount(0);
});

test("the menu works from the keyboard and checks the active state", async ({ page }) => {
  const trigger = page.getByRole("button", { name: /^Demo states/ });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const normal = page.getByRole("menuitemradio", { name: /^Normal/ });
  await expect(normal).toHaveAttribute("aria-checked", "true");
  await expect(normal).toBeFocused();
  // Normal, Loading, Empty event, Error loading, Slow network, Save fails.
  await page.keyboard.press("End");
  const saveFails = page.getByRole("menuitemradio", { name: /^Save fails/ });
  await expect(saveFails).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Saves will fail" })).toBeVisible();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(saveFails).toHaveAttribute("aria-checked", "true");
  // Focus opens on Normal, so leaving any state is Enter, Enter.
  await expect(normal).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Saves will fail" })).toHaveCount(0);
});
