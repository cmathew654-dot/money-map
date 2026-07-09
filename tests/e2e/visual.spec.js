const { test, expect } = require("@playwright/test");

const templates = ["retirement", "roth", "annuity", "estate", "cashReserve"];
const themes = ["stewardship", "horizon", "camino"];

function appUrl() {
  return "http://localhost:4173/index.html?test=1";
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function openVisualCase(page, templateId, themeId) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(appUrl());
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `
  });

  await page.evaluate((id) => window.__AFV_TEST__.setTheme(id), themeId);
  await page.waitForSelector(`body[data-theme="${themeId}"]`);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.locator("#fitButton").click();
  await page.evaluate(() => document.fonts?.ready);
  await settle(page);

  return errors;
}

async function coveredByChrome(page) {
  return page.evaluate(() => {
    const rail = document.querySelector("#scenarioRail")?.getBoundingClientRect();
    const dock = document.querySelector(".canvas-dock")?.getBoundingClientRect();
    const targets = [...document.querySelectorAll(".canvas-item, .connector-label")];
    return targets.flatMap((node) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      const overlapsRail = rail && rect.right > rail.left - 8 && rect.left < rail.right && rect.bottom > rail.top && rect.top < rail.bottom;
      const overlapsDock = dock && rect.right > dock.left && rect.left < dock.right + 8 && rect.bottom > dock.top && rect.top < dock.bottom;
      return overlapsRail || overlapsDock ? [node.getAttribute("data-item-id") || node.getAttribute("data-connector-id") || node.textContent.trim()] : [];
    });
  });
}

test.describe("visual baselines", () => {
  for (const templateId of templates) {
    for (const themeId of themes) {
      test(`${templateId} template in ${themeId} theme`, async ({ page }) => {
        const errors = await openVisualCase(page, templateId, themeId);
        expect(await coveredByChrome(page)).toEqual([]);
        await expect(page).toHaveScreenshot(`${templateId}-${themeId}.png`, {
          animations: "disabled",
          fullPage: true
        });
        expect(errors).toEqual([]);
      });
    }
  }

  for (const themeId of themes) {
    test(`presentation mode in ${themeId} theme`, async ({ page }) => {
      const errors = await openVisualCase(page, "retirement", themeId);
      await page.locator("#presentationButton").click();
      await expect(page.locator("body")).toHaveClass(/presentation-ready/);
      await settle(page);
      await expect(page).toHaveScreenshot(`presentation-${themeId}.png`, {
        animations: "disabled",
        fullPage: true
      });
      expect(errors).toEqual([]);
    });
  }
});
