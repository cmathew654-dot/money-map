const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";

async function openRothTemplate(page) {
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => window.__AFV_TEST__.loadTemplate("roth"));
}

function taxReserveTile(page) {
  return page.locator(".canvas-item[data-item-id='taxReserve'] .tax-reserve-tradeoff-surface");
}

async function expectRothTradeoffTile(tile, { reserve, conversion, taxRate }) {
  await expect(tile).toHaveAttribute("data-state", "tradeoff");
  await expect(tile.locator('[data-roth-tax-reserve="amount"]')).toContainText(reserve);
  await expect(tile.locator('[data-roth-tax-reserve="conversion"]')).toHaveText(conversion);
  await expect(tile.locator('[data-roth-tax-reserve="tax-rate"]')).toHaveText(taxRate);
  await expect(tile).toContainText("Conversion");
  await expect(tile).toContainText("Tax rate");
  await expect(tile).not.toContainText("/mo");
  await expect(tile).not.toContainText("Mapped");
  await expect(tile).not.toContainText("Gap");
  await expect(tile).not.toContainText("Surplus");
}

test.describe("Round 2 Roth tradeoff tile", () => {
  test("renders the default annual Roth tax reserve semantics", async ({ page }) => {
    await openRothTemplate(page);

    await expectRothTradeoffTile(taxReserveTile(page), {
      reserve: "$30,000",
      conversion: "$125,000",
      taxRate: "24%"
    });
  });

  test("updates annual Roth tax reserve semantics from scenario changes", async ({ page }) => {
    await openRothTemplate(page);

    await page.evaluate(() => {
      window.__AFV_TEST__.setScenario("rothConversion", 200000);
      window.__AFV_TEST__.setScenario("taxReservePct", 30);
      window.__AFV_TEST__.updateItemValues();
    });

    await expectRothTradeoffTile(taxReserveTile(page), {
      reserve: "$60,000",
      conversion: "$200,000",
      taxRate: "30%"
    });
  });
});
