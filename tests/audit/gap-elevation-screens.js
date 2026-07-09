const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { startAuditServer } = require("./server");

const OUT = path.join(__dirname, "..", "e2e", "verification-screenshots", "phase1-gap-elevation");
const VIEWPORT = { width: 1440, height: 900 };
const CASES = [
  { name: "retirement-paycheck-gap", templateId: "retirementPaycheck", themeId: "stewardship", scenario: { monthlyDistribution: 2500 }, expectedState: "gap" },
  { name: "roth-surplus-neutral", templateId: "roth", themeId: "stewardship", scenario: { monthlyNeed: 3500, monthlyDistribution: 3500 }, expectedState: "neutral" },
  { name: "cash-cleanup-dense", templateId: "cashCleanup", themeId: "stewardship" },
  { name: "retirement-horizon-gap", templateId: "retirementPaycheck", themeId: "horizon", scenario: { monthlyDistribution: 2500 }, expectedState: "gap" },
  { name: "retirement-camino-gap", templateId: "retirementPaycheck", themeId: "camino", scenario: { monthlyDistribution: 2500 }, expectedState: "gap" }
];

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let server;
  let browser;
  let context;
  const errors = [];

  try {
    server = await startAuditServer();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    for (const visualCase of CASES) {
      await page.goto(server.url);
      await page.waitForFunction(() => window.__AFV_TEST__);
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `
      });
      await page.evaluate((id) => window.__AFV_TEST__.setTheme(id), visualCase.themeId);
      await page.waitForSelector(`body[data-theme="${visualCase.themeId}"]`);
      await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), visualCase.templateId);
      if (visualCase.scenario) {
        await page.evaluate((scenario) => {
          for (const [key, value] of Object.entries(scenario)) {
            window.__AFV_TEST__.setScenario(key, value);
          }
        }, visualCase.scenario);
      }
      await page.locator("#fitButton").click();
      await page.evaluate(() => document.fonts?.ready);
      await settle(page);
      if (visualCase.expectedState) {
        const state = await page.locator(".finance-paycheck .paycheck-surface").first().getAttribute("data-state");
        if (state !== visualCase.expectedState) {
          throw new Error(`${visualCase.name} expected ${visualCase.expectedState} state but rendered ${state}`);
        }
      }
      await page.screenshot({
        path: path.join(OUT, `${visualCase.name}.png`),
        fullPage: true
      });
    }
  } finally {
    const cleanupErrors = [];

    if (context) {
      try {
        await context.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    if (server) {
      try {
        await server.stop();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    if (cleanupErrors.length) {
      throw cleanupErrors[0];
    }
  }

  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log(`Wrote ${CASES.length} screenshots to ${OUT}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
