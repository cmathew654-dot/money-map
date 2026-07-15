const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";

async function openApp(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
  await page.locator("#fitButton").click();
  return errors;
}

async function state(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

async function center(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function pointIn(locator, xRatio, yRatio) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
}

function expectEdgePinnedEndpoint(endpoint, item) {
  expect(endpoint.itemId).toBe(item.id);
  expect(endpoint.x).toBeUndefined();
  expect(endpoint.y).toBeUndefined();
  expect(Number.isFinite(endpoint.offsetX)).toBe(true);
  expect(Number.isFinite(endpoint.offsetY)).toBe(true);
  expect(Math.abs(endpoint.offsetX)).toBeLessThanOrEqual(item.w / 2 + 0.5);
  expect(Math.abs(endpoint.offsetY)).toBeLessThanOrEqual(item.h / 2 + 0.5);
  const onVerticalEdge = Math.abs(Math.abs(endpoint.offsetX) - item.w / 2) <= 0.5;
  const onHorizontalEdge = Math.abs(Math.abs(endpoint.offsetY) - item.h / 2) <= 0.5;
  expect(onVerticalEdge || onHorizontalEdge).toBe(true);
}

test.describe("wave 3.5 editor polish", () => {
  test("edge handle drag creates a transfer connector between finance items", async ({ page }) => {
    const errors = await openApp(page);
    const before = (await state(page)).connectors.length;
    const source = page.locator(".canvas-item[data-item-id='managedPortfolio']");
    const target = page.locator(".canvas-item[data-item-id='cashReserve']");

    await source.hover();
    const handle = source.locator(".item-edge-handle.east");
    await expect(handle).toBeVisible();
    const start = await center(handle);
    const end = await center(target);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await expect(page.locator(".connector-ghost")).toHaveClass(/is-valid/);
    await expect(target).toHaveClass(/is-snap-target/);
    await page.mouse.up();

    const next = await state(page);
    expect(next.connectors).toHaveLength(before + 1);
    const created = next.connectors.find((conn) => conn.id === next.selection.id);
    expectEdgePinnedEndpoint(created.source, next.items.find((item) => item.id === "managedPortfolio"));
    expectEdgePinnedEndpoint(created.target, next.items.find((item) => item.id === "cashReserve"));
    expect(created.amount).toBe(0);
    expect(created.flowType).toBe("transfer");
    const draw = page.locator(`.connector-draw[data-connector-id='${created.id}']`);
    await expect(draw).toHaveClass(/is-hot/);
    await expect(draw).toHaveCSS("stroke-dasharray", /[1-9]/);
    await expect(draw).not.toHaveClass(/is-hot/, { timeout: 1200 });
    expect(errors).toEqual([]);
  });

  test("edge-zone drag creates a connector without requiring the tiny handle", async ({ page }) => {
    const errors = await openApp(page);
    const before = (await state(page)).connectors.length;
    const source = page.locator(".canvas-item[data-item-id='managedPortfolio']");
    const target = page.locator(".canvas-item[data-item-id='cashReserve']");
    const start = await pointIn(source, 0.93, 0.5);
    const end = await pointIn(target, 0.08, 0.5);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 14, start.y, { steps: 2 });
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await expect(page.locator(".connector-ghost")).toHaveClass(/is-valid/);
    await expect(target).toHaveClass(/is-snap-target/);
    await page.mouse.up();

    const next = await state(page);
    expect(next.connectors).toHaveLength(before + 1);
    const created = next.connectors.find((conn) => conn.id === next.selection.id);
    expectEdgePinnedEndpoint(created.source, next.items.find((item) => item.id === "managedPortfolio"));
    expectEdgePinnedEndpoint(created.target, next.items.find((item) => item.id === "cashReserve"));
    expect(created.flowType).toBe("transfer");
    expect(errors).toEqual([]);
  });

  test("edge-zone connector snaps when dropped near a finance tile", async ({ page }) => {
    const errors = await openApp(page);
    const before = (await state(page)).connectors.length;
    const source = page.locator(".canvas-item[data-item-id='managedPortfolio']");
    const target = page.locator(".canvas-item[data-item-id='cashReserve']");
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    expect(sourceBox).toBeTruthy();
    expect(targetBox).toBeTruthy();
    const start = { x: sourceBox.x + sourceBox.width - 18, y: sourceBox.y + sourceBox.height / 2 };
    const nearTarget = { x: targetBox.x + 16, y: targetBox.y + targetBox.height / 2 };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 18, start.y, { steps: 2 });
    await page.mouse.move(nearTarget.x, nearTarget.y, { steps: 10 });
    await expect(page.locator(".connector-ghost")).toHaveClass(/is-valid/);
    await page.mouse.up();

    const next = await state(page);
    expect(next.connectors).toHaveLength(before + 1);
    const created = next.connectors.find((conn) => conn.id === next.selection.id);
    expectEdgePinnedEndpoint(created.target, next.items.find((item) => item.id === "cashReserve"));
    expect(errors).toEqual([]);
  });

  test("center drag still moves a tile instead of creating a connector", async ({ page }) => {
    const errors = await openApp(page);
    const before = await state(page);
    const source = page.locator(".canvas-item[data-item-id='employer401k']");
    const start = await center(source);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 90, start.y + 44, { steps: 8 });
    await page.mouse.up();

    const next = await state(page);
    const beforeItem = before.items.find((item) => item.id === "employer401k");
    const afterItem = next.items.find((item) => item.id === "employer401k");
    expect(next.connectors).toHaveLength(before.connectors.length);
    expect(Math.hypot(afterItem.x - beforeItem.x, afterItem.y - beforeItem.y)).toBeGreaterThan(40);
    expect(errors).toEqual([]);
  });

  test("attached connector geometry updates while a connected tile is being dragged", async ({ page }) => {
    const errors = await openApp(page);
    const source = page.locator(".canvas-item[data-item-id='employer401k']");
    const start = await center(source);
    const draw = page.locator(".connector-draw[data-connector-id='rollover']");
    const beforePath = await draw.getAttribute("d");

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 78, start.y + 26, { steps: 8 });

    await expect.poll(async () => draw.getAttribute("d"), { timeout: 1200 }).not.toBe(beforePath);
    await page.mouse.up();

    expect(errors).toEqual([]);
  });

  test("flow type applies visible semantic presets", async ({ page }) => {
    const errors = await openApp(page);
    const presets = {
      transfer: { routeStyle: "smartArc", strokeStyle: "solid", colorMode: "flow", arrowEnd: "arrow", widthMode: "amount" },
      rollover: { routeStyle: "smartArc", strokeStyle: "solid", colorMode: "flow", arrowEnd: "chevron", widthMode: "amount" },
      income: { routeStyle: "smartArc", strokeStyle: "longDash", colorMode: "flow", arrowEnd: "arrow", widthMode: "amount" },
      annuity: { routeStyle: "smartArc", strokeStyle: "longDash", colorMode: "flow", arrowEnd: "diamond", widthMode: "medium" },
      roth: { routeStyle: "sCurve", strokeStyle: "fineDash", colorMode: "flow", arrowEnd: "arrow", widthMode: "amount" },
      tax: { routeStyle: "smartArc", strokeStyle: "fineDash", colorMode: "red", arrowEnd: "arrow", widthMode: "medium" },
      rmd: { routeStyle: "smartArc", strokeStyle: "longDash", colorMode: "flow", arrowEnd: "arrow", widthMode: "amount" },
      qcd: { routeStyle: "smartArc", strokeStyle: "dotted", colorMode: "flow", arrowEnd: "diamond", widthMode: "medium" },
      fee: { routeStyle: "smartArc", strokeStyle: "fineDash", colorMode: "red", arrowEnd: "none", widthMode: "subtle" },
      rebalance: { routeStyle: "sCurve", strokeStyle: "longDash", colorMode: "flow", arrowEnd: "chevron", widthMode: "medium" },
      beneficiary: { routeStyle: "smartArc", strokeStyle: "dotted", colorMode: "flow", arrowEnd: "diamond", widthMode: "amount" }
    };

    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "transfer");
      window.__AFV_TEST__.openPopover("connector-data");
    });
    const initial = (await state(page)).connectors.find((conn) => conn.id === "transfer");
    // c8499b3 (Stage 2): flow-type changes are atomic and amount-PRESERVING at the
    // display level -- the visible magnitude is invariant while the stored amount is
    // normalized to the new cadence's unit (e.g. monthly stores x12). Assert the
    // display invariant, not the raw stored amount which legitimately re-normalizes.
    const initialDisplay = await page.evaluate(
      () => window.__AFV_TEST__.getComputedViewModel().connectors.transfer.displayAmount
    );

    for (const [flowType, preset] of Object.entries(presets)) {
      await page.locator(`[data-set='connector-field'][data-field='flowType'][data-value='${flowType}']`).click();
      const conn = (await state(page)).connectors.find((entry) => entry.id === "transfer");
      expect(conn).toMatchObject({ flowType, ...preset });
      expect(conn.source).toEqual(initial.source);
      expect(conn.target).toEqual(initial.target);
      expect(conn.max).toBe(initial.max);

      const view = await page.evaluate(
        () => window.__AFV_TEST__.getComputedViewModel().connectors.transfer
      );
      expect(view.displayAmount).toBe(initialDisplay); // amount-preserving transition
      expect(view.amountText).toMatch(/\$/); // preset visibly relabels the cadence unit

      const draw = page.locator(".connector-draw[data-connector-id='transfer']");
      await expect(draw).toHaveClass(new RegExp(`route-${preset.routeStyle}`));
      await expect(draw).toHaveClass(new RegExp(`stroke-${preset.strokeStyle}`));
    }

    expect(errors).toEqual([]);
  });

  test("edge connector preview cancels cleanly before a valid drop", async ({ page }) => {
    const errors = await openApp(page);
    const before = (await state(page)).connectors.length;
    const source = page.locator(".canvas-item[data-item-id='employer401k']");

    await source.hover();
    const handle = source.locator(".item-edge-handle.east");
    await expect(handle).toBeVisible();
    const start = await center(handle);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const invalidPoint = { x: Math.max(130, start.x - 220), y: Math.max(120, start.y - 220) };
    await page.mouse.move(invalidPoint.x, invalidPoint.y, { steps: 6 });

    await expect(page.locator("body")).toHaveClass(/connector-preview-invalid/);
    await expect(page.locator(".connector-ghost")).toHaveClass(/is-invalid/);

    await page.keyboard.press("Escape");
    await expect(page.locator(".connector-ghost")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/creating-connector/);
    await expect(page.locator(".canvas-item.is-snap-target")).toHaveCount(0);
    await page.mouse.up();

    expect((await state(page)).connectors).toHaveLength(before);
    expect(errors).toEqual([]);
  });

  test("inline finance value edit accepts suffixes and commits starting value", async ({ page }) => {
    const errors = await openApp(page);
    const value = page.locator(".canvas-item[data-item-id='employer401k'] .finance-value");

    await value.dblclick();
    await expect(value).toHaveAttribute("contenteditable", "true");
    await value.fill("1.5m");
    await value.blur();

    const next = await state(page);
    expect(next.financeData.employer401k.value).toBe(1500000);
    expect(await value.textContent()).toMatch(/\$1M|\$1\.2M/);
    expect(errors).toEqual([]);
  });

  test("money inspector fields show plain text on focus and formatted text on blur", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "cashReserve");
      window.__AFV_TEST__.openPopover("selection-data");
    });

    const input = page.locator(".selection-inspector input[data-input='finance-value']");
    await expect(input).toHaveValue("$150,000");
    await input.focus();
    await expect(input).toHaveValue("150000");
    await input.fill("$ 1 500 000");
    await input.blur();

    await expect(input).toHaveValue("$1,500,000");
    expect((await state(page)).financeData.cashReserve.value).toBe(1500000);
    expect(errors).toEqual([]);
  });

  test("ctrl-click multi-select shows alignment toolbar and aligns selected items", async ({ page }) => {
    const errors = await openApp(page);
    const first = page.locator(".canvas-item[data-item-id='employer401k']");
    const second = page.locator(".canvas-item[data-item-id='managedPortfolio']");

    await first.click();
    await second.click({ modifiers: ["Control"] });

    await expect(first).toHaveClass(/is-selected/);
    await expect(second).toHaveClass(/is-selected/);
    await expect(page.locator("[data-action='align-top']")).toBeVisible();

    await page.locator("[data-action='align-top']").click();
    const next = await state(page);
    const yValues = next.items
      .filter((item) => item.id === "employer401k" || item.id === "managedPortfolio")
      .map((item) => item.y);
    expect(new Set(yValues).size).toBe(1);
    expect(next.multiSelection).toHaveLength(2);
    expect(errors).toEqual([]);
  });
});
