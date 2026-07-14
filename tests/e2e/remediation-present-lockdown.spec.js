const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:4173/index.html?test=1";

const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function enterPresent(page, templateId = "retirementPaycheck") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await settle(page);
  await page.locator("#presentationButton").click();
  await settle(page);
  await expect(page.locator("body")).toHaveClass(/presentation/);
  return errors;
}

const nodePos = (page, id) =>
  page.evaluate((itemId) => {
    const i = window.__AFV_TEST__.getState().items.find((x) => x.id === itemId);
    return { x: i.x, y: i.y };
  }, id);

test.describe("remediation :: presentation is view-only", () => {
  test("node drag does not persist", async ({ page }) => {
    const errors = await enterPresent(page);
    const before = await nodePos(page, "portfolio");
    const card = page.locator('.canvas-item[data-item-id="portfolio"]');
    const box = await card.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 80, { steps: 10 });
      await page.mouse.up();
      await settle(page);
    }
    expect(await nodePos(page, "portfolio")).toEqual(before);
    expect(errors).toEqual([]);
  });

  test("arrow-key nudge does not mutate state", async ({ page }) => {
    const errors = await enterPresent(page);
    await page.evaluate(() => window.__AFV_TEST__.select("item", "portfolio"));
    await settle(page);
    const before = await nodePos(page, "portfolio");
    for (const k of ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
      await page.keyboard.press(k);
    }
    await settle(page);
    expect(await nodePos(page, "portfolio")).toEqual(before);
    expect(errors).toEqual([]);
  });

  test("delete is blocked", async ({ page }) => {
    const errors = await enterPresent(page);
    const before = await page.evaluate(() => {
      const st = window.__AFV_TEST__.getState();
      return { items: st.items.length, connectors: st.connectors.length };
    });
    await page.evaluate(() => window.__AFV_TEST__.select("item", "portfolio"));
    await settle(page);
    await page.keyboard.press("Delete");
    await page.keyboard.press("Backspace");
    await settle(page);
    const after = await page.evaluate(() => {
      const st = window.__AFV_TEST__.getState();
      return { items: st.items.length, connectors: st.connectors.length };
    });
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
  });

  test("value edits are locked (double-click does not enter edit mode)", async ({ page }) => {
    const errors = await enterPresent(page);
    const value = page.locator('.canvas-item[data-item-id="portfolio"] .finance-value');
    if (await value.count()) {
      await value.dblclick().catch(() => {});
      await settle(page);
    }
    const editing = await page.evaluate(() => window.__AFV_TEST__.getState().editingItemId);
    expect(editing).toBeFalsy();
    expect(errors).toEqual([]);
  });

  test("edge-connector handles are removed from tab order", async ({ page }) => {
    const errors = await enterPresent(page);
    const tabindexes = await page.evaluate(() =>
      [...document.querySelectorAll(".item-edge-handle")].map((h) => h.getAttribute("tabindex"))
    );
    expect(tabindexes.length).toBeGreaterThan(0);
    expect(tabindexes.every((t) => t === "-1")).toBe(true);
    expect(errors).toEqual([]);
  });

  test("mutations do not survive exiting presentation", async ({ page }) => {
    const errors = await enterPresent(page);
    const before = await nodePos(page, "portfolio");
    await page.evaluate(() => window.__AFV_TEST__.select("item", "portfolio"));
    await settle(page);
    for (const k of ["ArrowRight", "ArrowRight", "ArrowRight"]) await page.keyboard.press(k);
    await settle(page);
    await page.locator("#presentationExit").click();
    await settle(page);
    await expect(page.locator("body")).not.toHaveClass(/presentation/);
    expect(await nodePos(page, "portfolio")).toEqual(before);
    expect(errors).toEqual([]);
  });
});
