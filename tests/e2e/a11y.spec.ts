import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5) }));
}

// With no saved choice the theme follows the OS, so emulating the colour
// scheme is enough to render each page in dark.
for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
    });

    for (const role of ["manager", "worker"] as const) {
      test(`/board as ${role} has no axe violations`, async ({ page }) => {
        await signInAs(page, role);
        await page.goto("/board");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.getByText("shifts covered", { exact: true })).toBeVisible();
        if (role === "manager") await expect(page.getByRole("list", { name: "Staff" })).toBeVisible();
        expect(await axe(page)).toEqual([]);
      });
    }

    test("the shift drawer has no axe violations", async ({ page }) => {
      await signInAs(page, "manager");
      await page.goto("/board");
      await page.locator("button[data-shift-id]").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });

    for (const path of ["/", "/system", "/decisions"]) {
      test(`${path} has no axe violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator("h1")).toBeVisible();
        expect(await axe(page)).toEqual([]);
      });
    }
  });
}

test("the theme toggle overrides the OS and survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/decisions");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
});
