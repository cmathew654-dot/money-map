const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";
const TEMPLATE_IDS = [
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

async function openApp(page, templateId = "retirement") {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.locator("#fitButton").click();
  return errors;
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function center(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function rect(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return box;
}

function overlaps(a, b, pad = 0) {
  return !(
    a.x + a.width <= b.x - pad ||
    b.x + b.width <= a.x - pad ||
    a.y + a.height <= b.y - pad ||
    b.y + b.height <= a.y - pad
  );
}

async function pathPoint(page, connectorId, ratio = 0.5) {
  return page.evaluate(({ connectorId: id, ratio: position }) => {
    const path = document.querySelector(`.connector-hit[data-connector-id="${id}"]`);
    if (!path) return null;
    const point = path.getPointAtLength(path.getTotalLength() * position);
    const matrix = path.getScreenCTM();
    return {
      x: point.x * matrix.a + point.y * matrix.c + matrix.e,
      y: point.x * matrix.b + point.y * matrix.d + matrix.f
    };
  }, { connectorId, ratio });
}

async function connectorD(page, connectorId) {
  return page.locator(`.connector-draw[data-connector-id="${connectorId}"]`).getAttribute("d");
}

test.describe("flow stabilization", () => {
  test("connector body drag selects only and does not mutate route geometry", async ({ page }) => {
    const errors = await openApp(page);
    const beforeD = await connectorD(page, "rollover");
    const point = await pathPoint(page, "rollover");
    expect(point).toBeTruthy();

    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 90, point.y + 45, { steps: 6 });
    await page.mouse.up();

    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.selection).toEqual({ kind: "connector", id: "rollover" });
    await expect(page.locator("body")).not.toHaveClass(/dragging/);
    expect(await connectorD(page, "rollover")).toBe(beforeD);
    expect(errors).toEqual([]);
  });

  test("endpoint handles snap to explicit edge-pinned offsets", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "rollover"));
    const handle = page.locator(".connector-handle.target");
    const target = page.locator(".canvas-item[data-item-id='cashReserve']");
    const start = await center(handle);
    const end = await center(target);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();

    const connector = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "rollover"));
    const cashReserve = await page.evaluate(() => window.__AFV_TEST__.getState().items.find((item) => item.id === "cashReserve"));
    expect(connector.target.itemId).toBe("cashReserve");
    expect(Math.abs(connector.target.offsetX)).toBeCloseTo(cashReserve.w / 2, 0);
    expect(Math.abs(connector.target.offsetY)).toBeLessThanOrEqual(cashReserve.h / 2);
    expect(errors).toEqual([]);
  });

  test("target endpoint drags vertically along the paycheck tile edge", async ({ page }) => {
    const errors = await openApp(page, "retirementPaycheck");
    await page.evaluate(() => {
      const state = window.__AFV_TEST__.getState();
      const connector = state.connectors.find((conn) => conn.id === "portfolioDraw");
      if (connector) connector.target = { itemId: "paycheck", port: "left.income", offsetY: 12 };
      window.__AFV_TEST__.loadDiagram(state);
      window.__AFV_TEST__.fit();
    });
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "portfolioDraw"));
    const handle = page.locator(".connector-handle.target");
    const start = await center(handle);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y - 82, { steps: 8 });
    await page.mouse.up();

    const { connector, paycheck } = await page.evaluate(() => {
      const state = window.__AFV_TEST__.getState();
      return {
        connector: state.connectors.find((conn) => conn.id === "portfolioDraw"),
        paycheck: state.items.find((item) => item.id === "paycheck")
      };
    });
    expect(connector.target.itemId).toBe("paycheck");
    expect(connector.target.offsetX).toBeCloseTo(-paycheck.w / 2, 0);
    expect(connector.target.offsetY).toBeLessThan(0);
    const renderedTarget = await pathPoint(page, "portfolioDraw", 1);
    const expectedTarget = await page.evaluate(() => {
      const state = window.__AFV_TEST__.getState();
      const conn = state.connectors.find((entry) => entry.id === "portfolioDraw");
      const node = state.items.find((item) => item.id === conn.target.itemId);
      const path = document.querySelector(".connector-draw[data-connector-id='portfolioDraw']");
      const matrix = path.getScreenCTM();
      const point = { x: node.x + conn.target.offsetX, y: node.y + conn.target.offsetY };
      return {
        x: point.x * matrix.a + point.y * matrix.c + matrix.e,
        y: point.x * matrix.b + point.y * matrix.d + matrix.f
      };
    });
    expect(renderedTarget.x).toBeCloseTo(expectedTarget.x, 0);
    expect(renderedTarget.y).toBeCloseTo(expectedTarget.y, 0);
    expect(errors).toEqual([]);
  });

  test("source endpoint drags along the portfolio edge without detaching", async ({ page }) => {
    const errors = await openApp(page, "retirementPaycheck");
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "portfolioDraw"));
    const handle = page.locator(".connector-handle.source");
    const start = await center(handle);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + 72, { steps: 8 });
    await page.mouse.up();

    const { connector, portfolio } = await page.evaluate(() => {
      const state = window.__AFV_TEST__.getState();
      return {
        connector: state.connectors.find((conn) => conn.id === "portfolioDraw"),
        portfolio: state.items.find((item) => item.id === "portfolio")
      };
    });
    expect(connector.source.itemId).toBe("portfolio");
    expect(connector.source.offsetX).toBeCloseTo(portfolio.w / 2, 0);
    expect(connector.source.offsetY).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("source endpoint drags horizontally along a top tile edge", async ({ page }) => {
    const errors = await openApp(page, "retirementPaycheck");
    await page.evaluate(() => {
      const state = window.__AFV_TEST__.getState();
      const connector = state.connectors.find((conn) => conn.id === "portfolioDraw");
      const portfolio = state.items.find((item) => item.id === "portfolio");
      connector.source = { itemId: "portfolio", offsetX: 0, offsetY: -portfolio.h / 2 };
      window.__AFV_TEST__.loadDiagram({ ...state, connectors: state.connectors });
      window.__AFV_TEST__.select("connector", "portfolioDraw");
    });
    await settle(page);
    const handle = page.locator(".connector-handle.source");
    const start = await center(handle);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 96, start.y, { steps: 8 });
    await page.mouse.up();

    const { connector, portfolio } = await page.evaluate(() => {
      const state = window.__AFV_TEST__.getState();
      return {
        connector: state.connectors.find((conn) => conn.id === "portfolioDraw"),
        portfolio: state.items.find((item) => item.id === "portfolio")
      };
    });
    expect(connector.source.itemId).toBe("portfolio");
    expect(connector.source.offsetY).toBeCloseTo(-portfolio.h / 2, 0);
    expect(connector.source.offsetX).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("selected paycheck flow label avoids inspector and core tile bodies", async ({ page }) => {
    const errors = await openApp(page, "retirementPaycheck");
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "portfolioDraw"));
    const label = await rect(page.locator(".connector-label[data-connector-id='portfolioDraw']"));
    const inspector = await rect(page.locator(".selection-inspector"));
    const portfolio = await rect(page.locator(".canvas-item[data-item-id='portfolio'] .item-surface"));
    const paycheck = await rect(page.locator(".canvas-item[data-item-id='paycheck'] .item-surface"));

    expect(overlaps(label, inspector, 4)).toBe(false);
    expect(overlaps(label, portfolio, 6)).toBe(false);
    expect(overlaps(label, paycheck, 6)).toBe(false);
    expect(errors).toEqual([]);
  });

  test("escape during handle drag restores geometry and clears dragging state", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "rollover"));
    const before = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "rollover"));
    const handle = page.locator(".connector-handle.bend");
    const point = await center(handle);

    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 120, point.y + 70, { steps: 6 });
    await expect(page.locator("body")).toHaveClass(/dragging/);
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/dragging/);
    await page.mouse.up();

    const after = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "rollover"));
    expect(after.mid || null).toEqual(before.mid || null);
    expect(errors).toEqual([]);
  });

  test("escape during endpoint drag restores the original endpoint pin", async ({ page }) => {
    const errors = await openApp(page, "retirementPaycheck");
    await page.evaluate(() => window.__AFV_TEST__.select("connector", "portfolioDraw"));
    const before = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "portfolioDraw").target);
    const handle = page.locator(".connector-handle.target");
    const point = await center(handle);

    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y - 88, { steps: 6 });
    await expect(page.locator("body")).toHaveClass(/dragging/);
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/dragging/);
    await page.mouse.up();

    const after = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "portfolioDraw").target);
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
  });

  test("pointer cancellation paths restore geometry and clear dragging state", async ({ page }) => {
    for (const cancelMode of ["pointercancel", "lostpointercapture", "blur"]) {
      const errors = await openApp(page);
      await page.evaluate(() => window.__AFV_TEST__.select("connector", "rollover"));
      const before = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "rollover"));
      const handle = page.locator(".connector-handle.bend");
      const point = await center(handle);

      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.mouse.move(point.x + 90, point.y + 50, { steps: 4 });
      await expect(page.locator("body")).toHaveClass(/dragging/);

      if (cancelMode === "pointercancel") {
        await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1 })));
      } else if (cancelMode === "lostpointercapture") {
        await handle.evaluate((node) => node.dispatchEvent(new PointerEvent("lostpointercapture", { bubbles: true, pointerId: 1 })));
      } else {
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      }

      await expect(page.locator("body")).not.toHaveClass(/dragging/);
      await page.mouse.up();
      const after = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "rollover"));
      expect(after.mid || null).toEqual(before.mid || null);
      expect(errors).toEqual([]);
    }
  });

  test("connector label clicks do not leave browser text selected", async ({ page }) => {
    const errors = await openApp(page);
    const label = page.locator(".connector-label[data-connector-id='transfer']");
    const box = await label.boundingBox();
    expect(box).toBeTruthy();

    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();

    const selectedText = await page.evaluate(() => String(window.getSelection()?.toString() || ""));
    expect(selectedText).toBe("");
    expect(errors).toEqual([]);
  });

  test("paycheck data inspector edits the visible monthly need", async ({ page }) => {
    const errors = await openApp(page, "cashReserve");
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "clientIncome");
      window.__AFV_TEST__.openPopover("selection-data");
    });

    const input = page.locator(".selection-inspector input[data-input='scenario-monthly-need']");
    await expect(input).toHaveValue("$7,000");
    await input.focus();
    await input.fill("70000");
    await input.blur();

    await expect(input).toHaveValue("$70,000");
    await expect(page.locator(".canvas-item[data-item-id='clientIncome'] .paycheck-amount")).toContainText("$70,000");
    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.scenario.monthlyNeed).toBe(70000);
    expect(state.financeData.clientIncome.value).toBe(0);
    expect(errors).toEqual([]);
  });

  test("manual connector routes are repaired instead of running behind unrelated tiles", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Connector obstacle fixture",
        items: [
          {
            id: "source",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "source",
            label: "Source Account",
            subtitle: "Brokerage",
            note: "",
            x: 1100,
            y: 1150,
            w: 250,
            h: 132,
            zIndex: 20,
            style: {}
          },
          {
            id: "blocker",
            type: "finance",
            visual: "bucket",
            category: "cash",
            financeId: "blocker",
            label: "Liquidity Reserve",
            subtitle: "Must not be crossed",
            note: "",
            x: 1500,
            y: 1150,
            w: 320,
            h: 190,
            zIndex: 20,
            style: {}
          },
          {
            id: "target",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "target",
            label: "Target Account",
            subtitle: "Brokerage",
            note: "",
            x: 1900,
            y: 1150,
            w: 250,
            h: 132,
            zIndex: 20,
            style: {}
          }
        ],
        groups: [],
        financeData: {
          source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
          blocker: { category: "cash", value: 150000, capacity: 300000, baseValue: 150000 },
          target: { category: "brokerage", value: 200000, capacity: 600000, baseValue: 200000 }
        },
        connectors: [
          {
            id: "badRoute",
            label: "Transfer",
            flowType: "transfer",
            amount: 50000,
            source: { itemId: "source", offsetX: 125, offsetY: 0 },
            target: { itemId: "target", offsetX: -125, offsetY: 0 },
            routeStyle: "smartArc",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            mid: { x: 1500, y: 1150 },
            manualMid: true,
            labelMode: "hidden",
            max: 100000
          }
        ],
        scenario: {}
      });
    });
    await page.locator("#fitButton").click();
    await settle(page);

    const crossings = await page.evaluate(() => {
      const state = window.__AFV_TEST__.getState();
      const conn = state.connectors.find((entry) => entry.id === "badRoute");
      const path = document.querySelector(".connector-hit[data-connector-id='badRoute']");
      const blocker = state.items.find((item) => item.id === "blocker");
      const rect = {
        left: blocker.x - blocker.w / 2 + 8,
        right: blocker.x + blocker.w / 2 - 8,
        top: blocker.y - blocker.h / 2 + 8,
        bottom: blocker.y + blocker.h / 2 - 8
      };
      const length = path.getTotalLength();
      const points = [];
      for (let index = 1; index < 120; index += 1) {
        const point = path.getPointAtLength((length * index) / 120);
        if (point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom) {
          points.push({ connector: conn.id, x: Math.round(point.x), y: Math.round(point.y) });
        }
      }
      return points;
    });

    expect(crossings).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("estate trust transfer uses a perimeter port instead of running under the trust body", async ({ page }) => {
    const errors = await openApp(page, "estate");
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "revocableTrust");
      window.__AFV_TEST__.openPopover("selection-data");
    });
    await settle(page);

    const crossings = await page.evaluate(() => {
      const path = document.querySelector(".connector-hit[data-connector-id='assetTransfer']");
      const trust = document.querySelector(".canvas-item[data-item-id='revocableTrust']");
      if (!path || !trust) return ["missing path or trust"];
      const rect = trust.getBoundingClientRect();
      const matrix = path.getScreenCTM();
      const length = path.getTotalLength();
      const findings = [];
      for (let index = 2; index <= 118; index += 1) {
        const t = index / 120;
        const point = path.getPointAtLength(length * t);
        const client = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        const insideCore = client.x > rect.left + 10 &&
          client.x < rect.right - 10 &&
          client.y > rect.top + 10 &&
          client.y < rect.bottom - 10;
        const legalTargetPortBand = t >= 0.965 && client.x <= rect.left + 28;
        if (insideCore && !legalTargetPortBand) {
          findings.push(`assetTransfer inside trust at ${t.toFixed(2)}`);
        }
      }
      return findings;
    });

    expect(crossings).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("survivor income reset routes exit tile edges without running under endpoint cards", async ({ page }) => {
    const errors = await openApp(page, "survivorIncome");
    const findings = await page.evaluate(() => {
      const state = window.__AFV_TEST__.getState();
      const itemRects = [...document.querySelectorAll(".canvas-item")].map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          id: node.dataset.itemId,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        };
      });
      const issues = [];
      state.connectors
        .filter((conn) => conn.visible !== false)
        .forEach((conn) => {
          const path = document.querySelector(`.connector-hit[data-connector-id="${CSS.escape(conn.id)}"]`);
          if (!path || typeof path.getTotalLength !== "function") return;
          const length = path.getTotalLength();
          for (let index = 1; index < 120; index += 1) {
            const t = index / 120;
            const point = path.getPointAtLength(length * t);
            const client = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
            for (const item of itemRects) {
              if (item.id !== conn.source?.itemId && item.id !== conn.target?.itemId) continue;
              if (item.id === conn.source?.itemId && t <= 0.04) continue;
              if (item.id === conn.target?.itemId && t >= 0.96) continue;
              const inset = 8;
              if (client.x > item.left + inset && client.x < item.right - inset && client.y > item.top + inset && client.y < item.bottom - inset) {
                issues.push(`${conn.id} travels under ${item.id} at ${t.toFixed(2)}`);
                break;
              }
            }
          }
        });
      return issues;
    });

    expect(findings).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("survivor income reset opens as a calm presentation story", async ({ page }) => {
    const errors = await openApp(page, "survivorIncome");
    const story = await page.evaluate(() => {
      const visibleConnectors = window.__AFV_TEST__.getState().connectors.filter((conn) => conn.visible !== false);
      const labels = [...document.querySelectorAll(".connector-label")].map((node) => ({
        id: node.dataset.connectorId,
        role: node.dataset.presentationRole,
        text: node.textContent.trim()
      }));
      return {
        visibleConnectorCount: visibleConnectors.length,
        visibleLabelCount: labels.length,
        labels,
        secondaryLabels: labels.filter((label) => label.role !== "primary").map((label) => label.id)
      };
    });

    expect(story.visibleConnectorCount).toBeLessThanOrEqual(4);
    expect(story.visibleLabelCount).toBeLessThanOrEqual(3);
    expect(story.secondaryLabels).toEqual([]);
    expect(story.labels.map((label) => label.id).sort()).toEqual(["gapDraw", "guaranteed", "transitionCash"].sort());
    expect(errors).toEqual([]);
  });

  test("template flows have visible values and avoid unrelated tile bodies", async ({ page }) => {
    test.setTimeout(60000);
    const errors = await openApp(page);
    const findings = [];

    for (const templateId of TEMPLATE_IDS) {
      await page.evaluate((id) => {
        window.__AFV_TEST__.loadTemplate(id);
        window.__AFV_TEST__.fit();
      }, templateId);
      await settle(page);
      const result = await page.evaluate(() => {
        const state = window.__AFV_TEST__.getState();
        const itemRects = [...document.querySelectorAll(".canvas-item, .canvas-group")].map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            id: node.dataset.itemId || node.dataset.groupId,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom
          };
        });
        const labels = [...document.querySelectorAll(".connector-label")].map((node) => {
          const rect = node.getBoundingClientRect();
          return { id: node.dataset.connectorId, text: node.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        });
        const visibleConnectors = state.connectors.filter((conn) => conn.visible !== false);
        const hidden = visibleConnectors
          .filter((conn) => (conn.labelMode || "auto") === "hidden" && !["secondary", "detail"].includes(conn.presentationRole))
          .map((conn) => conn.id);
        const zero = visibleConnectors.filter((conn) => !Number(conn.amount)).map((conn) => conn.id);
        const labelsWithoutMoney = labels.filter((label) => !/\$/.test(label.text)).map((label) => label.id);
        const labelTileOverlaps = labels.flatMap((label) => itemRects
          .filter((item) => label.right > item.left + 4 && label.left < item.right - 4 && label.bottom > item.top + 4 && label.top < item.bottom - 4)
          .map((item) => `${label.id} overlaps ${item.id}`));
        const labelLabelOverlaps = labels.flatMap((label, labelIndex) => labels.slice(labelIndex + 1)
          .filter((other) => label.right > other.left + 4 && label.left < other.right - 4 && label.bottom > other.top + 4 && label.top < other.bottom - 4)
          .map((other) => `${label.id} overlaps ${other.id}`));
        const pathTileCrossings = [];
        const endpointBodyCrossings = [];
        const pathLabelCrossings = [];
        for (const conn of visibleConnectors) {
          const path = document.querySelector(`.connector-hit[data-connector-id="${CSS.escape(conn.id)}"]`);
          if (!path || typeof path.getTotalLength !== "function") continue;
          const length = path.getTotalLength();
          const offenders = new Set();
          const endpointOffenders = new Set();
          const labelOffenders = new Set();
          for (let index = 2; index <= 118; index += 1) {
            const t = index / 120;
            const point = path.getPointAtLength((length * index) / 120);
            const client = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
            for (const item of itemRects) {
              const inset = 6;
              if (client.x > item.left + inset && client.x < item.right - inset && client.y > item.top + inset && client.y < item.bottom - inset) {
                if (item.id === conn.source?.itemId || item.id === conn.target?.itemId) {
                  if (!(item.id === conn.source?.itemId && t <= 0.025) && !(item.id === conn.target?.itemId && t >= 0.975)) {
                    endpointOffenders.add(`${item.id}@${t.toFixed(2)}`);
                  }
                } else {
                  offenders.add(item.id);
                }
              }
            }
            labels.forEach((label) => {
              if (label.id === conn.id) return;
              if (client.x > label.left - 4 && client.x < label.right + 4 && client.y > label.top - 4 && client.y < label.bottom + 4) {
                labelOffenders.add(label.id);
              }
            });
          }
          if (offenders.size) pathTileCrossings.push(`${conn.id} crosses ${[...offenders].join(",")}`);
          if (endpointOffenders.size) endpointBodyCrossings.push(`${conn.id} runs under endpoint ${[...endpointOffenders].join(",")}`);
          if (labelOffenders.size) pathLabelCrossings.push(`${conn.id} crosses labels ${[...labelOffenders].join(",")}`);
        }
        return { templateId: state.activeTemplateId, hidden, zero, labelsWithoutMoney, labelTileOverlaps, labelLabelOverlaps, pathTileCrossings, endpointBodyCrossings, pathLabelCrossings };
      });

      if (
        result.hidden.length ||
        result.zero.length ||
        result.labelsWithoutMoney.length ||
        result.labelTileOverlaps.length ||
        result.labelLabelOverlaps.length ||
        result.pathTileCrossings.length ||
        result.endpointBodyCrossings.length ||
        result.pathLabelCrossings.length
      ) {
        findings.push(result);
      }
    }

    expect(findings).toEqual([]);
    expect(errors).toEqual([]);
  });
});
