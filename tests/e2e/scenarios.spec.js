const { test, expect } = require("@playwright/test");
const scenarios = require("./fixtures/scenarios");

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

async function loadScenario(page, scenario) {
  await page.evaluate((diagram) => window.__AFV_TEST__.loadDiagram(diagram), scenario);
  await page.locator("#fitButton").click();
}

async function state(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

async function financeValue(page, id) {
  return page.locator(`.canvas-item[data-item-id='${id}'] .finance-value`).textContent();
}

async function fillValue(page, id) {
  return page.locator(`.canvas-item[data-item-id='${id}']`).evaluate((node) => getComputedStyle(node).getPropertyValue("--fill").trim());
}

test.describe("adversarial prototype scenarios", () => {
  test("S1 empty diagram lifecycle keeps fit bounded", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.emptyDiagram());

    const next = await state(page);
    expect(next.items).toHaveLength(0);
    expect(next.connectors).toHaveLength(0);
    expect(next.viewport.zoom).toBe(1);
    expect(next.worldTransform).toContain("translate");
    expect(errors).toEqual([]);
  });

  test("S2 single account without flows computes a stable fill", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.singleAccount());

    expect(await financeValue(page, "solo")).toBe("$100K");
    expect(await fillValue(page, "solo")).toBe("50%");
    expect(errors).toEqual([]);
  });

  test("S3 self-loop recomputes as a no-op", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.selfLoop());

    const next = await state(page);
    expect(next.currentValues.loop).toBe(100000);
    await expect(page.locator(".connector-label").filter({ hasText: "Self loop" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("S4 two-node cycle remains deterministic", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.twoNodeCycle());

    const next = await state(page);
    expect(next.currentValues.accountA).toBe(90000);
    expect(next.currentValues.accountB).toBe(60000);
    expect(errors).toEqual([]);
  });

  test("S5 parallel multi-edge flows stay additive and selectable", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.parallelMultiEdge());

    const next = await state(page);
    expect(next.currentValues.source).toBe(50000);
    expect(next.currentValues.target).toBe(50000);
    await page.locator(".connector-label").filter({ hasText: "Parallel two" }).click();
    expect((await state(page)).selection).toEqual({ kind: "connector", id: "parallelTwo" });
    expect(errors).toEqual([]);
  });

  test("S6 flow exceeding source value flags overdraft without visual clamp", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.overdraft());

    expect(await financeValue(page, "source")).toBe("-$580K");
    expect(await fillValue(page, "source")).toBe("0%");
    await expect(page.locator(".canvas-item[data-item-id='source']")).toHaveAttribute("data-state", "overdraft");
    expect(errors).toEqual([]);
  });

  test("S7 zero-starting source keeps fill finite", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.zeroStartingSource());

    const fill = await fillValue(page, "zero");
    expect(fill).not.toContain("NaN");
    expect(fill).toBe("0%");
    expect(errors).toEqual([]);
  });

  test("S8 three-node cycle is order-independent", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.threeNodeCycle());

    const next = await state(page);
    expect(next.currentValues.a).toBe(85000);
    expect(next.currentValues.b).toBe(60000);
    expect(next.currentValues.c).toBe(30000);
    expect(errors).toEqual([]);
  });

  test("S9 rollover chain with tax leakage computes expected balances", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.rolloverChain());

    const next = await state(page);
    expect(next.currentValues.old401k).toBe(200000);
    expect(next.currentValues.ira).toBe(176000);
    expect(next.currentValues.roth).toBe(100000);
    expect(next.currentValues.tax).toBe(24000);
    expect(errors).toEqual([]);
  });

  test("S10 disconnected components fit within the viewport", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.disconnectedComponents());

    const visible = await page.evaluate(() => {
      const stage = document.querySelector("#canvasStage").getBoundingClientRect();
      return Array.from(document.querySelectorAll(".canvas-item")).every((node) => {
        const rect = node.getBoundingClientRect();
        return rect.right >= stage.left && rect.left <= stage.right && rect.bottom >= stage.top && rect.top <= stage.bottom;
      });
    });
    expect(visible).toBe(true);
    expect(errors).toEqual([]);
  });

  test("S15 household of 18 renders all accounts without browser errors", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.householdOf18());

    await expect(page.locator(".canvas-item.item-finance")).toHaveCount(18);
    expect((await state(page)).items).toHaveLength(18);
    expect(errors).toEqual([]);
  });

  test("S16 extreme value range stays numeric", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.extremeValueRange());

    const next = await state(page);
    expect(next.currentValues.tiny).toBe(500000001);
    expect(next.currentValues.huge).toBe(500000000);
    expect(await fillValue(page, "tiny")).not.toContain("NaN");
    expect(await fillValue(page, "huge")).not.toContain("NaN");
    expect(errors).toEqual([]);
  });

  test("S17 adversarial labels are escaped and inert", async ({ page }) => {
    const errors = await openApp(page);
    await loadScenario(page, scenarios.adversarialLabels());

    const escaped = await page.locator(".canvas-item[data-item-id='badLabel']").evaluate((node) => node.innerHTML.includes("&lt;script&gt;"));
    expect(escaped).toBe(true);
    expect(await page.evaluate(() => window.__AFV_LABEL_EXECUTED)).toBeUndefined();
    await expect(page.locator(".canvas-item[data-item-id='badLabel']")).toContainText("<script>window.__AFV_LABEL_EXECUTED=true</script>");
    expect(errors).toEqual([]);
  });
});
