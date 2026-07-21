import { expect, test, type Locator, type Page } from "@playwright/test";

import { settledCanvasCamera } from "./cameraHelpers";

const stories = [
  "Retirement Income",
  "RMD & Withholding",
  "Annuity Income Floor",
  "Roth Conversion",
] as const;
const starterCadence = {
  "Retirement Income": "All",
  "RMD & Withholding": "Annual",
  "Annuity Income Floor": "All",
  "Roth Conversion": "All",
} as const;

async function readPercentage(readout: Locator): Promise<number> {
  const text = await readout.textContent();
  if (!text) throw new Error("Expected camera percentage text");
  return Number(text.replace("%", ""));
}

async function showAllRelationships(page: Page): Promise<void> {
  const all = page.getByRole("button", { name: "All", exact: true });
  await all.click();
  await expect(all).toHaveAttribute("aria-pressed", "true");
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
    await expect(
      page.getByRole("button", { name: starterCadence[story], exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
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
  await readout.click();
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
  await page.getByRole("button", { name: "Fit story" }).click();
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

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("fit");
  await expect(page.getByRole("option", { name: "Fit story", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Fit selection", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Search actions" }).fill("100%");
  await expect(page.getByRole("option", { name: "Reset zoom to 100%", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
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
  const literal = "$300,000 — revised illustration";
  await expect(module.getByText(literal)).toBeVisible();

  // The starter enters through an animated fitView. Dragging before it lands
  // was the entire defect in this test: zoom fell 0.938 -> 0.790 and the pane
  // panned 23px DURING the drag, so a screen-space measurement was being taken
  // against a moving camera and could not be made to add up (it landed 53-68px
  // of an intended 120px, ~1 run in 3). Wait for the camera, then measure in
  // world units, which are what React Flow actually stores and are immune to
  // any later zoom or pan.
  const camera = await settledCanvasCamera(page);
  const worldOf = (id: string) =>
    page.evaluate((nodeId) => {
      const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`);
      if (!node) throw new Error(`Expected node ${nodeId}`);
      const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      return { x: matrix.e, y: matrix.f };
    }, id);

  const stationaryBefore = await worldOf("annuity-source");
  const box = (await module.boundingBox())!;
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // React Flow measures a drag from where its own drag threshold was crossed,
  // not from pointerdown, so the movement that engages the drag is consumed
  // and never reaches the node. Baseline AFTER engaging and the assertion
  // stops depending on the threshold's size entirely.
  await page.mouse.move(startX + 24, startY + 16);
  const engaged = await worldOf("annuity-plan");
  const travel = { x: 96, y: 64 };
  await page.mouse.move(startX + 24 + travel.x, startY + 16 + travel.y, { steps: 10 });
  await page.mouse.up();

  const after = await worldOf("annuity-plan");
  const stationaryAfter = await worldOf("annuity-source");

  // Screen travel converts to world travel by the (now settled) zoom, so this
  // asserts the node tracked the pointer exactly — a real equality, not a
  // "moved further than some floor" proxy that a partial drag could satisfy.
  expect(after.x - engaged.x).toBeCloseTo(travel.x / camera.zoom, 0);
  expect(after.y - engaged.y).toBeCloseTo(travel.y / camera.zoom, 0);
  // Dragging one node must not carry its neighbour, and a pan cannot fake it:
  // world coordinates do not move when the camera does.
  expect(stationaryAfter).toEqual(stationaryBefore);
  await expect(module.getByText(literal)).toBeVisible();
});

test("edits a title through one halo and preserves exact undo and redo", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  const module = page.locator(".money-map-module").filter({ hasText: "Illustrative annuity" });
  await module.click();
  await expect(page.getByRole("toolbar", { name: "Selected shape actions" })).toHaveCount(1);
  await page.getByRole("button", { name: "Edit shape", exact: true }).click();
  const title = page.getByRole("textbox", { name: "Edit shape title" });
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
  await page.getByRole("button", { name: "Style shape" }).click();
  await page.getByRole("button", { name: "Frame", exact: true }).click();
  await expect(module).toHaveAttribute("data-primitive", "frame");

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("ledger");
  await page.getByRole("option", { name: "Ledger", exact: true }).click();
  await expect(module).toHaveAttribute("data-primitive", "ledger");

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("standard width");
  await page.getByRole("option", { name: /Standard width/ }).click();
  await expect
    .poll(() => module.evaluate((element) => element.parentElement?.clientWidth))
    .toBe(320);
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
  // The picker path lands as a resting pill too; renaming is a double-click.
  const newPill = page.locator("button.money-map-flow-label").filter({ hasText: /New transfer/ });
  await expect(newPill).toBeVisible();
  await newPill.dblclick();
  const relationshipLabel = page.getByRole("textbox", { name: "Edit relationship label" });
  await relationshipLabel.fill("Advisor-authored relationship — exact");
  await relationshipLabel.press("Enter");
  await expect(
    page.locator(".money-map-flow-label").filter({ hasText: /Advisor-authored relationship/ }),
  ).toBeFocused();
});

test("opens Add to map from the command palette without a keyboard trap, and Escape closes it", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Retirement Income/i }).click();

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("add to map");
  await page.getByRole("option", { name: "Add to map", exact: true }).click();

  const menu = page.getByLabel("Add to money map");
  await expect(menu).toBeVisible();
  // The command palette's own focus-restore must not fight the surface the
  // command itself just opened: focus has to land, and stay, inside the menu
  // so its own Escape and arrow-key handling actually receives keys.
  await expect(page.getByRole("button", { name: /^Ledger/ })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("adds one purposeful shape with carried style and immediate literal title editing", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Retirement Income/i }).click();

  const account = page.locator(".money-map-module").filter({ hasText: "Joint After-Tax Account" });
  await account.click();
  await page.getByRole("button", { name: "Style shape" }).click();
  await page.getByRole("button", { name: "Spotlight priority" }).click();
  await page.getByRole("button", { name: "Accent color" }).click();
  await page.getByRole("button", { name: "Close properties" }).click();

  await page.getByRole("button", { name: "+ Add" }).click();
  await expect(page.getByLabel("Add to money map")).toBeVisible();
  await page.getByRole("button", { name: /^Plate/ }).click();
  const title = page.getByRole("textbox", { name: "Edit shape title" });
  await expect(title).toBeFocused();
  await title.fill("Advisor-owned account — exact");
  await title.press("Enter");

  const created = page.locator(".money-map-module").filter({
    hasText: "Advisor-owned account — exact",
  });
  // A new object is always visible with its title editor on screen — never
  // placed off-camera with nothing to reveal it.
  await expect(created).toBeInViewport();
  await expect(created).toHaveAttribute("data-primitive", "plate");
  await expect(created).toHaveAttribute("data-priority", "spotlight");
  await expect(created).toHaveAttribute("data-swatch", "accent");
  await page.getByRole("button", { name: "Style shape" }).click();
  await page.getByRole("button", { name: "Full detail" }).click();
  await page.getByRole("button", { name: "Close properties" }).click();
  await expect(created).toHaveAttribute("data-density", "full");
  const noClip = await created.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return [...element.children]
      .filter((child) => !child.classList.contains("money-map-handle"))
      .every((child) => {
        const content = child.getBoundingClientRect();
        return (
          content.top >= bounds.top - 1 &&
          content.right <= bounds.right + 1 &&
          content.bottom <= bounds.bottom + 1 &&
          content.left >= bounds.left - 1
        );
      });
  });
  expect(noClip).toBe(true);
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect(created).toHaveCount(0);
});

test("quick-creates a connected object by dropping a card on empty canvas", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  // Connect mode drags from the card itself. The side handles are edge anchors
  // now, not connection sources.
  await page.getByRole("button", { name: "Connect" }).click();
  const source = page.locator(".money-map-module").filter({ hasText: "Investment account" });
  const handleBox = await source.boundingBox();
  const paneBox = await page.locator(".react-flow__pane").boundingBox();
  if (!handleBox || !paneBox) throw new Error("Expected quick-create geometry");
  const drop = { x: paneBox.x + paneBox.width * 0.56, y: paneBox.y + paneBox.height * 0.83 };
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(drop.x, drop.y, { steps: 8 });
  await page.mouse.up();

  const title = page.getByRole("textbox", { name: "Edit shape title" });
  await expect(title).toBeFocused();
  await title.fill("Connected advisor account");
  await title.press("Enter");
  const created = page
    .locator(".money-map-module")
    .filter({ hasText: "Connected advisor account" });
  await expect(created).toHaveAttribute("data-primitive", "plate");
  await page.keyboard.press("Control+z");
  await expect(created).toHaveCount(0);
});

test("draws a relationship by dragging one card onto another in Connect mode", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  await page.getByRole("button", { name: "Connect" }).click();
  const source = page.locator('.react-flow__node[data-id="annuity-source"] .money-map-module');
  const target = page.locator('.react-flow__node[data-id="annuity-policy"] .money-map-module');
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Expected source and target card geometry");

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 12,
  });
  await page.mouse.up();

  // A drawn relationship lands as its resting pill, selected — no editor
  // erupts. Renaming is the same double-click every other edit uses.
  const restingLabel = page.getByRole("button", {
    name: /relationship from annuity-source to annuity-policy/i,
  });
  await expect(restingLabel).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Edit relationship label" })).toHaveCount(0);
  await restingLabel.dblclick();
  const label = page.getByRole("textbox", { name: "Edit relationship label" });
  await expect(label).toBeFocused();
  await label.fill("Direct port relationship — exact");
  await label.press("Enter");
  await expect(
    page.getByRole("button", {
      name: /relationship from annuity-source to annuity-policy: Direct port relationship — exact/i,
    }),
  ).toBeFocused();
  await page.evaluate(() => localStorage.clear());
});

test("completes a dragged connection released over the middle of a card", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();

  // The drop point is a screen-space read of the target card, so the entry
  // camera must land before it means anything.
  await settledCanvasCamera(page);
  await page.getByRole("button", { name: "Connect" }).click();
  const source = page.locator('.react-flow__node[data-id="annuity-source"] .money-map-module');
  const target = page.locator('.react-flow__node[data-id="annuity-policy"] .money-map-module');
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Expected source and target card geometry");

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  // Release over the centre of the card body — nowhere near a side-midpoint
  // dot — which is where a user aiming "connect to this card" actually drops.
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 12,
  });
  await page.mouse.up();

  // A drawn relationship lands as its resting pill, selected — no editor
  // erupts. Renaming is the same double-click every other edit uses.
  const restingLabel = page.getByRole("button", {
    name: /relationship from annuity-source to annuity-policy/i,
  });
  await expect(restingLabel).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Edit relationship label" })).toHaveCount(0);
  await restingLabel.dblclick();
  const label = page.getByRole("textbox", { name: "Edit relationship label" });
  await expect(label).toBeFocused();
  await label.fill("Card-body drop relationship — exact");
  await label.press("Enter");
  await expect(
    page.getByRole("button", {
      name: /relationship from annuity-source to annuity-policy: Card-body drop relationship — exact/i,
    }),
  ).toBeFocused();
  await page.evaluate(() => localStorage.clear());
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
  await expect(source).toHaveAttribute("data-selected", "true");
  await page.keyboard.press("Enter");
  const title = page.getByRole("textbox", { name: "Edit shape title" });
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
  await expect(groupHalo.getByRole("button", { name: "Edit shape" })).toHaveCount(0);
  await expect(groupHalo.getByRole("button", { name: "Duplicate selection" })).toBeVisible();
  await expect(groupHalo.getByRole("button", { name: "Remove selection" })).toBeVisible();
  await groupHalo.getByRole("button", { name: "Duplicate selection" }).click();
  await expect(modules).toHaveCount(originalCount + 2);

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  await showAllRelationships(page);
  const module = page.locator(".money-map-module").nth(1);
  await page.getByRole("button", { name: /planned relationship from annuity-source/i }).click();
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(1);
  await module.click({ modifiers: ["Shift"] });
  await expect(page.getByRole("toolbar", { name: "2 selected items" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Edit shape" })).toHaveCount(0);
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
  await fundingFlowLabel.dblclick();
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

  await page.getByRole("button", { name: "Style shape" }).click();
  await expect(page.getByLabel("Advanced properties")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Appearance" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "Appearance" })).toBeFocused();

  await page.getByRole("tab", { name: "Content" }).click();
  await expect(page.getByLabel("Advanced properties")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Content" })).toHaveAttribute("aria-selected", "true");
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
  await showAllRelationships(page);

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

  await page.getByRole("button", { name: "Style shape" }).click();
  await annuity.click({ modifiers: ["Shift"] });
  await expect(page.getByLabel("Advanced properties")).toHaveCount(0);
  await source.click();
  await expect(page.getByLabel("Advanced properties")).toHaveCount(0);
});
test("edits exact relationship text and appearance with undo and redo", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  await showAllRelationships(page);

  const labelWrap = page.locator('[data-flow-label-id="annuity-plan-contract"]');
  const originalPath = await page
    .locator('.react-flow__edge[data-id="annuity-plan-contract"] .money-map-relationship-path')
    .getAttribute("d");
  await labelWrap.getByRole("button").dblclick();
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
  // Back to the authored treatment: annuity-plan-contract is a planned
  // relationship, and treatment now follows relationship type.
  await expect(labelWrap).toHaveAttribute("data-treatment", "plain");
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
  await showAllRelationships(page);

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
  await showAllRelationships(page);

  const labelWrap = page.locator('[data-flow-label-id="annuity-contract-need"]');
  const labelButton = labelWrap.getByRole("button");
  await labelButton.dblclick();
  await page.getByRole("textbox", { name: "Edit relationship label" }).press("Escape");
  await expect(labelButton).toBeFocused();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("relationship properties");
  await page.getByRole("option", { name: "Relationship properties", exact: true }).click();

  const properties = page.getByLabel("Relationship properties");
  await expect(properties).toBeVisible();
  await properties.getByRole("combobox", { name: "Source shape" }).selectOption("annuity-source");
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
  await page.getByRole("button", { name: "Other", exact: true }).click();
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
  await labelButton.dblclick();
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
  await labelButton.dblclick();
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
  await showAllRelationships(page);

  let relationshipLabel = page.getByRole("button", {
    name: /planned relationship from annuity-source to annuity-plan/i,
  });
  await relationshipLabel.dblclick();
  await page.getByRole("textbox", { name: "Edit relationship label" }).press("Escape");
  await page.getByRole("button", { name: /Actions/ }).click();
  await page.getByRole("combobox", { name: "Search actions" }).fill("relationship properties");
  await page.getByRole("option", { name: "Relationship properties", exact: true }).click();
  const properties = page.getByLabel("Relationship properties");
  await properties.getByRole("combobox", { name: "Target shape" }).selectOption("annuity-policy");
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

// positionEditorSurface clamps `top` against the height budget it is handed,
// and the two properties tabs declare different budgets (Content 250px,
// Appearance the 400px default). Switching tabs used to re-render the panel
// without re-placing it, so Appearance inherited Content's clamp and its
// bottom ran off the viewport for a module low in the canvas. The budgets are
// also declarations rather than measurements — Content renders 274px, not the
// 250px it declares — so both tabs are asserted against the real box.
test("properties surface stays on screen across tab switches for a low module", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Retirement Income/ }).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();

  const lowestModuleId = await page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>(".react-flow__node")].sort(
        (first, second) =>
          second.getBoundingClientRect().bottom - first.getBoundingClientRect().bottom,
      )[0]?.dataset.id,
  );
  expect(lowestModuleId).toBeTruthy();
  await page.locator(`.react-flow__node[data-id="${lowestModuleId}"]`).click();

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("more properties");
  await page.getByRole("option", { name: "More properties", exact: true }).click();

  const panel = page.locator(".advanced-properties");
  await expect(panel).toBeVisible();

  const bottomOf = async () => panel.evaluate((element) => element.getBoundingClientRect().bottom);

  expect(await bottomOf(), "Content tab hangs past the viewport").toBeLessThanOrEqual(720);
  await page.getByRole("tab", { name: "Appearance" }).click();
  await expect(page.getByRole("tab", { name: "Appearance" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(await bottomOf(), "Appearance tab hangs past the viewport").toBeLessThanOrEqual(720);
  await page.getByRole("tab", { name: "Content" }).click();
  expect(await bottomOf(), "Content tab hangs past the viewport on return").toBeLessThanOrEqual(
    720,
  );
  await page.evaluate(() => localStorage.clear());
});

// Every relationship used to occupy two consecutive tab stops — the route
// path and its label — announcing the identical sentence, so a screen-reader
// user could not tell which stop was which, and modules on this starter did
// not begin until stop 21 of a 32-stop cycle. The path is no longer focusable
// (adapters.ts): the label button is the relationship's keyboard surface and
// already handles select, Enter to edit, and arrow-key movement.
test("each relationship is one keyboard stop with a unique announcement", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Retirement Income/i }).click();
  await showAllRelationships(page);

  const flowCount = await page.locator(".money-map-flow-label-wrap").count();
  expect(flowCount).toBeGreaterThan(0);

  const focusableEdgePaths = await page
    .locator(".react-flow__edge")
    .evaluateAll((edges) => edges.filter((edge) => (edge as HTMLElement).tabIndex >= 0).length);
  expect(focusableEdgePaths, "route paths must not be tab stops").toBe(0);

  const labels: string[] = [];
  for (let step = 0; step < 40; step++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active?.classList.contains("money-map-flow-label")) return null;
      return active.getAttribute("aria-label");
    });
    if (focused) labels.push(focused);
    if (labels.length === flowCount) break;
  }

  expect(labels, "every relationship label should be reachable").toHaveLength(flowCount);
  expect(new Set(labels).size, "relationship announcements must be distinct").toBe(flowCount);
});

// Drawing a flow is the primary authoring action, so the first one a user
// creates sets their impression of the whole tool. Its label used to land on
// the centre-to-centre midpoint with no knowledge of what occupied that
// point — on a populated map, on top of a card — and the label opened in
// inline edit with its default text preselected, which swallowed Ctrl+Z, so
// reaching for undo at that exact moment did nothing at all.
test("a newly drawn flow places its label clear of cards and stays undoable", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Retirement Income/i }).click();
  await showAllRelationships(page);

  const labels = page.locator(".money-map-flow-label-wrap");
  const before = await labels.count();

  // Deliberately a long diagonal across the populated middle of the map:
  // the plain midpoint of this pair sits on another module.
  await page.locator('.react-flow__node[data-id="retirement-income"]').click();
  await page.getByRole("button", { name: "Draw flow" }).click();
  const picker = page.getByRole("complementary", { name: "Draw flow" });
  await expect(picker).toBeVisible();
  await picker
    .getByRole("button", { name: /Insurance|Irrevocable/ })
    .first()
    .click();
  await expect(labels).toHaveCount(before + 1);

  const covered = await page.evaluate(() => {
    const wraps = [...document.querySelectorAll<HTMLElement>(".money-map-flow-label-wrap")];
    const box = wraps[wraps.length - 1].getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>(".react-flow__node")].flatMap((node) => {
      const body = node.querySelector<HTMLElement>(".money-map-module");
      if (!body) return [];
      const bounds = body.getBoundingClientRect();
      const overlapWidth = Math.min(box.right, bounds.right) - Math.max(box.left, bounds.left);
      const overlapHeight = Math.min(box.bottom, bounds.bottom) - Math.max(box.top, bounds.top);
      // A graze at an attachment point is fine; sitting on a card is not.
      return overlapWidth > 8 && overlapHeight > 8 ? [node.dataset.id ?? "?"] : [];
    });
  });
  expect(covered, "new flow label sits on top of a module").toEqual([]);

  // Undo reaches the document even though the label opened in inline edit.
  await page.keyboard.press("Control+z");
  await expect(labels).toHaveCount(before);
  await page.evaluate(() => localStorage.clear());
});
