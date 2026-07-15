const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";

const ALL_TEMPLATES = [
  "retirementPaycheck",
  "socialSecurityBridge",
  "bucketStrategy",
  "rmdTax",
  "withdrawalSequencing",
  "cashCleanup",
  "annuityIncomeFloor",
  "executiveComp",
  "businessOwner",
  "survivorIncome",
  "retirement",
  "roth",
  "annuity",
  "estate",
  "cashReserve"
];

const CONTROL_KEYS = [
  "guaranteedIncome",
  "annuityIncome",
  "monthlyDistribution",
  "taxPayment",
  "annuityPremium",
  "rollover",
  "rothConversion"
];

const EXPECTED_EFFECTS = {
  retirementPaycheck: ["guaranteedIncome", "annuityIncome", "monthlyDistribution"],
  socialSecurityBridge: ["guaranteedIncome", "monthlyDistribution"],
  bucketStrategy: ["annuityIncome", "monthlyDistribution"],
  rmdTax: ["monthlyDistribution", "taxPayment"],
  withdrawalSequencing: ["monthlyDistribution"],
  cashCleanup: ["monthlyDistribution"],
  annuityIncomeFloor: ["annuityIncome", "annuityPremium", "monthlyDistribution"],
  executiveComp: ["monthlyDistribution"],
  businessOwner: ["monthlyDistribution"],
  survivorIncome: ["guaranteedIncome", "monthlyDistribution"],
  retirement: ["annuityIncome", "annuityPremium", "monthlyDistribution", "rollover"],
  roth: ["rothConversion", "taxPayment"],
  annuity: ["annuityIncome", "annuityPremium"],
  estate: [],
  cashReserve: ["monthlyDistribution"]
};

const SCENARIO_DRIVER = {
  guaranteedIncome: { key: "guaranteedIncome", mid: 2500, max: 5000 },
  annuityIncome: { key: "annuityMonthlyIncome", mid: 2400, max: 3500 },
  monthlyDistribution: { key: "monthlyDistribution", mid: 5000, max: 9000 },
  taxPayment: { key: "taxReservePct", mid: 18, max: 35 },
  annuityPremium: { key: "annuityPremium", mid: 150000, max: 400000 },
  rollover: { key: "rollover", mid: 200000, max: 450000 },
  rothConversion: { key: "rothConversion", mid: 80000, max: 200000 }
};

async function openApp(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("console.error: " + msg.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => !!window.__AFV_TEST__, { timeout: 15000 });
  return errors;
}

async function settle(page) {
  await page.evaluate(() =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
}

async function revealControls(page) {
  await page.locator("#scenarioRail").hover();
  await expect(page.locator(".cashflow-strip")).toBeVisible();
}

function compactDollars(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 0
  }).format(Math.round(Number(value) || 0));
}

function fullDollars(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Math.round(Number(value) || 0));
}

function cssIdent(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function connectorUsesMonthlyDisplay(conn, snapshot) {
  if (conn.cadence) return conn.cadence === "monthly";
  if (["monthlyDistribution", "guaranteedIncome", "flexibleIncome", "annuityIncome"].includes(conn.scenarioKey)) return true;
  const target = snapshot.items.find((item) => item.id === conn.target?.itemId);
  return target?.visual === "paycheck" && (conn.flowType === "income" || conn.flowType === "rmd");
}

function connectorDisplayText(conn, snapshot) {
  if (connectorUsesMonthlyDisplay(conn, snapshot)) return `${fullDollars((Number(conn.amount) || 0) / 12)}/mo`;
  if (conn.cadence === "annual") return `${fullDollars(conn.amount)}/yr`;
  return compactDollars(conn.amount);
}

function normalizeMoneyText(text) {
  return String(text || "").trim().replace(/\/(?:mo|yr)$/i, "");
}

function financeIdForItem(state, itemId) {
  return state.items.find((item) => item.id === itemId)?.financeId || null;
}

function sourceEffect(conn) {
  return conn.sourceEffect || (conn.affectsSource === false ? "none" : "decreaseBalance");
}

function targetEffect(conn) {
  return conn.targetEffect || (conn.affectsTarget === false ? "none" : "increaseBalance");
}

function expectedKeys(templateId) {
  return [...(EXPECTED_EFFECTS[templateId] || [])].sort();
}

async function loadTemplate(page, templateId) {
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await settle(page);
}

async function getState(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

async function connectorAmountText(page, connectorId) {
  const label = page.locator(`.connector-label[data-connector-id="${cssIdent(connectorId)}"] strong.amount`).first();
  if ((await label.count()) === 0) return null;
  return ((await label.textContent()) || "").trim();
}

async function driveScenario(page, alias, value) {
  const driver = SCENARIO_DRIVER[alias];
  await page.evaluate(
    ({ key, scenarioValue }) => window.__AFV_TEST__.setScenario(key, scenarioValue),
    { key: driver.key, scenarioValue: value }
  );
  await settle(page);
}

async function runMatrixCell(page, templateId, alias) {
  await loadTemplate(page, templateId);

  const initialState = await getState(page);
  const expected = expectedKeys(templateId);
  const isExpectedSilent = !expected.includes(alias);
  const wiredConnectors = initialState.connectors.filter((conn) => conn.scenarioKey === alias);

  if (isExpectedSilent) {
    expect(wiredConnectors, `${templateId} x ${alias}: expected silent control`).toHaveLength(0);
    test.info().annotations.push({
      type: "intentional-silent-control",
      description: `${templateId} does not expose ${alias}`
    });
    return;
  }

  expect(wiredConnectors.length, `${templateId} x ${alias}: expected at least one wired connector`).toBeGreaterThan(0);

  await driveScenario(page, alias, SCENARIO_DRIVER[alias].mid);
  const midState = await getState(page);

  await driveScenario(page, alias, SCENARIO_DRIVER[alias].max);
  const maxState = await getState(page);

  for (const initialConnector of wiredConnectors) {
    const midConnector = midState.connectors.find((conn) => conn.id === initialConnector.id);
    const maxConnector = maxState.connectors.find((conn) => conn.id === initialConnector.id);

    expect(midConnector, `${templateId} x ${alias}: mid connector ${initialConnector.id}`).toBeTruthy();
    expect(maxConnector, `${templateId} x ${alias}: max connector ${initialConnector.id}`).toBeTruthy();
    expect(
      maxConnector.amount,
      `${templateId} x ${alias}: connector ${initialConnector.id} reacts to scenario change`
    ).not.toBe(initialConnector.amount);

    const labelText = await connectorAmountText(page, initialConnector.id);
    if (labelText !== null) {
      expect(labelText, `${templateId} x ${alias}: connector label reflects max amount`).toBe(connectorDisplayText(maxConnector, maxState));
    }

    const sourceFinanceId = financeIdForItem(maxState, initialConnector.source?.itemId);
    if (sourceFinanceId && sourceEffect(initialConnector) === "decreaseBalance" && initialState.currentValues[sourceFinanceId] !== undefined) {
      expect(
        maxState.currentValues[sourceFinanceId],
        `${templateId} x ${alias}: source ${sourceFinanceId} current value reacts`
      ).not.toBe(initialState.currentValues[sourceFinanceId]);
    }

    const targetFinanceId = financeIdForItem(maxState, initialConnector.target?.itemId);
    if (targetFinanceId && targetEffect(initialConnector) === "increaseBalance" && initialState.currentValues[targetFinanceId] !== undefined) {
      expect(
        maxState.currentValues[targetFinanceId],
        `${templateId} x ${alias}: target ${targetFinanceId} current value reacts`
      ).not.toBe(initialState.currentValues[targetFinanceId]);
    }
  }

  await revealControls(page);
  const cashflow = await page.evaluate(() => {
    const state = window.__AFV_TEST__.getState();
    const monthly = new Set(["monthlyDistribution", "guaranteedIncome", "flexibleIncome", "annuityIncome"]);
    const cadenceFor = (conn) => conn.cadence || (monthly.has(conn.scenarioKey) ? "monthly" : "oneTime");
    const mapped = state.connectors
      .filter((conn) => conn.timing !== "future" && (conn.targetEffect || (conn.affectsTarget === false ? "none" : "increaseBalance")) === "cashflowCoverage")
      .reduce((sum, conn) => sum + (cadenceFor(conn) === "monthly" ? (Number(conn.amount) || 0) / 12 : Number(conn.amount) || 0), 0);
    const s = state.scenario;
    const need = Number(s.monthlyNeed) || 0;
    return { gap: mapped - need };
  });
  const stripClass = await page.locator(".cashflow-strip").getAttribute("class");
  expect(stripClass).toContain(cashflow.gap >= 0 ? "is-surplus" : "is-gap");

  const canvasMapped = page.locator(".finance-paycheck [data-cashflow-value='mapped']").first();
  const stripMapped = page.locator("[data-cashflow-rail='mapped-inline']").first();
  if ((await canvasMapped.count()) > 0 && (await stripMapped.count()) > 0) {
    expect(normalizeMoneyText(await canvasMapped.textContent())).toBe(normalizeMoneyText(await stripMapped.textContent()));
  }
}

for (const templateId of ALL_TEMPLATES) {
  test.describe(`reactivity-matrix / ${templateId}`, () => {
    test.describe.configure({ mode: "serial" });

    test(`${templateId}: declared scenario keys match expected matrix`, async ({ page }) => {
      const errors = await openApp(page);
      await loadTemplate(page, templateId);
      const state = await getState(page);
      const actual = [...new Set(state.connectors.map((conn) => conn.scenarioKey).filter(Boolean))].sort();
      expect(actual, `${templateId}: actual wired scenario keys`).toEqual(expectedKeys(templateId));
      expect(errors).toEqual([]);
    });

    for (const alias of CONTROL_KEYS) {
      test(`${templateId} x ${alias}`, async ({ page }) => {
        const errors = await openApp(page);
        await runMatrixCell(page, templateId, alias);
        expect(errors).toEqual([]);
      });
    }
  });
}

test.describe("reactivity regressions", () => {
  test("retirement rollover scenario updates connector, source, and target", async ({ page }) => {
    const errors = await openApp(page);
    await loadTemplate(page, "retirement");

    const before = await getState(page);
    const beforeConnector = before.connectors.find((conn) => conn.id === "rollover");
    expect(beforeConnector?.amount).toBe(325000);

    await driveScenario(page, "rollover", 450000);
    const after = await getState(page);
    const afterConnector = after.connectors.find((conn) => conn.id === "rollover");

    expect(afterConnector?.amount).toBe(450000);
    expect(afterConnector?.presentationRole).toBe("secondary");
    expect(afterConnector?.labelMode).toBe("hidden");
    expect(after.currentValues.employer401k).toBe(before.currentValues.employer401k - 125000);
    expect(after.currentValues.rolloverIra).toBe(before.currentValues.rolloverIra + 125000);
    expect(await connectorAmountText(page, "rollover")).toBe(null);
    expect(errors).toEqual([]);
  });

  test("paycheck tile and cashflow strip use consistent need text after 7750 input", async ({ page }) => {
    const errors = await openApp(page);
    await loadTemplate(page, "retirementPaycheck");
    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyNeed", 7750));
    await settle(page);
    await revealControls(page);

    const tileNeed = await page.locator(".finance-paycheck [data-cashflow-value='need']").first().textContent();
    const stripNeed = await page.locator("[data-cashflow-rail='need']").first().textContent();
    expect(normalizeMoneyText(tileNeed)).toBe(normalizeMoneyText(stripNeed));
    expect(errors).toEqual([]);
  });

  test("paycheck tile gap label flips during incremental scenario updates", async ({ page }) => {
    const errors = await openApp(page);
    await loadTemplate(page, "retirementPaycheck");

    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyNeed", 4000));
    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 6000));
    await settle(page);
    await expect(page.locator(".paycheck-surface [data-cashflow-value='gap-label']").first()).toHaveText("Surplus");

    await page.evaluate(() => {
      window.__AFV_TEST__.setScenario("annuityOn", false);
      window.__AFV_TEST__.setScenario("annuityMonthlyIncome", 0);
      window.__AFV_TEST__.setScenario("guaranteedIncome", 0);
      window.__AFV_TEST__.setScenario("monthlyNeed", 12000);
      window.__AFV_TEST__.setScenario("monthlyDistribution", 1000);
    });
    await settle(page);
    await expect(page.locator(".paycheck-surface [data-cashflow-value='gap-label']").first()).toHaveText("Gap");
    expect(errors).toEqual([]);
  });
});
