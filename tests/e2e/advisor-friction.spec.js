const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:4173/index.html?test=1";
const TEMPLATE_IDS = [
  "retirement",
  "roth",
  "annuity",
  "estate",
  "cashReserve",
  "retirementPaycheck",
  "socialSecurityBridge",
  "bucketStrategy",
  "rmdTax",
  "withdrawalSequencing",
  "cashCleanup",
  "annuityIncomeFloor",
  "executiveComp",
  "businessOwner",
  "survivorIncome",
  "blankHousehold"
];

async function openApp(page, templateId = "retirement") {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.evaluate(() => window.__AFV_TEST__.fit());
  return errors;
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function centerOf(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function pathPoint(page, connectorId, ratio = 0.5) {
  return page.evaluate(({ id, ratio: position }) => {
    const path = document.querySelector(`.connector-hit[data-connector-id="${id}"]`);
    if (!path) return null;
    const point = path.getPointAtLength(path.getTotalLength() * position);
    return new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
  }, { id: connectorId, ratio });
}

async function expectNoFloatingSelectionChrome(page) {
  await expect(page.locator(".selection-toolbar")).toHaveCount(0);
  await expect(page.locator(".selection-popover")).toHaveCount(0);
}

test.describe("advisor friction controls", () => {
  test("selected paycheck tile edits monthly need from the docked inspector without floating chrome", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("item", "clientIncome"));

    const editor = page.locator(".selection-inspector");
    await expect(editor.locator("input[data-input='scenario-monthly-need']")).toBeVisible();
    await expect(page.locator(".selection-toolbar input[data-money-input='true']")).toHaveCount(0);
    await expect(page.locator(".selection-popover")).toHaveCount(0);

    const input = editor.locator("input[data-input='scenario-monthly-need']");
    await input.focus();
    await input.fill("9000");
    await input.blur();

    await expect(input).toHaveValue("$9,000");
    await expect(page.locator(".canvas-item[data-item-id='clientIncome'] .paycheck-amount")).toContainText("$9,000");
    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.scenario.monthlyNeed).toBe(9000);
    expect(errors).toEqual([]);
  });

  test("selected finance objects expose clear label and value fields in the docked inspector", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("item", "rolloverIra"));

    const editor = page.locator(".selection-inspector");
    await expect(editor).toBeVisible();
    await expect(page.locator(".selection-popover")).toHaveCount(0);

    const label = editor.locator("input[data-input='item-label']");
    const value = editor.locator("input[data-input='finance-value']");
    await expect(label).toHaveValue("Rollover IRA");
    await expect(value).toBeVisible();

    await label.focus();
    await label.fill("Core IRA");
    await value.focus();
    await value.fill("555000");
    await value.blur();

    await expect(page.locator(".canvas-item[data-item-id='rolloverIra'] .finance-name")).toContainText("Core IRA");
    await expect(value).toHaveValue("$555,000");
    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.items.find((item) => item.id === "rolloverIra").label).toBe("Core IRA");
    expect(state.financeData.rolloverIra.value).toBe(555000);
    expect(errors).toEqual([]);
  });

  test("selected flow exposes clear amount and label fields in the docked inspector", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "transfer"));

    const editor = page.locator(".selection-inspector");
    await expect(editor).toBeVisible();
    await expect(page.locator(".selection-popover")).toHaveCount(0);

    const label = editor.locator("input[data-input='connector-label']");
    const amount = editor.locator("input[data-input='connector-amount']");
    await expect(label).toHaveValue("Fund reserve");
    await amount.focus();
    await amount.fill("88000");
    await label.focus();
    await label.fill("Reserve funding");
    await amount.blur();

    await expect(page.locator(".connector-label[data-connector-id='transfer'] .amount")).toHaveText("$88K");
    await expect(page.locator(".connector-label[data-connector-id='transfer'] .relationship")).toHaveText("Reserve funding");
    const conn = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((entry) => entry.id === "transfer"));
    expect(conn.amount).toBe(88000);
    expect(conn.label).toBe("Reserve funding");
    expect(errors).toEqual([]);
  });

  test("data style and connector label entry points stay in the docked inspector", async ({ page }) => {
    const errors = await openApp(page);

    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "rolloverIra");
      window.__AFV_TEST__.openPopover("data");
    });
    await expect(page.locator(".selection-inspector[data-inspector-section='selection-data']")).toBeVisible();
    await expect(page.locator(".selection-inspector input[data-input='finance-value']")).toBeVisible();
    await expectNoFloatingSelectionChrome(page);

    await page.evaluate(() => window.__AFV_TEST__.openPopover("style"));
    await expect(page.locator(".selection-inspector[data-inspector-section='selection-style']")).toBeVisible();
    await expect(page.locator(".selection-inspector [data-field='visual']")).not.toHaveCount(0);
    await expectNoFloatingSelectionChrome(page);

    await page.locator("[data-inspector-tab='selection-data']").click();
    await expect(page.locator(".selection-inspector[data-inspector-section='selection-data']")).toBeVisible();
    await expectNoFloatingSelectionChrome(page);

    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "transfer");
      window.__AFV_TEST__.openPopover("connector-label");
    });
    await expect(page.locator(".selection-inspector[data-inspector-section='connector-label']")).toBeVisible();
    await expect(page.locator(".selection-inspector [data-field='labelMode']")).not.toHaveCount(0);
    await expectNoFloatingSelectionChrome(page);

    await page.evaluate(() => window.__AFV_TEST__.openPopover("connector-style"));
    await expect(page.locator(".selection-inspector[data-inspector-section='connector-style']")).toBeVisible();
    await expect(page.locator(".selection-inspector [data-field='routeStyle']")).not.toHaveCount(0);
    await expectNoFloatingSelectionChrome(page);

    for (const alias of ["connector-route", "connector-stroke", "connector-arrows", "connector-width"]) {
      await page.evaluate((kind) => window.__AFV_TEST__.openPopover(kind), alias);
      await expect(page.locator(".selection-inspector[data-inspector-section='connector-style']")).toBeVisible();
      await expect(page.locator(".selection-inspector [data-field='routeStyle']")).not.toHaveCount(0);
      await expectNoFloatingSelectionChrome(page);
    }

    await page.evaluate(() => window.__AFV_TEST__.openPopover("connector-ports"));
    await expect(page.locator(".selection-inspector[data-inspector-section='connector-endpoints']")).toBeVisible();
    await expect(page.locator(".selection-inspector .inspector-body [data-action='detach-connector']")).toBeVisible();
    await expectNoFloatingSelectionChrome(page);
    expect(errors).toEqual([]);
  });

  test("selected flow treats path and amount label as one object and reverses direction", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "transfer"));

    await expect(page.locator(".connector-draw[data-connector-id='transfer']")).toHaveClass(/is-selected/);
    await expect(page.locator(".connector-hit[data-connector-id='transfer']")).toHaveClass(/is-selected/);
    await expect(page.locator(".connector-label[data-connector-id='transfer']")).toHaveClass(/is-selected/);
    await expect(page.locator(".selection-inspector input[data-input='connector-amount']")).toBeVisible();
    await expect(page.locator(".selection-toolbar input[data-money-input='true']")).toHaveCount(0);
    await expect(page.locator(".selection-inspector [data-action='reverse-connector']")).toBeVisible();

    const before = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "transfer"));
    await page.locator(".selection-inspector [data-action='reverse-connector']").click();
    const after = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "transfer"));
    expect(after.source.itemId).toBe(before.target.itemId);
    expect(after.target.itemId).toBe(before.source.itemId);
    expect(after.source.port).toMatch(/\.(out|payout|household|legacy|lifestyle|charitable)$/);
    expect(after.target.port).toMatch(/\.(in|income|funding|need|gap)$/);

    await page.keyboard.press("Control+Z");
    await expect.poll(async () => {
      const conn = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((entry) => entry.id === "transfer"));
      return conn?.source?.itemId;
    }).toBe(before.source.itemId);
    expect(errors).toEqual([]);
  });

  test("selected flow amount edits from the inspector and updates the visible label", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "transfer"));

    const input = page.locator(".selection-inspector input[data-input='connector-amount']");
    await input.focus();
    await input.fill("90000");
    await input.blur();

    await expect(input).toHaveValue("$90,000");
    await expect(page.locator(".connector-label[data-connector-id='transfer'] .amount")).toHaveText("$90K");
    const amount = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "transfer").amount);
    expect(amount).toBe(90000);
    expect(errors).toEqual([]);
  });

  test("recurring income flow edits in monthly client terms while preserving annual storage", async ({ page }) => {
    const errors = await openApp(page, "retirementPaycheck");
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "portfolioDraw"));

    const input = page.locator(".selection-inspector input[data-input='connector-amount']");
    await expect(input).toHaveValue("$4,000");
    await expect(page.locator(".connector-label[data-connector-id='portfolioDraw'] .amount")).toHaveText("$4,000/mo");

    await input.focus();
    await input.fill("5100");
    await input.blur();

    await expect(input).toHaveValue("$5,100");
    await expect(page.locator(".connector-label[data-connector-id='portfolioDraw'] .amount")).toHaveText("$5,100/mo");
    let state = await page.evaluate(() => window.__AFV_TEST__.getState());
    let conn = state.connectors.find((entry) => entry.id === "portfolioDraw");
    expect(state.scenario.monthlyDistribution).toBe(4000);
    expect(conn.amount).toBe(61200);
    expect(conn.manualAmount).toBe(true);

    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 6000));
    state = await page.evaluate(() => window.__AFV_TEST__.getState());
    conn = state.connectors.find((entry) => entry.id === "portfolioDraw");
    expect(conn.amount).toBe(61200);
    expect(state.scenario.monthlyDistribution).toBe(6000);
    expect(errors).toEqual([]);
  });

  test("annuity policy tile shows payout and funding instead of a misleading zero value", async ({ page }) => {
    const errors = await openApp(page, "retirementPaycheck");

    const annuityTile = page.locator(".canvas-item[data-item-id='annuity']");
    await expect(annuityTile.locator(".annuity-contract-readout")).toBeVisible();
    await expect(annuityTile.locator(".annuity-contract-readout")).toContainText("Payout");
    await expect(annuityTile.locator(".annuity-contract-readout")).toContainText("$1,800/mo");
    await expect(annuityTile.locator(".annuity-contract-readout")).toContainText("Funding");
    await expect(annuityTile.locator(".annuity-contract-readout")).toContainText("$250K");
    await expect(annuityTile.locator(".finance-value")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("selected flow body can be dragged to bend without grabbing the bend handle", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "rollover"));
    const beforeD = await page.locator(".connector-draw[data-connector-id='rollover']").getAttribute("d");
    const point = await pathPoint(page, "rollover", 0.5);
    expect(point).toBeTruthy();

    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 100, point.y, { steps: 8 });
    await page.mouse.up();

    const afterD = await page.locator(".connector-draw[data-connector-id='rollover']").getAttribute("d");
    const conn = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((entry) => entry.id === "rollover"));
    expect(afterD).not.toBe(beforeD);
    expect(conn.manualMid).toBe(true);
    expect(conn.mid).toBeTruthy();
    expect(errors).toEqual([]);
  });

  test("selected flow label can be dragged directly without grabbing the label handle", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "incomeDistribution"));
    const label = page.locator(".connector-label[data-connector-id='incomeDistribution']");
    const start = await centerOf(label);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, start.y - 40, { steps: 8 });
    await page.mouse.up();

    const conn = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((entry) => entry.id === "incomeDistribution"));
    expect(conn.labelMode).toBe("manual");
    expect(conn.labelPoint).toBeTruthy();
    expect(errors).toEqual([]);
  });

  test("selected tile resizes from the corner zone instead of requiring the small handle", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("item", "rolloverIra"));
    const tile = page.locator(".canvas-item[data-item-id='rolloverIra']");
    const before = await page.evaluate(() => window.__AFV_TEST__.getState().items.find((item) => item.id === "rolloverIra"));
    const box = await tile.boundingBox();
    expect(box).toBeTruthy();

    await page.mouse.move(box.x + box.width - 18, box.y + box.height - 18);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 56, box.y + box.height + 38, { steps: 8 });
    await page.mouse.up();

    const after = await page.evaluate(() => window.__AFV_TEST__.getState().items.find((item) => item.id === "rolloverIra"));
    expect(after.w).toBeGreaterThan(before.w + 20);
    expect(after.h).toBeGreaterThan(before.h + 12);
    expect(errors).toEqual([]);
  });

  test("elbow route renders with rounded corners instead of hard 90 degree line joins", async ({ page }) => {
    const errors = await openApp(page, "retirementPaycheck");
    const d = await page.locator(".connector-draw[data-connector-id='guaranteedFlow']").getAttribute("d");
    expect(d).toContain("Q");
    expect(d.match(/L/g)?.length || 0).toBeLessThanOrEqual(5);
    expect(errors).toEqual([]);
  });

  test("built-in paycheck tile copy stays inside the tile", async ({ page }) => {
    const errors = await openApp(page);
    const findings = [];
    for (const templateId of TEMPLATE_IDS) {
      await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
      await page.evaluate(() => window.__AFV_TEST__.fit());
      await settle(page);
      const result = await page.evaluate(() => {
        return [...document.querySelectorAll(".finance-paycheck .finance-type, .finance-paycheck .finance-name, .finance-paycheck .finance-note")]
          .flatMap((node) => {
            const rect = node.getBoundingClientRect();
            const host = node.closest(".canvas-item");
            const hostRect = host?.getBoundingClientRect();
            const clipped = node.scrollHeight > node.clientHeight + 2 || node.scrollWidth > node.clientWidth + 2;
            const protrudes = hostRect && (
              rect.top < hostRect.top - 3 ||
              rect.left < hostRect.left - 3 ||
              rect.right > hostRect.right + 3 ||
              rect.bottom > hostRect.bottom + 3
            );
            return clipped || protrudes
              ? [`${host?.dataset.itemId || "unknown"} ${node.textContent.trim()} clipped=${clipped} protrudes=${Boolean(protrudes)}`]
              : [];
          });
      });
      if (result.length) findings.push({ templateId, result });
    }
    expect(findings).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("household marker does not render the ghost-like pseudo icon", async ({ page }) => {
    const errors = await openApp(page, "roth");
    const content = await page.locator(".finance-household .finance-surface").first().evaluate((node) => getComputedStyle(node, "::before").content);
    expect(content).toBe("none");
    expect(errors).toEqual([]);
  });
});
