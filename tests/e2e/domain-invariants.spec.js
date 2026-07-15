"use strict";

const { test, expect } = require("@playwright/test");

function makeLcg(seed) {
  let s = seed >>> 0;
  return function next() {
    s = Math.imul(1664525, s) + 1013904223;
    s >>>= 0;
    return s / 0x100000000;
  };
}

const GLOBAL_SEED = Number(process.env.AFV_SEED) || 0xdeadbeef;

const APP_URL = "http://localhost:54217/index.html?test=1";
const N_FUZZ = 20;
const N_CHAOS = 5;

const ALL_TEMPLATES = [
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
  "survivorIncome",
  "blankHousehold"
];

async function openApp(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push("[pageerror] " + err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("[console.error] " + msg.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => !!window.__AFV_TEST__, { timeout: 15000 });
  return errors;
}

async function settle(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
}

async function loadTemplate(page, id) {
  await page.evaluate((tid) => window.__AFV_TEST__.loadTemplate(tid), id);
  await settle(page);
}

async function getState(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

function financeIdForEndpoint(endpoint, items) {
  const itemId = endpoint?.itemId || null;
  if (!itemId) return null;
  return items.find((item) => item.id === itemId)?.financeId || null;
}

function baselineValues(state) {
  const values = {};
  for (const [id, data] of Object.entries(state.financeData)) {
    values[id] = Number(data.value) || 0;
  }
  return values;
}

function sourceEffect(conn) {
  return conn.sourceEffect || (conn.affectsSource === false ? "none" : "decreaseBalance");
}

function targetEffect(conn) {
  return conn.targetEffect || (conn.affectsTarget === false ? "none" : "increaseBalance");
}

function semanticFlag(conn, keys) {
  for (const key of keys) {
    const value = conn[key];
    if (value === true || value === false) return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return null;
}

function deferredFlow(conn) {
  return /future|deferred/i.test(String(conn.timing || "")) || /future|deferred/i.test(String(conn.domainRole || ""));
}

function includedInProposedBalances(conn) {
  const explicit = semanticFlag(conn, ["includeInProposedBalances", "includeInCurrentBalances", "affectsProposedBalances"]);
  if (explicit !== null) return explicit;
  return !deferredFlow(conn);
}

function checkFiniteState(state, label) {
  const violations = [];
  for (const [key, value] of Object.entries(state.scenario)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      violations.push(`FINITE [${label}] scenario.${key} = ${value}`);
    }
  }
  for (const [id, value] of Object.entries(state.currentValues)) {
    if (!Number.isFinite(value)) {
      violations.push(`FINITE [${label}] currentValues.${id} = ${value}`);
    }
  }
  for (const conn of state.connectors) {
    if (!Number.isFinite(Number(conn.amount))) {
      violations.push(`FINITE [${label}] connector.${conn.id}.amount = ${conn.amount}`);
    }
  }
  return violations;
}

function checkNetFlowConservation(state, initialValues, label) {
  const expected = { ...initialValues };

  for (const conn of state.connectors) {
    if (!includedInProposedBalances(conn)) continue;
    const amount = Number(conn.amount) || 0;
    const sourceId = financeIdForEndpoint(conn.source, state.items);
    const targetId = financeIdForEndpoint(conn.target, state.items);
    if (sourceId && expected[sourceId] !== undefined && sourceEffect(conn) === "decreaseBalance") {
      expected[sourceId] -= amount;
    }
    if (targetId && expected[targetId] !== undefined && targetEffect(conn) === "increaseBalance") {
      expected[targetId] += amount;
    }
  }

  const violations = [];
  for (const [id, expectedValue] of Object.entries(expected)) {
    const actualValue = state.currentValues[id];
    if (actualValue === undefined) continue;
    if (Math.abs(actualValue - expectedValue) > 0.001) {
      violations.push(
        `NET [${label}] ${id}: expected ${expectedValue}, got ${actualValue}, diff ${actualValue - expectedValue}`
      );
    }
  }
  return violations;
}

function checkLabelVsMath(state, stripLabel, label) {
  if (stripLabel === null) return [];
  const monthly = new Set(["monthlyDistribution", "guaranteedIncome", "flexibleIncome", "annuityIncome"]);
  const cadenceFor = (conn) => conn.cadence || (monthly.has(conn.scenarioKey) ? "monthly" : "oneTime");
  const need = Number(state.scenario.monthlyNeed) || 0;
  const coverage = state.connectors.filter((conn) => conn.timing !== "future" && targetEffect(conn) === "cashflowCoverage");
  // Mapped income comes only from genuine coverage connectors. When none exist
  // the app no longer fabricates a mapped figure from raw scenario defaults, so
  // mapped is 0 (and the banner is suppressed / this branch is skipped).
  const mapped = coverage.reduce((sum, conn) => sum + (cadenceFor(conn) === "monthly" ? (Number(conn.amount) || 0) / 12 : Number(conn.amount) || 0), 0);
  const expected = mapped - need >= 0 ? "Surplus" : "Gap";
  return stripLabel.includes(expected)
    ? []
    : [`CASHFLOW [${label}] strip="${stripLabel}" expected="${expected}" need=${need} mapped=${mapped}`];
}

function collectStateViolations(state, initialValues, stripLabel, label) {
  return [
    ...checkFiniteState(state, label),
    ...checkNetFlowConservation(state, initialValues, label),
    ...checkLabelVsMath(state, stripLabel, label)
  ];
}

async function negativeBalancePolicyViolations(page, label) {
  return page.evaluate((violationLabel) => {
    const state = window.__AFV_TEST__.getState();
    const violations = [];
    for (const [financeId, value] of Object.entries(state.currentValues)) {
      if (!(Number(value) < 0)) continue;
      const item = state.items.find((entry) => entry.financeId === financeId);
      const node = item ? document.querySelector(`.canvas-item[data-item-id="${item.id}"]`) : null;
      const valueText = node?.querySelector(".finance-value")?.textContent || "";
      const flagged = node?.dataset?.state === "overdraft";
      const hasNegativeText = /[-\u2212]/.test(valueText);
      if (!flagged || !hasNegativeText) {
        violations.push(
          `OVERDRAFT [${violationLabel}] ${financeId}=${value} flagged=${flagged} valueText="${valueText}"`
        );
      }
    }
    return violations;
  }, label);
}

function driverForScenarioKey(alias, state) {
  const connectors = state.connectors.filter((conn) => conn.scenarioKey === alias);
  const maxAmount = Math.max(...connectors.map((conn) => Number(conn.max) || Number(conn.amount) || 0), 0);
  if (alias === "monthlyDistribution") return { key: "monthlyDistribution", max: Math.min(Math.max(maxAmount / 12, 12000), 15000) };
  if (alias === "guaranteedIncome") return { key: "guaranteedIncome", max: Math.min(Math.max(maxAmount / 12, 6000), 10000) };
  if (alias === "annuityIncome") return { key: "annuityMonthlyIncome", max: Math.min(Math.max(maxAmount / 12, 5000), 10000) };
  if (alias === "taxPayment") {
    return { key: "taxReservePct", max: 45 };
  }
  if (alias === "annuityPremium") return { key: "annuityPremium", max: Math.min(Math.max(maxAmount, 250000), 600000) };
  if (alias === "rollover") return { key: "rollover", max: Math.min(Math.max(maxAmount, 325000), 600000) };
  if (alias === "rothConversion") return { key: "rothConversion", max: Math.min(Math.max(maxAmount, 125000), 350000) };
  return { key: alias, max: Math.min(Math.max(maxAmount, 10000), 250000) };
}

function randomScenario(state, rand) {
  const result = {};
  for (const alias of new Set(state.connectors.map((conn) => conn.scenarioKey).filter(Boolean))) {
    const driver = driverForScenarioKey(alias, state);
    if (result[driver.key] !== undefined) continue;
    result[driver.key] = Math.floor(rand() * (driver.max + 1));
  }
  if (state.items.some((item) => item.visual === "paycheck")) {
    result.monthlyNeed = 3000 + Math.floor(rand() * 9001);
  }
  return result;
}

async function applyScenario(page, scenario) {
  for (const [key, value] of Object.entries(scenario)) {
    await page.evaluate(([k, v]) => window.__AFV_TEST__.setScenario(k, v), [key, value]);
  }
  await settle(page);
}

async function readStripLabel(page) {
  const strip = page.locator(".cashflow-strip");
  if ((await strip.count()) === 0) return null;
  return ((await strip.textContent()) || "").trim();
}

async function readPaycheckGapLabel(page) {
  const label = page.locator(".paycheck-surface [data-cashflow-value='gap-label']").first();
  if ((await label.count()) === 0) return null;
  return ((await label.textContent()) || "").trim();
}

async function readInventoryTotal(page) {
  await page.locator("#inventoryButton").click();
  await settle(page);
  const el = page.locator(".inventory-total");
  const text = (await el.count()) ? ((await el.textContent()) || "").trim() : null;
  await page.locator("#inventoryButton").click();
  await settle(page);
  return text;
}

function compactDollars(value) {
  // Matches the app's inventory formatter: compact with up to 2 fraction digits
  // so a $1,592K sum shows as "$1.59M", not a misleading "$2M".
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2
  }).format(Math.round(Number(value) || 0));
}

for (const templateId of ALL_TEMPLATES) {
  test.describe.serial(`domain-invariants :: ${templateId}`, () => {
    test(`${templateId}: N=${N_FUZZ} realistic randomized scenarios`, async ({ page }) => {
      const errors = await openApp(page);
      await loadTemplate(page, templateId);

      let seed = GLOBAL_SEED;
      for (let i = 0; i < templateId.length; i++) seed = (Math.imul(seed, 31) + templateId.charCodeAt(i)) >>> 0;
      const rand = makeLcg(seed);

      const loadedState = await getState(page);
      const initial = baselineValues(loadedState);
      const violations = [];

      for (let iter = 0; iter < N_FUZZ; iter++) {
        const scenario = randomScenario(loadedState, rand);
        await applyScenario(page, scenario);

        const state = await getState(page);
        const label = `${templateId} iter=${iter} ${JSON.stringify(scenario)}`;
        violations.push(...collectStateViolations(state, initial, await readStripLabel(page), label));
        violations.push(...await negativeBalancePolicyViolations(page, label));
      }

      expect(violations, violations.join("\n")).toHaveLength(0);
      expect(errors).toEqual([]);
    });

    test(`${templateId}: inventory total matches compact display tolerance`, async ({ page }) => {
      const errors = await openApp(page);
      await loadTemplate(page, templateId);

      const stateBefore = await getState(page);
      const rand = makeLcg((GLOBAL_SEED ^ templateId.length ^ 0xabcdef) >>> 0);
      await applyScenario(page, randomScenario(stateBefore, rand));

      const state = await getState(page);
      let rawInventorySum = 0;
      for (const item of state.items) {
        if (item.type !== "finance" || !item.financeId) continue;
        const data = state.financeData[item.financeId];
        if (!data?.category) continue;
        rawInventorySum += Number(state.currentValues[item.financeId]) || 0;
      }

      expect(await readInventoryTotal(page)).toBe(`${compactDollars(rawInventorySum)} total`);
      expect(errors).toEqual([]);
    });

    test(`${templateId}: paycheck gap label matches strip after sign changes`, async ({ page }) => {
      const errors = await openApp(page);
      await loadTemplate(page, templateId);
      const state = await getState(page);
      if (!state.items.some((item) => item.visual === "paycheck")) {
        expect(errors).toEqual([]);
        return;
      }

      await applyScenario(page, {
        monthlyNeed: 4000,
        monthlyDistribution: 12000,
        guaranteedIncome: 7000,
        annuityMonthlyIncome: 8000,
        annuityOn: true
      });
      const surplusStrip = await readStripLabel(page);
      const surplusTile = await readPaycheckGapLabel(page);
      // Templates with income coverage flip to Surplus under this scenario. Ones
      // without coverage (roth/blank) keep an honest Gap -- mapped is $0, not a
      // figure fabricated from scenario defaults -- but the strip and the paycheck
      // tile must always show the SAME label. Assert that agreement.
      if (surplusTile && surplusStrip !== null) {
        expect(surplusStrip).toContain(surplusTile);
      }

      await applyScenario(page, {
        monthlyNeed: 12000,
        monthlyDistribution: 0,
        guaranteedIncome: 0,
        annuityMonthlyIncome: 0,
        annuityOn: false
      });
      const gapStrip = await readStripLabel(page);
      const gapTile = await readPaycheckGapLabel(page);
      if (gapTile) {
        expect(gapStrip).toContain("Gap");
        expect(gapTile).toBe("Gap");
      }

      expect(errors).toEqual([]);
    });

    test(`${templateId}: boundary and invalid scenario inputs stay finite`, async ({ page }) => {
      test.setTimeout(60000);
      const errors = await openApp(page);
      await loadTemplate(page, templateId);

      const state = await getState(page);
      const aliases = [...new Set(state.connectors.map((conn) => conn.scenarioKey).filter(Boolean))];
      const alias = aliases[0] || "monthlyDistribution";
      const driver = driverForScenarioKey(alias, state);
      const probes = [0, 1, driver.max, driver.max + 1, -1, NaN, Infinity, "abc"];
      const violations = [];

      for (const probe of probes) {
        await loadTemplate(page, templateId);
        await page.evaluate(([k, v]) => window.__AFV_TEST__.setScenario(k, v), [driver.key, probe]);
        await settle(page);

        const after = await getState(page);
        const label = `${templateId} ${driver.key}=${String(probe)}`;
        violations.push(...checkFiniteState(after, label));
        violations.push(...await negativeBalancePolicyViolations(page, label));
      }

      expect(violations, violations.join("\n")).toHaveLength(0);
      expect(errors).toEqual([]);
    });

    test(`${templateId}: multi-key chaos keeps net-flow invariants`, async ({ page }) => {
      const errors = await openApp(page);
      let seed = (GLOBAL_SEED ^ 0x600dc0de) >>> 0;
      for (let i = 0; i < templateId.length; i++) seed = (Math.imul(seed, 37) + templateId.charCodeAt(i)) >>> 0;
      const rand = makeLcg(seed);
      const violations = [];

      for (let iter = 0; iter < N_CHAOS; iter++) {
        await loadTemplate(page, templateId);
        const freshState = await getState(page);
        const initial = baselineValues(freshState);
        const scenario = randomScenario(freshState, rand);
        const entries = Object.entries(scenario).slice(0, 3);
        await applyScenario(page, Object.fromEntries(entries));

        const after = await getState(page);
        const label = `${templateId} chaos=${iter} ${JSON.stringify(Object.fromEntries(entries))}`;
        violations.push(...collectStateViolations(after, initial, await readStripLabel(page), label));
        violations.push(...await negativeBalancePolicyViolations(page, label));
      }

      expect(violations, violations.join("\n")).toHaveLength(0);
      expect(errors).toEqual([]);
    });
  });
}
