const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:4173/index.html?test=1";

const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  return errors;
}

function readCashflow(page) {
  return page.evaluate(() => {
    const vm = window.__AFV_TEST__.getComputedViewModel();
    return {
      mapped: vm.cashflow.mapped,
      gap: vm.cashflow.gap,
      amts: Object.fromEntries(Object.entries(vm.connectors).map(([id, c]) => [id, c.amount]))
    };
  });
}

// Templates with NO annuity income/premium connector entity. Toggling annuityOn
// must be inert (relevance gating) -- pre-fix it folded phantom annuity income
// into the portfolio-draw connector.
const NO_ANNUITY_TEMPLATES = [
  "roth",
  "estate",
  "cashReserve",
  "socialSecurityBridge",
  "withdrawalSequencing",
  "cashCleanup",
  "executiveComp",
  "businessOwner",
  "survivorIncome",
  "blankHousehold"
];

test.describe("remediation :: relevance gating", () => {
  for (const templateId of NO_ANNUITY_TEMPLATES) {
    test(`${templateId}: annuityOn toggle is inert (no annuity entity)`, async ({ page }) => {
      const errors = await open(page);
      await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
      await settle(page);

      await page.evaluate(() => window.__AFV_TEST__.setScenario("annuityOn", false));
      await settle(page);
      const off = await readCashflow(page);

      await page.evaluate(() => window.__AFV_TEST__.setScenario("annuityOn", true));
      await settle(page);
      const on = await readCashflow(page);

      expect(on.mapped, `${templateId} mapped`).toBe(off.mapped);
      expect(on.gap, `${templateId} gap`).toBe(off.gap);
      expect(on.amts, `${templateId} connector amounts`).toEqual(off.amts);
      expect(errors).toEqual([]);
    });
  }

  test("estate hides the dangling cashflow banner (no paycheck/income node)", async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("estate"));
    await settle(page);
    await page.locator("#scenarioRail").hover();
    expect(await page.locator(".cashflow-strip").count()).toBe(0);
    expect(await page.locator(".paycheck-surface .cashflow-mini-grid").count()).toBe(0);
    expect(errors).toEqual([]);
  });

  test("blank household (0 connectors) does not fabricate mapped income", async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("blankHousehold"));
    await settle(page);
    // With no income connectors, mapped must be an honest $0 -- not the raw
    // scenario monthlyDistribution default the old fallback fabricated.
    const mapped = await page.evaluate(() => window.__AFV_TEST__.getComputedViewModel().cashflow.mapped);
    expect(mapped).toBe(0);
    await expect(page.locator('.paycheck-surface [data-cashflow-value="mapped"]').first()).toHaveText("$0");
    expect(errors).toEqual([]);
  });

  test("roth does not fabricate Mapped income from raw scenario defaults", async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("roth"));
    await settle(page);
    const mapped = await page.evaluate(() => window.__AFV_TEST__.getComputedViewModel().cashflow.mapped);
    // No income connectors cover a paycheck -> mapped is honest $0, not fabricated.
    expect(mapped).toBe(0);
    await page.locator("#scenarioRail").hover();
    await expect(page.locator(".cashflow-strip")).toBeVisible();
    await expect(page.locator(".cashflow-strip")).toContainText("Mapped $0");
    expect(errors).toEqual([]);
  });
});
