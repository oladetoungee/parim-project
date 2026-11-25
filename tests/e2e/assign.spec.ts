import { expect, test, type Page } from "@playwright/test";
import { checkAssignment } from "@/lib/rules";
import type { Board, StaffListItem } from "@/server/db/queries";

async function signInAs(page: Page, role: "manager" | "worker") {
  // The first page load gets a session cookie from src/proxy.ts; this picks the role.
  await page.goto("/");
  const response = await page.request.post("/api/session", { data: { role } });
  expect(response.ok()).toBe(true);
}

test("a manager assigns someone by keyboard, sees the count go up, then undoes it", async ({ page }) => {
  await signInAs(page, "manager");
  const board: Board = await (await page.request.get("/api/events/1/board")).json();
  const { items: staff }: { items: StaffListItem[] } = await (await page.request.get("/api/staff?eventId=1&limit=200")).json();

  // An open shift and someone the rules allow on it with no warnings.
  const target = board.shifts.find((s) => s.filled < s.slots && !s.requiresSia)!;
  const person = staff.find(
    (p) =>
      checkAssignment({ shift: target, staff: p, booked: p.booked, timezone: board.event.timezone }).length === 0 &&
      !target.assigned.some((a) => a.staffId === p.id),
  )!;
  expect(target, "the seed has an open shift").toBeTruthy();
  expect(person, "someone can take it").toBeTruthy();

  await page.goto("/board");
  // Narrow the board to that one shift, so one arrow press lands on it.
  await page.getByLabel("Location").selectOption(String(target.locationId));
  await page.getByLabel("Only short shifts").check();
  await page.getByLabel("Role", { exact: true }).selectOption(String(target.roleId));

  const card = page.locator(`button[data-shift-id="${target.id}"]`);
  await expect(card).toHaveAccessibleName(new RegExp(`${target.filled} of ${target.slots} filled`));

  await page.getByRole("searchbox", { name: "Search staff by name" }).fill(person.name);
  const row = page.getByRole("button", { name: new RegExp(`^${person.name},`) });
  await row.focus();
  // dnd-kit's live region narrates each step; waiting on it also gives the
  // keyboard sensor time to attach its listeners after the pick-up.
  const live = page.locator('[id^="DndLiveRegion"]');
  await page.keyboard.press("Space");
  await expect(live).toContainText(`${person.name}, ${target.roleName}.`);
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowRight");
  await expect(live).toContainText(`Over ${target.locationName} ${target.startTime} to ${target.endTime}, ${target.filled} of ${target.slots} filled. Press Space to assign.`);
  await page.keyboard.press("Space");
  await expect(live).toContainText(`Assigning ${person.name} to ${target.locationName}`);

  await expect(card).toHaveAccessibleName(new RegExp(`${target.filled + 1} of ${target.slots} filled`));
  await expect(page.getByText(`${person.name} assigned`, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(card).toHaveAccessibleName(new RegExp(`${target.filled} of ${target.slots} filled`));
  await expect(page.getByText("Undone", { exact: true })).toBeVisible();
});
