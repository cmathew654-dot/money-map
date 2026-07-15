const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";
const TEMPLATE_IDS = [
  "retirement",
  "roth",
  "annuity",
  "estate",
  "cashReserve",
  "retirementPaycheck",
  "socialSecurityBridge",
  "bucketStrategy",
  "rmdTax",
  "withdrawalSequencing",
  "cashCleanup",
  "annuityIncomeFloor",
  "executiveComp",
  "businessOwner",
  "survivorIncome",
  "blankHousehold"
];

async function openApp(page, templateId = "retirement") {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.locator("#fitButton").click();
  await settle(page);
  return errors;
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function appState(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

async function centerOf(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("advisor demo hardening", () => {
  test("built-in disclosure items are locked in every template", async ({ page }) => {
    const errors = await openApp(page);
    for (const templateId of TEMPLATE_IDS) {
      await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
      const disclosure = (await appState(page)).items.find((item) => item.id === `${templateId}-disclosure`);
      expect(disclosure, `${templateId} disclosure item`).toBeTruthy();
      expect(disclosure.locked, `${templateId} disclosure lock`).toBe(true);
      await expect(page.locator(`.canvas-item[data-item-id='${templateId}-disclosure']`)).toHaveAttribute("data-locked", "true");
    }
    expect(errors).toEqual([]);
  });

  test("locked disclosure cannot be edited, dragged, resized, or deleted", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    const disclosureId = "retirement-disclosure";
    const disclosure = page.locator(`.canvas-item[data-item-id='${disclosureId}']`);
    const before = (await appState(page)).items.find((item) => item.id === disclosureId);
    expect(before.locked).toBe(true);

    await page.evaluate((id) => window.__AFV_TEST__.select("item", id), disclosureId);
    await expect(disclosure.locator(".resize-handle")).toHaveCount(0);
    await page.keyboard.press("Delete");
    await settle(page);
    expect((await appState(page)).items.some((item) => item.id === disclosureId)).toBe(true);

    const text = disclosure.locator(".text-main");
    await text.dblclick();
    await expect(text).not.toHaveAttribute("contenteditable", "true");

    const center = await centerOf(disclosure);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 120, center.y + 40, { steps: 6 });
    await page.mouse.up();
    await settle(page);

    const after = (await appState(page)).items.find((item) => item.id === disclosureId);
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(errors).toEqual([]);
  });

  test("presentation anonymizes household labels visually and restores editor text on exit", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    const household = page.locator(".canvas-item[data-item-id='household']");
    await expect(household).toContainText("Johnson Family");

    await page.locator("#presentationButton").click();
    await expect(page.locator("body")).toHaveClass(/presentation-ready/);
    await expect(household).not.toContainText("Johnson Family");
    await expect(household).toContainText("Sample Family");

    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/presentation/);
    await expect(household).toContainText("Johnson Family");
    expect((await appState(page)).items.find((item) => item.id === "household").label).toBe("Johnson Family");
    expect(errors).toEqual([]);
  });

  test("test harness template loads clear presentation classes after empty-canvas recovery", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    await page.evaluate(() => window.__AFV_TEST__.loadDiagram({ items: [], groups: [], financeData: {}, connectors: [], scenario: {} }));
    await page.locator("#presentationButton").click();
    await expect(page.locator("body")).toHaveClass(/presentation-ready/);

    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("cashReserve"));
    await settle(page);
    await expect(page.locator("body")).not.toHaveClass(/presentation/);
    await expect(page.locator(".topbar")).toBeVisible();
    expect((await appState(page)).activeTemplateId).toBe("cashReserve");
    expect(errors).toEqual([]);
  });

  test("malformed test diagrams get unique IDs and boolean scenario defaults", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.loadDiagram({
      items: [
        { id: "dup", type: "text", label: "One", x: 100, y: 100, w: 120, h: 60 },
        { id: "dup", type: "text", label: "Two", x: 220, y: 100, w: 120, h: 60 }
      ],
      groups: [],
      financeData: {},
      connectors: [],
      scenario: { annuityOn: "" }
    }));

    const state = await appState(page);
    expect(new Set(state.items.map((item) => item.id)).size).toBe(state.items.length);
    expect(state.items.map((item) => item.id)).toEqual(["dup", "dup-2"]);
    expect(state.scenario.annuityOn).toBe(true);
    expect(errors).toEqual([]);
  });

  test("selected connector inspector does not cover edit handles", async ({ page }) => {
    const errors = await openApp(page, "retirementPaycheck");
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "guaranteedFlow"));
    await expect(page.locator(".connector-handle.bend")).toHaveCount(1);

    const handleCenter = await centerOf(page.locator(".connector-handle.bend"));
    const hit = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      if (element?.closest(".selection-inspector")) return "inspector";
      return element?.closest(".connector-handle")?.dataset.connectorRole || element?.className || null;
    }, handleCenter);

    expect(hit).toBe("bend");
    expect(errors).toEqual([]);
  });
});
