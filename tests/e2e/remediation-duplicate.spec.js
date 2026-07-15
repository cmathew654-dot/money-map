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

test.describe("remediation :: duplicate preserves cashflow", () => {
  test("duplicating a scenario-linked income connector does not double-count mapped", async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirementPaycheck"));
    await settle(page);

    const before = await page.evaluate(() => {
      const vm = window.__AFV_TEST__.getComputedViewModel();
      return {
        mapped: vm.cashflow.mapped,
        gap: vm.cashflow.gap,
        invTotal: vm.inventory.total,
        count: window.__AFV_TEST__.getState().connectors.length
      };
    });

    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "portfolioDraw");
      window.__AFV_TEST__.openPopover("connector-data");
    });
    await settle(page);
    await page.locator('[data-action="duplicate"]').first().click();
    await settle(page);

    const after = await page.evaluate(() => {
      const vm = window.__AFV_TEST__.getComputedViewModel();
      const st = window.__AFV_TEST__.getState();
      const copy = st.connectors.find((c) => c.id.includes("-copy-"));
      return {
        mapped: vm.cashflow.mapped,
        gap: vm.cashflow.gap,
        invTotal: vm.inventory.total,
        count: st.connectors.length,
        copyScenarioKey: copy ? copy.scenarioKey : "MISSING",
        copyAmount: copy ? copy.amount : null,
        copyTargetEffect: copy ? copy.targetEffect : null
      };
    });

    expect(after.count).toBe(before.count + 1); // a copy exists
    expect(after.copyScenarioKey).toBeUndefined(); // semantic binding stripped
    expect(after.copyTargetEffect).toBe("none"); // no longer covers cashflow
    expect(after.copyAmount).toBe(48000); // visual amount preserved
    expect(after.mapped).toBe(before.mapped); // cashflow unchanged
    expect(after.gap).toBe(before.gap);
    expect(after.invTotal).toBe(before.invTotal);
    expect(errors).toEqual([]);
  });
});
