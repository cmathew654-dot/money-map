const { test, expect } = require("@playwright/test");

const DISPLAY_FONT_RE = /Cormorant Garamond|Book Antiqua|Georgia/i;
const LOCAL_UI_FONT_RE = /Aptos|Segoe UI|system-ui|-apple-system/i;

function appUrl() {
  return "http://localhost:4173/index.html?test=1";
}

async function openApp(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(appUrl());
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
  await page.locator("#fitButton").click();
  return errors;
}

async function clickElementPoint(page, locator, xRatio = 0.5, yRatio = 0.5) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  return box;
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

test.describe("selection-first editor behavior", () => {
  test("cash reserve cylinder is selectable from body, bucket graphic, text, and value", async ({ page }) => {
    const errors = await openApp(page);
    const cash = page.locator(".canvas-item[data-item-id='cashReserve']");
    await expect(cash).toHaveCount(1);

    for (const [xRatio, yRatio] of [[0.5, 0.18], [0.18, 0.5], [0.58, 0.28], [0.68, 0.36]]) {
      await page.mouse.click(180, 120);
      await clickElementPoint(page, cash, xRatio, yRatio);
      await expect(cash).toHaveClass(/is-selected/);
      const state = await page.evaluate(() => window.__AFV_TEST__.getState());
      expect(state.selection).toEqual({ kind: "item", id: "cashReserve" });
      await expect(page.locator(".selection-inspector")).toBeVisible();
      await expect(page.locator(".context-hud")).toHaveCount(0);
    }

    expect(errors).toEqual([]);
  });

  test("clicking another tile switches selection without closing the inspector first", async ({ page }) => {
    const errors = await openApp(page);
    const first = page.locator(".canvas-item[data-item-id='managedPortfolio']");
    const second = page.locator(".canvas-item[data-item-id='cashReserve']");

    await clickElementPoint(page, first);
    await expect(first).toHaveClass(/is-selected/);
    await expect(page.locator(".selection-inspector")).toBeVisible();

    await clickElementPoint(page, second);
    await expect(second).toHaveClass(/is-selected/);
    await expect(first).not.toHaveClass(/is-selected/);
    expect(await page.evaluate(() => window.__AFV_TEST__.getState().selection)).toEqual({ kind: "item", id: "cashReserve" });
    await expect(page.locator(".selection-inspector")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("clicking another tile exits inline tile editing and switches selection", async ({ page }) => {
    const errors = await openApp(page);
    const first = page.locator(".canvas-item[data-item-id='managedPortfolio']");
    const second = page.locator(".canvas-item[data-item-id='cashReserve']");
    const firstValue = first.locator(".finance-value");

    await firstValue.click();
    await expect(firstValue).toHaveAttribute("contenteditable", "true");

    await clickElementPoint(page, second);
    await expect(second).toHaveClass(/is-selected/);
    await expect(first).not.toHaveClass(/is-selected/);
    expect(await page.evaluate(() => window.__AFV_TEST__.getState().selection)).toEqual({ kind: "item", id: "cashReserve" });
    expect(errors).toEqual([]);
  });

  test("clicking another tile switches selection after opening inspector data", async ({ page }) => {
    const errors = await openApp(page);
    const first = page.locator(".canvas-item[data-item-id='managedPortfolio']");
    const second = page.locator(".canvas-item[data-item-id='cashReserve']");

    await clickElementPoint(page, first);
    await page.locator(".selection-inspector [data-inspector-tab='selection-data']").click();
    await expect(page.locator(".selection-inspector[data-inspector-section='selection-data']")).toBeVisible();

    await clickElementPoint(page, second);
    await expect(second).toHaveClass(/is-selected/);
    await expect(first).not.toHaveClass(/is-selected/);
    expect(await page.evaluate(() => window.__AFV_TEST__.getState().selection)).toEqual({ kind: "item", id: "cashReserve" });
    expect(errors).toEqual([]);
  });

  test("clicking another tile value starts editing that tile without closing the inspector", async ({ page }) => {
    const errors = await openApp(page);
    const first = page.locator(".canvas-item[data-item-id='managedPortfolio']");
    const second = page.locator(".canvas-item[data-item-id='cashReserve']");
    const secondValue = second.locator(".finance-value");

    await clickElementPoint(page, first);
    await expect(page.locator(".selection-inspector")).toBeVisible();

    await secondValue.click();
    await expect(second).toHaveClass(/is-selected/);
    await expect(secondValue).toHaveAttribute("contenteditable", "true");
    expect(await page.evaluate(() => window.__AFV_TEST__.getState().selection)).toEqual({ kind: "item", id: "cashReserve" });
    expect(errors).toEqual([]);
  });

  test("opening the inspector keeps other story tiles clickable instead of trapped underneath it", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("estate"));
    await page.locator("#fitButton").click();

    await clickElementPoint(page, page.locator(".canvas-item[data-item-id='cashReserve']"));
    await expect(page.locator(".selection-inspector")).toBeVisible();

    const target = page.locator(".canvas-item[data-item-id='beneficiaries']");
    const hit = await target.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const element = document.elementFromPoint(point.x, point.y);
      return {
        hitItem: element?.closest?.(".canvas-item")?.getAttribute("data-item-id") || null,
        hitInspector: Boolean(element?.closest?.(".selection-inspector"))
      };
    });
    expect(hit).toEqual({ hitItem: "beneficiaries", hitInspector: false });

    await clickElementPoint(page, target);
    expect(await page.evaluate(() => window.__AFV_TEST__.getState().selection)).toEqual({ kind: "item", id: "beneficiaries" });
    expect(errors).toEqual([]);
  });

  test("specific Data and Style inspector sections replace floating popovers", async ({ page }) => {
    const errors = await openApp(page);
    await clickElementPoint(page, page.locator(".canvas-item[data-item-id='cashReserve']"));

    await page.locator("[data-popover='selection-data']").click();
    await expect(page.locator(".selection-inspector[data-inspector-section='selection-data']")).toBeVisible();
    await expect(page.locator(".selection-inspector input[data-input='finance-value']")).toBeVisible();

    await page.locator("[data-popover='selection-style']").click();
    await expect(page.locator(".selection-inspector[data-inspector-section='selection-style']")).toBeVisible();
    expect(await page.locator(".selection-inspector [data-field='visual']").count()).toBeGreaterThan(0);

    await page.mouse.click(220, 140);
    await expect(page.locator(".selection-inspector")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("container sleeves are selectable and editable without becoming standalone tiles", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("estate"));
    await page.locator("#fitButton").click();

    const adminSleeve = page.locator(".canvas-item[data-item-id='cashReserve'] .sub-bucket-card[data-sub-bucket-id='admin']");
    await expect(adminSleeve).toBeVisible();
    await adminSleeve.locator(".sub-bucket-label").click();

    expect(await page.evaluate(() => window.__AFV_TEST__.getState().selection)).toEqual({
      kind: "sleeve",
      itemId: "cashReserve",
      sleeveId: "admin"
    });
    await expect(page.locator(".selection-inspector")).toContainText("Sleeve");
    await expect(page.locator(".selection-popover")).toHaveCount(0);

    const label = adminSleeve.locator(".sub-bucket-label");
    await expect(label).toHaveAttribute("contenteditable", "true");
    await label.fill("Executor Reserve");
    await page.keyboard.press("Enter");

    const value = adminSleeve.locator(".sub-bucket-value");
    await value.click();
    await expect(value).toHaveAttribute("contenteditable", "true");
    await value.fill("85000");
    await page.keyboard.press("Enter");

    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    const parent = state.items.find((item) => item.id === "cashReserve");
    const sleeve = state.financeData[parent.financeId].subBuckets.find((bucket) => bucket.id === "admin");
    expect(sleeve).toMatchObject({ label: "Executor Reserve", value: 85000 });
    await expect(adminSleeve.locator(".sub-bucket-label")).toHaveText("Executor Reserve");
    await expect(page.locator(".canvas-item[data-item-id='admin']")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("visible finance values edit directly from the canvas", async ({ page }) => {
    const errors = await openApp(page);
    const value = page.locator(".canvas-item[data-item-id='cashReserve'] .finance-value");

    await value.click();
    await expect(value).toHaveAttribute("contenteditable", "true");
    await value.fill("640000");
    await value.blur();

    await expect(value).not.toHaveAttribute("contenteditable", "true");
    await expect(value).toContainText("$");
    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    const item = state.items.find((entry) => entry.id === "cashReserve");
    expect(state.financeData[item.financeId].value).toBe(640000);
    expect(errors).toEqual([]);
  });

  test("connector amount and relationship edit directly from the label", async ({ page }) => {
    const errors = await openApp(page);
    const label = page.locator(".connector-label[data-connector-id='transfer']");
    const amount = label.locator(".amount");
    const relationship = label.locator(".relationship");

    await amount.click();
    await expect(amount).toHaveAttribute("contenteditable", "true");
    await amount.fill("90000");
    await page.keyboard.press("Enter");
    await expect(amount).toHaveText("$90K");

    await relationship.click();
    await expect(relationship).toHaveAttribute("contenteditable", "true");
    await relationship.fill("Client transfer");
    await page.keyboard.press("Enter");
    await expect(relationship).toHaveText("Client transfer");

    const conn = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((entry) => entry.id === "transfer"));
    expect(conn.amount).toBe(90000);
    expect(conn.label).toBe("Client transfer");
    expect(errors).toEqual([]);
  });

  test("objects win over connector labels when coordinates overlap", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        items: [
          { id: "shapeA", type: "shape", shape: "rounded", label: "Priority shape", subtitle: "", note: "", x: 800, y: 500, w: 260, h: 140, zIndex: 10, style: {} }
        ],
        financeData: {},
        connectors: [
          {
            id: "freeFlow",
            label: "Overlap label",
            flowType: "transfer",
            amount: 50000,
            max: 100000,
            source: { x: 620, y: 500 },
            target: { x: 980, y: 500 },
            routeStyle: "straight",
            strokeStyle: "solid",
            arrowStart: "none",
            arrowEnd: "arrow",
            labelMode: "manual",
            labelPoint: { x: 800, y: 500 },
            colorMode: "flow",
            widthMode: "amount",
            customWidth: 5,
            manualMid: false,
            mid: null
          }
        ]
      });
    });
    await page.locator("#fitButton").click();

    await clickElementPoint(page, page.locator(".canvas-item[data-item-id='shapeA']"));
    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.selection).toEqual({ kind: "item", id: "shapeA" });
    expect(errors).toEqual([]);
  });

  test("blank click clears selection without throwing the world offscreen", async ({ page }) => {
    const errors = await openApp(page);
    await clickElementPoint(page, page.locator(".canvas-item[data-item-id='cashReserve']"));
    const before = await page.evaluate(() => window.__AFV_TEST__.getState().viewport);
    await page.mouse.click(120, 130);
    const after = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(after.selection).toBeNull();
    expect(Math.abs(after.viewport.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.viewport.y - before.y)).toBeLessThan(2);
    expect(errors).toEqual([]);
  });
});

test.describe("connector freedom and visual dynamics", () => {
  test("detached connector endpoints move through explicit handles", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "rollover"));
    await page.locator("[data-action='detach-connector']").click();

    const detached = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "rollover"));
    expect(detached.source.itemId).toBeUndefined();
    expect(detached.target.itemId).toBeUndefined();

    const handle = page.locator(".connector-handle.source");
    await expect(handle).toHaveCount(1);
    const box = await handle.boundingBox();
    expect(box).toBeTruthy();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const clearPoint = await screenFromWorld(page, { x: 1510, y: 180 });
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(clearPoint.x, clearPoint.y, { steps: 8 });
    await page.mouse.up();

    const moved = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "rollover"));
    expect(moved.source.itemId).toBeUndefined();
    expect(Math.hypot(moved.source.x - detached.source.x, moved.source.y - detached.source.y)).toBeGreaterThan(40);
    expect(Math.abs(moved.target.x - detached.target.x)).toBeLessThan(2);
    expect(errors).toEqual([]);
  });

  test("straight connectors do not show bend handles", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      const state = window.__AFV_TEST__.getState();
      const conn = state.connectors.find((entry) => entry.id === "rollover");
      conn.routeStyle = "straight";
      window.__AFV_TEST__.loadDiagram({ ...state, connectors: state.connectors });
      window.__AFV_TEST__.select("connector", "rollover");
    });
    await expect(page.locator(".connector-handle.bend")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("scenario sliders update bucket fill and connected flow labels", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("cashReserve"));
    await page.locator("#fitButton").click();
    const cash = page.locator(".canvas-item[data-item-id='cashBucket']");
    const beforeFill = await cash.evaluate((node) => getComputedStyle(node).getPropertyValue("--fill"));
    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 9000));
    const afterFill = await cash.evaluate((node) => getComputedStyle(node).getPropertyValue("--fill"));
    await expect(page.locator(".connector-label").filter({ hasText: "Monthly distribution" })).toContainText("$");
    expect(afterFill).not.toBe(beforeFill);
    expect(errors).toEqual([]);
  });
});

test("Stewardship font stacks are local/offline", async ({ page }) => {
  await page.goto("http://localhost:4173/index.html?test=1");
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => document.fonts?.ready);

  const titleFamily = await page.evaluate(() => {
    const el = document.querySelector("h1#templateTitle");
    return getComputedStyle(el).fontFamily;
  });
  expect(titleFamily).toMatch(DISPLAY_FONT_RE);

  const bodyFamily = await page.evaluate(() => {
    const el = document.querySelector(".eyebrow");
    return getComputedStyle(el).fontFamily;
  });
  expect(bodyFamily).toMatch(LOCAL_UI_FONT_RE);
});

test("Stewardship theme is default and switchable", async ({ page }) => {
  await page.goto("http://localhost:4173/index.html?test=1");
  await page.waitForFunction(() => window.__AFV_TEST__);
  expect(await page.evaluate(() => document.body.dataset.theme)).toBe("stewardship");

  await page.evaluate(() => window.__AFV_TEST__.setTheme("horizon"));
  expect(await page.evaluate(() => document.body.dataset.theme)).toBe("horizon");

  await page.evaluate(() => window.__AFV_TEST__.setTheme("camino"));
  expect(await page.evaluate(() => document.body.dataset.theme)).toBe("camino");
});

test("Stewardship palette tokens resolve to spec values", async ({ page }) => {
  await page.goto("http://localhost:4173/index.html?test=1");
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => window.__AFV_TEST__.setTheme("stewardship"));

  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      ink: cs.getPropertyValue("--text").trim(),
      brass: cs.getPropertyValue("--metal").trim(),
      gap: cs.getPropertyValue("--gap").trim(),
      surplus: cs.getPropertyValue("--surplus").trim(),
      tradeoff: cs.getPropertyValue("--tradeoff").trim()
    };
  });
  expect(tokens.ink).toBe("#3a3530");
  expect(tokens.brass).toBe("#a8893f");
  expect(tokens.gap).toBe("#8c3829");
  expect(tokens.surplus).toBe("#3a5240");
  expect(tokens.tradeoff).toBe("#8a6f3a");
});

test("Account card uses Stewardship typography and hover state", async ({ page }) => {
  await page.goto("http://localhost:4173/index.html?test=1");
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));

  const card = page.locator(".canvas-item.finance-card").first();
  await expect(card).toHaveCount(1);

  // Headline (account name) — italic display serif stack
  const nameStyle = await card.locator(".finance-name").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, style: cs.fontStyle };
  });
  expect(nameStyle.family).toMatch(DISPLAY_FONT_RE);
  expect(nameStyle.style).toBe("italic");

  // Value — local UI stack, tabular-nums
  const valueStyle = await card.locator(".finance-value").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, variant: cs.fontVariantNumeric };
  });
  expect(valueStyle.family).toMatch(LOCAL_UI_FONT_RE);
  expect(valueStyle.variant).toMatch(/tabular-nums/);

  // Eyebrow (.finance-type) — local UI stack 700, brass-deep, uppercase
  const typeStyle = await card.locator(".finance-type").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      family: cs.fontFamily,
      weight: cs.fontWeight,
      transform: cs.textTransform,
      color: cs.color
    };
  });
  expect(typeStyle.family).toMatch(LOCAL_UI_FONT_RE);
  expect(typeStyle.weight).toBe("700");
  expect(typeStyle.transform).toBe("uppercase");
  expect(typeStyle.color).not.toBe("rgba(0, 0, 0, 0)");

  // Surface — paper bg + 1px hairline
  const surfaceBefore = await card.locator(".item-surface").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      borderColor: cs.borderTopColor,
      borderWidth: cs.borderTopWidth,
      bg: cs.backgroundColor,
      backgroundImage: cs.backgroundImage
    };
  });
  expect(surfaceBefore.borderWidth).toBe("1px");
  expect(surfaceBefore.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(surfaceBefore.backgroundImage).not.toBe("none");

  // Hover — brass border + 8% brass tint
  await card.locator(".item-surface").first().hover({ force: true });
  // wait past the 180ms transition so computed colors settle
  await page.waitForTimeout(260);
  const surfaceHover = await card.locator(".item-surface").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { borderColor: cs.borderTopColor, bg: cs.backgroundColor, outline: cs.outlineStyle, shadow: cs.boxShadow };
  });
  expect(surfaceHover.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(surfaceHover.outline).not.toBe("none");
  expect(surfaceHover.shadow).not.toBe("none");
});

test("Brand mark renders three-peak silhouette + Aster Ridge wordmark", async ({ page }) => {
  await page.goto("http://localhost:4173/index.html?test=1");
  await page.waitForFunction(() => window.__AFV_TEST__);

  const pathD = await page.evaluate(() => document.querySelector(".brand-square svg path")?.getAttribute("d"));
  expect(pathD).toBe("M 0,32 L 4,30 L 8,24 L 11,28 L 15,16 L 18,22 L 21,4 L 25,15 L 32,32 Z");

  const wordmark = await page.evaluate(() => document.querySelector(".brand-text .wm")?.textContent.trim());
  expect(wordmark).toBe("Aster Ridge");

  const subline = await page.evaluate(() => document.querySelector(".brand-text .sub")?.textContent.trim());
  expect(subline).toBe("Wealth");
});

test("Connector renders amount + italic relationship label", async ({ page }) => {
  await page.goto("http://localhost:4173/index.html?test=1");
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));

  const labelStrong = await page.locator(".connector-label strong.amount").first().evaluate((el) => getComputedStyle(el).fontFamily);
  expect(labelStrong).toMatch(LOCAL_UI_FONT_RE);

  const labelSpan = await page.locator(".connector-label span.relationship").first().evaluate((el) => getComputedStyle(el).fontStyle);
  expect(labelSpan).toBe("italic");

  // Content order on initial render: <strong> = amount ($/digits), <span> = relationship words
  const strongText = (await page.locator(".connector-label strong.amount").first().textContent()).trim();
  expect(strongText).toMatch(/[\$\d]/);

  const spanText = (await page.locator(".connector-label span.relationship").first().textContent()).trim();
  expect(spanText.length).toBeGreaterThan(0);
  expect(spanText).not.toMatch(/^[\$\d\.,kKmMbB\s]+$/);

  // Force the incremental update path (updateConnectorValues) and re-verify content order.
  await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 9000));

  const strongAfter = (await page.locator(".connector-label strong.amount").first().textContent()).trim();
  expect(strongAfter).toMatch(/[\$\d]/);

  const spanAfter = (await page.locator(".connector-label span.relationship").first().textContent()).trim();
  expect(spanAfter.length).toBeGreaterThan(0);
  expect(spanAfter).not.toMatch(/^[\$\d\.,kKmMbB\s]+$/);
});

test("Paycheck tile emits data-state attribute matching canvas state", async ({ page }) => {
  await page.goto("http://localhost:4173/index.html?test=1");
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));

  // Drive the cashflow summary to a near-zero delta so the helper's neutral
  // band (±25) is reachable. Retirement defaults: need=7500, guaranteed=0,
  // annuity=1800 (annuityOn). Setting monthlyDistribution=5700 yields
  // mapped = 5700 + 0 + 1800 = 7500 → delta=0 → neutral. Under the legacy
  // binary `cashflow.gap >= 0` fallback this would have classified as
  // "surplus". Exercises the incremental update path (updateItemValues).
  await page.evaluate(() => {
    window.__AFV_TEST__.setScenario("monthlyDistribution", 5700);
  });

  const state = await page.locator(".paycheck-surface").first().getAttribute("data-state");
  expect(state).toBe("neutral");

  const ruleColor = await page.locator(".paycheck-surface").first().evaluate((el) => getComputedStyle(el).borderLeftColor);
  expect(ruleColor).not.toBe("rgba(0, 0, 0, 0)");
});

test("Roth Conversion paycheck tile renders tradeoff state", async ({ page }) => {
  await page.goto("http://localhost:4173/index.html?test=1");
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => window.__AFV_TEST__.loadTemplate("roth"));

  await expect(page.locator(".canvas-item[data-item-id='taxReserve'] .tax-reserve-tradeoff-surface")).toHaveAttribute("data-state", "tradeoff");
});

test("Stage shows mountain-motif atmospheric SVGs", async ({ page }) => {
  await page.goto("http://localhost:4173/index.html?test=1");
  await page.waitForFunction(() => window.__AFV_TEST__);

  const watermarkExists = await page.locator(".motif-title-watermark").count();
  expect(watermarkExists).toBeGreaterThan(0);

  const ridgelineExists = await page.locator(".motif-ridgeline").count();
  expect(ridgelineExists).toBeGreaterThan(0);

  const watermarkOpacity = await page.locator(".motif-title-watermark").first().evaluate((el) => parseFloat(getComputedStyle(el).opacity));
  expect(watermarkOpacity).toBeLessThanOrEqual(0.10);
});

test("Topbar uses neutral graphite chrome border", async ({ page }) => {
  await page.goto("http://localhost:4173/index.html?test=1");
  await page.waitForFunction(() => window.__AFV_TEST__);

  const chrome = await page.locator(".topbar").evaluate((el) => {
    const styles = getComputedStyle(el);
    const border = (styles.borderBottomColor.match(/\d+/g)?.map(Number) || []).slice(0, 3);
    return {
      borderImage: styles.borderImageSource,
      border,
      bg: getComputedStyle(document.documentElement).getPropertyValue("--chrome-bg").trim()
    };
  });
  expect(chrome.borderImage).toBe("none");
  expect(chrome.bg).toMatch(/^#[0-9a-f]{6}$/i);
  expect(Math.max(...chrome.border) - Math.min(...chrome.border)).toBeLessThanOrEqual(18);
});
