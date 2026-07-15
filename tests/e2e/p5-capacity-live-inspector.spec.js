const { test, expect } = require("@playwright/test");

// P5 — parent Capacity was only reachable through a dead HUD renderer, so the
// live inspector could not edit the reference that drives fill %, overflow, and
// slider maxima. The live inspector must now expose a Capacity input that is
// history-committed like Value.

const APP_URL = "http://127.0.0.1:54217/index.html?test=1";

async function openTemplate(page, templateId) {
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.locator('.template-catalog-card[data-template-id="' + templateId + '"]').click();
  await page.locator("#fitButton").click();
}

test("live inspector edits parent Capacity, driving overflow, and is undoable", async ({ page }) => {
  await openTemplate(page, "retirement");
  const portfolio = page.locator('.canvas-item[data-item-id="managedPortfolio"]');
  await portfolio.click();

  // The capacity control now lives in the live inspector (was 0 elements).
  const capacity = page.locator('.selection-inspector [data-input="finance-capacity"]');
  await expect(capacity).toHaveCount(1);

  // Not overflowing at the authored capacity.
  await expect(portfolio).not.toHaveAttribute("data-state", "overflow");

  // Lowering capacity below the computed value drives the overflow state live.
  await capacity.fill("100000");
  await capacity.press("Tab");
  await expect(portfolio).toHaveAttribute("data-state", "overflow");

  // Capacity edits are history-committed like Value.
  await page.keyboard.press("Control+z");
  await expect(portfolio).not.toHaveAttribute("data-state", "overflow");
});
