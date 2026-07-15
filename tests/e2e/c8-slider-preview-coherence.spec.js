const { test, expect } = require("@playwright/test");

// C8 — a live amount slider must not expose two financial states at once. During
// the slider `input` (before `change`) the banner, account balance, and fill
// must move with the connector, not lag a step behind. We fire a raw `input`
// event (no `change`) and assert the rendered banner + account card already
// agree with the new connector amount, recomputed independently.

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

function money(value) {
  return "$" + Math.round(value).toLocaleString("en-US");
}

async function paycheckMapped(page) {
  const text = await page.locator('.canvas-item[data-item-id="paycheck"] [data-cashflow-value="mapped"]').innerText();
  return Number(text.replace(/[^0-9.-]/g, ""));
}

test("slider input drives coupled banner + account balance (no split state)", async ({ page }) => {
  await openTemplate(page, "retirementPaycheck");
  const st = await page.evaluate(() => window.__AFV_TEST__.getState());
  const portfolioBase = st.financeData.portfolio.value; // 920K
  const draw = st.connectors.find((c) => c.id === "portfolioDraw");
  const oldMonthly = draw.amount / 12; // 4000

  await page.locator('.connector-label[data-connector-id="portfolioDraw"]').click();
  const mappedBefore = await paycheckMapped(page);

  const newMonthly = 8000;
  // Fire a mid-drag input WITHOUT a change event (simulates an in-progress drag).
  await page.locator('[data-input="connector-amount-range"]').evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, newMonthly);

  // The connector, the account balance, AND the banner all reflect $8,000/mo.
  await expect(page.locator('.connector-label[data-connector-id="portfolioDraw"] .amount')).toHaveText(money(newMonthly) + "/mo");
  await expect(page.locator('.canvas-item[data-item-id="portfolio"] .finance-value').first())
    .toHaveText(k(portfolioBase - newMonthly * 12)); // 920 - 96 = 824K

  const expectedMapped = mappedBefore - oldMonthly + newMonthly; // +4000
  await expect
    .poll(async () => paycheckMapped(page))
    .toBe(expectedMapped);
});
