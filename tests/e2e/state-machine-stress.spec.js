"use strict";

const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";

async function openRetirement(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push("[pageerror] " + err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("[console.error] " + msg.text());
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

async function state(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

async function connectorLabelTexts(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".connector-label strong.amount")).map((el) => el.textContent.trim())
  );
}

test.describe("state machine stress", () => {
  test("reset restores connector labels to template defaults", async ({ page }) => {
    const errors = await openRetirement(page);
    const initial = await connectorLabelTexts(page);

    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 8000));
    await settle(page);
    expect((await connectorLabelTexts(page)).some((text, index) => text !== initial[index])).toBe(true);

    await page.locator("#resetButton").click();
    await page.waitForTimeout(650);
    await settle(page);

    expect(await connectorLabelTexts(page)).toEqual(initial);
    expect((await state(page)).scenario.monthlyDistribution).toBe(4000);
    expect(errors).toEqual([]);
  });

  test("tile drag, add, delete, and connector edits participate in undo paths", async ({ page }) => {
    const errors = await openRetirement(page);
    const before = await state(page);
    const card = page.locator(".canvas-item[data-item-id='cashReserve']");
    const box = await card.boundingBox();
    expect(box).toBeTruthy();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 60, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => state(page).then((s) => s.items.find((item) => item.id === "cashReserve").x)).not.toBe(before.items.find((item) => item.id === "cashReserve").x);

    await page.keyboard.press("Control+Z");
    await expect.poll(() => state(page).then((s) => s.items.find((item) => item.id === "cashReserve").x)).toBe(before.items.find((item) => item.id === "cashReserve").x);

    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "transfer");
      window.__AFV_TEST__.openPopover("connector-data");
    });
    const amountInput = page.locator('.selection-inspector input[data-input="connector-amount"]');
    await expect(amountInput).toBeVisible();
    const transferBefore = (await state(page)).connectors.find((conn) => conn.id === "transfer").amount;
    await amountInput.fill("99000");
    await amountInput.blur();
    await expect.poll(() => state(page).then((s) => s.connectors.find((conn) => conn.id === "transfer").amount)).toBe(99000);
    await page.keyboard.press("Control+Z");
    await expect.poll(() => state(page).then((s) => s.connectors.find((conn) => conn.id === "transfer").amount)).toBe(transferBefore);

    await page.evaluate(() => window.__AFV_TEST__.select("item", "rolloverIra"));
    await page.locator(".selection-inspector button.is-danger").click();
    await expect(page.locator(".delete-toast")).toBeVisible();
    await expect.poll(() => state(page).then((s) => s.items.some((item) => item.id === "rolloverIra"))).toBe(false);
    await page.locator(".delete-toast button[data-toast-action='undo-delete']").click();
    await expect.poll(() => state(page).then((s) => s.items.some((item) => item.id === "rolloverIra"))).toBe(true);

    expect(errors).toEqual([]);
  });

  test("template, theme, and presentation transitions do not leak state", async ({ page }) => {
    const errors = await openRetirement(page);
    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 5500));
    await settle(page);
    const edited = await state(page);

    for (const themeId of ["horizon", "camino", "stewardship"]) {
      await page.evaluate((id) => window.__AFV_TEST__.setTheme(id), themeId);
      await settle(page);
      const themed = await state(page);
      expect(themed.themeId).toBe(themeId);
      expect(themed.items.length).toBe(edited.items.length);
      expect(themed.connectors.length).toBe(edited.connectors.length);
      expect(themed.scenario.monthlyDistribution).toBe(5500);
    }

    await page.locator("#presentationButton").click();
    await settle(page);
    await expect(page.locator("body")).toHaveClass(/presentation/);
    expect((await state(page)).scenario.monthlyDistribution).toBe(5500);
    await page.keyboard.press("Escape");
    await settle(page);
    await expect(page.locator("body")).not.toHaveClass(/\bpresentation\b/);
    expect((await state(page)).scenario.monthlyDistribution).toBe(5500);

    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("socialSecurityBridge"));
    await settle(page);
    expect((await state(page)).activeTemplateId).toBe("socialSecurityBridge");
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
    await settle(page);
    expect((await state(page)).scenario.monthlyDistribution).toBe(4000);
    expect(errors).toEqual([]);
  });

  test("reload discards edits and rapid scenario updates converge", async ({ page }) => {
    const errors = await openRetirement(page);
    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 7777));
    await settle(page);
    expect((await state(page)).scenario.monthlyDistribution).toBe(7777);

    await page.reload();
    await page.waitForFunction(() => window.__AFV_TEST__);
    await settle(page);
    const reloaded = await state(page);
    expect(reloaded.activeTemplateId).toBeFalsy();
    expect(reloaded.scenario.monthlyDistribution).not.toBe(7777);

    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
    await page.evaluate(() => {
      for (let i = 0; i < 50; i++) {
        window.__AFV_TEST__.setScenario("monthlyDistribution", i === 49 ? 7300 : 1000 + i * 100);
      }
    });
    await page.waitForTimeout(650);
    await settle(page);

    const current = await state(page);
    expect(current.scenario.monthlyDistribution).toBe(7300);
    for (const amount of current.connectors.map((conn) => Number(conn.amount))) expect(Number.isFinite(amount)).toBe(true);
    for (const value of Object.values(current.currentValues)) expect(Number.isFinite(value)).toBe(true);
    expect(errors).toEqual([]);
  });
});
