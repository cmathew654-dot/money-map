const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:4173/index.html?test=1";

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

async function state(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

test.describe("undo and redo", () => {
  test("undo and redo restore a card drag", async ({ page }) => {
    const errors = await openApp(page);
    const card = page.locator(".canvas-item[data-item-id='household']");
    const before = (await state(page)).items.find((item) => item.id === "household");
    const box = await card.boundingBox();
    expect(box).toBeTruthy();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 34, { steps: 6 });
    await page.mouse.up();

    const moved = (await state(page)).items.find((item) => item.id === "household");
    expect(moved.x).toBeGreaterThan(before.x + 40);

    await page.keyboard.press("Control+Z");
    await expect.poll(async () => (await state(page)).items.find((item) => item.id === "household").x).toBe(before.x);
    await expect.poll(async () => (await state(page)).items.find((item) => item.id === "household").y).toBe(before.y);

    await page.keyboard.press("Control+Y");
    await expect.poll(async () => (await state(page)).items.find((item) => item.id === "household").x).toBe(moved.x);
    await expect.poll(async () => (await state(page)).items.find((item) => item.id === "household").y).toBe(moved.y);
    expect(errors).toEqual([]);
  });

  test("undo and redo restore connector amount edits", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "transfer");
      window.__AFV_TEST__.openPopover("connector-data");
    });

    const input = page.locator(".selection-inspector input[data-input='connector-amount']");
    await expect(input).toBeVisible();
    await input.focus();
    await input.fill("123000");
    await input.blur();

    expect((await state(page)).connectors.find((conn) => conn.id === "transfer").amount).toBe(123000);

    await page.keyboard.press("Control+Z");
    await expect.poll(async () => (await state(page)).connectors.find((conn) => conn.id === "transfer").amount).toBe(75000);

    await page.keyboard.press("Control+Y");
    await expect.poll(async () => (await state(page)).connectors.find((conn) => conn.id === "transfer").amount).toBe(123000);
    expect(errors).toEqual([]);
  });

  test("delete toast undo restores a selected finance tile", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("item", "rolloverIra"));

    await page.locator(".selection-inspector button.is-danger").click();

    const toast = page.locator(".delete-toast");
    await expect(toast).toContainText("Rollover IRA deleted");
    await expect(toast.locator("button[data-toast-action='undo-delete']")).toHaveText("Undo");
    await expect.poll(async () => (await state(page)).items.some((item) => item.id === "rolloverIra")).toBe(false);

    await toast.locator("button[data-toast-action='undo-delete']").click();

    await expect.poll(async () => (await state(page)).items.some((item) => item.id === "rolloverIra")).toBe(true);
    await expect(toast).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
