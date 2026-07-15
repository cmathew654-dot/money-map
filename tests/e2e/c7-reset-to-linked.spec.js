const { test, expect } = require("@playwright/test");

// C7 — "Reset to linked" must reset the money, not just the MANUAL badge. The
// linked amount is the driver value when defined, else the connector's authored
// template amount (rollover has no scenario field). Reset restores it and
// commits exactly one reversible history entry. Assertions read the rendered
// account cards against independently recomputed balances.

const APP_URL = "http://127.0.0.1:54217/index.html?test=1";

async function openTemplate(page, templateId) {
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.locator('.template-catalog-card[data-template-id="' + templateId + '"]').click();
  await page.locator("#fitButton").click();
}

function k(value) {
  return "$" + Math.round(value / 1000).toLocaleString("en-US") + "K";
}

function card(page, itemId) {
  return page.locator('.canvas-item[data-item-id="' + itemId + '"] .finance-value').first();
}

test("Reset to linked restores the rollover money and is one-step undoable", async ({ page }) => {
  await openTemplate(page, "retirement");
  const st = await page.evaluate(() => window.__AFV_TEST__.getState());
  const empBase = st.financeData.employer401k.value; // 920K
  const iraBase = st.financeData.rolloverIra.value; // 180K
  const premium = st.connectors.find((c) => c.id === "annuityPremium").amount; // 250K
  const linked = st.connectors.find((c) => c.id === "rollover").amount; // 325K authored

  // Independent recompute of the two balances driven by the rollover amount.
  const emp = (rollover) => k(empBase - rollover);
  const ira = (rollover) => k(iraBase + rollover - premium);

  // Baseline linked state.
  await expect(card(page, "employer401k")).toHaveText(emp(linked)); // 595K
  await expect(card(page, "rolloverIra")).toHaveText(ira(linked)); // 255K

  // Select the (hidden-label) rollover flow and edit it to $400K manual.
  await page.evaluate(() => window.__AFV_TEST__.select("connector", "rollover"));
  const amount = page.locator('.selection-inspector [data-input="connector-amount"]');
  await amount.fill("400000");
  await amount.press("Enter");
  await amount.blur();
  await expect(card(page, "employer401k")).toHaveText(emp(400000)); // 520K
  await expect(card(page, "rolloverIra")).toHaveText(ira(400000)); // 330K

  // Reset to linked returns the money to $325K.
  await page.locator('.selection-inspector [data-action="reset-connector-amount-link"]').click();
  await expect(card(page, "employer401k")).toHaveText(emp(linked)); // 595K
  await expect(card(page, "rolloverIra")).toHaveText(ira(linked)); // 255K

  // Undo returns exactly one step, to the manual $400K.
  await page.keyboard.press("Control+z");
  await expect(card(page, "employer401k")).toHaveText(emp(400000)); // 520K
  await expect(card(page, "rolloverIra")).toHaveText(ira(400000)); // 330K
});
