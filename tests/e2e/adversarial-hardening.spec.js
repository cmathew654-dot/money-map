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
    label: options.label || `Account ${id}`,
    subtitle: "Adversarial fixture",
    note: "Fake data only",
    x,
    y,
    w: options.w ?? 250,
    h: options.h ?? 132,
    zIndex: options.zIndex || 20,
    financeId: options.financeId || id,
    style: options.style || {}
  };
}

function shape(id, x, y, options = {}) {
  return {
    id,
    type: options.type || "shape",
    shape: options.shape || "rounded",
    label: options.label || `Shape ${id}`,
    subtitle: "Adversarial fixture",
    note: "Fake data only",
    x,
    y,
    w: options.w ?? 220,
    h: options.h ?? 120,
    zIndex: options.zIndex || 10,
    style: options.style || {}
  };
}

function connector(id, source, target, index = 0) {
  return {
    id,
    label: `Flow ${index + 1}`,
    flowType: "transfer",
    amount: 1000 + index * 250,
    max: 100000,
    source: { itemId: source },
    target: { itemId: target },
    routeStyle: index % 4 === 0 ? "smartArc" : index % 4 === 1 ? "sCurve" : index % 4 === 2 ? "elbow" : "straight",
    strokeStyle: index % 5 === 0 ? "dotted" : index % 5 === 1 ? "longDash" : "solid",
    arrowStart: "none",
    arrowEnd: "arrow",
    labelMode: index % 3 === 0 ? "hidden" : "auto",
    labelPoint: null,
    colorMode: "flow",
    widthMode: "medium",
    customWidth: 5,
    manualMid: false,
    mid: null
  };
}

async function loadDiagram(page, diagram) {
  await page.evaluate((nextDiagram) => window.__AFV_TEST__.loadDiagram(nextDiagram), diagram);
  await settle(page);
}

async function unsafeDomEvidence(page) {
  return page.evaluate(() => {
    const unsafeAttributes = [];
    const unsafeClassTokens = [];
    for (const node of document.querySelectorAll(".canvas-item, .canvas-group, .item-edge-handle")) {
      for (const attr of node.getAttributeNames()) {
        if (/^on/i.test(attr) || attr === "data-pwned") {
          unsafeAttributes.push(`${node.tagName.toLowerCase()}:${attr}=${node.getAttribute(attr)}`);
        }
      }
      for (const token of node.classList) {
        if (/["'<>/=]/.test(token) || /^on/i.test(token) || token === "data-pwned") unsafeClassTokens.push(token);
      }
    }
    return { unsafeAttributes, unsafeClassTokens };
  });
}

test.describe("adversarial hardening regressions", () => {
  test("malicious item and group IDs cannot execute onmouseover attribute breakout", async ({ page }) => {
    const errors = await openApp(page);
    const maliciousItemId = `bad-item" onmouseover="window.__AFV_ID_PWNED=1" data-pwned="`;
    const maliciousGroupId = `bad-group" onmouseover="window.__AFV_ID_PWNED=2" data-pwned="`;

    await page.evaluate(() => {
      window.__AFV_ID_PWNED = 0;
    });
    await loadDiagram(page, {
      groups: [
        { id: maliciousGroupId, label: "Unsafe group id", x: 810, y: 500, w: 420, h: 250, zIndex: 1 }
      ],
      items: [
        finance(maliciousItemId, 720, 500, { label: "Unsafe item id" }),
        finance("safe-target", 1080, 500, { label: "Safe target" })
      ],
      financeData: {
        [maliciousItemId]: { category: "brokerage", value: 100000, capacity: 200000, baseValue: 100000 },
        "safe-target": { category: "cash", value: 50000, capacity: 100000, baseValue: 50000 }
      },
      connectors: [],
      scenario: {}
    });

    await page.evaluate(() => {
      for (const node of document.querySelectorAll(".canvas-item, .canvas-group")) {
        node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      }
    });

    expect(await page.evaluate(() => window.__AFV_ID_PWNED)).toBe(0);
    expect(await unsafeDomEvidence(page)).toEqual({ unsafeAttributes: [], unsafeClassTokens: [] });
    expect(errors).toEqual([]);
  });

  test("malicious type, visual, shape, and state-like tokens do not create injected attributes or classes", async ({ page }) => {
    const errors = await openApp(page);
    const token = `x" onmouseover="window.__AFV_TOKEN_PWNED=1" data-pwned="`;

    await page.evaluate(() => {
      window.__AFV_TOKEN_PWNED = 0;
    });
    await loadDiagram(page, {
      items: [
        finance("bad-visual", 650, 470, { visual: token, label: "Unsafe visual" }),
        shape("bad-shape", 980, 470, { shape: token, label: "Unsafe shape" }),
        shape("bad-type", 810, 690, { type: token, label: "Unsafe type" }),
        finance("safe-overdraft-state", 1130, 690, { label: "Safe state token" })
      ],
      financeData: {
        "bad-visual": { category: "brokerage", value: 100000, capacity: 200000, baseValue: 100000 },
        "safe-overdraft-state": { category: "cash", value: -1, capacity: 100000, baseValue: -1 }
      },
      connectors: [],
      scenario: {}
    });
    await page.evaluate(() => window.__AFV_TEST__.fit());

    await page.locator(".canvas-item").first().hover();

    expect(await page.evaluate(() => window.__AFV_TOKEN_PWNED)).toBe(0);
    const evidence = await unsafeDomEvidence(page);
    expect(evidence.unsafeAttributes).toEqual([]);
    expect(evidence.unsafeClassTokens).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("non-finite coordinates and dimensions do not leave invalid pixel CSS and remain selectable enough to drag", async ({ page }) => {
    const errors = await openApp(page);

    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        items: [
          {
            id: "bad-geometry",
            type: "finance",
            visual: "card",
            label: "Bad geometry",
            subtitle: "Adversarial fixture",
            note: "Fake data only",
            x: NaN,
            y: "Infinity",
            w: Infinity,
            h: "-Infinity",
            zIndex: 20,
            financeId: "bad-geometry",
            style: {}
          },
          {
            id: "drag-target",
            type: "finance",
            visual: "card",
            label: "Drag target",
            subtitle: "Adversarial fixture",
            note: "Fake data only",
            x: 960,
            y: 540,
            w: 250,
            h: 132,
            zIndex: 30,
            financeId: "drag-target",
            style: {}
          }
        ],
        financeData: {
          "bad-geometry": { category: "brokerage", value: 100000, capacity: 200000, baseValue: 100000 },
          "drag-target": { category: "cash", value: 50000, capacity: 100000, baseValue: 50000 }
        },
        connectors: [],
        scenario: {}
      });
    });
    await settle(page);
    await page.evaluate(() => window.__AFV_TEST__.fit());
    await settle(page);

    const invalidStyles = await page.locator(".canvas-item, .canvas-group").evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute("style") || "")
        .filter((style) => /(?:NaN|Infinity|null|undefined)px/.test(style))
    );
    expect(invalidStyles).toEqual([]);

    const target = page.locator(".canvas-item[data-item-id='drag-target']");
    await target.click();
    await expect(target).toHaveClass(/is-selected/);
    const before = await page.evaluate(() => window.__AFV_TEST__.getState().items.find((item) => item.id === "drag-target"));
    const box = await target.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 48, box.y + box.height / 2 + 24, { steps: 4 });
    await page.mouse.up();

    const after = await page.evaluate(() => window.__AFV_TEST__.getState().items.find((item) => item.id === "drag-target"));
    expect(Number.isFinite(after.x)).toBe(true);
    expect(Number.isFinite(after.y)).toBe(true);
    expect(after.x).toBeGreaterThan(before.x + 20);
    expect(errors).toEqual([]);
  });

  test("financeData capacity values 0, NaN, and Infinity sanitize to finite capacity at least 1", async ({ page }) => {
    const errors = await openApp(page);

    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        items: [
          financeLike("zero-capacity", 620, 500),
          financeLike("nan-capacity", 900, 500),
          financeLike("infinite-capacity", 1180, 500)
        ],
        financeData: {
          "zero-capacity": { category: "cash", value: 1000, capacity: 0, baseValue: 1000 },
          "nan-capacity": { category: "cash", value: 1000, capacity: NaN, baseValue: 1000 },
          "infinite-capacity": { category: "cash", value: 1000, capacity: Infinity, baseValue: 1000 }
        },
        connectors: [],
        scenario: {}
      });

      function financeLike(id, x, y) {
        return {
          id,
          type: "finance",
          visual: "bucket",
          label: id,
          subtitle: "Capacity hardening",
          note: "Fake data only",
          x,
          y,
          w: 230,
          h: 140,
          zIndex: 20,
          financeId: id,
          style: {}
        };
      }
    });
    await settle(page);

    const capacities = await page.evaluate(() =>
      Object.fromEntries(Object.entries(window.__AFV_TEST__.getState().financeData).map(([id, data]) => [id, data.capacity]))
    );
    for (const capacity of Object.values(capacities)) {
      expect(Number.isFinite(capacity)).toBe(true);
      expect(capacity).toBeGreaterThanOrEqual(1);
    }

    const fills = await page.locator(".canvas-item").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).getPropertyValue("--fill")));
    expect(fills.every((fill) => !/NaN|Infinity/.test(fill))).toBe(true);
    expect(errors).toEqual([]);
  });

  test("synthetic 75-connector diagram renders every connector and fit completes within budget", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Performance budget is calibrated for chromium-1440.");
    const errors = await openApp(page);
    await page.setViewportSize({ width: 1440, height: 960 });

    const items = [];
    const financeData = {};
    for (let index = 0; index < 16; index += 1) {
      const id = `node-${index}`;
      const column = index % 4;
      const row = Math.floor(index / 4);
      items.push(finance(id, 520 + column * 390, 360 + row * 260, { label: `Node ${index + 1}` }));
      financeData[id] = { category: "brokerage", value: 100000 + index * 1000, capacity: 250000, baseValue: 100000 + index * 1000 };
    }

    const connectors = [];
    for (let index = 0; index < 75; index += 1) {
      connectors.push(connector(`flow-${index}`, `node-${index % items.length}`, `node-${(index * 5 + 3) % items.length}`, index));
    }

    await loadDiagram(page, { items, financeData, connectors, scenario: {} });
    const fitMs = await page.evaluate(async () => {
      const started = performance.now();
      window.__AFV_TEST__.fit();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return performance.now() - started;
    });

    expect(await page.locator(".connector-draw").count()).toBe(75);
    expect(await page.locator(".connector-hit").count()).toBe(75);
    expect(fitMs).toBeLessThan(2000);
    expect(errors).toEqual([]);
  });
});
