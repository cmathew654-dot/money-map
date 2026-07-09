const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:4173/index.html?test=1";

const TEXT_SOFT = {
  horizon: "#b8ad9b",
  camino: "#596371"
};

const FEE_FLOW = {
  horizon: "#d96650",
  camino: "#8c3829"
};

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255
  };
}

function channelToLinear(value) {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function openApp(page) {
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
}

async function loadFeeDiagram(page) {
  await page.evaluate(() => {
    window.__AFV_TEST__.loadDiagram({
      items: [
        {
          id: "source",
          type: "finance",
          visual: "card",
          label: "Advisory Account",
          subtitle: "Managed assets",
          note: "Quarterly fee source",
          x: 660,
          y: 500,
          w: 250,
          h: 132,
          zIndex: 20,
          financeId: "source",
          style: {}
        },
        {
          id: "target",
          type: "finance",
          visual: "taxTag",
          label: "Fee Reserve",
          subtitle: "Tax / fee tag",
          note: "Advisor-entered estimate",
          x: 1040,
          y: 500,
          w: 210,
          h: 90,
          zIndex: 20,
          financeId: "target",
          style: {}
        }
      ],
      financeData: {
        source: { category: "brokerage", value: 500000, capacity: 700000, baseValue: 500000 },
        target: { category: "cash", value: 12000, capacity: 50000, baseValue: 12000 }
      },
      connectors: [
        {
          id: "fee-flow",
          label: "Advisor fee",
          flowType: "fee",
          amount: 12000,
          max: 50000,
          source: { itemId: "source" },
          target: { itemId: "target" },
          routeStyle: "smartArc",
          strokeStyle: "solid",
          arrowStart: "none",
          arrowEnd: "arrow",
          labelMode: "auto",
          labelPoint: null,
          colorMode: "flow",
          widthMode: "amount",
          customWidth: 5,
          manualMid: false,
          mid: null
        }
      ],
      groups: [],
      scenario: {}
    });
  });
}

test.describe("round 2 visual polish", () => {
  for (const [themeId, expectedFee] of Object.entries(FEE_FLOW)) {
    test(`${themeId} fee flow uses the semantic fee color with readable contrast`, async ({ page }) => {
      await openApp(page);
      await page.evaluate((id) => window.__AFV_TEST__.setTheme(id), themeId);
      await loadFeeDiagram(page);

      const tokens = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const flow = document.querySelector(".connector-draw[data-connector-id='fee-flow']");
        return {
          textSoft: root.getPropertyValue("--text-soft").trim().toLowerCase(),
          paper: root.getPropertyValue("--paper").trim().toLowerCase(),
          feeFlow: flow?.style.getPropertyValue("--flow-color").trim().toLowerCase()
        };
      });

      expect(tokens.textSoft).toBe(TEXT_SOFT[themeId]);
      expect(tokens.feeFlow).toBe(expectedFee);
      expect(tokens.feeFlow).not.toBe(tokens.textSoft);
      expect(contrastRatio(tokens.feeFlow, tokens.paper)).toBeGreaterThanOrEqual(4.5);
    });
  }

  test("canvas item hover differs from rest and selected remains stronger", async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));

    const surface = page.locator(".canvas-item.finance-card .item-surface").first();
    const item = page.locator(".canvas-item.finance-card").first();
    const readAffordance = () => surface.evaluate((node) => {
      const cs = getComputedStyle(node);
      return {
        boxShadow: cs.boxShadow,
        outlineColor: cs.outlineColor,
        outlineWidth: cs.outlineWidth,
        outlineOffset: cs.outlineOffset,
        transform: cs.transform
      };
    });

    const resting = await readAffordance();
    await surface.hover({ force: true });
    await page.waitForTimeout(180);
    const hovered = await readAffordance();
    await item.evaluate((node) => node.classList.add("is-selected"));
    await page.waitForTimeout(60);
    const selected = await readAffordance();

    expect(hovered.boxShadow).not.toBe(resting.boxShadow);
    expect(hovered.outlineWidth).not.toBe(resting.outlineWidth);
    expect(selected.outlineWidth).toBe("2px");
    expect(parseFloat(selected.outlineOffset)).toBeGreaterThan(parseFloat(hovered.outlineOffset));
  });

  test("flagged built-in template copy no longer clips under clamps", async ({ page }) => {
    await openApp(page);
    const cases = [
      { template: "rmdTax", itemId: "taxReserve", selector: ".finance-type", text: "Federal/state set-aside" },
      { template: "rmdTax", itemId: "taxReserve", selector: ".finance-note", text: "Estimated withholding" },
      { template: "bucketStrategy", itemId: "cashBucket", selector: ".finance-note", text: "Monthly paycheck source" },
      { template: "annuityIncomeFloor", itemId: "discretionary", selector: ".finance-name", text: "Discretionary Bucket" }
    ];

    for (const row of cases) {
      await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), row.template);
      const metrics = await page.locator(`.canvas-item[data-item-id="${row.itemId}"] ${row.selector}`).evaluate((node) => ({
        text: node.textContent.trim(),
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        lineClamp: getComputedStyle(node).webkitLineClamp
      }));

      expect(metrics.text).toBe(row.text);
      expect(metrics.scrollHeight, `${row.template} ${row.itemId} ${row.selector}`).toBeLessThanOrEqual(metrics.clientHeight + 1);
      expect(Number(metrics.lineClamp), `${row.template} ${row.itemId} ${row.selector}`).toBeGreaterThanOrEqual(2);
    }
  });

  test("empty canvas hint appears only when the object layer is empty", async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.loadDiagram({ items: [], financeData: {}, connectors: [], groups: [], scenario: {} }));

    const hint = await page.locator(".object-layer").evaluate((node) => {
      const before = getComputedStyle(node, "::before");
      return {
        content: before.content,
        pointerEvents: before.pointerEvents,
        display: before.display
      };
    });

    expect(hint.content).toBe('"Choose a starting layout or add an account tile."');
    expect(hint.pointerEvents).toBe("none");
    expect(hint.display).not.toBe("none");

    await page.evaluate(() => document.body.classList.add("presentation"));
    await expect(page.locator(".object-layer")).toHaveCSS("pointer-events", "none");
    await expect.poll(() => page.locator(".object-layer").evaluate((node) => getComputedStyle(node, "::before").content)).toBe("none");
  });
});
