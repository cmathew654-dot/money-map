import { expect, test, type Locator } from "@playwright/test";

import { settledCanvasCamera } from "./cameraHelpers";

// The total row is a headline figure (20px, one authored string) stacked on
// its own single-column grid track under the label, a structural fix for a
// presentation defect where the value used to inflate without re-fitting the
// row: "Balance" printed under "$185,000" in the Hartwell Giving Fund card
// (closed at checkpoint 33d84d4). Regular property rows never carried this
// risk -- their two-column grid lets the label wrap to fit its own track
// instead of overflowing into the value's, so a row picked from that class
// can never go red here regardless of surface (confirmed by direct
// measurement: reverting the total row to a two-column grid and inflating its
// value reproduces a genuine ~10x12px ink overlap; the regular-row grid does
// not, at any font size, in either view). The total row's stacked layout is
// presentation-only paint, though the class itself is undifferentiated by
// mode, so this must run in presentation, the surface the historical defect
// and its fix both targeted. Measured as text ink via Range rects, not
// element boxes: the grid cells themselves never intersect, only the
// rendered text does.
test("the Hartwell Giving Fund total's label and value never share ink in presentation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Retirement Income/i }).click();
  await page.getByRole("button", { name: "Present" }).click();
  await settledCanvasCamera(page);

  const module = page.locator(".money-map-module").filter({ hasText: "Hartwell Giving Fund" });
  const row = module.locator(".money-map-module__total > div");
  await expect(row).toBeVisible();

  const measured = await row.evaluate((rowElement) => {
    const ink = (element: Element | null) => {
      if (!element) throw new Error("Expected row label and value elements");
      const range = document.createRange();
      range.selectNodeContents(element);
      const box = range.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    };
    const label = ink(rowElement.querySelector("dt"));
    const value = ink(rowElement.querySelector("dd"));
    return {
      label,
      value,
      overlapWidth: Math.min(label.right, value.right) - Math.max(label.left, value.left),
      overlapHeight: Math.min(label.bottom, value.bottom) - Math.max(label.top, value.top),
    };
  });

  const intersects = measured.overlapWidth > 0 && measured.overlapHeight > 0;
  expect(
    intersects,
    `label ink ${JSON.stringify(measured.label)} intersects value ink ` +
      `${JSON.stringify(measured.value)} by ${measured.overlapWidth.toFixed(1)}x` +
      `${measured.overlapHeight.toFixed(1)}px`,
  ).toBe(false);
});

// The selection toolbar is anchored to the selected module and centered on it,
// but the toolbar is wider than a card: for a module against the viewport's
// left edge the centered placement runs off-screen, hiding its first buttons.
test("the selection toolbar stays fully on the viewport for a module at the left edge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /RMD & Withholding/i }).click();
  await settledCanvasCamera(page);

  const node = page.locator('.react-flow__node[data-id="rmd-source"]');
  const module = node.locator(".money-map-module");
  const box = (await module.boundingBox())!;

  // Drag the module until its left edge sits hard against the viewport's left
  // edge. Baseline after crossing React Flow's drag threshold (see app.spec's
  // drag test) so the consumed engagement movement doesn't shift the target.
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 24, startY + 16);
  const engaged = (await module.boundingBox())!;
  const travelX = 24 - engaged.x;
  await page.mouse.move(startX + 24 + travelX, startY + 16, { steps: 10 });
  await page.mouse.up();

  const moved = (await module.boundingBox())!;
  expect(moved.x, "module should sit within 40px of the viewport's left edge").toBeLessThanOrEqual(
    40,
  );

  await module.click();
  const toolbar = page.getByRole("toolbar", { name: "Selected shape actions" });
  await expect(toolbar).toBeVisible();
  // The corrective clamp re-runs as the anchor settles, so read the box the
  // same way the camera is read: two consecutive matching reads, not one.
  let previousX = Number.NaN;
  await expect
    .poll(async () => {
      const current = (await toolbar.boundingBox())!.x;
      const stable = Math.abs(current - previousX) < 0.5;
      previousX = current;
      return stable;
    })
    .toBe(true);
  const toolbarBox = (await toolbar.boundingBox())!;
  expect(toolbarBox.x, "toolbar clipped past the left viewport edge").toBeGreaterThanOrEqual(0);
  expect(
    toolbarBox.x + toolbarBox.width,
    "toolbar clipped past the right viewport edge",
  ).toBeLessThanOrEqual(1280);

  // The element box alone is not enough: the halo is portalled inside the
  // React Flow root, whose overflow: hidden crops paint at the canvas's
  // safe-area padding while getBoundingClientRect stays on-viewport. Sample
  // what is actually hittable at both ends of the box — the same truth a
  // click lands on.
  const edgeHits = await page.evaluate((box) => {
    const hit = (x: number) =>
      document.elementFromPoint(x, box.y + box.height / 2)?.closest(".selection-halo") instanceof
      HTMLElement;
    return { left: hit(box.x + 2), right: hit(box.x + box.width - 2) };
  }, toolbarBox);
  expect(edgeHits.left, "toolbar's left edge is cropped by an ancestor").toBe(true);
  expect(edgeHits.right, "toolbar's right edge is cropped by an ancestor").toBe(true);

  await page.evaluate(() => localStorage.clear());
});

// The flow toolbar has no node to ride React Flow's camera-aware NodeToolbar
// on, so the workspace measures the label's screen box itself. A one-shot
// measurement taken only when the document or selection changes goes stale
// the instant the camera moves independently of either -- it must track the
// label's real, current position through a zoom, a pan, and a keyboard nudge.
test("the selected-flow toolbar tracks its label through zoom, pan, and a keyboard nudge", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  await settledCanvasCamera(page);

  const labelWrap = page.locator('[data-flow-label-id="annuity-income-need"]');
  await labelWrap.getByRole("button").click();
  const toolbar = page.getByRole("toolbar", { name: "Selected relationship actions" });
  await expect(toolbar).toBeVisible();

  const centerXOf = async (locator: Locator) => {
    const box = (await locator.boundingBox())!;
    return box.x + box.width / 2;
  };
  const assertTracksLabel = async () => {
    let previousGap = Number.NaN;
    await expect
      .poll(async () => {
        const gap = Math.abs((await centerXOf(toolbar)) - (await centerXOf(labelWrap)));
        const stable = Math.abs(gap - previousGap) < 0.5;
        previousGap = gap;
        return stable ? gap : Number.NaN;
      })
      .toBeLessThan(1.5);
  };

  await assertTracksLabel();

  await page.getByRole("button", { name: "Zoom in" }).click();
  await settledCanvasCamera(page);
  await assertTracksLabel();

  // Left-drag on the bare pane already pans this canvas (panOnDrag includes
  // button 0), so no modifier key is needed -- only a start point clear of
  // any module, handle, or the selected flow's own label/route-handle button,
  // since dragging any of those moves it instead of the camera. Confirmed via
  // elementFromPoint at this exact zoom, not assumed: this starter's fitted,
  // zoomed-in layout leaves the pane's bottom-right corner bare.
  const paneBox = (await page.locator(".react-flow__pane").boundingBox())!;
  const panStart = { x: paneBox.x + paneBox.width - 30, y: paneBox.y + paneBox.height - 30 };
  const panStartTarget = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.className ?? null,
    panStart,
  );
  expect(panStartTarget, "pan gesture must start on the bare pane").toBe(
    "react-flow__pane draggable",
  );
  await page.mouse.move(panStart.x, panStart.y);
  await page.mouse.down();
  await page.mouse.move(panStart.x - 90, panStart.y - 70, { steps: 10 });
  await page.mouse.up();
  await settledCanvasCamera(page);
  await assertTracksLabel();

  await labelWrap.getByRole("button").focus();
  await page.keyboard.press("ArrowRight");
  await assertTracksLabel();

  await page.evaluate(() => localStorage.clear());
});

// A drag that starts on a module's connection handle and releases on another
// card's body creates and selects the new relationship in the same gesture,
// before the canvas's own edge state has synced to include it -- the
// selected-flow toolbar's anchor must still land on screen, not wherever an
// unset position style happens to leave it.
test("the selected-flow toolbar lands on screen for a relationship created by dragging a handle onto a card", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  await settledCanvasCamera(page);

  const source = page.locator('.react-flow__node[data-id="annuity-source"]');
  const target = page.locator('.react-flow__node[data-id="annuity-policy"] .money-map-module');
  await source.hover();
  const sourcePort = source.locator(".react-flow__handle.source.react-flow__handle-right");
  const sourceBox = await sourcePort.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Expected source port and target card geometry");

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 12,
  });
  await page.mouse.up();

  const toolbar = page.getByRole("toolbar", { name: "Selected relationship actions" });
  await expect(toolbar).toBeVisible();
  await expect.poll(async () => (await toolbar.boundingBox())!.y).toBeGreaterThanOrEqual(0);

  await page.evaluate(() => localStorage.clear());
});

// A selected relationship must show its re-anchor grips and preview a drag.
// React Flow ships the edgeupdater circles fully transparent — 46px of grab
// area, zero pixels drawn — and its default connection line is 1px light grey,
// invisible on this canvas. Users re-anchored blind and read failed drops as
// random reverts.
test("a selected relationship draws its endpoint grips and previews a reconnect drag", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  await settledCanvasCamera(page);

  await page
    .getByRole("button", { name: /planned relationship from annuity-source to annuity-plan/i })
    .click();

  const updaters = page.locator(".react-flow__edgeupdater");
  await expect(updaters).toHaveCount(2);
  for (const updater of await updaters.all()) {
    const paint = await updater.evaluate((el) => {
      const style = getComputedStyle(el);
      return { fill: style.fill, stroke: style.stroke };
    });
    expect(paint.fill, "endpoint grip must be drawn, not transparent").not.toBe("rgba(0, 0, 0, 0)");
    expect(paint.fill).not.toBe("none");
    expect(paint.stroke).not.toBe("rgba(0, 0, 0, 0)");
  }

  const grip = updaters.first();
  const gripBox = await grip.boundingBox();
  if (!gripBox) throw new Error("Expected grip geometry");
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + 120, gripBox.y + 90, { steps: 6 });

  const preview = page.locator(".react-flow__connection-path");
  // Not toBeVisible: a near-straight svg path has a zero-height bounding box,
  // which Playwright reports as hidden even while it paints on screen.
  await expect(preview, "a reconnect drag must render a rubber band").toHaveCount(1);
  await expect(preview).toHaveAttribute("d", /M.+C.+/);
  const previewPaint = await preview.evaluate((el) => {
    const style = getComputedStyle(el);
    return { stroke: style.stroke, width: parseFloat(style.strokeWidth) };
  });
  expect(previewPaint.width).toBeGreaterThanOrEqual(1.5);
  expect(previewPaint.stroke).not.toBe("rgb(177, 177, 183)");
  await page.mouse.up();
});
