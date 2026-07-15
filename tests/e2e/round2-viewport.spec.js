const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";
const TEMPLATES = ["retirement", "roth", "withdrawalSequencing"];
const DESKTOP_COMFORT_WIDTH = 850;
const PRESENTATION_COMFORT_WIDTH = 850;

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function openTemplate(page, templateId) {
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => {
    window.__AFV_TEST__.loadTemplate(id);
    window.__AFV_TEST__.fit();
  }, templateId);
  await settle(page);
}

async function openTemplateDefault(page, templateId) {
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await settle(page);
}

async function contentMetrics(page) {
  return page.evaluate(() => {
    const targets = [...document.querySelectorAll(".canvas-item, .canvas-group, .connector-label")]
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          id: node.getAttribute("data-item-id") ||
            node.getAttribute("data-group-id") ||
            node.getAttribute("data-connector-id") ||
            node.textContent.trim(),
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
      })
      .filter((rect) => rect.width > 1 && rect.height > 1);

    const rail = document.querySelector(".scenario-rail")?.getBoundingClientRect();
    const bounds = targets.reduce((acc, rect) => ({
      left: Math.min(acc.left, rect.left),
      right: Math.max(acc.right, rect.right),
      top: Math.min(acc.top, rect.top),
      bottom: Math.max(acc.bottom, rect.bottom)
    }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });

    const overlapsRail = targets.flatMap((rect) => {
      if (!rail) return [];
      const overlaps = rect.right > rail.left - 8 &&
        rect.left < rail.right + 8 &&
        rect.bottom > rail.top - 8 &&
        rect.top < rail.bottom + 8;
      return overlaps ? [rect.id] : [];
    });

    return {
      width: bounds.right - bounds.left,
      left: bounds.left,
      right: bounds.right,
      rail: rail ? {
        left: rail.left,
        right: rail.right,
        top: rail.top,
        bottom: rail.bottom,
        width: rail.width,
        height: rail.height
      } : null,
      overlapsRail
    };
  });
}

test.describe("round 2 viewport fit", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("default template loads use a normalized initial zoom across scenarios", async ({ page }) => {
    const templateIds = ["retirement", "roth", "annuity", "estate", "cashReserve", "rmdTax", "survivorIncome"];
    const zooms = [];

    for (const templateId of templateIds) {
      await openTemplateDefault(page, templateId);
      const viewport = await page.evaluate(() => window.__AFV_TEST__.getState().viewport);
      const metrics = await contentMetrics(page);
      zooms.push({ templateId, zoom: viewport.zoom, metrics });
    }

    const values = zooms.map((entry) => entry.zoom);
    expect(Math.max(...values) - Math.min(...values), JSON.stringify(zooms)).toBeLessThanOrEqual(0.04);
    for (const entry of zooms) {
      expect(entry.metrics.left, `${entry.templateId} content should stay inside the viewport`).toBeGreaterThanOrEqual(0);
      expect(entry.metrics.right, `${entry.templateId} content should stay inside the viewport`).toBeLessThanOrEqual(1920);
    }
  });

  for (const templateId of TEMPLATES) {
    test(`${templateId} fit uses reasonable horizontal width at 1920px`, async ({ page }) => {
      await openTemplate(page, templateId);

      const metrics = await contentMetrics(page);
      expect(metrics.width, `${templateId} rendered content width`).toBeGreaterThanOrEqual(DESKTOP_COMFORT_WIDTH);
      expect(metrics.left, `${templateId} content should stay inside the viewport`).toBeGreaterThanOrEqual(0);
      expect(metrics.right, `${templateId} content should stay inside the viewport`).toBeLessThanOrEqual(1920);
    });

    test(`${templateId} presentation fit keeps content clear of scenario rail`, async ({ page }) => {
      await openTemplate(page, templateId);
      await page.locator("#presentationButton").click();
      await expect(page.locator("body")).toHaveClass(/presentation-ready/);
      await settle(page);

      const metrics = await contentMetrics(page);
      expect(metrics.rail).toBeTruthy();
      expect(metrics.width, `${templateId} presentation rendered content width`).toBeGreaterThanOrEqual(PRESENTATION_COMFORT_WIDTH);
      expect(metrics.overlapsRail, `${templateId} content overlapping presentation rail`).toEqual([]);
    });
  }
});

test.describe("reference viewport breathing room", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("manual fit does not over-zoom reference meeting exhibits", async ({ page }) => {
    for (const templateId of ["retirement", "estate"]) {
      await openTemplate(page, templateId);
      const viewport = await page.evaluate(() => window.__AFV_TEST__.getState().viewport);
      const metrics = await contentMetrics(page);

      expect(viewport.zoom, `${templateId} fit zoom`).toBeLessThanOrEqual(0.88);
      expect(metrics.left, `${templateId} left breathing room`).toBeGreaterThanOrEqual(80);
      expect(metrics.right, `${templateId} right breathing room`).toBeLessThanOrEqual(1360);
    }
  });
});

test.describe("reference presentation overview zoom", () => {
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2048, height: 1105 }
  ]) {
    test(`reference defaults open calmer at ${size.width}x${size.height}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: size });
      const page = await context.newPage();

      for (const templateId of ["retirement", "estate"]) {
        await openTemplateDefault(page, templateId);
        const viewport = await page.evaluate(() => window.__AFV_TEST__.getState().viewport);
        const metrics = await contentMetrics(page);

        expect(viewport.zoom, `${templateId} default zoom at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(0.68);
        expect(viewport.zoom, `${templateId} default zoom at ${size.width}x${size.height}`).toBeLessThanOrEqual(0.78);
        expect(metrics.left, `${templateId} left breathing room at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(64);
        expect(metrics.right, `${templateId} right breathing room at ${size.width}x${size.height}`).toBeLessThanOrEqual(size.width - 64);
      }

      await context.close();
    });
  }

  test("chrome variables use lighter neutral graphite instead of heavy chocolate", async ({ page }) => {
    await openTemplateDefault(page, "estate");
    const chrome = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const parse = (name) => styles.getPropertyValue(name).trim();
      const rgb = (value) => {
        const hex = value.match(/^#([0-9a-f]{6})$/i)?.[1];
        if (!hex) return null;
        return {
          r: Number.parseInt(hex.slice(0, 2), 16),
          g: Number.parseInt(hex.slice(2, 4), 16),
          b: Number.parseInt(hex.slice(4, 6), 16)
        };
      };
      return {
        bg: rgb(parse("--chrome-bg")),
        deep: rgb(parse("--chrome-bg-deep")),
        lift: rgb(parse("--chrome-bg-lift")),
        muted: rgb(parse("--chrome-muted"))
      };
    });

    for (const [name, color] of Object.entries({ bg: chrome.bg, deep: chrome.deep, lift: chrome.lift })) {
      expect(color, `${name} should be a hex graphite token`).toBeTruthy();
      const average = (color.r + color.g + color.b) / 3;
      expect(average, `${name} should be lighter than near-black`).toBeGreaterThanOrEqual(44);
      expect(Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b), `${name} should be neutral, not chocolate`).toBeLessThanOrEqual(16);
    }
    expect(chrome.muted.r - chrome.muted.b, "muted chrome text should not be brass/chocolate").toBeLessThanOrEqual(36);
  });
});
