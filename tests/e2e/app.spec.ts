import { expect, test } from "@playwright/test";

const stories = [
  "Retirement Income",
  "RMD & Withholding",
  "Annuity Income Floor",
  "Roth Conversion",
] as const;

test("opens every starter from the equal-weight chooser", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Choose a story" })).toBeVisible();

  for (const story of stories) {
    await page.getByRole("button", { name: new RegExp(story) }).click();
    await expect(page.getByRole("heading", { name: story })).toBeVisible();
    await expect(page.getByText("As of July 2026")).toBeVisible();
    await expect(page.getByText("Synthetic demo · advisor-entered values")).toBeVisible();
    await expect(page.locator(".money-map-module").first()).toBeVisible();
    await expect(page.getByRole("toolbar", { name: "Canvas camera" })).toBeVisible();
    await page.getByRole("button", { name: "Back to stories" }).click();
  }
});

test("selects a module, clears with Escape, and operates the camera", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Retirement Income/i }).click();

  const module = page.locator(".money-map-module").first();
  await module.click();
  await expect(module).toHaveAttribute("data-selected", "true");
  await page.keyboard.press("Escape");
  await expect(module).toHaveAttribute("data-selected", "false");

  const readout = page.getByRole("button", { name: "Reset zoom to 100%" });
  await expect(readout).toContainText("100%");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(readout).not.toContainText("100%");
  await page.getByRole("button", { name: "Zoom out" }).click();
  await readout.click();
  await expect(readout).toContainText("100%");
  await page.keyboard.press("Control++");
  await expect(readout).not.toContainText("100%");
  await page.getByRole("button", { name: "Fit map" }).click();
});

test("shows the honest minimum cover instead of mounting React Flow", async ({ page }) => {
  await page.setViewportSize({ width: 1179, height: 720 });
  await page.goto("/");
  await page.getByRole("button", { name: /Retirement Income/i }).click();

  await expect(page.getByRole("heading", { name: "A larger canvas is required" })).toBeVisible();
  await expect(page.locator(".react-flow")).toHaveCount(0);
});

test("drags world geometry without changing displayed literal text", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  const module = page.locator(".money-map-module").filter({ hasText: "Illustrative annuity" });
  const literal = "$300,000 \u2014 revised illustration";
  await expect(module.getByText(literal)).toBeVisible();
  const before = await module.boundingBox();
  if (!before) throw new Error("Expected module bounds before drag");
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 120, before.y + before.height / 2 + 80, {
    steps: 8,
  });
  await page.mouse.up();
  const after = await module.boundingBox();
  if (!after) throw new Error("Expected module bounds after drag");
  expect(after.x).not.toBe(before.x);
  expect(after.y).not.toBe(before.y);
  await expect(module.getByText(literal)).toBeVisible();
});
