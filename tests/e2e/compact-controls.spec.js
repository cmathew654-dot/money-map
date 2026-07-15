const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";
const templates = [
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

function overlaps(a, b, pad = 0) {
  return !(a.right + pad < b.left || a.left - pad > b.right || a.bottom + pad < b.top || a.top - pad > b.bottom);
}

async function rectFor(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height
  };
}

test.describe("docked selection controls", () => {
  test("estate trust selection uses docked inspector instead of floating story chrome", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadTemplate("estate");
      window.__AFV_TEST__.fit();
      window.__AFV_TEST__.select("item", "revocableTrust");
      window.__AFV_TEST__.openPopover("selection-data");
    });
    await settle(page);

    await expect(page.locator(".selection-toolbar")).toHaveCount(0);
    await expect(page.locator(".selection-popover")).toHaveCount(0);
    await expect(page.locator(".selection-quick-editor")).toHaveCount(0);

    const inspector = page.locator(".selection-inspector");
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText("Revocable Trust");
    await expect(inspector.locator("[data-inspector-tab='selection-data']")).toBeVisible();
    await expect(inspector.locator("[data-inspector-tab='selection-style']")).toBeVisible();
    await expect(inspector.locator("[data-action='duplicate']")).toBeVisible();
    await expect(inspector.locator("[data-action='delete']")).toBeVisible();
    await expect(inspector.locator("input[data-input='finance-value']")).toBeVisible();

    const collisions = await page.evaluate(() => {
      const inspectorRect = document.querySelector(".selection-inspector")?.getBoundingClientRect();
      if (!inspectorRect) return ["missing inspector"];
      return [...document.querySelectorAll(".canvas-item.item-finance, .canvas-group, .connector-label")]
        .map((node) => ({ id: node.dataset.itemId || node.dataset.groupId || node.dataset.connectorId, rect: node.getBoundingClientRect() }))
        .filter(({ rect }) => inspectorRect.right > rect.left + 6 &&
          inspectorRect.left < rect.right - 6 &&
          inspectorRect.bottom > rect.top + 6 &&
          inspectorRect.top < rect.bottom - 6)
        .map(({ id }) => `inspector overlaps ${id}`);
    });

    expect(collisions).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("selected connector uses docked inspector with explicit flow handles", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "transfer"));

    await expect(page.locator(".connector-handle.source")).toHaveCount(1);
    await expect(page.locator(".connector-handle.target")).toHaveCount(1);
    await expect(page.locator(".connector-handle.bend")).toHaveCount(1);
    await expect(page.locator(".connector-handle.label")).toHaveCount(1);
    await expect(page.locator(".connector-handle.source .connector-handle-pin")).toHaveCount(1);
    await expect(page.locator(".connector-handle.target .connector-handle-pin")).toHaveCount(1);
    await expect(page.locator(".connector-handle.bend .connector-handle-bend")).toHaveCount(1);
    await expect(page.locator(".connector-handle.label .connector-handle-label-tab")).toHaveCount(1);
    await expect(page.locator(".connector-handle.source")).toHaveCSS("opacity", /0\.9|1/);
    await expect(page.locator(".selection-toolbar")).toHaveCount(0);
    const inspector = await rectFor(page.locator(".selection-inspector"));
    expect(inspector.width).toBeLessThanOrEqual(360);

    const label = await rectFor(page.locator(".connector-label[data-connector-id='transfer']"));
    expect(overlaps(inspector, label, 2)).toBe(false);
    expect(errors).toEqual([]);
  });

  test("item inspector stays docked and does not cover the selected tile", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("item", "cashReserve"));

    await expect(page.locator(".selection-toolbar")).toHaveCount(0);
    const inspector = await rectFor(page.locator(".selection-inspector"));
    const tile = await rectFor(page.locator(".canvas-item[data-item-id='cashReserve']"));
    expect(inspector.width).toBeLessThanOrEqual(360);
    expect(overlaps(inspector, tile, 4)).toBe(false);
    expect(errors).toEqual([]);
  });

  test("advanced edit chrome never duplicates value editors or covers the financial story", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "cashReserve");
      window.__AFV_TEST__.openPopover("selection-data");
    });
    await settle(page);

    await expect(page.locator(".selection-toolbar input[data-money-input='true']")).toHaveCount(0);
    await expect(page.locator("input[data-input='finance-value']")).toHaveCount(1);

    const collisions = await page.evaluate(() => {
      const chrome = [...document.querySelectorAll(".selection-toolbar, .selection-popover, .selection-quick-editor, .selection-inspector")]
        .map((node) => ({ id: node.className, rect: node.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width && rect.height);
      const story = [...document.querySelectorAll(".canvas-item.item-finance, .canvas-group, .connector-label")]
        .map((node) => ({ id: node.dataset.itemId || node.dataset.groupId || node.dataset.connectorId, rect: node.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width && rect.height);
      return chrome.flatMap((chromeEntry) => story
        .filter(({ rect }) => (
          chromeEntry.rect.right > rect.left + 6 &&
          chromeEntry.rect.left < rect.right - 6 &&
          chromeEntry.rect.bottom > rect.top + 6 &&
          chromeEntry.rect.top < rect.bottom - 6
        ))
        .map(({ id }) => `${chromeEntry.id} overlaps ${id}`));
    });

    expect(collisions).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("finance data inspector is docked and still editable", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "rolloverIra");
      window.__AFV_TEST__.openPopover("selection-data");
    });

    const inspectorLocator = page.locator(".selection-inspector[data-inspector-section='selection-data']");
    const input = inspectorLocator.locator("input[data-input='finance-value']");
    await expect(input).toBeVisible();

    const panel = await rectFor(inspectorLocator);
    expect(panel.width).toBeLessThanOrEqual(360);
    expect(panel.right).toBeLessThanOrEqual(page.viewportSize().width);
    expect(panel.bottom).toBeLessThanOrEqual(page.viewportSize().height);

    await input.click();
    await input.fill("181000");
    await input.blur();
    await expect(input).toHaveValue("$181,000");
    const value = await page.evaluate(() => window.__AFV_TEST__.getState().financeData.rolloverIra.value);
    expect(value).toBe(181000);
    expect(errors).toEqual([]);
  });

  test("estate inspector avoids account tiles at compact desktop widths", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadTemplate("estate");
      window.__AFV_TEST__.fit();
      window.__AFV_TEST__.select("item", "estateAccount");
      window.__AFV_TEST__.openPopover("selection-data");
    });
    await settle(page);

    const itemCollisions = await page.evaluate(() => {
      const inspector = document.querySelector(".selection-inspector");
      const chrome = inspector?.getBoundingClientRect();
      if (!chrome) return ["missing inspector"];
      return [...document.querySelectorAll(".canvas-item.item-finance, .canvas-group")]
        .map((node) => ({ id: node.dataset.itemId || node.dataset.groupId, rect: node.getBoundingClientRect() }))
        .filter(({ rect }) => chrome.right > rect.left + 4 && chrome.left < rect.right - 4 && chrome.bottom > rect.top + 4 && chrome.top < rect.bottom - 4)
        .map(({ id }) => `item inspector overlaps ${id}`);
    });
    expect(itemCollisions).toEqual([]);

    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "assetTransfer");
      window.__AFV_TEST__.openPopover("connector-data");
    });
    await settle(page);

    const connectorCollisions = await page.evaluate(() => {
      const inspector = document.querySelector(".selection-inspector");
      const chrome = inspector?.getBoundingClientRect();
      if (!chrome) return ["missing inspector"];
      return [...document.querySelectorAll(".canvas-item.item-finance, .canvas-group")]
        .map((node) => ({ id: node.dataset.itemId || node.dataset.groupId, rect: node.getBoundingClientRect() }))
        .filter(({ rect }) => chrome.right > rect.left + 4 && chrome.left < rect.right - 4 && chrome.bottom > rect.top + 4 && chrome.top < rect.bottom - 4)
        .map(({ id }) => `connector inspector overlaps ${id}`);
    });
    expect(connectorCollisions).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("auto flow labels avoid account tiles in default templates", async ({ page }) => {
    // Iterates all templates with fit/geometry rendering; the geometry contract can exceed the default 30s budget.
    test.setTimeout(60000);
    const errors = await openApp(page);
    for (const templateId of templates) {
      await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
      await page.locator("#fitButton").click();
      await settle(page);

      const collisions = await page.evaluate(() => {
        const items = [...document.querySelectorAll(".canvas-item, .canvas-group")].map((node) => ({
          id: node.getAttribute("data-item-id") || node.getAttribute("data-group-id"),
          rect: node.getBoundingClientRect()
        }));
        return [...document.querySelectorAll(".connector-label")].flatMap((label) => {
          const labelRect = label.getBoundingClientRect();
          return items
            .filter(({ rect }) => labelRect.right > rect.left + 4 && labelRect.left < rect.right - 4 && labelRect.bottom > rect.top + 4 && labelRect.top < rect.bottom - 4)
            .map(({ id }) => `${label.getAttribute("data-connector-id")} overlaps ${id}`);
        });
      });
      expect(collisions, templateId).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
});
