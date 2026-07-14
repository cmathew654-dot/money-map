// === CONSTANTS / STATE ===
export const WORLD = { width: 4800, height: 3000 };
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.85;

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 0
});

// Compact currency that keeps up to 2 fraction digits so a header total does not
// round a $1,592K sum up to a misleading "$2M". Used for the account inventory so
// the header total and its category subtotals/rows stay mutually consistent.
export const inventoryCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2
});

export function inventoryDollars(value) {
  return inventoryCurrency.format(Math.round(Number(value) || 0));
}

export const flowTypes = {
  rollover: "Rollover",
  transfer: "Transfer",
  income: "Income distribution",
  annuity: "Annuity premium",
  roth: "Roth conversion",
  tax: "Tax payment",
  rmd: "RMD",
  qcd: "QCD / charitable gift",
  fee: "Fee",
  rebalance: "Rebalance",
  beneficiary: "Beneficiary transfer"
};

export const routeStyles = {
  smartArc: "Smart arc",
  straight: "Straight",
  elbow: "Elbow",
  sCurve: "S-curve",
  freeform: "Freeform bend"
};

export const strokeStyles = {
  solid: "Solid",
  fineDash: "Fine dash",
  longDash: "Long dash",
  dotted: "Dotted",
  proposalFade: "Proposal fade"
};

export const arrowStyles = {
  none: "None",
  arrow: "Arrow",
  chevron: "Chevron",
  dot: "Dot",
  circle: "Circle",
  diamond: "Diamond"
};

export const labelModes = {
  auto: "Auto",
  above: "Above",
  below: "Below",
  start: "Start",
  end: "End",
  manual: "Manual",
  hidden: "Hidden"
};

export const widthModes = {
  amount: "Amount scaled",
  subtle: "Subtle",
  medium: "Medium",
  bold: "Bold",
  custom: "Custom"
};

export const colorModes = {
  flow: "By flow",
  accent: "Accent",
  teal: "Teal",
  metal: "Muted gold",
  graphite: "Graphite",
  red: "Red"
};

export const primitiveShapes = {
  triangle: "Risk wedge",
  shield: "Protection shield",
  seal: "Guarantee seal",
  flag: "Milestone flag",
  ledgerStrip: "Ledger strip",
  reserveGauge: "Reserve gauge",
  gate: "Trust gate",
  fork: "Split fork",
  rectangle: "Rectangle",
  rounded: "Rounded card",
  pill: "Pill card",
  ellipse: "Circle / ellipse",
  diamond: "Diamond",
  parallelogram: "Parallelogram",
  document: "Document / note",
  bucket: "Cylinder / bucket",
  cylinder: "Tall cylinder",
  cashStack: "Cash stack",
  policy: "Policy tile",
  household: "Household marker",
  callout: "Callout",
  note: "Note",
  milestone: "Milestone",
  table: "Table / grid",
  swimlane: "Swimlane",
  taxTag: "Tax / fee tag",
  bracket: "Bracket / group",
  trust: "Trust / estate"
};

export const financeVisuals = {
  card: "Account card",
  paycheck: "Monthly need",
  bucket: "Liquid bucket",
  cylinder: "Tall cylinder",
  cashStack: "Cash stack",
  policy: "Policy tile",
  household: "Household marker",
  trust: "Trust container",
  amountTag: "Amount tag",
  taxTag: "Tax / fee tag"
};

export const accountCategories = {
  "401k": "401(k)",
  ira: "IRA",
  rothIra: "Roth IRA",
  brokerage: "Brokerage",
  cash: "Cash",
  annuity: "Annuity",
  insurance: "Insurance",
  trust: "Trust",
  hsa: "HSA",
  estate: "Estate",
  household: "Household"
};

export const defaultVisualByCategory = {
  "401k": "card",
  ira: "card",
  rothIra: "card",
  brokerage: "card",
  hsa: "card",
  cash: "bucket",
  annuity: "policy",
  insurance: "policy",
  trust: "trust",
  estate: "trust",
  household: "household"
};

export const textStyles = {
  title: "Title",
  caption: "Caption",
  assumption: "Assumption",
  disclosure: "Disclosure",
  amountTag: "Amount tag",
  callout: "Callout"
};

export const defaultScenario = {
  monthlyNeed: 7500,
  monthlyDistribution: 4000,
  guaranteedIncome: 0,
  flexibleIncome: 0,
  rothConversion: 125000,
  annuityPremium: 250000,
  annuityMonthlyIncome: 1800,
  annuityOn: true,
  taxReservePct: 24
};

export const TEST_MODE = new URLSearchParams(window.location.search).get("test") === "1";
export const HISTORY_LIMIT = 100;

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function defaultMeetingState() {
  return {
    activeTab: "actions",
    actionStatuses: {},
    decisionStatuses: {},
    focus: null
  };
}

export function defaultMotionState() {
  return {
    enabled: true,
    disabledConnectorIds: []
  };
}

export const state = {
  items: [],
  groups: [],
  financeData: {},
  connectors: [],
  templateLayout: { lanes: [] },
  selection: null,
  multiSelection: [],
  activeDock: "select",
  activeAddTab: "finance",
  activeCreationPreset: null,
  themeId: "stewardship",
  activeTemplateId: null,
  startScreenOpen: true,
  viewMode: "proposed",
  scenario: clone(defaultScenario),
  currentValues: {},
  previousValues: {},
  meeting: defaultMeetingState(),
  motion: defaultMotionState(),
  hotItemIds: new Set(),
  hotConnectorIds: new Set(),
  hoverItemId: null,
  layoutFeedback: null,
  interaction: null,
  editingItemId: null,
  editingField: null,
  editingTarget: null,
  suppressDirectEditClickUntil: 0,
  pendingEditFocus: false,
  pendingEditField: null,
  nextItemNumber: 1,
  nextGroupNumber: 1,
  nextConnectorNumber: 1,
  viewport: { x: 0, y: 0, zoom: 0.95 },
  hudLayouts: {},
  floatingLayouts: {},
  hudCollapsed: {},
  hudScrollTops: {},
  inspectorOpen: false,
  activePopover: null,
  historyPast: [],
  historyFuture: [],
  inputDiagnostics: {
    lastInteractionFrameMs: 0,
    scheduledInteractionFrames: 0,
    dragFrameCount: 0,
    totalDragFrameMs: 0,
    maxDragFrameMs: 0,
    averageDragFrameMs: 0,
    connectorPathComputesDuringDrag: 0,
    impactedConnectorCount: 0,
    impactedConnectorIdsDuringDrag: [],
    updatedConnectorIdsDuringDrag: [],
    fullConnectorPassesDuringDrag: 0,
    fullRenderDuringDrag: 0,
    finalConnectorPassesAfterDrop: 0
  },
  pendingConnectorAmountPreview: null,
  editingHistoryBefore: null,
  hudInputHistory: null,
  scenarioInputHistory: null
};

export const dom = {
  workspace: null,
  canvasStage: null,
  canvasWorld: null,
  dockFlyout: null,
  itemLayer: null,
  connectorLayer: null,
  handleLayer: null,
  labelLayer: null,
  hudLayer: null,
  scenarioRail: null,
  themeEyebrow: null,
  themeButtonText: null,
  templateTitle: null,
  templateButtonText: null,
  zoomReadout: null,
  inventoryAnchor: null,
  inventoryButton: null,
  inventoryPopover: null,
  inventoryCount: null,
  startScreen: null,
  toastHost: null
};

export function initDomRefs() {
  dom.workspace = document.getElementById("workspace");
  dom.canvasStage = document.getElementById("canvasStage");
  dom.canvasWorld = document.getElementById("canvasWorld");
  dom.dockFlyout = document.getElementById("dockFlyout");
  dom.itemLayer = document.getElementById("objectLayer");
  dom.connectorLayer = document.getElementById("flowLayer");
  dom.handleLayer = document.getElementById("handleLayer");
  dom.labelLayer = document.getElementById("labelLayer");
  dom.hudLayer = document.getElementById("hudLayer");
  dom.scenarioRail = document.getElementById("scenarioRail");
  dom.themeEyebrow = document.getElementById("themeEyebrow");
  dom.themeButtonText = document.getElementById("themeButtonText");
  dom.templateTitle = document.getElementById("templateTitle");
  dom.templateButtonText = document.getElementById("templateButtonText");
  dom.zoomReadout = document.getElementById("zoomReadout");
  dom.inventoryAnchor = document.getElementById("inventoryAnchor");
  dom.inventoryButton = document.getElementById("inventoryButton");
  dom.inventoryPopover = document.getElementById("inventoryPopover");
  dom.inventoryCount = document.getElementById("inventoryCount");
  dom.startScreen = document.getElementById("startScreen");
  dom.toastHost = document.getElementById("toastHost");
}

let renderAllCallback = () => {};

export function setRenderAllCallback(callback) {
  renderAllCallback = callback;
}

export function historySnapshot() {
  return {
    items: clone(state.items),
    groups: clone(state.groups),
    financeData: clone(state.financeData),
    connectors: clone(state.connectors),
    scenario: clone(state.scenario)
  };
}

export function historyChanged(snapshot) {
  return snapshot && JSON.stringify(snapshot) !== JSON.stringify(historySnapshot());
}

export function pushHistorySnapshot(snapshot) {
  if (!snapshot) return;
  state.historyPast.push(clone(snapshot));
  if (state.historyPast.length > HISTORY_LIMIT) state.historyPast.shift();
  state.historyFuture = [];
}

export function commitHistory() {
  pushHistorySnapshot(historySnapshot());
}

export function commitHistoryFrom(snapshot) {
  if (historyChanged(snapshot)) pushHistorySnapshot(snapshot);
}

export function clearHistory() {
  state.historyPast = [];
  state.historyFuture = [];
}

export function restoreHistorySnapshot(snapshot) {
  state.items = clone(snapshot.items || []);
  state.groups = clone(snapshot.groups || []);
  state.financeData = clone(snapshot.financeData || {});
  state.connectors = clone(snapshot.connectors || []);
  state.scenario = clone(snapshot.scenario || defaultScenario);
  state.selection = null;
  clearMultiSelection();
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.pendingEditFocus = false;
  state.inspectorOpen = false;
  state.activePopover = null;
  state.hotItemIds = new Set();
  state.hotConnectorIds = new Set();
  state.hoverItemId = null;
  renderAllCallback();
}

export function undoHistory() {
  if (!state.historyPast.length) return;
  const current = historySnapshot();
  const previous = state.historyPast.pop();
  state.historyFuture.push(current);
  restoreHistorySnapshot(previous);
}

export function redoHistory() {
  if (!state.historyFuture.length) return;
  const current = historySnapshot();
  const next = state.historyFuture.pop();
  state.historyPast.push(current);
  if (state.historyPast.length > HISTORY_LIMIT) state.historyPast.shift();
  restoreHistorySnapshot(next);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function compactDollars(value) {
  return compactCurrency.format(Math.round(Number(value) || 0));
}

export function dollars(value) {
  return currency.format(Math.round(Number(value) || 0));
}

export function parseMoney(value) {
  const cleaned = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[$,]/g, "");
  const match = cleaned.match(/^(-?(?:\d+\.?\d*|\.\d+))([kmb])?$/);
  if (!match) return 0;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return 0;
  const multiplier = match[2] === "k" ? 1000 : match[2] === "m" ? 1000000 : match[2] === "b" ? 1000000000 : 1;
  return parsed * multiplier;
}

export function formatMoneyInput(value) {
  return currency.format(Math.round(Number(value) || 0));
}

export function plainMoneyInput(value) {
  return String(Math.round(Number(value) || 0));
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function kebab(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function endpoint(value) {
  return typeof value === "string" ? { itemId: value } : value;
}

export function isAttachedEndpoint(value) {
  return Boolean(value?.itemId);
}

export function isFreeEndpoint(value) {
  return value && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y)) && !value.itemId;
}

export function cloneEndpoint(value) {
  return value ? { ...value } : { x: WORLD.width / 2, y: WORLD.height / 2 };
}

export function getItem(id) {
  return state.items.find((item) => item.id === id);
}

export function getGroup(id) {
  return state.groups.find((group) => group.id === id);
}

export function getConnector(id) {
  return state.connectors.find((connectorItem) => connectorItem.id === id);
}

export function getNode(id) {
  return getItem(id) || getGroup(id);
}

export function getAnchorableNodes() {
  return [...state.items, ...state.groups];
}

export function selectedItemIds() {
  if (state.multiSelection.length > 1) return state.multiSelection.filter((id) => getItem(id));
  if (state.selection?.kind === "item" && getItem(state.selection.id)) return [state.selection.id];
  return [];
}

export function hasMultiSelection() {
  return selectedItemIds().length > 1;
}

export function itemIsSelected(id) {
  return state.selection?.kind === "item" && state.selection.id === id || state.multiSelection.includes(id);
}

export function isLockedNode(node) {
  return Boolean(node?.locked);
}

export function clearMultiSelection() {
  state.multiSelection = [];
}

export function setSingleSelection(kind, id) {
  state.selection = { kind, id };
  clearMultiSelection();
}

export function toggleMultiSelectItem(id) {
  const item = getItem(id);
  if (!item) return;
  let ids = selectedItemIds();
  if (!ids.length || state.selection?.kind !== "item") ids = [];
  if (ids.includes(id)) ids = ids.filter((entry) => entry !== id);
  else ids.push(id);
  if (!ids.length) {
    state.selection = null;
    clearMultiSelection();
  } else {
    state.selection = { kind: "item", id: ids[ids.length - 1] };
    state.multiSelection = ids.length > 1 ? ids : [];
  }
  state.editingItemId = null;
  state.editingField = null;
  state.editingTarget = null;
  state.pendingEditField = null;
  state.inspectorOpen = false;
  state.activePopover = null;
  state.activeDock = "select";
  renderAllCallback();
}

export function isFormField(node) {
  return Boolean(node?.closest?.("input, textarea, select, [contenteditable='true']"));
}

// Genuine text entry only: text/number inputs, textareas, and contenteditable.
// Checkboxes, radios, range sliders, buttons and selects are NOT text entry, so
// they must not swallow undo/redo shortcuts.
export function isTextEntryTarget(node) {
  if (!node) return false;
  if (node.closest?.("[contenteditable='true']")) return true;
  const field = node.closest?.("input, textarea");
  if (!field) return false;
  if (field.tagName === "TEXTAREA") return true;
  const type = String(field.type || "text").toLowerCase();
  return !["checkbox", "radio", "range", "button", "submit", "reset", "color", "file", "image"].includes(type);
}

export function isPresentationMode() {
  return typeof document !== "undefined" && Boolean(document.body?.classList?.contains("presentation"));
}

export function nextZIndex() {
  return Math.max(0, ...state.items.map((item) => item.zIndex || 0), ...state.groups.map((group) => group.zIndex || 0)) + 1;
}
