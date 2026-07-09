"use strict";

const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:4173/index.html?test=1";
const PAYCHECK_TEMPLATES = [
  "retirement",
  "retirementPaycheck",
  "socialSecurityBridge",
  "bucketStrategy",
  "withdrawalSequencing",
  "survivorIncome"
];

async function openApp(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push("[pageerror] " + err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("[console.error] " + msg.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  return errors;
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function disclosureItem(state) {
  return state.items.find((item) =>
    item.style?.textStyle === "disclosure" ||
    (typeof item.label === "string" && item.label.includes("illustration only"))
  );
}

test.describe("product safety gates", () => {
  for (const templateId of PAYCHECK_TEMPLATES) {
    test(`cashflow tile label matches sign - ${templateId}`, async ({ page }) => {
      const errors = await openApp(page);
      await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
      await settle(page);

      const tile = page.locator(".paycheck-surface").first();

      await page.evaluate(() => {
        window.__AFV_TEST__.setScenario("annuityOn", false);
        window.__AFV_TEST__.setScenario("annuityMonthlyIncome", 0);
        window.__AFV_TEST__.setScenario("guaranteedIncome", 0);
        window.__AFV_TEST__.setScenario("monthlyNeed", 4000);
        window.__AFV_TEST__.setScenario("monthlyDistribution", 7000);
      });
      await settle(page);
      await expect(tile).toHaveAttribute("data-state", "surplus");
      await expect(tile.locator("[data-cashflow-value='gap-label']")).toHaveText("Surplus");

      await page.evaluate(() => {
        window.__AFV_TEST__.setScenario("monthlyNeed", 12000);
        window.__AFV_TEST__.setScenario("monthlyDistribution", 1000);
      });
      await settle(page);
      await expect(tile).toHaveAttribute("data-state", "gap");
      await expect(tile.locator("[data-cashflow-value='gap-label']")).toHaveText("Gap");

      expect(errors).toEqual([]);
    });
  }

  test("recurring connector labels display monthly units while storing annual amounts", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirementPaycheck"));
    await settle(page);

    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    const annuity = state.connectors.find((conn) => conn.scenarioKey === "annuityIncome");
    expect(annuity).toBeTruthy();
    expect(annuity.amount).toBe(state.scenario.annuityMonthlyIncome * 12);

    await expect(page.locator(".connector-label[data-connector-id='annuityIncome'] .amount")).toHaveText("$1,800/mo");
    await expect(page.locator(".connector-label[data-connector-id='guaranteedFlow'] .amount")).toHaveText("$3,000/mo");
    expect(errors).toEqual([]);
  });

  test("disclosure language exists, is locked, and remains attached in presentation mode", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
    await settle(page);

    const normalState = await page.evaluate(() => window.__AFV_TEST__.getState());
    const normalDisclosure = disclosureItem(normalState);
    expect(normalDisclosure).toBeTruthy();
    expect(normalDisclosure.locked).toBe(true);
    expect(normalDisclosure.label).toMatch(/illustration only/i);
    expect(normalDisclosure.label).toMatch(/not a projection/i);
    await expect(page.locator(`[data-item-id="${normalDisclosure.id}"]`)).toBeAttached();

    await page.locator("#presentationButton").click();
    await settle(page);
    await expect(page.locator("body")).toHaveClass(/presentation/);
    await expect(page.locator(`[data-item-id="${normalDisclosure.id}"]`)).toBeAttached();
    expect(errors).toEqual([]);
  });

  test("presentation mode anonymizes demo family labels without mutating state", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
    await settle(page);

    const household = page.locator('.canvas-item[data-item-id="household"]');
    await expect(household).toContainText("Johnson Family");
    await page.locator("#presentationButton").click();
    await settle(page);

    await expect(household).not.toContainText("Johnson");
    await expect(household).toContainText(/Sample (Family|Household)/);

    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.items.find((item) => item.id === "household")?.label).toContain("Johnson Family");
    expect(errors).toEqual([]);
  });

  test("prototype has no web storage persistence and no external requests", async ({ page }) => {
    const outbound = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith("http://localhost") && !url.startsWith("http://127.0.0.1")) outbound.push(url);
    });

    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyNeed", 12345));
    await settle(page);

    const storageBefore = await page.evaluate(() => ({
      local: window.localStorage.length,
      session: window.sessionStorage.length
    }));
    expect(storageBefore).toEqual({ local: 0, session: 0 });

    await page.reload();
    await page.waitForFunction(() => window.__AFV_TEST__);
    await settle(page);

    const stateAfter = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(stateAfter.scenario.monthlyNeed).not.toBe(12345);
    expect(stateAfter.activeTemplateId).toBeFalsy();
    expect(outbound).toEqual([]);
    expect(errors).toEqual([]);
  });
});
