const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";
const DISPLAY_FONT_RE = /Cormorant Garamond|Book Antiqua|Georgia|serif/i;

const PAYCHECK_TEMPLATES = [
  "retirement",
  "roth",
  "annuity",
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

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function openApp(page, templateId = "retirement", themeId = "stewardship") {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => window.__AFV_TEST__.setTheme(id), themeId);
  await page.waitForSelector(`body[data-theme="${themeId}"]`);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.locator("#fitButton").click();
  await page.evaluate(() => document.fonts?.ready);
  await settle(page);
  return errors;
}

async function paycheckMetrics(page) {
  return page.evaluate(() => {
    const paycheck = document.querySelector(".finance-paycheck .paycheck-surface");
    const gap = paycheck?.querySelector('[data-cashflow-value="gap"]');
    const gapLabel = paycheck?.querySelector('[data-cashflow-value="gap-label"]');
    const mapped = paycheck?.querySelector('[data-cashflow-value="mapped"]');
    const need = paycheck?.querySelector('[data-cashflow-value="need"]');
    const miniGrid = paycheck?.querySelector(".cashflow-mini-grid");
    const accountNames = [...document.querySelectorAll(".canvas-item:not(.finance-paycheck) .finance-surface:not(.finance-tag-surface) .finance-name")];
    const accountValues = [...document.querySelectorAll(".canvas-item:not(.finance-paycheck) .finance-surface:not(.finance-tag-surface) .finance-value")];
    const root = getComputedStyle(document.documentElement);

    function fontSize(node) {
      return node ? Number.parseFloat(getComputedStyle(node).fontSize) : 0;
    }

    function minFontSize(nodes) {
      return nodes.reduce((min, node) => Math.min(min, fontSize(node)), Number.POSITIVE_INFINITY);
    }

    function maxFontSize(nodes) {
      return nodes.reduce((max, node) => Math.max(max, fontSize(node)), 0);
    }

    return {
      state: paycheck?.dataset.state || "",
      gapText: gap?.textContent?.trim() || "",
      gapLabelText: gapLabel?.textContent?.trim() || "",
      gapFont: fontSize(gap),
      gapFamily: gap ? getComputedStyle(gap).fontFamily : "",
      gapStyle: gap ? getComputedStyle(gap).fontStyle : "",
      gapColor: gap ? getComputedStyle(gap).color : "",
      gapLabelFont: fontSize(gapLabel),
      gapLabelSpacing: gapLabel ? getComputedStyle(gapLabel).letterSpacing : "",
      mappedFont: fontSize(mapped),
      needFont: fontSize(need),
      accountNameMin: Number.isFinite(minFontSize(accountNames)) ? minFontSize(accountNames) : 999,
      accountValueMin: Number.isFinite(minFontSize(accountValues)) ? minFontSize(accountValues) : 999,
      accountValueMax: maxFontSize(accountValues),
      paycheckClientHeight: paycheck?.clientHeight || 0,
      paycheckScrollHeight: paycheck?.scrollHeight || 0,
      miniGridClientHeight: miniGrid?.clientHeight || 0,
      miniGridScrollHeight: miniGrid?.scrollHeight || 0,
      gapToken: root.getPropertyValue("--gap").trim(),
      surplusToken: root.getPropertyValue("--surplus").trim()
    };
  });
}

function expectHeroGap(metrics, templateId) {
  expect(metrics.gapFont, `${templateId} gap font size`).toBeGreaterThanOrEqual(20);
  expect(metrics.gapFont, `${templateId} gap versus mapped`).toBeGreaterThan(metrics.mappedFont * 2);
  expect(metrics.gapFont, `${templateId} gap versus need`).toBeGreaterThanOrEqual(metrics.needFont * 0.55);
  expect(metrics.gapFont, `${templateId} gap versus account values`).toBeGreaterThan(metrics.accountValueMax);
  expect(metrics.gapFamily, `${templateId} display font`).toMatch(DISPLAY_FONT_RE);
  expect(metrics.gapStyle, `${templateId} italic gap`).toBe("italic");
  expect(metrics.gapLabelFont, `${templateId} readable status label`).toBeGreaterThanOrEqual(10);
  expect(metrics.gapLabelSpacing, `${templateId} label tracking`).not.toBe("normal");
  expect(metrics.accountNameMin, `${templateId} account names remain legible`).toBeGreaterThanOrEqual(9);
  expect(metrics.accountValueMin, `${templateId} account values remain legible`).toBeGreaterThanOrEqual(12);
  expect(metrics.paycheckScrollHeight, `${templateId} paycheck surface remains unclipped`).toBeLessThanOrEqual(metrics.paycheckClientHeight + 1);
  expect(metrics.miniGridScrollHeight, `${templateId} cashflow mini grid remains unclipped`).toBeLessThanOrEqual(metrics.miniGridClientHeight + 1);
}

test.describe("gap elevation", () => {
  test("paycheck templates render the gap or surplus as a hero metric", async ({ page }) => {
    const errors = await openApp(page);
    for (const templateId of PAYCHECK_TEMPLATES) {
      await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
      await page.locator("#fitButton").click();
      await settle(page);

      await expect(page.locator(".finance-paycheck"), templateId).toHaveCount(1);
      const metrics = await paycheckMetrics(page);
      expectHeroGap(metrics, templateId);
    }
    expect(errors).toEqual([]);
  });

  test("gap color follows theme state tokens", async ({ page }) => {
    for (const themeId of ["stewardship", "horizon", "camino"]) {
      const errors = await openApp(page, "retirementPaycheck", themeId);
      await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 2500));
      await settle(page);

      const metrics = await paycheckMetrics(page);
      const tokenColor = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--gap)";
        document.body.appendChild(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      });
      expect(metrics.state, themeId).toBe("gap");
      expect(metrics.gapColor, themeId).toBe(tokenColor);
      expect(errors).toEqual([]);
    }
  });

  test("scenario changes update the same gap node through the live path", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    const before = await paycheckMetrics(page);
    expect(before.gapLabelText).toBe("Gap");
    expect(before.gapText).toBe("$1,700");

    await page.evaluate(() => {
      document.querySelector('[data-cashflow-value="gap"]').dataset.phase1Probe = "still-here";
      window.__AFV_TEST__.setScenario("monthlyDistribution", 6000);
    });
    await settle(page);

    const probe = await page.locator('[data-cashflow-value="gap"]').getAttribute("data-phase1-probe");
    const after = await paycheckMetrics(page);
    expect(probe).toBe("still-here");
    expect(after.gapLabelText).toBe("Surplus");
    expect(after.gapText).toBe("$300");
    expectHeroGap(after, "retirement live update");
    expect(errors).toEqual([]);
  });

  test("estate remains a no-op because it has no paycheck tile", async ({ page }) => {
    const errors = await openApp(page, "estate");
    await expect(page.locator(".finance-paycheck")).toHaveCount(0);
    await expect(page.locator('[data-cashflow-value="gap"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
