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
    await expect(page.getByText("Synthetic demo \u00b7 advisor-entered values")).toBeVisible();
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

test("edits a title through one halo and preserves exact undo and redo", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  const module = page.locator(".money-map-module").filter({ hasText: "Illustrative annuity" });
  await module.click();
  await expect(page.getByRole("toolbar", { name: "Selected module actions" })).toHaveCount(1);
  await page.getByRole("button", { name: "Edit module", exact: true }).click();
  const title = page.getByRole("textbox", { name: "Edit module title" });
  await title.fill("Income floor \u2014 exact");
  await title.press("Enter");
  await expect(page.getByRole("heading", { name: "Income floor \u2014 exact" })).toBeVisible();

  await page.keyboard.press("Control+z");
  await expect(page.getByRole("heading", { name: "Illustrative annuity" })).toBeVisible();
  await page.keyboard.press("Control+Shift+z");
  await expect(page.getByRole("heading", { name: "Income floor \u2014 exact" })).toBeVisible();
});

test("restores an escaped literal, commits blur, and styles and resizes through canonical actions", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  const module = page.locator(".money-map-module").filter({ hasText: "Illustrative annuity" });
  const original = "~$11,800/mo";
  await module.getByText(original).dblclick();
  const value = page.getByRole("textbox", { name: "Edit Monthly income value" });
  await value.fill("$20,000\u2013?");
  await value.press("Escape");
  await expect(module.getByText(original)).toBeVisible();

  await module.getByText(original).dblclick();
  await page.getByRole("textbox", { name: "Edit Monthly income value" }).fill("$20,000\u2013?");
  await page.locator(".workspace-header").click();
  await expect(module.getByText("$20,000\u2013?")).toBeVisible();

  await module.click();
  const fontSize = await module
    .locator("h2")
    .evaluate((element) => getComputedStyle(element).fontSize);
  await page.getByRole("button", { name: "Style module" }).click();
  await page.getByRole("button", { name: "Frame style" }).click();
  await expect(module).toHaveAttribute("data-primitive", "frame");

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("ledger style");
  await page.getByRole("option", { name: /Ledger style/ }).click();
  await expect(module).toHaveAttribute("data-primitive", "ledger");

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("standard width");
  await page.getByRole("option", { name: /Standard width/ }).click();
  await expect.poll(async () => (await module.boundingBox())?.width).toBeCloseTo(320, 0);
  await expect
    .poll(() => module.locator("h2").evaluate((element) => getComputedStyle(element).fontSize))
    .toBe(fontSize);
});

test("uses palette duplicate, keyboard remove, undo, and compact advanced tabs", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Retirement Income/i }).click();

  const original = page.locator(".money-map-module").filter({ hasText: "Social Security" });
  await original.click();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("duplicate");
  await page.getByRole("option", { name: /Duplicate selection/ }).click();
  await expect(
    page.locator(".money-map-module").filter({ hasText: "Social Security" }),
  ).toHaveCount(2);

  await page.keyboard.press("Delete");
  await expect(
    page.locator(".money-map-module").filter({ hasText: "Social Security" }),
  ).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(
    page.locator(".money-map-module").filter({ hasText: "Social Security" }),
  ).toHaveCount(2);

  const restored = original.last();
  await restored.click();
  const focusedNode = restored.locator("..");
  await page.getByRole("button", { name: "More properties" }).click();
  await expect(page.getByRole("tab", { name: "Content" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Appearance" }).click();
  await page.getByRole("tab", { name: "Connections" }).click();
  await page.getByRole("button", { name: "Add connection" }).click();
  await expect(page.getByText(/connection editing arrives in the next step/i)).toBeVisible();
  await page.getByRole("button", { name: "Close properties" }).click();
  await expect(focusedNode).toBeFocused();
});

test("persists committed edits only for one starter and Reset restores its scaffold", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Roth Conversion/i }).click();

  const source = page.locator(".money-map-module").filter({ hasText: "Traditional IRA" });
  await source.click();
  await page.keyboard.press("Enter");
  const title = page.getByRole("textbox", { name: "Edit module title" });
  await title.fill("Saved Roth literal");
  await title.press("Enter");
  await page.reload();
  await page.getByRole("button", { name: /Roth Conversion/i }).click();
  await expect(page.getByRole("heading", { name: "Saved Roth literal" })).toBeVisible();

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("combobox", { name: "Search actions" }).fill("reset");
  await page.getByRole("option", { name: /Reset story/ }).click();
  await expect(page.getByRole("heading", { name: "Traditional IRA" })).toBeVisible();

  await page.getByRole("button", { name: "Back to stories" }).click();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  await expect(page.getByRole("heading", { name: "Illustrative annuity" })).toBeVisible();
  await page.evaluate(() => localStorage.clear());
});

test("shows one actionable group halo for multi-module and mixed selections", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  const modules = page.locator(".money-map-module");
  const originalCount = await modules.count();
  await modules.nth(0).click();
  await modules.nth(1).click({ modifiers: ["Shift"] });

  const groupHalo = page.getByRole("toolbar", { name: "2 selected items" });
  await expect(groupHalo).toHaveCount(1);
  await expect(groupHalo.getByRole("button", { name: "Edit module" })).toHaveCount(0);
  await expect(groupHalo.getByRole("button", { name: "Duplicate selection" })).toBeVisible();
  await expect(groupHalo.getByRole("button", { name: "Remove selection" })).toBeVisible();
  await groupHalo.getByRole("button", { name: "Duplicate selection" }).click();
  await expect(modules).toHaveCount(originalCount + 2);

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  const module = page.locator(".money-map-module").nth(1);
  await page.locator(".react-flow__edge-interaction").first().click({ force: true });
  await page.keyboard.down("Shift");
  await module.click();
  await page.keyboard.up("Shift");
  await expect(page.getByRole("toolbar", { name: "2 selected items" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Edit module" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Duplicate selection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove selection" })).toBeVisible();
});

test("keeps properties fresh, switches Connect, and makes style and properties exclusive", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  const annuity = page.locator(".money-map-module").filter({ hasText: "Illustrative annuity" });
  const source = page.locator(".money-map-module").filter({ hasText: "Investment account" });
  await annuity.click();
  await page.getByRole("button", { name: "More properties" }).click();
  await expect(page.getByRole("tab", { name: "Content" })).toBeFocused();

  const title = page.getByRole("textbox", { name: "Title" });
  await title.fill("History title");
  await title.press("Enter");
  await page.getByRole("tab", { name: "Content" }).focus();
  await page.keyboard.press("Control+z");
  await expect(title).toHaveValue("Illustrative annuity");

  await title.fill("stale old module text");
  await source.click();
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Investment account");
  await expect(source.getByRole("heading", { name: "Investment account" })).toBeVisible();

  await page.getByRole("button", { name: "Connect module" }).click();
  await expect(page.getByRole("tab", { name: "Connections" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.getByRole("button", { name: "Style module" }).click();
  await expect(page.getByLabel("Advanced properties")).toHaveCount(0);
  await expect(page.getByLabel("Choose module style")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close", exact: true })).toBeFocused();

  await page.getByRole("button", { name: "More properties" }).click();
  await expect(page.getByLabel("Choose module style")).toHaveCount(0);
  await expect(page.getByLabel("Advanced properties")).toBeVisible();
  await page.getByRole("button", { name: "Close properties" }).click();
  await expect(source.locator("..")).toBeFocused();
});
