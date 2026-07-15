const { test, expect } = require("@playwright/test");

// Regression guard for the "dragging a node duplicates flows" corruption.
// Repositioning a finance tile -- including grabs that start inside the edge
// affordance zone and pull outward into an empty gap -- must never fabricate a
// connector, mutate node dollar values, or render a flow / label twice. The
// intended edge-draw feature (pulling from an edge ONTO another tile to create a
// connector) is exercised separately in wave35.spec.js and tool-mode-draw.spec.js.

const APP_URL = "http://localhost:54217/index.html?test=1";

async function openScenario(page, templateId = "cashReserve") {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.evaluate(() => window.__AFV_TEST__.fit());
  await page.waitForTimeout(200);
  return errors;
}

async function invariantSnapshot(page) {
  return page.evaluate(() => {
    const st = window.__AFV_TEST__.getState();
    const financeValues = {};
    Object.keys(st.financeData).forEach((id) => {
      financeValues[id] = st.financeData[id].value;
    });
    const drawByConnector = {};
    document.querySelectorAll(".connector-draw").forEach((node) => {
      const id = node.dataset.connectorId;
      drawByConnector[id] = (drawByConnector[id] || 0) + 1;
    });
    const labelByConnector = {};
    document.querySelectorAll(".connector-label").forEach((node) => {
      const id = node.dataset.connectorId;
      labelByConnector[id] = (labelByConnector[id] || 0) + 1;
    });
    return {
      connectorIds: st.connectors.map((conn) => conn.id).sort(),
      connectorCount: st.connectors.length,
      financeValues,
      drawByConnector,
      labelByConnector
    };
  });
}

function expectNoDuplicateRendering(snapshot, context) {
  // (c) Every flow renders exactly one path and at most one label -- no stacked duplicates.
  for (const [id, count] of Object.entries(snapshot.drawByConnector)) {
    expect(count, `${context}: flow ${id} drawn ${count}x`).toBe(1);
  }
  for (const [id, count] of Object.entries(snapshot.labelByConnector)) {
    expect(count, `${context}: label ${id} rendered ${count}x`).toBe(1);
  }
}

function expectInvariant(after, baseline, context) {
  // (a) flow / connector count and identity unchanged.
  expect(after.connectorCount, `${context}: connector count`).toBe(baseline.connectorCount);
  expect(after.connectorIds, `${context}: connector identity`).toEqual(baseline.connectorIds);
  // (b) every node dollar value unchanged by a pure drag.
  expect(after.financeValues, `${context}: node values`).toEqual(baseline.financeValues);
  // (c) no overlapping duplicate flow labels / paths.
  expectNoDuplicateRendering(after, context);
}

async function tileRect(page, itemId) {
  const rect = await page.evaluate((id) => {
    const el = document.querySelector(`[data-item-id="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }, itemId);
  expect(rect, `tile ${itemId} not found`).toBeTruthy();
  return rect;
}

async function dragFromTo(page, sx, sy, ex, ey) {
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(sx + ((ex - sx) * i) / steps, sy + ((ey - sy) * i) / steps);
    await page.waitForTimeout(10);
  }
  await page.mouse.up();
  await page.waitForTimeout(250);
}

test("edge-grabbed reposition into a gap never fabricates a duplicate flow", async ({ page }) => {
  const errors = await openScenario(page, "cashReserve");
  const baseline = await invariantSnapshot(page);
  expectNoDuplicateRendering(baseline, "baseline");

  // Each gesture grabs 15px inside an edge (inside the connector affordance zone)
  // and pulls 70px straight outward -- the reposition motion that previously
  // latched onto a neighbouring tile across the gap and duplicated its flow.
  const inset = 15;
  const out = 70;
  const edges = ["west", "north", "south", "east"];
  for (const edge of edges) {
    const r = await tileRect(page, "cashBucket");
    let sx = r.cx;
    let sy = r.cy;
    let ex = r.cx;
    let ey = r.cy;
    if (edge === "west") { sx = r.left + inset; ex = sx - out; ey = sy; }
    if (edge === "east") { sx = r.right - inset; ex = sx + out; ey = sy; }
    if (edge === "north") { sy = r.top + inset; ey = sy - out; ex = sx; }
    if (edge === "south") { sy = r.bottom - inset; ey = sy + out; ex = sx; }
    await dragFromTo(page, sx, sy, ex, ey);
    const after = await invariantSnapshot(page);
    expectInvariant(after, baseline, `cashBucket ${edge}-edge outward nudge`);
  }

  expect(errors).toEqual([]);
});

test("every finance tile survives a 150px reposition in each direction", async ({ page }) => {
  const errors = await openScenario(page, "cashReserve");
  const baseline = await invariantSnapshot(page);

  const tileIds = await page.evaluate(() =>
    window.__AFV_TEST__
      .getState()
      .items.filter((item) => item.type === "finance")
      .map((item) => item.id)
  );
  expect(tileIds.length).toBeGreaterThan(0);

  const directions = [
    { dx: 150, dy: 0 },
    { dx: -150, dy: 0 },
    { dx: 0, dy: 150 },
    { dx: 0, dy: -150 }
  ];

  for (const tileId of tileIds) {
    for (const dir of directions) {
      const r = await tileRect(page, tileId);
      await dragFromTo(page, r.cx, r.cy, r.cx + dir.dx, r.cy + dir.dy);
      const after = await invariantSnapshot(page);
      expectInvariant(after, baseline, `${tileId} reposition d(${dir.dx},${dir.dy})`);
    }
  }

  expect(errors).toEqual([]);
});
