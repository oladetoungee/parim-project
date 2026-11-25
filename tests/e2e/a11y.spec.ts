import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5) }));
}

for (const role of ["manager", "worker"] as const) {
  test(`/board as ${role} has no axe violations`, async ({ page }) => {
    await page.goto("/");
    await page.request.post("/api/session", { data: { role } });
    await page.goto("/board");
    await expect(page.getByText("shifts covered", { exact: true })).toBeVisible();
    if (role === "manager") await expect(page.getByRole("list", { name: "Staff" })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
}

for (const path of ["/", "/system", "/decisions"]) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
}
