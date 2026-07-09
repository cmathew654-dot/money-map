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
  return errors;
}

function px(value) {
  return Number.parseFloat(String(value || "0")) || 0;
}

test.describe("Heritage micro-polish staging", () => {
  test("keeps Heritage palette while exposing shared polish primitives", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.setTheme("stewardship"));

    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        metal: cs.getPropertyValue("--metal").trim(),
        gap: cs.getPropertyValue("--gap").trim(),
        surplus: cs.getPropertyValue("--surplus").trim(),
        radiusControl: cs.getPropertyValue("--radius-control").trim(),
        radiusPanel: cs.getPropertyValue("--radius-panel").trim(),
        focusRing: cs.getPropertyValue("--focus-ring").trim(),
        motionBase: cs.getPropertyValue("--motion-base").trim(),
        motionPanel: cs.getPropertyValue("--motion-panel").trim(),
        bodyTracking: body.letterSpacing
      };
    });

    expect(tokens.metal).toBe("#a8893f");
    expect(tokens.gap).toBe("#8c3829");
    expect(tokens.surplus).toBe("#3a5240");
    expect(tokens.radiusControl).toBe("6px");
    expect(tokens.radiusPanel).toBe("6px");
    expect(tokens.focusRing).toContain("#a8893f");
    expect(tokens.motionBase).toContain("cubic-bezier(0.2, 0, 0, 1)");
    expect(tokens.motionPanel).toContain("cubic-bezier(0.2, 0, 0, 1)");
    expect(px(tokens.bodyTracking)).toBeLessThan(0);
    expect(errors).toEqual([]);
  });

  test("core editor controls have compact radius, quiet icons, and visible keyboard focus", async ({ page }) => {
    const errors = await openApp(page);
    const templateButton = page.locator("#templateButton");

    await templateButton.focus();
    const controlMetrics = await templateButton.evaluate((node) => {
      const cs = getComputedStyle(node);
      return {
        radius: cs.borderTopLeftRadius,
        outlineWidth: cs.outlineWidth,
        outlineOffset: cs.outlineOffset,
        transitionTiming: cs.transitionTimingFunction
      };
    });

    const iconMetrics = await page.locator("#fitButton svg").evaluate((node) => {
      const cs = getComputedStyle(node);
      return {
        width: cs.width,
        height: cs.height,
        strokeWidth: cs.strokeWidth,
        color: cs.color
      };
    });

    expect(px(controlMetrics.radius)).toBeLessThanOrEqual(6);
    expect(controlMetrics.outlineWidth).toBe("2px");
    expect(controlMetrics.outlineOffset).toBe("2px");
    expect(controlMetrics.transitionTiming).toContain("cubic-bezier");
    expect(px(iconMetrics.width)).toBeGreaterThanOrEqual(16);
    expect(px(iconMetrics.width)).toBeLessThanOrEqual(18);
    expect(px(iconMetrics.height)).toBeLessThanOrEqual(18);
    expect(px(iconMetrics.strokeWidth)).toBeLessThanOrEqual(1.6);
    expect(errors).toEqual([]);
  });

  test("start screen uses one primary action plus an organized catalog", async ({ page }) => {
    const errors = await openApp(page);

    await expect(page.locator(".start-screen-hero")).toBeVisible();
    await expect(page.locator(".start-screen-primary-action")).toHaveCount(1);
    await expect(page.locator(".template-catalog-section")).toHaveCount(3);
    await expect(page.locator(".template-catalog-card").first()).toBeVisible();

    const layout = await page.locator(".start-screen-inner").evaluate((node) => {
      const cs = getComputedStyle(node);
      return {
        display: cs.display,
        columns: cs.gridTemplateColumns,
        gap: cs.gap
      };
    });
    expect(layout.display).toBe("grid");
    expect(layout.columns.split(" ").length).toBeGreaterThanOrEqual(2);
    expect(px(layout.gap)).toBeGreaterThanOrEqual(24);
    expect(errors).toEqual([]);
  });

  test("reduced motion disables nonessential chrome transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = await openApp(page);

    const duration = await page.locator(".template-catalog-card").first().evaluate((node) => {
      const firstDuration = getComputedStyle(node).transitionDuration.split(",")[0];
      return Number.parseFloat(firstDuration) || 0;
    });

    expect(duration).toBeLessThanOrEqual(0.001);
    expect(errors).toEqual([]);
  });
});
