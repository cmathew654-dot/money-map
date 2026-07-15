const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";
const cashflowTemplates = [
  "retirementPaycheck",
  "socialSecurityBridge",
  "bucketStrategy",
  "rmdTax",
  "withdrawalSequencing",
  "cashCleanup",
  "annuityIncomeFloor",
  "executiveComp",
  "businessOwner",
  "survivorIncome"
];

async function openApp(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
  await page.locator("#fitButton").click();
  return errors;
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test.describe("cashflow-first visual reset", () => {
  test("retirement template makes monthly need and gap explicit", async ({ page }) => {
    const errors = await openApp(page);
    await expect(page.locator(".finance-paycheck[data-item-id='clientIncome']")).toBeVisible();
    await expect(page.locator(".finance-paycheck[data-item-id='clientIncome']")).toContainText("Monthly Need");
    await expect(page.locator(".finance-paycheck[data-item-id='clientIncome']")).toContainText("$7,500");
    await expect(page.locator(".cashflow-strip")).toContainText("Gap");
    await expect(page.locator(".cashflow-strip")).toContainText("$1,700");

    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 6000));
    await settle(page);

    await expect(page.locator(".cashflow-strip")).toContainText("Surplus");
    await expect(page.locator(".cashflow-strip")).toContainText("$300");
    await expect(page.locator(".finance-paycheck[data-item-id='clientIncome']")).toContainText("$7,800");
    expect(errors).toEqual([]);
  });

  test("category changes semantics while visual chips control appearance", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "cashReserve");
      window.__AFV_TEST__.openPopover("selection-data");
    });
    await page.locator(".selection-inspector [data-field='category'][data-value='brokerage']").click();

    let state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.financeData.cashReserve.category).toBe("brokerage");
    expect(state.items.find((item) => item.id === "cashReserve").visual).toBe("bucket");
    await expect(page.locator(".canvas-item[data-item-id='cashReserve']")).toHaveClass(/finance-bucket/);
    await expect(page.locator(".canvas-item[data-item-id='cashReserve'] .bucket-vessel")).toBeVisible();

    await page.evaluate(() => window.__AFV_TEST__.openPopover("selection-style"));
    await page.locator(".selection-inspector [data-field='visual'][data-value='card']").click();
    state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.items.find((item) => item.id === "cashReserve").visual).toBe("card");
    await expect(page.locator(".canvas-item[data-item-id='cashReserve']")).toHaveClass(/finance-card/);

    await page.evaluate(() => window.__AFV_TEST__.openPopover("selection-style"));
    await page.locator(".selection-inspector [data-field='visual'][data-value='bucket']").click();
    await expect(page.locator(".canvas-item[data-item-id='cashReserve']")).toHaveClass(/finance-bucket/);
    await expect(page.locator(".canvas-item[data-item-id='cashReserve'] .bucket-vessel")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("policy tiles do not render the old decorative circle artifact", async ({ page }) => {
    const errors = await openApp(page);
    const afterContent = await page.locator(".canvas-item[data-item-id='incomeAnnuity'] .finance-surface").evaluate((node) => getComputedStyle(node, "::after").content);
    expect(afterContent).toBe("none");
    expect(errors).toEqual([]);
  });

  test("cashflow template library entries load with a monthly need tile", async ({ page }) => {
    const errors = await openApp(page);
    for (const templateId of cashflowTemplates) {
      await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
      await page.locator("#fitButton").click();
      await settle(page);
      await expect(page.locator(".finance-paycheck"), templateId).toHaveCount(1);
      await expect(page.locator(".cashflow-strip"), templateId).toContainText("Need");
    }
    expect(errors).toEqual([]);
  });

  test("presentation mode is client-facing, not a dimmed editor overlay", async ({ page }) => {
    const errors = await openApp(page);
    await page.locator("#presentationButton").click();
    await settle(page);

    await expect(page.locator("body")).toHaveClass(/presentation/);
    await expect(page.locator(".topbar")).toBeHidden();
    await expect(page.locator(".canvas-dock")).toBeHidden();
    await expect(page.locator(".scenario-rail")).toBeVisible();
    await expect(page.locator(".scenario-grid")).toBeHidden();

    const railOpacity = await page.locator(".scenario-rail").evaluate((node) => Number(getComputedStyle(node).opacity));
    expect(railOpacity).toBeGreaterThan(0.95);
    const bodyBg = await page.locator("body").evaluate((node) => getComputedStyle(node).backgroundImage);
    expect(bodyBg).not.toContain("rgb(47, 48, 45)");
    expect(errors).toEqual([]);
  });
});
