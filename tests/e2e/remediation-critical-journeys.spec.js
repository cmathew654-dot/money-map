const { test, expect } = require("@playwright/test");

const APP_URL = "http://127.0.0.1:54217/index.html?test=1";

async function openTemplate(page, templateId) {
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.locator('.template-catalog-card[data-template-id="' + templateId + '"]').click();
  await page.locator("#fitButton").click();
}

async function setRangeByKeyboard(locator, steps) {
  await locator.focus();
  await locator.press("Home");
  for (let index = 0; index < steps; index += 1) await locator.press("ArrowRight");
  await locator.press("Tab");
}

async function renderedText(page, selector) {
  return (await page.locator(selector).first().innerText()).replace(/\s+/g, " ").trim();
}

test.describe("approved remediation critical journeys", () => {
  test("RMD renders one gross split plus QCD, never a double debit", async ({ page }) => {
    await openTemplate(page, "rmdTax");
    await page.locator("#meetingPanelButton").click();
    await page.locator('[data-meeting-tab="controls"]').click();
    await setRangeByKeyboard(page.locator('[data-scenario="monthlyDistribution"]'), 24);
    await setRangeByKeyboard(page.locator('[data-scenario="taxReservePct"]'), 30);

    await page.locator('.connector-label[data-connector-id="qcd"]').click();
    const amount = page.locator('.selection-inspector [data-input="connector-amount"]');
    await amount.fill("20000");
    await amount.press("Enter");
    await amount.blur();

    const snapshot = await page.evaluate(() => window.__AFV_TEST__.getState());
    const gross = snapshot.scenario.monthlyDistribution * 12;
    const withholding = Math.round(gross * snapshot.scenario.taxReservePct / 100);
    const spendable = gross - withholding;
    const qcd = snapshot.connectors.find((entry) => entry.id === "qcd").amount;
    const startingIra = snapshot.financeData.ira.value;
    const expectedIra = startingIra - gross - qcd;

    await expect(page.locator('.connector-label[data-connector-id="rmdSpend"] .amount')).toHaveText("$" + (spendable / 12).toLocaleString("en-US") + "/mo");
    await expect(page.locator('.connector-label[data-connector-id="withholding"] .amount')).toContainText(withholding.toLocaleString("en-US"));
    await expect(page.locator('.connector-label[data-connector-id="qcd"] .amount')).toContainText(qcd.toLocaleString("en-US"));
    await expect(page.locator('.canvas-item[data-item-id="ira"] .finance-value')).toHaveText("$" + Math.round(expectedIra / 1000).toLocaleString("en-US") + "K");
    await expect(page.locator('[data-cashflow-rail="mapped"]').first()).toContainText((spendable / 12).toLocaleString("en-US"));

    await page.locator("#presentationButton").click();
    await expect(page.locator('.connector-label[data-connector-id="rmdSpend"] .amount')).toHaveText("$" + (spendable / 12).toLocaleString("en-US") + "/mo");
    await expect(page.locator(".text-disclosure")).toContainText(/illustrative|eligibility|advisor/i);
  });

  test("responsive gate round-trip preserves document and undo history", async ({ page }) => {
    await openTemplate(page, "retirementPaycheck");
    await page.locator("#meetingPanelButton").click();
    await page.locator('[data-meeting-tab="controls"]').click();
    const draw = page.locator('[data-scenario="monthlyDistribution"]');
    await setRangeByKeyboard(draw, 20);
    const before = await renderedText(page, '.connector-label[data-connector-id="portfolioDraw"] .amount');

    await page.setViewportSize({ width: 900, height: 800 });
    await expect(page.locator("#narrowScreenGate")).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator("#narrowScreenGate")).toBeHidden();
    await expect(page.locator('.connector-label[data-connector-id="portfolioDraw"] .amount')).toHaveText(before);

    await page.keyboard.press("Control+z");
    await expect(page.locator('.connector-label[data-connector-id="portfolioDraw"] .amount')).not.toHaveText(before);
  });

  test("Meeting is keyboard reachable and presentation exposes no edge handles", async ({ page }) => {
    await openTemplate(page, "retirementPaycheck");
    const button = page.locator("#meetingPanelButton");
    await button.focus();
    await button.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#scenarioRail .meeting-tabs")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await page.locator("#presentationButton").click();
    await page.locator('.canvas-item[data-item-id="portfolio"]').hover();
    await expect(page.locator(".item-edge-handles").first()).toBeHidden();
    expect(await page.locator(".item-edge-handles").first().evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
  });

  test("Detach is a visible geometry-only command and reset is one-step reversible", async ({ page }) => {
    await openTemplate(page, "retirementPaycheck");
    await page.locator('.connector-label[data-connector-id="portfolioDraw"]').click();
    const beforeMoney = await renderedText(page, '.connector-label[data-connector-id="portfolioDraw"] .amount');
    const beforeCard = await renderedText(page, '.canvas-item[data-item-id="portfolio"] .finance-value');
    await page.locator('.selection-inspector [data-action="detach-connector"]').click();
    await page.locator('.selection-inspector [data-inspector-tab="connector-endpoints"]').click();
    await expect(page.locator(".selection-inspector")).toContainText(/Source free|Target free/);
    await expect(page.locator('.connector-label[data-connector-id="portfolioDraw"] .amount')).toHaveText(beforeMoney);
    await expect(page.locator('.canvas-item[data-item-id="portfolio"] .finance-value')).toHaveText(beforeCard);
    await page.keyboard.press("Control+z");
    const restored = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((entry) => entry.id === "portfolioDraw"));
    expect(restored.source.detached).not.toBe(true);
    expect(restored.target.detached).not.toBe(true);

    await page.locator("#meetingPanelButton").click();
    await page.locator('[data-meeting-tab="controls"]').click();
    await setRangeByKeyboard(page.locator('[data-scenario="monthlyNeed"]'), 34);
    const changed = await renderedText(page, '[data-cashflow-rail="need"]');
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#resetButton").click();
    await expect(page.locator('[data-cashflow-rail="need"]')).not.toHaveText(changed);
    await page.keyboard.press("Control+z");
    await expect(page.locator('[data-cashflow-rail="need"]')).toHaveText(changed);
  });

  test("slider focus does not swallow canvas Delete and flow changes preserve magnitude", async ({ page }) => {
    await openTemplate(page, "retirementPaycheck");
    const portfolio = page.locator('.canvas-item[data-item-id="portfolio"]');
    await page.locator("#meetingPanelButton").click();
    await page.locator('[data-meeting-tab="controls"]').click();
    await portfolio.click();
    await page.locator('[data-scenario="monthlyDistribution"]').focus();
    await page.keyboard.press("Delete");
    await expect(portfolio).toHaveCount(0);
    await page.keyboard.press("Control+z");
    await expect(page.locator('.canvas-item[data-item-id="portfolio"]')).toBeVisible();

    await page.locator('.connector-label[data-connector-id="portfolioDraw"]').click();
    const before = await renderedText(page, '.connector-label[data-connector-id="portfolioDraw"] .amount');
    await page.locator('[data-set="connector-field"][data-field="flowType"][data-value="rmd"]').click();
    await expect(page.locator('.connector-label[data-connector-id="portfolioDraw"] .amount')).toHaveText(before);
    const transitioned = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((entry) => entry.id === "portfolioDraw"));
    expect(transitioned.scenarioKey).toBeNull();
    expect(transitioned.cadence).toBe("monthly");
    await page.keyboard.press("Control+z");
    await page.locator('.connector-label[data-connector-id="portfolioDraw"]').click();
    await expect(page.locator('[data-set="connector-field"][data-field="flowType"][data-value="income"]')).toHaveClass(/is-active/);
  });
});
