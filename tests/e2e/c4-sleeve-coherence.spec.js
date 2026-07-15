const { test, expect } = require("@playwright/test");

// C4 — sleeve coherence. Where an account has sleeves the parent value must
// derive from the sleeve sum plus a non-negative Unallocated remainder, so the
// parent card, computed balance, and inventory always agree with the displayed
// sleeves. Assertions compare RENDERED DOM text to independently recomputed
// sums (sleeve raw values from state, or base + funding), never state-vs-state.

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

function inventoryRow(page, itemId) {
  return page.locator('.inventory-row[data-inventory-id="' + itemId + '"] .row-value');
}

function sleeveSum(financeData, id) {
  return financeData[id].subBuckets.reduce((s, b) => s + (Number(b.value) || 0), 0);
}

test.describe("C4 sleeve coherence", () => {
  test("Roth Family Trust: parent, computed, inventory equal the sleeve sum", async ({ page }) => {
    await openTemplate(page, "roth");
    const st = await page.evaluate(() => window.__AFV_TEST__.getState());
    const expected = sleeveSum(st.financeData, "familyTrust"); // 300 + 420 + 120 = 840K
    await expect(card(page, "familyTrust")).toHaveText(k(expected));
    await expect(inventoryRow(page, "familyTrust")).toHaveText(k(expected));
  });

  test("Estate Revocable Trust: parent grows to the sleeve sum", async ({ page }) => {
    await openTemplate(page, "estate");
    const st = await page.evaluate(() => window.__AFV_TEST__.getState());
    const expected = sleeveSum(st.financeData, "revocableTrust"); // 260 + 300 + 90 + 70 = 720K
    await expect(card(page, "revocableTrust")).toHaveText(k(expected));
    await expect(inventoryRow(page, "revocableTrust")).toHaveText(k(expected));
  });

  test("Estate Liquidity Reserve: explicit Unallocated remainder closes the gap", async ({ page }) => {
    await openTemplate(page, "estate");
    const st = await page.evaluate(() => window.__AFV_TEST__.getState());
    const sleeves = sleeveSum(st.financeData, "cashReserve"); // 110 + 70 + 100 = 280K
    const base = st.financeData.cashReserve.value; // 280K authored base
    const funding = st.connectors.find((c) => c.id === "taxReserveFunding").amount; // 180K into reserve
    const expectedParent = base + funding; // 460K
    const expectedUnallocated = expectedParent - sleeves; // 180K

    await expect(card(page, "cashReserve")).toHaveText(k(expectedParent));
    await expect(inventoryRow(page, "cashReserve")).toHaveText(k(expectedParent));
    const unallocated = page.locator('.canvas-item[data-item-id="cashReserve"] [data-sub-bucket-role="unallocated"] .sub-bucket-value');
    await expect(unallocated).toHaveText(k(expectedUnallocated));
  });

  test("live sleeve edit grows the parent to match (retirement Liquidity Bucket)", async ({ page }) => {
    await openTemplate(page, "retirement");
    // Select the Cash Reserve sleeve and edit it from $75K to $500K.
    await page.locator('.canvas-item[data-item-id="cashReserve"] .sub-bucket-card[data-sub-bucket-id="cash"]').click();
    const sleeveInput = page.locator('.selection-inspector [data-input="sleeve-value"]');
    await sleeveInput.fill("500000");
    await sleeveInput.press("Tab");

    const st = await page.evaluate(() => window.__AFV_TEST__.getState());
    const expected = sleeveSum(st.financeData, "cashReserve"); // 500 + 50 + 25 = 575K
    expect(expected).toBe(575000);
    await expect(card(page, "cashReserve")).toHaveText(k(expected));
    await expect(inventoryRow(page, "cashReserve")).toHaveText(k(expected));
  });
});
