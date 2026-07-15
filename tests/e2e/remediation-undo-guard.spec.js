const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";

const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  return errors;
}

async function revealControls(page) {
  // c8499b3 gates scenario controls behind a visible Controls tab; the Meeting
  // toggle now overlaps #scenarioRail and intercepts hover. Open via its button.
  const panelButton = page.locator("#meetingPanelButton");
  if ((await panelButton.getAttribute("aria-expanded")) !== "true") {
    await panelButton.click();
  }
  await page.locator('[data-meeting-tab="controls"]').click();
}

test.describe("remediation :: undo survives non-text focus", () => {
  test("Ctrl+Z fires after toggling the annuityOn checkbox (checkbox keeps focus)", async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirementPaycheck"));
    await settle(page);
    const pre = await page.evaluate(() => window.__AFV_TEST__.getState().scenario.annuityOn);

    await revealControls(page);
    const checkbox = page.locator('[data-scenario="annuityOn"]');
    await expect(checkbox).toHaveCount(1);
    await checkbox.click();
    await settle(page);

    const toggled = await page.evaluate(() => window.__AFV_TEST__.getState().scenario.annuityOn);
    expect(toggled).toBe(!pre);
    const active = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-scenario"));
    expect(active).toBe("annuityOn"); // checkbox retains focus

    await page.keyboard.press("Control+z");
    await settle(page);
    const restored = await page.evaluate(() => window.__AFV_TEST__.getState().scenario.annuityOn);
    expect(restored).toBe(pre); // undo was NOT swallowed by checkbox focus
    expect(errors).toEqual([]);
  });

  test("Ctrl+Z fires while a range slider holds focus", async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirementPaycheck"));
    await settle(page);

    const startX = await page.evaluate(() => window.__AFV_TEST__.getState().items.find((i) => i.id === "portfolio").x);
    const card = page.locator('.canvas-item[data-item-id="portfolio"]');
    const box = await card.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await settle(page);
    const movedX = await page.evaluate(() => window.__AFV_TEST__.getState().items.find((i) => i.id === "portfolio").x);
    expect(movedX).not.toBe(startX);

    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "paycheck");
      window.__AFV_TEST__.openPopover("selection-data");
    });
    await settle(page);
    const range = page.locator('input[type="range"]').first();
    await expect(range).toHaveCount(1);
    await range.focus();
    const activeType = await page.evaluate(() => document.activeElement && document.activeElement.type);
    expect(activeType).toBe("range");

    await page.keyboard.press("Control+z");
    await settle(page);
    const undoX = await page.evaluate(() => window.__AFV_TEST__.getState().items.find((i) => i.id === "portfolio").x);
    expect(undoX).toBe(startX); // slider focus did not block undo
    expect(errors).toEqual([]);
  });

  test("single-clicking a card note does not steal contenteditable focus", async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirementPaycheck"));
    await settle(page);

    const note = page.locator('.canvas-item[data-item-id="portfolio"] .finance-note');
    await expect(note).toHaveCount(1);
    await note.click();
    await settle(page);

    const state = await page.evaluate(() => ({
      editingItemId: window.__AFV_TEST__.getState().editingItemId,
      activeEditable: document.activeElement ? Boolean(document.activeElement.isContentEditable) : false
    }));
    expect(state.editingItemId).toBeFalsy(); // never entered edit mode
    expect(state.activeEditable).toBe(false); // no contenteditable focus trap
    expect(errors).toEqual([]);
  });
});
