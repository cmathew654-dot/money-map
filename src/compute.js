import { state, dom, WORLD, MIN_ZOOM, currency, compactDollars, accountCategories, clamp, isAttachedEndpoint, isFreeEndpoint, getItem, getGroup, getNode, getAnchorableNodes } from "./state.js";
import { getTheme } from "./templates.js";
import { obstacleRectsForConnector, resolveEndpointPort, storyLaneCorridors } from "./canvasGeometry.js";

// === COMPUTE ===
const MONTHLY_CONNECTOR_SCENARIO_KEYS = new Set([
  "monthlyDistribution",
  "guaranteedIncome",
  "flexibleIncome",
  "annuityIncome"
]);

const DEFERRED_CONNECTOR_TIMINGS = new Set(["future", "deferred"]);

const SCENARIO_DRIVER_CONFIG = {
  monthlyDistribution: {
    scenarioKey: "monthlyDistribution",
    scenarioField: "monthlyDistribution",
    label: "Portfolio draw",
    unit: "monthly",
    cadence: "monthly"
  },
  guaranteedIncome: {
    scenarioKey: "guaranteedIncome",
    scenarioField: "guaranteedIncome",
    label: "Guaranteed income",
    unit: "monthly",
    cadence: "monthly"
  },
  flexibleIncome: {
    scenarioKey: "flexibleIncome",
    scenarioField: "flexibleIncome",
    label: "Flexible income",
    unit: "monthly",
    cadence: "monthly"
  },
  annuityIncome: {
    scenarioKey: "annuityIncome",
    scenarioField: "annuityMonthlyIncome",
    label: "Annuity income",
    unit: "monthly",
    cadence: "monthly"
  },
  annuityPremium: {
    scenarioKey: "annuityPremium",
    scenarioField: "annuityPremium",
    label: "Annuity premium",
    unit: "oneTime",
    cadence: "oneTime"
  },
  rollover: {
    scenarioKey: "rollover",
    scenarioField: "rollover",
    label: "Rollover amount",
    unit: "oneTime",
    cadence: "oneTime"
  },
  rothConversion: {
    scenarioKey: "rothConversion",
    scenarioField: "rothConversion",
    label: "Roth conversion",
    unit: "oneTime",
    cadence: "oneTime"
  },
  taxPayment: {
    scenarioKey: "taxPayment",
    scenarioField: "taxReservePct",
    label: "Tax reserve rate",
    unit: "percent",
    cadence: "annual",
    derived: true
  }
};

let computedViewModelCache = null;
const computeDiagnostics = {
  computeValuesCalls: 0,
  viewModelComputes: 0,
  lastViewModelMs: 0
};

export function invalidateComputedViewModel() {
  computedViewModelCache = null;
}

export function resetComputeDiagnostics() {
  computeDiagnostics.computeValuesCalls = 0;
  computeDiagnostics.viewModelComputes = 0;
  computeDiagnostics.lastViewModelMs = 0;
}

export function getComputeDiagnostics() {
  return { ...computeDiagnostics };
}

function connectorSemanticValue(conn, key) {
  const flowSemantic = conn?.flowSemantic;
  if (flowSemantic && typeof flowSemantic === "object" && flowSemantic[key] !== undefined && flowSemantic[key] !== null) {
    return flowSemantic[key];
  }
  if (conn?.[key] !== undefined && conn?.[key] !== null) return conn[key];
  return undefined;
}

function connectorSemanticAliasValue(conn, keys) {
  const flowSemantic = conn?.flowSemantic;
  if (flowSemantic && typeof flowSemantic === "object") {
    for (const key of keys) {
      if (flowSemantic[key] !== undefined && flowSemantic[key] !== null) return flowSemantic[key];
    }
  }
  for (const key of keys) {
    if (conn?.[key] !== undefined && conn?.[key] !== null) return conn[key];
  }
  return undefined;
}

function connectorSemanticBoolean(conn, keys) {
  const value = connectorSemanticAliasValue(conn, keys);
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function connectorTimingIsDeferred(timing) {
  return DEFERRED_CONNECTOR_TIMINGS.has(String(timing || "").toLowerCase());
}

function connectorSemanticIsDeferred(semantics) {
  return (
    connectorTimingIsDeferred(semantics.timing) ||
    /future|deferred/i.test(String(semantics.domainRole || ""))
  );
}

function connectorDefaultTargetEffect(conn, semantics) {
  if (conn?.affectsTarget === false) return "none";
  if (connectorSemanticIsDeferred(semantics)) return "none";
  const target = conn?.target?.itemId ? getNode(conn.target.itemId) : null;
  if (target?.visual === "paycheck" && (semantics.flowType === "income" || semantics.flowType === "rmd")) {
    return "cashflowCoverage";
  }
  if (target?.visual === "paycheck") return "none";
  return "increaseBalance";
}

export function connectorSemantic(conn) {
  if (!conn) {
    return {
      domainRole: null,
      cadence: null,
      timing: "current",
      sourceEffect: "none",
      targetEffect: "none",
      scenarioKey: null,
      flowType: null,
      includeInCurrentCashflow: null,
      includeInProposedBalances: null
    };
  }

  const scenarioKey = connectorSemanticValue(conn, "scenarioKey") ?? null;
  const flowType = connectorSemanticValue(conn, "flowType") ?? null;
  const timing = connectorSemanticValue(conn, "timing") ?? "current";
  const domainRole = connectorSemanticAliasValue(conn, ["domainRole", "role"]) ?? null;
  const semantics = {
    domainRole,
    cadence: connectorSemanticValue(conn, "cadence") ?? null,
    timing,
    sourceEffect: connectorSemanticValue(conn, "sourceEffect")
      ?? (conn.affectsSource === false ? "none" : "decreaseBalance"),
    targetEffect: null,
    scenarioKey,
    flowType,
    includeInCurrentCashflow: connectorSemanticBoolean(conn, ["includeInCurrentCashflow", "countsTowardCashflow"]),
    includeInProposedBalances: connectorSemanticBoolean(conn, ["includeInProposedBalances", "includeInCurrentBalances", "affectsProposedBalances"])
  };
  semantics.targetEffect = connectorSemanticValue(conn, "targetEffect") ?? connectorDefaultTargetEffect(conn, semantics);
  return semantics;
}

export const normalizedConnectorSemantics = connectorSemantic;

function connectorIncludedInCurrentCashflow(conn) {
  const semantics = connectorSemantic(conn);
  if (semantics.includeInCurrentCashflow !== null) return semantics.includeInCurrentCashflow;
  return !connectorSemanticIsDeferred(semantics);
}

function connectorIncludedInProposedBalances(conn) {
  const semantics = connectorSemantic(conn);
  if (semantics.includeInProposedBalances !== null) return semantics.includeInProposedBalances;
  return !connectorSemanticIsDeferred(semantics);
}

export function scenarioHasAnnuityEntity() {
  return state.connectors.some((conn) => {
    const scenarioKey = connectorSemantic(conn).scenarioKey;
    return scenarioKey === "annuityIncome" || scenarioKey === "annuityPremium";
  });
}

export function monthlyDistributionIncludesAnnuity(conn) {
  if (connectorSemantic(conn).scenarioKey !== "monthlyDistribution" || !state.scenario.annuityOn) return false;
  // Relevance gate: the annuity toggle may only fold annuity income into the
  // portfolio draw when the loaded template actually contains an annuity entity.
  // Without one, toggling annuityOn must be inert (no phantom income injected).
  if (!scenarioHasAnnuityEntity()) return false;
  const targetId = conn.target?.itemId;
  return !state.connectors.some((other) => (
    other.id !== conn.id &&
    connectorSemantic(other).scenarioKey === "annuityIncome" &&
    other.target?.itemId === targetId
  ));
}

export function scenarioAmountForConnector(conn) {
  const semantics = connectorSemantic(conn);
  if (semantics.domainRole === "rmdWithholding") {
    const grossDistribution = (Number(state.scenario.monthlyDistribution) || 0) * 12;
    return Math.round(grossDistribution * ((Number(state.scenario.taxReservePct) || 0) / 100));
  }
  if (semantics.domainRole === "rmdSpendable") {
    const grossDistribution = (Number(state.scenario.monthlyDistribution) || 0) * 12;
    const withholdingRate = (Number(state.scenario.taxReservePct) || 0) / 100;
    return Math.round(grossDistribution * (1 - withholdingRate));
  }
  if (semantics.scenarioKey === "monthlyDistribution") {
    const annuity = monthlyDistributionIncludesAnnuity(conn) ? Number(state.scenario.annuityMonthlyIncome) || 0 : 0;
    return (Number(state.scenario.monthlyDistribution) || 0) * 12 + annuity * 12;
  }
  if (semantics.scenarioKey === "guaranteedIncome") return (Number(state.scenario.guaranteedIncome) || 0) * 12;
  if (semantics.scenarioKey === "flexibleIncome") return (Number(state.scenario.flexibleIncome || state.scenario.monthlyDistribution) || 0) * 12;
  if (semantics.scenarioKey === "annuityIncome") return state.scenario.annuityOn ? (Number(state.scenario.annuityMonthlyIncome) || 0) * 12 : 0;
  if (semantics.scenarioKey === "annuityPremium") return Number(state.scenario.annuityPremium) || 0;
  if (semantics.scenarioKey === "rollover") return Number(state.scenario.rollover ?? conn.amount) || 0;
  if (semantics.scenarioKey === "rothConversion") return Number(state.scenario.rothConversion) || 0;
  if (semantics.scenarioKey === "taxPayment") return Math.round((Number(state.scenario.rothConversion) || 0) * ((Number(state.scenario.taxReservePct) || 0) / 100));
  return Number(conn.amount) || 0;
}

export function connectorHasManualAmount(conn) {
  return conn?.manualAmount === true || conn?.amountSource === "manual";
}

export function connectorScenarioDriver(conn) {
  const scenarioKey = connectorSemantic(conn).scenarioKey;
  if (!scenarioKey) return null;
  return SCENARIO_DRIVER_CONFIG[scenarioKey]
    ? { ...SCENARIO_DRIVER_CONFIG[scenarioKey] }
    : {
      scenarioKey,
      scenarioField: scenarioKey,
      label: scenarioKey,
      unit: connectorUsesMonthlyDisplay(conn) ? "monthly" : "oneTime",
      cadence: connectorUsesMonthlyDisplay(conn) ? "monthly" : "oneTime"
    };
}

export function connectorAmountSource(conn) {
  if (connectorHasManualAmount(conn)) return "manual";
  return connectorScenarioDriver(conn) ? "linked" : "fixed";
}

export function syncScenarioConnectors() {
  state.connectors.forEach((conn) => {
    if (connectorSemantic(conn).scenarioKey && !connectorHasManualAmount(conn)) {
      conn.amount = scenarioAmountForConnector(conn);
    }
  });
}

function needForPaycheckTarget(targetItemId) {
  const item = targetItemId ? getItem(targetItemId) : null;
  const data = item?.financeId ? state.financeData[item.financeId] : null;
  return Number(data?.monthlyNeed ?? item?.monthlyNeed ?? state.scenario.monthlyNeed) || 0;
}

function cashflowSummaryFromCoverage(coverage, need) {
  // Mapped income is derived ONLY from genuine income connectors that cover the
  // paycheck. When a template has no such connectors we must not fabricate a
  // mapped figure from raw scenario defaults (roth/estate/blank) -- that would
  // invent income that has no node on the canvas. hasLiveCashflow gates banner
  // visibility so no dangling Need/Gap/Mapped banner appears.
  const mapped = coverage.reduce((sum, conn) => sum + connectorDisplayAmount(conn), 0);
  const guaranteed = coverage.reduce((sum, conn) => {
    const semantics = connectorSemantic(conn);
    return /guaranteed|annuity|pension|socialSecurity/i.test(String(semantics.domainRole || semantics.scenarioKey || conn.label || ""))
      ? sum + connectorDisplayAmount(conn)
      : sum;
  }, 0);
  return {
    need,
    flexible: mapped - guaranteed,
    guaranteed,
    mapped,
    gap: mapped - need,
    hasLiveCashflow: coverage.length > 0
  };
}

export function connectorUsesMonthlyDisplay(conn) {
  if (!conn) return false;
  const semantics = connectorSemantic(conn);
  if (semantics.cadence) return semantics.cadence === "monthly";
  if (MONTHLY_CONNECTOR_SCENARIO_KEYS.has(semantics.scenarioKey)) return true;
  const target = conn.target?.itemId ? getItem(conn.target.itemId) : null;
  return target?.visual === "paycheck" && (semantics.flowType === "income" || semantics.flowType === "rmd");
}

export function connectorSourceEffect(conn) {
  return connectorSemantic(conn).sourceEffect;
}

export function connectorTargetEffect(conn) {
  return connectorSemantic(conn).targetEffect;
}

export function connectorCountsTowardCashflow(conn) {
  return connectorIncludedInCurrentCashflow(conn) && connectorTargetEffect(conn) === "cashflowCoverage";
}

export function connectorDisplayAmount(conn) {
  const amount = Number(conn?.amount) || 0;
  return connectorUsesMonthlyDisplay(conn) ? amount / 12 : amount;
}

export function connectorDisplayAmountText(conn) {
  const semantics = connectorSemantic(conn);
  const cadence = semantics.cadence || (connectorUsesMonthlyDisplay(conn) ? "monthly" : "oneTime");
  const amount = connectorDisplayAmount(conn);
  if (cadence === "monthly") return `${currency.format(amount)}/mo`;
  if (cadence === "annual") return `${currency.format(amount)}/yr`;
  return compactDollars(amount);
}

export function connectorTimeProfile(conn) {
  const semantics = connectorSemantic(conn);
  const cadence = semantics.cadence || (connectorUsesMonthlyDisplay(conn) ? "monthly" : "oneTime");
  const timing = semantics.timing || "current";
  const storedAmount = Number(conn?.amount) || 0;
  const monthlyAmount = cadence === "monthly"
    ? storedAmount / 12
    : cadence === "annual"
      ? storedAmount / 12
      : 0;
  return {
    cadence,
    timing,
    activeNow: timing === "current",
    storedAmount,
    displayAmount: connectorDisplayAmount(conn),
    monthlyAmount,
    annualizedAmount: cadence === "oneTime" ? 0 : storedAmount,
    eventAmount: cadence === "oneTime" ? storedAmount : 0
  };
}

export function connectorMotionEnabled(conn) {
  const motion = state.motion || {};
  const disabledConnectorIds = Array.isArray(motion.disabledConnectorIds) ? motion.disabledConnectorIds : [];
  return motion.enabled !== false && !disabledConnectorIds.includes(conn?.id);
}

export function connectorStoredAmountFromDisplay(conn, displayAmount) {
  const amount = Number(displayAmount) || 0;
  return connectorUsesMonthlyDisplay(conn) ? amount * 12 : amount;
}

export function computeValues() {
  computeDiagnostics.computeValuesCalls += 1;
  const next = {};
  Object.entries(state.financeData).forEach(([id, data]) => {
    next[id] = Number(data.value) || 0;
  });

  if (state.viewMode === "proposed") {
    state.connectors.forEach((conn) => {
      if (!connectorIncludedInProposedBalances(conn)) return;
      const sourceId = conn.source.itemId;
      const targetId = conn.target.itemId;
      const amount = Number(conn.amount) || 0;
      const source = sourceId ? getItem(sourceId) : null;
      const target = targetId ? getItem(targetId) : null;
      if (source?.financeId && next[source.financeId] !== undefined && connectorSourceEffect(conn) === "decreaseBalance") {
        next[source.financeId] -= amount;
      }
      if (target?.financeId && next[target.financeId] !== undefined && connectorTargetEffect(conn) === "increaseBalance") {
        next[target.financeId] += amount;
      }
    });
  }

  return next;
}

export function flowBreakdownForItem(itemId) {
  if (state.viewMode !== "proposed") return { inflow: 0, outflow: 0 };
  let inflow = 0;
  let outflow = 0;
  state.connectors.forEach((conn) => {
    if (!connectorIncludedInProposedBalances(conn)) return;
    const amount = Number(conn.amount) || 0;
    if (conn.target.itemId === itemId && connectorTargetEffect(conn) === "increaseBalance") inflow += amount;
    if (conn.source.itemId === itemId && connectorSourceEffect(conn) === "decreaseBalance") outflow += amount;
  });
  return { inflow, outflow };
}

export function syncComputedValues(options = {}) {
  syncScenarioConnectors();
  state.previousValues = options.animateDelta ? { ...state.currentValues } : {};
  state.currentValues = computeValues();
  invalidateComputedViewModel();
}

function inventoryFromValues(financeValues) {
  const rows = [];
  state.items.forEach((item) => {
    if (item.type !== "finance" || !item.financeId) return;
    const data = state.financeData[item.financeId];
    if (!data || !data.category) return;
    const value = financeValues[item.financeId] ?? data.value ?? 0;
    const capacity = Math.max(1, Number(data.capacity) || 1);
    const rowState = value < 0 ? "overdraft" : value > capacity ? "overflow" : "neutral";
    rows.push({
      id: item.id,
      financeId: item.financeId,
      label: item.label || "Untitled",
      category: data.category,
      categoryLabel: accountCategories[data.category] || data.category,
      value,
      baseValue: Number(data.value) || 0,
      capacity,
      state: rowState
    });
  });

  const groups = {};
  rows.forEach((row) => {
    if (!groups[row.category]) {
      groups[row.category] = {
        category: row.category,
        label: row.categoryLabel,
        total: 0,
        rows: []
      };
    }
    groups[row.category].total += Number(row.value) || 0;
    groups[row.category].rows.push(row);
  });

  return {
    rows,
    groups,
    total: rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0)
  };
}

export function computeCashflowSummary(targetItemId = null) {
  if (targetItemId) {
    const need = needForPaycheckTarget(targetItemId);
    const coverage = state.connectors.filter((conn) => (
      conn.target?.itemId === targetItemId && connectorCountsTowardCashflow(conn)
    ));
    return cashflowSummaryFromCoverage(coverage, need);
  }

  const need = Number(state.scenario.monthlyNeed) || 0;
  const coverage = state.connectors.filter((conn) => connectorCountsTowardCashflow(conn));
  return cashflowSummaryFromCoverage(coverage, need);
}

function connectorViewFromState(conn) {
  const semantics = connectorSemantic(conn);
  const usesMonthlyDisplay = connectorUsesMonthlyDisplay(conn);
  const driver = connectorScenarioDriver(conn);
  const amountSource = connectorAmountSource(conn);
  const timeProfile = connectorTimeProfile(conn);
  return {
    id: conn.id,
    label: conn.label || "",
    amount: Number(conn.amount) || 0,
    displayAmount: connectorDisplayAmount(conn),
    amountText: connectorDisplayAmountText(conn),
    usesMonthlyDisplay,
    amountSource,
    manualAmount: amountSource === "manual",
    driver,
    timeProfile,
    flowType: semantics.flowType,
    flowSemantic: semantics,
    cadence: timeProfile.cadence,
    timing: timeProfile.timing,
    sourceEffect: semantics.sourceEffect,
    targetEffect: semantics.targetEffect,
    sourceId: conn.source?.itemId || null,
    targetId: conn.target?.itemId || null,
    countsTowardCashflow: connectorCountsTowardCashflow(conn),
    motionEnabled: connectorMotionEnabled(conn)
  };
}

export function computeCanvasViewModel(options = {}) {
  if (!options.force && computedViewModelCache) return computedViewModelCache;
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  computeDiagnostics.viewModelComputes += 1;
  const hasCurrentValues = state.currentValues && Object.keys(state.currentValues).length > 0;
  const financeValues = { ...(hasCurrentValues ? state.currentValues : computeValues()) };
  const cashflow = computeCashflowSummary();
  const cashflowByItemId = Object.fromEntries(
    state.items
      .filter((item) => item.type === "finance" && item.visual === "paycheck")
      .map((item) => [item.id, computeCashflowSummary(item.id)])
  );
  const inventory = inventoryFromValues(financeValues);
  const connectors = Object.fromEntries(
    state.connectors.map((conn) => [conn.id, connectorViewFromState(conn)])
  );
  const overdraftRows = inventory.rows.filter((row) => row.state === "overdraft");
  const nonFiniteFinanceIds = Object.entries(financeValues)
    .filter(([, value]) => !Number.isFinite(Number(value)))
    .map(([id]) => id);
  const disabledConnectorIds = Array.isArray(state.motion?.disabledConnectorIds)
    ? [...state.motion.disabledConnectorIds]
    : [];

  computedViewModelCache = {
    financeValues,
    cashflow,
    cashflowByItemId,
    connectors,
    inventory,
    diagnostics: {
      overdraftItemIds: overdraftRows.map((row) => row.id),
      overdraftFinanceIds: overdraftRows.map((row) => row.financeId),
      nonFiniteFinanceIds
    },
    motion: {
      enabled: state.motion?.enabled !== false,
      disabledConnectorIds,
      reduced: typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false
    }
  };
  computeDiagnostics.lastViewModelMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
  return computedViewModelCache;
}

export function fillPercent(item) {
  if (!item.financeId) return "0%";
  const value = state.currentValues[item.financeId] ?? state.financeData[item.financeId]?.value ?? 0;
  const capacity = Math.max(1, Number(state.financeData[item.financeId]?.capacity) || 1);
  return `${clamp((value / capacity) * 100, 0, 100)}%`;
}

export function financeState(item) {
  if (!item.financeId) return "";
  const value = state.currentValues[item.financeId] ?? state.financeData[item.financeId]?.value ?? 0;
  const capacity = Math.max(1, Number(state.financeData[item.financeId]?.capacity) || 1);
  if (value < 0) return "overdraft";
  if (value > capacity) return "overflow";
  return "";
}

export function computeConnectorWidth(amount, widthMode = "amount", customWidth = 5) {
  if (widthMode === "subtle") return 2.8;
  if (widthMode === "medium") return 4.8;
  if (widthMode === "bold") return 7.2;
  if (widthMode === "custom") return clamp(Number(customWidth) || 5, 2.5, 9);
  return clamp(2.6 + (Number(amount) || 0) / 140000, 2.6, 7.4);
}

let connectorScoringCache = null;
let labelObstacleScoringDepth = 0;

function createConnectorScoringCache() {
  return {
    endpointIdSets: new Map(),
    pairKeys: new Map(),
    baselineSamples: new Map(),
    sampleBounds: new Map(),
    labelRects: new Map()
  };
}

export function withConnectorScoringCache(callback) {
  const previousCache = connectorScoringCache;
  connectorScoringCache = createConnectorScoringCache();
  try {
    return callback();
  } finally {
    connectorScoringCache = previousCache;
  }
}

function connectorCacheKey(conn) {
  return conn?.id ?? conn;
}

function boundsForSamples(samples) {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  samples.forEach((point) => {
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  });
  return { left, right, top, bottom };
}

function expandedBoundsOverlap(a, b, pad = 0) {
  return (
    a.left - pad <= b.right + pad &&
    a.right + pad >= b.left - pad &&
    a.top - pad <= b.bottom + pad &&
    a.bottom + pad >= b.top - pad
  );
}


export function getConnectorColor(conn) {
  const theme = getTheme();
  const mode = conn.colorMode || "flow";
  if (mode === "accent") return theme.vars.accent;
  if (mode === "teal") return theme.vars.teal;
  if (mode === "metal") return theme.vars.metal;
  if (mode === "graphite") return theme.vars.text;
  if (mode === "red") return theme.vars["accent-2"];
  return theme.flowColors[connectorSemantic(conn).flowType] || theme.vars.accent;
}

export function pointFromEvent(event) {
  const rect = dom.canvasStage.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left - state.viewport.x) / state.viewport.zoom, 0, WORLD.width),
    y: clamp((event.clientY - rect.top - state.viewport.y) / state.viewport.zoom, 0, WORLD.height)
  };
}

export function screenPoint(worldPoint) {
  const stageRect = dom.canvasStage.getBoundingClientRect();
  const workspaceRect = dom.workspace.getBoundingClientRect();
  return {
    x: stageRect.left - workspaceRect.left + state.viewport.x + worldPoint.x * state.viewport.zoom,
    y: stageRect.top - workspaceRect.top + state.viewport.y + worldPoint.y * state.viewport.zoom
  };
}

export function visibleWorldCenter() {
  const rect = dom.canvasStage.getBoundingClientRect();
  return {
    x: clamp((rect.width / 2 - state.viewport.x) / state.viewport.zoom, 80, WORLD.width - 80),
    y: clamp((rect.height / 2 - state.viewport.y) / state.viewport.zoom, 80, WORLD.height - 80)
  };
}

export function constrainViewport() {
  const rect = dom.canvasStage.getBoundingClientRect();
  const edgeX = Math.min(520, rect.width * 0.25);
  const edgeY = Math.min(360, rect.height * 0.25);
  const minX = rect.width - WORLD.width * state.viewport.zoom - edgeX;
  const maxX = edgeX;
  const minY = rect.height - WORLD.height * state.viewport.zoom - edgeY;
  const maxY = edgeY;
  state.viewport.x = clamp(state.viewport.x, minX, maxX);
  state.viewport.y = clamp(state.viewport.y, minY, maxY);
}

export function computeContentBoundingBox() {
  return withConnectorScoringCache(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const includeRect = (x, y, w, h) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    };
    const includePoint = (point) => {
      if (!point || Number.isNaN(point.x) || Number.isNaN(point.y)) return;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    };

    state.items.forEach((item) => includeRect(item.x - item.w / 2, item.y - item.h / 2, item.w, item.h));
    state.groups.forEach((group) => includeRect(group.x - group.w / 2, group.y - group.h / 2, group.w, group.h));
    const visibleConnectors = state.connectors.filter((conn) => conn.visible !== false);
    const approximateConnectorBounds = visibleConnectors.length > 48;
    visibleConnectors.forEach((conn) => {
      if (conn.visible === false) return;
      if (approximateConnectorBounds) {
        includePoint(rawEndpoint(conn.source));
        includePoint(rawEndpoint(conn.target));
        includePoint(conn.mid);
        includePoint(conn.labelPoint);
        return;
      }
      const computed = computeConnectorPath(conn);
      includePoint(computed.source);
      includePoint(computed.target);
      includePoint(computed.control);
      (computed.waypoints || []).forEach(includePoint);
      if (!computed.label.hidden) includePoint(computed.label);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  });
}

export function rawEndpoint(endpointValue) {
  if (endpointValue?.detached && Number.isFinite(endpointValue.x) && Number.isFinite(endpointValue.y)) {
    return { x: endpointValue.x, y: endpointValue.y };
  }
  if (endpointValue.itemId) {
    const node = getNode(endpointValue.itemId);
    if (node) {
      const offsetX = Number.isFinite(endpointValue.offsetX) ? endpointValue.offsetX : 0;
      const offsetY = Number.isFinite(endpointValue.offsetY) ? endpointValue.offsetY : 0;
      return { x: node.x + offsetX, y: node.y + offsetY };
    }
  }
  return { x: endpointValue.x ?? WORLD.width / 2, y: endpointValue.y ?? WORLD.height / 2 };
}

export function anchorPointForNode(node, toward) {
  const dx = toward.x - node.x;
  const dy = toward.y - node.y;
  const scaleX = Math.abs(dx) / Math.max(1, node.w);
  const scaleY = Math.abs(dy) / Math.max(1, node.h);

  if (scaleX >= scaleY) {
    return {
      x: node.x + Math.sign(dx || 1) * node.w / 2,
      y: node.y + clamp(dy, -node.h / 2 + 14, node.h / 2 - 14)
    };
  }

  return {
    x: node.x + clamp(dx, -node.w / 2 + 14, node.w / 2 - 14),
    y: node.y + Math.sign(dy || 1) * node.h / 2
  };
}

function explicitEdgePointForNode(node, endpointValue, toward) {
  const halfW = node.w / 2;
  const halfH = node.h / 2;
  const offsetX = clamp(Number.isFinite(endpointValue.offsetX) ? endpointValue.offsetX : 0, -halfW, halfW);
  const offsetY = clamp(Number.isFinite(endpointValue.offsetY) ? endpointValue.offsetY : 0, -halfH, halfH);
  const candidates = [
    { edge: "right", distance: Math.abs(halfW - offsetX) },
    { edge: "left", distance: Math.abs(offsetX + halfW) },
    { edge: "bottom", distance: Math.abs(halfH - offsetY) },
    { edge: "top", distance: Math.abs(offsetY + halfH) }
  ].sort((a, b) => a.distance - b.distance);
  const nearest = candidates[0];
  const edgeTolerance = Math.max(10, Math.min(18, Math.min(halfW, halfH) * 0.2));

  if (!nearest || nearest.distance > edgeTolerance) return anchorPointForNode(node, toward);

  if (nearest.edge === "right") {
    return { x: node.x + halfW, y: node.y + clamp(offsetY, -halfH + 14, halfH - 14) };
  }
  if (nearest.edge === "left") {
    return { x: node.x - halfW, y: node.y + clamp(offsetY, -halfH + 14, halfH - 14) };
  }
  if (nearest.edge === "bottom") {
    return { x: node.x + clamp(offsetX, -halfW + 14, halfW - 14), y: node.y + halfH };
  }
  return { x: node.x + clamp(offsetX, -halfW + 14, halfW - 14), y: node.y - halfH };
}

function endpointHasNamedPort(endpointValue) {
  return Boolean(endpointValue?.port || endpointValue?.portId);
}

function endpointHasLegacyOffset(endpointValue) {
  return !endpointHasNamedPort(endpointValue) && (
    Number.isFinite(endpointValue?.offsetX) ||
    Number.isFinite(endpointValue?.offsetY)
  );
}

function endpointHasOffset(endpointValue) {
  return Number.isFinite(endpointValue?.offsetX) || Number.isFinite(endpointValue?.offsetY);
}

function adjustedNamedPortPoint(node, endpointValue, portInfo) {
  const halfW = Math.max(1, node.w / 2);
  const halfH = Math.max(1, node.h / 2);
  const edge = portInfo.edge || nearestPortEdge(node, portInfo.point);
  const offsetX = Number.isFinite(endpointValue.offsetX) ? endpointValue.offsetX : portInfo.point.x - node.x;
  const offsetY = Number.isFinite(endpointValue.offsetY) ? endpointValue.offsetY : portInfo.point.y - node.y;

  if (edge === "left") {
    return { x: node.x - halfW, y: node.y + clamp(offsetY, -halfH + 14, halfH - 14) };
  }
  if (edge === "right") {
    return { x: node.x + halfW, y: node.y + clamp(offsetY, -halfH + 14, halfH - 14) };
  }
  if (edge === "top") {
    return { x: node.x + clamp(offsetX, -halfW + 14, halfW - 14), y: node.y - halfH };
  }
  return { x: node.x + clamp(offsetX, -halfW + 14, halfW - 14), y: node.y + halfH };
}

function resolveComputedEndpointPort(endpointValue, toward) {
  if (endpointValue?.detached && Number.isFinite(endpointValue.x) && Number.isFinite(endpointValue.y)) {
    return { point: { x: endpointValue.x, y: endpointValue.y }, routePoint: { x: endpointValue.x, y: endpointValue.y }, port: null, edge: null, corridor: null, node: null };
  }
  if (endpointValue?.itemId) {
    const node = getNode(endpointValue.itemId);
    if (node && endpointHasLegacyOffset(endpointValue)) {
      const point = explicitEdgePointForNode(node, endpointValue, toward);
      return {
        point,
        routePoint: endpointPortStub(endpointValue, point),
        port: null,
        edge: nearestPortEdge(node, point),
        corridor: null,
        node
      };
    }
    if (node && endpointHasNamedPort(endpointValue) && endpointHasOffset(endpointValue)) {
      const portInfo = resolveEndpointPort(endpointValue, toward);
      const point = adjustedNamedPortPoint(node, endpointValue, portInfo);
      return {
        ...portInfo,
        point,
        routePoint: endpointPortStub(endpointValue, point),
        corridor: null
      };
    }
    if (node && !endpointHasNamedPort(endpointValue)) {
      const point = anchorPointForNode(node, toward);
      return {
        point,
        routePoint: endpointPortStub(endpointValue, point),
        port: null,
        edge: nearestPortEdge(node, point),
        corridor: null,
        node
      };
    }
  }
  return resolveEndpointPort(endpointValue, toward);
}

export function resolveEndpoint(endpointValue, toward) {
  return resolveComputedEndpointPort(endpointValue, toward).point;
}

export function offsetPoint(point, source, target, amount) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: point.x + (-dy / length) * amount,
    y: point.y + (dx / length) * amount
  };
}

function endpointPortStub(endpointValue, port) {
  if (!endpointValue?.itemId) return port;
  const node = getNode(endpointValue.itemId);
  if (!node) return port;
  const halfW = Math.max(1, node.w / 2);
  const halfH = Math.max(1, node.h / 2);
  const distances = [
    { edge: "right", distance: Math.abs((node.x + halfW) - port.x), dx: 1, dy: 0 },
    { edge: "left", distance: Math.abs(port.x - (node.x - halfW)), dx: -1, dy: 0 },
    { edge: "bottom", distance: Math.abs((node.y + halfH) - port.y), dx: 0, dy: 1 },
    { edge: "top", distance: Math.abs(port.y - (node.y - halfH)), dx: 0, dy: -1 }
  ].sort((a, b) => a.distance - b.distance);
  const edge = distances[0] || { dx: 1, dy: 0 };
  const length = clamp(Math.min(Math.max(node.w, node.h) * 0.12, 48), 30, 48);
  return {
    x: clamp(port.x + edge.dx * length, 0, WORLD.width),
    y: clamp(port.y + edge.dy * length, 0, WORLD.height)
  };
}

function endpointHasFixedPort(endpointValue) {
  return endpointHasLegacyOffset(endpointValue) || endpointHasNamedPort(endpointValue);
}

function nearestPortEdge(node, port) {
  const halfW = Math.max(1, node.w / 2);
  const halfH = Math.max(1, node.h / 2);
  return [
    { edge: "right", distance: Math.abs((node.x + halfW) - port.x) },
    { edge: "left", distance: Math.abs(port.x - (node.x - halfW)) },
    { edge: "bottom", distance: Math.abs((node.y + halfH) - port.y) },
    { edge: "top", distance: Math.abs(port.y - (node.y - halfH)) }
  ].sort((a, b) => a.distance - b.distance)[0]?.edge || "right";
}

function parallelPortLaneOffset(conn) {
  const { count, index } = parallelIndex(conn);
  if (count < 2) return 0;
  return (index - ((count - 1) / 2)) * 34;
}

function spreadAutomaticPort(endpointValue, port, laneOffset) {
  if (!laneOffset || !endpointValue?.itemId || endpointHasFixedPort(endpointValue)) return port;
  const node = getNode(endpointValue.itemId);
  if (!node) return port;
  const edge = nearestPortEdge(node, port);
  const halfW = Math.max(1, node.w / 2);
  const halfH = Math.max(1, node.h / 2);
  if (edge === "left" || edge === "right") {
    return {
      x: port.x,
      y: node.y + clamp(port.y - node.y + laneOffset, -halfH + 18, halfH - 18)
    };
  }
  return {
    x: node.x + clamp(port.x - node.x + laneOffset, -halfW + 18, halfW - 18),
    y: port.y
  };
}

function endpointEdgeLaneOffset(conn, endpointKey, endpointValue, port) {
  if (!endpointValue?.itemId || endpointHasFixedPort(endpointValue)) return null;
  const node = getNode(endpointValue.itemId);
  if (!node) return null;
  const edge = nearestPortEdge(node, port);
  const oppositeKey = endpointKey === "source" ? "target" : "source";
  const siblings = state.connectors
    .filter((entry) => {
      if (entry.visible === false) return false;
      const endpoint = entry[endpointKey];
      if (!endpoint?.itemId || endpoint.itemId !== endpointValue.itemId || endpointHasFixedPort(endpoint)) return false;
      const oppositeRaw = rawEndpoint(entry[oppositeKey]);
      const resolved = resolveEndpoint(endpoint, oppositeRaw);
      return nearestPortEdge(node, resolved) === edge;
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (siblings.length < 2) return null;
  const index = siblings.findIndex((entry) => entry.id === conn.id);
  if (index < 0) return null;
  return (index - ((siblings.length - 1) / 2)) * 38;
}

function pointWithPortInfo(info) {
  const point = { x: info.point.x, y: info.point.y };
  if (info.port) point.port = info.port;
  if (info.edge) point.edge = info.edge;
  return point;
}

function routePointWithPortInfo(info) {
  const point = { x: info.routePoint.x, y: info.routePoint.y };
  if (info.port) point.port = info.port;
  if (info.edge) point.edge = info.edge;
  return point;
}

function applyAutomaticPortSpread(endpointValue, info, laneOffset) {
  const point = spreadAutomaticPort(endpointValue, info.point, laneOffset);
  if (point.x === info.point.x && point.y === info.point.y) return info;
  return {
    ...info,
    point,
    routePoint: endpointPortStub(endpointValue, point),
    corridor: null
  };
}

function withEndpointPortStubs(conn, sourceInfo, targetInfo) {
  const pairLaneOffset = parallelPortLaneOffset(conn);
  const sourceLaneOffset = endpointEdgeLaneOffset(conn, "source", conn.source, sourceInfo.point);
  const targetLaneOffset = endpointEdgeLaneOffset(conn, "target", conn.target, targetInfo.point);
  const resolvedSource = applyAutomaticPortSpread(conn.source, sourceInfo, sourceLaneOffset ?? pairLaneOffset);
  const resolvedTarget = applyAutomaticPortSpread(conn.target, targetInfo, targetLaneOffset ?? pairLaneOffset);
  const sourcePort = pointWithPortInfo(resolvedSource);
  const targetPort = pointWithPortInfo(resolvedTarget);
  const sourceStub = routePointWithPortInfo(resolvedSource);
  const targetStub = routePointWithPortInfo(resolvedTarget);
  return {
    source: sourcePort,
    target: targetPort,
    routeSource: sourceStub,
    routeTarget: targetStub,
    sourcePort,
    targetPort,
    sourcePortId: resolvedSource.port,
    targetPortId: resolvedTarget.port,
    hasSourceStub: sourceStub.x !== sourcePort.x || sourceStub.y !== sourcePort.y,
    hasTargetStub: targetStub.x !== targetPort.x || targetStub.y !== targetPort.y
  };
}

export function labelRectForPoint(point, conn = null) {
  const zoom = Math.max(MIN_ZOOM, state.viewport.zoom || 1);
  if (!conn) {
    const width = 154 / zoom;
    const height = 46 / zoom;
    return {
      left: point.x - width / 2,
      right: point.x + width / 2,
      top: point.y - height / 2,
      bottom: point.y + height / 2,
      width,
      height
    };
  }
  const amount = connectorDisplayAmount(conn || {});
  const labelLength = String(conn?.label || "").length;
  const amountLength = String(Math.round(amount)).length;
  const width = clamp((labelLength * 5.6 + amountLength * 5.2 + 44) / zoom, 110 / zoom, 188 / zoom);
  const height = 44 / zoom;
  return {
    left: point.x - width / 2,
    right: point.x + width / 2,
    top: point.y - height / 2,
    bottom: point.y + height / 2,
    width,
    height
  };
}

export function nodeWorldRect(node, pad = 10) {
  return {
    left: node.x - node.w / 2 - pad,
    right: node.x + node.w / 2 + pad,
    top: node.y - node.h / 2 - pad,
    bottom: node.y + node.h / 2 + pad
  };
}

export function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

export function labelOverlapScore(point) {
  const rect = labelRectForPoint(point);
  return getAnchorableNodes().reduce((score, node) => score + overlapArea(rect, nodeWorldRect(node)), 0);
}

function clampLabelPoint(point, conn = null) {
  const rect = labelRectForPoint({ x: 0, y: 0 }, conn);
  const marginX = rect.width / 2;
  const marginY = rect.height / 2;
  return {
    x: clamp(point.x, marginX, WORLD.width - marginX),
    y: clamp(point.y, marginY, WORLD.height - marginY)
  };
}

export function labelObstacleScore(conn, point) {
  const labelRect = labelRectForPoint(point, conn);
  let score = labelSurfaceObstacleScore(conn, labelRect);

  if (!conn || labelObstacleScoringDepth > 0) return score;

  labelObstacleScoringDepth += 1;
  try {
    state.connectors.forEach((other) => {
      if (other.id === conn.id || other.visible === false) return;
      const otherKey = connectorCacheKey(other);
      let otherRect = connectorScoringCache?.labelRects.get(otherKey);
      if (otherRect === undefined) {
        otherRect = scoringLabelRectForConnector(other);
        connectorScoringCache?.labelRects.set(otherKey, otherRect);
      }
      if (!otherRect) return;
      score += overlapArea(labelRect, otherRect) * 12;
    });
  } finally {
    labelObstacleScoringDepth -= 1;
  }

  return score;
}

function labelSurfaceObstacleScore(conn, labelRectOrPoint) {
  const labelRect = labelRectOrPoint?.width
    ? labelRectOrPoint
    : labelRectForPoint(labelRectOrPoint, conn);
  let score = 0;
  obstacleRectsForConnector(conn, {
    pad: 8,
    includeEndpointBodies: true,
    includeText: true,
    includeSleeves: true
  }).forEach(({ rect, kind }) => {
    const overlap = overlapArea(labelRect, rect);
    if (overlap <= 0) return;
    score += overlap * (kind === "text" || kind === "sleeve" ? 18 : 9);
  });
  return score;
}

function scoringLabelRectForConnector(conn) {
  const mode = conn.labelMode || "auto";
  if (mode === "hidden") return null;
  const sourceRaw = rawEndpoint(conn.source);
  const targetRaw = rawEndpoint(conn.target);
  const sourceInfo = resolveComputedEndpointPort(conn.source, targetRaw);
  const targetInfo = resolveComputedEndpointPort(conn.target, sourceRaw);
  const ports = withEndpointPortStubs(conn, sourceInfo, targetInfo);
  const route = conn.routeStyle || "smartArc";
  const control = conn.mid || fallbackControlPoint(ports.routeSource, ports.routeTarget, route);
  const mid = {
    x: (ports.routeSource.x + ports.routeTarget.x) / 2,
    y: (ports.routeSource.y + ports.routeTarget.y) / 2
  };
  const autoLabel = autoLabelForRoute(route, ports.routeSource, ports.routeTarget, control);
  let point = null;

  if (mode === "manual" && conn.labelPoint) {
    const manualScore = labelObstacleScoringDepth > 0
      ? labelSurfaceObstacleScore(conn, conn.labelPoint)
      : labelObstacleScore(conn, conn.labelPoint);
    if (manualScore === 0) point = conn.labelPoint;
  }
  else if (mode === "above") point = offsetPoint(mid, ports.routeSource, ports.routeTarget, 34);
  else if (mode === "below") point = offsetPoint(mid, ports.routeSource, ports.routeTarget, -34);
  else if (mode === "start") point = {
    x: ports.routeSource.x * 0.72 + ports.routeTarget.x * 0.28,
    y: ports.routeSource.y * 0.72 + ports.routeTarget.y * 0.28
  };
  else if (mode === "end") point = {
    x: ports.routeSource.x * 0.28 + ports.routeTarget.x * 0.72,
    y: ports.routeSource.y * 0.28 + ports.routeTarget.y * 0.72
  };
  if (!point) {
    labelObstacleScoringDepth += 1;
    try {
      point = autoLabelPoint(conn, ports.routeSource, ports.routeTarget, control, autoLabel);
    } finally {
      labelObstacleScoringDepth -= 1;
    }
  }

  return point ? labelRectForPoint(clampLabelPoint(point, conn), conn) : null;
}

function visibleLabelRectsForScoring(exceptConn = null) {
  const rects = [];
  state.connectors.forEach((other) => {
    if (other.visible === false || other.id === exceptConn?.id) return;
    const otherKey = connectorCacheKey(other);
    let rect = connectorScoringCache?.labelRects.get(otherKey);
    if (rect === undefined) {
      rect = scoringLabelRectForConnector(other);
      connectorScoringCache?.labelRects.set(otherKey, rect);
    }
    if (rect) rects.push(rect);
  });
  return rects;
}

export function autoLabelPoint(connOrSource, sourceOrTarget, targetOrControl, controlOrAutoLabel, maybeAutoLabel) {
  const hasConnArg = maybeAutoLabel !== undefined;
  const conn = hasConnArg ? connOrSource : null;
  const source = hasConnArg ? sourceOrTarget : connOrSource;
  const target = hasConnArg ? targetOrControl : sourceOrTarget;
  const control = hasConnArg ? controlOrAutoLabel : targetOrControl;
  const autoLabel = hasConnArg ? maybeAutoLabel : controlOrAutoLabel;
  const mid = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  const labelRect = labelRectForPoint(autoLabel, conn);
  const along = (ratio) => ({
    x: source.x * (1 - ratio) + target.x * ratio,
    y: source.y * (1 - ratio) + target.y * ratio
  });
  const candidates = [
    autoLabel,
    offsetPoint(control, source, target, 42),
    offsetPoint(control, source, target, -42),
    offsetPoint(mid, source, target, 46),
    offsetPoint(mid, source, target, -46),
    offsetPoint(control, source, target, 92),
    offsetPoint(control, source, target, -92),
    offsetPoint(mid, source, target, 118),
    offsetPoint(mid, source, target, -118),
    offsetPoint(along(0.35), source, target, 34),
    offsetPoint(along(0.65), source, target, 34),
    offsetPoint(along(0.35), source, target, -34),
    offsetPoint(along(0.65), source, target, -34),
    along(0.28),
    along(0.72)
  ];

  getAnchorableNodes().forEach((node) => {
    const rect = nodeWorldRect(node, 14);
    candidates.push(
      { x: autoLabel.x, y: rect.top - labelRect.height / 2 - 14 },
      { x: autoLabel.x, y: rect.bottom + labelRect.height / 2 + 14 },
      { x: rect.left - labelRect.width / 2 - 14, y: autoLabel.y },
      { x: rect.right + labelRect.width / 2 + 14, y: autoLabel.y }
    );
  });

  return candidates
    .map((point) => clampLabelPoint(point, conn))
    .map((point, index) => ({
      point,
      index,
      overlap: labelObstacleScore(conn, point),
      distance: Math.hypot(point.x - autoLabel.x, point.y - autoLabel.y)
    }))
    .sort((a, b) => a.overlap - b.overlap || a.distance - b.distance || a.index - b.index)[0].point;
}

function baseBendAmount(source, target, route) {
  const distance = Math.hypot(target.x - source.x, target.y - source.y) || 1;
  return route === "sCurve" ? clamp(distance * 0.2, 52, 120) : clamp(distance * 0.16, 36, 92);
}

function fallbackControlPoint(source, target, route, bend = baseBendAmount(source, target, route)) {
  const mid = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  if (route === "straight" || route === "elbow") return mid;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy) || 1;
  return {
    x: mid.x + (-dy / distance) * bend,
    y: mid.y + (dx / distance) * bend
  };
}

function endpointIdentity(endpointValue) {
  if (endpointValue?.itemId) return `node:${endpointValue.itemId}`;
  return `free:${Math.round(Number(endpointValue?.x) || 0)}:${Math.round(Number(endpointValue?.y) || 0)}`;
}

function connectorPairKey(conn) {
  const cacheKey = connectorCacheKey(conn);
  if (connectorScoringCache?.pairKeys.has(cacheKey)) {
    return connectorScoringCache.pairKeys.get(cacheKey);
  }
  const key = [endpointIdentity(conn.source), endpointIdentity(conn.target)].sort().join("|");
  connectorScoringCache?.pairKeys.set(cacheKey, key);
  return key;
}

function parallelIndex(conn) {
  const key = connectorPairKey(conn);
  const siblings = state.connectors
    .filter((entry) => connectorPairKey(entry) === key)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return {
    count: siblings.length,
    index: Math.max(0, siblings.findIndex((entry) => entry.id === conn.id))
  };
}

function parallelLaneSlot(index, count) {
  if (count < 2) return 0;
  const center = (count - 1) / 2;
  const distance = index - center;
  return distance === 0 ? 0 : distance * 2.35;
}

function bendMultipliersFor(conn) {
  const defaults = [1, -1, 1.65, -1.65, 0.55, -0.55, 2.25, -2.25];
  const { count, index } = parallelIndex(conn);
  if (count < 2) return defaults;
  const parallelSlots = Array.from({ length: count }, (_, slotIndex) => parallelLaneSlot(slotIndex, count));
  const fallbackSlots = [-3.2, 3.2, -2.35, 2.35, -1.25, 1.25, 0];
  const preferred = parallelLaneSlot(index, count);
  return [preferred, ...parallelSlots, ...fallbackSlots, ...defaults].filter((value, valueIndex, values) => values.findIndex((entry) => Math.abs(entry - value) < 0.001) === valueIndex);
}

function pointOnQuadratic(source, control, target, t) {
  const inv = 1 - t;
  return {
    x: inv * inv * source.x + 2 * inv * t * control.x + t * t * target.x,
    y: inv * inv * source.y + 2 * inv * t * control.y + t * t * target.y,
    t
  };
}

function pointOnCubic(source, c1, c2, target, t) {
  const inv = 1 - t;
  return {
    x: inv ** 3 * source.x + 3 * inv * inv * t * c1.x + 3 * inv * t * t * c2.x + t ** 3 * target.x,
    y: inv ** 3 * source.y + 3 * inv * inv * t * c1.y + 3 * inv * t * t * c2.y + t ** 3 * target.y,
    t
  };
}

function roundedElbowPoints(source, target, control) {
  const x1 = source.x;
  const y1 = source.y;
  const x2 = control.x;
  const y2 = target.y;
  const x3 = target.x;
  const y3 = target.y;
  const dx1 = x2 - x1;
  const dy = y2 - y1;
  const dx2 = x3 - x2;
  const r1 = Math.max(0, Math.min(44, Math.abs(dx1) * 0.42, Math.abs(dy) * 0.42));
  const r2 = Math.max(0, Math.min(44, Math.abs(dx2) * 0.42, Math.abs(dy) * 0.42));
  const sx1 = Math.sign(dx1) || 1;
  const sy = Math.sign(dy) || 1;
  const sx2 = Math.sign(dx2) || 1;
  return {
    beforeFirst: { x: x2 - sx1 * r1, y: y1 },
    afterFirst: { x: x2, y: y1 + sy * r1 },
    beforeSecond: { x: x2, y: y2 - sy * r2 },
    afterSecond: { x: x2 + sx2 * r2, y: y2 },
    firstCorner: { x: x2, y: y1 },
    secondCorner: { x: x2, y: y2 },
    r1,
    r2
  };
}

function pointOnLine(a, b, t) {
  return {
    x: a.x * (1 - t) + b.x * t,
    y: a.y * (1 - t) + b.y * t
  };
}

function pointOnElbow(source, target, control, t) {
  const elbow = roundedElbowPoints(source, target, control);
  const segments = [
    { type: "line", from: source, to: elbow.beforeFirst, weight: Math.hypot(elbow.beforeFirst.x - source.x, elbow.beforeFirst.y - source.y) },
    { type: "quad", from: elbow.beforeFirst, control: elbow.firstCorner, to: elbow.afterFirst, weight: Math.max(1, elbow.r1 * 1.6) },
    { type: "line", from: elbow.afterFirst, to: elbow.beforeSecond, weight: Math.hypot(elbow.beforeSecond.x - elbow.afterFirst.x, elbow.beforeSecond.y - elbow.afterFirst.y) },
    { type: "quad", from: elbow.beforeSecond, control: elbow.secondCorner, to: elbow.afterSecond, weight: Math.max(1, elbow.r2 * 1.6) },
    { type: "line", from: elbow.afterSecond, to: target, weight: Math.hypot(target.x - elbow.afterSecond.x, target.y - elbow.afterSecond.y) }
  ].filter((segment) => segment.weight > 0.5);
  const total = segments.reduce((sum, segment) => sum + segment.weight, 0) || 1;
  let cursor = t * total;
  for (const segment of segments) {
    if (cursor > segment.weight) {
      cursor -= segment.weight;
      continue;
    }
    const localT = clamp(cursor / segment.weight, 0, 1);
    if (segment.type === "quad") return pointOnQuadratic(segment.from, segment.control, segment.to, localT);
    return pointOnLine(segment.from, segment.to, localT);
  }
  return target;
}

export function connectorSamplePoints(source, target, control, route, steps = 24) {
  const samples = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    if (route === "straight") {
      samples.push({
        x: source.x * (1 - t) + target.x * t,
        y: source.y * (1 - t) + target.y * t,
        t
      });
    } else if (route === "elbow") {
      samples.push({ ...pointOnElbow(source, target, control, t), t });
    } else if (route === "sCurve") {
      const c1 = { x: source.x * 0.72 + control.x * 0.28, y: source.y * 0.72 + control.y * 0.28 };
      const c2 = { x: target.x * 0.72 + control.x * 0.28, y: target.y * 0.72 + control.y * 0.28 };
      samples.push(pointOnCubic(source, c1, c2, target, t));
    } else {
      samples.push(pointOnQuadratic(source, control, target, t));
    }
  }
  return samples;
}

function pointInsideRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function lanePreferenceScore(points) {
  const lanes = storyLaneCorridors(state.templateLayout);
  if (!lanes.length) return 0;
  let score = 0;
  points.forEach((point) => {
    const inLane = lanes.some((lane) => pointInsideRect(point, lane.rect));
    if (!inLane) score += 220;
  });
  return score;
}

function lineSegmentRectIntersect(p1, p2, rect) {
  if (Math.max(p1.x, p2.x) < rect.left || Math.min(p1.x, p2.x) > rect.right) return false;
  if (Math.max(p1.y, p2.y) < rect.top || Math.min(p1.y, p2.y) > rect.bottom) return false;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const sign = (px, py) => (px - p1.x) * dy - (py - p1.y) * dx;
  const s1 = sign(rect.left, rect.top);
  const s2 = sign(rect.right, rect.top);
  const s3 = sign(rect.left, rect.bottom);
  const s4 = sign(rect.right, rect.bottom);
  if (s1 > 0 && s2 > 0 && s3 > 0 && s4 > 0) return false;
  if (s1 < 0 && s2 < 0 && s3 < 0 && s4 < 0) return false;
  return true;
}

const DETOUR_MARGIN = 34;
const DETOUR_WORLD_MARGIN = 24;
const DETOUR_PORT_CORRIDOR_WIDTH = 22;
const DETOUR_TURN_COST = 14;
const DETOUR_UNRELATED_BODY_COST = 600000;
const DETOUR_TEXT_COST = 900000;
const DETOUR_LABEL_COST = 950000;
const DETOUR_ENDPOINT_COST = Number.POSITIVE_INFINITY;
const COLLAPSED_PORT_CORRIDOR_REACH = DETOUR_MARGIN + DETOUR_PORT_CORRIDOR_WIDTH / 2 + 6;
const DETOUR_LANE_POINT_COST = 260;

function corridorRectForSegment(a, b, width = DETOUR_PORT_CORRIDOR_WIDTH) {
  const half = width / 2;
  return {
    left: Math.min(a.x, b.x) - half,
    right: Math.max(a.x, b.x) + half,
    top: Math.min(a.y, b.y) - half,
    bottom: Math.max(a.y, b.y) + half
  };
}

function corridorRectForCollapsedPort(point, node, width = DETOUR_PORT_CORRIDOR_WIDTH) {
  const half = width / 2;
  if (!node) {
    return {
      left: point.x - half,
      right: point.x + half,
      top: point.y - half,
      bottom: point.y + half
    };
  }
  const rect = nodeWorldRect(node, 0);
  const edge = point.edge || nearestPortEdge(node, point);
  if (edge === "left" || edge === "right") {
    return {
      left: point.x - half,
      right: point.x + half,
      top: rect.top - COLLAPSED_PORT_CORRIDOR_REACH,
      bottom: rect.bottom + COLLAPSED_PORT_CORRIDOR_REACH
    };
  }
  return {
    left: rect.left - COLLAPSED_PORT_CORRIDOR_REACH,
    right: rect.right + COLLAPSED_PORT_CORRIDOR_REACH,
    top: point.y - half,
    bottom: point.y + half
  };
}

function obstacleKindCost(entry) {
  if (entry.isEndpoint) return DETOUR_ENDPOINT_COST;
  if (entry.kind === "text" || entry.kind === "sleeve") return DETOUR_TEXT_COST;
  return DETOUR_UNRELATED_BODY_COST;
}

function connectorLegalCorridors(conn) {
  const corridors = new Map();
  const add = (id, a, b, node) => {
    if (!id || !a || !b) return;
    const existing = corridors.get(id) || [];
    existing.push(a.x === b.x && a.y === b.y
      ? corridorRectForCollapsedPort(a, node)
      : corridorRectForSegment(a, b));
    corridors.set(id, existing);
  };
  const sourceRaw = rawEndpoint(conn.source);
  const targetRaw = rawEndpoint(conn.target);
  const sourceInfo = resolveComputedEndpointPort(conn.source, targetRaw);
  const targetInfo = resolveComputedEndpointPort(conn.target, sourceRaw);
  const ports = withEndpointPortStubs(conn, sourceInfo, targetInfo);
  add(conn.source?.itemId, ports.sourcePort, ports.routeSource, sourceInfo.node);
  add(conn.target?.itemId, ports.targetPort, ports.routeTarget, targetInfo.node);
  return corridors;
}

function connectorObstacleRects(conn, pad = 10, options = {}) {
  const corridors = connectorLegalCorridors(conn);
  return obstacleRectsForConnector(conn, {
    pad,
    includeEndpointBodies: options.includeEndpointBodies !== false,
    includeText: true,
    includeSleeves: true
  }).map((entry) => ({
    ...entry,
    legalCorridors: corridors.get(entry.ownerId) || [],
    cost: obstacleKindCost(entry)
  }));
}

function visibleLabelObstacleRectsForDetour(conn, pad = 8) {
  return visibleLabelRectsForScoring(conn).map((rect, index) => ({
    id: `connector-label:${index}`,
    ownerId: null,
    kind: "connector-label",
    rect: {
      left: rect.left - pad,
      right: rect.right + pad,
      top: rect.top - pad,
      bottom: rect.bottom + pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2
    },
    isEndpoint: false,
    legalCorridors: [],
    cost: DETOUR_LABEL_COST
  }));
}

function pointAllowedByLegalCorridor(point, entry) {
  if (!entry.isEndpoint) return false;
  return entry.legalCorridors.some((corridor) => pointInsideRect(point, corridor));
}

function segmentAllowedByLegalCorridor(start, end, entry) {
  if (!entry.isEndpoint) return false;
  return entry.legalCorridors.some((corridor) => (
    pointInsideRect(start, corridor) &&
    pointInsideRect(end, corridor)
  ));
}

function segmentObstacleCost(start, end, entry) {
  const intersects = pointInsideRect(start, entry.rect) ||
    pointInsideRect(end, entry.rect) ||
    lineSegmentRectIntersect(start, end, entry.rect);
  if (!intersects) return 0;
  if (
    (pointAllowedByLegalCorridor(start, entry) || !pointInsideRect(start, entry.rect)) &&
    (pointAllowedByLegalCorridor(end, entry) || !pointInsideRect(end, entry.rect)) &&
    segmentAllowedByLegalCorridor(start, end, entry)
  ) {
    return 0;
  }
  return entry.cost;
}

function sampleObstacleCost(point, entry) {
  if (!pointInsideRect(point, entry.rect)) return 0;
  if (pointAllowedByLegalCorridor(point, entry)) return 0;
  return entry.cost;
}

function connectorUnrelatedObstacleScore(conn, source, target, control, route, pad = 10) {
  const samples = connectorSamplePoints(source, target, control, route, 48);
  const obstacles = connectorObstacleRects(conn, pad, { includeEndpointBodies: false });
  let score = 0;

  obstacles.forEach((entry) => {
    for (let index = 0; index < samples.length; index += 1) {
      const point = samples[index];
      score += sampleObstacleCost(point, entry);
      if (index > 0) score += segmentObstacleCost(samples[index - 1], point, entry);
    }
  });

  return score;
}

function connectorObstacleScore(conn, source, target, control, route, pad = 10) {
  const samples = connectorSamplePoints(source, target, control, route, 48);
  const obstacles = connectorObstacleRects(conn, pad);
  let score = 0;
  obstacles.forEach((entry) => {
    for (let index = 0; index < samples.length; index += 1) {
      const point = samples[index];
      score += sampleObstacleCost(point, entry);
      if (index > 0) score += segmentObstacleCost(samples[index - 1], point, entry);
    }
  });
  return score;
}

function connectorLabelObstacleScore(conn, source, target, control, route, pad = 6) {
  const samples = connectorSamplePoints(source, target, control, route, 48);
  const obstacles = visibleLabelObstacleRectsForDetour(conn, pad);
  let score = 0;
  obstacles.forEach((entry) => {
    for (let index = 0; index < samples.length; index += 1) {
      const point = samples[index];
      score += sampleObstacleCost(point, entry);
      if (index > 0) score += segmentObstacleCost(samples[index - 1], point, entry);
    }
  });
  return score;
}

function routeHitsObstacle(conn, source, target, control, route, pad = 10) {
  return connectorObstacleScore(conn, source, target, control, route, pad) +
    connectorLabelObstacleScore(conn, source, target, control, route, Math.max(4, pad - 4)) > 0;
}

function routeHitsUnrelatedObstacle(conn, source, target, control, route, pad = 10) {
  return connectorUnrelatedObstacleScore(conn, source, target, control, route, pad) +
    connectorLabelObstacleScore(conn, source, target, control, route, Math.max(4, pad - 4)) > 0;
}

function segmentHitsObstacle(conn, start, end, pad = 10) {
  return connectorObstacleRects(conn, pad).some((entry) => segmentObstacleCost(start, end, entry) > 0);
}

function polylineObstacleScore(conn, points, pad = 10, obstacles = connectorObstacleRects(conn, pad)) {
  let score = 0;
  for (let index = 1; index < points.length; index += 1) {
    obstacles.forEach((entry) => {
      score += segmentObstacleCost(points[index - 1], points[index], entry);
    });
  }
  return score;
}

function polylineEndpointBodyScore(conn, points, pad = -6, obstacles = connectorObstacleRects(conn, pad)) {
  const endpointBodies = obstacles.filter((entry) => entry.isEndpoint && entry.kind === "body");
  let score = 0;
  endpointBodies.forEach((entry) => {
    for (let index = 1; index < points.length; index += 1) {
      score += segmentObstacleCost(points[index - 1], points[index], entry);
    }
  });
  return score;
}

function polylineLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return length;
}

function currentStoryLanes() {
  return storyLaneCorridors(state.templateLayout);
}

function pointInStoryLane(point, lanes) {
  return lanes.some((lane) => pointInsideRect(point, lane.rect));
}

function segmentLanePreferenceCost(start, end, lanes) {
  if (!lanes.length) return 0;
  const samples = [
    start,
    { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    end
  ];
  return samples.reduce((score, point) => (
    score + (pointInStoryLane(point, lanes) ? 0 : DETOUR_LANE_POINT_COST)
  ), 0);
}

function uniqueSortedValues(values, max) {
  return [...new Set(values
    .map((value) => clamp(Math.round(value), DETOUR_WORLD_MARGIN, max - DETOUR_WORLD_MARGIN))
    .filter((value) => Number.isFinite(value)))]
    .sort((a, b) => a - b);
}

function heapPush(heap, item) {
  heap.push(item);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    const parentItem = heap[parent];
    if (
      parentItem.priority < item.priority ||
      (parentItem.priority === item.priority && parentItem.sequence <= item.sequence)
    ) break;
    heap[index] = parentItem;
    index = parent;
  }
  heap[index] = item;
}

function heapPop(heap) {
  if (!heap.length) return null;
  const result = heap[0];
  const item = heap.pop();
  if (!heap.length || !item) return result;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    if (left >= heap.length) break;
    let child = left;
    if (
      right < heap.length &&
      (
        heap[right].priority < heap[left].priority ||
        (heap[right].priority === heap[left].priority && heap[right].sequence < heap[left].sequence)
      )
    ) {
      child = right;
    }
    if (
      item.priority < heap[child].priority ||
      (item.priority === heap[child].priority && item.sequence <= heap[child].sequence)
    ) break;
    heap[index] = heap[child];
    index = child;
  }
  heap[index] = item;
  return result;
}

function routePointKey(ix, iy, direction) {
  return `${ix}:${iy}:${direction}`;
}

function routeHeuristic(point, target) {
  return Math.abs(point.x - target.x) + Math.abs(point.y - target.y);
}

function simplifyPolylinePoints(points) {
  const deduped = [];
  points.forEach((point) => {
    const previous = deduped[deduped.length - 1];
    if (!previous || previous.x !== point.x || previous.y !== point.y) deduped.push(point);
  });
  const simplified = [];
  deduped.forEach((point) => {
    simplified.push(point);
    while (simplified.length >= 3) {
      const a = simplified[simplified.length - 3];
      const b = simplified[simplified.length - 2];
      const c = simplified[simplified.length - 1];
      if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) {
        simplified.splice(simplified.length - 2, 1);
      } else {
        break;
      }
    }
  });
  return simplified;
}

function reconstructGridRoute(entry, previous, xValues, yValues, source, target) {
  const points = [];
  let cursor = entry.key;
  while (cursor) {
    const [ix, iy] = cursor.split(":").map((value) => Number(value));
    points.push({ x: xValues[ix], y: yValues[iy] });
    cursor = previous.get(cursor);
  }
  points.reverse();
  if (points.length) {
    points[0] = source;
    points[points.length - 1] = target;
  }
  return simplifyPolylinePoints(points);
}

function segmentGridCost(start, end, obstacles, lanes = []) {
  let cost = Math.hypot(end.x - start.x, end.y - start.y);
  for (const entry of obstacles) {
    const obstacleCost = segmentObstacleCost(start, end, entry);
    if (!Number.isFinite(obstacleCost)) return Number.POSITIVE_INFINITY;
    cost += obstacleCost;
  }
  return cost + segmentLanePreferenceCost(start, end, lanes);
}

function gridValuesForRoute(source, target, preferredControl, obstacles, lanes = []) {
  const xValues = [source.x, target.x, preferredControl.x, DETOUR_WORLD_MARGIN, WORLD.width - DETOUR_WORLD_MARGIN];
  const yValues = [source.y, target.y, preferredControl.y, DETOUR_WORLD_MARGIN, WORLD.height - DETOUR_WORLD_MARGIN];
  obstacles.forEach(({ rect }) => {
    xValues.push(rect.left - DETOUR_MARGIN, rect.right + DETOUR_MARGIN);
    yValues.push(rect.top - DETOUR_MARGIN, rect.bottom + DETOUR_MARGIN);
  });
  lanes.forEach(({ rect }) => {
    xValues.push(rect.left, rect.right);
    yValues.push(rect.top, rect.bottom);
  });
  return {
    xValues: uniqueSortedValues(xValues, WORLD.width),
    yValues: uniqueSortedValues(yValues, WORLD.height)
  };
}

function nearestGridIndex(values, coordinate) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  values.forEach((value, index) => {
    const distance = Math.abs(value - coordinate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function orthogonalGridDetour(source, target, preferredControl, obstacles) {
  const lanes = currentStoryLanes();
  const { xValues, yValues } = gridValuesForRoute(source, target, preferredControl, obstacles, lanes);
  const start = {
    ix: nearestGridIndex(xValues, source.x),
    iy: nearestGridIndex(yValues, source.y)
  };
  const goal = {
    ix: nearestGridIndex(xValues, target.x),
    iy: nearestGridIndex(yValues, target.y)
  };
  xValues[start.ix] = source.x;
  yValues[start.iy] = source.y;
  xValues[goal.ix] = target.x;
  yValues[goal.iy] = target.y;

  const directions = [
    { dx: 1, dy: 0, id: 0 },
    { dx: 0, dy: 1, id: 1 },
    { dx: -1, dy: 0, id: 2 },
    { dx: 0, dy: -1, id: 3 }
  ];
  const startDirection = 4;
  const heap = [];
  const distances = new Map();
  const previous = new Map();
  let sequence = 0;
  const startKey = routePointKey(start.ix, start.iy, startDirection);
  distances.set(startKey, 0);
  heapPush(heap, {
    key: startKey,
    ix: start.ix,
    iy: start.iy,
    direction: startDirection,
    cost: 0,
    priority: routeHeuristic(source, target),
    sequence: sequence++
  });

  while (heap.length) {
    const current = heapPop(heap);
    if (!current) break;
    if (current.cost !== distances.get(current.key)) continue;
    if (current.ix === goal.ix && current.iy === goal.iy) {
      return reconstructGridRoute(current, previous, xValues, yValues, source, target);
    }

    const from = { x: xValues[current.ix], y: yValues[current.iy] };
    for (const direction of directions) {
      const ix = current.ix + direction.dx;
      const iy = current.iy + direction.dy;
      if (ix < 0 || iy < 0 || ix >= xValues.length || iy >= yValues.length) continue;
      const to = { x: xValues[ix], y: yValues[iy] };
      const segmentCost = segmentGridCost(from, to, obstacles, lanes);
      if (!Number.isFinite(segmentCost)) continue;
      const turnCost = current.direction === startDirection || current.direction === direction.id ? 0 : DETOUR_TURN_COST;
      const nextCost = current.cost + segmentCost + turnCost;
      const nextKey = routePointKey(ix, iy, direction.id);
      const previousCost = distances.get(nextKey);
      if (previousCost !== undefined && previousCost <= nextCost) continue;
      distances.set(nextKey, nextCost);
      previous.set(nextKey, current.key);
      heapPush(heap, {
        key: nextKey,
        ix,
        iy,
        direction: direction.id,
        cost: nextCost,
        priority: nextCost + routeHeuristic(to, target),
        sequence: sequence++
      });
    }
  }
  return null;
}

function routeControlDistance(points, preferredControl) {
  const control = points[Math.floor(points.length / 2)] || points[0] || preferredControl;
  return Math.hypot(control.x - preferredControl.x, control.y - preferredControl.y);
}

function roundedPolylinePath(points, radius = 38) {
  if (points.length < 2) return "";
  const d = [`M${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const incoming = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.max(0, Math.min(radius, incoming * 0.42, outgoing * 0.42));
    if (r < 1) {
      d.push(`L${corner.x} ${corner.y}`);
      continue;
    }
    const before = {
      x: corner.x - ((corner.x - prev.x) / incoming) * r,
      y: corner.y - ((corner.y - prev.y) / incoming) * r
    };
    const after = {
      x: corner.x + ((next.x - corner.x) / outgoing) * r,
      y: corner.y + ((next.y - corner.y) / outgoing) * r
    };
    d.push(`L${before.x} ${before.y}`);
    d.push(`Q${corner.x} ${corner.y} ${after.x} ${after.y}`);
  }
  const last = points[points.length - 1];
  d.push(`L${last.x} ${last.y}`);
  return d.join(" ");
}

function obstacleDetourRoute(conn, source, target, preferredControl) {
  const obstacles = [
    ...connectorObstacleRects(conn, 14),
    ...visibleLabelObstacleRectsForDetour(conn, 8)
  ];
  const scoringObstacles = [
    ...connectorObstacleRects(conn, 10),
    ...visibleLabelObstacleRectsForDetour(conn, 6)
  ];
  const gridPoints = orthogonalGridDetour(source, target, preferredControl, obstacles);
  if (gridPoints) {
    const laneScore = lanePreferenceScore(gridPoints);
    return {
      points: gridPoints,
      index: 0,
      obstacle: polylineObstacleScore(conn, gridPoints, 10, scoringObstacles),
      length: polylineLength(gridPoints) + laneScore,
      controlDistance: routeControlDistance(gridPoints, preferredControl)
    };
  }

  const candidates = [];
  const yValues = new Set([source.y, target.y, preferredControl.y]);
  const xValues = new Set([source.x, target.x, preferredControl.x]);
  obstacles.forEach(({ rect }) => {
    yValues.add(rect.top - DETOUR_MARGIN);
    yValues.add(rect.bottom + DETOUR_MARGIN);
    xValues.add(rect.left - DETOUR_MARGIN);
    xValues.add(rect.right + DETOUR_MARGIN);
  });
  yValues.forEach((rawY) => {
    const y = clamp(Math.round(rawY), DETOUR_WORLD_MARGIN, WORLD.height - DETOUR_WORLD_MARGIN);
    candidates.push([source, { x: source.x, y }, { x: target.x, y }, target]);
  });
  xValues.forEach((rawX) => {
    const x = clamp(Math.round(rawX), DETOUR_WORLD_MARGIN, WORLD.width - DETOUR_WORLD_MARGIN);
    candidates.push([source, { x, y: source.y }, { x, y: target.y }, target]);
  });

  return candidates
    .map((points, index) => ({
      points,
      index,
      obstacle: polylineObstacleScore(conn, points, 10, scoringObstacles) +
        polylineEndpointBodyScore(conn, points, -6, connectorObstacleRects(conn, -6)),
      length: polylineLength(points) + lanePreferenceScore(points),
      controlDistance: Math.hypot(points[Math.floor(points.length / 2)].x - preferredControl.x, points[Math.floor(points.length / 2)].y - preferredControl.y)
    }))
    .sort((a, b) => a.obstacle - b.obstacle || a.length - b.length || a.controlDistance - b.controlDistance || a.index - b.index)[0];
}

function adaptiveBendCandidates(source, target, conn) {
  const endpointIds = connectorEndpointNodeIds(conn);
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.hypot(dx, dy) || 1;
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const margin = 24;
  const bends = new Set();

  getAnchorableNodes().forEach((node) => {
    if (endpointIds.has(node.id)) return;
    const rect = nodeWorldRect(node, 14);
    if (!lineSegmentRectIntersect(source, target, rect)) return;
    const corners = [
      { x: rect.left, y: rect.top },
      { x: rect.right, y: rect.top },
      { x: rect.left, y: rect.bottom },
      { x: rect.right, y: rect.bottom }
    ];
    let maxProj = -Infinity;
    let minProj = Infinity;
    corners.forEach((corner) => {
      const proj = (corner.x - source.x) * perpX + (corner.y - source.y) * perpY;
      if (proj > maxProj) maxProj = proj;
      if (proj < minProj) minProj = proj;
    });
    bends.add(Math.round(2 * (maxProj + margin)));
    bends.add(Math.round(2 * (minProj - margin)));
  });

  return [...bends];
}

function connectorEndpointNodeIds(conn) {
  const cacheKey = connectorCacheKey(conn);
  if (connectorScoringCache?.endpointIdSets.has(cacheKey)) {
    return connectorScoringCache.endpointIdSets.get(cacheKey);
  }
  const ids = new Set([conn.source?.itemId, conn.target?.itemId].filter(Boolean));
  connectorScoringCache?.endpointIdSets.set(cacheKey, ids);
  return ids;
}

function autoLabelForRoute(route, source, target, control) {
  const mid = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  if (route === "straight") return offsetPoint(mid, source, target, 24);
  if (route === "elbow") return { x: control.x, y: control.y - 22 };
  return offsetPoint(control, source, target, 18);
}

function labelPointForCandidate(conn, source, target, control, route) {
  const autoLabel = autoLabelForRoute(route, source, target, control);
  const mode = conn.labelMode || "auto";
  if (mode === "hidden") return null;
  if (mode === "auto" || (mode === "manual" && conn.labelPoint)) {
    return labelPointForMode(conn, source, target, control, autoLabel);
  }
  return labelPointForMode(conn, source, target, control, autoLabel);
}

function baselineSamplesFor(conn) {
  const cacheKey = connectorCacheKey(conn);
  if (connectorScoringCache?.baselineSamples.has(cacheKey)) {
    return connectorScoringCache.baselineSamples.get(cacheKey);
  }
  const sourceRaw = rawEndpoint(conn.source);
  const targetRaw = rawEndpoint(conn.target);
  const sourceInfo = resolveComputedEndpointPort(conn.source, targetRaw);
  const targetInfo = resolveComputedEndpointPort(conn.target, sourceRaw);
  const ports = withEndpointPortStubs(conn, sourceInfo, targetInfo);
  const route = conn.routeStyle || "smartArc";
  const control = conn.mid || fallbackControlPoint(ports.routeSource, ports.routeTarget, route);
  const samples = connectorSamplePoints(ports.routeSource, ports.routeTarget, control, route);
  if (connectorScoringCache) {
    connectorScoringCache.baselineSamples.set(cacheKey, samples);
    connectorScoringCache.sampleBounds.set(cacheKey, boundsForSamples(samples));
  }
  return samples;
}

function scoreControlCandidate(conn, source, target, control, route) {
  const samples = connectorSamplePoints(source, target, control, route);
  const sampleBounds = boundsForSamples(samples);
  const endpointIds = connectorEndpointNodeIds(conn);
  const connPairKey = connectorPairKey(conn);
  let score = connectorObstacleScore(conn, source, target, control, route);

  getAnchorableNodes().forEach((node) => {
    if (endpointIds.has(node.id)) return;
    const rect = nodeWorldRect(node, 8);
    samples.forEach((point) => {
      if (pointInsideRect(point, rect)) score += 1200;
    });
  });

  const label = labelPointForCandidate(conn, source, target, control, route);
  if (label) score += labelObstacleScore(conn, label) * 1.2;
  visibleLabelRectsForScoring(conn).forEach((rect) => {
    for (let index = 0; index < samples.length; index += 1) {
      if (pointInsideRect(samples[index], rect)) score += 5000;
      if (index > 0 && lineSegmentRectIntersect(samples[index - 1], samples[index], rect)) score += 5000;
    }
  });

  state.connectors.forEach((other) => {
    if (other.id === conn.id) return;
    if (connectorPairKey(other) === connPairKey) return;
    const otherSamples = baselineSamplesFor(other);
    const otherBounds = connectorScoringCache?.sampleBounds.get(connectorCacheKey(other)) ?? boundsForSamples(otherSamples);
    if (!expandedBoundsOverlap(sampleBounds, otherBounds, 16)) return;
    const otherEndpointIds = connectorEndpointNodeIds(other);
    const sharesEndpoint = [...endpointIds].some((id) => otherEndpointIds.has(id));
    let closeCount = 0;
    let minDistance = Infinity;

    samples.forEach((point) => {
      otherSamples.forEach((otherPoint) => {
        if (sharesEndpoint && (point.t < 0.12 || point.t > 0.88) && (otherPoint.t < 0.12 || otherPoint.t > 0.88)) return;
        const distance = Math.hypot(point.x - otherPoint.x, point.y - otherPoint.y);
        if (distance < minDistance) minDistance = distance;
        if (distance < 16) closeCount += 1;
      });
    });

    if (closeCount > 2) score += 180 + closeCount * 18 + Math.max(0, 16 - minDistance) * 20;
    else score += closeCount * 12;
  });

  return score;
}

function elbowControlCandidates(source, target, conn) {
  const mid = fallbackControlPoint(source, target, "elbow");
  const margin = 34;
  const xValues = new Set([
    Math.round(mid.x),
    Math.round(source.x),
    Math.round(target.x)
  ]);

  connectorObstacleRects(conn, 14).forEach(({ rect }) => {
    if (
      lineSegmentRectIntersect(source, target, rect) ||
      (Math.min(source.x, target.x) <= rect.right && Math.max(source.x, target.x) >= rect.left)
    ) {
      xValues.add(Math.round(rect.left - margin));
      xValues.add(Math.round(rect.right + margin));
    }
  });

  visibleLabelRectsForScoring(conn).forEach((rect) => {
    if (Math.min(source.x, target.x) <= rect.right && Math.max(source.x, target.x) >= rect.left) {
      xValues.add(Math.round(rect.left - 4));
      xValues.add(Math.round(rect.right + 4));
      xValues.add(Math.round(rect.left - 10));
      xValues.add(Math.round(rect.right + 10));
      xValues.add(Math.round(rect.left - margin));
      xValues.add(Math.round(rect.right + margin));
    }
  });

  return [...xValues].map((x) => ({
    x: clamp(x, 24, WORLD.width - 24),
    y: mid.y
  }));
}

function curvedControlCandidates(source, target, conn, route) {
  const bend = baseBendAmount(source, target, route);
  const bendAmounts = [
    ...bendMultipliersFor(conn).map((multiplier) => bend * multiplier),
    ...adaptiveBendCandidates(source, target, conn)
  ];
  const candidates = bendAmounts.map((bendAmount) => fallbackControlPoint(source, target, route, bendAmount));
  if (conn.mid) candidates.unshift(conn.mid);
  candidates.push(fallbackControlPoint(source, target, route));
  return candidates;
}

function controlCandidatesForRoute(source, target, conn, route) {
  if (route === "elbow") {
    const candidates = elbowControlCandidates(source, target, conn);
    if (conn.mid) candidates.unshift(conn.mid);
    return candidates;
  }
  if (route === "straight") return [fallbackControlPoint(source, target, route)];
  return curvedControlCandidates(source, target, conn, route);
}

function bestScoredControlEntry(source, target, conn, route) {
  const seen = new Set();
  return controlCandidatesForRoute(source, target, conn, route)
    .filter((control) => {
      const key = `${Math.round(control.x)}:${Math.round(control.y)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((control, index) => ({
      control,
      index,
      score: scoreControlCandidate(conn, source, target, control, route)
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index)[0] || {
      control: fallbackControlPoint(source, target, route),
      index: 0,
      score: 0
    };
}

function bestScoredControl(source, target, conn, route) {
  return bestScoredControlEntry(source, target, conn, route).control;
}

export function defaultControlPoint(source, target, conn) {
  const route = conn.routeStyle || "smartArc";
  if (route === "straight") return fallbackControlPoint(source, target, route);

  return bestScoredControl(source, target, conn, route);
}

function effectiveRouteForConnector(conn, source, target, requestedRoute) {
  if (requestedRoute !== "straight") return requestedRoute;
  const mid = fallbackControlPoint(source, target, requestedRoute);
  return routeHitsObstacle(conn, source, target, mid, requestedRoute, 10) ? "smartArc" : requestedRoute;
}

function connectorControlPoint(conn, source, target, route) {
  const preferred = conn.mid || fallbackControlPoint(source, target, route);
  const preferredScore = scoreControlCandidate(conn, source, target, preferred, route);
  const best = bestScoredControlEntry(source, target, conn, route);
  if (!conn.mid) return best.control;
  if (route === "freeform") return routeHitsUnrelatedObstacle(conn, source, target, preferred, route, 10) ? best.control : preferred;
  if (routeHitsObstacle(conn, source, target, preferred, route, 10) || best.score < preferredScore - 120) return best.control;
  return preferred;
}

export function labelPointForMode(conn, source, target, control, autoLabel) {
  const mode = conn.labelMode || "auto";
  const mid = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  if (mode === "hidden") return { ...autoLabel, hidden: true };
  if (mode === "manual" && conn.labelPoint && labelObstacleScore(conn, conn.labelPoint) === 0) {
    return clampLabelPoint(conn.labelPoint, conn);
  }
  if (mode === "above") return offsetPoint(mid, source, target, 34);
  if (mode === "below") return offsetPoint(mid, source, target, -34);
  if (mode === "start") return {
    x: source.x * 0.72 + target.x * 0.28,
    y: source.y * 0.72 + target.y * 0.28
  };
  if (mode === "end") return {
    x: source.x * 0.28 + target.x * 0.72,
    y: source.y * 0.28 + target.y * 0.72
  };
  return autoLabelPoint(conn, source, target, control, autoLabel);
}

function previewLabelPointForMode(conn, source, target, control, autoLabel) {
  const mode = conn.labelMode || "auto";
  const mid = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  if (mode === "hidden") return { ...autoLabel, hidden: true };
  if (mode === "manual" && conn.labelPoint) return clampLabelPoint(conn.labelPoint, conn);
  if (mode === "above") return offsetPoint(mid, source, target, 34);
  if (mode === "below") return offsetPoint(mid, source, target, -34);
  if (mode === "start") return {
    x: source.x * 0.72 + target.x * 0.28,
    y: source.y * 0.72 + target.y * 0.28
  };
  if (mode === "end") return {
    x: source.x * 0.28 + target.x * 0.72,
    y: source.y * 0.28 + target.y * 0.72
  };
  return autoLabel;
}

export function computeConnectorPreviewPath(conn) {
  const sourceRaw = rawEndpoint(conn.source);
  const targetRaw = rawEndpoint(conn.target);
  const sourceInfo = resolveComputedEndpointPort(conn.source, targetRaw);
  const targetInfo = resolveComputedEndpointPort(conn.target, sourceRaw);
  const ports = withEndpointPortStubs(conn, sourceInfo, targetInfo);
  const sourcePort = ports.source;
  const targetPort = ports.target;
  const requestedRoute = conn.routeStyle || "smartArc";
  const route = effectiveRouteForConnector(conn, ports.routeSource, ports.routeTarget, requestedRoute);
  const control = conn.mid || fallbackControlPoint(ports.routeSource, ports.routeTarget, route);
  const selected = state.selection?.kind === "connector" && state.selection.id === conn.id;

  if (route === "straight") {
    const mid = { x: (ports.routeSource.x + ports.routeTarget.x) / 2, y: (ports.routeSource.y + ports.routeTarget.y) / 2 };
    const autoLabel = offsetPoint(mid, ports.routeSource, ports.routeTarget, 24);
    return {
      d: `M${sourcePort.x} ${sourcePort.y} L${ports.routeSource.x} ${ports.routeSource.y} L${ports.routeTarget.x} ${ports.routeTarget.y} L${targetPort.x} ${targetPort.y}`,
      source: sourcePort,
      target: targetPort,
      control: mid,
      waypoints: [sourcePort, ports.routeSource, ports.routeTarget, targetPort],
      sourcePort: ports.sourcePort,
      targetPort: ports.targetPort,
      routeSource: ports.routeSource,
      routeTarget: ports.routeTarget,
      sourcePortId: ports.sourcePortId,
      targetPortId: ports.targetPortId,
      label: previewLabelPointForMode(conn, ports.routeSource, ports.routeTarget, mid, autoLabel),
      selected
    };
  }

  if (route === "elbow") {
    const elbow = roundedElbowPoints(ports.routeSource, ports.routeTarget, control);
    const d = [
      `M${sourcePort.x} ${sourcePort.y}`,
      `L${ports.routeSource.x} ${ports.routeSource.y}`,
      `L${elbow.beforeFirst.x} ${elbow.beforeFirst.y}`,
      `Q${elbow.firstCorner.x} ${elbow.firstCorner.y} ${elbow.afterFirst.x} ${elbow.afterFirst.y}`,
      `L${elbow.beforeSecond.x} ${elbow.beforeSecond.y}`,
      `Q${elbow.secondCorner.x} ${elbow.secondCorner.y} ${elbow.afterSecond.x} ${elbow.afterSecond.y}`,
      `L${ports.routeTarget.x} ${ports.routeTarget.y}`,
      `L${targetPort.x} ${targetPort.y}`
    ].join(" ");
    const autoLabel = { x: control.x, y: control.y - 22 };
    return {
      d,
      source: sourcePort,
      target: targetPort,
      control,
      waypoints: [sourcePort, ports.routeSource, ports.routeTarget, targetPort],
      sourcePort: ports.sourcePort,
      targetPort: ports.targetPort,
      routeSource: ports.routeSource,
      routeTarget: ports.routeTarget,
      sourcePortId: ports.sourcePortId,
      targetPortId: ports.targetPortId,
      label: previewLabelPointForMode(conn, ports.routeSource, ports.routeTarget, control, autoLabel),
      selected
    };
  }

  if (route === "sCurve") {
    const c1 = { x: ports.routeSource.x * 0.72 + control.x * 0.28, y: ports.routeSource.y * 0.72 + control.y * 0.28 };
    const c2 = { x: ports.routeTarget.x * 0.72 + control.x * 0.28, y: ports.routeTarget.y * 0.72 + control.y * 0.28 };
    const autoLabel = offsetPoint(control, ports.routeSource, ports.routeTarget, 18);
    return {
      d: `M${sourcePort.x} ${sourcePort.y} L${ports.routeSource.x} ${ports.routeSource.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${ports.routeTarget.x} ${ports.routeTarget.y} L${targetPort.x} ${targetPort.y}`,
      source: sourcePort,
      target: targetPort,
      control,
      waypoints: [sourcePort, ports.routeSource, ports.routeTarget, targetPort],
      sourcePort: ports.sourcePort,
      targetPort: ports.targetPort,
      routeSource: ports.routeSource,
      routeTarget: ports.routeTarget,
      sourcePortId: ports.sourcePortId,
      targetPortId: ports.targetPortId,
      label: previewLabelPointForMode(conn, ports.routeSource, ports.routeTarget, control, autoLabel),
      selected
    };
  }

  const autoLabel = offsetPoint(control, ports.routeSource, ports.routeTarget, 18);
  return {
    d: `M${sourcePort.x} ${sourcePort.y} L${ports.routeSource.x} ${ports.routeSource.y} Q${control.x} ${control.y} ${ports.routeTarget.x} ${ports.routeTarget.y} L${targetPort.x} ${targetPort.y}`,
    source: sourcePort,
    target: targetPort,
    control,
    waypoints: [sourcePort, ports.routeSource, ports.routeTarget, targetPort],
    sourcePort: ports.sourcePort,
    targetPort: ports.targetPort,
    routeSource: ports.routeSource,
    routeTarget: ports.routeTarget,
    sourcePortId: ports.sourcePortId,
    targetPortId: ports.targetPortId,
    label: previewLabelPointForMode(conn, ports.routeSource, ports.routeTarget, control, autoLabel),
    selected
  };
}

export function computeConnectorPath(conn) {
  const sourceRaw = rawEndpoint(conn.source);
  const targetRaw = rawEndpoint(conn.target);
  const sourceInfo = resolveComputedEndpointPort(conn.source, targetRaw);
  const targetInfo = resolveComputedEndpointPort(conn.target, sourceRaw);
  const ports = withEndpointPortStubs(conn, sourceInfo, targetInfo);
  const sourcePort = ports.source;
  const targetPort = ports.target;
  const requestedRoute = conn.routeStyle || "smartArc";
  const route = effectiveRouteForConnector(conn, ports.routeSource, ports.routeTarget, requestedRoute);
  const control = connectorControlPoint(conn, ports.routeSource, ports.routeTarget, route);
  const selected = state.selection?.kind === "connector" && state.selection.id === conn.id;
  const detour = routeHitsObstacle(conn, ports.routeSource, ports.routeTarget, control, route, 10)
    ? obstacleDetourRoute(conn, ports.routeSource, ports.routeTarget, control)
    : null;

  if (detour) {
    const detourControl = detour.points[Math.floor(detour.points.length / 2)] || control;
    const fullPoints = [sourcePort, ...detour.points, targetPort];
    const autoLabel = offsetPoint(detourControl, ports.routeSource, ports.routeTarget, 18);
    return {
      d: roundedPolylinePath(fullPoints),
      source: sourcePort,
      target: targetPort,
      control: detourControl,
      waypoints: fullPoints,
      sourcePort: ports.sourcePort,
      targetPort: ports.targetPort,
      routeSource: ports.routeSource,
      routeTarget: ports.routeTarget,
      sourcePortId: ports.sourcePortId,
      targetPortId: ports.targetPortId,
      label: labelPointForMode(conn, ports.routeSource, ports.routeTarget, detourControl, autoLabel),
      selected
    };
  }

  if (route === "straight") {
    const mid = { x: (ports.routeSource.x + ports.routeTarget.x) / 2, y: (ports.routeSource.y + ports.routeTarget.y) / 2 };
    const autoLabel = offsetPoint(mid, ports.routeSource, ports.routeTarget, 24);
    return {
      d: `M${sourcePort.x} ${sourcePort.y} L${ports.routeSource.x} ${ports.routeSource.y} L${ports.routeTarget.x} ${ports.routeTarget.y} L${targetPort.x} ${targetPort.y}`,
      source: sourcePort,
      target: targetPort,
      control: mid,
      waypoints: [sourcePort, ports.routeSource, ports.routeTarget, targetPort],
      sourcePort: ports.sourcePort,
      targetPort: ports.targetPort,
      routeSource: ports.routeSource,
      routeTarget: ports.routeTarget,
      sourcePortId: ports.sourcePortId,
      targetPortId: ports.targetPortId,
      label: labelPointForMode(conn, ports.routeSource, ports.routeTarget, mid, autoLabel),
      selected
    };
  }

  if (route === "elbow") {
    const elbow = roundedElbowPoints(ports.routeSource, ports.routeTarget, control);
    const d = [
      `M${sourcePort.x} ${sourcePort.y}`,
      `L${ports.routeSource.x} ${ports.routeSource.y}`,
      `L${elbow.beforeFirst.x} ${elbow.beforeFirst.y}`,
      `Q${elbow.firstCorner.x} ${elbow.firstCorner.y} ${elbow.afterFirst.x} ${elbow.afterFirst.y}`,
      `L${elbow.beforeSecond.x} ${elbow.beforeSecond.y}`,
      `Q${elbow.secondCorner.x} ${elbow.secondCorner.y} ${elbow.afterSecond.x} ${elbow.afterSecond.y}`,
      `L${ports.routeTarget.x} ${ports.routeTarget.y}`,
      `L${targetPort.x} ${targetPort.y}`
    ].join(" ");
    const autoLabel = { x: control.x, y: control.y - 22 };
    return {
      d,
      source: sourcePort,
      target: targetPort,
      control,
      waypoints: [sourcePort, ports.routeSource, ports.routeTarget, targetPort],
      sourcePort: ports.sourcePort,
      targetPort: ports.targetPort,
      routeSource: ports.routeSource,
      routeTarget: ports.routeTarget,
      sourcePortId: ports.sourcePortId,
      targetPortId: ports.targetPortId,
      label: labelPointForMode(conn, ports.routeSource, ports.routeTarget, control, autoLabel),
      selected
    };
  }

  if (route === "sCurve") {
    const c1 = { x: ports.routeSource.x * 0.72 + control.x * 0.28, y: ports.routeSource.y * 0.72 + control.y * 0.28 };
    const c2 = { x: ports.routeTarget.x * 0.72 + control.x * 0.28, y: ports.routeTarget.y * 0.72 + control.y * 0.28 };
    const autoLabel = offsetPoint(control, ports.routeSource, ports.routeTarget, 18);
    return {
      d: `M${sourcePort.x} ${sourcePort.y} L${ports.routeSource.x} ${ports.routeSource.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${ports.routeTarget.x} ${ports.routeTarget.y} L${targetPort.x} ${targetPort.y}`,
      source: sourcePort,
      target: targetPort,
      control,
      waypoints: [sourcePort, ports.routeSource, ports.routeTarget, targetPort],
      sourcePort: ports.sourcePort,
      targetPort: ports.targetPort,
      routeSource: ports.routeSource,
      routeTarget: ports.routeTarget,
      sourcePortId: ports.sourcePortId,
      targetPortId: ports.targetPortId,
      label: labelPointForMode(conn, ports.routeSource, ports.routeTarget, control, autoLabel),
      selected
    };
  }

  const autoLabel = offsetPoint(control, ports.routeSource, ports.routeTarget, 18);
  return {
    d: `M${sourcePort.x} ${sourcePort.y} L${ports.routeSource.x} ${ports.routeSource.y} Q${control.x} ${control.y} ${ports.routeTarget.x} ${ports.routeTarget.y} L${targetPort.x} ${targetPort.y}`,
    source: sourcePort,
    target: targetPort,
    control,
    waypoints: [sourcePort, ports.routeSource, ports.routeTarget, targetPort],
    sourcePort: ports.sourcePort,
    targetPort: ports.targetPort,
    routeSource: ports.routeSource,
    routeTarget: ports.routeTarget,
    sourcePortId: ports.sourcePortId,
    targetPortId: ports.targetPortId,
    label: labelPointForMode(conn, ports.routeSource, ports.routeTarget, control, autoLabel),
    selected
  };
}

export function markerUrl(style) {
  if (style === "arrow") return "url(#arrowHead)";
  if (style === "chevron") return "url(#chevronHead)";
  if (style === "dot") return "url(#dotHead)";
  if (style === "circle") return "url(#circleHead)";
  if (style === "diamond") return "url(#diamondHead)";
  return "";
}

export function getCanvasState(item, financeData, cashflow) {
  if (item.stateOverride === "tradeoff") return "tradeoff";

  if (item.visual !== "paycheck") return "neutral";

  const need = cashflow?.need ?? financeData?.[item.id]?.need ?? item.need ?? 0;
  const mapped = cashflow?.mapped ?? financeData?.[item.id]?.mapped ?? item.mapped ?? 0;
  const delta = mapped - need;

  if (delta < -25) return "gap";
  if (delta > 25) return "surplus";
  return "neutral";
}
