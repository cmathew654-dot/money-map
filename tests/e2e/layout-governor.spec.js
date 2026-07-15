const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";
const BLOCKING_LAYOUT_TYPES = new Set([
  "hard-overlap",
  "reserved-zone",
  "duplicate-stack",
  "label-overlap",
  "connector-label-overlap",
  "offscreen-object"
]);

async function openApp(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`[pageerror] ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[console.error] ${message.text()}`);
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  return errors;
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function getState(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

async function getLayoutIssues(page, types = BLOCKING_LAYOUT_TYPES) {
  return page.evaluate((allowedTypes) => {
    const typeSet = new Set(allowedTypes);
    return (window.__AFV_TEST__.getDiagnostics().layoutIssues || [])
      .filter((issue) => typeSet.has(issue.type));
  }, [...types]);
}

async function expectNoLayoutIssues(page, types = BLOCKING_LAYOUT_TYPES) {
  await expect.poll(() => getLayoutIssues(page, types)).toEqual([]);
}

async function loadDiagram(page, diagram) {
  await page.evaluate((nextDiagram) => window.__AFV_TEST__.loadDiagram(nextDiagram), diagram);
  await page.locator("#fitButton").click();
  await settle(page);
}

async function screenFromWorld(page, point) {
  return page.evaluate(({ x, y }) => {
    const rect = document.querySelector("#canvasStage").getBoundingClientRect();
    const { viewport } = window.__AFV_TEST__.getState();
    return {
      x: rect.left + viewport.x + x * viewport.zoom,
      y: rect.top + viewport.y + y * viewport.zoom
    };
  }, point);
}

async function clickWorld(page, point) {
  const screen = await screenFromWorld(page, point);
  await page.mouse.click(screen.x, screen.y);
  await settle(page);
}

async function dragLocatorToWorld(page, locator, worldPoint, options = {}) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  const end = await screenFromWorld(page, worldPoint);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  if (options.alt) await page.keyboard.down("Alt");
  await page.mouse.move(end.x, end.y, { steps: options.steps || 10 });
  if (options.alt) await page.keyboard.up("Alt");
  await page.mouse.up();
  await settle(page);
}

async function armFinancePreset(page, id = "cash-stack") {
  await page.locator('[data-dock="finance"]').click();
  const button = page.locator(`[data-palette-kind="finance"][data-palette-id="${id}"]`).first();
  await expect(button).toBeVisible();
  await button.click();
  await settle(page);
  await expect.poll(() => getState(page).then((state) => state.activeCreationPreset)).toMatchObject({
    kind: "finance",
    id
  });
}

function finance(id, x, y, label = "Investment Account", options = {}) {
  const category = options.category || "brokerage";
  return {
    id,
    type: "finance",
    visual: options.visual || "card",
    category,
    financeId: id,
    label,
    subtitle: options.subtitle || "Brokerage",
    note: options.note || "",
    x,
    y,
    w: options.w || 250,
    h: options.h || 132,
    zIndex: options.zIndex || 20,
    style: options.style || {}
  };
}

function financeDataFor(ids, value = 250000) {
  return Object.fromEntries(ids.map((id) => [id, {
    category: "brokerage",
    value,
    capacity: value * 2,
    baseValue: value
  }]));
}

function reservedText(id, x, y, textStyle, label, options = {}) {
  return {
    id,
    type: "text",
    label,
    subtitle: options.subtitle || "",
    note: "",
    x,
    y,
    w: options.w || 470,
    h: options.h || 80,
    zIndex: options.zIndex || 5,
    locked: options.locked ?? true,
    style: { textStyle }
  };
}

function governorFixture() {
  return {
    name: "Layout governor fixture",
    items: [
      reservedText("fixture-title", 1500, 820, "title", "Retirement Paycheck Stack", { w: 520, h: 90 }),
      reservedText("fixture-disclosure", 1500, 1760, "disclosure", "For illustration only.", { w: 560, h: 58 }),
      finance("source", 1050, 1150, "Source Account"),
      finance("target", 1550, 1150, "Target Account")
    ],
    groups: [],
    financeData: financeDataFor(["source", "target"]),
    connectors: [],
    scenario: {}
  };
}

function messyFixture() {
  return {
    name: "Messy layout fixture",
    items: [
      reservedText("messy-title", 1500, 820, "title", "Retirement Paycheck Stack", { w: 520, h: 90 }),
      reservedText("messy-disclosure", 1500, 1760, "disclosure", "For illustration only.", { w: 560, h: 58 }),
      finance("cashA", 1500, 850, "Cash stack", { visual: "cashStack", category: "cash", subtitle: "Liquidity reserve", w: 245, h: 126 }),
      finance("cashB", 1512, 862, "Cash stack", { visual: "cashStack", category: "cash", subtitle: "Liquidity reserve", w: 245, h: 126 }),
      finance("portfolioA", 1820, 1160, "Managed Portfolio"),
      finance("portfolioB", 1840, 1178, "Managed Portfolio"),
      finance("noticeCollision", 1500, 1760, "Disclosure collision")
    ],
    groups: [],
    financeData: financeDataFor(["cashA", "cashB", "portfolioA", "portfolioB", "noticeCollision"]),
    connectors: [],
    scenario: {}
  };
}

function productRoleFixture() {
  return {
    name: "Product role layout fixture",
    items: [
      reservedText("role-title", 1500, 820, "title", "Role Surface Geometry", { w: 520, h: 90 }),
      reservedText("role-disclosure", 1500, 1760, "disclosure", "For illustration only.", { w: 560, h: 58 }),
      {
        ...finance("liquidityRole", 1050, 1160, "Liquidity Bucket", {
          visual: "bucket",
          category: "cash",
          subtitle: "Cash reserve",
          note: "Estate liquidity",
          w: 320,
          h: 178
        }),
        productRole: "cashReserve"
      },
      {
        ...finance("trustRole", 1550, 1160, "Trust Container", {
          visual: "trust",
          category: "trust",
          subtitle: "Estate container",
          note: "Transfer destination",
          w: 360,
          h: 190
        }),
        productRole: "trustEstate"
      }
    ],
    groups: [],
    financeData: {
      liquidityRole: {
        category: "cash",
        value: 180000,
        capacity: 300000,
        baseValue: 180000,
        productRole: "cashReserve",
        subBuckets: [
          { id: "cash-reserve", label: "Cash Reserve", value: 65000, note: "Immediate liquidity" },
          { id: "admin-reserve", label: "Admin Reserve", value: 35000, note: "Executor and trustee costs" },
          { id: "settlement-costs", label: "Settlement Costs", value: 80000, note: "Taxes and closing costs" }
        ]
      },
      trustRole: {
        category: "trust",
        value: 900000,
        capacity: 1200000,
        baseValue: 900000,
        productRole: "trustEstate",
        subBuckets: [
          { id: "lifestyle", label: "Lifestyle Sleeve", value: 420000, note: "Survivor support" },
          { id: "legacy", label: "Legacy Sleeve", value: 360000, note: "Family transfer" },
          { id: "charitable", label: "Charitable Sleeve", value: 120000, note: "Giving intent" }
        ]
      }
    },
    connectors: [],
    scenario: {}
  };
}

function newItems(before, after) {
  const beforeIds = new Set(before.items.map((item) => item.id));
  return after.items.filter((item) => !beforeIds.has(item.id));
}

test.describe("canvas quality governor", () => {
  test("repeated click placement nudges identical finance tiles away from reserved title zones and each other", async ({ page }) => {
    const errors = await openApp(page);
    await loadDiagram(page, governorFixture());
    await armFinancePreset(page, "cash-stack");

    const before = await getState(page);
    for (const point of [
      { x: 1180, y: 870 },
      { x: 1500, y: 870 },
      { x: 1820, y: 870 }
    ]) {
      await clickWorld(page, point);
    }

    const after = await getState(page);
    const created = newItems(before, after);
    expect(created).toHaveLength(3);
    expect(new Set(created.map((item) => `${Math.round(item.x)}:${Math.round(item.y)}`)).size).toBe(3);
    expect(await getLayoutIssues(page, new Set(["hard-overlap", "reserved-zone", "duplicate-stack"]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("dragging one hard tile into another auto-nudges or reverts instead of leaving an overlap", async ({ page }) => {
    const errors = await openApp(page);
    await loadDiagram(page, governorFixture());
    await expectNoLayoutIssues(page, new Set(["hard-overlap", "reserved-zone"]));

    await dragLocatorToWorld(
      page,
      page.locator(".canvas-item[data-item-id='source']"),
      { x: 1550, y: 1150 }
    );

    const state = await getState(page);
    const source = state.items.find((item) => item.id === "source");
    const target = state.items.find((item) => item.id === "target");
    expect(Math.hypot(source.x - target.x, source.y - target.y)).toBeGreaterThan(42);
    expect(await getLayoutIssues(page, new Set(["hard-overlap", "reserved-zone"]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("reserved title and disclosure zones block hard tile drops", async ({ page }) => {
    const errors = await openApp(page);
    await loadDiagram(page, governorFixture());

    await dragLocatorToWorld(
      page,
      page.locator(".canvas-item[data-item-id='source']"),
      { x: 1500, y: 820 }
    );
    await dragLocatorToWorld(
      page,
      page.locator(".canvas-item[data-item-id='source']"),
      { x: 1500, y: 1760 }
    );

    expect(await getLayoutIssues(page, new Set(["reserved-zone"]))).toEqual([]);
    const feedback = (await getState(page)).diagnostics.layoutFeedback;
    expect(["blocked", "nudged", null]).toContain(feedback?.status ?? null);
    expect(errors).toEqual([]);
  });

  test("duplicate creates clear nearby copies instead of a tiny offset pile", async ({ page }) => {
    const errors = await openApp(page);
    await loadDiagram(page, {
      name: "Duplicate fixture",
      items: [finance("seed", 1350, 1120, "Managed Portfolio")],
      groups: [],
      financeData: financeDataFor(["seed"]),
      connectors: [],
      scenario: {}
    });

    await page.evaluate(() => window.__AFV_TEST__.select("item", "seed"));
    for (let index = 0; index < 4; index += 1) {
      await page.locator(".selection-inspector [data-action='duplicate']").click();
      await settle(page);
    }

    const state = await getState(page);
    const copies = state.items.filter((item) => item.label === "Managed Portfolio");
    expect(copies).toHaveLength(5);
    expect(await getLayoutIssues(page, new Set(["hard-overlap", "duplicate-stack"]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("product role and sub-bucket surfaces keep model bounds as governor geometry", async ({ page }) => {
    const errors = await openApp(page);
    await loadDiagram(page, productRoleFixture());

    const surfaceChecks = await page.evaluate(() => {
      const { items, viewport } = window.__AFV_TEST__.getState();
      return items
        .filter((item) => item.productRole)
        .map((item) => {
          const node = document.querySelector(`.canvas-item[data-item-id="${item.id}"]`);
          const subBucket = node?.querySelector(".sub-bucket-stack");
          const box = node?.getBoundingClientRect();
          return {
            id: item.id,
            productRole: node?.dataset.productRole || "",
            hasSubBuckets: Boolean(subBucket),
            widthDelta: Math.abs((box?.width || 0) - item.w * viewport.zoom),
            heightDelta: Math.abs((box?.height || 0) - item.h * viewport.zoom)
          };
        });
    });

    expect(surfaceChecks).toEqual([
      expect.objectContaining({
        id: "liquidityRole",
        productRole: "cashReserve",
        hasSubBuckets: true,
        widthDelta: expect.any(Number),
        heightDelta: expect.any(Number)
      }),
      expect.objectContaining({
        id: "trustRole",
        productRole: "trustEstate",
        hasSubBuckets: true,
        widthDelta: expect.any(Number),
        heightDelta: expect.any(Number)
      })
    ]);
    expect(surfaceChecks.every((entry) => entry.widthDelta <= 1 && entry.heightDelta <= 1)).toBe(true);
    expect(await getLayoutIssues(page, new Set(["hard-overlap", "reserved-zone", "duplicate-stack", "label-overlap"]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("Tidy repairs a deliberately messy governor fixture loaded through the harness", async ({ page }) => {
    const errors = await openApp(page);
    await loadDiagram(page, messyFixture());

    const before = await getLayoutIssues(page, new Set(["hard-overlap", "reserved-zone", "duplicate-stack"]));
    expect(before.length).toBeGreaterThan(0);

    await page.locator("#tidyButton").click();
    await settle(page);

    expect(await getLayoutIssues(page, new Set(["hard-overlap", "reserved-zone", "duplicate-stack"]))).toEqual([]);
    expect(errors).toEqual([]);
  });
});
