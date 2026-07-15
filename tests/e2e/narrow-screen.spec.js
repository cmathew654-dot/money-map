const { test, expect } = require("@playwright/test");

const BASE_URL = "http://localhost:54217/index.html";

test("390px shows the intentional desktop-canvas gate", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(BASE_URL);
  await expect(page.locator("#narrowScreenGate")).toBeVisible();
  await expect(page.locator("#narrowScreenGate")).toContainText(/at least 1060 CSS pixels/i);
  await expect(page.locator("#appShell")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("1060px loads the complete editor instead of the gate", async ({ page }) => {
  await page.setViewportSize({ width: 1060, height: 844 });
  await page.goto(`${BASE_URL}?test=1`);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await expect(page.locator("#narrowScreenGate")).toBeHidden();
  await expect(page.locator("#appShell")).toBeVisible();
  await expect(page.locator("#startScreen")).toBeVisible();
});
