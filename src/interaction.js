import { state, dom, WORLD, clone, commitHistory, clearHistory, historySnapshot, commitHistoryFrom, restoreHistorySnapshot, escapeHtml, parseMoney, formatMoneyInput, plainMoneyInput, clamp, endpoint, cloneEndpoint, isAttachedEndpoint, isFreeEndpoint, getItem, getGroup, getConnector, getNode, getAnchorableNodes, selectedItemIds, hasMultiSelection, itemIsSelected, isLockedNode, clearMultiSelection, setSingleSelection, isFormField, isPresentationMode, nextZIndex, accountCategories, defaultScenario, routeStyles } from "./state.js";
import { shapePalette, textPalette, financePalette, groupPalette, connectorPalette, connectorDefaults, connector, groupBox } from "./templates.js";
import { syncComputedValues, computeConnectorPath, pointFromEvent, visibleWorldCenter, screenPoint, resolveEndpoint, rawEndpoint, computeConnectorWidth, getConnectorColor, markerUrl, connectorHasManualAmount, scenarioAmountForConnector, connectorDisplayAmount, connectorStoredAmountFromDisplay } from "./compute.js";
import { renderAll, renderCanvasSurface, renderCanvasOnly, renderItems, renderConnectors, renderHud, updateItemValues, updateConnectorValues, updateScenarioReadouts, nodeScreenBounds, relativeRect, selectionKey, findSubBucket } from "./render.js";
import { renderViewport, fitView, scheduleViewportSettle, settleViewport } from "./viewport.js";
import { findClearPlacement, placementQuality, repairPresentationLayout, tidyLayout } from "./layoutQuality.js";
import { resolvePortPoint } from "./canvasGeometry.js";

const EDGE_CONNECTOR_ZONE_PX = 24;
const EDGE_CONNECTOR_INTENT_PX = 8;
const EDGE_CONNECTOR_SNAP_RADIUS = 92;
// Edge-connector drops only commit onto a node the pointer actually reaches: the
// hit-test (connectorNodeFromClientPoint) covers the node body, and this small
// border tolerance covers the immediate rim. A wide fallback radius (the old
// EDGE_CONNECTOR_SNAP_RADIUS) let an ordinary reposition nudge near an edge latch
// onto a neighbouring tile across an empty gap, fabricating duplicate flows.
const EDGE_CONNECTOR_TARGET_RADIUS = 16;
const EDGE_PIN_SNAP_RADIUS = 82;
const EDGE_PIN_INSET = 16;
const PINNED_ENDPOINT_PORTS = {
  card: ["left.in", "right.out", "top.in", "bottom.out"],
  bucket: ["left.in", "right.out", "top.in", "bottom.reserve"],
  cylinder: ["left.in", "right.out", "top.in", "bottom.reserve"],
  policy: ["left.funding", "right.payout", "top.review", "bottom.reserve"],
  trust: ["left.funding", "right.lifestyle", "right.legacy", "right.charitable", "bottom.admin", "top.review"],
  paycheck: ["left.income", "right.household", "bottom.gap", "top.need"],
  household: ["left.in", "right.out", "top.in", "bottom.out"],
  amountTag: ["left.in", "right.out"],
  taxTag: ["left.in", "right.out"],
  text: ["left.in", "right.out"],
  shape: ["left.in", "right.out", "top.in", "bottom.out"]
};
const SOURCE_PORT_SLOTS = new Set(["out", "payout", "household", "legacy", "lifestyle", "charitable"]);
const TARGET_PORT_SLOTS = new Set(["in", "income", "funding", "need", "gap"]);
const flowTypePresets = {
  transfer: { routeStyle: "smartArc", strokeStyle: "solid", colorMode: "flow", arrowStart: "none", arrowEnd: "arrow", widthMode: "amount" },
  rollover: { routeStyle: "smartArc", strokeStyle: "solid", colorMode: "flow", arrowStart: "none", arrowEnd: "chevron", widthMode: "amount" },
  income: { routeStyle: "smartArc", strokeStyle: "longDash", colorMode: "flow", arrowStart: "none", arrowEnd: "arrow", widthMode: "amount" },
  annuity: { routeStyle: "smartArc", strokeStyle: "longDash", colorMode: "flow", arrowStart: "none", arrowEnd: "diamond", widthMode: "medium" },
  roth: { routeStyle: "sCurve", strokeStyle: "fineDash", colorMode: "flow", arrowStart: "none", arrowEnd: "arrow", widthMode: "amount" },
  tax: { routeStyle: "smartArc", strokeStyle: "fineDash", colorMode: "red", arrowStart: "none", arrowEnd: "arrow", widthMode: "medium" },
  rmd: { routeStyle: "smartArc", strokeStyle: "longDash", colorMode: "flow", arrowStart: "none", arrowEnd: "arrow", widthMode: "amount" },
  qcd: { routeStyle: "smartArc", strokeStyle: "dotted", colorMode: "flow", arrowStart: "none", arrowEnd: "diamond", widthMode: "medium" },
  fee: { routeStyle: "smartArc", strokeStyle: "fineDash", colorMode: "red", arrowStart: "none", arrowEnd: "none", widthMode: "subtle" },
  rebalance: { routeStyle: "sCurve", strokeStyle: "longDash", colorMode: "flow", arrowStart: "none", arrowEnd: "chevron", widthMode: "medium" },
  beneficiary: { routeStyle: "smartArc", strokeStyle: "dotted", colorMode: "flow", arrowStart: "none", arrowEnd: "diamond", widthMode: "amount" }
};

let activePointerCapture = null;
let interactionChromeFrame = null;
let interactionChromeFrameStartedAt = 0;
let pendingInteractionConnectorIds = null;
let hotClearTimer = null;

function cssIdent(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value ?? ""));
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

function clearTextSelection() {
  window.getSelection?.()?.removeAllRanges?.();
}

function resetDragDiagnostics() {
  state.inputDiagnostics.dragFrameCount = 0;
  state.inputDiagnostics.totalDragFrameMs = 0;
  state.inputDiagnostics.maxDragFrameMs = 0;
  state.inputDiagnostics.averageDragFrameMs = 0;
  state.inputDiagnostics.connectorPathComputesDuringDrag = 0;
  state.inputDiagnostics.impactedConnectorCount = 0;
  state.inputDiagnostics.impactedConnectorIdsDuringDrag = [];
  state.inputDiagnostics.updatedConnectorIdsDuringDrag = [];
  state.inputDiagnostics.fullConnectorPassesDuringDrag = 0;
  state.inputDiagnostics.fullRenderDuringDrag = 0;
  state.inputDiagnostics.finalConnectorPassesAfterDrop = 0;
}

function setDragPerformanceActive(active) {
  document.body.classList.toggle("drag-performance", Boolean(active));
}

function isActiveTextEditTarget(node) {
  return Boolean(node?.closest?.("input, textarea, select"));
}

function idsForMovingNode(kind, node) {
  if (!node) return new Set();
  return ignoreIdsForMovingNode(kind, node);
}

function connectorIdsForMovingNode(kind, node) {
  const nodeIds = idsForMovingNode(kind, node);
  return state.connectors
    .filter((conn) => nodeIds.has(conn.source?.itemId) || nodeIds.has(conn.target?.itemId))
    .map((conn) => conn.id);
}

function connectorIdsForCurrentInteraction() {
  const interaction = state.interaction;
  if (!interaction) return [];
  if (interaction.type === "drag-node" || interaction.type === "resize-node") {
    const node = interaction.kind === "item" ? getItem(interaction.id) : getGroup(interaction.id);
    return connectorIdsForMovingNode(interaction.kind, node);
  }
  if (interaction.type === "drag-connector" || interaction.type === "drag-connector-body") {
    return interaction.connectorId ? [interaction.connectorId] : [];
  }
  return [];
}

function mergePendingConnectorIds(connectorIds) {
  const ids = connectorIds == null ? connectorIdsForCurrentInteraction() : connectorIds;
  if (!pendingInteractionConnectorIds) pendingInteractionConnectorIds = new Set();
  Array.from(ids || []).forEach((id) => {
    if (id) pendingInteractionConnectorIds.add(id);
  });
}

function scheduleHotStateClear(duration = 520) {
  if (hotClearTimer) window.clearTimeout(hotClearTimer);
  hotClearTimer = window.setTimeout(() => {
    hotClearTimer = null;
    state.hotConnectorIds = new Set();
    state.hotItemIds = new Set();
    updateItemValues();
    updateConnectorValues({ geometry: false });
    updateScenarioReadouts();
  }, duration);
}

function setHotStateForConnectors(connectors, duration = 520) {
  if (hotClearTimer) {
    window.clearTimeout(hotClearTimer);
    hotClearTimer = null;
  }
  state.hotConnectorIds = new Set(connectors.map((conn) => conn.id));
  state.hotItemIds = new Set(connectors.flatMap((conn) => [conn.source?.itemId, conn.target?.itemId]).filter(Boolean));
  scheduleHotStateClear(duration);
}

function refreshSelectionToolbar() {
  // Floating selection chrome is intentionally disabled; the inspector owns edits.
}

function scheduleInspectorFitIfOpening(wasInspectorOpen) {
  if (wasInspectorOpen) return;
  requestAnimationFrame(() => {
    if (state.activeDock === "select" && document.body.classList.contains("inspector-open")) {
      fitView();
    }
  });
}

function updateInteractionChromeNow() {
  interactionChromeFrame = null;
  const startedAt = performance.now();
  const connectorIds = pendingInteractionConnectorIds ? [...pendingInteractionConnectorIds] : connectorIdsForCurrentInteraction();
  pendingInteractionConnectorIds = null;
  updateConnectorValues({ connectorIds });
  refreshSelectionToolbar();
  const elapsed = performance.now() - startedAt;
  state.inputDiagnostics.lastInteractionFrameMs = elapsed;
  if (["drag-node", "resize-node", "drag-connector", "drag-connector-body"].includes(state.interaction?.type)) {
    state.inputDiagnostics.dragFrameCount += 1;
    state.inputDiagnostics.totalDragFrameMs += elapsed;
    state.inputDiagnostics.maxDragFrameMs = Math.max(state.inputDiagnostics.maxDragFrameMs, elapsed);
    state.inputDiagnostics.averageDragFrameMs = state.inputDiagnostics.totalDragFrameMs / Math.max(1, state.inputDiagnostics.dragFrameCount);
  }
}

function scheduleInteractionChromeUpdate(connectorIds = null) {
  mergePendingConnectorIds(connectorIds);
  if (interactionChromeFrame) return;
  state.inputDiagnostics.scheduledInteractionFrames += 1;
  interactionChromeFrameStartedAt = performance.now();
  interactionChromeFrame = requestAnimationFrame(() => {
    updateInteractionChromeNow();
    state.inputDiagnostics.lastInteractionFrameMs = Math.max(
      state.inputDiagnostics.lastInteractionFrameMs,
      performance.now() - interactionChromeFrameStartedAt
    );
  });
}

function flushInteractionChromeUpdate() {
  if (!interactionChromeFrame) return;
  cancelAnimationFrame(interactionChromeFrame);
  updateInteractionChromeNow();
}

function cancelInteractionChromeUpdate() {
  if (!interactionChromeFrame) return;
  cancelAnimationFrame(interactionChromeFrame);
  interactionChromeFrame = null;
  pendingInteractionConnectorIds = null;
}

function releasePointerCapture() {
  if (!activePointerCapture) return;
  const { target, pointerId } = activePointerCapture;
  activePointerCapture = null;
  target?.removeEventListener?.("lostpointercapture", cancelPointerInteraction);
  try {
    if (target?.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
  } catch {
    // Capture may already be gone after pointer cancellation.
  }
}

function beginInteractionPointer(event, captureTarget = event?.target) {
  clearTextSelection();
  releasePointerCapture();
  if (captureTarget?.setPointerCapture && event?.pointerId !== undefined) {
    try {
      captureTarget.setPointerCapture(event.pointerId);
      activePointerCapture = { target: captureTarget, pointerId: event.pointerId };
      captureTarget.addEventListener("lostpointercapture", cancelPointerInteraction);
    } catch {
      activePointerCapture = null;
    }
  }
  document.addEventListener("pointermove", handleInteractionMove);
  document.addEventListener("pointerup", endInteraction);
  document.addEventListener("pointercancel", cancelPointerInteraction);
  window.addEventListener("blur", cancelPointerInteraction);
}

function endInteractionPointer() {
  releasePointerCapture();
  document.removeEventListener("pointermove", handleInteractionMove);
  document.removeEventListener("pointerup", endInteraction);
  document.removeEventListener("pointercancel", cancelPointerInteraction);
  window.removeEventListener("blur", cancelPointerInteraction);
  clearTextSelection();
}

function cancelPointerInteraction() {
  cancelInteraction({ restore: true });
}

function nearestClearConnectorPoint(point, conn, pad = 14) {
  if (!conn) return point;
  const sourceId = conn.source?.itemId;
  const targetId = conn.target?.itemId;
  const blocked = getAnchorableNodes().filter((node) => node.id !== sourceId && node.id !== targetId);
  const inside = (candidate, node) => (
    candidate.x > node.x - node.w / 2 - pad &&
    candidate.x < node.x + node.w / 2 + pad &&
    candidate.y > node.y - node.h / 2 - pad &&
    candidate.y < node.y + node.h / 2 + pad
  );
  const blocker = blocked.find((node) => inside(point, node));
  if (!blocker) return point;
  const candidates = [
    { x: blocker.x - blocker.w / 2 - pad, y: point.y },
    { x: blocker.x + blocker.w / 2 + pad, y: point.y },
    { x: point.x, y: blocker.y - blocker.h / 2 - pad },
    { x: point.x, y: blocker.y + blocker.h / 2 + pad }
  ]
    .map((candidate) => ({
      x: clamp(candidate.x, 0, WORLD.width),
      y: clamp(candidate.y, 0, WORLD.height)
    }))
    .filter((candidate) => !blocked.some((node) => inside(candidate, node)));

  if (!candidates.length) return point;
  return candidates.sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
}

const CREATION_DOCK_KIND = {
  shapes: "shape",
  text: "text",
  finance: "finance",
  connectors: "connector",
  groups: "group"
};

const DOCK_FOR_KIND = {
  shape: "shapes",
  text: "text",
  finance: "finance",
  connector: "connectors",
  group: "groups"
};

const PLACEMENT_MIN_SIZE = {
  shape: { w: 64, h: 44 },
  text: { w: 92, h: 34 },
  finance: { w: 170, h: 86 },
  group: { w: 190, h: 128 }
};

const PLACEMENT_MAX_SIZE = {
  shape: { w: 920, h: 620 },
  text: { w: 720, h: 260 },
  finance: { w: 560, h: 300 },
  group: { w: 1200, h: 760 }
};

function defaultPaletteId(kind) {
  if (kind === "shape") return shapePalette[0]?.id || null;
  if (kind === "text") return textPalette[0]?.id || null;
  if (kind === "finance") return financePalette[0]?.id || null;
  if (kind === "group") return groupPalette[0]?.id || null;
  if (kind === "connector") return connectorPalette[0]?.id || "smartArc";
  return null;
}

export function isCreationDock(dock = state.activeDock) {
  return Boolean(CREATION_DOCK_KIND[dock]);
}

export function ensureCreationPresetForDock(dock = state.activeDock) {
  const kind = CREATION_DOCK_KIND[dock];
  if (!kind) return null;
  if (state.activeCreationPreset?.kind === kind && paletteById(kind, state.activeCreationPreset.id)) {
    return state.activeCreationPreset;
  }
  const id = defaultPaletteId(kind);
  state.activeCreationPreset = id ? { kind, id } : null;
  return state.activeCreationPreset;
}

export function switchToolDock(dock) {
  state.activeDock = dock || "select";
  state.activePopover = null;
  state.inspectorOpen = false;
  if (isCreationDock(state.activeDock)) ensureCreationPresetForDock(state.activeDock);
  renderAll();
}

export function armCreationPreset(kind, id) {
  if (!paletteById(kind, id)) return false;
  state.activeCreationPreset = { kind, id };
  if (DOCK_FOR_KIND[kind]) state.activeDock = DOCK_FOR_KIND[kind];
  state.activePopover = null;
  state.inspectorOpen = false;
  renderAll();
  return true;
}

function activeCreationChoice() {
  const preset = isCreationDock() ? ensureCreationPresetForDock() : null;
  if (!preset) return null;
  const paletteItem = paletteById(preset.kind, preset.id);
  return paletteItem ? { ...preset, paletteItem } : null;
}

function connectorPresetById(id) {
  return connectorPalette.find((item) => item.id === id) || connectorPalette[0] || null;
}

function connectorStyleForPreset(id) {
  const paletteItem = connectorPresetById(id);
  return {
    routeStyle: paletteItem?.routeStyle || id || "smartArc",
    strokeStyle: paletteItem?.strokeStyle || "solid"
  };
}

function placementBounds(kind, paletteItem, start, point, hasMoved) {
  const min = PLACEMENT_MIN_SIZE[kind] || { w: 72, h: 44 };
  const max = PLACEMENT_MAX_SIZE[kind] || { w: 900, h: 620 };
  let w = clamp(Number(paletteItem.w) || min.w, min.w, max.w);
  let h = clamp(Number(paletteItem.h) || min.h, min.h, max.h);
  let x = start.x;
  let y = start.y;

  if (hasMoved) {
    const left = Math.min(start.x, point.x);
    const right = Math.max(start.x, point.x);
    const top = Math.min(start.y, point.y);
    const bottom = Math.max(start.y, point.y);
    w = clamp(right - left, min.w, max.w);
    h = clamp(bottom - top, min.h, max.h);
    x = start.x <= point.x ? left + w / 2 : right - w / 2;
    y = start.y <= point.y ? top + h / 2 : bottom - h / 2;
  }

  x = clamp(x, w / 2, WORLD.width - w / 2);
  y = clamp(y, h / 2, WORLD.height - h / 2);
  return { x, y, w, h };
}

function placementOptionsForPalette(kind, paletteItem, extra = {}) {
  return {
    kind: kind === "group" ? "group" : "item",
    type: kind === "group" ? "group" : kind,
    shape: paletteItem.shape,
    shapeIntent: paletteItem.shapeIntent,
    style: kind === "text" ? { textStyle: paletteItem.textStyle || "caption" } : {},
    label: paletteItem.label || "New object",
    ...extra
  };
}

function placementOptionsForNode(kind, node, extra = {}) {
  return {
    id: node.id,
    kind: kind === "group" ? "group" : "item",
    type: kind === "group" ? "group" : node.type,
    shape: node.shape,
    shapeIntent: node.shapeIntent,
    style: node.style || {},
    label: node.label || "",
    ...extra
  };
}

function ignoreIdsForMovingNode(kind, node) {
  const ids = new Set([node.id]);
  if (kind === "group") (node.childIds || []).forEach((childId) => ids.add(childId));
  return ids;
}

function moveDraggedNodeTo(kind, node, x, y) {
  const dx = x - node.x;
  const dy = y - node.y;
  node.x = x;
  node.y = y;
  if (kind === "group") {
    (node.childIds || []).forEach((childId) => {
      const child = getItem(childId);
      if (!child) return;
      child.x = clamp(child.x + dx, child.w / 2, WORLD.width - child.w / 2);
      child.y = clamp(child.y + dy, child.h / 2, WORLD.height - child.h / 2);
    });
  }
}

function restoreDraggedNodePosition(interaction) {
  const node = interaction.kind === "item" ? getItem(interaction.id) : getGroup(interaction.id);
  if (!node) return;
  node.x = interaction.original.x;
  node.y = interaction.original.y;
  if (interaction.kind === "group") {
    interaction.childOriginals.forEach((childOriginal) => {
      const child = getItem(childOriginal.id);
      if (!child) return;
      child.x = childOriginal.x;
      child.y = childOriginal.y;
    });
  }
}

function setLayoutFeedback(status, issues = []) {
  const ids = [...new Set(issues.flatMap((issue) => issue.ids || []))].filter(Boolean);
  state.layoutFeedback = status ? { status, ids, issues } : null;
  document.body.classList.toggle("layout-quality-blocked", status === "blocked");
  document.body.classList.toggle("layout-quality-nudged", status === "nudged");
}

function clearLayoutFeedback() {
  state.layoutFeedback = null;
  document.body.classList.remove("layout-quality-blocked", "layout-quality-nudged");
}

function applyPresentationRepairFeedback(options = {}) {
  const repair = repairPresentationLayout(options);
  setLayoutFeedback(repair.issues?.length ? "blocked" : null, repair.issues || []);
  return repair;
}

function removePlacementPreview() {
  dom.itemLayer.querySelector(".placement-ghost")?.remove();
}

function updatePlacementPreview() {
  removePlacementPreview();
  const interaction = state.interaction;
  if (!interaction || interaction.type !== "place-node" || !interaction.hasMoved) return;
  const paletteItem = paletteById(interaction.kind, interaction.presetId);
  if (!paletteItem) return;
  const rawBounds = placementBounds(interaction.kind, paletteItem, interaction.start, interaction.point, true);
  const result = findClearPlacement(rawBounds, placementOptionsForPalette(interaction.kind, paletteItem));
  const bounds = result.bounds;
  const preview = document.createElement("div");
  preview.className = `placement-ghost kind-${interaction.kind} is-${result.status}`;
  preview.dataset.placementState = result.status;
  preview.style.cssText = `--x:${bounds.x}px;--y:${bounds.y}px;--w:${bounds.w}px;--h:${bounds.h}px;--z:999`;
  const statusLabel = result.status === "blocked" ? "No clear space" : result.status === "nudged" ? "Nearest clear space" : paletteItem.label || "New object";
  preview.innerHTML = `<strong>${escapeHtml(statusLabel)}</strong>`;
  dom.itemLayer.appendChild(preview);
  setLayoutFeedback(result.status === "blocked" ? "blocked" : result.status === "nudged" ? "nudged" : null, result.issues || []);
}

function createNodeFromPalette(kind, id, bounds) {
  const paletteItem = paletteById(kind, id);
  if (!paletteItem) return null;

  if (kind === "group") {
    const groupId = `group-${state.nextGroupNumber++}`;
    state.groups.push(groupBox(groupId, paletteItem.label, bounds.x, bounds.y, bounds.w, bounds.h, [], nextZIndex()));
    return { kind: "group", id: groupId };
  }

  const itemId = `${paletteItem.id}-${state.nextItemNumber++}`;
  if (kind === "finance") {
    const startingValue = Number(paletteItem.value) || 0;
    state.financeData[itemId] = {
      category: paletteItem.category,
      value: startingValue,
      capacity: Math.max(Number(paletteItem.capacity) || startingValue * 1.25, 100000),
      baseValue: startingValue
    };
    state.items.push({
      id: itemId,
      type: "finance",
      visual: paletteItem.visual,
      label: paletteItem.label,
      subtitle: paletteItem.subtitle,
      note: paletteItem.note,
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
      zIndex: nextZIndex(),
      financeId: itemId,
      style: {}
    });
    return { kind: "item", id: itemId };
  }

  state.items.push({
    id: itemId,
    type: kind,
    shape: paletteItem.shape || "rounded",
    ...(paletteItem.shapeIntent ? { shapeIntent: paletteItem.shapeIntent } : {}),
    label: paletteItem.label,
    subtitle: paletteItem.subtitle,
    note: "",
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    zIndex: nextZIndex(),
    style: kind === "text" ? { textStyle: paletteItem.textStyle || "caption" } : {}
  });
  return { kind: "item", id: itemId };
}

// === INTERACTION ===
export function selectItem(id) {
  const wasInspectorOpen = document.body.classList.contains("inspector-open");
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  state.selection = { kind: "item", id };
  clearMultiSelection();
  renderAll();
  scheduleInspectorFitIfOpening(wasInspectorOpen);
}

export function selectGroup(id) {
  const wasInspectorOpen = document.body.classList.contains("inspector-open");
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  state.selection = { kind: "group", id };
  clearMultiSelection();
  renderAll();
  scheduleInspectorFitIfOpening(wasInspectorOpen);
}

export function selectConnector(id) {
  const wasInspectorOpen = document.body.classList.contains("inspector-open");
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  state.selection = { kind: "connector", id };
  clearMultiSelection();
  renderAll();
  scheduleInspectorFitIfOpening(wasInspectorOpen);
}

export function selectSleeve(itemId, sleeveId) {
  if (!findSubBucket(itemId, sleeveId)) return;
  const wasInspectorOpen = document.body.classList.contains("inspector-open");
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  state.activeDock = "select";
  state.selection = { kind: "sleeve", itemId, sleeveId };
  clearMultiSelection();
  renderAll();
  scheduleInspectorFitIfOpening(wasInspectorOpen);
}

export function paletteById(kind, id) {
  if (kind === "shape") return shapePalette.find((item) => item.id === id);
  if (kind === "text") return textPalette.find((item) => item.id === id);
  if (kind === "finance") return financePalette.find((item) => item.id === id);
  if (kind === "group") return groupPalette.find((item) => item.id === id);
  if (kind === "connector") return connectorPalette.find((item) => item.id === id);
  return null;
}

export function addFromPalette(kind, id) {
  const paletteItem = paletteById(kind, id);
  if (!paletteItem) return;

  const center = visibleWorldCenter();
  const offset = (state.nextItemNumber % 5) * 18;
  const baseBounds = {
    x: center.x + offset,
    y: center.y + offset,
    w: paletteItem.w,
    h: paletteItem.h
  };
  const result = findClearPlacement(baseBounds, placementOptionsForPalette(kind, paletteItem));
  if (result.status === "blocked") {
    setLayoutFeedback("blocked", result.issues || []);
    renderAll();
    return;
  }

  commitHistory();
  const created = createNodeFromPalette(kind, id, result.bounds);
  if (!created) return;
  state.selection = created;
  clearMultiSelection();
  state.inspectorOpen = false;
  state.activePopover = null;
  state.editingItemId = kind === "text" ? created.id : null;
  state.editingField = null;
  state.pendingEditFocus = kind === "text";
  setLayoutFeedback(result.status === "nudged" ? "nudged" : null, result.issues || []);
  renderAll();
}

export function nearestItemToNode(node) {
  let nearest = null;
  let nearestDistance = Infinity;
  getAnchorableNodes().forEach((candidate) => {
    if (candidate.id === node.id) return;
    const distance = Math.hypot(candidate.x - node.x, candidate.y - node.y);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  });
  return nearest;
}

export function createConnectorFromPalette(id) {
  const selectedNode = state.selection?.kind === "item" ? getItem(state.selection.id) : state.selection?.kind === "group" ? getGroup(state.selection.id) : null;
  const source = selectedNode || state.items.find((item) => item.type === "finance") || state.items[0];
  const target = source ? nearestItemToNode(source) : null;
  if (!source || !target) return;

  commitHistory();
  const paletteItem = connectorPalette.find((item) => item.id === id);
  const resolvedRoute = paletteItem?.routeStyle || id || "smartArc";
  const resolvedStroke = paletteItem?.strokeStyle || "solid";
  const connectorId = `connector-${state.nextConnectorNumber++}`;
  state.connectors.push(connector(
    connectorId,
    routeStyles[resolvedRoute] || paletteItem?.label || "Connector",
    "transfer",
    50000,
    edgePinnedEndpoint({ x: target.x, y: target.y }, source),
    edgePinnedEndpoint({ x: source.x, y: source.y }, target),
    { routeStyle: resolvedRoute, strokeStyle: resolvedStroke, max: 500000 }
  ));
  state.selection = { kind: "connector", id: connectorId };
  clearMultiSelection();
  state.inspectorOpen = false;
  state.activePopover = null;
  renderAll();
}

export function deleteSelection() {
  if (isPresentationMode()) return false;
  if (!state.selection) return false;
  if (hasMultiSelection()) {
    const ids = new Set(selectedItemIds().filter((id) => !isLockedNode(getItem(id))));
    if (!ids.size) return false;
    commitHistory();
    state.items.forEach((item) => {
      if (ids.has(item.id) && item.financeId) delete state.financeData[item.financeId];
    });
    state.items = state.items.filter((item) => !ids.has(item.id));
    state.connectors = state.connectors.filter((conn) => !ids.has(conn.source.itemId) && !ids.has(conn.target.itemId));
    state.groups.forEach((group) => {
      group.childIds = group.childIds.filter((childId) => !ids.has(childId));
    });
    state.selection = null;
    clearMultiSelection();
    state.editingItemId = null;
    state.editingField = null;
    state.editingTarget = null;
    state.inspectorOpen = false;
    state.activePopover = null;
    renderAll();
    return true;
  }
  if (state.selection.kind === "item") {
    const id = state.selection.id;
    const item = getItem(id);
    if (isLockedNode(item)) return false;
    commitHistory();
    state.items = state.items.filter((entry) => entry.id !== id);
    state.connectors = state.connectors.filter((conn) => conn.source.itemId !== id && conn.target.itemId !== id);
    state.groups.forEach((group) => {
      group.childIds = group.childIds.filter((childId) => childId !== id);
    });
    if (item?.financeId) delete state.financeData[item.financeId];
  }
  if (state.selection.kind === "group") {
    const id = state.selection.id;
    const group = getGroup(id);
    if (isLockedNode(group)) return false;
    commitHistory();
    state.groups = state.groups.filter((group) => group.id !== id);
    state.items.forEach((item) => {
      if (item.groupId === id) delete item.groupId;
    });
  }
  if (state.selection.kind === "connector") {
    commitHistory();
    state.connectors = state.connectors.filter((conn) => conn.id !== state.selection.id);
  }
  state.selection = null;
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  renderAll();
  return true;
}

// A duplicated connector keeps its visual amount and geometry but drops every
// semantic binding, so it becomes an inert manual flow. Without this, cloning a
// scenario-linked income connector double-counts MAPPED cashflow (and would
// re-drive/re-total on scenario edits). The copy no longer contributes to
// cashflow coverage, scenario totals, or balances.
function stripConnectorSemanticBinding(copy) {
  copy.flowType = "transfer";
  copy.manualAmount = true;
  copy.amountSource = "manual";
  copy.sourceEffect = "none";
  copy.targetEffect = "none";
  copy.affectsSource = false;
  copy.affectsTarget = false;
  copy.includeInCurrentCashflow = false;
  copy.includeInProposedBalances = false;
  delete copy.scenarioKey;
  delete copy.flowSemantic;
  delete copy.domainRole;
  delete copy.role;
}

export function duplicateSelection() {
  if (isPresentationMode()) return;
  if (!state.selection) return;
  if (state.selection.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item || isLockedNode(item)) return;
    const copy = clone(item);
    copy.id = `${item.id}-copy-${state.nextItemNumber++}`;
    copy.x += 28;
    copy.y += 28;
    copy.zIndex = nextZIndex();
    const result = findClearPlacement(
      { x: copy.x, y: copy.y, w: copy.w, h: copy.h },
      placementOptionsForNode("item", copy, { viewportOnly: false })
    );
    if (result.status === "blocked") {
      setLayoutFeedback("blocked", result.issues || []);
      renderAll();
      return;
    }
    copy.x = result.bounds.x;
    copy.y = result.bounds.y;
    commitHistory();
    if (copy.financeId) {
      const newFinanceId = copy.id;
      state.financeData[newFinanceId] = clone(state.financeData[copy.financeId]);
      copy.financeId = newFinanceId;
    }
    state.items.push(copy);
    state.selection = { kind: "item", id: copy.id };
    clearMultiSelection();
  } else if (state.selection.kind === "group") {
    const group = getGroup(state.selection.id);
    if (!group || isLockedNode(group)) return;
    const copy = clone(group);
    copy.id = `${group.id}-copy-${state.nextGroupNumber++}`;
    copy.x += 28;
    copy.y += 28;
    copy.zIndex = nextZIndex();
    copy.childIds = [];
    const result = findClearPlacement(
      { x: copy.x, y: copy.y, w: copy.w, h: copy.h },
      placementOptionsForNode("group", copy, { viewportOnly: false })
    );
    if (result.status === "blocked") {
      setLayoutFeedback("blocked", result.issues || []);
      renderAll();
      return;
    }
    copy.x = result.bounds.x;
    copy.y = result.bounds.y;
    commitHistory();
    state.groups.push(copy);
    state.selection = { kind: "group", id: copy.id };
    clearMultiSelection();
  } else if (state.selection.kind === "connector") {
    const conn = getConnector(state.selection.id);
    if (!conn) return;
    commitHistory();
    const copy = clone(conn);
    copy.id = `${conn.id}-copy-${state.nextConnectorNumber++}`;
    copy.label = `${conn.label} copy`;
    copy.mid = conn.mid ? { x: conn.mid.x + 32, y: conn.mid.y + 32 } : null;
    stripConnectorSemanticBinding(copy);
    state.connectors.push(copy);
    state.selection = { kind: "connector", id: copy.id };
    clearMultiSelection();
  }
  state.inspectorOpen = false;
  state.activePopover = null;
  applyPresentationRepairFeedback();
  renderAll();
}

export function tidyCanvasLayout() {
  commitHistory();
  const result = tidyLayout();
  const repair = repairPresentationLayout();
  result.issues = repair.issues || [];
  setLayoutFeedback(result.issues?.length ? "blocked" : null, result.issues || []);
  syncComputedValues();
  renderAll();
  return result;
}

export function groupSelection() {
  if (state.selection?.kind !== "item") return;
  const item = getItem(state.selection.id);
  if (!item || isLockedNode(item)) return;
  commitHistory();
  const groupId = `group-${state.nextGroupNumber++}`;
  state.groups.push(groupBox(groupId, "Planning group", item.x, item.y, item.w + 70, item.h + 70, [item.id], 6));
  item.groupId = groupId;
  state.selection = { kind: "group", id: groupId };
  clearMultiSelection();
  state.inspectorOpen = false;
  state.activePopover = null;
  renderAll();
}

export function ungroupSelection() {
  if (state.selection?.kind !== "group") return;
  const group = getGroup(state.selection.id);
  if (!group) return;
  commitHistory();
  state.items.forEach((item) => {
    if (item.groupId === group.id) delete item.groupId;
  });
  state.groups = state.groups.filter((entry) => entry.id !== group.id);
  state.selection = null;
  clearMultiSelection();
  state.inspectorOpen = false;
  state.activePopover = null;
  renderAll();
}

export function splitFinancePreset() {
  if (state.selection?.kind !== "item") return;
  const item = getItem(state.selection.id);
  if (!item || isLockedNode(item) || item.type !== "finance") return;
  commitHistory();
  const data = state.financeData[item.financeId] || {};
  const shellId = item.id;
  const labelId = `${shellId}-label-${state.nextItemNumber++}`;
  const valueId = `${shellId}-value-${state.nextItemNumber++}`;
  const noteId = `${shellId}-note-${state.nextItemNumber++}`;
  const originalLabel = item.label || "Account";
  const originalSubtitle = item.subtitle || "";
  const originalNote = item.note || "";
  item.type = "shape";
  item.shape = item.visual === "trust" ? "trust" : "rounded";
  item.label = "";
  item.subtitle = "Editable shell";
  delete item.visual;
  delete item.financeId;
  item.style = {};

  state.items.push(
    textItem(labelId, originalLabel, originalSubtitle, item.x, item.y - 26, Math.max(150, item.w - 36), 42, "caption", nextZIndex()),
    textItem(valueId, compactDollars(data.value || 0), "", item.x, item.y + 10, 150, 44, "amountTag", nextZIndex()),
    textItem(noteId, originalNote || "Editable note", "", item.x, item.y + 44, Math.max(150, item.w - 36), 42, "assumption", nextZIndex())
  );
  delete state.financeData[shellId];
  state.selection = { kind: "item", id: shellId };
  clearMultiSelection();
  state.inspectorOpen = false;
  state.activePopover = null;
  renderAll();
}

export function reverseConnector() {
  if (state.selection?.kind !== "connector") return;
  const conn = getConnector(state.selection.id);
  if (!conn) return;
  const isSemanticFlow = conn.scenarioKey || !["transfer", "rebalance"].includes(conn.flowType) || !["transfer", "rebalance"].includes(conn.domainRole || conn.flowType);
  if (isSemanticFlow) return;
  commitHistory();
  const source = conn.source;
  const target = conn.target;
  conn.source = normalizeReversedEndpoint(target, "source", source);
  conn.target = normalizeReversedEndpoint(source, "target", target);
  renderAll();
}

export function quickAdjustSelectedValue(delta) {
  if (isPresentationMode()) return;
  const step = Number(delta);
  if (!Number.isFinite(step) || step === 0) return;

  if (state.selection?.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item || item.type !== "finance" || isLockedNode(item)) return;
    commitHistory();

    if (item.visual === "paycheck") {
      updateScenario("monthlyNeed", Math.max(0, (Number(state.scenario.monthlyNeed) || 0) + step));
      return;
    }

    if (!item.financeId || !state.financeData[item.financeId]) return;
    state.financeData[item.financeId].value = Math.max(0, (Number(state.financeData[item.financeId].value) || 0) + step);
    syncComputedValues({ animateDelta: true });
    updateItemValues();
    updateConnectorValues({ geometry: false });
    updateScenarioReadouts();
    return;
  }

  if (state.selection?.kind === "sleeve") {
    const selected = findSubBucket(state.selection.itemId, state.selection.sleeveId);
    if (!selected) return;
    commitHistory();
    selected.bucket.value = Math.max(0, (Number(selected.bucket.value) || 0) + step);
    syncComputedValues({ animateDelta: true });
    renderCanvasSurface();
    renderHud();
    return;
  }

  if (state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    if (!conn) return;
    commitHistory();
    updateConnectorAmount(conn, Math.max(0, connectorDisplayAmount(conn) + step));
  }
}

export function detachConnectorEndpoints(options = {}) {
  const connectorId = options.connectorId || (state.selection?.kind === "connector" ? state.selection.id : null);
  const conn = connectorId ? getConnector(connectorId) : null;
  if (!conn) return;
  if (!options.skipHistory) commitHistory();
  const computed = computeConnectorPath(conn);
  conn.source = { ...conn.source, x: computed.source.x, y: computed.source.y, detached: true };
  conn.target = { ...conn.target, x: computed.target.x, y: computed.target.y, detached: true };
  conn.mid = computed.control;
  conn.manualMid = (conn.routeStyle || "smartArc") !== "straight";
  state.activePopover = null;
  renderAll();
}

export function reattachConnectorEndpoints(options = {}) {
  const connectorId = options.connectorId || (state.selection?.kind === "connector" ? state.selection.id : null);
  const conn = connectorId ? getConnector(connectorId) : null;
  if (!conn) return;
  const computed = computeConnectorPath(conn);
  const sourceSnap = nearestSnapNode(computed.source, conn, "source");
  const targetSnap = nearestSnapNode(computed.target, conn, "target");
  if (!sourceSnap && !targetSnap) return;
  if (!options.skipHistory) commitHistory();
  if (sourceSnap) pinConnectorEndpoint(conn, "source", computed.source, sourceSnap);
  if (targetSnap) pinConnectorEndpoint(conn, "target", computed.target, targetSnap);
  state.activePopover = null;
  applyPresentationRepairFeedback();
  renderAll();
}

export function startEditing(id, field = null) {
  if (isPresentationMode()) return;
  const item = getItem(id);
  const group = getGroup(id);
  if (isLockedNode(item || group)) return;
  state.editingHistoryBefore = historySnapshot();
  state.editingItemId = id;
  state.editingField = field;
  state.editingTarget = item
    ? { kind: "item", id, field }
    : { kind: "group", id, field };
  state.pendingEditFocus = true;
  state.pendingEditField = field;
  state.inspectorOpen = false;
  state.activePopover = null;
  state.selection = item ? { kind: "item", id } : { kind: "group", id };
  clearMultiSelection();
  renderAll();
}

export function startSleeveEditing(itemId, sleeveId, field = "value") {
  if (isPresentationMode()) return;
  if (!findSubBucket(itemId, sleeveId)) return;
  state.editingHistoryBefore = historySnapshot();
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = { kind: "sleeve", itemId, sleeveId, field };
  state.pendingEditFocus = true;
  state.pendingEditField = field;
  state.inspectorOpen = false;
  state.activePopover = null;
  state.activeDock = "select";
  state.selection = { kind: "sleeve", itemId, sleeveId };
  clearMultiSelection();
  renderAll();
}

export function startConnectorEditing(connectorId, field = "amount") {
  const conn = getConnector(connectorId);
  if (!conn) return;
  state.editingHistoryBefore = historySnapshot();
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = { kind: "connector", id: connectorId, field };
  state.pendingEditFocus = true;
  state.pendingEditField = field;
  state.inspectorOpen = false;
  state.activePopover = null;
  state.activeDock = "select";
  state.selection = { kind: "connector", id: connectorId };
  clearMultiSelection();
  renderAll();
}

export function startConnectorLabelMaybeDrag(event, conn, field = "relationship") {
  event.preventDefault();
  event.stopPropagation();
  state.interaction = {
    type: "maybe-edit-connector-label",
    connectorId: conn.id,
    field,
    startClient: { x: event.clientX, y: event.clientY },
    historyBefore: historySnapshot()
  };
  state.selection = { kind: "connector", id: conn.id };
  clearMultiSelection();
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  beginInteractionPointer(event);
}

export function hudLayoutFromElement(node) {
  const rect = node.getBoundingClientRect();
  const parentRect = dom.workspace.getBoundingClientRect();
  return {
    x: rect.left - parentRect.left,
    y: rect.top - parentRect.top,
    w: rect.width,
    h: rect.height
  };
}

export function startFloatingDrag(event, node, key) {
  if (!key) return;
  event.preventDefault();
  event.stopPropagation();
  state.interaction = {
    type: "drag-floating",
    key,
    startClient: { x: event.clientX, y: event.clientY },
    startLayout: hudLayoutFromElement(node)
  };
  document.body.classList.add("dragging");
  beginInteractionPointer(event);
}

export function startToolbarDrag(event, node) {
  // Kept for older event wiring; toolbar rendering is disabled.
}

export function startPopoverDrag(event, node) {
  // Kept for older event wiring; popover rendering is disabled.
}

export function startHudDrag(event, node) {
  const key = selectionKey();
  if (!key) return;
  event.preventDefault();
  event.stopPropagation();
  state.interaction = {
    type: "drag-hud",
    key,
    startClient: { x: event.clientX, y: event.clientY },
    startLayout: hudLayoutFromElement(node)
  };
  document.body.classList.add("dragging");
  beginInteractionPointer(event);
}

export function startHudResize(event, node) {
  const key = selectionKey();
  if (!key) return;
  event.preventDefault();
  event.stopPropagation();
  state.interaction = {
    type: "resize-hud",
    key,
    startClient: { x: event.clientX, y: event.clientY },
    startLayout: hudLayoutFromElement(node)
  };
  document.body.classList.add("dragging");
  beginInteractionPointer(event);
}

export function startDragNode(event, kind, id, options = {}) {
  if (isPresentationMode()) return;
  const node = kind === "item" ? getItem(id) : getGroup(id);
  if (!node || isLockedNode(node)) return;
  const point = pointFromEvent(event);
  state.interaction = {
    type: "maybe-drag-node",
    kind,
    id,
    startClient: { x: event.clientX, y: event.clientY },
    startPoint: point,
    offsetX: point.x - node.x,
    offsetY: point.y - node.y,
    original: { x: node.x, y: node.y },
    edgeConnector: options.edgeConnector || null,
    historyBefore: null,
    childOriginals: kind === "group" ? (node.childIds || []).map((childId) => {
      const child = getItem(childId);
      return child ? { id: child.id, x: child.x, y: child.y } : null;
    }).filter(Boolean) : []
  };
  beginInteractionPointer(event);
}

function connectorIntentForMove(interaction, event) {
  if (!interaction?.edgeConnector) return "drag";
  const dx = event.clientX - interaction.startClient.x;
  const dy = event.clientY - interaction.startClient.y;
  const distance = Math.hypot(dx, dy);
  const outward = {
    north: -dy,
    east: dx,
    south: dy,
    west: -dx
  }[interaction.edgeConnector] || 0;

  if (outward >= EDGE_CONNECTOR_INTENT_PX) return "connector";
  if (distance < 4) return "pending";
  if (outward > 0 && distance < EDGE_CONNECTOR_INTENT_PX + 4) return "pending";
  return "drag";
}

function promoteMaybeDragToDrag() {
  if (state.interaction?.type !== "maybe-drag-node") return;
  if (!state.interaction.historyBefore) state.interaction.historyBefore = historySnapshot();
  state.interaction.type = "drag-node";
  const node = state.interaction.kind === "item" ? getItem(state.interaction.id) : getGroup(state.interaction.id);
  state.interaction.impactedConnectorIds = connectorIdsForMovingNode(state.interaction.kind, node);
  resetDragDiagnostics();
  state.inputDiagnostics.impactedConnectorCount = state.interaction.impactedConnectorIds.length;
  state.inputDiagnostics.impactedConnectorIdsDuringDrag = [...state.interaction.impactedConnectorIds];
  state.selection = { kind: state.interaction.kind, id: state.interaction.id };
  clearMultiSelection();
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  document.body.classList.add("dragging");
  setDragPerformanceActive(true);
  dom.itemLayer.querySelectorAll(".canvas-item.is-selected, .canvas-group.is-selected").forEach((el) => el.classList.remove("is-selected"));
  const selectorId = cssIdent(state.interaction.id);
  const selector = state.interaction.kind === "item" ? `[data-item-id="${selectorId}"]` : `[data-group-id="${selectorId}"]`;
  dom.itemLayer.querySelector(selector)?.classList.add("is-selected");
  renderHud();
}

function promoteMaybeDragToEdgeConnector(event) {
  if (state.interaction?.type !== "maybe-drag-node" || state.interaction.kind !== "item") return false;
  const source = getItem(state.interaction.id);
  if (!source || source.type !== "finance" || isLockedNode(source) || !state.interaction.edgeConnector) return false;
  state.interaction = {
    type: "edge-connector",
    sourceId: source.id,
    edge: state.interaction.edgeConnector,
    start: edgePointForNode(source, state.interaction.edgeConnector),
    point: pointFromEvent(event),
    targetId: null,
    hasMoved: true,
    historyBefore: state.interaction.historyBefore || historySnapshot()
  };
  state.selection = null;
  clearMultiSelection();
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  document.body.classList.add("dragging", "creating-connector", "connector-preview-active");
  setConnectorPreviewTarget(nearestConnectorNode(state.interaction.point, source.id, { event }));
  updateEdgeConnectorPreview();
  return true;
}

export function startResizeNode(event, kind, id, handle) {
  if (isPresentationMode()) return;
  event.preventDefault();
  event.stopPropagation();
  const node = kind === "item" ? getItem(id) : getGroup(id);
  if (!node || isLockedNode(node)) return;
  state.interaction = {
    type: "resize-node",
    kind,
    id,
    handle,
    original: { x: node.x, y: node.y, w: node.w, h: node.h },
    historyBefore: historySnapshot()
  };
  state.interaction.impactedConnectorIds = connectorIdsForMovingNode(kind, node);
  resetDragDiagnostics();
  state.inputDiagnostics.impactedConnectorCount = state.interaction.impactedConnectorIds.length;
  state.inputDiagnostics.impactedConnectorIdsDuringDrag = [...state.interaction.impactedConnectorIds];
  state.selection = { kind, id };
  clearMultiSelection();
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  document.body.classList.add("dragging");
  setDragPerformanceActive(true);
  beginInteractionPointer(event);
}

export function startConnectorDrag(event, conn, role) {
  event.preventDefault();
  event.stopPropagation();
  state.interaction = {
    type: "drag-connector",
    connectorId: conn.id,
    role,
    endpointStartedAttached: role === "source" || role === "target" ? isAttachedEndpoint(conn[role]) : false,
    historyBefore: historySnapshot()
  };
  state.interaction.impactedConnectorIds = [conn.id];
  resetDragDiagnostics();
  state.inputDiagnostics.impactedConnectorCount = 1;
  state.inputDiagnostics.impactedConnectorIdsDuringDrag = [conn.id];
  state.selection = { kind: "connector", id: conn.id };
  clearMultiSelection();
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  document.body.classList.add("dragging");
  setDragPerformanceActive(true);
  updateConnectorValues({ connectorIds: [conn.id] });
  beginInteractionPointer(event, event.currentTarget || event.target);
}

export function startConnectorBodyDrag(event, conn) {
  event.preventDefault();
  event.stopPropagation();
  const start = pointFromEvent(event);
  const wasSelected = state.selection?.kind === "connector" && state.selection.id === conn.id;
  state.interaction = {
    type: "maybe-drag-connector-body",
    connectorId: conn.id,
    start,
    originalSource: cloneEndpoint(conn.source),
    originalTarget: cloneEndpoint(conn.target),
    originalMid: conn.mid ? { ...conn.mid } : null,
    originalLabelPoint: conn.labelPoint ? { ...conn.labelPoint } : null,
    historyBefore: historySnapshot()
  };
  state.selection = { kind: "connector", id: conn.id };
  clearMultiSelection();
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  if (wasSelected) updateConnectorValues({ connectorIds: [conn.id] });
  else renderAll();
  beginInteractionPointer(event);
}

export function startPan(event) {
  state.interaction = {
    type: "pan",
    startClient: { x: event.clientX, y: event.clientY },
    startViewport: { ...state.viewport },
    moved: false
  };
  document.body.classList.add("dragging");
  beginInteractionPointer(event);
}

export function startCanvasPlacement(event) {
  const choice = activeCreationChoice();
  if (!choice || choice.kind === "connector") return false;
  event.preventDefault();
  event.stopPropagation();
  const point = pointFromEvent(event);
  state.interaction = {
    type: "place-node",
    kind: choice.kind,
    presetId: choice.id,
    start: point,
    point,
    hasMoved: false,
    historyBefore: historySnapshot()
  };
  state.selection = null;
  clearMultiSelection();
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  document.body.classList.add("dragging", "creating-node");
  beginInteractionPointer(event);
  return true;
}

export function startConnectorToolDrag(event, node) {
  if (isPresentationMode()) return false;
  const choice = activeCreationChoice();
  if (!choice || choice.kind !== "connector" || !node || isFormField(event.target)) return false;
  const kind = node.classList.contains("canvas-group") ? "group" : "item";
  const id = kind === "group" ? node.dataset.groupId : node.dataset.itemId;
  const source = id ? getNode(id) : null;
  const isConnectableItem = source?.type === "finance";
  const isConnectableGroup = source && !source.type;
  if (!source || (!isConnectableItem && !isConnectableGroup) || isLockedNode(source)) return false;
  const point = pointFromEvent(event);
  startEdgeConnectorDrag(event, id, nearestNodeEdge(point, source), { presetId: choice.id });
  return true;
}

export function canvasNodeFromClientPoint(event) {
  const nodes = document.elementsFromPoint(event.clientX, event.clientY);
  const seen = new Set();
  for (const node of nodes) {
    const canvasNode = node.closest?.(".canvas-item, .canvas-group");
    if (!canvasNode || seen.has(canvasNode)) continue;
    seen.add(canvasNode);
    return canvasNode;
  }
  return null;
}

export function financeEdgeFromClientPoint(event, node) {
  if (!node?.classList?.contains("item-finance")) return null;
  const id = node.dataset.itemId;
  const item = id ? getItem(id) : null;
  if (!item || item.type !== "finance" || isLockedNode(item)) return null;

  const rect = node.getBoundingClientRect();
  const zone = Math.min(EDGE_CONNECTOR_ZONE_PX, Math.max(18, Math.min(rect.width, rect.height) * 0.2));
  const distances = [
    { edge: "north", value: event.clientY - rect.top },
    { edge: "east", value: rect.right - event.clientX },
    { edge: "south", value: rect.bottom - event.clientY },
    { edge: "west", value: event.clientX - rect.left }
  ].filter((entry) => entry.value >= 0);
  const nearest = distances.sort((a, b) => a.value - b.value)[0];
  return nearest && nearest.value <= zone ? nearest.edge : null;
}

export function connectorEndpointOwnsNode(conn, role, node) {
  if (!conn || !node || (role !== "source" && role !== "target")) return false;
  const id = node.dataset.itemId || node.dataset.groupId;
  return conn[role]?.itemId === id;
}

function applyFlowTypePreset(conn, flowType) {
  const displayedAmount = connectorDisplayAmount(conn);
  conn.flowType = flowType;
  const preset = flowTypePresets[flowType];
  if (!preset) return;
  Object.assign(conn, preset);
  const target = conn.target?.itemId ? getNode(conn.target.itemId) : null;
  const targetIsPaycheck = target?.visual === "paycheck";
  conn.cadence = targetIsPaycheck && (flowType === "income" || flowType === "rmd")
    ? "monthly"
    : flowType === "rmd" || flowType === "qcd" ? "annual" : flowType === "income" ? "monthly" : "oneTime";
  conn.timing = conn.timing || "current";
  conn.sourceEffect = flowType === "beneficiary" ? "none" : "decreaseBalance";
  conn.targetEffect = targetIsPaycheck && (flowType === "income" || flowType === "rmd")
    ? "cashflowCoverage"
    : targetIsPaycheck
      ? "none"
    : flowType === "beneficiary" || flowType === "qcd" || flowType === "fee"
      ? "none"
      : "increaseBalance";
  conn.domainRole = flowType;
  conn.scenarioKey = null;
  conn.manualAmount = true;
  conn.amountSource = "manual";
  conn.amount = connectorStoredAmountFromDisplay(conn, displayedAmount);
}

export function edgePointForNode(node, edge) {
  if (edge === "north") return { x: node.x, y: node.y - node.h / 2 };
  if (edge === "south") return { x: node.x, y: node.y + node.h / 2 };
  if (edge === "east") return { x: node.x + node.w / 2, y: node.y };
  return { x: node.x - node.w / 2, y: node.y };
}

function edgeForEndpoint(endpointValue, node) {
  if (!endpointValue || !node) return null;
  if (endpointValue.port || endpointValue.portId) {
    return nodeEdgeForPort(endpointValue.port || endpointValue.portId);
  }
  const offsetX = Number(endpointValue.offsetX);
  const offsetY = Number(endpointValue.offsetY);
  if (!Number.isFinite(offsetX) && !Number.isFinite(offsetY)) return null;
  const halfW = node.w / 2;
  const halfH = node.h / 2;
  return [
    { edge: "east", distance: Math.abs(offsetX - halfW) },
    { edge: "west", distance: Math.abs(offsetX + halfW) },
    { edge: "south", distance: Math.abs(offsetY - halfH) },
    { edge: "north", distance: Math.abs(offsetY + halfH) }
  ].sort((a, b) => a.distance - b.distance)[0]?.edge || null;
}

function productVisualForNode(node) {
  return node?.visual || node?.shape || node?.type || "card";
}

function portEdge(portName) {
  const [edge] = String(portName || "").split(".");
  return ["left", "right", "top", "bottom"].includes(edge) ? edge : "right";
}

function nodeEdgeForPort(portName) {
  const edge = portEdge(portName);
  if (edge === "left") return "west";
  if (edge === "top") return "north";
  if (edge === "bottom") return "south";
  return "east";
}

function portEdgeForNodeEdge(edge) {
  if (edge === "west") return "left";
  if (edge === "north") return "top";
  if (edge === "south") return "bottom";
  return "right";
}

function portsForPinnedNode(node) {
  return PINNED_ENDPOINT_PORTS[productVisualForNode(node)] || PINNED_ENDPOINT_PORTS.shape;
}

function portSlot(portName) {
  return String(portName || "").split(".")[1] || "";
}

function portSlotsForRole(role) {
  return role === "target" ? TARGET_PORT_SLOTS : SOURCE_PORT_SLOTS;
}

function roleRankedPortsForNode(node, role, preferredEdge = null) {
  const ports = portsForPinnedNode(node);
  const slots = portSlotsForRole(role);
  const semanticPorts = ports.filter((port) => slots.has(portSlot(port)));
  const candidates = semanticPorts.length ? semanticPorts : ports;
  const edgePorts = preferredEdge
    ? candidates.filter((port) => nodeEdgeForPort(port) === preferredEdge)
    : [];
  return edgePorts.length ? edgePorts : candidates;
}

function inferredPortForPoint(point, node, preferredEdge = null) {
  const edge = portEdgeForNodeEdge(preferredEdge || nearestNodeEdge(point, node));
  const ports = portsForPinnedNode(node);
  const candidates = ports.filter((port) => portEdge(port) === edge);
  const available = candidates.length ? candidates : ports;
  return available
    .map((port, index) => {
      const portPoint = resolvePortPoint(node, port, point);
      return {
        port,
        index,
        distance: Math.hypot(portPoint.x - point.x, portPoint.y - point.y)
      };
    })
    .sort((a, b) => a.distance - b.distance || a.index - b.index)[0]?.port || "right.out";
}

function inferredPortForRole(point, node, role) {
  const preferredEdge = nearestNodeEdge(point, node);
  const available = roleRankedPortsForNode(node, role, preferredEdge);
  return available
    .map((port, index) => {
      const portPoint = resolvePortPoint(node, port, point);
      return {
        port,
        index,
        distance: Math.hypot(portPoint.x - point.x, portPoint.y - point.y)
      };
    })
    .sort((a, b) => a.distance - b.distance || a.index - b.index)[0]?.port || inferredPortForPoint(point, node, preferredEdge);
}

function endpointHasNamedPort(endpointValue) {
  return Boolean(endpointValue?.port || endpointValue?.portId);
}

function normalizeReversedEndpoint(endpointValue, role, oppositeEndpoint) {
  if (!endpointHasNamedPort(endpointValue) || !endpointValue?.itemId) return endpointValue;
  const node = getNode(endpointValue.itemId);
  if (!node) return endpointValue;
  const oppositePoint = rawEndpoint(oppositeEndpoint);
  const port = inferredPortForRole(oppositePoint, node, role);
  const portPoint = resolvePortPoint(node, port, oppositePoint);
  return {
    ...endpointValue,
    port,
    offsetX: portPoint.x - node.x,
    offsetY: portPoint.y - node.y
  };
}

function nearestNodeEdge(point, node) {
  const dx = point.x - node.x;
  const dy = point.y - node.y;
  const halfW = node.w / 2;
  const halfH = node.h / 2;
  return [
    { edge: "east", distance: Math.abs(dx - halfW) },
    { edge: "west", distance: Math.abs(dx + halfW) },
    { edge: "south", distance: Math.abs(dy - halfH) },
    { edge: "north", distance: Math.abs(dy + halfH) }
  ].sort((a, b) => a.distance - b.distance)[0]?.edge || "east";
}

function edgeOffsetForPoint(point, node, preferredEdge = null) {
  const edge = preferredEdge || nearestNodeEdge(point, node);
  const halfW = node.w / 2;
  const halfH = node.h / 2;
  const dx = point.x - node.x;
  const dy = point.y - node.y;
  const insetX = Math.min(EDGE_PIN_INSET, Math.max(0, halfW - 2));
  const insetY = Math.min(EDGE_PIN_INSET, Math.max(0, halfH - 2));

  if (edge === "north") {
    return {
      offsetX: clamp(dx, -halfW + insetX, halfW - insetX),
      offsetY: -halfH
    };
  }
  if (edge === "south") {
    return {
      offsetX: clamp(dx, -halfW + insetX, halfW - insetX),
      offsetY: halfH
    };
  }
  if (edge === "west") {
    return {
      offsetX: -halfW,
      offsetY: clamp(dy, -halfH + insetY, halfH - insetY)
    };
  }
  return {
    offsetX: halfW,
    offsetY: clamp(dy, -halfH + insetY, halfH - insetY)
  };
}

function edgePinnedEndpoint(point, node, preferredEdge = null) {
  const port = inferredPortForPoint(point, node, preferredEdge);
  const edgeOffset = edgeOffsetForPoint(point, node, preferredEdge);
  return {
    itemId: node.id,
    port,
    ...edgeOffset
  };
}

function clearConnectorManualGeometry(conn) {
  conn.mid = null;
  conn.manualMid = false;
  conn.labelPoint = null;
  if (conn.labelMode === "manual") conn.labelMode = "auto";
}

function pinConnectorEndpoint(conn, role, point, node, options = {}) {
  const current = conn?.[role];
  const preferredEdge = current?.itemId === node.id ? edgeForEndpoint(current, node) : null;
  conn[role] = edgePinnedEndpoint(point, node, preferredEdge);
  if (options.resetGeometry) clearConnectorManualGeometry(conn);
}

function worldRadiusForScreenRadius(radius) {
  return radius / Math.max(state.viewport.zoom || 1, 0.35);
}

function nearestEndpointSnapNode(point, conn, role, options = {}) {
  const current = conn?.[role];
  const currentNode = current?.itemId ? getNode(current.itemId) : null;
  const radius = worldRadiusForScreenRadius(options.radius ?? EDGE_PIN_SNAP_RADIUS);
  const keepCurrent = options.keepCurrent ?? true;
  if (keepCurrent && currentNode && distanceToNode(point, currentNode) <= radius) return currentNode;
  return nearestSnapNode(point, conn, role, { radius });
}

function financeItemFromClientPoint(event, excludeId = null) {
  if (!event) return null;
  const nodes = document.elementsFromPoint(event.clientX, event.clientY);
  for (const node of nodes) {
    const itemNode = node.closest?.(".canvas-item.item-finance");
    const id = itemNode?.dataset?.itemId;
    if (!id || id === excludeId) continue;
    const item = getItem(id);
    if (item?.type === "finance" && !isLockedNode(item)) return item;
  }
  return null;
}

function connectorNodeFromClientPoint(event, excludeId = null) {
  if (!event) return null;
  const nodes = document.elementsFromPoint(event.clientX, event.clientY);
  for (const node of nodes) {
    const canvasNode = node.closest?.(".canvas-item.item-finance, .canvas-group");
    const id = canvasNode?.dataset?.itemId || canvasNode?.dataset?.groupId;
    if (!id || id === excludeId) continue;
    const target = getNode(id);
    if (target && !isLockedNode(target)) return target;
  }
  return null;
}

function nearestConnectorNode(point, excludeId = null, options = {}) {
  const hitTarget = connectorNodeFromClientPoint(options.event, excludeId);
  if (hitTarget) return hitTarget;

  let nearest = null;
  let nearestDistance = Infinity;
  getAnchorableNodes().forEach((node) => {
    const isConnectableItem = node.type === "finance";
    const isConnectableGroup = !node.type;
    if (node.id === excludeId || (!isConnectableItem && !isConnectableGroup) || isLockedNode(node)) return;
    const distance = distanceToNode(point, node);
    if (distance < nearestDistance) {
      nearest = node;
      nearestDistance = distance;
    }
  });
  return nearestDistance <= (options.radius || EDGE_CONNECTOR_TARGET_RADIUS) ? nearest : null;
}

export function nearestFinanceItem(point, excludeId = null, options = {}) {
  const hitTarget = financeItemFromClientPoint(options.event, excludeId);
  if (hitTarget) return hitTarget;

  let nearest = null;
  let nearestDistance = Infinity;
  state.items.forEach((item) => {
    if (item.id === excludeId || item.type !== "finance" || isLockedNode(item)) return;
    const distance = distanceToNode(point, item);
    if (distance < nearestDistance) {
      nearest = item;
      nearestDistance = distance;
    }
  });
  return nearestDistance <= (options.radius || EDGE_CONNECTOR_SNAP_RADIUS) ? nearest : null;
}

function clearConnectorPreviewChrome() {
  state.hoverItemId = null;
  dom.itemLayer.querySelectorAll(".canvas-item.is-snap-target, .canvas-group.is-snap-target").forEach((node) => node.classList.remove("is-snap-target"));
  dom.connectorLayer.querySelector(".connector-ghost")?.remove();
  document.body.classList.remove("connector-preview-active", "connector-preview-valid", "connector-preview-invalid");
}

function setConnectorPreviewTarget(target) {
  state.interaction.targetId = target?.id || null;
  state.hoverItemId = state.interaction.targetId;
  dom.itemLayer.querySelectorAll(".canvas-item.is-snap-target, .canvas-group.is-snap-target").forEach((node) => node.classList.remove("is-snap-target"));
  if (state.hoverItemId) {
    const selectorId = cssIdent(state.hoverItemId);
    dom.itemLayer.querySelector(`[data-item-id="${selectorId}"], [data-group-id="${selectorId}"]`)?.classList.add("is-snap-target");
  }
  document.body.classList.toggle("connector-preview-valid", Boolean(state.interaction.targetId));
  document.body.classList.toggle("connector-preview-invalid", !state.interaction.targetId && Boolean(state.interaction.hasMoved));
}

export function edgePreviewConnector() {
  if (!state.interaction || state.interaction.type !== "edge-connector") return null;
  const sourceNode = getNode(state.interaction.sourceId);
  const targetNode = state.interaction.targetId ? getNode(state.interaction.targetId) : null;
  const style = connectorStyleForPreset(state.interaction.presetId);
  return {
    id: "__edge-preview",
    label: "New transfer",
    flowType: "transfer",
    amount: 0,
    source: sourceNode ? edgePinnedEndpoint(state.interaction.start, sourceNode, state.interaction.edge) : { itemId: state.interaction.sourceId },
    target: targetNode ? edgePinnedEndpoint(state.interaction.point, targetNode) : state.interaction.point,
    routeStyle: style.routeStyle,
    strokeStyle: style.strokeStyle,
    arrowStart: "none",
    arrowEnd: "arrow",
    labelMode: "hidden",
    colorMode: "accent",
    widthMode: "medium",
    customWidth: 5,
    mid: null,
    manualMid: false
  };
}

export function updateEdgeConnectorPreview() {
  dom.connectorLayer.querySelector(".connector-ghost")?.remove();
  const preview = edgePreviewConnector();
  if (!preview) return;
  const computed = computeConnectorPath(preview);
  const previewClass = state.interaction.targetId ? "is-valid" : state.interaction.hasMoved ? "is-invalid" : "is-pending";
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", computed.d);
  path.setAttribute("class", `connector-ghost ${previewClass}`);
  path.dataset.previewState = previewClass.replace("is-", "");
  path.style.setProperty("--flow-color", getConnectorColor(preview));
  path.style.setProperty("--flow-width", "4.8px");
  path.setAttribute("marker-end", markerUrl("arrow"));
  dom.connectorLayer.appendChild(path);
}

export function startEdgeConnectorDrag(event, sourceId, edge = null, options = {}) {
  if (isPresentationMode()) return;
  event.preventDefault();
  event.stopPropagation();
  const source = getNode(sourceId);
  const isConnectableItem = source?.type === "finance";
  const isConnectableGroup = source && !source.type;
  if (!source || (!isConnectableItem && !isConnectableGroup) || isLockedNode(source)) return;
  const startPoint = pointFromEvent(event);
  const resolvedEdge = edge || nearestNodeEdge(startPoint, source);
  state.interaction = {
    type: "edge-connector",
    sourceId,
    edge: resolvedEdge,
    presetId: options.presetId || (state.activeCreationPreset?.kind === "connector" ? state.activeCreationPreset.id : null),
    start: startPoint,
    point: startPoint,
    targetId: null,
    hasMoved: false,
    historyBefore: historySnapshot()
  };
  state.selection = null;
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  document.body.classList.add("dragging", "creating-connector", "connector-preview-active");
  updateEdgeConnectorPreview();
  beginInteractionPointer(event);
}

export function cancelInteraction(options = {}) {
  const endedInteraction = state.interaction;
  if (!endedInteraction) return false;
  state.interaction = null;
  cancelInteractionChromeUpdate();
  removePlacementPreview();
  clearConnectorPreviewChrome();
  clearLayoutFeedback();
  document.body.classList.remove("dragging", "creating-connector", "creating-node");
  setDragPerformanceActive(false);
  endInteractionPointer();
  if (options.restore !== false && endedInteraction.historyBefore) {
    restoreHistorySnapshot(endedInteraction.historyBefore);
    return true;
  }
  if (options.render !== false) renderAll();
  return true;
}

export function startCanvasNodePointer(event, node) {
  if (!node || isActiveTextEditTarget(event.target)) return false;
  const kind = node.classList.contains("canvas-group") ? "group" : "item";
  const id = kind === "group" ? node.dataset.groupId : node.dataset.itemId;
  if (!id) return false;
  event.preventDefault();
  event.stopPropagation();
  startDragNode(event, kind, id);
  return true;
}

export function handleInteractionMove(event) {
  if (!state.interaction) return;

  if (state.interaction.type === "drag-hud") {
    const rect = dom.workspace.getBoundingClientRect();
    const dx = event.clientX - state.interaction.startClient.x;
    const dy = event.clientY - state.interaction.startClient.y;
    const next = {
      ...state.interaction.startLayout,
      x: clamp(state.interaction.startLayout.x + dx, 12, rect.width - state.interaction.startLayout.w - 12),
      y: clamp(state.interaction.startLayout.y + dy, 12, rect.height - state.interaction.startLayout.h - 12)
    };
    state.hudLayouts[state.interaction.key] = next;
    renderHud();
    return;
  }

  if (state.interaction.type === "drag-floating") {
    const rect = dom.workspace.getBoundingClientRect();
    const dx = event.clientX - state.interaction.startClient.x;
    const dy = event.clientY - state.interaction.startClient.y;
    state.floatingLayouts[state.interaction.key] = {
      ...state.interaction.startLayout,
      x: clamp(state.interaction.startLayout.x + dx, 12, rect.width - state.interaction.startLayout.w - 12),
      y: clamp(state.interaction.startLayout.y + dy, 12, rect.height - state.interaction.startLayout.h - 12)
    };
    renderHud();
    return;
  }

  if (state.interaction.type === "resize-hud") {
    const rect = dom.workspace.getBoundingClientRect();
    const w = clamp(state.interaction.startLayout.w + event.clientX - state.interaction.startClient.x, 260, Math.min(560, rect.width - state.interaction.startLayout.x - 12));
    const h = clamp(state.interaction.startLayout.h + event.clientY - state.interaction.startClient.y, 180, Math.min(720, rect.height - state.interaction.startLayout.y - 12));
    state.hudLayouts[state.interaction.key] = { ...state.interaction.startLayout, w, h };
    renderHud();
    return;
  }

  const point = pointFromEvent(event);

  if (state.interaction.type === "pan") {
    const dx = event.clientX - state.interaction.startClient.x;
    const dy = event.clientY - state.interaction.startClient.y;
    if (Math.hypot(dx, dy) > 3) state.interaction.moved = true;
    state.viewport.x = state.interaction.startViewport.x + dx;
    state.viewport.y = state.interaction.startViewport.y + dy;
    constrainViewport();
    renderViewport();
    scheduleViewportSettle();
    return;
  }

  if (state.interaction.type === "place-node") {
    state.interaction.point = point;
    state.interaction.hasMoved = Math.hypot(point.x - state.interaction.start.x, point.y - state.interaction.start.y) > 5;
    updatePlacementPreview();
    return;
  }

  if (state.interaction.type === "edge-connector") {
    state.interaction.point = point;
    state.interaction.hasMoved = Math.hypot(point.x - state.interaction.start.x, point.y - state.interaction.start.y) > 18;
    const target = nearestConnectorNode(point, state.interaction.sourceId, { event });
    setConnectorPreviewTarget(target);
    updateEdgeConnectorPreview();
    return;
  }

  if (state.interaction.type === "maybe-drag-node") {
    const dx = event.clientX - state.interaction.startClient.x;
    const dy = event.clientY - state.interaction.startClient.y;
    if (Math.hypot(dx, dy) < 4) return;
    const intent = connectorIntentForMove(state.interaction, event);
    if (intent === "pending") return;
    if (intent === "connector" && promoteMaybeDragToEdgeConnector(event)) return;
    promoteMaybeDragToDrag();
  }

  if (state.interaction.type === "drag-node") {
    const node = state.interaction.kind === "item" ? getItem(state.interaction.id) : getGroup(state.interaction.id);
    if (!node) return;
    node.x = clamp(point.x - state.interaction.offsetX, node.w / 2, WORLD.width - node.w / 2);
    node.y = clamp(point.y - state.interaction.offsetY, node.h / 2, WORLD.height - node.h / 2);
    if (state.interaction.kind === "group") {
      const dx = node.x - state.interaction.original.x;
      const dy = node.y - state.interaction.original.y;
      state.interaction.childOriginals.forEach((childOriginal) => {
        const child = getItem(childOriginal.id);
        if (child) {
          child.x = childOriginal.x + dx;
          child.y = childOriginal.y + dy;
        }
      });
    }
    const nodeSelectorId = cssIdent(node.id);
    const nodeEl = dom.itemLayer.querySelector(state.interaction.kind === "item" ? `[data-item-id="${nodeSelectorId}"]` : `[data-group-id="${nodeSelectorId}"]`);
    if (nodeEl) {
      nodeEl.style.setProperty("--x", `${node.x}px`);
      nodeEl.style.setProperty("--y", `${node.y}px`);
    }
    if (state.interaction.kind === "group") {
      state.interaction.childOriginals.forEach((childOriginal) => {
        const child = getItem(childOriginal.id);
        const childEl = child ? dom.itemLayer.querySelector(`[data-item-id="${cssIdent(child.id)}"]`) : null;
        if (childEl) {
          childEl.style.setProperty("--x", `${child.x}px`);
          childEl.style.setProperty("--y", `${child.y}px`);
        }
      });
    }
    const quality = placementQuality(
      { x: node.x, y: node.y, w: node.w, h: node.h },
      placementOptionsForNode(state.interaction.kind, node, {
        ignoreIds: ignoreIdsForMovingNode(state.interaction.kind, node),
        allowMildOverlap: event.altKey
      })
    );
    setLayoutFeedback(quality.blocked ? "blocked" : quality.issues.length ? "nudged" : null, quality.issues);
    scheduleInteractionChromeUpdate(state.interaction.impactedConnectorIds);
    return;
  }

  if (state.interaction.type === "resize-node") {
    const node = state.interaction.kind === "item" ? getItem(state.interaction.id) : getGroup(state.interaction.id);
    if (!node) return;
    resizeNodeFromPoint(node, state.interaction.original, state.interaction.handle, point);
    const nodeSelectorId = cssIdent(node.id);
    const nodeEl = dom.itemLayer.querySelector(state.interaction.kind === "item" ? `[data-item-id="${nodeSelectorId}"]` : `[data-group-id="${nodeSelectorId}"]`);
    if (nodeEl) {
      nodeEl.style.setProperty("--x", `${node.x}px`);
      nodeEl.style.setProperty("--y", `${node.y}px`);
      nodeEl.style.setProperty("--w", `${node.w}px`);
      nodeEl.style.setProperty("--h", `${node.h}px`);
    }
    scheduleInteractionChromeUpdate(state.interaction.impactedConnectorIds);
    return;
  }

  if (state.interaction.type === "maybe-edit-connector-label") {
    const dx = event.clientX - state.interaction.startClient.x;
    const dy = event.clientY - state.interaction.startClient.y;
    if (Math.hypot(dx, dy) < 5) return;
    state.interaction = {
      type: "drag-connector",
      connectorId: state.interaction.connectorId,
      role: "label",
      endpointStartedAttached: false,
      impactedConnectorIds: [state.interaction.connectorId],
      historyBefore: state.interaction.historyBefore
    };
    resetDragDiagnostics();
    state.inputDiagnostics.impactedConnectorCount = 1;
    state.inputDiagnostics.impactedConnectorIdsDuringDrag = [state.interaction.connectorId];
    document.body.classList.add("dragging");
    setDragPerformanceActive(true);
  }

  if (state.interaction.type === "maybe-drag-connector-body") {
    if (Math.hypot(point.x - state.interaction.start.x, point.y - state.interaction.start.y) < 5) return;
    const conn = getConnector(state.interaction.connectorId);
    const bothFree = conn && isFreeEndpoint(conn.source) && isFreeEndpoint(conn.target);
    if (!conn) {
      state.interaction.type = "connector-body-noop";
      return;
    }
    state.interaction.type = "drag-connector-body";
    state.interaction.impactedConnectorIds = [state.interaction.connectorId];
    resetDragDiagnostics();
    state.inputDiagnostics.impactedConnectorCount = 1;
    state.inputDiagnostics.impactedConnectorIdsDuringDrag = [state.interaction.connectorId];
    document.body.classList.add("dragging");
    setDragPerformanceActive(true);
  }

  if (state.interaction.type === "drag-connector-body") {
    const conn = getConnector(state.interaction.connectorId);
    if (!conn) return;
    if (isFreeEndpoint(state.interaction.originalSource) && isFreeEndpoint(state.interaction.originalTarget)) {
      const dx = point.x - state.interaction.start.x;
      const dy = point.y - state.interaction.start.y;
      conn.source = { x: clamp(state.interaction.originalSource.x + dx, 0, WORLD.width), y: clamp(state.interaction.originalSource.y + dy, 0, WORLD.height) };
      conn.target = { x: clamp(state.interaction.originalTarget.x + dx, 0, WORLD.width), y: clamp(state.interaction.originalTarget.y + dy, 0, WORLD.height) };
      if (state.interaction.originalMid) conn.mid = { x: clamp(state.interaction.originalMid.x + dx, 0, WORLD.width), y: clamp(state.interaction.originalMid.y + dy, 0, WORLD.height) };
      if (state.interaction.originalLabelPoint) conn.labelPoint = { x: clamp(state.interaction.originalLabelPoint.x + dx, 0, WORLD.width), y: clamp(state.interaction.originalLabelPoint.y + dy, 0, WORLD.height) };
      scheduleInteractionChromeUpdate(state.interaction.impactedConnectorIds);
      return;
    }
    conn.mid = nearestClearConnectorPoint(point, conn);
    conn.manualMid = true;
    conn.routeStyle = "freeform";
    scheduleInteractionChromeUpdate(state.interaction.impactedConnectorIds);
    return;
  }

  if (state.interaction.type === "drag-connector") {
    const conn = getConnector(state.interaction.connectorId);
    if (!conn) return;

    if (state.interaction.role === "bend") {
      conn.mid = nearestClearConnectorPoint(point, conn);
      conn.manualMid = true;
      state.hoverItemId = null;
    } else if (state.interaction.role === "label") {
      conn.labelPoint = nearestClearConnectorPoint(point, conn, 18);
      conn.labelMode = "manual";
      state.hoverItemId = null;
    } else {
      const radius = state.interaction.endpointStartedAttached ? EDGE_PIN_SNAP_RADIUS : 44;
      const nearest = nearestEndpointSnapNode(point, conn, state.interaction.role, {
        radius,
        keepCurrent: state.interaction.endpointStartedAttached
      });
      if (nearest) {
        pinConnectorEndpoint(conn, state.interaction.role, point, nearest);
      } else {
        conn[state.interaction.role] = { x: point.x, y: point.y };
      }
      state.hoverItemId = nearest ? nearest.id : null;
    }
    dom.itemLayer.querySelectorAll(".canvas-item.is-snap-target, .canvas-group.is-snap-target").forEach((node) => node.classList.remove("is-snap-target"));
    if (state.hoverItemId) {
      const selectorId = cssIdent(state.hoverItemId);
      dom.itemLayer.querySelector(`[data-item-id="${selectorId}"], [data-group-id="${selectorId}"]`)?.classList.add("is-snap-target");
    }
    scheduleInteractionChromeUpdate(state.interaction.impactedConnectorIds);
  }
}

export function resizeNodeFromPoint(node, original, handle, point) {
  let left = original.x - original.w / 2;
  let right = original.x + original.w / 2;
  let top = original.y - original.h / 2;
  let bottom = original.y + original.h / 2;

  if (handle.includes("w")) left = clamp(point.x, 0, right - 72);
  if (handle.includes("e")) right = clamp(point.x, left + 72, WORLD.width);
  if (handle.includes("n")) top = clamp(point.y, 0, bottom - 44);
  if (handle.includes("s")) bottom = clamp(point.y, top + 44, WORLD.height);

  node.w = right - left;
  node.h = bottom - top;
  node.x = left + node.w / 2;
  node.y = top + node.h / 2;
}

export function distanceToNode(point, node) {
  const dx = Math.max(Math.abs(point.x - node.x) - node.w / 2, 0);
  const dy = Math.max(Math.abs(point.y - node.y) - node.h / 2, 0);
  return Math.hypot(dx, dy);
}

export function nearestSnapNode(point, conn, role, options = {}) {
  const opposite = role === "source" ? conn.target.itemId : conn.source.itemId;
  let nearest = null;
  let nearestDistance = Infinity;
  getAnchorableNodes().forEach((node) => {
    if (node.id === opposite) return;
    const distance = distanceToNode(point, node);
    if (distance < nearestDistance) {
      nearest = node;
      nearestDistance = distance;
    }
  });
  return nearestDistance <= (options.radius || 44) ? nearest : null;
}

export function endInteraction(event) {
  const endedInteraction = state.interaction;
  if (state.interaction?.type === "place-node") {
    state.interaction.point = pointFromEvent(event);
    state.interaction.hasMoved = Math.hypot(
      state.interaction.point.x - state.interaction.start.x,
      state.interaction.point.y - state.interaction.start.y
    ) > 5;
  }
  if (state.interaction?.type === "edge-connector") {
    state.interaction.point = pointFromEvent(event);
    const target = nearestConnectorNode(state.interaction.point, state.interaction.sourceId, { event });
    if (target) state.interaction.targetId = target.id;
  }
  if (state.interaction?.type === "drag-connector" && (state.interaction.role === "source" || state.interaction.role === "target")) {
    const conn = getConnector(state.interaction.connectorId);
    const dropPoint = pointFromEvent(event);
    const radius = state.interaction.endpointStartedAttached ? EDGE_PIN_SNAP_RADIUS : 44;
    const nearest = conn ? nearestEndpointSnapNode(dropPoint, conn, state.interaction.role, {
      radius,
      keepCurrent: state.interaction.endpointStartedAttached
    }) : null;
    if (conn && nearest) {
      pinConnectorEndpoint(conn, state.interaction.role, dropPoint, nearest);
    }
  }

  if (state.interaction?.type === "pan" && !state.interaction.moved) {
    state.selection = null;
    clearMultiSelection();
    state.editingItemId = null;
    state.editingField = null;
    state.editingTarget = null;
    state.inspectorOpen = false;
    state.activePopover = null;
    renderAll();
  } else if (state.interaction?.type === "pan") {
    settleViewport();
  }

  flushInteractionChromeUpdate();
  state.interaction = null;
  removePlacementPreview();
  clearConnectorPreviewChrome();
  if (!["place-node", "drag-node"].includes(endedInteraction?.type)) clearLayoutFeedback();
  document.body.classList.remove("dragging");
  document.body.classList.remove("creating-connector");
  document.body.classList.remove("creating-node");
  setDragPerformanceActive(false);
  endInteractionPointer();
  if (endedInteraction?.type === "place-node") {
    const paletteItem = paletteById(endedInteraction.kind, endedInteraction.presetId);
    const bounds = paletteItem ? placementBounds(
      endedInteraction.kind,
      paletteItem,
      endedInteraction.start,
      endedInteraction.point,
      endedInteraction.hasMoved
    ) : null;
    const placement = bounds ? findClearPlacement(
      bounds,
      placementOptionsForPalette(endedInteraction.kind, paletteItem)
    ) : null;
    if (placement?.status === "blocked") {
      setLayoutFeedback("blocked", placement.issues || []);
      renderAll();
      return;
    }
    const created = placement ? createNodeFromPalette(endedInteraction.kind, endedInteraction.presetId, placement.bounds) : null;
    if (!created) {
      renderAll();
      return;
    }
    state.selection = created;
    clearMultiSelection();
    state.inspectorOpen = false;
    state.activePopover = null;
    const firstField = endedInteraction.kind === "finance" ? "financeValue" : "label";
    if (["text", "shape", "finance"].includes(endedInteraction.kind)) {
      state.editingItemId = created.id;
      state.editingField = firstField;
      state.editingTarget = { kind: "item", id: created.id, field: firstField };
      state.pendingEditField = firstField;
      state.pendingEditFocus = true;
    }
    setLayoutFeedback(placement.status === "nudged" ? "nudged" : null, placement.issues || []);
    commitHistoryFrom(endedInteraction.historyBefore);
    renderAll();
    return;
  }
  if (endedInteraction?.type === "edge-connector") {
    if (endedInteraction.targetId) {
      const sourceNode = getNode(endedInteraction.sourceId);
      const targetNode = getNode(endedInteraction.targetId);
      const connectorId = `connector-${state.nextConnectorNumber++}`;
      const style = connectorStyleForPreset(endedInteraction.presetId);
      const createdConnector = connector(
        connectorId,
        "Transfer",
        "transfer",
        0,
        sourceNode ? edgePinnedEndpoint(endedInteraction.start, sourceNode, endedInteraction.edge) : endedInteraction.sourceId,
        targetNode ? edgePinnedEndpoint(endedInteraction.point, targetNode) : endedInteraction.targetId,
        { routeStyle: style.routeStyle, strokeStyle: style.strokeStyle, max: 500000 }
      );
      state.connectors.push(createdConnector);
      state.selection = { kind: "connector", id: connectorId };
      clearMultiSelection();
      commitHistoryFrom(endedInteraction.historyBefore);
      flashForConnector(createdConnector, { duration: 640, render: true });
      return;
    }
    renderAll();
    return;
  }
  if (endedInteraction?.type === "maybe-edit-connector-label") {
    startConnectorEditing(endedInteraction.connectorId, endedInteraction.field || "relationship");
    return;
  }
  if (endedInteraction?.type === "drag-node") {
    const node = endedInteraction.kind === "item" ? getItem(endedInteraction.id) : getGroup(endedInteraction.id);
    if (node) {
      const result = findClearPlacement(
        { x: node.x, y: node.y, w: node.w, h: node.h },
        placementOptionsForNode(endedInteraction.kind, node, {
          ignoreIds: ignoreIdsForMovingNode(endedInteraction.kind, node),
          allowMildOverlap: Boolean(event?.altKey),
          viewportOnly: false,
          maxSearchRadius: event?.altKey ? 0 : 260
        })
      );
      if (result.status === "blocked") {
        restoreDraggedNodePosition(endedInteraction);
        setLayoutFeedback("blocked", result.issues || []);
      } else {
        moveDraggedNodeTo(endedInteraction.kind, node, result.bounds.x, result.bounds.y);
        setLayoutFeedback(result.status === "nudged" ? "nudged" : null, result.issues || []);
      }
    }
  }
  if (endedInteraction?.type === "maybe-drag-node") {
    const wasInspectorOpen = document.body.classList.contains("inspector-open");
    const prevSelectionKey = state.selection ? `${state.selection.kind}:${state.selection.id}` : null;
    const newSelectionKey = `${endedInteraction.kind}:${endedInteraction.id}`;
    state.selection = { kind: endedInteraction.kind, id: endedInteraction.id };
    clearMultiSelection();
    state.editingItemId = null;
    state.editingField = null;
    state.editingTarget = null;
    state.pendingEditField = null;
    state.inspectorOpen = false;
    state.activePopover = null;
    if (prevSelectionKey !== newSelectionKey) {
      dom.itemLayer.querySelectorAll(".canvas-item.is-selected, .canvas-group.is-selected").forEach((el) => el.classList.remove("is-selected"));
      const selectorId = cssIdent(endedInteraction.id);
      const selector = endedInteraction.kind === "item" ? `[data-item-id="${selectorId}"]` : `[data-group-id="${selectorId}"]`;
      dom.itemLayer.querySelector(selector)?.classList.add("is-selected");
    }
    renderHud();
    scheduleInspectorFitIfOpening(wasInspectorOpen);
    return;
  }
  if (["drag-node", "resize-node", "drag-connector", "drag-connector-body", "maybe-drag-connector-body", "connector-body-noop"].includes(endedInteraction?.type)) {
    commitHistoryFrom(endedInteraction.historyBefore);
    // Placement and route previews already validate the affected object. A second
    // full-document geometry audit here caused >1s pointer-up stalls on Estate.
    // The explicit Tidy command and presentation entry retain full repair.
    if (endedInteraction.type !== "drag-node") clearLayoutFeedback();
  }
  if (endedInteraction?.type === "drag-node") {
    const now = window.performance?.now?.() || Date.now();
    state.suppressDirectEditClickUntil = now + 500;
  }
  if (["drag-node", "drag-connector", "drag-connector-body", "maybe-drag-connector-body", "connector-body-noop"].includes(endedInteraction?.type)) {
    updateConnectorValues({ finalReconcile: true });
    return;
  }
  renderAll();
}

export function flashForConnector(conn, options = {}) {
  const duration = options.duration || 520;
  setHotStateForConnectors([conn], duration);
  if (options.render) {
    renderAll();
  } else {
    updateItemValues();
    updateConnectorValues({ geometry: false });
    updateScenarioReadouts();
  }
}

export function updateConnectorAmount(conn, value, options = {}) {
  const displayAmount = parseMoney(value);
  const nextAmount = clamp(connectorStoredAmountFromDisplay(conn, displayAmount), 0, conn.max || 1000000);
  conn.amount = nextAmount;
  conn.manualAmount = true;
  conn.amountSource = "manual";
  state.pendingConnectorAmountPreview = null;
  syncComputedValues({ animateDelta: true });
  setHotStateForConnectors([conn], options.duration || 520);
  applyPresentationRepairFeedback();
  if (options.render) {
    renderAll();
  } else {
    updateItemValues();
    updateConnectorValues({ geometry: false });
    updateScenarioReadouts();
  }
}

export function previewConnectorAmount(conn, value) {
  const displayAmount = parseMoney(value);
  const nextAmount = clamp(connectorStoredAmountFromDisplay(conn, displayAmount), 0, conn.max || 1000000);
  conn.amount = nextAmount;
  conn.manualAmount = true;
  conn.amountSource = "manual";
  state.pendingConnectorAmountPreview = { id: conn.id };
  updateConnectorValues({ geometry: false });
}

export function resetConnectorAmountLink(conn, options = {}) {
  if (!conn?.scenarioKey) return;
  // C7: restore the linked amount (driver value, else the authored template
  // amount) AND commit exactly one reversible history entry so the button resets
  // the money, not just the badge, and Ctrl+Z returns to the manual value.
  const before = options.skipHistory ? null : historySnapshot();
  delete conn.manualAmount;
  delete conn.amountSource;
  conn.amount = scenarioAmountForConnector(conn);
  if (before) commitHistoryFrom(before);
  state.pendingConnectorAmountPreview = null;
  syncComputedValues({ animateDelta: true });
  setHotStateForConnectors([conn], options.duration || 520);
  applyPresentationRepairFeedback();
  if (options.render) {
    renderAll();
  } else {
    updateItemValues();
    updateConnectorValues({ geometry: false });
    updateScenarioReadouts();
  }
}

export const historyHudInputs = new Set([
  "item-label",
  "item-subtitle",
  "item-note",
  "group-label",
  "sleeve-label",
  "sleeve-note",
  "sleeve-value",
  "sleeve-capacity",
  "finance-value",
  "finance-capacity",
  "scenario-monthly-need",
  "scenario-monthly-need-range",
  "connector-label",
  "connector-amount",
  "connector-amount-range",
  "connector-custom-width"
]);
export const moneyHudInputs = new Set(["finance-value", "finance-capacity", "scenario-monthly-need", "connector-amount", "sleeve-value", "sleeve-capacity"]);

export function moneyValueForInput(target) {
  const input = target?.dataset?.input;
  if (state.selection?.kind === "item") {
    const item = getItem(state.selection.id);
    if (item?.financeId && input === "finance-value") return state.financeData[item.financeId]?.value || 0;
    if (item?.financeId && input === "finance-capacity") return state.financeData[item.financeId]?.capacity || 1;
    if (input === "scenario-monthly-need") return state.scenario.monthlyNeed || 0;
  }
  if (state.selection?.kind === "connector" && input === "connector-amount") {
    return connectorDisplayAmount(getConnector(state.selection.id));
  }
  if (state.selection?.kind === "sleeve") {
    const selected = findSubBucket(state.selection.itemId, state.selection.sleeveId);
    if (input === "sleeve-value") return selected?.bucket?.value ?? 0;
    if (input === "sleeve-capacity") return selected?.bucket?.capacity ?? 1;
  }
  return parseMoney(target?.value);
}

export function isTextMoneyInput(target) {
  return Boolean(target?.matches?.("input") && target.type !== "range" && moneyHudInputs.has(target.dataset.input));
}

export function focusMoneyInput(target) {
  if (!isTextMoneyInput(target)) return;
  target.value = plainMoneyInput(moneyValueForInput(target));
  target.select?.();
}

export function formatMoneyInputTarget(target) {
  if (!isTextMoneyInput(target)) return;
  target.value = formatMoneyInput(moneyValueForInput(target));
}

export function beginHudInputHistory(target) {
  const input = target?.dataset?.input;
  if (!historyHudInputs.has(input)) return;
  if (state.hudInputHistory?.target === target) return;
  state.hudInputHistory = { target, before: historySnapshot() };
}

export function finishHudInputHistory(target) {
  if (!state.hudInputHistory || state.hudInputHistory.target !== target) return;
  const historyBefore = state.hudInputHistory.before;
  state.hudInputHistory = null;
  commitHistoryFrom(historyBefore);
}

export function beginScenarioInputHistory(target) {
  if (!target?.dataset?.scenario) return;
  if (state.scenarioInputHistory?.target === target) return;
  state.scenarioInputHistory = { target, before: historySnapshot() };
}

export function finishScenarioInputHistory(target) {
  if (!state.scenarioInputHistory || state.scenarioInputHistory.target !== target) return;
  const historyBefore = state.scenarioInputHistory.before;
  state.scenarioInputHistory = null;
  commitHistoryFrom(historyBefore);
}

export function setSelectedField(kind, field, value) {
  if (kind === "item-field" && state.selection?.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item) return;
    commitHistory();
    if (field === "shape") item.shape = value;
    if (field === "visual" && item.type === "finance") item.visual = value;
    if (field === "category" && item.financeId) {
      const data = state.financeData[item.financeId];
      data.category = value;
      item.subtitle = accountCategories[value] || value;
    }
    if (field === "textStyle") {
      item.style = item.style || {};
      item.style.textStyle = value;
    }
    applyPresentationRepairFeedback();
    renderAll();
    return;
  }

  if (kind === "connector-field" && state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    if (!conn) return;
    commitHistory();
    if (field === "flowType") {
      applyFlowTypePreset(conn, value);
    } else if (field === "routeStyle") {
      conn.routeStyle = value;
      if (value === "straight") {
        conn.mid = null;
        conn.manualMid = false;
      }
    } else if (field === "labelMode") {
      conn.labelMode = value;
      if (value !== "manual") conn.labelPoint = null;
    } else {
      conn[field] = value;
    }
    applyPresentationRepairFeedback();
    renderAll();
  }
}

export function updateScenario(key, rawValue) {
  if (key === "annuityOn") {
    state.scenario.annuityOn = Boolean(rawValue);
  } else {
    const nextValue = Number(rawValue);
    state.scenario[key] = Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0;
  }
  const impacted = state.connectors.filter((conn) => {
    if (connectorHasManualAmount(conn)) return false;
    if (key === "monthlyDistribution") return conn.scenarioKey === "monthlyDistribution";
    if (key === "guaranteedIncome") return conn.scenarioKey === "guaranteedIncome";
    if (key === "flexibleIncome") return conn.scenarioKey === "flexibleIncome";
    if (key === "annuityOn" || key === "annuityMonthlyIncome") return conn.scenarioKey === "monthlyDistribution" || conn.scenarioKey === "annuityIncome";
    if (key === "annuityPremium") return conn.scenarioKey === "annuityPremium";
    if (key === "rollover") return conn.scenarioKey === "rollover";
    if (key === "rothConversion" || key === "taxReservePct") return conn.scenarioKey === "rothConversion" || conn.scenarioKey === "taxPayment";
    return false;
  });
  setHotStateForConnectors(impacted, 520);
  syncComputedValues({ animateDelta: true });
  updateItemValues();
  updateConnectorValues({ geometry: false });
  updateScenarioReadouts();
}
