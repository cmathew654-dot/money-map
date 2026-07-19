import { expect, test, type Locator } from "@playwright/test";

const stories = [
  "Retirement Income",
  "RMD & Withholding",
  "Annuity Income Floor",
  "Roth Conversion",
] as const;

async function readPercentage(readout: Locator): Promise<number> {
  const text = await readout.textContent();
  if (!text) throw new Error("Expected camera percentage text");
  return Number(text.replace("%", ""));
}

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

test("selects a module, clears with Escape, and proves every camera command", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Retirement Income/i }).click();

  const module = page.locator(".money-map-module").first();
  await module.click();
  await expect(module).toHaveAttribute("data-selected", "true");
  await page.keyboard.press("Escape");
  await expect(module).toHaveAttribute("data-selected", "false");

  const readout = page.getByRole("button", { name: "Reset zoom to 100%" });
  const viewport = page.locator(".react-flow__viewport");
  await expect(readout).toHaveText("100%");

  const initialPercentage = await readPercentage(readout);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => readPercentage(readout)).toBeGreaterThan(initialPercentage);
  const afterPlus = await readPercentage(readout);

  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(() => readPercentage(readout)).toBeLessThan(afterPlus);

  await page.getByRole("button", { name: "Zoom in" }).click();
  await readout.click();
  await expect(readout).toHaveText("100%");

  await page.keyboard.press("Control++");
  await expect.poll(() => readPercentage(readout)).toBeGreaterThan(100);
  await readout.click();
  await expect(readout).toHaveText("100%");

  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  const alteredMapTransform = await viewport.getAttribute("style");
  const alteredMapPercentage = await readPercentage(readout);
  await page.getByRole("button", { name: "Fit map" }).click();
  await expect.poll(() => viewport.getAttribute("style")).not.toBe(alteredMapTransform);
  await expect.poll(() => readPercentage(readout)).not.toBe(alteredMapPercentage);

  await module.click();
  const beforeFitSelectionTransform = await viewport.getAttribute("style");
  const beforeFitSelectionPercentage = await readPercentage(readout);
  await page.getByRole("button", { name: "Fit selection" }).click();
  await expect.poll(() => viewport.getAttribute("style")).not.toBe(beforeFitSelectionTransform);
  await expect.poll(() => readPercentage(readout)).not.toBe(beforeFitSelectionPercentage);

  await page.getByRole("button", { name: "Zoom out" }).click();
  const beforeShiftOne = await viewport.getAttribute("style");
  const beforeShiftOnePercentage = await readPercentage(readout);
  await page.keyboard.press("Shift+Digit1");
  await expect.poll(() => viewport.getAttribute("style")).not.toBe(beforeShiftOne);
  await expect.poll(() => readPercentage(readout)).not.toBe(beforeShiftOnePercentage);

  await page.getByRole("button", { name: "Zoom out" }).click();
  const beforeShiftTwo = await viewport.getAttribute("style");
  const beforeShiftTwoPercentage = await readPercentage(readout);
  await page.keyboard.press("Shift+Digit2");
  await expect.poll(() => viewport.getAttribute("style")).not.toBe(beforeShiftTwo);
  await expect.poll(() => readPercentage(readout)).not.toBe(beforeShiftTwoPercentage);
});

test("shows the honest minimum cover instead of mounting React Flow", async ({ page }) => {
  await page.setViewportSize({ width: 1179, height: 720 });
  await page.goto("/");
  await page.getByRole("button", { name: /Retirement Income/i }).click();

  await expect(page.getByRole("heading", { name: "A larger canvas is required" })).toBeVisible();
  await expect(page.locator(".react-flow")).toHaveCount(0);
});

test("drags one node relative to a stationary node without changing literal text", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  const module = page.locator(".money-map-module").filter({ hasText: "Illustrative annuity" });
  const stationary = page.locator(".money-map-module").filter({ hasText: "Investment account" });
  const literal = "$300,000 — revised illustration";
  await expect(module.getByText(literal)).toBeVisible();
  const before = await module.boundingBox();
  const stationaryBefore = await stationary.boundingBox();
  if (!before || !stationaryBefore) throw new Error("Expected module bounds before drag");

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 120, before.y + before.height / 2 + 80, {
    steps: 8,
  });
  await page.mouse.up();

  const after = await module.boundingBox();
  const stationaryAfter = await stationary.boundingBox();
  if (!after || !stationaryAfter) throw new Error("Expected module bounds after drag");
  const relativeX = after.x - before.x - (stationaryAfter.x - stationaryBefore.x);
  const relativeY = after.y - before.y - (stationaryAfter.y - stationaryBefore.y);
  expect(Math.abs(relativeX)).toBeGreaterThan(80);
  expect(Math.abs(relativeY)).toBeGreaterThan(50);
  await expect(module.getByText(literal)).toBeVisible();
});
