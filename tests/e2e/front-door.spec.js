const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const BASE_URL = "http://localhost:4173/index.html";
const APP_URL = `${BASE_URL}?test=1`;
const FILE_URL = pathToFileURL(path.resolve(__dirname, "../../index.html")).href;

async function openFrontDoor(page) {
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

test.describe("front-door starting layouts", () => {
  test("normal app load opens on Create New Visual", async ({ page }) => {
    await page.goto(BASE_URL);

    await expect(page.locator("#startScreen")).toBeVisible();
    await expect(page.locator("h1#templateTitle")).toHaveText("Create New Visual");
    await expect(page.locator("#templateButtonText")).toHaveText("Template catalog");
    await expect(page.getByText("Templates", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__AFV_TEST__)).toBeUndefined();
  });

  test("direct file opens show local-server guidance", async ({ page }) => {
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(FILE_URL);

    await expect(page.locator("#localServerNotice")).toBeVisible();
    await expect(page.locator("#localServerNotice")).toContainText("Run npm run dev");
    await expect(page.locator("body")).toHaveClass(/file-protocol-blocked/);
    expect(errors).toEqual([]);
  });

  test("test harness exists under test mode without bypassing the first-run start screen", async ({ page }) => {
    await openFrontDoor(page);

    expect(await page.evaluate(() => typeof window.__AFV_TEST__)).toBe("object");
    await expect(page.locator("#startScreen")).toBeVisible();
    await expect(page.locator("h1#templateTitle")).toHaveText("Create New Visual");
    await expect(page.locator("#templateButtonText")).toHaveText("Template catalog");
    await expect(page.getByText("Templates", { exact: true })).toHaveCount(0);
    await expect(page.locator(".template-catalog-card[data-template-id]")).toHaveCount(16);
    for (const templateName of [
      "Retirement Income Flow",
      "Estate / Trust Transfer",
      "Roth Conversion + Tax Reserve",
      "Monthly Income Gap",
      "Survivor Income",
      "Blank Household"
    ]) {
      await expect(page.locator(".template-catalog")).toContainText(templateName);
    }
    await expect(page.getByText("Account Consolidation")).toHaveCount(0);

    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.startScreenOpen).toBe(true);
    expect(state.activeTemplateId).toBeNull();
    expect(state.items).toEqual([]);
  });

  test("template catalog exposes all real templates with grouped active-state switching", async ({ page }) => {
    await openFrontDoor(page);

    await expect(page.locator(".template-catalog")).toBeVisible();
    await expect(page.locator(".template-catalog-section")).toContainText([
      "Reference templates",
      "Cashflow planning",
      "Blank and utility"
    ]);
    await expect(page.locator(".template-catalog-card[data-template-id]")).toHaveCount(16);
    await expect(page.locator(".template-catalog-card[data-template-id='retirement']")).toContainText("Retirement Income Flow");
    await expect(page.locator(".template-catalog-card[data-template-id='estate']")).toContainText("Estate / Trust Transfer");
    await expect(page.getByText("Account Consolidation")).toHaveCount(0);

    await page.locator(".template-catalog-card[data-template-id='estate']").click();
    await expect(page.locator("#startScreen")).toBeHidden();
    expect(await page.evaluate(() => window.__AFV_TEST__.getState().activeTemplateId)).toBe("estate");

    await page.locator("#templateButton").click();
    const flyout = page.locator("#dockFlyout");
    await expect(flyout.locator(".template-catalog")).toBeVisible();
    await expect(flyout.locator(".template-catalog-card[data-template-id='estate']")).toHaveClass(/is-selected/);
    await expect(flyout.locator(".template-catalog-card[data-template-id='survivorIncome']")).toContainText("Survivor Income");

    await flyout.locator(".template-catalog-card[data-template-id='retirement']").click();
    expect(await page.evaluate(() => window.__AFV_TEST__.getState().activeTemplateId)).toBe("retirement");
    await expect(page.locator(".finance-paycheck[data-item-id='clientIncome']")).toBeVisible();
  });

  test("test harness only enables for explicit test=1", async ({ page }) => {
    for (const suffix of ["?test=0", "?test=false", "?foo=1", "#test=1"]) {
      await page.goto(`${BASE_URL}${suffix}`);
      await expect(page.locator("#startScreen")).toBeVisible();
      expect(await page.evaluate(() => window.__AFV_TEST__)).toBeUndefined();
    }
  });

  test("catalog does not render disabled duplicate layout fallbacks", async ({ page }) => {
    await openFrontDoor(page);

    await expect(page.locator(".template-catalog-card.is-disabled")).toHaveCount(0);
    await expect(page.getByText("Coming soon")).toHaveCount(0);
    await expect(page.getByText("Account Consolidation")).toHaveCount(0);

    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.startScreenOpen).toBe(true);
    expect(state.activeTemplateId).toBeNull();
    expect(state.items).toEqual([]);
    await expect(page.locator(".finance-card[data-item-id='employer401k']")).toHaveCount(0);
    await expect(page.locator(".finance-paycheck")).toHaveCount(0);
  });

  test("starting layouts load their mapped real templates", async ({ page }) => {
    await openFrontDoor(page);

    await page.getByRole("button", { name: /Retirement Income Flow/ }).click();
    await expect(page.locator("#startScreen")).toBeHidden();
    expect(await page.evaluate(() => window.__AFV_TEST__.getState().activeTemplateId)).toBe("retirement");
    await expect(page.locator(".finance-paycheck[data-item-id='clientIncome']")).toBeVisible();

    await page.goto(APP_URL);
    await page.waitForFunction(() => window.__AFV_TEST__);
    await page.getByRole("button", { name: /Blank Household/ }).click();
    const household = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(household.activeTemplateId).toBe("blankHousehold");
    expect(household.items.filter((item) => item.visual === "household")).toHaveLength(1);
    expect(household.items.filter((item) => item.visual === "paycheck")).toHaveLength(1);
    await expect(page.locator(".finance-household")).toHaveCount(1);
    await expect(page.locator(".finance-paycheck")).toHaveCount(1);
  });

  test("Finance tool palette uses Income Source copy", async ({ page }) => {
    await openFrontDoor(page);
    await page.getByRole("button", { name: /Retirement Income Flow/ }).click();

    await page.locator('[data-dock="finance"]').click();
    const flyout = page.locator("#dockFlyout");
    await expect(flyout.getByText("Finance starters")).toBeVisible();
    await expect(flyout.getByRole("button", { name: /Income Source/ })).toBeVisible();
    await expect(flyout.getByText("Income Contract", { exact: true })).toHaveCount(0);
  });

  test("presentation mode works after selecting a starting layout", async ({ page }) => {
    await openFrontDoor(page);
    await page.getByRole("button", { name: /Retirement Income Flow/ }).click();
    await expect(page.locator("#startScreen")).toBeHidden();

    await page.locator("#presentationButton").click();
    await expect(page.locator("body")).toHaveClass(/presentation/);
    await expect(page.locator("body")).toHaveClass(/presentation-ready/);
    await settle(page);
    await expect(page.locator(".topbar")).toBeHidden();
    await expect(page.locator(".scenario-rail")).toBeVisible();
    const overlapsRail = await page.evaluate(() => {
      const rail = document.querySelector(".scenario-rail")?.getBoundingClientRect();
      return [...document.querySelectorAll(".canvas-item, .connector-label")].flatMap((node) => {
        const rect = node.getBoundingClientRect();
        if (!rail || !rect.width || !rect.height) return [];
        const overlaps = rect.right > rail.left - 8 && rect.left < rail.right && rect.bottom > rail.top - 8 && rect.top < rail.bottom;
        return overlaps ? [node.getAttribute("data-item-id") || node.getAttribute("data-connector-id") || node.textContent.trim()] : [];
      });
    });
    expect(overlapsRail).toEqual([]);
  });

  test("unknown template IDs do not change the active template", async ({ page }) => {
    await openFrontDoor(page);

    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("cashReserve"));
    expect(await page.evaluate(() => window.__AFV_TEST__.getState().activeTemplateId)).toBe("cashReserve");
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("not-a-real-template"));

    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.activeTemplateId).toBe("cashReserve");
    expect(state.items.some((item) => item.id === "cashBucket")).toBe(true);
    expect(state.items.some((item) => item.id === "employer401k")).toBe(false);
  });
});
