const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";

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

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function finance(id, x, y, options = {}) {
  return {
    id,
    type: "finance",
    visual: options.visual || "card",
    category: options.category || "brokerage",
    financeId: id,
    label: options.label || id.replace(/-/g, " "),
    subtitle: "Synthetic drag fixture",
    note: "Fake data only",
    x,
    y,
    w: options.w ?? 250,
    h: options.h ?? 132,
    zIndex: options.zIndex || 20,
    style: {}
  };
}

function connector(id, source, target, index = 0, options = {}) {
  return {
    id,
    label: options.label || `Flow ${index + 1}`,
    flowType: options.flowType || "transfer",
    amount: 25000 + index * 1000,
    max: 200000,
    source: { itemId: source, port: "right.out" },
    target: { itemId: target, port: "left.in" },
    routeStyle: options.routeStyle || "smartArc",
    strokeStyle: "solid",
    colorMode: "flow",
    widthMode: "medium",
    arrowEnd: "arrow",
    labelMode: "hidden",
    manualMid: false,
    mid: null
  };
}

function manyConnectorDiagram() {
  const items = [];
  const financeData = {};
  for (let index = 0; index < 16; index += 1) {
    const id = `node-${index}`;
    const column = index % 4;
    const row = Math.floor(index / 4);
    items.push(finance(id, 500 + column * 390, 330 + row * 255, { label: `Node ${index + 1}` }));
    financeData[id] = {
      category: "brokerage",
      value: 100000 + index * 5000,
      capacity: 500000,
      baseValue: 100000 + index * 5000
    };
  }

  const connectors = [];
  for (let index = 0; index < 42; index += 1) {
    const source = index < 12 ? "node-0" : `node-${(index % 15) + 1}`;
    const target = index < 12 ? `node-${(index % 15) + 1}` : `node-${((index * 5 + 3) % 15) + 1}`;
    connectors.push(connector(`flow-${index}`, source, target, index));
  }

  return { name: "Many connector drag fixture", items, groups: [], financeData, connectors, scenario: {} };
}

function singleConnectorDiagram() {
  return {
    name: "Selected connector drag fixture",
    items: [
      finance("source", 560, 520, { label: "Source Account" }),
      finance("target", 1180, 520, { label: "Target Account" }),
      finance("bystander-a", 560, 780, { label: "Bystander A" }),
      finance("bystander-b", 1180, 780, { label: "Bystander B" })
    ],
    groups: [],
    financeData: {
      source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
      target: { category: "cash", value: 100000, capacity: 300000, baseValue: 100000 },
      "bystander-a": { category: "brokerage", value: 1000, capacity: 10000, baseValue: 1000 },
      "bystander-b": { category: "cash", value: 1000, capacity: 10000, baseValue: 1000 }
    },
    connectors: [
      connector("selected-flow", "source", "target", 0, { label: "Selected transfer" }),
      connector("bystander-flow", "bystander-a", "bystander-b", 1, { label: "Bystander transfer" })
    ],
    scenario: {}
  };
}

async function loadDiagram(page, diagram) {
  await page.evaluate((nextDiagram) => {
    window.__AFV_TEST__.loadDiagram(nextDiagram);
    window.__AFV_TEST__.fit();
  }, diagram);
  await settle(page);
}

async function center(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function pathPoint(page, connectorId, ratio = 0.5) {
  return page.evaluate(({ id, position }) => {
    const path = document.querySelector(`.connector-hit[data-connector-id="${CSS.escape(id)}"]`);
    if (!path || typeof path.getTotalLength !== "function") return null;
    const point = path.getPointAtLength(path.getTotalLength() * position);
    const matrix = path.getScreenCTM();
    return {
      x: point.x * matrix.a + point.y * matrix.c + matrix.e,
      y: point.x * matrix.b + point.y * matrix.d + matrix.f
    };
  }, { id: connectorId, position: ratio });
}

async function diagnostics(page) {
  return page.evaluate(() => {
    const api = window.__AFV_TEST__;
    if (!api || typeof api.getDiagnostics !== "function") return null;
    return api.getDiagnostics();
  });
}

function numberField(source, names) {
  for (const name of names) {
    const value = Number(source?.[name]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function listField(source, names) {
  for (const name of names) {
    const value = source?.[name];
    if (Array.isArray(value)) return value;
  }
  return undefined;
}

function requireNumber(source, name) {
  const value = numberField(source, [name]);
  expect(value, `${name} must be exposed in getDiagnostics()`).toBeDefined();
  return value;
}

function selectedDiagnosticIds(source) {
  const direct = listField(source, [
    "updatedConnectorIdsDuringDrag",
    "impactedConnectorIdsDuringDrag",
    "previewConnectorIdsDuringDrag",
    "draggedConnectorIds"
  ]);
  if (direct) return direct;
  const single = source?.selectedConnectorIdDuringDrag || source?.draggedConnectorId;
  return single ? [single] : undefined;
}

function finalReconciliationCount(source) {
  return numberField(source, [
    "finalConnectorPassesAfterDrop",
    "connectorReconciliationsAfterDrop",
    "dropReconciliationPasses",
    "fullConnectorPassesAfterDrop",
    "finalRenderAfterDrop"
  ]);
}

async function dragCardToActive(page, itemId, dx = 120, dy = 56) {
  const start = await center(page.locator(`.canvas-item[data-item-id='${itemId}']`));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 10 });
  await settle(page);
  return start;
}

async function dragHandleToActive(page, role = "target", dx = 96, dy = -64) {
  const start = await center(page.locator(`.connector-handle.${role}`));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
  await settle(page);
  return start;
}

async function dragConnectorBodyToActive(page, connectorId, dx = 90, dy = 45) {
  const start = await pathPoint(page, connectorId);
  expect(start).toBeTruthy();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
  await settle(page);
  return start;
}

function assertCheapDragPreview(diag, expectedImpacted) {
  const frameCount = requireNumber(diag, "dragFrameCount");
  const maxFrameMs = requireNumber(diag, "maxDragFrameMs");
  const averageFrameMs = requireNumber(diag, "averageDragFrameMs");
  const pathComputes = requireNumber(diag, "connectorPathComputesDuringDrag");
  const impactedCount = requireNumber(diag, "impactedConnectorCount");
  const fullPasses = requireNumber(diag, "fullConnectorPassesDuringDrag");
  const fullRenders = requireNumber(diag, "fullRenderDuringDrag");

  expect(frameCount).toBeGreaterThan(0);
  expect(maxFrameMs).toBeGreaterThanOrEqual(0);
  expect(maxFrameMs).toBeLessThan(120);
  expect(averageFrameMs).toBeGreaterThanOrEqual(0);
  expect(averageFrameMs).toBeLessThan(80);
  expect(impactedCount).toBe(expectedImpacted);
  expect(pathComputes).toBeGreaterThanOrEqual(impactedCount);
  expect(pathComputes).toBeLessThanOrEqual(impactedCount * (Math.max(frameCount, 1) + 2));
  expect(fullPasses).toBe(0);
  expect(fullRenders).toBe(0);
}

test.describe("drag smoothness diagnostics contract", () => {
  test("dragging one connected finance tile reports impacted connectors and avoids full connector passes during drag", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Drag timing budget is calibrated for Chromium.");
    const errors = await openApp(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await loadDiagram(page, manyConnectorDiagram());

    await dragCardToActive(page, "node-0");
    const diag = await diagnostics(page);

    assertCheapDragPreview(diag, 12);
    await page.mouse.up();
    await expect(page.locator("body")).not.toHaveClass(/dragging/);
    expect(errors).toEqual([]);
  });

  test("connector endpoint and body drag only update the selected connector diagnostics", async ({ page }) => {
    const errors = await openApp(page);
    await loadDiagram(page, singleConnectorDiagram());
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "selected-flow"));
    await settle(page);

    await dragHandleToActive(page, "target");
    const endpointDiag = await diagnostics(page);
    assertCheapDragPreview(endpointDiag, 1);
    expect(selectedDiagnosticIds(endpointDiag), "selected connector ids during endpoint drag").toEqual(["selected-flow"]);
    await page.mouse.up();
    await settle(page);

    await dragConnectorBodyToActive(page, "selected-flow");
    const bodyDiag = await diagnostics(page);
    assertCheapDragPreview(bodyDiag, 1);
    expect(selectedDiagnosticIds(bodyDiag), "selected connector ids during body drag").toEqual(["selected-flow"]);
    await page.mouse.up();

    expect(errors).toEqual([]);
  });

  test("drop performs a final reconciliation after the cheap preview phase", async ({ page }) => {
    const errors = await openApp(page);
    await loadDiagram(page, manyConnectorDiagram());

    await dragCardToActive(page, "node-0", 96, 44);
    const during = await diagnostics(page);
    assertCheapDragPreview(during, 12);
    expect(finalReconciliationCount(during) || 0).toBe(0);

    await page.mouse.up();
    await settle(page);
    const after = await diagnostics(page);
    expect(finalReconciliationCount(after), "drop reconciliation counter").toBeGreaterThanOrEqual(1);
    expect(requireNumber(after, "fullConnectorPassesDuringDrag")).toBe(0);
    expect(errors).toEqual([]);
  });

  test("body receives drag and performance classes during active drag and clears after drop or cancel", async ({ page }) => {
    const errors = await openApp(page);
    await loadDiagram(page, manyConnectorDiagram());

    await dragCardToActive(page, "node-0", 76, 36);
    await expect(page.locator("body")).toHaveClass(/dragging/);
    await expect(page.locator("body")).toHaveClass(/(?:drag-performance|performance-drag|is-performance-dragging)/);
    await page.mouse.up();
    await expect(page.locator("body")).not.toHaveClass(/dragging/);
    await expect(page.locator("body")).not.toHaveClass(/(?:drag-performance|performance-drag|is-performance-dragging)/);

    await dragCardToActive(page, "node-0", 70, 32);
    await expect(page.locator("body")).toHaveClass(/dragging/);
    await expect(page.locator("body")).toHaveClass(/(?:drag-performance|performance-drag|is-performance-dragging)/);
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/dragging/);
    await expect(page.locator("body")).not.toHaveClass(/(?:drag-performance|performance-drag|is-performance-dragging)/);
    await page.mouse.up();

    expect(errors).toEqual([]);
  });
});
