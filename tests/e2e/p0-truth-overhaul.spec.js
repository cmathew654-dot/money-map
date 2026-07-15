const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";

async function openApp(page, templateId = "retirement") {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.evaluate(() => window.__AFV_TEST__.fit());
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return errors;
}

async function state(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

async function viewModel(page) {
  return page.evaluate(() => window.__AFV_TEST__.getComputedViewModel());
}

async function computeDiagnostics(page) {
  return page.evaluate(() => window.__AFV_TEST__.getComputeDiagnostics());
}

async function renderDiagnostics(page) {
  return page.evaluate(() => window.__AFV_TEST__.getRenderDiagnostics());
}

async function loadSimpleFlow(page, amount = 25000) {
  await page.evaluate((flowAmount) => {
    window.__AFV_TEST__.loadDiagram({
      items: [
        {
          id: "source",
          type: "finance",
          visual: "card",
          label: "Source Account",
          subtitle: "Investment Account",
          note: "Base balance",
          x: 620,
          y: 500,
          w: 250,
          h: 132,
          zIndex: 20,
          financeId: "source"
        },
        {
          id: "target",
          type: "finance",
          visual: "card",
          label: "Target Account",
          subtitle: "Investment Account",
          note: "After flow",
          x: 980,
          y: 500,
          w: 250,
          h: 132,
          zIndex: 20,
          financeId: "target"
        }
      ],
      financeData: {
        source: { category: "brokerage", value: 100000, capacity: 160000, baseValue: 100000 },
        target: { category: "brokerage", value: 0, capacity: 160000, baseValue: 0 }
      },
      connectors: [
        {
          id: "fundingFlow",
          label: "Funding flow",
          flowType: "transfer",
          cadence: "oneTime",
          sourceEffect: "decreaseBalance",
          targetEffect: "increaseBalance",
          amount: flowAmount,
          max: 150000,
          source: { itemId: "source" },
          target: { itemId: "target" },
          routeStyle: "straight",
          strokeStyle: "solid",
          arrowStart: "none",
          arrowEnd: "arrow",
          labelMode: "auto",
          colorMode: "flow",
          widthMode: "amount",
          customWidth: 5
        }
      ],
      scenario: {}
    });
  }, amount);
  await page.locator("#fitButton").click();
}

test.describe("P0 truth-first computed contract", () => {
  test("computed view model is the canonical source for DOM labels and inventory", async ({ page }) => {
    const errors = await openApp(page, "retirement");

    const vm = await viewModel(page);
    const s = await state(page);
    expect(vm).toMatchObject({
      financeValues: expect.any(Object),
      cashflow: expect.any(Object),
      connectors: expect.any(Object),
      inventory: expect.any(Object),
      diagnostics: expect.any(Object)
    });

    expect(vm.financeValues).toEqual(s.currentValues);
    expect(vm.cashflow.gap).toBe(vm.cashflow.mapped - vm.cashflow.need);
    expect(vm.inventory.total).toBe(
      vm.inventory.rows.reduce((sum, row) => sum + row.value, 0)
    );
    expect(vm.connectors.incomeDistribution.amountText).toBe("$4,000/mo");
    await expect(page.locator(".connector-label[data-connector-id='incomeDistribution'] .amount")).toHaveText(vm.connectors.incomeDistribution.amountText);
    expect(errors).toEqual([]);
  });

  test("connector amount edit updates source and target balances as one undoable commit", async ({ page }) => {
    const errors = await openApp(page);
    await loadSimpleFlow(page);

    let vm = await viewModel(page);
    expect(vm.financeValues.source).toBe(75000);
    expect(vm.financeValues.target).toBe(25000);

    const beforeHistory = await page.evaluate(() => window.__AFV_TEST__.getDiagnostics().historyPastLength);
    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "fundingFlow");
      window.__AFV_TEST__.openPopover("connector-data");
    });
    const input = page.locator(".selection-inspector input[data-input='connector-amount']");
    await expect(input).toBeVisible();
    await input.focus();
    await input.fill("40000");
    await input.blur();

    vm = await viewModel(page);
    expect(vm.connectors.fundingFlow.amount).toBe(40000);
    expect(vm.financeValues.source).toBe(60000);
    expect(vm.financeValues.target).toBe(40000);
    expect((await page.evaluate(() => window.__AFV_TEST__.getDiagnostics().historyPastLength)) - beforeHistory).toBe(1);

    await page.keyboard.press("Control+Z");
    await expect.poll(async () => (await viewModel(page)).financeValues.source).toBe(75000);
    await expect.poll(async () => (await viewModel(page)).financeValues.target).toBe(25000);
    expect(errors).toEqual([]);
  });

  test("typed connector amount waits for commit instead of recomputing on every keystroke", async ({ page }) => {
    const errors = await openApp(page);
    await loadSimpleFlow(page);

    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "fundingFlow");
      window.__AFV_TEST__.openPopover("connector-data");
    });

    const input = page.locator(".selection-inspector input[data-input='connector-amount']");
    await expect(input).toBeVisible();
    await input.focus();
    await page.evaluate(() => window.__AFV_TEST__.resetComputeDiagnostics());
    await input.fill("40000");

    let s = await state(page);
    expect(s.connectors.find((conn) => conn.id === "fundingFlow").amount).toBe(25000);
    expect(s.currentValues.source).toBe(75000);
    expect(s.currentValues.target).toBe(25000);
    expect((await computeDiagnostics(page)).computeValuesCalls).toBe(0);

    await input.blur();
    s = await state(page);
    expect(s.connectors.find((conn) => conn.id === "fundingFlow").amount).toBe(40000);
    expect(s.currentValues.source).toBe(60000);
    expect(s.currentValues.target).toBe(40000);
    const diagnostics = await computeDiagnostics(page);
    expect(diagnostics.computeValuesCalls).toBeLessThanOrEqual(2);
    expect(diagnostics.viewModelComputes).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test("direct connector amount edits do not mutate sibling scenario-driven flows", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        items: [
          { id: "sourceA", type: "finance", visual: "card", label: "Source A", x: 520, y: 420, w: 250, h: 132, financeId: "sourceA" },
          { id: "paycheckA", type: "finance", visual: "paycheck", label: "Paycheck A", x: 940, y: 420, w: 280, h: 160, financeId: "paycheckA" },
          { id: "sourceB", type: "finance", visual: "card", label: "Source B", x: 520, y: 700, w: 250, h: 132, financeId: "sourceB" },
          { id: "paycheckB", type: "finance", visual: "paycheck", label: "Paycheck B", x: 940, y: 700, w: 280, h: 160, financeId: "paycheckB" }
        ],
        financeData: {
          sourceA: { category: "brokerage", value: 100000, capacity: 200000 },
          paycheckA: { category: "household", value: 0, capacity: 1 },
          sourceB: { category: "brokerage", value: 100000, capacity: 200000 },
          paycheckB: { category: "household", value: 0, capacity: 1 }
        },
        connectors: [
          {
            id: "flowA",
            label: "Flow A",
            flowType: "income",
            cadence: "monthly",
            scenarioKey: "monthlyDistribution",
            targetEffect: "cashflowCoverage",
            amount: 12000,
            max: 60000,
            source: { itemId: "sourceA" },
            target: { itemId: "paycheckA" }
          },
          {
            id: "flowB",
            label: "Flow B",
            flowType: "income",
            cadence: "monthly",
            scenarioKey: "monthlyDistribution",
            targetEffect: "cashflowCoverage",
            amount: 12000,
            max: 60000,
            source: { itemId: "sourceB" },
            target: { itemId: "paycheckB" }
          }
        ],
        scenario: { monthlyNeed: 5000, monthlyDistribution: 1000, annuityMonthlyIncome: 0, annuityOn: false }
      });
    });

    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "flowA");
      window.__AFV_TEST__.openPopover("connector-data");
    });
    const input = page.locator(".selection-inspector input[data-input='connector-amount']");
    await expect(input).toHaveValue("$1,000");
    await input.focus();
    await input.fill("2000");
    await input.blur();

    let s = await state(page);
    let flowA = s.connectors.find((conn) => conn.id === "flowA");
    let flowB = s.connectors.find((conn) => conn.id === "flowB");
    expect(flowA.amount).toBe(24000);
    expect(flowB.amount).toBe(12000);
    expect(s.scenario.monthlyDistribution).toBe(1000);
    expect(flowA.manualAmount).toBe(true);
    expect(flowB.manualAmount).not.toBe(true);

    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 3000));
    s = await state(page);
    flowA = s.connectors.find((conn) => conn.id === "flowA");
    flowB = s.connectors.find((conn) => conn.id === "flowB");
    expect(flowA.amount).toBe(24000);
    expect(flowB.amount).toBe(36000);
    expect(errors).toEqual([]);
  });

  test("connector range drag previews cheaply and commits one manual override", async ({ page }) => {
    const errors = await openApp(page, "retirementPaycheck");
    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "portfolioDraw");
      window.__AFV_TEST__.openPopover("connector-data");
      window.__AFV_TEST__.resetComputeDiagnostics();
      window.__AFV_TEST__.resetRenderDiagnostics();
    });

    const range = page.locator('.selection-inspector input[data-input="connector-amount-range"]');
    await expect(range).toBeVisible();
    await range.evaluate((node) => {
      ["4500", "5000", "5500"].forEach((value) => {
        node.value = value;
        node.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });

    const duringCompute = await computeDiagnostics(page);
    const duringRender = await renderDiagnostics(page);
    expect(duringCompute.computeValuesCalls).toBe(0);
    expect(duringRender.connectorGeometryPasses).toBe(0);
    await expect(page.locator(".connector-label[data-connector-id='portfolioDraw'] .amount")).toHaveText("$5,500/mo");

    await range.dispatchEvent("change");
    const after = await state(page);
    const conn = after.connectors.find((entry) => entry.id === "portfolioDraw");
    expect(conn.amount).toBe(66000);
    expect(conn.manualAmount).toBe(true);
    expect((await computeDiagnostics(page)).computeValuesCalls).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });

  test("scenario-linked flow source is visible and manual override can reset to linked", async ({ page }) => {
    const errors = await openApp(page, "retirementPaycheck");
    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "portfolioDraw");
      window.__AFV_TEST__.openPopover("connector-data");
    });

    const status = page.locator(".flow-source-status");
    await expect(status).toHaveAttribute("data-flow-source", "linked");
    await expect(status).toContainText("Linked to scenario");
    await expect(status).toContainText("Portfolio draw");
    await expect(status).toContainText("Monthly");

    const input = page.locator(".selection-inspector input[data-input='connector-amount']");
    await input.focus();
    await input.fill("5100");
    await input.blur();

    await expect(status).toHaveAttribute("data-flow-source", "manual");
    await expect(status).toContainText("Manual override");
    await expect(page.locator("[data-action='reset-connector-amount-link']")).toBeEnabled();

    await page.locator("[data-action='reset-connector-amount-link']").click();
    await expect(status).toHaveAttribute("data-flow-source", "linked");
    await expect(input).toHaveValue("$4,000");
    const s = await state(page);
    const conn = s.connectors.find((entry) => entry.id === "portfolioDraw");
    expect(conn.manualAmount).not.toBe(true);
    expect(conn.amount).toBe(48000);
    expect(errors).toEqual([]);
  });

  test("paycheck tiles use target-specific cashflow instead of one global summary", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        items: [
          { id: "sourceA", type: "finance", visual: "card", label: "Source A", x: 520, y: 420, w: 250, h: 132, financeId: "sourceA" },
          { id: "paycheckA", type: "finance", visual: "paycheck", label: "Paycheck A", x: 940, y: 420, w: 280, h: 160, financeId: "paycheckA" },
          { id: "sourceB", type: "finance", visual: "card", label: "Source B", x: 520, y: 700, w: 250, h: 132, financeId: "sourceB" },
          { id: "paycheckB", type: "finance", visual: "paycheck", label: "Paycheck B", x: 940, y: 700, w: 280, h: 160, financeId: "paycheckB" }
        ],
        financeData: {
          sourceA: { category: "brokerage", value: 100000, capacity: 200000 },
          paycheckA: { category: "household", value: 0, capacity: 1, monthlyNeed: 5000 },
          sourceB: { category: "brokerage", value: 100000, capacity: 200000 },
          paycheckB: { category: "household", value: 0, capacity: 1, monthlyNeed: 3000 }
        },
        connectors: [
          {
            id: "flowA",
            label: "Flow A",
            flowType: "income",
            cadence: "monthly",
            targetEffect: "cashflowCoverage",
            amount: 12000,
            max: 60000,
            source: { itemId: "sourceA" },
            target: { itemId: "paycheckA" }
          },
          {
            id: "flowB",
            label: "Flow B",
            flowType: "income",
            cadence: "monthly",
            targetEffect: "cashflowCoverage",
            amount: 48000,
            max: 60000,
            source: { itemId: "sourceB" },
            target: { itemId: "paycheckB" }
          }
        ],
        scenario: { monthlyNeed: 7500, annuityMonthlyIncome: 0, annuityOn: false }
      });
    });

    const vm = await viewModel(page);
    expect(vm.cashflowByItemId.paycheckA).toMatchObject({ need: 5000, mapped: 1000, gap: -4000 });
    expect(vm.cashflowByItemId.paycheckB).toMatchObject({ need: 3000, mapped: 4000, gap: 1000 });
    await expect(page.locator(".canvas-item[data-item-id='paycheckA'] [data-cashflow-value='gap-label']")).toHaveText("Gap");
    await expect(page.locator(".canvas-item[data-item-id='paycheckA'] [data-cashflow-value='gap']")).toHaveText("$4,000");
    await expect(page.locator(".canvas-item[data-item-id='paycheckB'] [data-cashflow-value='gap-label']")).toHaveText("Surplus");
    await expect(page.locator(".canvas-item[data-item-id='paycheckB'] [data-cashflow-value='gap']")).toHaveText("$1,000");
    expect(errors).toEqual([]);
  });

  test("connector cadence is explicit in view-model labels", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        items: [
          { id: "source", type: "finance", visual: "card", label: "Source", x: 560, y: 500, w: 250, h: 132, financeId: "source" },
          { id: "paycheck", type: "finance", visual: "paycheck", label: "Client Paycheck", x: 960, y: 360, w: 280, h: 160, financeId: "paycheck" },
          { id: "target", type: "finance", visual: "card", label: "Target", x: 960, y: 650, w: 250, h: 132, financeId: "target" }
        ],
        financeData: {
          source: { category: "brokerage", value: 300000, capacity: 400000 },
          paycheck: { category: "household", value: 0, capacity: 1 },
          target: { category: "cash", value: 0, capacity: 200000 }
        },
        connectors: [
          {
            id: "monthlyIncome",
            label: "Monthly income",
            flowType: "income",
            cadence: "monthly",
            targetEffect: "cashflowCoverage",
            amount: 12000,
            max: 50000,
            source: { itemId: "source" },
            target: { itemId: "paycheck" }
          },
          {
            id: "annualDistribution",
            label: "Annual distribution",
            flowType: "beneficiary",
            cadence: "annual",
            amount: 120000,
            max: 200000,
            source: { itemId: "source" },
            target: { itemId: "target" }
          },
          {
            id: "oneTimeTransfer",
            label: "One-time transfer",
            flowType: "transfer",
            cadence: "oneTime",
            amount: 125000,
            max: 200000,
            source: { itemId: "source" },
            target: { itemId: "target" }
          }
        ],
        scenario: { monthlyNeed: 7500 }
      });
    });

    const vm = await viewModel(page);
    expect(vm.connectors.monthlyIncome).toMatchObject({ cadence: "monthly", amountText: "$1,000/mo" });
    expect(vm.connectors.annualDistribution).toMatchObject({ cadence: "annual", amountText: "$120,000/yr" });
    expect(vm.connectors.oneTimeTransfer).toMatchObject({ cadence: "oneTime", amountText: "$125K" });
    expect(errors).toEqual([]);
  });

  test("overdraft is exact math plus explicit warning state, never ordinary output", async ({ page }) => {
    const errors = await openApp(page);
    await loadSimpleFlow(page, 140000);

    const vm = await viewModel(page);
    const sourceRow = vm.inventory.rows.find((row) => row.id === "source");
    expect(vm.financeValues.source).toBe(-40000);
    expect(vm.diagnostics.overdraftItemIds).toContain("source");
    expect(sourceRow.state).toBe("overdraft");
    await expect(page.locator(".canvas-item[data-item-id='source']")).toHaveAttribute("data-state", "overdraft");
    await expect(page.locator(".canvas-item[data-item-id='source'] .finance-value")).toHaveText("-$40K");
    expect(errors).toEqual([]);
  });

  test("rapid scenario updates converge without stale hot labels", async ({ page }) => {
    const errors = await openApp(page, "retirement");

    await page.evaluate(() => {
      for (let index = 0; index < 50; index += 1) {
        window.__AFV_TEST__.setScenario("monthlyDistribution", index === 49 ? 7300 : 1000 + index * 100);
      }
    });
    await page.waitForTimeout(650);

    const vm = await viewModel(page);
    expect(vm.connectors.incomeDistribution.amountText).toBe("$7,300/mo");
    await expect(page.locator(".connector-label[data-connector-id='incomeDistribution'] .amount")).toHaveText("$7,300/mo");
    expect(await page.evaluate(() => window.__AFV_TEST__.getDiagnostics().hotConnectorIds)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("scenario value changes patch connector labels without full route recompute", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    await page.evaluate(() => window.__AFV_TEST__.resetRenderDiagnostics());

    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 7300));

    const diagnostics = await renderDiagnostics(page);
    expect(diagnostics.connectorPathComputes).toBe(0);
    expect(diagnostics.connectorValuePasses).toBeGreaterThan(0);
    await expect(page.locator(".connector-label[data-connector-id='incomeDistribution'] .amount")).toHaveText("$7,300/mo");
    expect(errors).toEqual([]);
  });

  test("motion off keeps semantic connector strokes static during recompute", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    await page.evaluate(() => window.__AFV_TEST__.setMotionEnabled(false));
    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 7200));

    const vm = await viewModel(page);
    expect(vm.motion.enabled).toBe(false);
    expect(vm.connectors.incomeDistribution.motionEnabled).toBe(false);
    const draw = page.locator(".connector-draw[data-connector-id='incomeDistribution']");
    await expect(draw).toHaveAttribute("data-motion-enabled", "false");
    await expect(draw).not.toHaveClass(/is-hot/);
    const animation = await draw.evaluate((node) => getComputedStyle(node).animationName);
    expect(animation).toBe("none");
    expect(errors).toEqual([]);
  });

  test("prefers-reduced-motion keeps hot connector strokes static", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = await openApp(page, "retirement");
    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 7200));

    const vm = await viewModel(page);
    expect(vm.motion.reduced).toBe(true);
    const draw = page.locator(".connector-draw[data-connector-id='incomeDistribution']");
    await expect(draw).toHaveAttribute("data-motion-enabled", "true");
    const animation = await draw.evaluate((node) => getComputedStyle(node).animationName);
    expect(animation).toBe("none");
    expect(errors).toEqual([]);
  });

  test("Escape and blank canvas interaction clear edit and selection state without text selection", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    const cardText = page.locator(".canvas-item[data-item-id='managedPortfolio'] .finance-name");
    await cardText.dblclick();
    await page.keyboard.press("Escape");

    await expect.poll(async () => (await state(page)).selection).toBeNull();
    expect(await page.evaluate(() => window.getSelection().toString())).toBe("");

    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "managedPortfolio");
      window.__AFV_TEST__.openPopover("selection-data");
    });
    await page.mouse.click(160, 160);
    const s = await state(page);
    expect(s.selection).toBeNull();
    expect(s.activePopover).toBeNull();
    expect(await page.evaluate(() => window.getSelection().toString())).toBe("");
    expect(errors).toEqual([]);
  });
});
