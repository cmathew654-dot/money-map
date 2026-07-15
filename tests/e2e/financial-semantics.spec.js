const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";

async function openApp(page, templateId) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.evaluate(() => window.__AFV_TEST__.fit());
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return errors;
}

async function state(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

function connector(snapshot, id) {
  return snapshot.connectors.find((entry) => entry.id === id);
}

test.describe("financial semantics", () => {
  test("retirement connector semantics distinguish events from monthly cashflow coverage", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    const s = await state(page);

    expect(connector(s, "rollover")).toMatchObject({
      flowType: "rollover",
      cadence: "oneTime",
      timing: "current",
      sourceEffect: "decreaseBalance",
      targetEffect: "increaseBalance",
      domainRole: "rollover"
    });
    expect(s.currentValues.employer401k).toBe(595000);
    expect(s.currentValues.rolloverIra).toBe(255000);

    expect(connector(s, "annuityIncome")).toMatchObject({
      cadence: "monthly",
      timing: "current",
      sourceEffect: "none",
      targetEffect: "cashflowCoverage",
      domainRole: "annuityIncome"
    });
    await expect(page.locator(".connector-label[data-connector-id='annuityIncome'] .amount")).toHaveText("$1,800/mo");
    expect(s.currentValues.clientIncome).toBe(0);
    expect(errors).toEqual([]);
  });

  test("future Social Security is visible but not counted as current bridge coverage", async ({ page }) => {
    const errors = await openApp(page, "socialSecurityBridge");
    const s = await state(page);
    const future = connector(s, "futureIncome");

    expect(future).toMatchObject({
      scenarioKey: "guaranteedIncome",
      cadence: "monthly",
      timing: "future",
      targetEffect: "none",
      domainRole: "deferredSocialSecurity"
    });
    await expect(page.locator(".connector-label[data-connector-id='futureIncome'] .amount")).toHaveText("$3,500/mo");
    await expect(page.locator(".paycheck-surface [data-cashflow-value='mapped']").first()).toHaveText("$5,500");
    await expect(page.locator(".paycheck-surface [data-cashflow-value='gap-label']").first()).toHaveText("Gap");
    expect(errors).toEqual([]);
  });

  test("RMD withholding derives from the RMD story, not Roth conversion math", async ({ page }) => {
    const errors = await openApp(page, "rmdTax");
    let s = await state(page);

    expect(connector(s, "rmdSpend")).toMatchObject({
      flowType: "rmd",
      cadence: "monthly",
      targetEffect: "cashflowCoverage",
      domainRole: "rmdSpendable"
    });
    expect(connector(s, "withholding")).toMatchObject({
      flowType: "tax",
      cadence: "annual",
      targetEffect: "increaseBalance",
      domainRole: "rmdWithholding"
    });
    expect(connector(s, "withholding").amount).toBe(11520);
    expect(s.currentValues.taxReserve).toBe(11520);

    await page.evaluate(() => {
      window.__AFV_TEST__.setScenario("rothConversion", 300000);
      window.__AFV_TEST__.setScenario("monthlyDistribution", 5000);
      window.__AFV_TEST__.setScenario("taxReservePct", 30);
    });
    s = await state(page);
    expect(connector(s, "withholding").amount).toBe(18000);
    expect(s.currentValues.taxReserve).toBe(18000);
    expect(errors).toEqual([]);
  });

  test("QCD is charitable distribution semantics, not beneficiary transfer semantics", async ({ page }) => {
    const errors = await openApp(page, "rmdTax");
    const s = await state(page);
    expect(connector(s, "qcd")).toMatchObject({
      flowType: "qcd",
      cadence: "annual",
      sourceEffect: "decreaseBalance",
      targetEffect: "none",
      domainRole: "qualifiedCharitableDistribution"
    });
    expect(connector(s, "qcd").flowType).not.toBe("beneficiary");
    expect(errors).toEqual([]);
  });

  test("semantic flows do not reverse into nonsense endpoints", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "annuityIncome"));
    const before = connector(await state(page), "annuityIncome");
    await page.locator(".selection-inspector [data-action='reverse-connector']").click();
    const after = connector(await state(page), "annuityIncome");
    expect(after.source).toEqual(before.source);
    expect(after.target).toEqual(before.target);
    expect(after.scenarioKey).toBe("annuityIncome");
    expect(after.targetEffect).toBe("cashflowCoverage");
    expect(errors).toEqual([]);
  });

  test("changing flow type updates accounting semantics, not only visual styling", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "transfer");
      window.__AFV_TEST__.openPopover("connector-data");
    });
    await page.locator("[data-set='connector-field'][data-field='flowType'][data-value='tax']").click();
    const tax = connector(await state(page), "transfer");
    expect(tax).toMatchObject({
      flowType: "tax",
      cadence: "oneTime",
      sourceEffect: "decreaseBalance",
      targetEffect: "increaseBalance",
      domainRole: "tax"
    });

    await page.locator("[data-set='connector-field'][data-field='flowType'][data-value='fee']").click();
    const fee = connector(await state(page), "transfer");
    expect(fee).toMatchObject({
      flowType: "fee",
      sourceEffect: "decreaseBalance",
      targetEffect: "none",
      domainRole: "fee"
    });
    expect(errors).toEqual([]);
  });
});
