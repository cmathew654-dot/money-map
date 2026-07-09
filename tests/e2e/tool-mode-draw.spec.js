const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:4173/index.html?test=1";

async function openApp(page, templateId = "retirement") {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`[pageerror] ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[console.error] ${message.text()}`);
  });

  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.locator("#fitButton").click();
  await settle(page);
  return errors;
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function state(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

async function expectTool(page, dock) {
  await expect.poll(() => state(page).then((s) => s.activeDock)).toBe(dock);
  await expect(page.locator(`[data-dock="${dock}"]`)).toHaveClass(/is-active/);
  if (dock === "select") {
    await expect(page.locator("#dockFlyout")).toHaveClass(/is-hidden/);
  } else {
    await expect(page.locator("#dockFlyout")).toBeVisible();
  }
}

function paletteSelector(kind, id) {
  if (kind === "connector") {
    return `[data-palette-kind="connector"][data-palette-id="${id}"], [data-create-connector="${id}"]`;
  }
  return `[data-palette-kind="${kind}"][data-palette-id="${id}"]`;
}

async function armPreset(page, dock, kind, id) {
  await page.locator(`[data-dock="${dock}"]`).click();
  await expectTool(page, dock);

  const button = page.locator(paletteSelector(kind, id)).first();
  await expect(button).toBeVisible();
  await button.click();
  await settle(page);

  await expect.poll(() => state(page).then((s) => s.activeCreationPreset)).toMatchObject({ kind, id });
  await expect(button).toHaveClass(/is-active|is-selected/);
}

async function loadEmptyDiagram(page) {
  await page.evaluate(() => {
    window.__AFV_TEST__.loadDiagram({
      items: [],
      groups: [],
      financeData: {},
      connectors: [],
      scenario: {}
    });
  });
  await settle(page);
}

async function loadConnectorFixture(page) {
  await page.evaluate(() => {
    window.__AFV_TEST__.loadDiagram({
      name: "Connector draw fixture",
      items: [
        {
          id: "sourceAccount",
          type: "finance",
          visual: "card",
          category: "brokerage",
          financeId: "sourceAccount",
          label: "Source Account",
          subtitle: "Brokerage",
          note: "",
          x: 1800,
          y: 1300,
          w: 260,
          h: 132,
          zIndex: 20,
          style: {}
        },
        {
          id: "targetBucket",
          type: "finance",
          visual: "bucket",
          category: "cash",
          financeId: "targetBucket",
          label: "Target Bucket",
          subtitle: "Cash reserve",
          note: "",
          x: 2350,
          y: 1300,
          w: 260,
          h: 138,
          zIndex: 20,
          style: {}
        }
      ],
      groups: [],
      financeData: {
        sourceAccount: { category: "brokerage", value: 400000, capacity: 600000, baseValue: 400000 },
        targetBucket: { category: "cash", value: 100000, capacity: 250000, baseValue: 100000 }
      },
      connectors: [],
      scenario: {}
    });
  });
  await page.locator("#fitButton").click();
  await settle(page);
}

async function stagePoint(page, xRatio, yRatio) {
  const box = await page.locator("#canvasStage").boundingBox();
  expect(box).toBeTruthy();
  return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
}

async function worldPoint(page, screenPoint) {
  return page.evaluate(({ x, y }) => {
    const rect = document.querySelector("#canvasStage").getBoundingClientRect();
    const { viewport } = window.__AFV_TEST__.getState();
    return {
      x: (x - rect.left - viewport.x) / viewport.zoom,
      y: (y - rect.top - viewport.y) / viewport.zoom
    };
  }, screenPoint);
}

async function clickCanvas(page, xRatio, yRatio) {
  const point = await stagePoint(page, xRatio, yRatio);
  const world = await worldPoint(page, point);
  await page.mouse.click(point.x, point.y);
  await settle(page);
  return { screen: point, world };
}

async function dragCanvas(page, startRatio, endRatio) {
  const start = await stagePoint(page, startRatio[0], startRatio[1]);
  const end = await stagePoint(page, endRatio[0], endRatio[1]);
  const startWorld = await worldPoint(page, start);
  const endWorld = await worldPoint(page, end);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  return { start, end, startWorld, endWorld };
}

async function center(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function newItems(before, after) {
  const beforeIds = new Set(before.items.map((item) => item.id));
  return after.items.filter((item) => !beforeIds.has(item.id));
}

function expectNear(actual, expected, tolerance = 30) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function expectNearPointerOrGovernorNudge(item, placement, stateSnapshot, tolerance = 42) {
  const dx = Math.abs(item.x - placement.world.x);
  const dy = Math.abs(item.y - placement.world.y);
  if (dx <= tolerance && dy <= tolerance) return;

  expect(stateSnapshot.diagnostics.layoutFeedback?.status, "off-pointer placement should be a governor nudge, not arbitrary drift")
    .toBe("nudged");
  expect(dx, "governor nudge should stay near the requested pointer").toBeLessThanOrEqual(92);
  expect(dy, "governor nudge should stay near the requested pointer").toBeLessThanOrEqual(92);
  const blockingTypes = new Set(["hard-overlap", "reserved-zone", "duplicate-stack"]);
  const blockingIssues = (stateSnapshot.diagnostics.layoutIssues || []).filter((issue) => blockingTypes.has(issue.type));
  expect(blockingIssues).toEqual([]);
}

function expectedDragCenter(placement, item) {
  const left = Math.min(placement.startWorld.x, placement.endWorld.x);
  const right = Math.max(placement.startWorld.x, placement.endWorld.x);
  const top = Math.min(placement.startWorld.y, placement.endWorld.y);
  const bottom = Math.max(placement.startWorld.y, placement.endWorld.y);
  return {
    x: placement.startWorld.x <= placement.endWorld.x ? left + item.w / 2 : right - item.w / 2,
    y: placement.startWorld.y <= placement.endWorld.y ? top + item.h / 2 : bottom - item.h / 2
  };
}

function expectEdgePinnedEndpoint(endpoint, item) {
  expect(endpoint.itemId).toBe(item.id);
  expect(endpoint.x).toBeUndefined();
  expect(endpoint.y).toBeUndefined();
  expect(Number.isFinite(endpoint.offsetX)).toBe(true);
  expect(Number.isFinite(endpoint.offsetY)).toBe(true);
  expect(Math.abs(endpoint.offsetX)).toBeLessThanOrEqual(item.w / 2 + 0.5);
  expect(Math.abs(endpoint.offsetY)).toBeLessThanOrEqual(item.h / 2 + 0.5);
  const onVerticalEdge = Math.abs(Math.abs(endpoint.offsetX) - item.w / 2) <= 0.5;
  const onHorizontalEdge = Math.abs(Math.abs(endpoint.offsetY) - item.h / 2) <= 0.5;
  expect(onVerticalEdge || onHorizontalEdge).toBe(true);
}

test.describe("full draw tool modes", () => {
  test("dock exposes first-class tools and shortcuts switch modes", async ({ page }) => {
    const errors = await openApp(page);

    await expect(page.locator('[data-dock="select"]')).toBeVisible();
    await expect(page.locator('[data-dock="select"]')).not.toHaveClass(/is-hidden/);
    await expect(page.locator('[data-dock="shapes"]')).toBeVisible();
    await expect(page.locator('[data-dock="text"]')).toBeVisible();
    await expect(page.locator('[data-dock="finance"]')).toBeVisible();
    await expect(page.locator('[data-dock="connectors"]')).toBeVisible();
    await expect(page.locator('[data-dock="add"]:visible')).toHaveCount(0);

    for (const [dock, shortcut] of [
      ["shapes", "KeyS"],
      ["text", "KeyT"],
      ["finance", "KeyF"],
      ["connectors", "KeyC"],
      ["select", "KeyV"]
    ]) {
      await page.keyboard.press(shortcut);
      await expectTool(page, dock);
    }

    expect(errors).toEqual([]);
  });

  test("shape palette starts with semantic finance markers and creates intent-tagged shapes", async ({ page }) => {
    const errors = await openApp(page);
    await loadEmptyDiagram(page);
    await page.locator('[data-dock="shapes"]').click();
    await expectTool(page, "shapes");

    const semanticMarkers = [
      ["risk-triangle", "Risk wedge"],
      ["protection-shield", "Protection shield"],
      ["guarantee-seal", "Guarantee seal"],
      ["milestone-flag", "Milestone flag"],
      ["ledger-strip", "Ledger strip"],
      ["reserve-gauge", "Reserve gauge"],
      ["trust-gate", "Trust gate"],
      ["split-fork", "Split fork"]
    ];

    for (const [id, label] of semanticMarkers) {
      const button = page.locator(`[data-palette-kind="shape"][data-palette-id="${id}"]`);
      await expect(button, `${id} should be offered as a first-class finance marker`).toBeVisible();
      await expect(button.locator("strong")).toHaveText(label);
    }

    await armPreset(page, "shapes", "shape", "risk-triangle");
    const before = await state(page);
    await clickCanvas(page, 0.45, 0.42);
    const after = await state(page);
    const [created] = newItems(before, after);

    expect(created).toMatchObject({
      type: "shape",
      shape: "triangle",
      shapeIntent: "riskGap"
    });
    await expect(page.locator(`.canvas-item[data-item-id="${created.id}"]`)).toHaveAttribute("data-shape-intent", "riskGap");
    await expect(page.locator(`.canvas-item[data-item-id="${created.id}"]`)).toHaveClass(/shape-triangle/);
    expect(errors).toEqual([]);
  });

  test("palette clicks arm presets without immediate creation", async ({ page }) => {
    const errors = await openApp(page);
    await loadEmptyDiagram(page);
    const before = await state(page);

    for (const preset of [
      { dock: "shapes", kind: "shape", id: "rounded" },
      { dock: "text", kind: "text", id: "caption" },
      { dock: "finance", kind: "finance", id: "liquid-bucket" },
      { dock: "connectors", kind: "connector", id: "smartArc" }
    ]) {
      await armPreset(page, preset.dock, preset.kind, preset.id);
      const current = await state(page);
      expect(current.items).toHaveLength(before.items.length);
      expect(current.connectors).toHaveLength(before.connectors.length);
      expect(current.activeDock).toBe(preset.dock);
      expect(current.activeCreationPreset).toMatchObject({ kind: preset.kind, id: preset.id });
    }

    expect(errors).toEqual([]);
  });

  test("click-place creates shape, text, and finance objects at the pointer", async ({ page }) => {
    const errors = await openApp(page);
    await loadEmptyDiagram(page);

    await armPreset(page, "shapes", "shape", "rounded");
    let before = await state(page);
    const shapePlacement = await clickCanvas(page, 0.34, 0.34);
    let after = await state(page);
    let [shape] = newItems(before, after);
    expect(shape.type).toBe("shape");
    expect(shape.shape).toBe("rounded");
    expectNear(shape.x, shapePlacement.world.x, 42);
    expectNear(shape.y, shapePlacement.world.y, 42);
    expect(after.activeDock).toBe("shapes");

    await armPreset(page, "text", "text", "caption");
    before = await state(page);
    const textPlacement = await clickCanvas(page, 0.52, 0.38);
    after = await state(page);
    let [text] = newItems(before, after);
    expect(text.type).toBe("text");
    expect(text.style.textStyle).toBe("caption");
    expectNear(text.x, textPlacement.world.x, 42);
    expectNear(text.y, textPlacement.world.y, 42);
    await expect(page.locator(`.canvas-item[data-item-id="${text.id}"] [contenteditable="true"], .canvas-item[data-item-id="${text.id}"][contenteditable="true"]`).first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expectTool(page, "text");

    await armPreset(page, "finance", "finance", "liquid-bucket");
    before = await state(page);
    const financePlacement = await clickCanvas(page, 0.68, 0.44);
    after = await state(page);
    let [finance] = newItems(before, after);
    expect(finance.type).toBe("finance");
    expect(finance.visual).toBe("bucket");
    expectNearPointerOrGovernorNudge(finance, financePlacement, after);
    expect(after.financeData[finance.financeId]).toMatchObject({ category: "cash", value: 100000 });
    expect(after.activeDock).toBe("finance");

    expect(errors).toEqual([]);
  });

  test("empty canvas click after shape placement collapses shapes back to select", async ({ page }) => {
    const errors = await openApp(page);
    await loadEmptyDiagram(page);

    await armPreset(page, "shapes", "shape", "parallelogram");
    const before = await state(page);
    await clickCanvas(page, 0.38, 0.28);
    const placed = await state(page);
    const [shape] = newItems(before, placed);
    expect(shape.type).toBe("shape");
    expect(shape.shape).toBe("parallelogram");
    expect(placed.activeDock).toBe("shapes");
    expect(placed.selection).toMatchObject({ kind: "item", id: shape.id });

    await clickCanvas(page, 0.74, 0.7);
    await expectTool(page, "select");
    const after = await state(page);
    expect(after.selection).toBeNull();

    expect(errors).toEqual([]);
  });

  test("drag-size placement works for shape, text, and finance presets", async ({ page }) => {
    const errors = await openApp(page);
    await loadEmptyDiagram(page);

    for (const spec of [
      { dock: "shapes", kind: "shape", id: "rectangle", type: "shape", minW: 260, minH: 120 },
      { dock: "text", kind: "text", id: "caption", type: "text", minW: 240, minH: 80 },
      { dock: "finance", kind: "finance", id: "account-card", type: "finance", minW: 280, minH: 140 }
    ]) {
      await loadEmptyDiagram(page);
      await armPreset(page, spec.dock, spec.kind, spec.id);
      const before = await state(page);
      const placement = await dragCanvas(page, [0.30, 0.58], [0.58, 0.78]);
      const after = await state(page);
      const [item] = newItems(before, after);
      expect(item.type).toBe(spec.type);
      expect(item.w).toBeGreaterThanOrEqual(spec.minW - 2);
      expect(item.h).toBeGreaterThanOrEqual(spec.minH - 2);
      const expected = expectedDragCenter(placement, item);
      expectNear(item.x, expected.x, 40);
      expectNear(item.y, expected.y, 40);
      expect(after.activeDock).toBe(spec.dock);
      if (spec.kind === "text") await page.keyboard.press("Enter");
    }

    expect(errors).toEqual([]);
  });

  test("finance mode supports repeated placement without reopening the tool", async ({ page }) => {
    const errors = await openApp(page);
    await loadEmptyDiagram(page);
    await armPreset(page, "finance", "finance", "account-card");

    const before = await state(page);
    await clickCanvas(page, 0.38, 0.36);
    await expectTool(page, "finance");
    await clickCanvas(page, 0.62, 0.36);
    await expectTool(page, "finance");

    const after = await state(page);
    const created = newItems(before, after);
    expect(created).toHaveLength(2);
    expect(created.every((item) => item.type === "finance")).toBe(true);
    expect(after.activeCreationPreset).toMatchObject({ kind: "finance", id: "account-card" });

    expect(errors).toEqual([]);
  });

  test("connector mode drag creates a snapped connector with edge-pinned endpoints", async ({ page }) => {
    const errors = await openApp(page);
    await loadConnectorFixture(page);
    await armPreset(page, "connectors", "connector", "smartArc");

    const before = await state(page);
    const source = page.locator('.canvas-item[data-item-id="sourceAccount"]');
    const target = page.locator('.canvas-item[data-item-id="targetBucket"]');
    const sourceBox = await source.boundingBox();
    expect(sourceBox).toBeTruthy();
    const start = { x: sourceBox.x + sourceBox.width * 0.92, y: sourceBox.y + sourceBox.height / 2 };
    const end = await center(target);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await expect(page.locator(".connector-ghost")).toHaveClass(/is-valid/);
    await expect(target).toHaveClass(/is-snap-target/);
    await page.mouse.up();
    await settle(page);

    const after = await state(page);
    expect(after.connectors).toHaveLength(before.connectors.length + 1);
    const created = after.connectors.find((conn) => conn.id === after.selection.id);
    expect(created).toBeTruthy();
    expect(created.routeStyle).toBe("smartArc");
    expect(created.amount).toBe(0);
    expectEdgePinnedEndpoint(created.source, after.items.find((item) => item.id === "sourceAccount"));
    expectEdgePinnedEndpoint(created.target, after.items.find((item) => item.id === "targetBucket"));
    expect(after.activeDock).toBe("connectors");
    expect(after.activeCreationPreset).toMatchObject({ kind: "connector", id: "smartArc" });

    expect(errors).toEqual([]);
  });

  test("invalid connector drops and Escape cancel without mutating state", async ({ page }) => {
    const errors = await openApp(page);
    await loadConnectorFixture(page);
    await armPreset(page, "connectors", "connector", "smartArc");

    const source = page.locator('.canvas-item[data-item-id="sourceAccount"]');
    const sourceBox = await source.boundingBox();
    expect(sourceBox).toBeTruthy();
    const start = { x: sourceBox.x + sourceBox.width * 0.92, y: sourceBox.y + sourceBox.height / 2 };
    const invalid = await stagePoint(page, 0.18, 0.18);
    const before = await state(page);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(invalid.x, invalid.y, { steps: 8 });
    await expect(page.locator(".connector-ghost")).toHaveClass(/is-invalid/);
    await page.mouse.up();
    await settle(page);

    let after = await state(page);
    expect(after.connectors).toHaveLength(before.connectors.length);
    await expect(page.locator(".connector-ghost")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/creating-connector|connector-preview-invalid/);
    expect(after.activeDock).toBe("connectors");

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(invalid.x + 30, invalid.y + 20, { steps: 6 });
    await expect(page.locator(".connector-ghost")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await settle(page);

    after = await state(page);
    expect(after.connectors).toHaveLength(before.connectors.length);
    await expect(page.locator(".connector-ghost")).toHaveCount(0);
    await expect(page.locator(".canvas-item.is-snap-target")).toHaveCount(0);
    expect(after.diagnostics.interactionType).toBeNull();
    expect(after.activeDock).toBe("connectors");

    expect(errors).toEqual([]);
  });

  test("tool shortcuts are ignored while form fields or inline text editors are focused", async ({ page }) => {
    const errors = await openApp(page);

    await page.keyboard.press("KeyF");
    await expectTool(page, "finance");
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "cashReserve");
      window.__AFV_TEST__.openPopover("selection-data");
    });
    await expect.poll(() => state(page).then((s) => s.activeDock)).toBe("finance");

    const input = page.locator('.selection-inspector input[data-input="finance-value"]');
    await expect(input).toBeVisible();
    await input.focus();
    await page.keyboard.press("KeyT");
    expect((await state(page)).activeDock).toBe("finance");
    await input.blur();

    await page.keyboard.press("KeyT");
    await expectTool(page, "text");
    await loadEmptyDiagram(page);
    await armPreset(page, "text", "text", "caption");
    await clickCanvas(page, 0.50, 0.50);
    const editingDock = (await state(page)).activeDock;
    await expect(page.locator("[contenteditable='true']").first()).toBeVisible();
    await page.keyboard.press("KeyC");
    expect((await state(page)).activeDock).toBe(editingDock);
    await page.keyboard.press("Enter");
    await page.keyboard.press("KeyC");
    await expectTool(page, "connectors");

    expect(errors).toEqual([]);
  });
});
