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
  "survivorIncome"
];

async function openApp(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`[pageerror] ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[console.error] ${message.text()}`);
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `
  });
  return errors;
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function loadTemplate(page, templateId) {
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.evaluate(() => window.__AFV_TEST__.fit());
  await page.evaluate(() => document.fonts?.ready);
  await settle(page);
}

async function geometryViolations(page) {
  return page.evaluate(() => {
    const state = window.__AFV_TEST__.getState();
    const connectorMap = new Map((state.connectors || []).map((connector) => [connector.id, connector]));
    const findings = [];
    const textSelectors = [
      ".canvas-item .finance-name",
      ".canvas-item .finance-type",
      ".canvas-item .finance-note",
      ".canvas-item .finance-value",
      ".canvas-item .paycheck-title",
      ".canvas-item .paycheck-amount",
      ".canvas-item .paycheck-caption",
      ".canvas-item .cashflow-row",
      ".canvas-item .annuity-contract-readout",
      ".canvas-item .product-meta-grid",
      ".canvas-item .sub-bucket-card",
      ".canvas-item .shape-kicker",
      ".canvas-item .shape-label",
      ".canvas-item .shape-note",
      ".canvas-item .text-main",
      ".canvas-item .text-sub",
      ".canvas-item .policy-stat",
      ".canvas-item .tag-pill"
    ];

    function isVisible(node) {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) > 0.01;
    }

    function rectFor(node, id, kind) {
      const rect = node.getBoundingClientRect();
      return {
        id,
        kind,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    }

    function inside(sample, rect, inset = 0) {
      return sample.x >= rect.left + inset &&
        sample.x <= rect.right - inset &&
        sample.y >= rect.top + inset &&
        sample.y <= rect.bottom - inset;
    }

    function endpointGrace(connector, rect, sample) {
      if (rect.kind !== "object") return false;
      const isSource = rect.id === connector.source?.itemId;
      const isTarget = rect.id === connector.target?.itemId;
      return (isSource && sample.t <= 0.035) || (isTarget && sample.t >= 0.965);
    }

    function add(type, connectorId, target, sample) {
      const key = `${type}:${connectorId}:${target.id}`;
      if (findings.some((finding) => finding.key === key)) return;
      findings.push({
        key,
        type,
        connectorId,
        targetId: target.id,
        t: Number(sample.t.toFixed(3)),
        point: { x: Math.round(sample.x), y: Math.round(sample.y) }
      });
    }

    const objects = [...document.querySelectorAll(".canvas-item.item-finance, .canvas-group")]
      .filter(isVisible)
      .map((node) => rectFor(node, node.dataset.itemId || node.dataset.groupId, "object"));
    const textSurfaces = [...document.querySelectorAll(textSelectors.join(","))]
      .filter((node) => isVisible(node) && (node.textContent || "").trim())
      .map((node) => ({
        ...rectFor(node, node.closest(".canvas-item")?.dataset.itemId || node.textContent.trim(), "text"),
        ownerId: node.closest(".canvas-item")?.dataset.itemId || null
      }));
    const labels = [...document.querySelectorAll(".connector-label")]
      .filter(isVisible)
      .map((node) => rectFor(node, node.dataset.connectorId || node.textContent.trim(), "label"));
    const chrome = [...document.querySelectorAll(".selection-toolbar, .selection-popover, .selection-inspector")]
      .filter(isVisible)
      .map((node) => rectFor(
        node,
        node.dataset.popoverKind || node.dataset.inspectorSection || node.getAttribute("aria-label") || "selection-chrome",
        "chrome"
      ));

    [...document.querySelectorAll(".connector-draw[data-connector-id]")]
      .filter(isVisible)
      .forEach((pathNode) => {
        if (typeof pathNode.getTotalLength !== "function") return;
        const connectorId = pathNode.dataset.connectorId;
        const connector = connectorMap.get(connectorId) || {};
        const matrix = pathNode.getScreenCTM();
        const length = pathNode.getTotalLength();
        if (!matrix || !Number.isFinite(length) || length <= 0) return;
        const steps = Math.max(80, Math.min(180, Math.ceil(length / 8)));
        for (let index = 0; index <= steps; index += 1) {
          const t = index / steps;
          const point = pathNode.getPointAtLength(length * t);
          const sample = {
            x: point.x * matrix.a + point.y * matrix.c + matrix.e,
            y: point.x * matrix.b + point.y * matrix.d + matrix.f,
            t
          };

          objects.forEach((object) => {
            if (endpointGrace(connector, object, sample)) return;
            if (inside(sample, object, 6)) add("flow-object", connectorId, object, sample);
          });
          textSurfaces.forEach((text) => {
            if (inside(sample, text, -2)) add("flow-text", connectorId, text, sample);
          });
          labels.forEach((label) => {
            if (label.id === connectorId) return;
            if (inside(sample, label, -3)) add("flow-label", connectorId, label, sample);
          });
          chrome.forEach((chromeRect) => {
            if (inside(sample, chromeRect, -4)) add("flow-chrome", connectorId, chromeRect, sample);
          });
        }
      });

    function overlapArea(a, b) {
      const left = Math.max(a.left, b.left);
      const right = Math.min(a.right, b.right);
      const top = Math.max(a.top, b.top);
      const bottom = Math.min(a.bottom, b.bottom);
      return Math.max(0, right - left) * Math.max(0, bottom - top);
    }

    labels.forEach((label) => {
      objects.forEach((object) => {
        if (overlapArea(label, object) > 20) {
          findings.push({
            type: "label-object",
            connectorId: label.id,
            targetId: object.id
          });
        }
      });
      textSurfaces.forEach((text) => {
        if (overlapArea(label, text) > 20) {
          findings.push({
            type: "label-text",
            connectorId: label.id,
            targetId: text.id
          });
        }
      });
    });

    return findings.map(({ key, ...finding }) => finding);
  });
}

async function surfaceFitFailures(page) {
  return page.evaluate(() => {
    const tolerance = 1.5;
    const selectors = [
      '[data-geometry-surface="sleeve"]',
      '[data-geometry-surface="connector-label"]',
      ".connector-label .relationship",
      ".surface-tag",
      ".finance-tag-surface",
      '.canvas-item[data-product-role*="tax" i] .item-surface',
      '.canvas-item[data-product-role*="fee" i] .item-surface'
    ];

    function isVisible(node) {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) > 0.01;
    }

    function identity(node) {
      return node.dataset.geometrySurface ||
        node.dataset.subBucketId ||
        node.dataset.connectorId ||
        node.closest(".canvas-item")?.dataset.itemId ||
        node.className ||
        node.textContent.trim().slice(0, 80);
    }

    return [...document.querySelectorAll(selectors.join(","))]
      .filter(isVisible)
      .filter((node) => (
        node.scrollWidth > node.clientWidth + tolerance ||
        node.scrollHeight > node.clientHeight + tolerance
      ))
      .map((node) => ({
        id: identity(node),
        selector: selectors.find((selector) => node.matches(selector)),
        text: node.textContent.trim().replace(/\s+/g, " ").slice(0, 120),
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight
      }));
  });
}

function summarizeViolations(findings) {
  const byType = {};
  let total = 0;
  findings.forEach((entry) => {
    entry.violations.forEach((violation) => {
      total += 1;
      byType[violation.type] = (byType[violation.type] || 0) + 1;
    });
  });
  return { total, byType };
}

test.describe("strict canvas geometry contract", () => {
  test("all templates expose story lanes and keep visible connector count readable", async ({ page }) => {
    // This all-template browser geometry loop is intentionally longer than single-fixture tests.
    test.setTimeout(60000);
    const errors = await openApp(page);

    for (const templateId of TEMPLATE_IDS) {
      await loadTemplate(page, templateId);
      const templateLayout = await page.evaluate(() => window.__AFV_TEST__.getState().templateLayout);
      const visibleCount = await page.locator(".connector-draw[data-connector-id]").count();

      expect(templateLayout?.lanes?.length, `${templateId} story lane count`).toBeGreaterThanOrEqual(3);
      expect(visibleCount, `${templateId} visible connector count`).toBeLessThanOrEqual(6);
    }

    expect(errors).toEqual([]);
  });

  test("custom layout lanes influence the primary orthogonal detour route", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Lane preference detour fixture",
        layout: {
          lanes: [
            { id: "lower-story", role: "outcome", x: 420, y: 760, w: 1220, h: 120, weight: 1 }
          ]
        },
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
            x: 500,
            y: 500,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          },
          {
            id: "centerBlock",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "centerBlock",
            label: "Decision Block",
            subtitle: "Avoid",
            note: "",
            x: 1000,
            y: 500,
            w: 210,
            h: 360,
            zIndex: 10,
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
            x: 1500,
            y: 500,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          }
        ],
        groups: [],
        financeData: {
          source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
          centerBlock: { category: "brokerage", value: 1, capacity: 1, baseValue: 1 },
          target: { category: "brokerage", value: 200000, capacity: 600000, baseValue: 200000 }
        },
        connectors: [
          {
            id: "laneRoute",
            label: "Lane guided transfer",
            flowType: "transfer",
            amount: 50000,
            source: { itemId: "source", port: "right.out" },
            target: { itemId: "target", port: "left.in" },
            routeStyle: "elbow",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            mid: { x: 1000, y: 250 },
            manualMid: true,
            labelMode: "hidden",
            max: 100000
          }
        ],
        scenario: {}
      });
    });
    await page.evaluate(() => window.__AFV_TEST__.fit());
    await settle(page);

    const routeSummary = await page.evaluate(() => {
      const path = document.querySelector(".connector-hit[data-connector-id='laneRoute']");
      if (!path || typeof path.getTotalLength !== "function") return { maxY: null, inLaneSamples: 0 };
      const length = path.getTotalLength();
      const samples = [];
      for (let index = 0; index <= 120; index += 1) {
        const point = path.getPointAtLength((length * index) / 120);
        samples.push({ x: point.x, y: point.y });
      }
      return {
        maxY: Math.max(...samples.map((point) => point.y)),
        inLaneSamples: samples.filter((point) => point.x >= 420 && point.x <= 1640 && point.y >= 760 && point.y <= 880).length
      };
    });

    expect(routeSummary.maxY).toBeGreaterThanOrEqual(760);
    expect(routeSummary.inLaneSamples).toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });

  test("test harness preserves template lanes across getState loadDiagram round trip", async ({ page }) => {
    const errors = await openApp(page);
    await loadTemplate(page, "retirement");
    const beforeCount = await page.evaluate(() => window.__AFV_TEST__.getState().templateLayout?.lanes?.length || 0);
    await page.evaluate(() => {
      const snapshot = window.__AFV_TEST__.getState();
      window.__AFV_TEST__.loadDiagram(snapshot);
    });
    await settle(page);
    const afterCount = await page.evaluate(() => window.__AFV_TEST__.getState().templateLayout?.lanes?.length || 0);

    expect(beforeCount).toBeGreaterThanOrEqual(3);
    expect(afterCount).toBe(beforeCount);
    expect(errors).toEqual([]);
  });

  test("test harness preserves named endpoint ports across loadDiagram", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Named port round trip",
        items: [
          {
            id: "source",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "source",
            label: "Source",
            subtitle: "Account",
            note: "",
            x: 520,
            y: 500,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          },
          {
            id: "target",
            type: "finance",
            visual: "paycheck",
            category: "income",
            financeId: "target",
            label: "Paycheck",
            subtitle: "Monthly need",
            note: "",
            x: 980,
            y: 500,
            w: 260,
            h: 150,
            zIndex: 10,
            style: {}
          }
        ],
        financeData: {
          source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
          target: { category: "income", value: 5000, capacity: 7500, baseValue: 5000 }
        },
        connectors: [
          {
            id: "ported",
            label: "Named port",
            flowType: "income",
            amount: 60000,
            source: { itemId: "source", port: "right.out", offsetY: -20 },
            target: { itemId: "target", port: "left.in", offsetY: 26 },
            routeStyle: "smartArc",
            labelMode: "hidden"
          }
        ],
        scenario: {}
      });
    });
    const connector = await page.evaluate(() => window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "ported"));

    expect(connector.source).toMatchObject({ itemId: "source", port: "right.out", offsetY: -20 });
    expect(connector.target).toMatchObject({ itemId: "target", port: "left.in", offsetY: 26 });
    expect(errors).toEqual([]);
  });

  test("all templates keep visible connector paths outside objects, text, labels, and chrome", async ({ page }) => {
    // This all-template browser geometry loop is intentionally longer than single-fixture tests.
    test.setTimeout(60000);
    const errors = await openApp(page);
    const findings = [];

    for (const templateId of TEMPLATE_IDS) {
      await loadTemplate(page, templateId);
      const violations = await geometryViolations(page);
      if (violations.length) findings.push({ templateId, violations });
    }

    expect(findings, JSON.stringify(summarizeViolations(findings))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("all templates obey geometry law after manual fit", async ({ page }) => {
    // This all-template browser geometry loop is intentionally longer than single-fixture tests.
    test.setTimeout(60000);
    const errors = await openApp(page);

    for (const templateId of TEMPLATE_IDS) {
      await page.evaluate((id) => {
        window.__AFV_TEST__.loadTemplate(id);
        window.__AFV_TEST__.fit();
      }, templateId);
      await page.evaluate(() => document.fonts?.ready);
      await settle(page);
      await expect.poll(() => geometryViolations(page), {
        message: `${templateId} manual fit geometry violations`,
        timeout: 5000
      }).toEqual([]);
    }

    expect(errors).toEqual([]);
  });

  test("all templates obey geometry law with item and connector selected", async ({ page }) => {
    // This all-template browser geometry loop is intentionally longer than single-fixture tests.
    test.setTimeout(90000);
    const errors = await openApp(page);

    for (const templateId of TEMPLATE_IDS) {
      await loadTemplate(page, templateId);
      const state = await page.evaluate(() => window.__AFV_TEST__.getState());
      const itemId = state.items.find((item) => item.type === "finance")?.id;
      const connectorId = state.connectors.find((connector) => connector.visible !== false)?.id;

      if (itemId) {
        await page.evaluate((id) => {
          window.__AFV_TEST__.select("item", id);
          window.__AFV_TEST__.fit();
        }, itemId);
        await settle(page);
        await expect.poll(() => geometryViolations(page), {
          message: `${templateId} selected item geometry violations`,
          timeout: 5000
        }).toEqual([]);
      }

      if (connectorId) {
        await page.evaluate((id) => {
          window.__AFV_TEST__.select("connector", id);
          window.__AFV_TEST__.fit();
        }, connectorId);
        await settle(page);
        await expect.poll(() => geometryViolations(page), {
          message: `${templateId} selected connector geometry violations`,
          timeout: 5000
        }).toEqual([]);
      }
    }

    expect(errors).toEqual([]);
  });

  test("sleeves connector labels and optional tag surfaces fit their own boxes", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Component fit surface fixture",
        items: [
          {
            id: "cashSleeves",
            type: "finance",
            visual: "bucket",
            category: "cash",
            financeId: "cashSleeves",
            label: "Liquidity Reserve With A Long Advisor Entered Name",
            subtitle: "Cash bucket",
            note: "Advisor-entered approximate values",
            x: 520,
            y: 520,
            w: 250,
            h: 188,
            zIndex: 10,
            surface: "container",
            style: {}
          },
          {
            id: "destination",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "destination",
            label: "Destination Account",
            subtitle: "Managed brokerage",
            note: "Receiving sleeve transfer",
            x: 1120,
            y: 520,
            w: 230,
            h: 136,
            zIndex: 10,
            style: {}
          },
          {
            id: "longFeeTag",
            type: "finance",
            visual: "taxTag",
            category: "tax",
            financeId: "longFeeTag",
            label: "Planning fee and tax adjustment tag with an intentionally long label",
            subtitle: "Optional fee / tax",
            note: "Zero value should not show a meaningless progress bar",
            x: 820,
            y: 285,
            w: 126,
            h: 58,
            zIndex: 11,
            productRole: "fee",
            style: {}
          },
          {
            id: "longTaxTag",
            type: "finance",
            visual: "taxTag",
            category: "tax",
            financeId: "longTaxTag",
            label: "Estimated tax reserve holdback with unusually verbose planning note",
            subtitle: "Tax reserve",
            note: "Do not let tag copy spill outside the pill",
            x: 820,
            y: 755,
            w: 128,
            h: 60,
            zIndex: 11,
            productRole: "taxReserve",
            style: {}
          },
          {
            id: "longFeeTile",
            type: "finance",
            visual: "card",
            category: "tax",
            financeId: "longFeeTile",
            label: "Product role fee tile with verbose disclosure text that must not spill",
            subtitle: "Fee reserve",
            note: "Zero value product-role fee surface should not show a progress meter",
            x: 1120,
            y: 760,
            w: 185,
            h: 116,
            zIndex: 10,
            productRole: "fee",
            style: {}
          }
        ],
        groups: [],
        financeData: {
          cashSleeves: {
            category: "cash",
            value: 150000,
            capacity: 200000,
            baseValue: 150000,
            subBuckets: [
              {
                id: "operating-reserve-long",
                label: "Operating reserve with an unusually long sleeve label",
                value: 95000,
                note: "Available cash and near-term expenses"
              },
              {
                id: "tax-holdback-long",
                label: "Tax holdback for quarterly estimated obligations",
                value: 55000,
                note: "Quarterly estimated tax and fee reserve note"
              }
            ]
          },
          destination: { category: "brokerage", value: 400000, capacity: 800000, baseValue: 400000 },
          longFeeTag: { category: "tax", value: 0, capacity: 0, baseValue: 0, productRole: "fee" },
          longTaxTag: { category: "tax", value: 0, capacity: 0, baseValue: 0, productRole: "taxReserve" },
          longFeeTile: { category: "tax", value: 0, capacity: 0, baseValue: 0, productRole: "fee" }
        },
        connectors: [
          {
            id: "longConnectorLabel",
            label: "Long relationship label for connector fit verification",
            flowType: "transfer",
            amount: 1250000,
            source: { itemId: "cashSleeves", port: "right.out" },
            target: { itemId: "destination", port: "left.in" },
            routeStyle: "smartArc",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            labelMode: "manual",
            labelPoint: { x: 820, y: 520 },
            max: 1500000
          }
        ],
        scenario: {}
      });
    });
    await page.evaluate(() => window.__AFV_TEST__.fit());
    await settle(page);

    await expect(page.locator('.sub-bucket-card[data-geometry-surface="sleeve"]')).toHaveCount(2);
    await expect(page.locator('.connector-label[data-geometry-surface="connector-label"][data-connector-id="longConnectorLabel"]')).toHaveCount(1);
    await expect(page.locator('.finance-name[data-geometry-surface="text"]')).not.toHaveCount(0);
    await expect(page.locator('.finance-type[data-geometry-surface="text"]')).not.toHaveCount(0);
    await expect(page.locator('.finance-note[data-geometry-surface="text"]')).not.toHaveCount(0);

    const clipped = await surfaceFitFailures(page);
    expect(clipped).toEqual([]);
    await expect(page.locator('.canvas-item[data-item-id="longFeeTag"] .fill-track')).toHaveCount(0);
    await expect(page.locator('.canvas-item[data-item-id="longTaxTag"] .fill-track')).toHaveCount(0);
    await expect(page.locator('.canvas-item[data-item-id="longFeeTile"] .fill-track')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("estate trust data inspector does not leave chrome over routed trust flows", async ({ page }) => {
    const errors = await openApp(page);
    await loadTemplate(page, "estate");
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "revocableTrust");
      window.__AFV_TEST__.openPopover("selection-data");
    });
    await settle(page);

    await expect(page.locator(".selection-inspector")).toBeVisible();
    await expect(page.locator(".selection-toolbar")).toHaveCount(0);
    await expect(page.locator(".selection-popover")).toHaveCount(0);
    const violations = await geometryViolations(page);
    expect(violations, JSON.stringify(summarizeViolations([{ templateId: "estate", violations }]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("selection renderer exports do not emit floating toolbar or popover chrome", async ({ page }) => {
    const errors = await openApp(page);
    await loadTemplate(page, "retirement");
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "rolloverIra");
      window.__AFV_TEST__.openPopover("selection-data");
    });

    const renderedChrome = await page.evaluate(async () => {
      const module = await import("./src/render.js");
      return {
        toolbar: module.renderSelectionToolbar(),
        popover: module.renderSelectionPopover()
      };
    });

    expect(renderedChrome.toolbar).toBe("");
    expect(renderedChrome.popover).toBe("");
    await expect(page.locator(".selection-inspector")).toBeVisible();
    await expect(page.locator(".selection-toolbar")).toHaveCount(0);
    await expect(page.locator(".selection-popover")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("dragging a connected Estate trust repairs routes instead of allowing under-tile flow", async ({ page }) => {
    const errors = await openApp(page);
    await loadTemplate(page, "estate");

    const trust = page.locator('.canvas-item[data-item-id="revocableTrust"]');
    const box = await trust.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 20, { steps: 8 });
    await page.mouse.up();
    await page.evaluate(() => window.__AFV_TEST__.clearSelection());
    await settle(page);

    const violations = await geometryViolations(page);
    expect(violations, JSON.stringify(summarizeViolations([{ templateId: "estate-drag", violations }]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("presentation repair clears conflicting manual route and label preferences", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Post-edit repair fixture",
        items: [
          {
            id: "source",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "source",
            label: "Source IRA",
            subtitle: "Rollover",
            note: "",
            x: 420,
            y: 620,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          },
          {
            id: "obstacle",
            type: "finance",
            visual: "card",
            category: "annuity",
            financeId: "obstacle",
            label: "Conflict Surface",
            subtitle: "Must stay clear",
            note: "Advisor-entered values",
            x: 840,
            y: 620,
            w: 260,
            h: 170,
            zIndex: 10,
            style: {}
          },
          {
            id: "target",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "target",
            label: "Target IRA",
            subtitle: "Managed account",
            note: "",
            x: 1260,
            y: 620,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          }
        ],
        groups: [],
        financeData: {
          source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
          obstacle: { category: "annuity", value: 250000, capacity: 500000, baseValue: 250000 },
          target: { category: "brokerage", value: 200000, capacity: 600000, baseValue: 200000 }
        },
        connectors: [
          {
            id: "conflictingManualFlow",
            label: "Rollover premium",
            flowType: "annuityPremium",
            amount: 125000,
            source: { itemId: "source", port: "right.out" },
            target: { itemId: "target", port: "left.in" },
            routeStyle: "smartArc",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            mid: { x: 840, y: 620 },
            manualMid: true,
            labelMode: "manual",
            labelPoint: { x: 840, y: 620 },
            max: 200000
          }
        ],
        scenario: {}
      });
    });
    await page.evaluate(() => window.__AFV_TEST__.tidy());
    await page.evaluate(() => window.__AFV_TEST__.fit());
    await settle(page);

    const connector = await page.evaluate(() => (
      window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "conflictingManualFlow")
    ));
    expect(connector.mid).toBeNull();
    expect(connector.manualMid).toBe(false);
    expect(connector.labelPoint).toBeNull();
    expect(connector.labelMode).toBe("auto");

    const violations = await geometryViolations(page);
    expect(violations, JSON.stringify(summarizeViolations([{ templateId: "repair", violations }]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("legal manual midpoint survives connector amount repair", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Legal manual route preservation fixture",
        items: [
          {
            id: "source",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "source",
            label: "Source IRA",
            subtitle: "Brokerage",
            note: "",
            x: 420,
            y: 620,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          },
          {
            id: "target",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "target",
            label: "Target IRA",
            subtitle: "Brokerage",
            note: "",
            x: 1260,
            y: 620,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          }
        ],
        groups: [],
        financeData: {
          source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
          target: { category: "brokerage", value: 200000, capacity: 600000, baseValue: 200000 }
        },
        connectors: [
          {
            id: "legalManual",
            label: "Legal manual route",
            flowType: "transfer",
            amount: 50000,
            source: { itemId: "source", port: "right.out" },
            target: { itemId: "target", port: "left.in" },
            routeStyle: "smartArc",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            mid: { x: 840, y: 300 },
            manualMid: true,
            labelMode: "hidden",
            max: 200000
          }
        ],
        scenario: {}
      });
    });
    await page.evaluate(() => {
      window.__AFV_TEST__.select("connector", "legalManual");
      window.__AFV_TEST__.openPopover("connector-data");
    });
    await expect(page.locator(".selection-inspector input[data-input='connector-amount']")).toBeVisible();
    await page.locator(".selection-inspector input[data-input='connector-amount']").fill("75000");
    await settle(page);

    const connector = await page.evaluate(() => (
      window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "legalManual")
    ));
    expect(connector.mid).toEqual({ x: 840, y: 300 });
    expect(connector.manualMid).toBe(true);
    const routeIssues = await page.evaluate(() => (
      window.__AFV_TEST__.getDiagnostics().layoutIssues.filter((issue) => issue.ids?.[0] === "legalManual" && /^flow-/.test(issue.type))
    ));
    expect(routeIssues).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("diagnostics follow rendered smartArc curve instead of the route chord", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Rendered curve diagnostic fixture",
        items: [
          {
            id: "source",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "source",
            label: "Source IRA",
            subtitle: "Brokerage",
            note: "",
            x: 420,
            y: 620,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          },
          {
            id: "chordObstacle",
            type: "finance",
            visual: "card",
            category: "annuity",
            financeId: "chordObstacle",
            label: "Chord Obstacle",
            subtitle: "Rendered curve clears",
            note: "",
            x: 840,
            y: 620,
            w: 170,
            h: 120,
            zIndex: 10,
            style: {}
          },
          {
            id: "target",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "target",
            label: "Target IRA",
            subtitle: "Brokerage",
            note: "",
            x: 1260,
            y: 620,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          }
        ],
        groups: [],
        financeData: {
          source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
          chordObstacle: { category: "annuity", value: 1, capacity: 1, baseValue: 1 },
          target: { category: "brokerage", value: 200000, capacity: 600000, baseValue: 200000 }
        },
        connectors: [
          {
            id: "curveClearsChordHit",
            label: "Curve clears",
            flowType: "transfer",
            amount: 50000,
            source: { itemId: "source", port: "right.out" },
            target: { itemId: "target", port: "left.in" },
            routeStyle: "smartArc",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            mid: { x: 840, y: 220 },
            manualMid: true,
            labelMode: "hidden",
            max: 200000
          }
        ],
        scenario: {}
      });
    });
    await page.evaluate(() => window.__AFV_TEST__.fit());
    await settle(page);

    const connector = await page.evaluate(() => (
      window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "curveClearsChordHit")
    ));
    expect(connector.mid).toEqual({ x: 840, y: 220 });
    const routeIssues = await page.evaluate(() => (
      window.__AFV_TEST__.getDiagnostics().layoutIssues.filter((issue) => issue.ids?.[0] === "curveClearsChordHit" && /^flow-/.test(issue.type))
    ));
    expect(routeIssues).toEqual([]);
    const violations = await geometryViolations(page);
    expect(violations, JSON.stringify(summarizeViolations([{ templateId: "rendered-curve", violations }]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("item visual edits on connected tiles preserve geometry repair feedback", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Connected item visual edit fixture",
        items: [
          {
            id: "source",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "source",
            label: "Source IRA",
            subtitle: "Brokerage",
            note: "",
            x: 420,
            y: 620,
            w: 300,
            h: 190,
            zIndex: 10,
            style: {}
          },
          {
            id: "target",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "target",
            label: "Target IRA",
            subtitle: "Brokerage",
            note: "",
            x: 1260,
            y: 620,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          }
        ],
        groups: [],
        financeData: {
          source: {
            category: "brokerage",
            value: 500000,
            capacity: 1000000,
            baseValue: 500000,
            subBuckets: [
              { id: "core", label: "Core", value: 350000 },
              { id: "tax", label: "Tax reserve", value: 150000 }
            ]
          },
          target: { category: "brokerage", value: 200000, capacity: 600000, baseValue: 200000 }
        },
        connectors: [
          {
            id: "visualEditFlow",
            label: "Transfer",
            flowType: "transfer",
            amount: 50000,
            source: { itemId: "source", port: "right.out" },
            target: { itemId: "target", port: "left.in" },
            routeStyle: "smartArc",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            mid: { x: 840, y: 300 },
            manualMid: true,
            labelMode: "hidden",
            max: 200000
          }
        ],
        scenario: {}
      });
    });
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "source");
      window.__AFV_TEST__.openPopover("selection-style");
    });
    await expect(page.locator(".selection-inspector [data-field='visual'][data-value='bucket']")).toBeVisible();
    await page.locator(".selection-inspector [data-field='visual'][data-value='bucket']").click();
    await page.evaluate(() => window.__AFV_TEST__.clearSelection());
    await settle(page);

    const state = await page.evaluate(() => window.__AFV_TEST__.getState());
    expect(state.items.find((item) => item.id === "source")?.visual).toBe("bucket");
    const routeIssues = await page.evaluate(() => (
      window.__AFV_TEST__.getDiagnostics().layoutIssues.filter((issue) => issue.ids?.[0] === "visualEditFlow" && /^flow-/.test(issue.type))
    ));
    expect(routeIssues).toEqual([]);
    const violations = await geometryViolations(page);
    expect(violations, JSON.stringify(summarizeViolations([{ templateId: "item-field-visual-edit", violations }]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("manual midpoint detours use bounded obstacle corridors", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Staggered obstacle corridor fixture",
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
            x: 450,
            y: 500,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          },
          {
            id: "wallA",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "wallA",
            label: "Upper Block",
            subtitle: "Avoid",
            note: "",
            x: 760,
            y: 250,
            w: 140,
            h: 560,
            zIndex: 10,
            style: {}
          },
          {
            id: "wallB",
            type: "finance",
            visual: "bucket",
            category: "cash",
            financeId: "wallB",
            label: "Lower Sleeve Block",
            subtitle: "Avoid",
            note: "",
            x: 1000,
            y: 1680,
            w: 140,
            h: 2640,
            zIndex: 10,
            style: {}
          },
          {
            id: "wallC",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "wallC",
            label: "Upper Block",
            subtitle: "Avoid",
            note: "",
            x: 1240,
            y: 250,
            w: 140,
            h: 560,
            zIndex: 10,
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
            x: 1550,
            y: 500,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          }
        ],
        groups: [],
        financeData: {
          source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
          wallA: { category: "brokerage", value: 1, capacity: 1, baseValue: 1 },
          wallB: {
            category: "cash",
            value: 1,
            capacity: 1,
            baseValue: 1,
            subBuckets: [
              { id: "cash", label: "Cash", value: 1 },
              { id: "tax", label: "Tax reserve", value: 1 },
              { id: "spend", label: "Spending", value: 1 }
            ]
          },
          wallC: { category: "brokerage", value: 1, capacity: 1, baseValue: 1 },
          target: { category: "brokerage", value: 200000, capacity: 600000, baseValue: 200000 }
        },
        connectors: [
          {
            id: "snakeRoute",
            label: "Transfer",
            flowType: "transfer",
            amount: 50000,
            source: { itemId: "source", port: "right.out" },
            target: { itemId: "target", port: "left.in" },
            routeStyle: "smartArc",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            mid: { x: 1000, y: 500 },
            manualMid: true,
            labelMode: "hidden",
            max: 100000
          }
        ],
        scenario: {}
      });
    });
    await page.evaluate(() => window.__AFV_TEST__.fit());
    await settle(page);

    const violations = await geometryViolations(page);
    const d = await page.locator(".connector-draw[data-connector-id='snakeRoute']").getAttribute("d");
    const lineCommands = d?.match(/\bL/g) || [];
    expect(lineCommands.length).toBeGreaterThanOrEqual(7);
    expect(violations, JSON.stringify(summarizeViolations([{ templateId: "staggered", violations }]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("manual connector label over a financial surface is reset to auto", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Manual label repair fixture",
        items: [
          {
            id: "source",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "source",
            label: "Source IRA",
            subtitle: "Rollover",
            note: "",
            x: 420,
            y: 620,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          },
          {
            id: "product",
            type: "finance",
            visual: "card",
            category: "annuity",
            financeId: "product",
            label: "Income Annuity",
            subtitle: "Protected income",
            note: "Advisor-entered values",
            x: 840,
            y: 460,
            w: 250,
            h: 150,
            zIndex: 10,
            style: {}
          },
          {
            id: "target",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "target",
            label: "Target IRA",
            subtitle: "Managed account",
            note: "",
            x: 1260,
            y: 620,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          }
        ],
        groups: [],
        financeData: {
          source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
          product: { category: "annuity", value: 250000, capacity: 500000, baseValue: 250000 },
          target: { category: "brokerage", value: 200000, capacity: 600000, baseValue: 200000 }
        },
        connectors: [
          {
            id: "manualLabelFlow",
            label: "Rollover premium",
            flowType: "annuityPremium",
            amount: 125000,
            source: { itemId: "source", port: "right.out" },
            target: { itemId: "target", port: "left.in" },
            routeStyle: "smartArc",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            labelMode: "manual",
            labelPoint: { x: 840, y: 460 },
            max: 200000
          }
        ],
        scenario: {}
      });
    });
    await page.evaluate(() => window.__AFV_TEST__.fit());
    await settle(page);

    const connector = await page.evaluate(() => (
      window.__AFV_TEST__.getState().connectors.find((conn) => conn.id === "manualLabelFlow")
    ));
    expect(connector.labelPoint).toBeNull();
    expect(connector.labelMode).toBe("auto");
    const label = page.locator(".connector-label[data-connector-id='manualLabelFlow']");
    await expect(label).toHaveAttribute("data-label-mode", "auto");
    await expect(label).toHaveAttribute("data-label-repaired", "false");
    const violations = await geometryViolations(page);
    expect(violations, JSON.stringify(summarizeViolations([{ templateId: "manual-label", violations }]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("routes detour around connector labels even when no object obstacle is hit", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Label-only routing fixture",
        items: [
          {
            id: "source",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "source",
            label: "Source Account",
            subtitle: "Funding",
            note: "",
            x: 420,
            y: 520,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          },
          {
            id: "target",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "target",
            label: "Target Account",
            subtitle: "Outcome",
            note: "",
            x: 1540,
            y: 520,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          },
          {
            id: "labelSource",
            type: "finance",
            visual: "amountTag",
            category: "cash",
            financeId: "labelSource",
            label: "Label Source",
            subtitle: "",
            note: "",
            x: 520,
            y: 170,
            w: 150,
            h: 70,
            zIndex: 10,
            style: {}
          },
          {
            id: "labelTarget",
            type: "finance",
            visual: "amountTag",
            category: "cash",
            financeId: "labelTarget",
            label: "Label Target",
            subtitle: "",
            note: "",
            x: 1480,
            y: 170,
            w: 150,
            h: 70,
            zIndex: 10,
            style: {}
          }
        ],
        groups: [],
        financeData: {
          source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
          target: { category: "brokerage", value: 200000, capacity: 600000, baseValue: 200000 },
          labelSource: { category: "cash", value: 1, capacity: 1, baseValue: 1 },
          labelTarget: { category: "cash", value: 1, capacity: 1, baseValue: 1 }
        },
        connectors: [
          {
            id: "labelObstacle",
            label: "Review checkpoint",
            flowType: "transfer",
            amount: 1000,
            source: { itemId: "labelSource", port: "right.out" },
            target: { itemId: "labelTarget", port: "left.in" },
            routeStyle: "straight",
            strokeStyle: "dotted",
            colorMode: "graphite",
            widthMode: "subtle",
            arrowEnd: "none",
            labelMode: "manual",
            labelPoint: { x: 980, y: 520 },
            max: 10000
          },
          {
            id: "labelOnlyRoute",
            label: "Primary transfer",
            flowType: "transfer",
            amount: 50000,
            source: { itemId: "source", port: "right.out" },
            target: { itemId: "target", port: "left.in" },
            routeStyle: "straight",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            labelMode: "hidden",
            max: 100000
          }
        ],
        scenario: {}
      });
    });
    await page.evaluate(() => window.__AFV_TEST__.fit());
    await settle(page);

    await expect(page.locator(".connector-label[data-connector-id='labelObstacle']")).toHaveAttribute("data-label-repaired", "false");
    const violations = await geometryViolations(page);
    expect(violations, JSON.stringify(summarizeViolations([{ templateId: "label-only", violations }]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("obstacle detour routes avoid other rendered connector labels", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Detour label obstacle fixture",
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
            x: 450,
            y: 500,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          },
          {
            id: "wallA",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "wallA",
            label: "Upper Block",
            subtitle: "Avoid",
            note: "",
            x: 760,
            y: 250,
            w: 140,
            h: 560,
            zIndex: 10,
            style: {}
          },
          {
            id: "wallB",
            type: "finance",
            visual: "bucket",
            category: "cash",
            financeId: "wallB",
            label: "Lower Sleeve Block",
            subtitle: "Avoid",
            note: "",
            x: 1000,
            y: 1680,
            w: 140,
            h: 2640,
            zIndex: 10,
            style: {}
          },
          {
            id: "wallC",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "wallC",
            label: "Upper Block",
            subtitle: "Avoid",
            note: "",
            x: 1240,
            y: 250,
            w: 140,
            h: 560,
            zIndex: 10,
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
            x: 1550,
            y: 500,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          },
          {
            id: "labelSource",
            type: "finance",
            visual: "amountTag",
            category: "cash",
            financeId: "labelSource",
            label: "Label Source",
            subtitle: "",
            note: "",
            x: 520,
            y: 118,
            w: 150,
            h: 70,
            zIndex: 10,
            style: {}
          },
          {
            id: "labelTarget",
            type: "finance",
            visual: "amountTag",
            category: "cash",
            financeId: "labelTarget",
            label: "Label Target",
            subtitle: "",
            note: "",
            x: 1480,
            y: 118,
            w: 150,
            h: 70,
            zIndex: 10,
            style: {}
          }
        ],
        groups: [],
        financeData: {
          source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
          wallA: { category: "brokerage", value: 1, capacity: 1, baseValue: 1 },
          wallB: {
            category: "cash",
            value: 1,
            capacity: 1,
            baseValue: 1,
            subBuckets: [
              { id: "cash", label: "Cash", value: 1 },
              { id: "tax", label: "Tax reserve", value: 1 },
              { id: "spend", label: "Spending", value: 1 }
            ]
          },
          wallC: { category: "brokerage", value: 1, capacity: 1, baseValue: 1 },
          target: { category: "brokerage", value: 200000, capacity: 600000, baseValue: 200000 },
          labelSource: { category: "cash", value: 1, capacity: 1, baseValue: 1 },
          labelTarget: { category: "cash", value: 1, capacity: 1, baseValue: 1 }
        },
        connectors: [
          {
            id: "labelObstacle",
            label: "Review checkpoint",
            flowType: "transfer",
            amount: 1000,
            source: { itemId: "labelSource", port: "right.out" },
            target: { itemId: "labelTarget", port: "left.in" },
            routeStyle: "straight",
            strokeStyle: "dotted",
            colorMode: "graphite",
            widthMode: "subtle",
            arrowEnd: "none",
            labelMode: "manual",
            labelPoint: { x: 1000, y: 320 },
            max: 10000
          },
          {
            id: "detourRoute",
            label: "Required detour",
            flowType: "transfer",
            amount: 50000,
            source: { itemId: "source", port: "right.out" },
            target: { itemId: "target", port: "left.in" },
            routeStyle: "smartArc",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            mid: { x: 1000, y: 500 },
            manualMid: true,
            labelMode: "hidden",
            max: 100000
          }
        ],
        scenario: {}
      });
    });
    await page.evaluate(() => window.__AFV_TEST__.fit());
    await settle(page);

    await expect(page.locator(".connector-label[data-connector-id='labelObstacle']")).toHaveAttribute("data-label-repaired", "false");
    const d = await page.locator(".connector-draw[data-connector-id='detourRoute']").getAttribute("d");
    const lineCommands = d?.match(/\bL/g) || [];
    expect(lineCommands.length).toBeGreaterThanOrEqual(4);
    const violations = await geometryViolations(page);
    expect(violations, JSON.stringify(summarizeViolations([{ templateId: "detour-label", violations }]))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("boundary ports keep a legal corridor when the outward stub collapses", async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        name: "Boundary port corridor fixture",
        items: [
          {
            id: "source",
            type: "finance",
            visual: "card",
            category: "brokerage",
            financeId: "source",
            label: "Edge Source",
            subtitle: "Brokerage",
            note: "",
            x: 4690,
            y: 520,
            w: 220,
            h: 132,
            zIndex: 10,
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
            x: 4200,
            y: 520,
            w: 220,
            h: 132,
            zIndex: 10,
            style: {}
          }
        ],
        groups: [],
        financeData: {
          source: { category: "brokerage", value: 500000, capacity: 1000000, baseValue: 500000 },
          target: { category: "brokerage", value: 200000, capacity: 600000, baseValue: 200000 }
        },
        connectors: [
          {
            id: "edgeRoute",
            label: "Transfer",
            flowType: "transfer",
            amount: 50000,
            source: { itemId: "source", offsetX: 110, offsetY: 0 },
            target: { itemId: "target", offsetX: -110, offsetY: 0 },
            routeStyle: "straight",
            strokeStyle: "solid",
            colorMode: "teal",
            widthMode: "amount",
            arrowEnd: "arrow",
            labelMode: "hidden",
            max: 100000
          }
        ],
        scenario: {}
      });
    });
    await page.evaluate(() => window.__AFV_TEST__.fit());
    await settle(page);

    const violations = await geometryViolations(page);
    const endpointInteriorHits = await page.evaluate(() => {
      const state = window.__AFV_TEST__.getState();
      const source = state.items.find((item) => item.id === "source");
      const path = document.querySelector(".connector-hit[data-connector-id='edgeRoute']");
      if (!source || !path || typeof path.getTotalLength !== "function") return ["missing boundary fixture"];
      const rect = {
        left: source.x - source.w / 2 + 6,
        right: source.x + source.w / 2 - 6,
        top: source.y - source.h / 2 + 6,
        bottom: source.y + source.h / 2 - 6
      };
      const legalBandLeft = source.x + source.w / 2 - 16;
      const length = path.getTotalLength();
      const hits = [];
      for (let index = 1; index < 120; index += 1) {
        const point = path.getPointAtLength((length * index) / 120);
        const insideSource = point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
        const insideLegalBand = point.x >= legalBandLeft;
        if (insideSource && !insideLegalBand) hits.push(`${Math.round(point.x)},${Math.round(point.y)}`);
      }
      return hits;
    });
    expect(endpointInteriorHits).toEqual([]);
    expect(violations, JSON.stringify(summarizeViolations([{ templateId: "boundary", violations }]))).toEqual([]);
    expect(errors).toEqual([]);
  });
});
