import { state, dom, WORLD, initDomRefs, setRenderAllCallback, TEST_MODE, defaultScenario, defaultMeetingState, defaultMotionState, clone, clearHistory, commitHistory, commitHistoryFrom, restoreHistorySnapshot, undoHistory, redoHistory, compactDollars, parseMoney, formatMoneyInput, plainMoneyInput, clamp, getItem, getGroup, getConnector, clearMultiSelection, selectedItemIds, hasMultiSelection, isFormField, isLockedNode, toggleMultiSelectItem, escapeHtml, kebab } from "./state.js";
import { templateFactories, applyTheme } from "./templates.js";
import { constrainViewport, syncComputedValues, computeCanvasViewModel, invalidateComputedViewModel, getComputeDiagnostics, resetComputeDiagnostics, connectorStoredAmountFromDisplay } from "./compute.js";
import { renderAll, renderCanvasSurface, renderCanvasOnly, renderItems, renderConnectors, renderHud, renderInventory, updateItemValues, updateConnectorValues, restoreHudScroll, selectionKey, setConnectorLabelHandlers, renderTemplateCatalog, findSubBucket, sectionForPopoverKind, getRenderDiagnostics, resetRenderDiagnostics, setHudRangeDragActive } from "./render.js";
import { selectItem, selectGroup, selectConnector, selectSleeve, startSleeveEditing, startConnectorEditing, startConnectorLabelMaybeDrag, startEdgeConnectorDrag, startResizeNode, startDragNode, startConnectorDrag, startConnectorBodyDrag, startCanvasNodePointer, startCanvasPlacement, startConnectorToolDrag, startPan, startHudDrag, startHudResize, startToolbarDrag, startPopoverDrag, setSelectedField, previewConnectorAmount, updateConnectorAmount, resetConnectorAmountLink, updateScenario, beginHudInputHistory, finishHudInputHistory, beginScenarioInputHistory, finishScenarioInputHistory, focusMoneyInput, formatMoneyInputTarget, isTextMoneyInput, detachConnectorEndpoints, reattachConnectorEndpoints, startEditing, endInteraction, handleInteractionMove, cancelInteraction, deleteSelection, duplicateSelection, groupSelection, ungroupSelection, splitFinancePreset, reverseConnector, quickAdjustSelectedValue, canvasNodeFromClientPoint, financeEdgeFromClientPoint, armCreationPreset, switchToolDock, ensureCreationPresetForDock, tidyCanvasLayout } from "./interaction.js";
import { setZoom, fitView, fitInitialTemplateView, placeViewportAtZoom, renderViewport, scheduleViewportSettle, setRenderHudCallback } from "./viewport.js";
import { detectLayoutIssues, repairPresentationLayout } from "./layoutQuality.js";

initDomRefs();
setRenderAllCallback(renderAll);
setRenderHudCallback(renderHud);
setConnectorLabelHandlers({ startConnectorDrag, startConnectorBodyDrag, startConnectorLabelMaybeDrag, selectConnector, canvasNodeFromClientPoint });

const DELETE_TOAST_MS = 4000;
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 480;
let deleteToastTimer = null;

function isActiveTextEditTarget(node) {
  return Boolean(node?.closest?.("input, textarea, select"));
}


// === BOOTSTRAP ===

function hideDeleteToast() {
  window.clearTimeout(deleteToastTimer);
  deleteToastTimer = null;
  if (dom.toastHost) dom.toastHost.innerHTML = "";
}

function deleteToastMessage() {
  if (hasMultiSelection()) return "Selection deleted";
  if (!state.selection) return null;

  if (state.selection.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item) return null;
    const label = String(item.label || "").trim();
    return `${label || "Tile"} deleted`;
  }

  if (state.selection.kind === "connector") {
    return getConnector(state.selection.id) ? "Connector deleted" : null;
  }

  if (state.selection.kind === "group") {
    return getGroup(state.selection.id) ? "Selection deleted" : null;
  }

  return null;
}

function showDeleteToast(message) {
  if (!dom.toastHost || !message) return;
  hideDeleteToast();

  const toast = document.createElement("div");
  toast.className = "delete-toast";

  const copy = document.createElement("span");
  copy.textContent = message;
  toast.append(copy);

  const separator = document.createElement("span");
  separator.className = "toast-separator";
  separator.setAttribute("aria-hidden", "true");
  separator.textContent = "\u00b7";
  toast.append(separator);

  const undoButton = document.createElement("button");
  undoButton.type = "button";
  undoButton.dataset.toastAction = "undo-delete";
  undoButton.textContent = "Undo";
  toast.append(undoButton);

  dom.toastHost.append(toast);
  deleteToastTimer = window.setTimeout(hideDeleteToast, DELETE_TOAST_MS);
}

function deleteSelectionWithToast() {
  const message = deleteToastMessage();
  const deleted = deleteSelection();
  if (deleted && message) showDeleteToast(message);
}

function performUndo() {
  hideDeleteToast();
  undoHistory();
}

function performRedo() {
  hideDeleteToast();
  redoHistory();
}

function centerTemplateInWorld(template) {
  const items = template.items || [];
  if (items.length === 0) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  items.forEach((item) => {
    minX = Math.min(minX, item.x - item.w / 2);
    maxX = Math.max(maxX, item.x + item.w / 2);
    minY = Math.min(minY, item.y - item.h / 2);
    maxY = Math.max(maxY, item.y + item.h / 2);
  });
  const offsetX = Math.round(WORLD.width / 2 - (minX + maxX) / 2);
  const offsetY = Math.round(WORLD.height / 2 - (minY + maxY) / 2);
  if (offsetX === 0 && offsetY === 0) return;
  items.forEach((item) => { item.x += offsetX; item.y += offsetY; });
  (template.groups || []).forEach((g) => { g.x += offsetX; g.y += offsetY; });
  (template.layout?.lanes || []).forEach((lane) => { lane.x += offsetX; lane.y += offsetY; });
  (template.connectors || []).forEach((conn) => {
    if (conn.source && typeof conn.source.x === "number" && !conn.source.itemId) {
      conn.source.x += offsetX; conn.source.y += offsetY;
    }
    if (conn.target && typeof conn.target.x === "number" && !conn.target.itemId) {
      conn.target.x += offsetX; conn.target.y += offsetY;
    }
    if (conn.mid) { conn.mid.x += offsetX; conn.mid.y += offsetY; }
    if (conn.labelPoint) { conn.labelPoint.x += offsetX; conn.labelPoint.y += offsetY; }
  });
}

function renderStartScreen() {
  if (!dom.startScreen) return;
  dom.startScreen.innerHTML = `
    <div class="start-screen-inner">
      <section class="start-screen-hero">
        <p class="eyebrow">Create New Visual</p>
        <h2>Choose a client-ready money story</h2>
        <p>Start from a polished advisor exhibit, then adjust the values, sleeves, and flows for the meeting.</p>
        <button class="start-screen-primary-action" type="button" data-template-id="retirementPaycheck">
          Start with retirement paycheck
        </button>
      </section>
      ${renderTemplateCatalog({ compact: true })}
    </div>
  `;
}

function clearPresentationModeState() {
  clearPresentationTransitionTimer();
  document.body.classList.remove("presentation", "presentation-entering", "presentation-exiting", "presentation-ready");
}

function showStartScreen() {
  hideDeleteToast();
  clearPresentationModeState();
  state.items = [];
  state.groups = [];
  state.financeData = {};
  state.connectors = [];
  state.templateLayout = { lanes: [] };
  state.scenario = clone(defaultScenario);
  state.selection = null;
  clearMultiSelection();
  state.activeTemplateId = null;
  state.startScreenOpen = true;
  state.activeDock = "select";
  state.viewMode = "proposed";
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  state.meeting = defaultMeetingState();
  state.hotItemIds = new Set();
  state.hotConnectorIds = new Set();
  state.hoverItemId = null;
  state.layoutFeedback = null;
  state.floatingLayouts = {};
  clearHistory();
  dom.templateTitle.textContent = "Create New Visual";
  dom.templateButtonText.textContent = "Template catalog";
  renderAll();
}

function loadTemplate(id, options = {}) {
  const factory = templateFactories[id];
  if (!factory) {
    console.warn(`Unknown template id: ${id}`);
    return false;
  }
  hideDeleteToast();
  clearPresentationModeState();
  const template = factory();
  centerTemplateInWorld(template);
  state.activeTemplateId = id;
  state.startScreenOpen = false;
  state.items = clone(template.items);
  state.groups = clone(template.groups || []);
  state.financeData = clone(template.financeData || {});
  state.connectors = clone(template.connectors || []);
  state.templateLayout = clone(template.layout || { lanes: [] });
  state.scenario = clone(template.scenario || defaultScenario);
  state.selection = null;
  clearMultiSelection();
  state.activeDock = "select";
  state.viewMode = "proposed";
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  state.meeting = defaultMeetingState();
  state.hotItemIds = new Set();
  state.hotConnectorIds = new Set();
  state.hoverItemId = null;
  state.layoutFeedback = null;
  state.floatingLayouts = {};
  clearHistory();
  dom.templateTitle.textContent = template.name;
  dom.templateButtonText.textContent = template.shortName;
  if (options.repair === true) repairPresentationLayout({ restorePrimaryLabels: true });
  renderAll();
  if (options.fit !== false) requestAnimationFrame(fitInitialTemplateView);
  return true;
}

function resetCanvas() {
  if (state.activeTemplateId) loadTemplate(state.activeTemplateId);
  else showStartScreen();
}

function testState() {
  return {
    items: clone(state.items),
    groups: clone(state.groups),
    financeData: clone(state.financeData),
    connectors: clone(state.connectors),
    layout: clone(state.templateLayout),
    templateLayout: clone(state.templateLayout),
    selection: clone(state.selection),
    multiSelection: clone(state.multiSelection),
    activePopover: state.activePopover,
    activeDock: state.activeDock,
    activeCreationPreset: clone(state.activeCreationPreset),
    themeId: state.themeId,
    activeTemplateId: state.activeTemplateId,
    startScreenOpen: state.startScreenOpen,
    viewMode: state.viewMode,
    scenario: clone(state.scenario),
    currentValues: clone(state.currentValues),
    meeting: clone(state.meeting),
    motion: clone(state.motion || defaultMotionState()),
    viewport: { ...state.viewport },
    worldTransform: dom.canvasWorld.style.transform,
    diagnostics: getTestDiagnostics({ includeLayoutIssues: false })
  };
}

function getTestDiagnostics(options = {}) {
  const diagnostics = {
    interactionType: state.interaction?.type || null,
    bodyDragging: document.body.classList.contains("dragging"),
    historyPastLength: state.historyPast.length,
    historyFutureLength: state.historyFuture.length,
    hotItemIds: [...state.hotItemIds],
    hotConnectorIds: [...state.hotConnectorIds],
    motion: clone(state.motion || defaultMotionState()),
    viewport: { ...state.viewport },
    lastInteractionFrameMs: state.inputDiagnostics.lastInteractionFrameMs,
    scheduledInteractionFrames: state.inputDiagnostics.scheduledInteractionFrames,
    dragFrameCount: state.inputDiagnostics.dragFrameCount,
    maxDragFrameMs: state.inputDiagnostics.maxDragFrameMs,
    averageDragFrameMs: state.inputDiagnostics.averageDragFrameMs,
    connectorPathComputesDuringDrag: state.inputDiagnostics.connectorPathComputesDuringDrag,
    impactedConnectorCount: state.inputDiagnostics.impactedConnectorCount,
    impactedConnectorIdsDuringDrag: [...(state.inputDiagnostics.impactedConnectorIdsDuringDrag || [])],
    updatedConnectorIdsDuringDrag: [...(state.inputDiagnostics.updatedConnectorIdsDuringDrag || [])],
    fullConnectorPassesDuringDrag: state.inputDiagnostics.fullConnectorPassesDuringDrag,
    fullRenderDuringDrag: state.inputDiagnostics.fullRenderDuringDrag,
    finalConnectorPassesAfterDrop: state.inputDiagnostics.finalConnectorPassesAfterDrop,
    layoutFeedback: clone(state.layoutFeedback)
  };
  if (options.includeLayoutIssues !== false) diagnostics.layoutIssues = detectLayoutIssues();
  return diagnostics;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonnegativeNumber(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function positiveNumber(value, fallback = 1) {
  return Math.max(1, finiteNumber(value, fallback));
}

function fallbackId(kind, index, usedIds) {
  const base = `${kind}-${index + 1}`;
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }

  let suffix = 2;
  while (usedIds.has(`${base}-${suffix}`)) suffix += 1;
  const id = `${base}-${suffix}`;
  usedIds.add(id);
  return id;
}

function stableId(value, kind, index, usedIds) {
  if (typeof value === "string" && value.trim()) {
    const base = value.trim();
    if (!usedIds.has(base)) {
      usedIds.add(base);
      return base;
    }
    let suffix = 2;
    while (usedIds.has(`${base}-${suffix}`)) suffix += 1;
    const id = `${base}-${suffix}`;
    usedIds.add(id);
    return id;
  }
  return fallbackId(kind, index, usedIds);
}

function sanitizePoint(value) {
  if (!value || typeof value !== "object") return null;
  return {
    x: finiteNumber(value.x, WORLD.width / 2),
    y: finiteNumber(value.y, WORLD.height / 2)
  };
}

function sanitizeEndpoint(value) {
  if (typeof value === "string" && value.trim()) return { itemId: value };
  if (!value || typeof value !== "object") return { x: WORLD.width / 2, y: WORLD.height / 2 };

  if (typeof value.itemId === "string" && value.itemId.trim()) {
    const endpoint = { itemId: value.itemId };
    if (typeof value.port === "string" && value.port.trim()) endpoint.port = value.port.trim();
    if (typeof value.portId === "string" && value.portId.trim()) endpoint.portId = value.portId.trim();
    if ("offsetX" in value) endpoint.offsetX = finiteNumber(value.offsetX, 0);
    if ("offsetY" in value) endpoint.offsetY = finiteNumber(value.offsetY, 0);
    return endpoint;
  }

  return {
    x: finiteNumber(value.x, WORLD.width / 2),
    y: finiteNumber(value.y, WORLD.height / 2)
  };
}

function sanitizeSizedNode(node, kind, index, usedIds, defaults) {
  const source = node && typeof node === "object" ? node : {};
  return {
    ...source,
    id: stableId(source.id, kind, index, usedIds),
    x: finiteNumber(source.x, defaults.x),
    y: finiteNumber(source.y, defaults.y),
    w: positiveNumber(source.w, defaults.w),
    h: positiveNumber(source.h, defaults.h),
    zIndex: finiteNumber(source.zIndex, defaults.zIndex)
  };
}

function stableSleeveId(bucket, index, usedIds) {
  const source = bucket && typeof bucket === "object" ? bucket : {};
  const explicit = typeof source.id === "string" && source.id.trim() ? source.id.trim() : "";
  const label = source.label ?? source.name ?? source.title ?? "";
  const base = explicit || kebab(label || `sleeve-${index + 1}`) || `sleeve-${index + 1}`;
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }
  let suffix = 2;
  while (usedIds.has(`${base}-${suffix}`)) suffix += 1;
  const id = `${base}-${suffix}`;
  usedIds.add(id);
  return id;
}

function sanitizeSubBuckets(subBuckets) {
  const entries = Array.isArray(subBuckets)
    ? subBuckets.map((entry) => (entry && typeof entry === "object" ? { ...entry } : { label: String(entry ?? ""), value: 0 }))
    : subBuckets && typeof subBuckets === "object"
      ? Object.entries(subBuckets).map(([label, entry]) => (
        entry && typeof entry === "object"
          ? { id: String(entry.id || kebab(label) || label), label, ...entry }
          : { id: kebab(label) || label, label, value: entry }
      ))
      : [];
  const usedIds = new Set();
  return entries.map((entry, index) => {
    const value = nonnegativeNumber(entry.value ?? entry.amount ?? entry.balance, 0);
    const capacity = positiveNumber(entry.capacity ?? entry.max, Math.max(1, value));
    return {
      ...entry,
      id: stableSleeveId(entry, index, usedIds),
      value,
      capacity
    };
  });
}

function sanitizeFinanceData(financeData) {
  if (!financeData || typeof financeData !== "object") return {};
  return Object.fromEntries(Object.entries(financeData).map(([id, data]) => {
    const source = data && typeof data === "object" ? data : {};
    const value = nonnegativeNumber(source.value, 0);
    const capacity = positiveNumber(source.capacity, Math.max(1, value));
    const sanitized = {
      ...source,
      value,
      capacity,
      baseValue: nonnegativeNumber(source.baseValue, value)
    };
    if (source.subBuckets) sanitized.subBuckets = sanitizeSubBuckets(source.subBuckets);
    return [id, sanitized];
  }));
}

function sanitizeScenario(scenario) {
  const source = scenario && typeof scenario === "object" ? scenario : {};
  return Object.fromEntries(Object.entries(defaultScenario).map(([key, fallback]) => {
    if (typeof fallback === "number") return [key, finiteNumber(source[key], fallback)];
    if (typeof fallback === "boolean") return [key, typeof source[key] === "boolean" ? source[key] : fallback];
    return [key, source[key] ?? fallback];
  }));
}

function sanitizeConnector(connector, index, usedIds) {
  const source = connector && typeof connector === "object" ? connector : {};
  const amount = nonnegativeNumber(source.amount, 0);
  return {
    ...source,
    id: stableId(source.id, "connector", index, usedIds),
    amount,
    max: positiveNumber(source.max, Math.max(1, amount)),
    customWidth: positiveNumber(source.customWidth, 5),
    source: sanitizeEndpoint(source.source),
    target: sanitizeEndpoint(source.target),
    mid: sanitizePoint(source.mid),
    labelPoint: sanitizePoint(source.labelPoint)
  };
}

function sanitizeTestDiagram(diagram) {
  const source = diagram && typeof diagram === "object" ? diagram : {};
  const usedItemIds = new Set();
  const usedGroupIds = new Set();
  const usedConnectorIds = new Set();

  return {
    ...source,
    items: Array.isArray(source.items)
      ? source.items.map((item, index) => sanitizeSizedNode(item, "item", index, usedItemIds, {
        x: WORLD.width / 2,
        y: WORLD.height / 2,
        w: 240,
        h: 120,
        zIndex: 20
      }))
      : [],
    groups: Array.isArray(source.groups)
      ? source.groups.map((group, index) => sanitizeSizedNode(group, "group", index, usedGroupIds, {
        x: WORLD.width / 2,
        y: WORLD.height / 2,
        w: 320,
        h: 180,
        zIndex: 8
      }))
      : [],
    financeData: sanitizeFinanceData(source.financeData),
    connectors: Array.isArray(source.connectors)
      ? source.connectors.map((connector, index) => sanitizeConnector(connector, index, usedConnectorIds))
      : [],
    layout: (source.layout || source.templateLayout) && typeof (source.layout || source.templateLayout) === "object"
      ? clone(source.layout || source.templateLayout)
      : { lanes: [] },
    scenario: sanitizeScenario(source.scenario)
  };
}

function loadTestDiagram(diagram) {
  hideDeleteToast();
  clearPresentationModeState();
  const sanitized = sanitizeTestDiagram(diagram);
  state.items = sanitized.items;
  state.groups = sanitized.groups;
  state.financeData = sanitized.financeData;
  state.connectors = sanitized.connectors;
  state.templateLayout = clone(sanitized.layout || { lanes: [] });
  state.scenario = sanitized.scenario;
  state.activeTemplateId = null;
  state.startScreenOpen = false;
  state.selection = null;
  clearMultiSelection();
  state.activePopover = null;
  state.inspectorOpen = false;
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.layoutFeedback = null;
  state.floatingLayouts = {};
  state.meeting = defaultMeetingState();
  clearHistory();
  dom.templateTitle.textContent = sanitized.name || "Custom Visual";
  dom.templateButtonText.textContent = "Template catalog";
  repairPresentationLayout({ restorePrimaryLabels: true });
  renderAll();
  if (diagram?.fit === true) requestAnimationFrame(fitView);
}

function installTestApi() {
  if (!TEST_MODE) return;
  window.__AFV_TEST__ = {
    getState: testState,
    getComputedViewModel: computeCanvasViewModel,
    getComputeDiagnostics,
    resetComputeDiagnostics,
    getRenderDiagnostics,
    resetRenderDiagnostics,
    loadTemplate: (id, options = {}) => loadTemplate(id, options),
    loadDiagram: loadTestDiagram,
    fit: fitView,
    setTheme: (id) => {
      applyTheme(id);
      state.activeDock = "select";
      renderAll();
    },
    setScenario: updateScenario,
    setMotionEnabled: (enabled, connectorId = null) => {
      state.motion = state.motion || defaultMotionState();
      state.motion.disabledConnectorIds = Array.isArray(state.motion.disabledConnectorIds)
        ? state.motion.disabledConnectorIds
        : [];
      if (typeof connectorId === "string" && connectorId) {
        const disabled = new Set(state.motion.disabledConnectorIds);
        if (enabled === false) disabled.add(connectorId);
        else disabled.delete(connectorId);
        state.motion.disabledConnectorIds = [...disabled];
      } else {
        state.motion.enabled = Boolean(enabled);
      }
      invalidateComputedViewModel();
      updateConnectorValues({ geometry: false });
    },
    select: (kind, id) => {
      if (kind === "item") selectItem(id);
      if (kind === "group") selectGroup(id);
      if (kind === "connector") selectConnector(id);
      if (kind === "sleeve" && typeof id === "object") selectSleeve(id.itemId, id.sleeveId);
    },
    openPopover: (kind) => {
      state.activePopover = sectionForPopoverKind(kind);
      state.inspectorOpen = true;
      renderAll();
      requestAnimationFrame(() => {
        if (document.body.classList.contains("inspector-open")) fitView();
      });
    },
    clearSelection: () => {
      state.selection = null;
      clearMultiSelection();
      state.activePopover = null;
      state.inspectorOpen = false;
      state.editingItemId = null;
      state.editingField = null;
      state.editingTarget = null;
      renderAll();
    },
    detachConnector: (id) => {
      state.selection = { kind: "connector", id };
      clearMultiSelection();
      detachConnectorEndpoints({ skipHistory: true });
    },
    reattachConnector: (id) => {
      state.selection = { kind: "connector", id };
      clearMultiSelection();
      reattachConnectorEndpoints({ skipHistory: true });
    },
    tidy: tidyCanvasLayout,
    getDiagnostics: () => getTestDiagnostics({ includeLayoutIssues: true }),
    updateItemValues,
    updateConnectorValues
  };
}

function handleHudInput(event) {
  const input = event.target.dataset.input;
  if (!input) return;

  if (state.selection?.kind === "sleeve") {
    const selected = findSubBucket(state.selection.itemId, state.selection.sleeveId);
    if (!selected) return;
    const bucket = selected.bucket;
    if (input === "sleeve-label") bucket.label = event.target.value || "Sleeve";
    if (input === "sleeve-note") bucket.note = event.target.value;
    if (input === "sleeve-value") bucket.value = Math.max(0, parseMoney(event.target.value));
    if (input === "sleeve-capacity") bucket.capacity = Math.max(1, parseMoney(event.target.value) || 1);
    renderItems();
    return;
  }

  if (state.selection?.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item) return;
    if (input === "item-label") item.label = event.target.value || "Untitled";
    if (input === "item-subtitle") item.subtitle = event.target.value;
    if (input === "item-note") item.note = event.target.value;
    if (input === "finance-value" && item.financeId) {
      state.financeData[item.financeId].value = Math.max(0, parseMoney(event.target.value));
      syncComputedValues({ animateDelta: true });
      updateItemValues();
      updateConnectorValues({ geometry: false });
      return;
    }
    if (input === "scenario-monthly-need") {
      updateScenario("monthlyNeed", parseMoney(event.target.value));
      return;
    }
    if (input === "scenario-monthly-need-range") {
      updateScenario("monthlyNeed", Number(event.target.value) || 0);
      return;
    }
    if (input === "finance-value-range" && item.financeId) {
      state.financeData[item.financeId].value = Math.max(0, Number(event.target.value) || 0);
      syncComputedValues({ animateDelta: true });
      updateItemValues();
      updateConnectorValues({ geometry: false });
      const readout = dom.hudLayer.querySelector(`[data-input="finance-value-range"]`)?.parentElement?.querySelector(".range-value");
      if (readout) readout.textContent = compactDollars(state.financeData[item.financeId].value);
      const textInput = dom.hudLayer.querySelector(`[data-input="finance-value"]`);
      if (textInput) textInput.value = formatMoneyInput(state.financeData[item.financeId].value);
      return;
    }
    if (input === "finance-capacity" && item.financeId) {
      state.financeData[item.financeId].capacity = Math.max(1, parseMoney(event.target.value) || 1);
      syncComputedValues({ animateDelta: true });
      updateItemValues();
      updateConnectorValues({ geometry: false });
      return;
    }
    renderItems();
    renderInventory();
    return;
  }

  if (state.selection?.kind === "group") {
    const group = getGroup(state.selection.id);
    if (!group) return;
    if (input === "group-label") group.label = event.target.value || "Group";
    renderItems();
    return;
  }

  if (state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    if (!conn) return;
    if (input === "connector-label") {
      conn.label = event.target.value || "Connector";
      updateConnectorValues({ geometry: false });
    }
    if (input === "connector-amount") return;
    if (input === "connector-amount-range") previewConnectorAmount(conn, event.target.value);
    if (input === "connector-custom-width") {
      conn.customWidth = Number(event.target.value) || 5;
      conn.widthMode = "custom";
      updateConnectorValues({ geometry: false });
    }
  }
}

function commitDeferredHudInput(target) {
  if (!["connector-amount", "connector-amount-range"].includes(target?.dataset?.input) || state.selection?.kind !== "connector") return;
  const conn = getConnector(state.selection.id);
  if (!conn) return;
  const nextAmount = connectorStoredAmountFromDisplay(conn, parseMoney(target.value));
  const pendingPreview = state.pendingConnectorAmountPreview?.id === conn.id;
  if (!pendingPreview && Math.abs(nextAmount - (Number(conn.amount) || 0)) < 0.5) return;
  updateConnectorAmount(conn, target.value, { renderHud: false });
}

function ensureHudSection(sectionId, collapsed = false) {
  const key = selectionKey();
  if (!key) return;
  state.hudCollapsed[key] = state.hudCollapsed[key] || {};
  state.hudCollapsed[key][sectionId] = collapsed;
}

function openInspector(sectionId = null) {
  state.inspectorOpen = true;
  state.activePopover = sectionForPopoverKind(sectionId || "selection-data");
  renderAll();
  requestAnimationFrame(() => {
    if (document.body.classList.contains("inspector-open")) fitView();
  });
}

function editSelectionPrimary() {
  if (!state.selection) return;
  if (state.selection.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item) return;
    if (item.type === "finance") {
      startEditing(item.id, item.visual === "paycheck" ? "scenarioMonthlyNeed" : "financeValue");
      return;
    }
    startEditing(item.id, "label");
    return;
  }
  if (state.selection.kind === "group") {
    startEditing(state.selection.id, "label");
    return;
  }
  if (state.selection.kind === "connector") {
    startConnectorEditing(state.selection.id, "amount");
    return;
  }
  if (state.selection.kind === "sleeve") {
    startSleeveEditing(state.selection.itemId, state.selection.sleeveId, "value");
  }
}

function styleSelection() {
  if (!state.selection) return;
  if (state.selection.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item) return;
    state.activePopover = sectionForPopoverKind("selection-style");
    state.inspectorOpen = true;
    renderAll();
    return;
  }
  if (state.selection.kind === "connector") {
    state.activePopover = sectionForPopoverKind("connector-style");
    state.inspectorOpen = true;
    renderAll();
    return;
  }
  state.activePopover = sectionForPopoverKind("selection-style");
  state.inspectorOpen = true;
  renderAll();
}

function bringSelectionForward() {
  if (!state.selection) return;
  if (state.selection.kind === "item") {
    const item = getItem(state.selection.id);
    if (isLockedNode(item)) return;
    if (item) item.zIndex = nextZIndex();
  } else if (state.selection.kind === "group") {
    const group = getGroup(state.selection.id);
    if (isLockedNode(group)) return;
    if (group) group.zIndex = nextZIndex();
  } else if (state.selection.kind === "connector") {
    const index = state.connectors.findIndex((conn) => conn.id === state.selection.id);
    if (index >= 0) state.connectors.push(...state.connectors.splice(index, 1));
  }
  renderAll();
}

function sendSelectionBackward() {
  if (!state.selection) return;
  const minZ = Math.min(1, ...state.items.map((item) => item.zIndex || 1), ...state.groups.map((group) => group.zIndex || 1));
  if (state.selection.kind === "item") {
    const item = getItem(state.selection.id);
    if (isLockedNode(item)) return;
    if (item) item.zIndex = minZ - 1;
  } else if (state.selection.kind === "group") {
    const group = getGroup(state.selection.id);
    if (isLockedNode(group)) return;
    if (group) group.zIndex = minZ - 1;
  } else if (state.selection.kind === "connector") {
    const index = state.connectors.findIndex((conn) => conn.id === state.selection.id);
    if (index >= 0) state.connectors.unshift(...state.connectors.splice(index, 1));
  }
  renderAll();
}

function nudgeSelection(dx, dy) {
  if (hasMultiSelection()) {
    const selected = selectedItemIds().map((id) => getItem(id)).filter((item) => item && !isLockedNode(item));
    if (!selected.length) return false;
    commitHistory();
    selected.forEach((item) => {
      item.x = clamp(item.x + dx, item.w / 2, WORLD.width - item.w / 2);
      item.y = clamp(item.y + dy, item.h / 2, WORLD.height - item.h / 2);
    });
    renderAll();
    return true;
  }
  if (!state.selection || (state.selection.kind !== "item" && state.selection.kind !== "group")) return false;
  const node = state.selection.kind === "item" ? getItem(state.selection.id) : getGroup(state.selection.id);
  if (!node || isLockedNode(node)) return false;
  commitHistory();
  const before = { x: node.x, y: node.y };
  node.x = clamp(node.x + dx, node.w / 2, WORLD.width - node.w / 2);
  node.y = clamp(node.y + dy, node.h / 2, WORLD.height - node.h / 2);
  if (state.selection.kind === "group") {
    const movedX = node.x - before.x;
    const movedY = node.y - before.y;
    (node.childIds || []).forEach((childId) => {
      const child = getItem(childId);
      if (!child) return;
      child.x = clamp(child.x + movedX, child.w / 2, WORLD.width - child.w / 2);
      child.y = clamp(child.y + movedY, child.h / 2, WORLD.height - child.h / 2);
    });
  }
  renderAll();
  return true;
}

function alignMultiSelection(action) {
  const selected = selectedItemIds().map((id) => getItem(id)).filter((item) => item && !isLockedNode(item));
  if (selected.length < 2) return;
  commitHistory();

  if (action === "align-left") {
    const x = Math.min(...selected.map((item) => item.x));
    selected.forEach((item) => { item.x = x; });
  }
  if (action === "align-center-x") {
    const x = selected.reduce((sum, item) => sum + item.x, 0) / selected.length;
    selected.forEach((item) => { item.x = x; });
  }
  if (action === "align-right") {
    const x = Math.max(...selected.map((item) => item.x));
    selected.forEach((item) => { item.x = x; });
  }
  if (action === "align-top") {
    const y = Math.min(...selected.map((item) => item.y));
    selected.forEach((item) => { item.y = y; });
  }
  if (action === "align-middle-y") {
    const y = selected.reduce((sum, item) => sum + item.y, 0) / selected.length;
    selected.forEach((item) => { item.y = y; });
  }
  if (action === "align-bottom") {
    const y = Math.max(...selected.map((item) => item.y));
    selected.forEach((item) => { item.y = y; });
  }
  if (action === "distribute-x") {
    const sorted = [...selected].sort((a, b) => a.x - b.x);
    const min = sorted[0].x;
    const max = sorted[sorted.length - 1].x;
    const gap = (max - min) / Math.max(1, sorted.length - 1);
    sorted.forEach((item, index) => { item.x = min + gap * index; });
  }
  if (action === "distribute-y") {
    const sorted = [...selected].sort((a, b) => a.y - b.y);
    const min = sorted[0].y;
    const max = sorted[sorted.length - 1].y;
    const gap = (max - min) / Math.max(1, sorted.length - 1);
    sorted.forEach((item, index) => { item.y = min + gap * index; });
  }

  renderAll();
}

function handleHudClick(event) {
  const setButton = event.target.closest("[data-set]");
  if (setButton) {
    setSelectedField(setButton.dataset.set, setButton.dataset.field, setButton.dataset.value);
    return;
  }

  const inspectorTab = event.target.closest("[data-inspector-tab]");
  if (inspectorTab) {
    state.activePopover = sectionForPopoverKind(inspectorTab.dataset.inspectorTab);
    state.inspectorOpen = true;
    renderAll();
    requestAnimationFrame(() => {
      if (document.body.classList.contains("inspector-open")) fitView();
    });
    return;
  }

  const popoverButton = event.target.closest("[data-popover]");
  if (popoverButton) {
    state.activePopover = sectionForPopoverKind(popoverButton.dataset.popover);
    state.inspectorOpen = true;
    renderAll();
    requestAnimationFrame(() => {
      if (document.body.classList.contains("inspector-open")) fitView();
    });
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === "toggle-section") {
    const key = selectionKey();
    const section = actionButton.dataset.section;
    if (!key || !section) return;
    state.hudCollapsed[key] = state.hudCollapsed[key] || {};
    const isCollapsed = Boolean(actionButton.closest(".hud-section")?.classList.contains("is-collapsed"));
    state.hudCollapsed[key][section] = !isCollapsed;
    renderHud();
    return;
  }
  if (action === "close-hud") {
    state.inspectorOpen = false;
    state.activePopover = null;
    state.selection = null;
    clearMultiSelection();
    state.editingItemId = null;
    state.editingField = null;
    state.editingTarget = null;
    renderAll();
    return;
  }
  if (action === "close-popover") {
    state.activePopover = null;
    state.inspectorOpen = true;
    renderAll();
    return;
  }
  if (action === "selection-edit") {
    state.activePopover = sectionForPopoverKind("selection-data");
    state.inspectorOpen = true;
    renderAll();
  }
  if (action === "selection-style") {
    state.activePopover = sectionForPopoverKind("selection-style");
    state.inspectorOpen = true;
    renderAll();
  }
  if (action === "quick-adjust") quickAdjustSelectedValue(actionButton.dataset.delta);
  if (action === "bring-forward") bringSelectionForward();
  if (action === "send-backward") sendSelectionBackward();
  if (action === "delete") deleteSelectionWithToast();
  if (action === "duplicate") duplicateSelection();
  if (action === "group-selected") groupSelection();
  if (action === "ungroup") ungroupSelection();
  if (action.startsWith("align-") || action.startsWith("distribute-")) alignMultiSelection(action);
  if (action === "split-finance") splitFinancePreset();
  if (action === "reverse-connector") reverseConnector();
  if (action === "detach-connector") detachConnectorEndpoints();
  if (action === "reattach-connector") reattachConnectorEndpoints();
  if (action === "reset-connector-amount-link" && state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    if (conn) resetConnectorAmountLink(conn);
  }
}

function inferredResizeHandleFromPointer(event, node) {
  if (!node) return null;
  const kind = node.classList.contains("canvas-group") ? "group" : "item";
  const id = kind === "group" ? node.dataset.groupId : node.dataset.itemId;
  if (!id || state.selection?.kind !== kind || state.selection.id !== id) return null;
  const rect = node.getBoundingClientRect();
  const zone = Math.min(30, Math.max(18, Math.min(rect.width, rect.height) * 0.18));
  const nearW = event.clientX <= rect.left + zone;
  const nearE = event.clientX >= rect.right - zone;
  const nearN = event.clientY <= rect.top + zone;
  const nearS = event.clientY >= rect.bottom - zone;
  if (nearN && nearW) return "nw";
  if (nearN && nearE) return "ne";
  if (nearS && nearW) return "sw";
  if (nearS && nearE) return "se";
  return null;
}

document.querySelectorAll("[data-dock]").forEach((button) => {
  button.addEventListener("click", () => {
    switchToolDock(button.dataset.dock);
  });
});

document.getElementById("templateButton").addEventListener("click", () => {
  state.activeDock = "templates";
  state.activePopover = null;
  renderAll();
});

document.getElementById("themeButton").addEventListener("click", () => {
  state.activeDock = "themes";
  state.activePopover = null;
  renderAll();
});

dom.dockFlyout.addEventListener("click", (event) => {
  const addTab = event.target.closest("[data-add-tab]");
  if (addTab) {
    state.activeAddTab = addTab.dataset.addTab;
    state.activeDock = state.activeAddTab;
    ensureCreationPresetForDock();
    renderDockFlyout();
    return;
  }

  const paletteButton = event.target.closest("[data-palette-id]");
  if (paletteButton) {
    armCreationPreset(paletteButton.dataset.paletteKind, paletteButton.dataset.paletteId);
    return;
  }

  const connectorButton = event.target.closest("[data-create-connector]");
  if (connectorButton) {
    armCreationPreset("connector", connectorButton.dataset.createConnector);
    return;
  }

  const templateButton = event.target.closest("[data-template-id]");
  if (templateButton) {
    loadTemplate(templateButton.dataset.templateId);
    return;
  }

  const themeButton = event.target.closest("[data-theme-id]");
  if (themeButton) {
    applyTheme(themeButton.dataset.themeId);
    state.activeDock = "select";
    renderAll();
  }
});

if (dom.startScreen) {
  dom.startScreen.addEventListener("click", (event) => {
    const templateButton = event.target.closest("[data-template-id]");
    if (!templateButton || templateButton.disabled) return;
    loadTemplate(templateButton.dataset.templateId);
  });
}

dom.itemLayer.addEventListener("pointerdown", (event) => {
  const edgeHandle = event.target.closest("[data-edge-handle]");
  if (edgeHandle && event.button === 0) {
    startEdgeConnectorDrag(event, edgeHandle.dataset.itemId, edgeHandle.dataset.edgeHandle);
    return;
  }
  const resize = event.target.closest("[data-resize]");
  const groupNode = event.target.closest(".canvas-group");
  const itemNode = event.target.closest(".canvas-item");
  if ((!groupNode && !itemNode) || event.button !== 0 || isActiveTextEditTarget(event.target)) return;
  const nodeForResize = groupNode || itemNode;
  const inferredResize = resize ? null : inferredResizeHandleFromPointer(event, nodeForResize);
  const editField = event.target.closest("[data-edit-field]")?.dataset.editField || null;
  const editKind = event.target.closest("[data-edit-kind]")?.dataset.editKind || null;
  const financeValueTarget = event.target.closest(".finance-value");
  const sleeveTarget = itemNode ? event.target.closest(".sub-bucket-card[data-sub-bucket-id]") : null;
  if (sleeveTarget && editKind === "sleeve" && !resize && !inferredResize && event.detail < 2) {
    event.preventDefault();
    event.stopPropagation();
    startSleeveEditing(itemNode.dataset.itemId, sleeveTarget.dataset.subBucketId, editField || "value");
    return;
  }
  if (sleeveTarget && !resize && !inferredResize && event.detail < 2) {
    event.preventDefault();
    event.stopPropagation();
    selectSleeve(itemNode.dataset.itemId, sleeveTarget.dataset.subBucketId);
    return;
  }
  if (state.activeDock === "connectors" && !resize && !inferredResize && event.detail < 2 && startConnectorToolDrag(event, nodeForResize)) {
    return;
  }

  if (itemNode && (event.metaKey || event.ctrlKey) && !resize && !inferredResize) {
    event.preventDefault();
    event.stopPropagation();
    toggleMultiSelectItem(itemNode.dataset.itemId);
    return;
  }

  if (financeValueTarget && !resize && !inferredResize && event.detail >= 2) {
    event.preventDefault();
    event.stopPropagation();
    startEditing(itemNode.dataset.itemId, "financeValue");
    return;
  }

  const paycheckAmountTarget = event.target.closest(".paycheck-amount");
  if (paycheckAmountTarget && !resize && !inferredResize && event.detail >= 2) {
    event.preventDefault();
    event.stopPropagation();
    startEditing(itemNode.dataset.itemId, "scenarioMonthlyNeed");
    return;
  }

  if (event.detail >= 2 && !resize && !inferredResize) {
    event.preventDefault();
    event.stopPropagation();
    startEditing(itemNode?.dataset.itemId || groupNode?.dataset.groupId, editField);
    return;
  }

  if (groupNode) {
    if (resize || inferredResize) startResizeNode(event, "group", groupNode.dataset.groupId, resize?.dataset.resize || inferredResize);
    else {
      event.preventDefault();
      startDragNode(event, "group", groupNode.dataset.groupId);
    }
    return;
  }

  if (itemNode) {
    const edgeConnector = !resize && !inferredResize && event.detail < 2
      ? financeEdgeFromClientPoint(event, itemNode)
      : null;
    if (resize || inferredResize) startResizeNode(event, "item", itemNode.dataset.itemId, resize?.dataset.resize || inferredResize);
    else {
      event.preventDefault();
      startDragNode(event, "item", itemNode.dataset.itemId, { edgeConnector });
    }
  }
});

dom.itemLayer.addEventListener("dblclick", (event) => {
  const node = event.target.closest(".canvas-item, .canvas-group");
  if (!node) return;
  event.preventDefault();
  const field = event.target.closest("[data-edit-field]")?.dataset.editField || null;
  startEditing(node.dataset.itemId || node.dataset.groupId, field);
});

dom.itemLayer.addEventListener("click", (event) => {
  const now = window.performance?.now?.() || Date.now();
  if (state.suppressDirectEditClickUntil) {
    if (now <= state.suppressDirectEditClickUntil && event.target.closest(".canvas-item, .canvas-group")) {
      state.suppressDirectEditClickUntil = 0;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    state.suppressDirectEditClickUntil = 0;
  }
  const directEdit = event.target.closest("[data-edit-kind='item'], [data-edit-kind='group']");
  if (event.detail === 1 && directEdit && !isFormField(event.target) && !event.metaKey && !event.ctrlKey) {
    const itemNode = event.target.closest(".canvas-item");
    const groupNode = event.target.closest(".canvas-group");
    const field = directEdit.dataset.editField || "label";
    if (itemNode) {
      event.preventDefault();
      startEditing(itemNode.dataset.itemId, field);
      return;
    }
    if (groupNode) {
      event.preventDefault();
      startEditing(groupNode.dataset.groupId, field);
      return;
    }
  }
  if (event.detail === 1 && !isFormField(event.target) && event.target.closest(".finance-value")) {
    const node = event.target.closest(".canvas-item");
    if (node) selectItem(node.dataset.itemId);
    return;
  }
  if (event.detail < 2 || isFormField(event.target)) return;
  const node = event.target.closest(".canvas-item, .canvas-group");
  if (!node) return;
  event.preventDefault();
  const field = event.target.closest("[data-edit-field]")?.dataset.editField || null;
  startEditing(node.dataset.itemId || node.dataset.groupId, field);
});

dom.itemLayer.addEventListener("input", (event) => {
  const field = event.target.dataset.editField;
  const editKind = event.target.dataset.editKind;
  const itemNode = event.target.closest(".canvas-item");
  const groupNode = event.target.closest(".canvas-group");
  if (!field) return;

  if (editKind === "sleeve") {
    const selected = findSubBucket(event.target.dataset.itemId, event.target.dataset.subBucketId);
    if (!selected) return;
    if (field === "label") selected.bucket.label = event.target.textContent.trim() || "Sleeve";
    if (field === "value") selected.bucket.value = Math.max(0, parseMoney(event.target.textContent));
    return;
  }

  if (itemNode) {
    const item = getItem(itemNode.dataset.itemId);
    if (item && field === "financeValue" && item.financeId) {
      state.financeData[item.financeId].value = Math.max(0, parseMoney(event.target.textContent));
    } else if (item && field === "scenarioMonthlyNeed") {
      state.scenario.monthlyNeed = Math.max(0, parseMoney(event.target.textContent));
    } else if (item) {
      item[field] = event.target.textContent.trim();
      if (field === "label" && !item[field]) item[field] = "Untitled";
    }
  }
  if (groupNode) {
    const group = getGroup(groupNode.dataset.groupId);
    if (group) group[field] = event.target.textContent.trim() || "Group";
  }
});

dom.itemLayer.addEventListener("beforeinput", (event) => {
  if (!event.target.matches("[contenteditable='true']")) return;
  if (event.inputType !== "insertParagraph") return;
  event.preventDefault();
  event.target.blur();
});

dom.itemLayer.addEventListener("focusout", (event) => {
  if (!event.target.matches("[contenteditable='true']")) return;
  const field = event.target.dataset.editField;
  const editKind = event.target.dataset.editKind;
  const itemNode = event.target.closest(".canvas-item");
  const item = itemNode ? getItem(itemNode.dataset.itemId) : null;
  const historyBefore = state.editingHistoryBefore;
  state.editingHistoryBefore = null;
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  if (editKind === "sleeve") {
    const selected = findSubBucket(event.target.dataset.itemId, event.target.dataset.subBucketId);
    if (selected) {
      if (field === "label") selected.bucket.label = event.target.textContent.trim() || "Sleeve";
      if (field === "value") selected.bucket.value = Math.max(0, parseMoney(event.target.textContent));
    }
    commitHistoryFrom(historyBefore);
    renderAll();
    return;
  }
  if (field === "financeValue" && item?.financeId) {
    event.target.removeAttribute("contenteditable");
    event.target.removeAttribute("spellcheck");
    syncComputedValues({ animateDelta: true });
    updateItemValues();
    updateConnectorValues({ geometry: false });
    commitHistoryFrom(historyBefore);
    return;
  }
  if (field === "scenarioMonthlyNeed") {
    event.target.removeAttribute("contenteditable");
    event.target.removeAttribute("spellcheck");
    syncComputedValues({ animateDelta: true });
    commitHistoryFrom(historyBefore);
    renderAll();
    return;
  }
  commitHistoryFrom(historyBefore);
  renderAll();
});

dom.itemLayer.addEventListener("keydown", (event) => {
  if (!event.target.matches("[contenteditable='true']")) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    event.target.blur();
  }
  if (event.key === "Escape") {
    event.preventDefault();
    const historyBefore = state.editingHistoryBefore;
    state.editingHistoryBefore = null;
    if (historyBefore) {
      restoreHistorySnapshot(historyBefore);
      return;
    }
    state.editingItemId = null;
    state.editingField = null;
    state.editingTarget = null;
    state.pendingEditField = null;
    renderAll();
  }
});

dom.connectorLayer.addEventListener("pointerdown", (event) => {
  const canvasNode = canvasNodeFromClientPoint(event);
  if (canvasNode && startCanvasNodePointer(event, canvasNode)) return;
  const hit = event.target.closest(".connector-hit");
  if (hit) {
    const conn = getConnector(hit.dataset.connectorId);
    if (conn) {
      event.preventDefault();
      event.stopPropagation();
      window.getSelection?.()?.removeAllRanges?.();
      if (state.selection?.kind === "connector" && state.selection.id === conn.id) startConnectorBodyDrag(event, conn);
      else selectConnector(conn.id);
    }
  }
});

dom.handleLayer.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest(".connector-handle");
  if (!handle) return;
  const conn = getConnector(handle.dataset.connectorId);
  const role = handle.dataset.connectorRole;
  const canvasNode = canvasNodeFromClientPoint(event);
  if ((role === "source" || role === "target") && canvasNode && !connectorEndpointOwnsNode(conn, role, canvasNode)) {
    startCanvasNodePointer(event, canvasNode);
    return;
  }
  if (conn) startConnectorDrag(event, conn, role);
});

dom.labelLayer.addEventListener("pointerdown", (event) => {
  const label = event.target.closest("[data-connector-id]");
  if (!label || event.button !== 0) return;
  const canvasNode = canvasNodeFromClientPoint(event);
  if (canvasNode && startCanvasNodePointer(event, canvasNode)) return;
  const conn = getConnector(label.dataset.connectorId);
  if (conn) {
    event.preventDefault();
    event.stopPropagation();
    window.getSelection?.()?.removeAllRanges?.();
    if (state.selection?.kind === "connector" && state.selection.id === conn.id) startConnectorDrag(event, conn, "label");
    else selectConnector(conn.id);
  }
});

dom.labelLayer.addEventListener("click", (event) => {
  const label = event.target.closest("[data-connector-id]");
  const canvasNode = canvasNodeFromClientPoint(event);
  if (canvasNode) return;
  if (label) selectConnector(label.dataset.connectorId);
});

dom.labelLayer.addEventListener("input", (event) => {
  if (!event.target.matches("[contenteditable='true'][data-edit-kind='connector']")) return;
  if (event.target.dataset.editField !== "relationship") return;
  const conn = getConnector(event.target.dataset.connectorId);
  if (conn) conn.label = event.target.textContent.trim() || "Connector";
});

dom.labelLayer.addEventListener("beforeinput", (event) => {
  if (!event.target.matches("[contenteditable='true'][data-edit-kind='connector']")) return;
  if (event.inputType !== "insertParagraph") return;
  event.preventDefault();
  event.target.blur();
});

dom.labelLayer.addEventListener("focusout", (event) => {
  if (!event.target.matches("[contenteditable='true'][data-edit-kind='connector']")) return;
  const conn = getConnector(event.target.dataset.connectorId);
  const field = event.target.dataset.editField;
  const historyBefore = state.editingHistoryBefore;
  state.editingHistoryBefore = null;
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  if (conn && field === "amount") updateConnectorAmount(conn, event.target.textContent, { renderHud: false });
  if (conn && field === "relationship") conn.label = event.target.textContent.trim() || "Connector";
  commitHistoryFrom(historyBefore);
  renderAll();
});

dom.labelLayer.addEventListener("keydown", (event) => {
  if (!event.target.matches("[contenteditable='true'][data-edit-kind='connector']")) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    event.target.blur();
  }
  if (event.key === "Escape") {
    event.preventDefault();
    const historyBefore = state.editingHistoryBefore;
    state.editingHistoryBefore = null;
    state.editingItemId = null;
    state.editingField = null;
    state.editingTarget = null;
    state.pendingEditField = null;
    if (historyBefore) restoreHistorySnapshot(historyBefore);
    else renderAll();
  }
});

dom.canvasStage.addEventListener("pointerdown", (event) => {
  if (
    event.target.closest(".canvas-item") ||
    event.target.closest(".canvas-group") ||
    event.target.closest(".connector-label") ||
    event.target.closest(".connector-hit") ||
    event.target.closest(".connector-handle") ||
    event.target.closest(".context-hud") ||
    event.target.closest(".selection-inspector") ||
    event.target.closest(".selection-popover") ||
    event.target.closest(".selection-toolbar")
  ) {
    return;
  }
  if (event.button === 0 || event.button === 1) {
    const selectedShape = state.selection?.kind === "item" ? getItem(state.selection.id) : null;
    const collapseShapesDock = event.button === 0
      && state.activeDock === "shapes"
      && selectedShape?.type === "shape";
    event.preventDefault();
    if (collapseShapesDock) {
      state.selection = null;
      clearMultiSelection();
      state.activePopover = null;
      state.inspectorOpen = false;
      state.editingItemId = null;
      state.editingField = null;
      state.editingTarget = null;
      state.pendingEditField = null;
      switchToolDock("select");
      return;
    }
    if (event.button === 0 && startCanvasPlacement(event)) return;
    if (event.button === 0 && (state.selection || state.activePopover || state.editingItemId)) {
      state.selection = null;
      clearMultiSelection();
      state.activePopover = null;
      state.inspectorOpen = false;
      state.editingItemId = null;
      state.editingField = null;
      state.editingTarget = null;
      state.pendingEditField = null;
      renderAll();
      return;
    }
    if (state.editingItemId) {
      state.editingItemId = null;
      state.editingField = null;
      state.editingTarget = null;
      state.pendingEditField = null;
      renderAll();
    }
    startPan(event);
  }
});

function normalizedWheelDelta(event) {
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? WHEEL_LINE_PX
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? Math.max(WHEEL_PAGE_PX, dom.canvasStage.clientHeight)
      : 1;
  return {
    x: event.deltaX * unit,
    y: event.deltaY * unit
  };
}

function wheelZoomFactor(deltaY) {
  if (!deltaY) return 1;
  const clampedDelta = clamp(deltaY, -120, 120);
  return clamp(Math.exp(clampedDelta * -0.0018), 0.88, 1.14);
}

function panViewportBy(delta) {
  state.viewport.x -= delta.x;
  state.viewport.y -= delta.y;
  constrainViewport();
  renderViewport();
  scheduleViewportSettle();
}

dom.canvasStage.addEventListener("wheel", (event) => {
  event.preventDefault();
  const delta = normalizedWheelDelta(event);
  if (event.shiftKey) {
    panViewportBy(delta);
    return;
  }

  const rect = dom.canvasStage.getBoundingClientRect();
  setZoom(state.viewport.zoom * wheelZoomFactor(delta.y), {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  });
}, { passive: false });

dom.hudLayer.addEventListener("input", handleHudInput);
dom.hudLayer.addEventListener("focusin", (event) => {
  beginHudInputHistory(event.target);
  focusMoneyInput(event.target);
});
dom.hudLayer.addEventListener("pointerdown", (event) => beginHudInputHistory(event.target));
dom.hudLayer.addEventListener("pointerdown", (event) => {
  if (event.target.matches?.('input[type="range"]')) setHudRangeDragActive(true);
});
window.addEventListener("pointerup", () => setHudRangeDragActive(false));
window.addEventListener("pointercancel", () => setHudRangeDragActive(false));
dom.hudLayer.addEventListener("change", (event) => {
  commitDeferredHudInput(event.target);
  formatMoneyInputTarget(event.target);
  finishHudInputHistory(event.target);
});
dom.hudLayer.addEventListener("focusout", (event) => {
  commitDeferredHudInput(event.target);
  formatMoneyInputTarget(event.target);
  finishHudInputHistory(event.target);
});
dom.hudLayer.addEventListener("click", handleHudClick);
dom.hudLayer.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && isTextMoneyInput(event.target)) {
    event.preventDefault();
    event.target.blur();
  }
});
dom.hudLayer.addEventListener("scroll", (event) => {
  if (!event.target.matches?.(".context-hud")) return;
  const key = selectionKey();
  if (key) state.hudScrollTops[key] = event.target.scrollTop;
}, true);
dom.hudLayer.addEventListener("pointerdown", (event) => {
  const toolbar = event.target.closest("[data-selection-toolbar]");
  if (toolbar && event.button === 0 && event.target.closest("[data-toolbar-drag]") && !event.target.closest("button, input, textarea, select, [contenteditable='true']")) {
    startToolbarDrag(event, toolbar);
    return;
  }

  const popover = event.target.closest("[data-selection-popover]");
  if (popover && event.button === 0 && event.target.closest("[data-popover-drag]") && !event.target.closest("button, input, textarea, select, [contenteditable='true']")) {
    startPopoverDrag(event, popover);
    return;
  }

  const hud = event.target.closest(".context-hud");
  if (!hud || event.button !== 0) return;
  const hudRect = hud.getBoundingClientRect();
  const nearResizeCorner = event.clientX >= hudRect.right - 34 && event.clientY >= hudRect.bottom - 34;
  if (event.target.closest("[data-hud-resize]") || nearResizeCorner) {
    startHudResize(event, hud);
    return;
  }
  if (event.target.closest("[data-hud-drag]") && !event.target.closest("button, input, textarea, select, [contenteditable='true']")) {
    startHudDrag(event, hud);
  }
});

dom.scenarioRail.addEventListener("input", (event) => {
  const key = event.target.dataset.scenario;
  if (!key) return;
  updateScenario(key, event.target.type === "checkbox" ? event.target.checked : event.target.value);
});

dom.scenarioRail.addEventListener("focusin", (event) => beginScenarioInputHistory(event.target));
dom.scenarioRail.addEventListener("pointerdown", (event) => beginScenarioInputHistory(event.target));

dom.scenarioRail.addEventListener("change", (event) => {
  const key = event.target.dataset.scenario;
  if (!key) return;
  updateScenario(key, event.target.type === "checkbox" ? event.target.checked : event.target.value);
  finishScenarioInputHistory(event.target);
});

document.addEventListener("pointerdown", (event) => {
  if (!state.activePopover) return;
  if (event.target.closest("#hudLayer, .canvas-item, .canvas-group, .connector-label, .connector-hit, .connector-handle")) return;
  state.activePopover = null;
  state.inspectorOpen = false;
  renderAll();
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    state.viewMode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach((modeButton) => {
      modeButton.classList.toggle("is-active", modeButton.dataset.mode === state.viewMode);
    });
    document.body.classList.toggle("current-mode", state.viewMode === "current");
    syncComputedValues();
    updateItemValues();
    updateConnectorValues({ geometry: false });
  });
});

document.querySelectorAll("[data-zoom]").forEach((button) => {
  button.addEventListener("click", () => {
    setZoom(state.viewport.zoom * (button.dataset.zoom === "in" ? 1.12 : 0.88));
  });
});

document.getElementById("fitButton").addEventListener("click", fitView);
document.getElementById("tidyButton").addEventListener("click", tidyCanvasLayout);
document.getElementById("resetButton").addEventListener("click", resetCanvas);

function cycleMeetingStatus(current) {
  if (current === "open") return "agreed";
  if (current === "agreed") return "deferred";
  return "open";
}

function focusMeetingTarget(kind, id) {
  if (!kind || !id) return;
  state.meeting.focus = { kind, id };
  state.selection = null;
  clearMultiSelection();
  state.inspectorOpen = false;
  state.activePopover = null;
  state.hotItemIds = new Set();
  state.hotConnectorIds = new Set();
  if (kind === "item" && getItem(id)) state.hotItemIds.add(id);
  if (kind === "group" && getGroup(id)) state.hoverItemId = id;
  if (kind === "connector") {
    const conn = getConnector(id);
    if (conn) {
      state.hotConnectorIds.add(id);
      [conn.source?.itemId, conn.target?.itemId].filter(Boolean).forEach((itemId) => state.hotItemIds.add(itemId));
    }
  }
  renderAll();
}

dom.scenarioRail.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-meeting-tab]");
  if (tab) {
    state.meeting.activeTab = tab.dataset.meetingTab || "actions";
    renderAll();
    return;
  }

  const statusButton = event.target.closest("[data-meeting-status-id]");
  if (statusButton) {
    const kind = statusButton.dataset.meetingStatusKind === "decision" ? "decision" : "action";
    const id = statusButton.dataset.meetingStatusId;
    const bucket = kind === "decision" ? state.meeting.decisionStatuses : state.meeting.actionStatuses;
    bucket[id] = cycleMeetingStatus(bucket[id] || "open");
    const target = statusButton.closest("[data-meeting-target-kind]");
    focusMeetingTarget(target?.dataset.meetingTargetKind, target?.dataset.meetingTargetId);
    return;
  }

  const target = event.target.closest("[data-meeting-target-kind]");
  if (target && !event.target.closest("input, select, textarea")) {
    focusMeetingTarget(target.dataset.meetingTargetKind, target.dataset.meetingTargetId);
  }
});

const PRESENTATION_TRANSITION_MS = 320;
let presentationTransitionTimer = null;

function clearPresentationTransitionTimer() {
  window.clearTimeout(presentationTransitionTimer);
  presentationTransitionTimer = null;
}

function enterPresentationMode() {
  hideDeleteToast();
  clearPresentationTransitionTimer();
  document.body.classList.remove("presentation-exiting");
  document.body.classList.add("presentation");
  document.body.classList.add("presentation-entering");
  state.selection = null;
  clearMultiSelection();
  state.inspectorOpen = false;
  state.activePopover = null;
  state.activeDock = "select";
  renderAll();
  presentationTransitionTimer = window.setTimeout(() => {
    document.body.classList.remove("presentation-entering");
    document.body.classList.add("presentation-ready");
    presentationTransitionTimer = null;
  }, PRESENTATION_TRANSITION_MS);
  requestAnimationFrame(fitView);
}

function exitPresentationMode() {
  clearPresentationTransitionTimer();
  document.body.classList.remove("presentation-entering", "presentation-ready");
  document.body.classList.add("presentation-exiting");
  document.body.classList.remove("presentation");
  renderAll();
  requestAnimationFrame(fitView);
  presentationTransitionTimer = window.setTimeout(() => {
    document.body.classList.remove("presentation-exiting");
    presentationTransitionTimer = null;
  }, PRESENTATION_TRANSITION_MS);
}

document.getElementById("presentationButton").addEventListener("click", enterPresentationMode);
document.getElementById("presentationExit").addEventListener("click", exitPresentationMode);

// === INVENTORY POPOVER ===
let inventoryHoverTimer = null;
function openInventory() {
  if (!dom.inventoryPopover) return;
  window.clearTimeout(inventoryHoverTimer);
  dom.inventoryPopover.classList.remove("is-hidden");
  requestAnimationFrame(() => dom.inventoryPopover.classList.add("is-open"));
  dom.inventoryButton.setAttribute("aria-expanded", "true");
}
function closeInventory(immediate = false) {
  if (!dom.inventoryPopover) return;
  window.clearTimeout(inventoryHoverTimer);
  const finish = () => {
    dom.inventoryPopover.classList.remove("is-open");
    dom.inventoryPopover.classList.add("is-hidden");
    dom.inventoryButton.setAttribute("aria-expanded", "false");
  };
  if (immediate) finish();
  else inventoryHoverTimer = window.setTimeout(finish, 180);
}

if (dom.inventoryAnchor) {
  dom.inventoryAnchor.addEventListener("mouseenter", openInventory);
  dom.inventoryAnchor.addEventListener("mouseleave", () => closeInventory(false));
  dom.inventoryAnchor.addEventListener("focusin", openInventory);
  dom.inventoryAnchor.addEventListener("focusout", (event) => {
    if (!dom.inventoryAnchor.contains(event.relatedTarget)) closeInventory(true);
  });
  dom.inventoryButton.addEventListener("click", () => {
    if (dom.inventoryPopover.classList.contains("is-open")) closeInventory(true);
    else openInventory();
  });
  dom.inventoryPopover.addEventListener("click", (event) => {
    const row = event.target.closest("[data-inventory-id]");
    if (!row) return;
    selectItem(row.dataset.inventoryId);
    renderAll();
  });
  dom.inventoryPopover.addEventListener("keydown", (event) => {
    const row = event.target.closest("[data-inventory-id]");
    if (!row || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    selectItem(row.dataset.inventoryId);
    renderAll();
  });
}

if (dom.toastHost) {
  dom.toastHost.addEventListener("click", (event) => {
    const button = event.target.closest("[data-toast-action='undo-delete']");
    if (!button) return;
    performUndo();
  });
}

window.addEventListener("keydown", (event) => {
  const formField = isFormField(event.target) || isFormField(document.activeElement);
  const modKey = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();

  if (modKey && !formField && key === "z") {
    event.preventDefault();
    if (event.shiftKey) performRedo();
    else performUndo();
    return;
  }

  if (modKey && !formField && key === "y") {
    event.preventDefault();
    performRedo();
    return;
  }

  if (modKey && !formField && key === "p") {
    event.preventDefault();
    enterPresentationMode();
    return;
  }

  if (modKey && !formField && event.key === "0") {
    event.preventDefault();
    fitView();
    return;
  }

  if (state.editingTarget && event.key === "Enter") {
    const editable = document.querySelector("[contenteditable='true']");
    if (editable) {
      event.preventDefault();
      editable.blur();
      return;
    }
  }

  if (!modKey && !event.altKey && !formField) {
    const toolShortcuts = {
      v: "select",
      s: "shapes",
      t: "text",
      f: "finance",
      c: "connectors"
    };
    if (toolShortcuts[key]) {
      event.preventDefault();
      switchToolDock(toolShortcuts[key]);
      return;
    }
  }

  if (event.key === "Escape" && !formField) {
    if (state.interaction && cancelInteraction()) return;
    if (dom.inventoryPopover && dom.inventoryPopover.classList.contains("is-open")) {
      closeInventory(true);
      return;
    }
    if (state.activePopover) {
      state.activePopover = null;
      state.inspectorOpen = false;
      renderAll();
      return;
    }
    if (document.body.classList.contains("presentation")) {
      exitPresentationMode();
      return;
    }
    state.selection = null;
    clearMultiSelection();
    state.activeDock = "select";
    state.editingItemId = null;
    state.editingField = null;
    state.editingTarget = null;
    state.inspectorOpen = false;
    state.activePopover = null;
    renderAll();
    return;
  }

  if (event.key === "Enter" && state.selection && !formField) {
    event.preventDefault();
    editSelectionPrimary();
    return;
  }

  if ((event.key === "Delete" || event.key === "Backspace") && state.selection && !formField) {
    event.preventDefault();
    deleteSelectionWithToast();
    return;
  }

  if (!formField && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    const step = event.shiftKey ? 16 : 4;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (nudgeSelection(dx, dy)) event.preventDefault();
    return;
  }

  if (!modKey && (event.key === "+" || event.key === "=" || event.key === "-") && !formField && state.selection) {
    event.preventDefault();
    const sign = event.key === "-" ? -1 : 1;
    quickAdjustSelectedValue(sign * (event.shiftKey ? 10000 : 1000));
    return;
  }

  if (!modKey && (event.key === "+" || event.key === "=") && !formField) setZoom(state.viewport.zoom * 1.1);
  if (!modKey && event.key === "-" && !formField) setZoom(state.viewport.zoom * 0.9);
});

window.addEventListener("resize", () => {
  fitView();
});

renderStartScreen();
applyTheme("stewardship");
showStartScreen();
requestAnimationFrame(() => placeViewportAtZoom(0.95));
installTestApi();
