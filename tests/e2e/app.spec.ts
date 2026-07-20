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

  const module = page.locator('.react-flow__node[data-id="annuity-plan"] .money-map-module');
  const stationary = page.locator('.react-flow__node[data-id="annuity-source"] .money-map-module');
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
  const original = "$109,000";
  await module.getByText(original).dblclick();
  const value = page.getByRole("textbox", { name: "Edit FMV value" });
  await value.fill("$20,000\u2013?");
  await value.press("Escape");
  await expect(module.getByText(original)).toBeVisible();

  await module.getByText(original).dblclick();
  await page.getByRole("textbox", { name: "Edit FMV value" }).fill("$20,000\u2013?");
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

test("uses palette duplicate, keyboard remove, undo, compact tabs, and Draw flow", async ({
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
  await page.getByRole("button", { name: "More properties" }).click();
  await expect(page.getByRole("tab", { name: "Content" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Appearance" }).click();
  await expect(page.getByRole("tab", { name: "Connections" })).toHaveCount(0);
  await page.getByRole("button", { name: "Close properties" }).click();
  await page.getByRole("button", { name: "Draw flow" }).click();
  await expect(page.getByRole("complementary", { name: "Draw flow" })).toBeVisible();
  await page.getByRole("button", { name: /Core lifestyle/ }).click();
  const relationshipLabel = page.getByRole("textbox", { name: "Edit relationship label" });
  await relationshipLabel.fill("Advisor-authored relationship — exact");
  await relationshipLabel.press("Enter");
  await expect(
    page.locator(".money-map-flow-label").filter({ hasText: /Advisor-authored relationship/ }),
  ).toBeFocused();
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
  await page.getByRole("button", { name: /planned relationship from annuity-source/i }).click();
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(1);
  await module.click({ modifiers: ["Shift"] });
  await expect(page.getByRole("toolbar", { name: "2 selected items" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Edit module" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Duplicate selection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove selection" })).toBeVisible();

  await modules.nth(2).click({ modifiers: ["Shift"] });
  await expect(page.getByRole("toolbar", { name: "3 selected items" })).toBeVisible();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.locator('[data-flow-label-id="annuity-plan-contract"]')).toHaveCount(0);
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "2 selected items" })).toBeVisible();

  await page.getByRole("button", { name: "All", exact: true }).click();
  const fundingFlowLabel = page.getByRole("button", {
    name: /planned relationship from annuity-source/i,
  });
  await fundingFlowLabel.click();
  await page.getByRole("textbox", { name: "Edit relationship label" }).press("Escape");
  await expect(fundingFlowLabel).toBeFocused();
  await page.keyboard.press("Escape");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: /selected items/ })).toHaveCount(0);
});

test("keeps properties fresh and makes Draw flow, style, and properties exclusive", async ({
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

  await page.getByRole("button", { name: "Draw flow" }).click();
  await expect(page.getByRole("complementary", { name: "Draw flow" })).toBeVisible();
  await expect(page.getByLabel("Advanced properties")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Connections" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel draw flow" }).click();

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

test("routes Backspace through canonical removal from canvas and global handlers", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Retirement Income/i }).click();

  const socialSecurity = page.locator(".money-map-module").filter({ hasText: "Social Security" });
  const canvas = page.getByLabel("Retirement Income authoring canvas");

  await socialSecurity.click();
  await canvas.focus();
  await page.keyboard.press("Backspace");
  await expect(socialSecurity).toHaveCount(0);

  await page.keyboard.press("Control+z");
  await expect(socialSecurity).toHaveCount(1);
  await socialSecurity.click();
  await expect(socialSecurity).toHaveAttribute("data-selected", "true");
  await page.evaluate(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
    );
  });
  await expect(socialSecurity).toHaveCount(0);
});

test("invalid selections close editing surfaces and later singles do not reopen them", async ({
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
  await page.locator(".react-flow__pane").click({ force: true, position: { x: 8, y: 8 } });
  await expect(page.getByLabel("Advanced properties")).toHaveCount(0);
  await source.click();
  await expect(page.getByLabel("Advanced properties")).toHaveCount(0);

  await page.getByRole("button", { name: "More properties" }).click();
  await page.getByRole("button", { name: /income relationship from annuity-policy/i }).click();
  await expect(page.getByLabel("Advanced properties")).toHaveCount(0);
  await annuity.click({ modifiers: ["Shift"] });
  await expect(page.getByRole("toolbar", { name: "2 selected items" })).toBeVisible();
  await source.click();
  await expect(page.getByLabel("Advanced properties")).toHaveCount(0);

  await page.getByRole("button", { name: "Style module" }).click();
  await annuity.click({ modifiers: ["Shift"] });
  await expect(page.getByLabel("Choose module style")).toHaveCount(0);
  await source.click();
  await expect(page.getByLabel("Choose module style")).toHaveCount(0);
});
test("edits exact relationship text and appearance with undo and redo", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  const labelWrap = page.locator('[data-flow-label-id="annuity-plan-contract"]');
  const originalPath = await page
    .locator('.react-flow__edge[data-id="annuity-plan-contract"] .money-map-relationship-path')
    .getAttribute("d");
  await labelWrap.getByRole("button").click();
  const labelInput = page.getByRole("textbox", { name: "Edit relationship label" });
  const literal = "$20,000\u2013? \u2014 advisor-authored";
  await labelInput.fill(literal);
  await labelInput.press("Enter");
  await expect(labelWrap).toContainText(literal);

  const executeAction = async (query: string, option: string) => {
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: "Search actions" }).fill(query);
    await page.getByRole("option", { name: option, exact: true }).click();
  };

  await executeAction("curved route", "Curved route");
  await executeAction("replenishment relationship", "Replenishment relationship");
  await executeAction("filled label", "Filled label");

  const path = page.locator(
    '.react-flow__edge[data-id="annuity-plan-contract"] .money-map-relationship-path',
  );
  await expect(path).toHaveClass(/relationship--replenishment/);
  await expect(path).not.toHaveAttribute("d", originalPath ?? "");
  await expect(labelWrap).toHaveAttribute("data-treatment", "filled");

  await page.keyboard.press("Control+z");
  await expect(labelWrap).toHaveAttribute("data-treatment", "plate");
  await page.keyboard.press("Control+Shift+z");
  await expect(labelWrap).toHaveAttribute("data-treatment", "filled");
  await expect(page.locator(".money-map-module").filter({ hasText: "$250,000" })).toHaveCount(1);
  await page.evaluate(() => localStorage.clear());
});

test("routes a relationship label by pointer and keyboard, then resets and undoes", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  const labelWrap = page.locator('[data-flow-label-id="annuity-contract-need"]');
  const label = labelWrap.getByRole("button");
  const initialTransform = await labelWrap.getAttribute("style");
  const bounds = await label.boundingBox();
  if (!bounds) throw new Error("Expected relationship label bounds");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 72, bounds.y + bounds.height / 2 + 40);
  await page.mouse.up();

  await expect(page.getByRole("textbox", { name: "Edit relationship label" })).toHaveCount(0);
  const draggedTransform = await labelWrap.getAttribute("style");
  expect(draggedTransform).not.toBe(initialTransform);

  await label.focus();
  await label.press("Shift+ArrowRight");
  const nudgedTransform = await labelWrap.getAttribute("style");
  expect(nudgedTransform).not.toBe(draggedTransform);

  await page.getByRole("button", { name: /Actions/ }).click();
  await page.getByRole("combobox", { name: "Search actions" }).fill("reset label position");
  await page.getByRole("option", { name: "Reset label position", exact: true }).click();
  await expect.poll(() => labelWrap.getAttribute("style")).not.toBe(nudgedTransform);
  await page.keyboard.press("Control+z");
  await expect(labelWrap).toHaveAttribute("style", nudgedTransform ?? "");
  await page.evaluate(() => localStorage.clear());
});

test("reconnects by keyboard and persists exact custom cadence across filters and reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  const labelWrap = page.locator('[data-flow-label-id="annuity-contract-need"]');
  const labelButton = labelWrap.getByRole("button");
  await labelButton.click();
  await page.getByRole("textbox", { name: "Edit relationship label" }).press("Escape");
  await expect(labelButton).toBeFocused();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("relationship properties");
  await page.getByRole("option", { name: "Relationship properties", exact: true }).click();

  const properties = page.getByLabel("Relationship properties");
  await expect(properties).toBeVisible();
  await properties.getByRole("combobox", { name: "Source module" }).selectOption("annuity-source");
  await properties.getByRole("button", { name: "Custom cadence", exact: true }).click();
  const cadence = "Beginning in 2027 \u2014 after the sale closes";
  const customCadence = properties.getByRole("textbox", { name: "Custom cadence" });
  await customCadence.fill(cadence);
  await customCadence.press("Enter");
  await expect(labelWrap).toContainText(cadence);

  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(labelWrap).toHaveCount(0);
  await expect(properties).toHaveCount(0);
  await page.getByRole("button", { name: "Other", exact: true }).click();
  await expect(labelWrap).toContainText(cadence);

  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  const restored = page.locator('[data-flow-label-id="annuity-contract-need"]');
  await expect(restored).toContainText(cadence);
  await expect(restored.getByRole("button")).toHaveAccessibleName(
    /relationship from annuity-source to annuity-need/,
  );
  await page.evaluate(() => localStorage.clear());
});

test("clears a cadence-hidden relationship after command and redo", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  const labelWrap = page.locator('[data-flow-label-id="annuity-income-need"]');
  let labelButton = labelWrap.getByRole("button");
  await labelButton.click();
  await page.getByRole("textbox", { name: "Edit relationship label" }).press("Escape");
  await expect(labelButton).toBeFocused();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("relationship properties");
  await page.getByRole("option", { name: "Relationship properties", exact: true }).click();
  const properties = page.getByLabel("Relationship properties");
  await properties.getByRole("button", { name: "Annual cadence", exact: true }).click();

  await expect(labelWrap).toHaveCount(0);
  await expect(properties).toHaveCount(0);
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(0);

  await page.keyboard.press("Control+z");
  await expect(labelWrap).toBeVisible();
  labelButton = labelWrap.getByRole("button");
  await labelButton.click();
  await page.getByRole("textbox", { name: "Edit relationship label" }).press("Escape");
  await expect(labelButton).toBeFocused();
  await page.keyboard.press("Control+Shift+z");

  await expect(labelWrap).toHaveCount(0);
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(0);
  await page.evaluate(() => localStorage.clear());
});

test("reconnects both relationship endpoints by pointer", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  let relationshipLabel = page.getByRole("button", {
    name: /planned relationship from annuity-source to annuity-plan/i,
  });
  await relationshipLabel.click();
  await page.getByRole("textbox", { name: "Edit relationship label" }).press("Escape");
  await page.getByRole("button", { name: /Actions/ }).click();
  await page.getByRole("combobox", { name: "Search actions" }).fill("relationship properties");
  await page.getByRole("option", { name: "Relationship properties", exact: true }).click();
  const properties = page.getByLabel("Relationship properties");
  await properties.getByRole("combobox", { name: "Target module" }).selectOption("annuity-policy");
  await properties.getByRole("button", { name: "Close" }).click();
  relationshipLabel = page.getByRole("button", {
    name: /planned relationship from annuity-source to annuity-policy/i,
  });
  await expect(relationshipLabel).toBeFocused();

  const dragCenterToCenter = async (from: Locator, to: Locator) => {
    const fromBox = await from.boundingBox();
    const toBox = await to.boundingBox();
    if (!fromBox || !toBox) throw new Error("Expected reconnect endpoint bounds");
    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
  };

  await dragCenterToCenter(
    page.locator(".react-flow__edgeupdater-target"),
    page.locator('.react-flow__node[data-id="annuity-need"] .react-flow__handle-left.source'),
  );
  const targetReconnected = page.getByRole("button", {
    name: /planned relationship from annuity-source to annuity-need/i,
  });
  await expect(targetReconnected).toBeVisible();

  await dragCenterToCenter(
    page.locator(".react-flow__edgeupdater-source"),
    page.locator('.react-flow__node[data-id="annuity-policy"] .react-flow__handle-right.source'),
  );
  await expect(
    page.getByRole("button", {
      name: /planned relationship from annuity-policy to annuity-need/i,
    }),
  ).toBeVisible();
  await page.evaluate(() => localStorage.clear());
});
