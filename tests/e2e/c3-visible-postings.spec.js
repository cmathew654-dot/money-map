const { test, expect } = require("@playwright/test");

// C3 — no invisible postings. A connector that posts to balances/cashflow must
// be visible. The four templates that previously relied on hidden postings must
// now render those flows, and every rendered balance must equal an independently
// recomputed sum (base value +/- the visible connector amounts) — not a
// state-vs-state echo.

const APP_URL = "http://127.0.0.1:54217/index.html?test=1";

async function openTemplate(page, templateId) {
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.locator('.template-catalog-card[data-template-id="' + templateId + '"]').click();
  await page.locator("#fitButton").click();
}

function k(value) {
  // Matches inventoryDollars() for clean sub-$1M thousands: "$485K".
  return "$" + Math.round(value / 1000).toLocaleString("en-US") + "K";
}

function inventoryRow(page, itemId) {
  return page.locator('.inventory-row[data-inventory-id="' + itemId + '"] .row-value');
}

function connectorPath(page, connectorId) {
  return page.locator('path.connector-draw[data-connector-id="' + connectorId + '"]');
}

test.describe("C3 visible postings", () => {
  test("annuity: hidden $85K buffer transfer is visible and balances agree", async ({ page }) => {
    await openTemplate(page, "annuity");
    const st = await page.evaluate(() => window.__AFV_TEST__.getState());
    const premium = st.connectors.find((c) => c.id === "annuityPremium").amount;
    const transfer = st.connectors.find((c) => c.id === "cashTransfer").amount;
    const expPortfolio = st.financeData.portfolio.value - premium - transfer; // 820 - 250 - 85 = 485K
    const expBuffer = st.financeData.cashBuffer.value + transfer; // 175 + 85 = 260K

    await expect(connectorPath(page, "cashTransfer")).toHaveCount(1);
    await expect(inventoryRow(page, "portfolio")).toHaveText(k(expPortfolio));
    await expect(inventoryRow(page, "cashBuffer")).toHaveText(k(expBuffer));
  });

  test("executive comp: hidden $75K RSU tax is visible and balances agree", async ({ page }) => {
    await openTemplate(page, "executiveComp");
    const st = await page.evaluate(() => window.__AFV_TEST__.getState());
    const rsuTax = st.connectors.find((c) => c.id === "taxFromRsu").amount;
    const invest = st.connectors.find((c) => c.id === "investRsu").amount;
    const bonusTax = st.connectors.find((c) => c.id === "taxFromBonus").amount;
    const expRsu = st.financeData.rsu.value - rsuTax - invest; // 300 - 75 - 180 = 45K
    const expTaxReserve = st.financeData.taxReserve.value + bonusTax + rsuTax; // 120 + 95 + 75 = 290K

    await expect(connectorPath(page, "taxFromRsu")).toHaveCount(1);
    await expect(inventoryRow(page, "rsu")).toHaveText(k(expRsu));
    await expect(inventoryRow(page, "taxReserve")).toHaveText(k(expTaxReserve));
  });

  test("business owner: hidden $66K plan contribution is visible and balances agree", async ({ page }) => {
    await openTemplate(page, "businessOwner");
    const st = await page.evaluate(() => window.__AFV_TEST__.getState());
    const quarterlyTax = st.connectors.find((c) => c.id === "quarterlyTax").amount;
    const plan = st.connectors.find((c) => c.id === "planContribution").amount;
    const surplus = st.connectors.find((c) => c.id === "surplusInvest").amount;
    const expOperating = st.financeData.operatingCash.value - quarterlyTax - plan - surplus; // 520 -160 -66 -140 = 154K
    const expPlan = st.financeData.retirementPlan.value + plan; // 260 + 66 = 326K

    await expect(connectorPath(page, "planContribution")).toHaveCount(1);
    await expect(inventoryRow(page, "operatingCash")).toHaveText(k(expOperating));
    await expect(inventoryRow(page, "retirementPlan")).toHaveText(k(expPlan));
  });

  test("retirement: $250K premium lands in the annuity; card, inventory, ledger agree (C5)", async ({ page }) => {
    await openTemplate(page, "retirement");
    const st = await page.evaluate(() => window.__AFV_TEST__.getState());
    const rollover = st.connectors.find((c) => c.id === "rollover").amount;
    const premium = st.connectors.find((c) => c.id === "annuityPremium").amount;
    const expRolloverIra = st.financeData.rolloverIra.value + rollover - premium; // 180 + 325 - 250 = 255K
    const expAnnuity = st.financeData.incomeAnnuity.value + premium; // 0 + 250 = 250K

    // The premium flow is no longer invisible.
    await expect(connectorPath(page, "annuityPremium")).toHaveCount(1);
    // Ledger/inventory: money landed instead of being burned.
    await expect(inventoryRow(page, "rolloverIra")).toHaveText(k(expRolloverIra));
    await expect(inventoryRow(page, "incomeAnnuity")).toHaveText(k(expAnnuity));
    // Special card "Funding" agrees with the inventory row for the same object.
    const funding = page.locator('.canvas-item[data-item-id="incomeAnnuity"] .annuity-contract-readout');
    await expect(funding).toContainText("Funding");
    await expect(funding).toContainText(k(expAnnuity));
  });
});
