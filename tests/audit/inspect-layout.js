/**
 * Layout stress audit. Run with: node tests/audit/inspect-layout.js
 * Outputs ranked findings and marked screenshots under tests/audit/screenshots/layout/.
 * Governor and strict visual-law issues exit nonzero by default. Add --strict
 * to also exit nonzero for legacy connector/chrome findings.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { startAuditServer } = require("./server");

const OUT = path.join(__dirname, "screenshots", "layout");
const STRICT = process.argv.includes("--strict");
const TEMPLATES = [
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
const THEMES = ["stewardship", "horizon", "camino"];
const VIEWPORTS = [
  { name: "1366", width: 1366, height: 768 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 }
];

function safeName(value) {
  return String(value).replace(/[^a-z0-9-]+/gi, "-");
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function openCase(page, serverUrl, templateId, themeId) {
  await page.goto(serverUrl);
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
  await page.evaluate((id) => window.__AFV_TEST__.setTheme(id), themeId);
  await page.waitForSelector(`body[data-theme="${themeId}"]`);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.locator("#fitButton").click();
  await page.evaluate(() => document.fonts?.ready);
  await settle(page);
}

async function selectAuditState(page, stateName) {
  if (stateName === "presentation") {
    await page.locator("#presentationButton").click();
    await page.waitForFunction(() => document.body.classList.contains("presentation-ready"));
    await settle(page);
    return true;
  }

  if (stateName === "item-popover") {
    const id = await page.evaluate(() => window.__AFV_TEST__.getState().items.find((item) => item.type === "finance")?.id || null);
    if (!id) return false;
    await page.evaluate((itemId) => {
      window.__AFV_TEST__.select("item", itemId);
      window.__AFV_TEST__.openPopover("selection-data");
    }, id);
    await settle(page);
    return true;
  }

  if (stateName === "connector-popover") {
    const id = await page.evaluate(() => (
      window.__AFV_TEST__.getState().connectors.find((connector) => connector.visible !== false)?.id || null
    ));
    if (!id) return false;
    await page.evaluate((connectorId) => {
      window.__AFV_TEST__.select("connector", connectorId);
      window.__AFV_TEST__.openPopover("connector-data");
    }, id);
    await settle(page);
    return true;
  }

  await page.evaluate(() => window.__AFV_TEST__.clearSelection());
  await settle(page);
  return true;
}

async function collectFindings(page, meta) {
  return page.evaluate((auditMeta) => {
    const findings = [];
    const state = window.__AFV_TEST__.getState();
    const diagnostics = window.__AFV_TEST__.getDiagnostics?.() || {};
    const governorIssues = Array.isArray(diagnostics.layoutIssues) ? diagnostics.layoutIssues : null;
    const connectorMap = new Map((state.connectors || []).map((connector) => [connector.id, connector]));
    const GOVERNOR_TYPES = new Set([
      "hard-overlap",
      "reserved-zone",
      "label-overlap",
      "duplicate-stack",
      "connector-label-overlap",
      "offscreen-object",
      "flow-object",
      "flow-text",
      "flow-label",
      "label-object",
      "label-text",
      "chrome-object",
      "chrome-label",
      "sleeve-clipped"
    ]);
    const GOVERNOR_SEVERITY = {
      "reserved-zone": 10000,
      "hard-overlap": 9000,
      "duplicate-stack": 8200,
      "connector-label-overlap": 7600,
      "label-overlap": 7200,
      "offscreen-object": 6800,
      "chrome-object": 9800,
      "chrome-label": 9700,
      "flow-object": 9600,
      "flow-text": 9500,
      "sleeve-clipped": 9400,
      "flow-label": 9300,
      "label-object": 9200,
      "label-text": 9100
    };
    const STRICT_VISUAL_LAW_TYPES = new Set([
      "flow-object",
      "flow-text",
      "flow-label",
      "label-object",
      "label-text",
      "chrome-object",
      "chrome-label",
      "sleeve-clipped"
    ]);

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

    function overlapArea(a, b, pad = 0) {
      const left = Math.max(a.left - pad, b.left);
      const right = Math.min(a.right + pad, b.right);
      const top = Math.max(a.top - pad, b.top);
      const bottom = Math.min(a.bottom + pad, b.bottom);
      return Math.max(0, right - left) * Math.max(0, bottom - top);
    }

    function endpointToken(endpoint) {
      if (endpoint?.itemId) return `node:${endpoint.itemId}`;
      return `free:${Math.round(Number(endpoint?.x) || 0)}:${Math.round(Number(endpoint?.y) || 0)}`;
    }

    function shareEndpoint(a, b) {
      const aTokens = new Set([endpointToken(a.source), endpointToken(a.target)]);
      return [endpointToken(b.source), endpointToken(b.target)].some((token) => aTokens.has(token));
    }

    function findingKey(type, ids) {
      return `${type}:${(ids || []).join("\u001f")}`;
    }

    function hasFinding(type, ids) {
      const key = findingKey(type, ids);
      return findings.some((finding) => findingKey(finding.type, finding.ids) === key);
    }

    function add(type, severity, message, ids, evidence = {}) {
      findings.push({ ...auditMeta, type, severity, message, ids, evidence });
    }

    function addStrict(type, severity, message, ids, evidence = {}) {
      if (hasFinding(type, ids)) return;
      add(type, severity, message, ids, evidence);
    }

    function governorMessage(issue) {
      const ids = Array.isArray(issue.ids) ? issue.ids : [];
      const [first = "object", second = "object"] = ids;
      const area = Number.isFinite(Number(issue.area)) && Number(issue.area) > 0 ? ` (${Math.round(Number(issue.area))}px overlap)` : "";
      switch (issue.type) {
        case "hard-overlap":
          return `${first} overlaps ${second} beyond governor tolerance${area}`;
        case "reserved-zone":
          return `${first} intrudes into reserved zone ${second}${area}`;
        case "label-overlap":
          return `${first} label overlaps ${second} text${area}`;
        case "duplicate-stack":
          return `${first} is stacked on duplicate ${second}${area}`;
        case "connector-label-overlap":
          return `${first} connector label overlaps ${second} text${area}`;
        case "offscreen-object":
          return `${first} is outside the canvas bounds`;
        case "flow-object":
          return `${first} connector path runs under ${second}${area}`;
        case "flow-text":
          return `${first} connector path crosses text in ${second}${area}`;
        case "flow-label":
          return `${first} connector path crosses ${second} label${area}`;
        case "label-object":
          return `${first} label overlaps ${second}${area}`;
        case "label-text":
          return `${first} label overlaps text in ${second}${area}`;
        case "chrome-object":
          return `Selection chrome overlaps ${second}${area}`;
        case "chrome-label":
          return `Selection chrome overlaps ${second} label${area}`;
        case "sleeve-clipped":
          return `${first} sleeve content is clipped${area}`;
        default:
          return `${issue.type || "layout"} governor issue${ids.length ? `: ${ids.join(" / ")}` : ""}${area}`;
      }
    }

    function addGovernorFindings() {
      if (!governorIssues) return;
      governorIssues
        .filter((issue) => GOVERNOR_TYPES.has(issue?.type))
        .forEach((issue) => {
          const ids = Array.isArray(issue.ids) ? issue.ids : [];
          const base = GOVERNOR_SEVERITY[issue.type] || 6000;
          const area = Math.max(0, Number(issue.area) || 0);
          add(issue.type, base + Math.min(999, Math.round(area / 10)), governorMessage(issue), ids, {
            source: "governor",
            governorIssue: issue
          });
          findings[findings.length - 1].source = "governor";
        });
    }

    function strictSeverity(type, rawSeverity, signal = 0) {
      if (!STRICT_VISUAL_LAW_TYPES.has(type)) return rawSeverity;
      const base = GOVERNOR_SEVERITY[type] || 9000;
      return base + Math.min(999, Math.round(signal));
    }

    function pathSamples(path) {
      const length = path.getTotalLength();
      const matrix = path.getScreenCTM();
      const steps = Math.max(20, Math.min(80, Math.ceil(length / 18)));
      const samples = [];
      for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        const raw = path.getPointAtLength(length * t);
        samples.push({
          x: raw.x * matrix.a + raw.y * matrix.c + matrix.e,
          y: raw.x * matrix.b + raw.y * matrix.d + matrix.f,
          t
        });
      }
      return {
        id: path.getAttribute("data-connector-id"),
        stroke: Number.parseFloat(getComputedStyle(path).strokeWidth) || 4,
        samples
      };
    }

    const objects = [...document.querySelectorAll(".canvas-item.item-finance, .canvas-group")].map((node) => rectFor(node, node.dataset.itemId || node.dataset.groupId, node.classList.contains("canvas-group") ? "group" : "item"));
    const labels = [...document.querySelectorAll(".connector-label")].map((node) => rectFor(node, node.dataset.connectorId, "label"));
    const textSurfaces = [...document.querySelectorAll([
      ".canvas-item .finance-name",
      ".canvas-item .finance-type",
      ".canvas-item .finance-note",
      ".canvas-item .finance-value",
      ".canvas-item .paycheck-amount",
      ".canvas-item .cashflow-row",
      ".canvas-item .annuity-contract-readout",
      ".canvas-item .product-meta-grid",
      ".canvas-item .sub-bucket-card",
      ".canvas-item .shape-kicker",
      ".canvas-item .shape-label",
      ".canvas-item .shape-note",
      ".canvas-item .text-main",
      ".canvas-item .text-sub"
    ].join(","))]
      .filter((node) => (node.textContent || "").trim())
      .map((node) => ({
        ...rectFor(node, node.closest(".canvas-item")?.dataset.itemId || node.textContent.trim(), "text"),
        ownerId: node.closest(".canvas-item")?.dataset.itemId || null
      }))
      .filter((rect) => rect.width > 4 && rect.height > 4);
    const flows = [...document.querySelectorAll(".connector-draw[data-connector-id]")].map(pathSamples);
    const chrome = [...document.querySelectorAll(".selection-toolbar, .selection-popover, .selection-inspector")].map((node) => rectFor(
      node,
      node.dataset.popoverKind || node.dataset.inspectorSection || "selection-toolbar",
      node.classList.contains("selection-inspector") ? "inspector" : node.classList.contains("selection-popover") ? "popover" : "toolbar"
    ));
    const rail = document.querySelector("#scenarioRail");
    const dock = document.querySelector(".canvas-dock");
    const railRect = rail ? rectFor(rail, "scenarioRail", "rail") : null;
    const dockRect = dock ? rectFor(dock, "canvasDock", "dock") : null;

    addGovernorFindings();

    if (!governorIssues) {
      for (let i = 0; i < objects.length; i += 1) {
        for (let j = i + 1; j < objects.length; j += 1) {
          const area = overlapArea(objects[i], objects[j], -4);
          if (area > 60) add("item-item", Math.round(area), `${objects[i].id} overlaps ${objects[j].id}`, [objects[i].id, objects[j].id], { rects: [objects[i], objects[j]], area });
        }
      }

      for (let i = 0; i < labels.length; i += 1) {
        for (let j = i + 1; j < labels.length; j += 1) {
          const area = overlapArea(labels[i], labels[j], -2);
          if (area > 24) add("label-label", Math.round(area), `${labels[i].id} label overlaps ${labels[j].id}`, [labels[i].id, labels[j].id], { rects: [labels[i], labels[j]], area });
        }
      }
    }

    labels.forEach((label) => {
      objects.forEach((object) => {
        const area = overlapArea(label, object, -3);
        if (area > 24) addStrict("label-object", strictSeverity("label-object", Math.round(area), area / 10), `${label.id} label overlaps ${object.id}`, [label.id, object.id], { rects: [label, object], area });
      });
      textSurfaces.forEach((textRect) => {
        const area = overlapArea(label, textRect, -2);
        if (area > 18) addStrict("label-text", strictSeverity("label-text", Math.round(area), area / 10), `${label.id} label overlaps text in ${textRect.id}`, [label.id, textRect.id], { rects: [label, textRect], area });
      });
    });

    for (let i = 0; i < flows.length; i += 1) {
      for (let j = i + 1; j < flows.length; j += 1) {
        const connA = connectorMap.get(flows[i].id) || {};
        const connB = connectorMap.get(flows[j].id) || {};
        const shared = shareEndpoint(connA, connB);
        const threshold = Math.max(10, (flows[i].stroke + flows[j].stroke) / 2 + 7);
        let close = 0;
        let minDistance = Infinity;
        let point = null;
        flows[i].samples.forEach((a) => {
          flows[j].samples.forEach((b) => {
            if (shared && (a.t < 0.12 || a.t > 0.88) && (b.t < 0.12 || b.t > 0.88)) return;
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            if (distance < minDistance) {
              minDistance = distance;
              point = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            }
            if (distance < threshold) close += 1;
          });
        });
        if (close >= 5) add("flow-flow", close * 20, `${flows[i].id} runs too close to ${flows[j].id}`, [flows[i].id, flows[j].id], { points: [point], close, minDistance });
      }
    }

    flows.forEach((flow) => {
      labels.forEach((label) => {
        if (flow.id === label.id) return;
        const inflated = { ...label, left: label.left - 4, right: label.right + 4, top: label.top - 4, bottom: label.bottom + 4 };
        const hits = flow.samples.filter((sample) => sample.x >= inflated.left && sample.x <= inflated.right && sample.y >= inflated.top && sample.y <= inflated.bottom);
        if (hits.length >= 3) addStrict("flow-label", strictSeverity("flow-label", hits.length * 30, hits.length * 20), `${flow.id} crosses ${label.id} label`, [flow.id, label.id], { rects: [label], points: [hits[Math.floor(hits.length / 2)]], hits: hits.length });
      });
    });

    flows.forEach((flow) => {
      const connector = connectorMap.get(flow.id) || {};
      textSurfaces.forEach((textRect) => {
        const isSource = textRect.ownerId === connector.source?.itemId;
        const isTarget = textRect.ownerId === connector.target?.itemId;
        const inflated = { ...textRect, left: textRect.left - 3, right: textRect.right + 3, top: textRect.top - 3, bottom: textRect.bottom + 3 };
        const hits = flow.samples.filter((sample) => {
          if (isSource && sample.t <= 0.025) return false;
          if (isTarget && sample.t >= 0.975) return false;
          return sample.x >= inflated.left &&
            sample.x <= inflated.right &&
            sample.y >= inflated.top &&
            sample.y <= inflated.bottom;
        });
        if (hits.length >= 2) {
          addStrict("flow-text", strictSeverity("flow-text", hits.length * 50, hits.length * 20), `${flow.id} crosses text in ${textRect.id}`, [flow.id, textRect.id], {
            rects: [textRect],
            points: [hits[Math.floor(hits.length / 2)]],
            hits
          });
        }
      });
    });

    flows.forEach((flow) => {
      const connector = connectorMap.get(flow.id) || {};
      objects.forEach((object) => {
        const isSource = object.id === connector.source?.itemId;
        const isTarget = object.id === connector.target?.itemId;
        const inset = 6;
        const hits = flow.samples.filter((sample) => {
          if (isSource && sample.t <= 0.025) return false;
          if (isTarget && sample.t >= 0.975) return false;
          return sample.x >= object.left + inset &&
            sample.x <= object.right - inset &&
            sample.y >= object.top + inset &&
            sample.y <= object.bottom - inset;
        });
        if (hits.length >= 2) {
          addStrict("flow-object", strictSeverity("flow-object", hits.length * 45, hits.length * 20), `${flow.id} runs under ${object.id}`, [flow.id, object.id], {
            rects: [object],
            points: [hits[Math.floor(hits.length / 2)]],
            hits
          });
        }
      });
    });

    [...objects, ...labels].forEach((target) => {
      [railRect, dockRect].filter(Boolean).forEach((entry) => {
        const area = overlapArea(target, entry, -4);
        if (area > 20) add("dock-rail", Math.round(area), `${target.id} overlaps ${entry.id}`, [target.id, entry.id], { rects: [target, entry], area });
      });
    });

    chrome.forEach((chromeRect) => {
      [...objects, ...labels].forEach((target) => {
        const area = overlapArea(chromeRect, target, -4);
        if (area > 40) {
          const type = target.kind === "label" ? "chrome-label" : "chrome-object";
          addStrict(type, strictSeverity(type, Math.round(area), area / 10), `${chromeRect.kind} overlaps ${target.id}`, [chromeRect.id, target.id], { rects: [chromeRect, target], area });
        }
      });
    });

    [...document.querySelectorAll(".sub-bucket-card")].forEach((node) => {
      const owner = node.closest(".canvas-item");
      const container = node.closest(".sub-bucket-stack, .canvas-item");
      if (!owner || !container) return;
      const sleeve = rectFor(node, node.textContent.trim() || owner.dataset.itemId || "sleeve", "sleeve");
      const boundary = rectFor(container, owner.dataset.itemId || "container", "container");
      const clippedX = sleeve.left < boundary.left - 1 || sleeve.right > boundary.right + 1;
      const clippedY = sleeve.top < boundary.top - 1 || sleeve.bottom > boundary.bottom + 1;
      if (clippedX || clippedY) {
        addStrict("sleeve-clipped", strictSeverity("sleeve-clipped", 0, Math.max(
          boundary.left - sleeve.left,
          sleeve.right - boundary.right,
          boundary.top - sleeve.top,
          sleeve.bottom - boundary.bottom,
          1
        ) * 10), `${owner.dataset.itemId || "sleeve"} sleeve content is clipped`, [owner.dataset.itemId || "sleeve"], { rects: [sleeve, boundary] });
      }
    });

    return findings;
  }, meta);
}

async function markFindings(page, findings) {
  await page.evaluate((entries) => {
    document.querySelector("[data-layout-audit-overlay]")?.remove();
    const overlay = document.createElement("div");
    overlay.dataset.layoutAuditOverlay = "true";
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;";
    entries.slice(0, 12).forEach((finding) => {
      (finding.evidence?.rects || []).forEach((rect) => {
        const box = document.createElement("div");
        box.style.cssText = [
          "position:fixed",
          `left:${rect.left}px`,
          `top:${rect.top}px`,
          `width:${rect.width}px`,
          `height:${rect.height}px`,
          "border:2px solid #d13f2f",
          "background:rgba(209,63,47,0.08)",
          "box-sizing:border-box"
        ].join(";");
        overlay.appendChild(box);
      });
      (finding.evidence?.points || []).forEach((point) => {
        if (!point) return;
        const dot = document.createElement("div");
        dot.style.cssText = [
          "position:fixed",
          `left:${point.x - 6}px`,
          `top:${point.y - 6}px`,
          "width:12px",
          "height:12px",
          "border-radius:50%",
          "background:#d13f2f",
          "box-shadow:0 0 0 4px rgba(209,63,47,0.2)"
        ].join(";");
        overlay.appendChild(dot);
      });
    });
    document.body.appendChild(overlay);
  }, findings);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startAuditServer();
  const browser = await chromium.launch();
  const allFindings = [];

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    for (const templateId of TEMPLATES) {
      for (const themeId of THEMES) {
        await openCase(page, server.url, templateId, themeId);
        for (const stateName of ["default", "item-popover", "connector-popover", "presentation"]) {
          const ready = await selectAuditState(page, stateName);
          if (!ready) continue;
          const meta = { templateId, themeId, viewport: viewport.name, state: stateName };
          const findings = await collectFindings(page, meta);
          if (findings.length) {
            await markFindings(page, findings);
            const screenshotName = `${safeName(templateId)}-${safeName(themeId)}-${safeName(viewport.name)}-${safeName(stateName)}.png`;
            await page.screenshot({ path: path.join(OUT, screenshotName), fullPage: true });
            findings.forEach((finding) => { finding.screenshot = screenshotName; });
            allFindings.push(...findings);
          }
        }
      }
    }

    if (errors.length) {
      allFindings.push(...errors.map((message) => ({
        templateId: "runtime",
        themeId: "runtime",
        viewport: viewport.name,
        state: "runtime",
        type: "console",
        severity: 9999,
        message,
        ids: []
      })));
    }

    await context.close();
  }

  await browser.close();
  await server.stop();

  allFindings.sort((a, b) => b.severity - a.severity);
  const jsonPath = path.join(OUT, "layout-findings.json");
  fs.writeFileSync(jsonPath, JSON.stringify(allFindings, null, 2));

  if (!allFindings.length) {
    console.log("No layout stress findings.");
    return;
  }

  console.log(`Layout stress findings: ${allFindings.length}`);
  console.table(allFindings.slice(0, 25).map((finding) => ({
    severity: finding.severity,
    type: finding.type,
    template: finding.templateId,
    theme: finding.themeId,
    viewport: finding.viewport,
    state: finding.state,
    message: finding.message,
    screenshot: finding.screenshot || ""
  })));
  console.log(`Full report: ${jsonPath}`);

  const strictVisualLawTypes = new Set([
    "flow-object",
    "flow-text",
    "flow-label",
    "label-object",
    "label-text",
    "chrome-object",
    "chrome-label",
    "sleeve-clipped"
  ]);
  if (
    STRICT ||
    allFindings.some((finding) => finding.source === "governor" || strictVisualLawTypes.has(finding.type))
  ) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
