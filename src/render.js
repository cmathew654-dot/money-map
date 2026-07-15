import { state, dom, WORLD, currency, flowTypes, routeStyles, strokeStyles, arrowStyles, labelModes, widthModes, colorModes, primitiveShapes, financeVisuals, accountCategories, defaultVisualByCategory, textStyles, escapeHtml, compactDollars, inventoryDollars, dollars, formatMoneyInput, plainMoneyInput, kebab, clamp, isAttachedEndpoint, getItem, getGroup, getConnector, getNode, selectedItemIds, hasMultiSelection, itemIsSelected, isLockedNode, isPresentationMode } from "./state.js";
import { themes, shapePalette, textPalette, financePalette, groupPalette, connectorPalette, templateFactories, templateCatalogSections, getTheme } from "./templates.js";
import { syncComputedValues, fillPercent, financeState, computeConnectorWidth, getConnectorColor, screenPoint, computeConnectorPath, computeConnectorPreviewPath, markerUrl, computeCanvasViewModel, getCanvasState, flowBreakdownForItem, withConnectorScoringCache, connectorDisplayAmount, connectorDisplayAmountText, connectorUsesMonthlyDisplay, connectorMotionEnabled, connectorHasManualAmount, connectorAmountSource, connectorScenarioDriver, connectorTimeProfile } from "./compute.js";
import { renderViewport } from "./viewport.js";

let connectorLabelHandlers = {
  startConnectorDrag: () => {},
  startConnectorBodyDrag: () => {},
  startConnectorLabelMaybeDrag: () => {},
  selectConnector: () => {},
  canvasNodeFromClientPoint: () => null
};

const renderDiagnostics = {
  connectorGeometryPasses: 0,
  connectorValuePasses: 0,
  connectorPathComputes: 0,
  lastConnectorUpdateMs: 0
};

const liveDragInteractionTypes = new Set([
  "drag-node",
  "resize-node",
  "drag-connector",
  "drag-connector-body"
]);

function isLiveDragInteraction() {
  return liveDragInteractionTypes.has(state.interaction?.type);
}

function connectorScopeFromOptions(options = {}) {
  const raw = options.connectorIds ?? options.onlyIds;
  if (raw == null) return null;
  return [...new Set(Array.from(raw).filter(Boolean))];
}

function connectorsForScope(scope) {
  if (scope == null) return state.connectors;
  return scope.map((id) => getConnector(id)).filter(Boolean);
}

export function resetRenderDiagnostics() {
  renderDiagnostics.connectorGeometryPasses = 0;
  renderDiagnostics.connectorValuePasses = 0;
  renderDiagnostics.connectorPathComputes = 0;
  renderDiagnostics.lastConnectorUpdateMs = 0;
}

export function getRenderDiagnostics() {
  return { ...renderDiagnostics };
}

export function setConnectorLabelHandlers(handlers) {
  connectorLabelHandlers = { ...connectorLabelHandlers, ...handlers };
}

function attr(value) {
  return escapeHtml(value ?? "");
}

function classToken(value, fallback = "unknown") {
  const token = String(value ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  const safeFallback = fallback === "" ? "" : String(fallback).replace(/[^a-zA-Z0-9_-]/g, "") || "unknown";
  if (!token || /^on/i.test(token) || /^data-pwned$/i.test(token)) return safeFallback;
  return token;
}

function cssIdent(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value ?? ""));
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

function cssNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cssPercent(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return `${clamp(Number.isFinite(parsed) ? parsed : fallback, 0, 100)}%`;
}

function anonymizeOptOut(item) {
  return item?.anonymize === false || item?.dataAnonymize === false || item?.["data-anonymize"] === false || item?.["data-anonymize"] === "false";
}

function presentationAnonymizedText(item, field, value) {
  const text = String(value ?? "");
  if (!text || anonymizeOptOut(item) || !document.body.classList.contains("presentation")) return text;
  if (field !== "label" && field !== "subtitle") return text;
  if (!/(household|family)/i.test(text)) return text;
  return /family/i.test(text) && !/household/i.test(text) ? "Sample Family" : "Sample Household";
}

function nodeStyle(node) {
  const width = Math.max(1, cssNumber(node.w, 1));
  const height = Math.max(1, cssNumber(node.h, 1));
  return [
    `--x:${cssNumber(node.x)}px`,
    `--y:${cssNumber(node.y)}px`,
    `--w:${width}px`,
    `--h:${height}px`,
    `--z:${cssNumber(node.zIndex, 1)}`
  ].join(";");
}

function connectorAmountText(conn) {
  return connectorDisplayAmountText(conn);
}

function connectorEditorAmount(conn) {
  return connectorDisplayAmount(conn);
}

function connectorLabelRepaired(conn, computed) {
  return conn.labelMode === "manual" && conn.labelPoint && computed?.label && !computed.label.hidden && (
    Math.abs(computed.label.x - conn.labelPoint.x) > 1 ||
    Math.abs(computed.label.y - conn.labelPoint.y) > 1
  ) ? "true" : "false";
}

function connectorEditorMax(conn) {
  const max = Math.max(conn.max || 1, conn.amount || 1);
  return connectorUsesMonthlyDisplay(conn) ? Math.ceil(max / 12) : max;
}

function connectorEditorStep(conn) {
  return connectorUsesMonthlyDisplay(conn) ? 50 : 1000;
}

function connectorAmountTitle(conn) {
  return connectorUsesMonthlyDisplay(conn) ? "Monthly flow amount" : "Flow amount";
}

function titleCase(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function connectorSourceStatusInfo(conn) {
  const source = connectorAmountSource(conn);
  const driver = connectorScenarioDriver(conn);
  const timeProfile = connectorTimeProfile(conn);
  const cadence = titleCase(timeProfile.cadence || "oneTime");
  const timing = titleCase(timeProfile.timing || "current");
  return {
    source,
    driver,
    cadence,
    timing,
    title: source === "manual"
      ? "Manual override"
      : source === "linked"
        ? "Linked to scenario"
        : "Fixed amount",
    detail: driver?.label || "Direct flow amount"
  };
}

function connectorSourceStatusHtml(conn) {
  const info = connectorSourceStatusInfo(conn);
  const resetDisabled = info.source !== "manual" || !info.driver;
  return `
    <div class="flow-source-status" data-flow-source-status data-flow-source="${attr(info.source)}">
      <div class="flow-source-copy">
        <span>Amount source</span>
        <strong data-flow-source-title>${escapeHtml(info.title)}</strong>
        <em data-flow-source-detail>${escapeHtml(`${info.detail} · ${info.cadence} · ${info.timing}`)}</em>
      </div>
      <button class="secondary-action flow-source-reset" type="button" data-action="reset-connector-amount-link" ${resetDisabled ? "disabled" : ""}>Reset to linked</button>
    </div>
  `;
}

function syncConnectorSourceStatus(container, conn) {
  const status = container?.querySelector?.("[data-flow-source-status]");
  if (!status) return;
  const info = connectorSourceStatusInfo(conn);
  status.dataset.flowSource = info.source;
  const title = status.querySelector("[data-flow-source-title]");
  const detail = status.querySelector("[data-flow-source-detail]");
  const reset = status.querySelector("[data-action='reset-connector-amount-link']");
  if (title) title.textContent = info.title;
  if (detail) detail.textContent = `${info.detail} · ${info.cadence} · ${info.timing}`;
  if (reset) reset.disabled = info.source !== "manual" || !info.driver;
}

function meetingFocusMatches(kind, id) {
  const focus = state.meeting?.focus;
  return Boolean(focus && focus.kind === kind && focus.id === id);
}

function productRoleToken(item, data = {}) {
  if (item?.type !== "finance") return "";
  for (const role of [item.productRole, data.productRole]) {
    const token = classToken(role, "");
    if (token) return token;
  }
  return "";
}

function productRoleMarkup(item, data = {}) {
  const role = productRoleToken(item, data);
  return role
    ? { className: `product-role-${role}`, attr: ` data-product-role="${attr(role)}"` }
    : { className: "", attr: "" };
}

function surfaceToken(item, data = {}) {
  return classToken(item?.surface || data?.surface || "", "");
}

function surfaceMarkup(item, data = {}) {
  const surface = surfaceToken(item, data);
  return surface
    ? { className: `surface-${surface}`, attr: ` data-surface="${attr(surface)}"` }
    : { className: "", attr: "" };
}

function syncProductRole(node, item, data = {}) {
  const role = productRoleToken(item, data);
  Array.from(node.classList)
    .filter((className) => className.startsWith("product-role-"))
    .forEach((className) => node.classList.remove(className));
  if (!role) {
    node.removeAttribute("data-product-role");
    return;
  }
  node.classList.add(`product-role-${role}`);
  node.dataset.productRole = role;
}

function syncSurface(node, item, data = {}) {
  const surface = surfaceToken(item, data);
  Array.from(node.classList)
    .filter((className) => className.startsWith("surface-"))
    .forEach((className) => node.classList.remove(className));
  if (!surface) {
    node.removeAttribute("data-surface");
    return;
  }
  node.classList.add(`surface-${surface}`);
  node.dataset.surface = surface;
}

function formatSubBucketValue(value) {
  if (value == null || value === "") return "";
  const number = Number(value);
  if (Number.isFinite(number)) return compactDollars(number);
  return String(value);
}

function normalizeSubBuckets(subBuckets) {
  if (Array.isArray(subBuckets)) return subBuckets;
  if (!subBuckets || typeof subBuckets !== "object") return [];
  return Object.entries(subBuckets).map(([label, entry]) => (
    entry && typeof entry === "object"
      ? { label, ...entry }
      : { label, value: entry }
  ));
}

export function subBucketStableId(bucket, index = 0) {
  const explicit = bucket?.id != null ? String(bucket.id).trim() : "";
  if (explicit) return explicit;
  const label = bucket?.label ?? bucket?.name ?? bucket?.title ?? "";
  return kebab(label || `sleeve-${index + 1}`) || `sleeve-${index + 1}`;
}

function selectedSleeveMatches(itemId, sleeveId) {
  return state.selection?.kind === "sleeve" &&
    state.selection.itemId === itemId &&
    state.selection.sleeveId === sleeveId;
}

function editingTargetMatches(kind, field, ids = {}) {
  const target = state.editingTarget;
  if (!target || target.kind !== kind) return false;
  if (field && target.field !== field) return false;
  if (kind === "item") return target.id === ids.id;
  if (kind === "group") return target.id === ids.id;
  if (kind === "sleeve") return target.itemId === ids.itemId && target.sleeveId === ids.sleeveId;
  if (kind === "connector") return target.id === ids.id;
  return false;
}

function itemFieldIsEditing(item, field) {
  return !isLockedNode(item) && (
    (state.editingItemId === item.id && (!state.editingField || state.editingField === field)) ||
    editingTargetMatches("item", field, { id: item.id })
  );
}

function groupFieldIsEditing(group, field) {
  return !isLockedNode(group) && (
    (state.editingItemId === group.id && (!state.editingField || state.editingField === field)) ||
    editingTargetMatches("group", field, { id: group.id })
  );
}

function editableAttrs(kind, field, ids = {}, editable = false) {
  const idAttrs = [
    ids.id ? ` data-edit-id="${attr(ids.id)}"` : "",
    ids.itemId ? ` data-item-id="${attr(ids.itemId)}"` : "",
    ids.sleeveId ? ` data-sub-bucket-id="${attr(ids.sleeveId)}"` : "",
    ids.connectorId ? ` data-connector-id="${attr(ids.connectorId)}"` : ""
  ].join("");
  return `data-edit-kind="${attr(kind)}" data-edit-field="${attr(field)}"${idAttrs}${editable ? ' contenteditable="true" spellcheck="false"' : ""}`;
}

function editableGeometrySurfaceAttr(className) {
  return /\bfinance-(?:name|type|note)\b/.test(String(className || "")) ? ' data-geometry-surface="text"' : "";
}

export function findSubBucket(itemId, sleeveId) {
  const item = getItem(itemId);
  const data = item?.financeId ? state.financeData[item.financeId] : null;
  const rows = normalizeSubBuckets(data?.subBuckets);
  const index = rows.findIndex((entry, rowIndex) => subBucketStableId(entry, rowIndex) === sleeveId);
  if (!item || !data || index < 0) return null;
  return { item, data, bucket: rows[index], index, sleeveId };
}

function renderSubBucketStack(item, subBuckets) {
  const rows = normalizeSubBuckets(subBuckets)
    .map((entry, index) => {
      const bucket = entry && typeof entry === "object" ? entry : { label: entry };
      const sleeveId = subBucketStableId(bucket, index);
      const label = bucket.label ?? bucket.name ?? bucket.title ?? bucket.id ?? `Sleeve ${index + 1}`;
      const rawValue = bucket.value ?? bucket.amount ?? bucket.balance;
      const labelEditing = editingTargetMatches("sleeve", "label", { itemId: item.id, sleeveId });
      const valueEditing = editingTargetMatches("sleeve", "value", { itemId: item.id, sleeveId });
      const value = valueEditing ? plainMoneyInput(rawValue || 0) : formatSubBucketValue(rawValue);
      const note = bucket.note ?? bucket.subtitle ?? bucket.description ?? "";
      if (!label && !value && !note) return "";
      return `
        <div class="sub-bucket-card ${selectedSleeveMatches(item.id, sleeveId) ? "is-selected" : ""}" role="button" tabindex="0" data-geometry-surface="sleeve" data-item-id="${attr(item.id)}" data-finance-id="${attr(item.financeId)}" data-sub-bucket-id="${attr(sleeveId)}">
          <span class="sub-bucket-label editable-text" data-geometry-surface="text" ${editableAttrs("sleeve", "label", { itemId: item.id, sleeveId }, labelEditing)}>${escapeHtml(label)}</span>
          ${value || valueEditing ? `<strong class="sub-bucket-value editable-text editable-money" ${editableAttrs("sleeve", "value", { itemId: item.id, sleeveId }, valueEditing)}>${escapeHtml(value)}</strong>` : ""}
          ${note ? `<span class="sub-bucket-note" data-geometry-surface="text">${escapeHtml(note)}</span>` : ""}
        </div>
      `;
    })
    .filter(Boolean);
  if (!rows.length) return "";
  return `<div class="sub-bucket-stack">${rows.join("")}</div>`;
}

function humanizeMetaLabel(key) {
  return String(key ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
}

function hiddenMetaKey(label) {
  const normalized = String(label ?? "").replace(/[\s_-]+/g, "").toLowerCase();
  return new Set([
    "contract",
    "displayonly",
    "planninguse",
    "contracttype",
    "accountcategory",
    "ownershipcontext",
    "cadence",
    "surface",
    "productrole",
    "flowsemantic",
    "layoutquality",
    "presentationreadability"
  ]).has(normalized);
}

function normalizeProductMeta(meta) {
  const entries = Array.isArray(meta)
    ? meta.map((entry) => Array.isArray(entry)
      ? { label: entry[0], value: entry[1] }
      : entry && typeof entry === "object"
        ? entry
        : { value: entry })
    : meta && typeof meta === "object"
      ? Object.entries(meta).map(([label, value]) => ({ label, value }))
      : [];
  return entries
    .filter((entry) => !hiddenMetaKey(entry?.label ?? entry?.name ?? entry?.title ?? ""))
    .map((entry) => ({
      ...entry,
      label: entry?.label != null ? humanizeMetaLabel(entry.label) : entry?.label
    }));
}

function renderProductMetaGrid(meta) {
  const rows = normalizeProductMeta(meta)
    .map((entry) => {
      const row = Array.isArray(entry)
        ? { label: entry[0], value: entry[1] }
        : entry && typeof entry === "object"
          ? entry
          : { value: entry };
      const label = row.label ?? row.name ?? row.title ?? "";
      const value = row.value ?? row.amount ?? row.detail ?? "";
      if (!label && (value == null || value === "")) return "";
      return `
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value ?? "")}</strong>
      `;
    })
    .filter(Boolean);
  if (!rows.length) return "";
  return `<div class="product-meta-grid">${rows.join("")}</div>`;
}

function hasSubBucketSurface(item, data = {}) {
  const rows = normalizeSubBuckets(data.subBuckets);
  if (!rows.length) return false;
  const surface = item?.surface || data.surface;
  if (surface === "compact" || data.showSubBuckets === false) return false;
  if (surface === "container" || data.showSubBuckets === true) return true;
  const role = productRoleToken(item, data);
  if (role === "trustEstate") return item?.visual === "trust" && item.w >= 320 && item.h >= 190;
  if (role === "cashReserve") return ["bucket", "cylinder"].includes(item?.visual) && item.w >= 300 && item.h >= 160;
  return false;
}

function hasPolicyMetaSurface(item, data = {}) {
  return item?.visual === "policy" || data.category === "annuity";
}

function hasTagSurface(item, data = {}) {
  const role = productRoleToken(item, data);
  const surface = surfaceToken(item, data);
  return item?.visual === "amountTag" ||
    item?.visual === "taxTag" ||
    surface === "tag" ||
    role === "fee";
}

// === STRUCTURAL ===
export function renderDockFlyout() {
  if (state.activeDock === "select") {
    dom.dockFlyout.className = "dock-flyout is-hidden";
    dom.dockFlyout.innerHTML = "";
    return;
  }

  dom.dockFlyout.className = "dock-flyout";

  if (state.activeDock === "add") {
    const tabs = {
      shapes: "Shape",
      text: "Text",
      finance: "Finance",
      connectors: "Connector"
    };
    const content = {
      shapes: `<div class="flyout-grid two">${shapePalette.map(renderPaletteButton).join("")}</div>`,
      text: `<div class="flyout-grid two">${textPalette.map(renderPaletteButton).join("")}</div>`,
      finance: `<div class="flyout-grid">${financePalette.map(renderFinancePaletteButton).join("")}</div>`,
      connectors: `<div class="flyout-grid">${connectorPalette.map(renderConnectorPaletteButton).join("")}</div>`
    };
    dom.dockFlyout.innerHTML = `
      <div class="flyout-title"><strong>Add</strong><span class="section-label">Canvas object</span></div>
      <div class="flyout-tabs" role="tablist" aria-label="Add object type">
        ${Object.entries(tabs).map(([id, label]) => `
          <button class="flyout-tab ${id === state.activeAddTab ? "is-active" : ""}" type="button" role="tab" aria-selected="${id === state.activeAddTab}" data-add-tab="${id}">${label}</button>
        `).join("")}
      </div>
      ${content[state.activeAddTab] || content.finance}
    `;
    return;
  }

  if (state.activeDock === "shapes") {
    dom.dockFlyout.innerHTML = `
      <div class="flyout-title"><strong>Shapes</strong><span class="section-label">Primitive</span></div>
      <div class="flyout-grid two">${shapePalette.map(renderPaletteButton).join("")}</div>
    `;
    return;
  }

  if (state.activeDock === "text") {
    dom.dockFlyout.innerHTML = `
      <div class="flyout-title"><strong>Text</strong><span class="section-label">Labels</span></div>
      <div class="flyout-grid two">${textPalette.map(renderPaletteButton).join("")}</div>
    `;
    return;
  }

  if (state.activeDock === "finance") {
    dom.dockFlyout.innerHTML = `
      <div class="flyout-title"><strong>Finance starters</strong><span class="section-label">Fake data</span></div>
      <div class="flyout-grid">${financePalette.map(renderFinancePaletteButton).join("")}</div>
    `;
    return;
  }

  if (state.activeDock === "connectors") {
    dom.dockFlyout.innerHTML = `
      <div class="flyout-title"><strong>Connectors</strong><span class="section-label">Flow</span></div>
      <div class="flyout-grid">${connectorPalette.map(renderConnectorPaletteButton).join("")}</div>
    `;
    return;
  }

  if (state.activeDock === "groups") {
    dom.dockFlyout.innerHTML = `
      <div class="flyout-title"><strong>Groups</strong><span class="section-label">Containers</span></div>
      <div class="flyout-grid">${groupPalette.map(renderGroupPaletteButton).join("")}</div>
    `;
    return;
  }

  if (state.activeDock === "templates") {
    dom.dockFlyout.innerHTML = `
      <div class="flyout-title"><strong>Template catalog</strong><span class="section-label">Canvas starts</span></div>
      ${renderTemplateCatalog({ compact: true })}
    `;
    return;
  }

  if (state.activeDock === "themes") {
    dom.dockFlyout.innerHTML = `
      <div class="flyout-title"><strong>Themes</strong><span class="section-label">Visual system</span></div>
      <div class="flyout-grid">${renderThemeChoices()}</div>
    `;
  }
}

export function renderPaletteButton(item) {
  const selected = state.activeCreationPreset?.kind === item.type && state.activeCreationPreset?.id === item.id;
  return `
    <button class="flyout-button ${selected ? "is-selected" : ""}" type="button" data-palette-kind="${item.type}" data-palette-id="${item.id}" aria-pressed="${selected}">
      <span class="palette-icon ${item.icon}" aria-hidden="true"></span>
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.subtitle)}</span>
    </button>
  `;
}

export function renderFinancePaletteButton(item) {
  const selected = state.activeCreationPreset?.kind === "finance" && state.activeCreationPreset?.id === item.id;
  return `
    <button class="flyout-button ${selected ? "is-selected" : ""}" type="button" data-palette-kind="finance" data-palette-id="${item.id}" aria-pressed="${selected}">
      <span class="palette-icon ${item.icon}" aria-hidden="true"></span>
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.subtitle)}</span>
    </button>
  `;
}

export function renderGroupPaletteButton(item) {
  const selected = state.activeCreationPreset?.kind === "group" && state.activeCreationPreset?.id === item.id;
  return `
    <button class="flyout-button ${selected ? "is-selected" : ""}" type="button" data-palette-kind="group" data-palette-id="${item.id}" aria-pressed="${selected}">
      <span class="palette-icon ${item.icon}" aria-hidden="true"></span>
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.subtitle)}</span>
    </button>
  `;
}

export function renderConnectorPaletteButton(item) {
  const selected = state.activeCreationPreset?.kind === "connector" && state.activeCreationPreset?.id === item.id;
  return `
    <button class="flyout-button ${selected ? "is-selected" : ""}" type="button" data-palette-kind="connector" data-palette-id="${item.id}" aria-pressed="${selected}">
      <span class="palette-icon ${item.icon}" aria-hidden="true"></span>
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.subtitle)}</span>
    </button>
  `;
}

export function renderThemeChoices() {
  return Object.entries(themes)
    .filter(([, theme]) => Array.isArray(theme?.chip))
    .map(([id, theme]) => `
    <button class="theme-choice ${id === state.themeId ? "is-selected" : ""}" type="button" data-theme-id="${id}">
      <span class="theme-chip" aria-hidden="true">
        ${theme.chip.map((color) => `<i style="background:${color}"></i>`).join("")}
      </span>
      <span>
        <strong>${escapeHtml(theme.name)}</strong>
        <span>Canvas, objects, and flows</span>
      </span>
    </button>
  `).join("");
}

export function renderTemplateCatalog(options = {}) {
  const compact = Boolean(options.compact);
  const className = compact ? "template-catalog is-compact" : "template-catalog";
  return `
    <div class="${className}" aria-label="Template catalog">
      ${templateCatalogSections.map((section) => `
        <section class="template-catalog-section" data-template-section="${attr(section.id)}">
          <div class="template-catalog-section-head">
            <span>${escapeHtml(section.eyebrow || "Templates")}</span>
            <h3>${escapeHtml(section.title)}</h3>
          </div>
          <div class="template-catalog-grid">
            ${section.templates.map((entry) => {
              const template = templateFactories[entry.templateId]?.();
              const name = entry.name || template?.name || entry.templateId;
              const description = entry.description || template?.canvasTitle || "";
              const isSelected = entry.templateId === state.activeTemplateId;
              return `
                <button class="template-catalog-card ${isSelected ? "is-selected" : ""}" type="button" data-template-id="${attr(entry.templateId)}" aria-pressed="${isSelected}">
                  <span class="template-catalog-status">${isSelected ? "Active" : section.eyebrow || "Template"}</span>
                  <strong>${escapeHtml(name)}</strong>
                  <span>${escapeHtml(description)}</span>
                </button>
              `;
            }).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

export function renderItems() {
  const groupHtml = state.groups
    .slice()
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    .map(renderGroup)
    .join("");
  const itemHtml = state.items
    .slice()
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    .map(renderItem)
    .join("");
  dom.itemLayer.innerHTML = groupHtml + itemHtml;
}

export function renderGroup(group) {
  const selected = state.selection?.kind === "group" && state.selection.id === group.id;
  const layoutStatus = state.layoutFeedback?.ids?.includes(group.id) ? `is-layout-${classToken(state.layoutFeedback.status, "warn")}` : "";
  return `
    <article class="canvas-group ${selected ? "is-selected" : ""} ${isLockedNode(group) ? "is-locked" : ""} ${layoutStatus}" data-group-id="${attr(group.id)}"${isLockedNode(group) ? ' data-locked="true"' : ""} style="${nodeStyle(group)}">
      <div class="group-surface">
        ${editableText(group, "label", "group-label")}
      </div>
      ${selected && !isLockedNode(group) ? renderResizeHandles() : ""}
    </article>
  `;
}

export function renderItem(item) {
  const selected = itemIsSelected(item.id);
  const singleSelected = state.selection?.kind === "item" && state.selection.id === item.id && !hasMultiSelection();
  const endpointHot = state.hoverItemId === item.id;
  const itemFinanceData = item.type === "finance" && item.financeId ? state.financeData[item.financeId] || {} : {};
  const current = item.financeId ? state.currentValues[item.financeId] ?? state.financeData[item.financeId]?.value ?? 0 : 0;
  const previous = item.financeId ? state.previousValues[item.financeId] ?? state.financeData[item.financeId]?.value ?? current : current;
  const delta = current - previous;
  const showDelta = state.hotItemIds.has(item.id) && Math.abs(delta) > 0;
  const itemType = classToken(item.type, "shape");
  const shapeClass = item.type === "finance"
    ? `finance-${classToken(item.visual, "card")}`
    : item.type === "text"
      ? `text-${classToken(item.style?.textStyle || "caption", "caption")}`
      : `shape-${classToken(item.shape, "rounded")}`;
  const financeItemState = financeState(item);
  const stateAttr = financeItemState ? ` data-state="${attr(classToken(financeItemState))}"` : "";
  const lockedAttr = isLockedNode(item) ? ' data-locked="true"' : "";
  const anonymizeAttr = anonymizeOptOut(item) ? ' data-anonymize="false"' : "";
  const fill = cssPercent(fillPercent(item));
  const layoutStatus = state.layoutFeedback?.ids?.includes(item.id) ? `is-layout-${classToken(state.layoutFeedback.status, "warn")}` : "";
  const productRole = productRoleMarkup(item, itemFinanceData);
  const surface = surfaceMarkup(item, itemFinanceData);
  const shapeIntent = item.type === "shape" ? classToken(item.shapeIntent, "") : "";
  const shapeIntentClass = shapeIntent ? `shape-intent-${shapeIntent}` : "";
  const shapeIntentAttr = shapeIntent ? ` data-shape-intent="${attr(shapeIntent)}"` : "";
  return `
    <article class="canvas-item item-${itemType} ${shapeClass} ${shapeIntentClass} ${productRole.className} ${surface.className} ${selected ? "is-selected" : ""} ${meetingFocusMatches("item", item.id) ? "is-meeting-focus" : ""} ${isLockedNode(item) ? "is-locked" : ""} ${endpointHot ? "is-snap-target" : ""} ${state.hotItemIds.has(item.id) ? "is-hot" : ""} ${layoutStatus}" data-item-id="${attr(item.id)}"${stateAttr}${productRole.attr}${surface.attr}${shapeIntentAttr}${lockedAttr}${anonymizeAttr} style="${nodeStyle(item)};--fill:${fill}">
      ${renderItemSurface(item, delta, showDelta)}
      ${renderEdgeHandles(item)}
      ${singleSelected && !isLockedNode(item) ? renderResizeHandles() : ""}
    </article>
  `;
}

export function renderEdgeHandles(item) {
  if (item.type !== "finance" || isLockedNode(item)) return "";
  // In presentation (view-only) the edge handles create connectors, so they must
  // be removed from the tab order as well as being inert to pointer input.
  const tab = isPresentationMode() ? ' tabindex="-1"' : "";
  return `
    <div class="item-edge-handles" aria-hidden="true">
      <button class="item-edge-handle north" type="button"${tab} data-edge-handle="north" data-item-id="${attr(item.id)}" aria-label="Create connector from top edge"></button>
      <button class="item-edge-handle east" type="button"${tab} data-edge-handle="east" data-item-id="${attr(item.id)}" aria-label="Create connector from right edge"></button>
      <button class="item-edge-handle south" type="button"${tab} data-edge-handle="south" data-item-id="${attr(item.id)}" aria-label="Create connector from bottom edge"></button>
      <button class="item-edge-handle west" type="button"${tab} data-edge-handle="west" data-item-id="${attr(item.id)}" aria-label="Create connector from left edge"></button>
    </div>
  `;
}

export function editableText(item, field, className, options = {}) {
  const editable = itemFieldIsEditing(item, field);
  const value = presentationAnonymizedText(item, field, item[field] || "");
  if (!editable && options.hideWhenEmpty && !value) return "";
  const placeholder = options.placeholder ? ` data-placeholder="${escapeHtml(options.placeholder)}"` : "";
  const geometrySurface = editableGeometrySurfaceAttr(className);
  return `<div class="${classToken(className)} editable-text"${geometrySurface} ${editableAttrs("item", field, { id: item.id }, editable)}${placeholder}>${escapeHtml(value)}</div>`;
}

export function editableFinanceValue(item, value) {
  const editable = itemFieldIsEditing(item, "financeValue");
  const rawValue = state.financeData[item.financeId]?.value ?? value ?? 0;
  const displayValue = editable ? plainMoneyInput(rawValue) : compactDollars(value);
  const shortfall = !editable && Number(value) < 0;
  return `<div class="finance-value editable-text editable-money${shortfall ? " is-shortfall" : ""}" ${editableAttrs("item", "financeValue", { id: item.id }, editable)}${shortfall ? shortfallTitle(value) : ""} data-placeholder="Value">${escapeHtml(displayValue)}</div>`;
}

function isRothTaxReserveTradeoff(item) {
  return item?.id === "taxReserve" && item.stateOverride === "tradeoff";
}

function rothTaxReserveTradeoffHtml(item) {
  const conversion = Number(state.scenario.rothConversion) || 0;
  const taxRate = Number(state.scenario.taxReservePct) || 0;
  const reserve = Math.round(conversion * (taxRate / 100));
  return `
    <div class="paycheck-topline">
      ${editableText(item, "subtitle", "finance-type", { hideWhenEmpty: true, placeholder: "Subtitle" })}
      ${editableText(item, "label", "finance-name", { placeholder: "Label" })}
    </div>
    <div class="paycheck-amount" data-roth-tax-reserve="amount"><span class="paycheck-amount-input">${currency.format(reserve)}</span></div>
    <div class="cashflow-mini-grid">
      <span>Conversion</span><strong data-roth-tax-reserve="conversion">${currency.format(conversion)}</strong>
      <span>Tax rate</span><strong data-roth-tax-reserve="tax-rate">${taxRate}%</strong>
    </div>
    ${editableText(item, "note", "finance-note", { hideWhenEmpty: true, placeholder: "Note" })}
  `;
}

function connectorTouchesItem(endpointValue, itemId) {
  return endpointValue?.itemId === itemId;
}

function annuityContractReadout(item, data, value) {
  const incomeConnector = state.connectors.find((conn) => (
    connectorTouchesItem(conn.source, item.id) &&
    connectorUsesMonthlyDisplay(conn) &&
    (conn.scenarioKey === "annuityIncome" || conn.flowType === "income")
  ));
  const premiumConnector = state.connectors.find((conn) => (
    connectorTouchesItem(conn.target, item.id) &&
    (conn.scenarioKey === "annuityPremium" || conn.flowType === "annuity")
  ));
  const scenarioPremium = /annuity/i.test(`${item.id} ${item.label}`) ? Number(state.scenario.annuityPremium) || 0 : 0;
  const incomeMonthly = incomeConnector ? connectorDisplayAmount(incomeConnector) : 0;
  const funding = premiumConnector ? Number(premiumConnector.amount) || 0 : scenarioPremium || Number(value) || 0;
  const payoutText = incomeMonthly > 0 ? `${currency.format(incomeMonthly)}/mo` : "Not started";
  const fundingText = funding > 0 ? compactDollars(funding) : "N/A";

  return `
    <div class="annuity-contract-readout">
      <div>
        <span>Payout</span>
        <strong>${escapeHtml(payoutText)}</strong>
      </div>
      <div>
        <span>Funding</span>
        <strong>${escapeHtml(fundingText)}</strong>
      </div>
    </div>
  `;
}

function policyContractReadout(item, data, value) {
  const metaRows = normalizeProductMeta(data.meta);
  const meta = new Map(metaRows.map((row) => [
    String(row.label || "").replace(/\s+/g, "").toLowerCase(),
    row.value ?? row.detail ?? ""
  ]));
  const benefit = meta.get("benefit") || meta.get("deathbenefit") || (value > 0 ? compactDollars(value) : "Review");
  const carrier = meta.get("carrier") || meta.get("insurer") || "Carrier TBD";
  const issueAge = meta.get("issueage") || meta.get("age") || "N/A";
  return `
    <div class="annuity-contract-readout policy-contract-readout">
      <div>
        <span>Benefit</span>
        <strong>${escapeHtml(benefit)}</strong>
      </div>
      <div>
        <span>Carrier</span>
        <strong>${escapeHtml(carrier)}</strong>
      </div>
      <div>
        <span>Issue age</span>
        <strong>${escapeHtml(issueAge)}</strong>
      </div>
    </div>
  `;
}

export function renderItemSurface(item, delta, showDelta) {
  if (item.type === "text") {
    return `
      <div class="item-surface text-surface">
        ${editableText(item, "label", "text-main", { placeholder: "Text" })}
        ${editableText(item, "subtitle", "text-sub", { hideWhenEmpty: true, placeholder: "Subtitle" })}
      </div>
    `;
  }

  if (item.type === "shape") {
    return `
      <div class="item-surface shape-surface">
        ${editableText(item, "subtitle", "shape-kicker", { hideWhenEmpty: true, placeholder: "Subtitle" })}
        ${editableText(item, "label", "shape-label", { placeholder: "Label" })}
        ${editableText(item, "note", "shape-note", { hideWhenEmpty: true, placeholder: "Note" })}
      </div>
    `;
  }

  return renderFinanceSurface(item, delta, showDelta);
}

export function renderFinanceSurface(item, delta, showDelta) {
  const data = state.financeData[item.financeId] || {};
  const viewModel = computeCanvasViewModel();
  const value = viewModel.financeValues[item.financeId] ?? state.currentValues[item.financeId] ?? data.value ?? 0;
  const deltaClass = delta < 0 ? " is-negative" : "";
  const deltaText = `${delta > 0 ? "+" : ""}${compactDollars(delta)}`;
  const subBucketStack = hasSubBucketSurface(item, data) ? renderSubBucketStack(item, data.subBuckets) : "";
  const productMetaGrid = hasPolicyMetaSurface(item, data) ? renderProductMetaGrid(data.meta) : "";

  if (isRothTaxReserveTradeoff(item)) {
    return `
      <div class="item-surface finance-surface tax-reserve-tradeoff-surface" data-state="tradeoff">
        ${rothTaxReserveTradeoffHtml(item)}
      </div>
    `;
  }

  if (item.visual === "paycheck") {
    const cashflow = viewModel.cashflowByItemId?.[item.id] || viewModel.cashflow;
    const canvasState = classToken(getCanvasState(item, state.financeData, cashflow), "neutral");
    const editingNeed = itemFieldIsEditing(item, "scenarioMonthlyNeed");
    const needText = editingNeed ? formatMoneyInput(cashflow.need) : currency.format(cashflow.need);
    return `
      <div class="item-surface finance-surface paycheck-surface" data-state="${attr(canvasState)}">
        <div class="paycheck-topline">
          ${editableText(item, "subtitle", "finance-type", { hideWhenEmpty: true, placeholder: "Subtitle" })}
          ${editableText(item, "label", "finance-name", { placeholder: "Label" })}
        </div>
        <div class="paycheck-amount" data-cashflow-value="need"><span class="paycheck-amount-input editable-text editable-money" ${editableAttrs("item", "scenarioMonthlyNeed", { id: item.id }, editingNeed)}>${escapeHtml(needText)}</span><span class="paycheck-amount-suffix">/mo</span></div>
        <div class="cashflow-mini-grid">
          <span>Mapped</span><strong data-cashflow-value="mapped">${currency.format(cashflow.mapped)}</strong>
          <span data-cashflow-value="gap-label">${cashflow.gap >= 0 ? "Surplus" : "Gap"}</span><strong data-cashflow-value="gap">${currency.format(Math.abs(cashflow.gap))}</strong>
        </div>
        ${editableText(item, "note", "finance-note", { hideWhenEmpty: true, placeholder: "Note" })}
      </div>
    `;
  }

  if (hasTagSurface(item, data)) {
    return `
      <div class="item-surface finance-surface finance-tag-surface">
        ${editableText(item, "subtitle", "finance-type", { hideWhenEmpty: true, placeholder: "Subtitle" })}
        ${editableText(item, "label", "finance-name", { placeholder: "Label" })}
        ${editableText(item, "note", "finance-note", { hideWhenEmpty: true, placeholder: "Note" })}
        ${editableFinanceValue(item, value)}
        <span class="delta${deltaClass}${showDelta ? " is-visible" : ""}">${deltaText}</span>
      </div>
    `;
  }

  if (item.visual === "bucket" || item.visual === "cylinder") {
    return `
      <div class="item-surface finance-surface ${subBucketStack ? "liquidity-container-surface" : ""}">
        <div class="bucket-vessel" aria-hidden="true"><span><i></i></span></div>
        <div class="finance-copy">
          ${editableText(item, "subtitle", "finance-type", { hideWhenEmpty: true, placeholder: "Subtitle" })}
          ${editableText(item, "label", "finance-name", { placeholder: "Label" })}
          ${editableText(item, "note", "finance-note", { hideWhenEmpty: true, placeholder: "Note" })}
          ${editableFinanceValue(item, value)}
        </div>
        ${subBucketStack}
        <span class="delta${deltaClass}${showDelta ? " is-visible" : ""}">${deltaText}</span>
      </div>
    `;
  }

  if (item.visual === "trust") {
    return `
      <div class="item-surface finance-surface trust-container-surface">
        <div class="trust-container-head">
          ${editableText(item, "subtitle", "finance-type", { hideWhenEmpty: true, placeholder: "Subtitle" })}
          ${editableText(item, "label", "finance-name", { placeholder: "Label" })}
          ${editableText(item, "note", "finance-note", { hideWhenEmpty: true, placeholder: "Note" })}
          ${value > 0 || itemFieldIsEditing(item, "financeValue") ? editableFinanceValue(item, value) : ""}
        </div>
        ${subBucketStack}
        <span class="delta${deltaClass}${showDelta ? " is-visible" : ""}">${deltaText}</span>
      </div>
    `;
  }

  if (item.visual === "household") {
    return `
      <div class="item-surface finance-surface">
        ${editableText(item, "subtitle", "finance-type", { hideWhenEmpty: true, placeholder: "Subtitle" })}
        ${editableText(item, "label", "finance-name", { placeholder: "Label" })}
        ${editableText(item, "note", "finance-note", { hideWhenEmpty: true, placeholder: "Note" })}
        ${data.capacity > 1 || itemFieldIsEditing(item, "financeValue") ? editableFinanceValue(item, value) : ""}
        <span class="delta${deltaClass}${showDelta ? " is-visible" : ""}">${deltaText}</span>
      </div>
    `;
  }

  if (item.visual === "policy" && (data.category === "annuity" || data.category === "insurance")) {
    const isInsurance = data.category === "insurance";
    return `
      <div class="item-surface finance-surface annuity-contract-surface ${isInsurance ? "insurance-contract-surface" : ""}">
        ${editableText(item, "subtitle", "finance-type", { hideWhenEmpty: true, placeholder: "Subtitle" })}
        ${editableText(item, "label", "finance-name", { placeholder: "Label" })}
        ${editableText(item, "note", "finance-note", { hideWhenEmpty: true, placeholder: "Note" })}
        ${isInsurance ? policyContractReadout(item, data, value) : annuityContractReadout(item, data, value)}
      </div>
    `;
  }

  return `
    <div class="item-surface finance-surface">
      ${editableText(item, "subtitle", "finance-type", { hideWhenEmpty: true, placeholder: "Subtitle" })}
      ${editableText(item, "label", "finance-name", { placeholder: "Label" })}
      ${editableText(item, "note", "finance-note", { hideWhenEmpty: true, placeholder: "Note" })}
      ${editableFinanceValue(item, value)}
      ${subBucketStack}
      ${productMetaGrid}
      <div class="fill-track" aria-hidden="true"><span></span></div>
      <span class="delta${deltaClass}${showDelta ? " is-visible" : ""}">${deltaText}</span>
    </div>
  `;
}

export function renderResizeHandles() {
  return `
    <button class="resize-handle nw" type="button" data-resize="nw" aria-label="Resize northwest"></button>
    <button class="resize-handle ne" type="button" data-resize="ne" aria-label="Resize northeast"></button>
    <button class="resize-handle sw" type="button" data-resize="sw" aria-label="Resize southwest"></button>
    <button class="resize-handle se" type="button" data-resize="se" aria-label="Resize southeast"></button>
  `;
}

export function renderConnectors() {
  dom.connectorLayer.querySelectorAll(".connector-draw, .connector-hit").forEach((node) => node.remove());
  dom.handleLayer.innerHTML = "";
  dom.labelLayer.innerHTML = "";

  withConnectorScoringCache(() => state.connectors.forEach((conn) => {
    if (conn.visible === false) return;
    const computed = computeConnectorPath(conn);
    const width = computeConnectorWidth(conn.amount, conn.widthMode || "amount", conn.customWidth);
    const color = getConnectorColor(conn);
    const selected = state.selection?.kind === "connector" && state.selection.id === conn.id;
    const meetingFocus = meetingFocusMatches("connector", conn.id);
    const motionEnabled = connectorMotionEnabled(conn);
    const hot = motionEnabled && state.hotConnectorIds.has(conn.id);
    const presentationRole = classToken(conn.presentationRole || "primary", "primary");
    const classes = [
      "connector-draw",
      selected ? "is-selected" : "",
      meetingFocus ? "is-meeting-focus" : "",
      hot ? "is-hot" : "",
      `presentation-${presentationRole}`,
      `route-${classToken(conn.routeStyle || "smartArc", "smartArc")}`,
      `stroke-${classToken(conn.strokeStyle || "solid", "solid")}`
    ].filter(Boolean).join(" ");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", computed.d);
    path.setAttribute("class", classes);
    path.dataset.connectorId = conn.id;
    path.dataset.presentationRole = presentationRole;
    path.dataset.motionEnabled = motionEnabled ? "true" : "false";
    path.style.setProperty("--flow-color", color);
    path.style.setProperty("--flow-width", `${selected ? width + 0.5 : width}px`);
    const startMarker = markerUrl(conn.arrowStart || "none");
    const endMarker = markerUrl(conn.arrowEnd || "arrow");
    if (startMarker) path.setAttribute("marker-start", startMarker);
    if (endMarker) path.setAttribute("marker-end", endMarker);
    dom.connectorLayer.appendChild(path);
    if (hot && (conn.strokeStyle || "solid") === "solid") {
      path.style.setProperty("--flow-draw-length", `${Math.max(1, path.getTotalLength())}px`);
    }

    const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hit.setAttribute("d", computed.d);
    hit.setAttribute("class", `connector-hit${selected ? " is-selected" : ""}`);
    hit.dataset.connectorId = conn.id;
    hit.dataset.presentationRole = presentationRole;
    hit.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.getSelection?.()?.removeAllRanges?.();
      if (state.selection?.kind === "connector" && state.selection.id === conn.id) connectorLabelHandlers.startConnectorBodyDrag(event, conn);
      else connectorLabelHandlers.selectConnector(conn.id);
    });
    dom.connectorLayer.appendChild(hit);

    if (selected) renderConnectorHandles(conn, computed, color);

    if (!computed.label.hidden) {
      const label = document.createElement("div");
      label.setAttribute("role", "button");
      label.tabIndex = 0;
      label.className = `connector-label presentation-${presentationRole} ${selected ? "is-selected" : ""} ${meetingFocus ? "is-meeting-focus" : ""} ${hot ? "is-hot" : ""}`;
      label.dataset.geometrySurface = "connector-label";
      label.dataset.connectorId = conn.id;
      label.dataset.presentationRole = presentationRole;
      label.dataset.motionEnabled = motionEnabled ? "true" : "false";
      label.dataset.labelMode = conn.labelMode || "auto";
      label.dataset.labelRepaired = connectorLabelRepaired(conn, computed);
      label.dataset.amountSource = connectorAmountSource(conn);
      label.style.left = `${clamp(cssNumber(computed.label.x, 45), 45, WORLD.width - 45)}px`;
      label.style.top = `${clamp(cssNumber(computed.label.y, 45), 45, WORLD.height - 45)}px`;
      label.style.setProperty("--flow-color", color);
      label.dataset.amountUnit = connectorUsesMonthlyDisplay(conn) ? "monthly" : "event";
      const amountEditing = editingTargetMatches("connector", "amount", { id: conn.id });
      const relationshipEditing = editingTargetMatches("connector", "relationship", { id: conn.id });
      const amountText = amountEditing ? plainMoneyInput(connectorEditorAmount(conn)) : connectorAmountText(conn);
      const sourceBadge = connectorHasManualAmount(conn) ? `<small class="connector-source-badge">Manual</small>` : "";
      label.innerHTML = `<strong class="amount editable-text editable-money" data-geometry-surface="text" ${editableAttrs("connector", "amount", { connectorId: conn.id }, amountEditing)}>${escapeHtml(amountText)}</strong><span class="relationship editable-text" data-geometry-surface="text" ${editableAttrs("connector", "relationship", { connectorId: conn.id }, relationshipEditing)}>${escapeHtml(conn.label)}</span>${sourceBadge}`;
      label.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.getSelection?.()?.removeAllRanges?.();
        const editField = event.target.closest("[data-edit-kind='connector']")?.dataset.editField || "relationship";
        connectorLabelHandlers.startConnectorLabelMaybeDrag(event, conn, editField);
      });
      label.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      dom.labelLayer.appendChild(label);
    }
  }));
}


// === SURGICAL ===
export function updateItemValues() {
  const viewModel = computeCanvasViewModel();
  const cashflow = viewModel.cashflow;
  dom.itemLayer.querySelectorAll(".paycheck-surface, .tax-reserve-tradeoff-surface").forEach((node) => {
    const itemId = node.closest("[data-item-id]")?.dataset.itemId;
    const item = itemId ? getItem(itemId) : null;
    if (isRothTaxReserveTradeoff(item)) {
      node.dataset.state = "tradeoff";
      node.innerHTML = rothTaxReserveTradeoffHtml(item);
      return;
    }

    const itemCashflow = viewModel.cashflowByItemId?.[itemId] || cashflow;
    const canvasState = item ? getCanvasState(item, state.financeData, itemCashflow) : "neutral";
    node.dataset.state = classToken(canvasState, "neutral");
    const need = node.querySelector('[data-cashflow-value="need"]');
    const mapped = node.querySelector('[data-cashflow-value="mapped"]');
    const gapLabel = node.querySelector('[data-cashflow-value="gap-label"]');
    const gap = node.querySelector('[data-cashflow-value="gap"]');
    const needIsBeingEdited = state.editingItemId === itemId && document.activeElement?.dataset?.editField === "scenarioMonthlyNeed";
    if (need && !needIsBeingEdited) {
      const input = need.querySelector(".paycheck-amount-input");
      if (input) input.textContent = currency.format(itemCashflow.need);
      else need.innerHTML = `<span class="paycheck-amount-input editable-text editable-money" data-edit-field="scenarioMonthlyNeed">${currency.format(itemCashflow.need)}</span><span class="paycheck-amount-suffix">/mo</span>`;
    }
    if (mapped) mapped.textContent = currency.format(itemCashflow.mapped);
    if (gapLabel) gapLabel.textContent = itemCashflow.gap >= 0 ? "Surplus" : "Gap";
    if (gap) gap.textContent = currency.format(Math.abs(itemCashflow.gap));
  });

  dom.hudLayer.querySelectorAll('[data-input="scenario-monthly-need"]').forEach((monthlyNeedInput) => {
    if (document.activeElement !== monthlyNeedInput) monthlyNeedInput.value = formatMoneyInput(state.scenario.monthlyNeed || 0);
  });
  const monthlyNeedRange = dom.hudLayer.querySelector('[data-input="scenario-monthly-need-range"]');
  if (monthlyNeedRange) monthlyNeedRange.value = Number(state.scenario.monthlyNeed) || 0;
  const monthlyNeedRangeValue = monthlyNeedRange?.parentElement?.querySelector(".range-value");
  if (monthlyNeedRangeValue) monthlyNeedRangeValue.textContent = currency.format(state.scenario.monthlyNeed || 0);
  const mappedMonthly = dom.hudLayer.querySelector('[data-popover-readout="mapped-monthly"]');
  if (mappedMonthly) mappedMonthly.textContent = currency.format(cashflow.mapped);

  for (const item of state.items) {
    if (!item.financeId) continue;
    const itemSelectorId = cssIdent(item.id);
    const node = dom.itemLayer.querySelector(`[data-item-id="${itemSelectorId}"]`);
    if (!node) continue;

    const value = viewModel.financeValues[item.financeId] ?? state.currentValues[item.financeId] ?? state.financeData[item.financeId]?.value ?? 0;
    const previous = state.previousValues[item.financeId] ?? value;
    const delta = value - previous;

    const financeData = state.financeData[item.financeId] || {};
    const roleBefore = node.dataset.productRole || "";
    const surfaceBefore = node.dataset.surface || "";
    const roleAfter = productRoleToken(item, financeData);
    const surfaceAfter = surfaceToken(item, financeData);
    if (roleBefore !== roleAfter || surfaceBefore !== surfaceAfter) {
      node.outerHTML = renderItem(item);
      continue;
    }

    syncProductRole(node, item, financeData);
    syncSurface(node, item, financeData);
    node.style.setProperty("--fill", cssPercent(fillPercent(item)));
    node.classList.toggle("is-hot", state.hotItemIds.has(item.id));
    const financeItemState = financeState(item);
    if (financeItemState) node.dataset.state = classToken(financeItemState);
    else node.removeAttribute("data-state");

    const valueEl = node.querySelector(".finance-value");
    const valueIsBeingEdited = state.editingItemId === item.id && valueEl?.isContentEditable && document.activeElement === valueEl;
    if (valueEl && !valueIsBeingEdited) {
      valueEl.textContent = compactDollars(value);
      applyShortfallState(valueEl, value);
    }

    const deltaEl = node.querySelector(".delta");
    if (deltaEl) {
      deltaEl.textContent = `${delta > 0 ? "+" : ""}${compactDollars(delta)}`;
      deltaEl.classList.toggle("is-negative", delta < 0);
      deltaEl.classList.toggle("is-visible", state.hotItemIds.has(item.id) && Math.abs(delta) > 0);
    }

    const readout = document.querySelector(`[data-popover-readout="after-flows"][data-item-id="${itemSelectorId}"]`);
    if (readout) {
      readout.textContent = compactDollars(value);
      applyShortfallState(readout, value);
    }
    // Re-derive the "$X start - $Y out" caption so a value edit updates it live.
    const breakdownEl = document.querySelector(`.flow-breakdown[data-item-id="${itemSelectorId}"]`);
    if (breakdownEl) {
      const breakdownText = financeBreakdownText(item);
      breakdownEl.textContent = breakdownText;
      breakdownEl.toggleAttribute("hidden", !breakdownText);
    }
    if (state.selection?.kind === "item" && state.selection.id === item.id) {
      const quickValueInput = dom.hudLayer.querySelector('.selection-inspector input[data-input="finance-value"]');
      const dataValue = Number(state.financeData[item.financeId]?.value) || 0;
      if (quickValueInput && document.activeElement !== quickValueInput) quickValueInput.value = formatMoneyInput(dataValue);
    }
  }

  renderInventory();
}

function updateConnectorValueChrome(conn) {
  const selected = state.selection?.kind === "connector" && state.selection.id === conn.id;
  const width = computeConnectorWidth(conn.amount, conn.widthMode || "amount", conn.customWidth);
  const connectorSelectorId = cssIdent(conn.id);
  const color = getConnectorColor(conn);
  const motionEnabled = connectorMotionEnabled(conn);
  const hot = motionEnabled && state.hotConnectorIds.has(conn.id);

  const draw = dom.connectorLayer.querySelector(`path.connector-draw[data-connector-id="${connectorSelectorId}"]`);
  if (draw) {
    draw.style.setProperty("--flow-color", color);
    draw.style.setProperty("--flow-width", `${selected ? width + 0.5 : width}px`);
    draw.dataset.motionEnabled = motionEnabled ? "true" : "false";
    draw.classList.toggle("is-hot", hot);
    if (hot && (conn.strokeStyle || "solid") === "solid") {
      draw.style.setProperty("--flow-draw-length", `${Math.max(1, draw.getTotalLength())}px`);
    } else {
      draw.style.removeProperty("--flow-draw-length");
    }
  }

  const hit = dom.connectorLayer.querySelector(`path.connector-hit[data-connector-id="${connectorSelectorId}"]`);
  if (hit) hit.classList.toggle("is-selected", selected);

  const label = dom.labelLayer.querySelector(`.connector-label[data-connector-id="${connectorSelectorId}"]`);
  if (label) {
    const amountEditing = editingTargetMatches("connector", "amount", { id: conn.id }) && document.activeElement?.classList?.contains("amount");
    const relationshipEditing = editingTargetMatches("connector", "relationship", { id: conn.id }) && document.activeElement?.classList?.contains("relationship");
    label.dataset.motionEnabled = motionEnabled ? "true" : "false";
    label.classList.toggle("is-hot", hot);
    label.style.setProperty("--flow-color", color);
    label.dataset.amountUnit = connectorUsesMonthlyDisplay(conn) ? "monthly" : "event";
    label.dataset.amountSource = connectorAmountSource(conn);
    label.dataset.labelMode = conn.labelMode || "auto";
    const strong = label.querySelector("strong");
    const span = label.querySelector("span");
    if (strong && !amountEditing) strong.textContent = connectorAmountText(conn);
    if (span && !relationshipEditing) span.textContent = conn.label;
    const existingBadge = label.querySelector(".connector-source-badge");
    if (connectorHasManualAmount(conn) && !existingBadge) {
      label.insertAdjacentHTML("beforeend", `<small class="connector-source-badge">Manual</small>`);
    }
    if (!connectorHasManualAmount(conn) && existingBadge) existingBadge.remove();
  }

  if (selected) {
    syncConnectorSourceStatus(dom.hudLayer, conn);
    const amountInput = dom.hudLayer.querySelector('.selection-inspector input[data-input="connector-amount"]');
    if (amountInput && document.activeElement !== amountInput) amountInput.value = formatMoneyInput(connectorEditorAmount(conn));
    const amountRange = dom.hudLayer.querySelector('[data-input="connector-amount-range"]');
    if (amountRange && document.activeElement !== amountRange) amountRange.value = Math.round(connectorEditorAmount(conn));
    const amountRangeValue = amountRange?.parentElement?.querySelector(".range-value");
    if (amountRangeValue) amountRangeValue.textContent = connectorAmountText(conn);
    const widthRange = dom.hudLayer.querySelector('[data-input="connector-custom-width"]');
    if (widthRange && document.activeElement !== widthRange) widthRange.value = conn.customWidth || 5;
    const widthRangeValue = widthRange?.parentElement?.querySelector(".range-value");
    if (widthRangeValue) widthRangeValue.textContent = Number(conn.customWidth || 5).toFixed(1);
  }
}

export function updateConnectorValues(options = {}) {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const connectorScope = connectorScopeFromOptions(options);
  const connectorsToUpdate = connectorsForScope(connectorScope);
  const liveDrag = isLiveDragInteraction();

  if (liveDrag) {
    if (connectorScope == null) state.inputDiagnostics.fullConnectorPassesDuringDrag += 1;
    else {
      state.inputDiagnostics.impactedConnectorCount = connectorScope.length;
      state.inputDiagnostics.impactedConnectorIdsDuringDrag = [...connectorScope];
      state.inputDiagnostics.updatedConnectorIdsDuringDrag = [...connectorScope];
    }
  }

  if (options.finalReconcile) {
    state.inputDiagnostics.finalConnectorPassesAfterDrop += 1;
  }

  if (options.geometry === false) {
    renderDiagnostics.connectorValuePasses += 1;
    connectorsToUpdate.forEach(updateConnectorValueChrome);
    renderDiagnostics.lastConnectorUpdateMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
    return;
  }

  renderDiagnostics.connectorGeometryPasses += 1;
  withConnectorScoringCache(() => {
    for (const conn of connectorsToUpdate) {
      renderDiagnostics.connectorPathComputes += 1;
      if (liveDrag) state.inputDiagnostics.connectorPathComputesDuringDrag += 1;
      const computed = liveDrag && options.preview !== false ? computeConnectorPreviewPath(conn) : computeConnectorPath(conn);
      const selected = state.selection?.kind === "connector" && state.selection.id === conn.id;
      const width = computeConnectorWidth(conn.amount, conn.widthMode || "amount", conn.customWidth);
      const connectorSelectorId = cssIdent(conn.id);

      const draw = dom.connectorLayer.querySelector(`path.connector-draw[data-connector-id="${connectorSelectorId}"]`);
      const hit = dom.connectorLayer.querySelector(`path.connector-hit[data-connector-id="${connectorSelectorId}"]`);
      if (draw) {
        draw.setAttribute("d", computed.d);
        draw.style.setProperty("--flow-color", getConnectorColor(conn));
        draw.style.setProperty("--flow-width", `${selected ? width + 0.5 : width}px`);
        const motionEnabled = connectorMotionEnabled(conn);
        const hot = motionEnabled && state.hotConnectorIds.has(conn.id);
        draw.dataset.motionEnabled = motionEnabled ? "true" : "false";
        draw.classList.toggle("is-hot", hot);
        if (hot && (conn.strokeStyle || "solid") === "solid") {
          draw.style.setProperty("--flow-draw-length", `${Math.max(1, draw.getTotalLength())}px`);
        } else {
          draw.style.removeProperty("--flow-draw-length");
        }
      }
      if (hit) hit.setAttribute("d", computed.d);
      if (hit) hit.classList.toggle("is-selected", selected);

      const label = dom.labelLayer.querySelector(`.connector-label[data-connector-id="${connectorSelectorId}"]`);
      if (label && !computed.label.hidden) {
        const amountEditing = editingTargetMatches("connector", "amount", { id: conn.id }) && document.activeElement?.classList?.contains("amount");
        const relationshipEditing = editingTargetMatches("connector", "relationship", { id: conn.id }) && document.activeElement?.classList?.contains("relationship");
        const motionEnabled = connectorMotionEnabled(conn);
        const hot = motionEnabled && state.hotConnectorIds.has(conn.id);
        label.dataset.motionEnabled = motionEnabled ? "true" : "false";
        label.classList.toggle("is-hot", hot);
        label.dataset.geometrySurface = "connector-label";
        label.style.left = `${clamp(cssNumber(computed.label.x, 45), 45, WORLD.width - 45)}px`;
        label.style.top = `${clamp(cssNumber(computed.label.y, 45), 45, WORLD.height - 45)}px`;
        label.style.setProperty("--flow-color", getConnectorColor(conn));
        label.dataset.amountUnit = connectorUsesMonthlyDisplay(conn) ? "monthly" : "event";
        label.dataset.amountSource = connectorAmountSource(conn);
        label.dataset.labelMode = conn.labelMode || "auto";
        label.dataset.labelRepaired = connectorLabelRepaired(conn, computed);
        const strong = label.querySelector("strong");
        const span = label.querySelector("span");
        if (strong && !amountEditing) strong.textContent = connectorAmountText(conn);
        if (span && !relationshipEditing) span.textContent = conn.label;
        const existingBadge = label.querySelector(".connector-source-badge");
        if (connectorHasManualAmount(conn) && !existingBadge) {
          label.insertAdjacentHTML("beforeend", `<small class="connector-source-badge">Manual</small>`);
        }
        if (!connectorHasManualAmount(conn) && existingBadge) existingBadge.remove();
      }

      if (selected) {
        syncConnectorSourceStatus(dom.hudLayer, conn);
        const amountInput = dom.hudLayer.querySelector('.selection-inspector input[data-input="connector-amount"]');
        if (amountInput && document.activeElement !== amountInput) amountInput.value = formatMoneyInput(connectorEditorAmount(conn));
        const amountRange = dom.hudLayer.querySelector('[data-input="connector-amount-range"]');
        if (amountRange && document.activeElement !== amountRange) amountRange.value = Math.round(connectorEditorAmount(conn));
        const amountRangeValue = amountRange?.parentElement?.querySelector(".range-value");
        if (amountRangeValue) amountRangeValue.textContent = connectorAmountText(conn);
      }

      const handlePoints = {
        source: computed.source,
        target: computed.target,
        bend: computed.control,
        label: computed.label
      };
      dom.handleLayer.querySelectorAll(`.connector-handle[data-connector-id="${connectorSelectorId}"]`).forEach((handle) => {
        const point = handlePoints[handle.dataset.connectorRole];
        if (!point || point.hidden) return;
        if (handle.tagName?.toLowerCase() === "circle") {
          handle.setAttribute("cx", point.x);
          handle.setAttribute("cy", point.y);
        } else {
          handle.setAttribute("transform", `translate(${point.x} ${point.y})`);
        }
      });
    }
  });
  renderDiagnostics.lastConnectorUpdateMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
}

// === HUD / SURFACES ===

export function renderConnectorHandles(conn, computed, color) {
  const handles = [
    { role: "source", point: computed.source, r: 12 },
    { role: "target", point: computed.target, r: 12 }
  ];
  if ((conn.routeStyle || "smartArc") !== "straight") {
    handles.push({ role: "bend", point: computed.control, r: 12 });
  }
  if (!computed.label.hidden) {
    handles.push({ role: "label", point: computed.label, r: 10 });
  }

  handles.forEach((handle) => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const endpoint = handle.role === "source" || handle.role === "target";
    group.setAttribute("transform", `translate(${handle.point.x} ${handle.point.y})`);
    group.setAttribute("class", `connector-handle ${handle.role} ${endpoint ? "endpoint" : ""}`.trim());
    group.style.setProperty("--flow-color", color);
    group.dataset.connectorId = conn.id;
    group.dataset.connectorRole = handle.role;
    group.addEventListener("pointerdown", (event) => connectorLabelHandlers.startConnectorDrag(event, conn, handle.role));

    if (endpoint) {
      const pin = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      pin.setAttribute("class", "connector-handle-pin");
      pin.setAttribute("x", "-7");
      pin.setAttribute("y", "-7");
      pin.setAttribute("width", "14");
      pin.setAttribute("height", "14");
      pin.setAttribute("rx", "3");
      pin.setAttribute("transform", "rotate(45)");
      group.appendChild(pin);

      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("class", "connector-handle-dot");
      dot.setAttribute("r", "3");
      group.appendChild(dot);
    } else if (handle.role === "bend") {
      const bend = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bend.setAttribute("class", "connector-handle-bend");
      bend.setAttribute("x", "-8");
      bend.setAttribute("y", "-8");
      bend.setAttribute("width", "16");
      bend.setAttribute("height", "16");
      bend.setAttribute("rx", "3");
      bend.setAttribute("transform", "rotate(45)");
      group.appendChild(bend);

      const knot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      knot.setAttribute("class", "connector-handle-knot");
      knot.setAttribute("r", "3");
      group.appendChild(knot);
    } else {
      const tab = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      tab.setAttribute("class", "connector-handle-label-tab");
      tab.setAttribute("x", "-14");
      tab.setAttribute("y", "-8");
      tab.setAttribute("width", "28");
      tab.setAttribute("height", "16");
      tab.setAttribute("rx", "8");
      group.appendChild(tab);

      [-4, 2].forEach((y) => {
        const mark = document.createElementNS("http://www.w3.org/2000/svg", "line");
        mark.setAttribute("class", "connector-handle-label-mark");
        mark.setAttribute("x1", "-7");
        mark.setAttribute("x2", "7");
        mark.setAttribute("y1", String(y));
        mark.setAttribute("y2", String(y));
        group.appendChild(mark);
      });
    }

    dom.handleLayer.appendChild(group);
  });
}

export function restoreHudScroll(key = selectionKey()) {
  if (!key || state.hudScrollTops[key] == null) return;
  requestAnimationFrame(() => {
    const hud = dom.hudLayer.querySelector(".context-hud");
    if (!hud) return;
    const maxScroll = Math.max(0, hud.scrollHeight - hud.clientHeight);
    hud.scrollTop = clamp(state.hudScrollTops[key], 0, maxScroll);
  });
}

export function nodeScreenBounds(node) {
  const center = screenPoint(node);
  const width = node.w * state.viewport.zoom;
  const height = node.h * state.viewport.zoom;
  return {
    left: center.x - width / 2,
    right: center.x + width / 2,
    top: center.y - height / 2,
    bottom: center.y + height / 2,
    width,
    height,
    center
  };
}

export function relativeRect(domRect) {
  const parent = dom.workspace.getBoundingClientRect();
  return {
    left: domRect.left - parent.left,
    right: domRect.right - parent.left,
    top: domRect.top - parent.top,
    bottom: domRect.bottom - parent.top,
    width: domRect.width,
    height: domRect.height
  };
}

function sleeveScreenBounds(selection = state.selection) {
  if (selection?.kind !== "sleeve") return null;
  const selector = `.sub-bucket-card[data-item-id="${cssIdent(selection.itemId)}"][data-sub-bucket-id="${cssIdent(selection.sleeveId)}"]`;
  const node = dom.itemLayer?.querySelector(selector);
  if (node) {
    const rect = relativeRect(node.getBoundingClientRect());
    return {
      ...rect,
      center: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
    };
  }
  const item = getItem(selection.itemId);
  return item ? nodeScreenBounds(item) : null;
}

export function scenarioRailRect() {
  if (!dom.scenarioRail || document.body.classList.contains("presentation")) return null;
  const rect = dom.scenarioRail.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return relativeRect(rect);
}

export function rectsOverlap(a, b, pad = 0) {
  if (!a || !b) return false;
  return !(a.right + pad < b.left || a.left - pad > b.right || a.bottom + pad < b.top || a.top - pad > b.bottom);
}

export function avoidScenarioRail(layout) {
  const rail = scenarioRailRect();
  const workspaceRect = dom.workspace.getBoundingClientRect();
  let next = { ...layout };
  if (rail && rectsOverlap(next, rail, 10)) {
    const leftX = rail.left - next.width - 14;
    if (leftX >= 82) next.left = leftX;
    else next.top = Math.max(12, rail.top - next.height - 14);
  }
  next.left = clamp(next.left, 12, workspaceRect.width - next.width - 12);
  next.top = clamp(next.top, 12, workspaceRect.height - next.height - 12);
  next.right = next.left + next.width;
  next.bottom = next.top + next.height;
  return next;
}

function screenLayout(left, top, width, height) {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function clampScreenLayout(layout) {
  const workspaceRect = dom.workspace.getBoundingClientRect();
  const left = clamp(layout.left, 12, workspaceRect.width - layout.width - 12);
  const top = clamp(layout.top, 12, workspaceRect.height - layout.height - 12);
  return screenLayout(left, top, layout.width, layout.height);
}

function rectOverlapArea(a, b, pad = 0) {
  if (!a || !b) return 0;
  const left = Math.max(a.left - pad, b.left);
  const right = Math.min(a.right + pad, b.right);
  const top = Math.max(a.top - pad, b.top);
  const bottom = Math.min(a.bottom + pad, b.bottom);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function overlapScore(layout, blockedRects) {
  return blockedRects.reduce((sum, rect) => sum + rectOverlapArea(layout, rect, 4) * (rect.weight || 1), 0);
}

function expandedRect(rect, pad = 8, weight = 1) {
  return {
    left: rect.left - pad,
    right: rect.right + pad,
    top: rect.top - pad,
    bottom: rect.bottom + pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    center: rect.center,
    weight
  };
}

function connectorLabelScreenRect(conn, pad = 8) {
  const computed = computeConnectorPath(conn);
  if (computed.label.hidden) return null;
  const point = screenPoint(computed.label);
  const labelWidth = Math.max(94, String(conn.label || "").length * 6.2 + 26, String(connectorAmountText(conn)).length * 8 + 22);
  const width = clamp(labelWidth, 104, 240);
  const height = 40;
  return expandedRect(screenLayout(point.x - width / 2, point.y - height / 2, width, height), pad);
}

function connectorHandleScreenRects(conn, pad = 14) {
  const computed = computeConnectorPath(conn);
  const handles = [computed.source, computed.target];
  if ((conn.routeStyle || "smartArc") !== "straight") handles.push(computed.control);
  if (!computed.label.hidden) handles.push(computed.label);
  return handles.map((point) => {
    const screen = screenPoint(point);
    return expandedRect(screenLayout(screen.x - 18, screen.y - 18, 36, 36), pad, 10);
  });
}

function selectedBlockedRects(options = {}) {
  const includeCanvas = Boolean(options.includeCanvas);
  const includeDecorative = Boolean(options.includeDecorative);
  const rects = [];
  const pushNode = (node, pad = 8, weight = 1) => {
    if (node) rects.push(expandedRect(nodeScreenBounds(node), pad, weight));
  };

  if (includeCanvas) {
    state.items
      .filter((item) => includeDecorative || item.type === "finance")
      .forEach((item) => pushNode(item, 6, state.selection?.id === item.id ? 8 : 1));
    state.groups.forEach((group) => pushNode(group, 6, state.selection?.id === group.id ? 8 : 1));
    state.connectors.forEach((conn) => {
      const labelRect = connectorLabelScreenRect(conn, 8);
      if (labelRect) rects.push({ ...labelRect, weight: state.selection?.kind === "connector" && state.selection.id === conn.id ? 8 : 4 });
    });
  } else if (hasMultiSelection()) {
    selectedItemIds().map((id) => getItem(id)).filter(Boolean).forEach((item) => pushNode(item, 8, 8));
  } else if (state.selection?.kind === "item") pushNode(getItem(state.selection.id), 8, 8);
  else if (state.selection?.kind === "group") pushNode(getGroup(state.selection.id), 8, 8);

  if (state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    const labelRect = conn ? connectorLabelScreenRect(conn, 10) : null;
    if (labelRect) rects.push(labelRect);
    if (conn) rects.push(...connectorHandleScreenRects(conn, 12));
  }

  return rects;
}

function avoidBlockedRects(layout, blockedRects, margin = 10, options = {}) {
  const workspaceRect = dom.workspace.getBoundingClientRect();
  const base = clampScreenLayout(layout);
  if (!blockedRects.length || overlapScore(base, blockedRects) === 0) return avoidScenarioRail(base);

  const candidates = [base];
  blockedRects.forEach((blocked) => {
    candidates.push(
      screenLayout(base.left, blocked.top - base.height - margin, base.width, base.height),
      screenLayout(base.left, blocked.bottom + margin, base.width, base.height),
      screenLayout(blocked.left - base.width - margin, base.top, base.width, base.height),
      screenLayout(blocked.right + margin, base.top, base.width, base.height),
      screenLayout(blocked.left, blocked.top - base.height - margin, base.width, base.height),
      screenLayout(blocked.right - base.width, blocked.bottom + margin, base.width, base.height)
    );
  });
  candidates.push(
    screenLayout(base.left, 12, base.width, base.height),
    screenLayout(82, 12, base.width, base.height),
    screenLayout(workspaceRect.width - base.width - 12, 12, base.width, base.height)
  );

  if (blockedRects.length) {
    const minX = 12;
    const maxX = Math.max(minX, workspaceRect.width - base.width - 12);
    const minY = 12;
    const maxY = Math.max(minY, workspaceRect.height - base.height - 12);
    const stepX = Math.max(44, Math.round(base.width / 3));
    const stepY = Math.max(38, Math.round(base.height / 4));
    for (let left = minX; left <= maxX; left += stepX) {
      for (let top = minY; top <= maxY; top += stepY) {
        candidates.push(screenLayout(left, top, base.width, base.height));
      }
    }
    candidates.push(
      screenLayout(maxX, minY, base.width, base.height),
      screenLayout(maxX, maxY, base.width, base.height),
      screenLayout(minX, maxY, base.width, base.height)
    );
  }

  return candidates
    .map(clampScreenLayout)
    .map((candidate) => avoidScenarioRail(candidate))
    .map((candidate) => ({
      candidate,
      overlap: overlapScore(candidate, blockedRects),
      distance: Math.hypot(candidate.left - base.left, candidate.top - base.top) + (options.preferAbove && candidate.top > base.top ? 500 : 0)
    }))
    .sort((a, b) => a.overlap - b.overlap || a.distance - b.distance)[0].candidate;
}

export function floatingChromeKey(kind = "toolbar", detail = "") {
  const key = selectionKey();
  if (!key) return "";
  return `${key}:${kind}${detail ? `:${detail}` : ""}`;
}

function savedFloatingLayout(kind, width, height, detail = "") {
  const key = floatingChromeKey(kind, detail);
  const saved = key ? state.floatingLayouts[key] : null;
  if (!saved) return null;
  const clamped = clampScreenLayout(screenLayout(saved.x, saved.y, width, height));
  return { x: clamped.left, y: clamped.top, w: width, h: height };
}

export function toolbarWidthForSelection() {
  if (hasMultiSelection()) return 386;
  if (state.selection?.kind === "connector") return 392;
  if (state.selection?.kind === "sleeve") return 224;
  if (state.selection?.kind === "item") {
    const item = getItem(state.selection.id);
    if (item?.type === "finance") return 320;
    return 286;
  }
  return 300;
}

export function toolbarLayoutForSelection(width = toolbarWidthForSelection(), height = 34) {
  const saved = savedFloatingLayout("toolbar", width, height);
  if (saved) {
    const adjusted = avoidBlockedRects(screenLayout(saved.x, saved.y, width, height), selectedBlockedRects({ includeCanvas: true }), 12);
    return { x: adjusted.left, y: adjusted.top, w: width, h: height };
  }

  const rect = dom.workspace.getBoundingClientRect();
  let anchor = { x: rect.width / 2, y: 96 };
  let bounds = null;

  if (hasMultiSelection()) {
    const itemBounds = selectedItemIds().map((id) => getItem(id)).filter(Boolean).map(nodeScreenBounds);
    if (itemBounds.length) {
      const left = Math.min(...itemBounds.map((entry) => entry.left));
      const right = Math.max(...itemBounds.map((entry) => entry.right));
      const top = Math.min(...itemBounds.map((entry) => entry.top));
      const bottom = Math.max(...itemBounds.map((entry) => entry.bottom));
      bounds = {
        left,
        right,
        top,
        bottom,
        width: right - left,
        height: bottom - top,
        center: { x: (left + right) / 2, y: (top + bottom) / 2 }
      };
    }
  } else if (state.selection?.kind === "item") bounds = nodeScreenBounds(getItem(state.selection.id) || { x: WORLD.width / 2, y: WORLD.height / 2, w: 1, h: 1 });
  if (state.selection?.kind === "sleeve") bounds = sleeveScreenBounds();
  if (state.selection?.kind === "group") bounds = nodeScreenBounds(getGroup(state.selection.id) || { x: WORLD.width / 2, y: WORLD.height / 2, w: 1, h: 1 });
  if (state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    if (conn) {
      const computed = computeConnectorPath(conn);
      const labelPoint = screenPoint(computed.label.hidden ? computed.control : computed.label);
      const points = [computed.source, computed.target, computed.control].map(screenPoint);
      const minY = Math.min(...points.map((point) => point.y), labelPoint.y);
      const maxY = Math.max(...points.map((point) => point.y), labelPoint.y);
      anchor = {
        x: labelPoint.x,
        y: labelPoint.y > height + 56 ? labelPoint.y - 28 : maxY + height + 18
      };
    }
  }

  if (bounds) anchor = { x: bounds.center.x, y: bounds.top - 24 };

  const x = clamp(anchor.x - width / 2, 82, rect.width - width - 12);
  let y = clamp(anchor.y - height, 12, rect.height - height - 12);
  if (bounds && y + height > bounds.top - 6) {
    y = clamp(bounds.bottom + 12, 12, rect.height - height - 12);
  }
  const adjusted = avoidBlockedRects(screenLayout(x, y, width, height), selectedBlockedRects({ includeCanvas: true }), 12);
  return { x: adjusted.left, y: adjusted.top, w: width, h: height };
}

export function hudLayoutForNode(node, defaultWidth = 306, defaultHeight = 360) {
  const key = selectionKey();
  const rect = dom.workspace.getBoundingClientRect();
  const bounds = nodeScreenBounds(node);
  const saved = key ? state.hudLayouts[key] : null;
  const width = clamp(saved?.w || defaultWidth, 260, Math.min(560, rect.width - 36));
  const height = clamp(saved?.h || defaultHeight, 180, Math.min(720, rect.height - 36));
  const rightX = bounds.right + 18;
  const leftX = bounds.left - width - 18;
  const fallbackX = rightX + width <= rect.width - 12 ? rightX : leftX >= 82 ? leftX : bounds.center.x - width / 2;
  const fallbackY = bounds.top;
  const x = clamp(saved?.x ?? fallbackX, 12, rect.width - width - 12);
  const y = clamp(saved?.y ?? fallbackY, 12, rect.height - height - 12);
  return { x, y, w: width, h: height };
}

let hudRangeDragActive = false;
let hudRenderPending = false;

export function setHudRangeDragActive(active) {
  hudRangeDragActive = active;
  if (!active && hudRenderPending) {
    hudRenderPending = false;
    renderHud();
  }
}

export function renderHud() {
  const creationDockActive = ["shapes", "text", "finance", "connectors", "groups"].includes(state.activeDock) && !state.activePopover && !hasMultiSelection();
  const showInspector = Boolean((state.selection || hasMultiSelection()) && !creationDockActive && !document.body.classList.contains("presentation"));
  document.body.classList.toggle("inspector-open", showInspector);

  if (hudRangeDragActive) {
    hudRenderPending = true;
    return;
  }

  if (!state.selection && !hasMultiSelection()) {
    dom.hudLayer.innerHTML = "";
    return;
  }
  if (creationDockActive) {
    dom.hudLayer.innerHTML = "";
    return;
  }

  const inspector = renderSelectionInspector();

  if (hasMultiSelection()) {
    dom.hudLayer.innerHTML = inspector;
    return;
  }

  if (state.selection.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item) {
      dom.hudLayer.innerHTML = "";
      return;
    }
    dom.hudLayer.innerHTML = inspector;
    return;
  }

  if (state.selection.kind === "group") {
    const group = getGroup(state.selection.id);
    if (!group) {
      dom.hudLayer.innerHTML = "";
      return;
    }
    dom.hudLayer.innerHTML = inspector;
    return;
  }

  if (state.selection.kind === "sleeve") {
    if (!findSubBucket(state.selection.itemId, state.selection.sleeveId)) {
      dom.hudLayer.innerHTML = "";
      return;
    }
    dom.hudLayer.innerHTML = inspector;
    return;
  }

  if (state.selection.kind === "connector") {
    const conn = getConnector(state.selection.id);
    if (!conn) {
      dom.hudLayer.innerHTML = "";
      return;
    }
    dom.hudLayer.innerHTML = inspector;
  }
}

export function selectionKey() {
  if (hasMultiSelection()) return `multi:${selectedItemIds().join(",")}`;
  if (state.selection?.kind === "sleeve") return `sleeve:${state.selection.itemId}:${state.selection.sleeveId}`;
  return state.selection ? `${state.selection.kind}:${state.selection.id}` : "";
}

export function hudPositionFor(point, width = 306, height = 360) {
  const screen = screenPoint(point);
  const rect = dom.workspace.getBoundingClientRect();
  return {
    x: clamp(screen.x + 18, 82, rect.width - width - 18),
    y: clamp(screen.y - 70, 14, rect.height - Math.min(height, rect.height - 40))
  };
}

export function hudLayoutFor(point, defaultWidth = 306, defaultHeight = 360) {
  const key = selectionKey();
  const rect = dom.workspace.getBoundingClientRect();
  const fallback = hudPositionFor(point, defaultWidth, defaultHeight);
  const saved = key ? state.hudLayouts[key] : null;
  const width = clamp(saved?.w || defaultWidth, 260, Math.min(560, rect.width - 36));
  const height = clamp(saved?.h || defaultHeight, 180, Math.min(720, rect.height - 36));
  const x = clamp(saved?.x ?? fallback.x, 12, rect.width - width - 12);
  const y = clamp(saved?.y ?? fallback.y, 12, rect.height - height - 12);
  return { x, y, w: width, h: height };
}

export function sectionCollapsed(sectionId, defaultCollapsed = false) {
  const key = selectionKey();
  if (!key) return defaultCollapsed;
  const collapsedState = state.hudCollapsed[key] || {};
  return collapsedState[sectionId] ?? defaultCollapsed;
}

export function renderHudSection(sectionId, title, body, options = {}) {
  const collapsed = sectionCollapsed(sectionId, options.collapsed || false);
  return `
    <section class="hud-section ${collapsed ? "is-collapsed" : ""}" data-section="${sectionId}">
      <button class="hud-section-toggle" type="button" data-action="toggle-section" data-section="${sectionId}" aria-expanded="${!collapsed}">
        <span>${escapeHtml(title)}</span>
        <i aria-hidden="true"></i>
      </button>
      <div class="hud-section-body">${body}</div>
    </section>
  `;
}

export function hudStyle(layout) {
  return `--hud-x:${cssNumber(layout.x)}px;--hud-y:${cssNumber(layout.y)}px;--hud-w:${cssNumber(layout.w)}px;--hud-h:${cssNumber(layout.h)}px`;
}

export function toolbarStyle(layout) {
  return `--toolbar-x:${cssNumber(layout.x)}px;--toolbar-y:${cssNumber(layout.y)}px;--toolbar-w:${cssNumber(layout.w)}px;--toolbar-h:${cssNumber(layout.h)}px`;
}

export function popoverStyle(layout) {
  return `--popover-x:${cssNumber(layout.x)}px;--popover-y:${cssNumber(layout.y)}px;--popover-w:${cssNumber(layout.w)}px;--popover-max-h:${cssNumber(layout.h)}px`;
}

export function popoverLayoutForSelection(width = 286, height = 250) {
  const saved = savedFloatingLayout("popover", width, height, state.activePopover || "");
  if (saved) {
    const adjusted = avoidBlockedRects(screenLayout(saved.x, saved.y, width, height), selectedBlockedRects({ includeCanvas: true }), 12);
    return { x: adjusted.left, y: adjusted.top, w: width, h: height };
  }

  const rect = dom.workspace.getBoundingClientRect();
  const toolbar = toolbarLayoutForSelection();
  let left = toolbar.x;
  let top = toolbar.y + toolbar.h + 8;
  let bounds = null;

  if (state.selection?.kind === "item") bounds = nodeScreenBounds(getItem(state.selection.id) || { x: WORLD.width / 2, y: WORLD.height / 2, w: 1, h: 1 });
  if (state.selection?.kind === "group") bounds = nodeScreenBounds(getGroup(state.selection.id) || { x: WORLD.width / 2, y: WORLD.height / 2, w: 1, h: 1 });
  if (state.selection?.kind === "sleeve") bounds = sleeveScreenBounds();

  if (bounds) {
    const rightX = bounds.right + 18;
    const leftX = bounds.left - width - 18;
    if (rightX + width <= rect.width - 12) left = rightX;
    else if (leftX >= 82) left = leftX;
    else left = clamp(bounds.center.x - width / 2, 82, rect.width - width - 12);
    top = clamp(bounds.top, 12, rect.height - height - 12);
  }

  if (state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    if (conn) {
      const computed = computeConnectorPath(conn);
      const point = screenPoint(computed.label.hidden ? computed.control : computed.label);
      left = clamp(point.x + 18, 82, rect.width - width - 12);
      top = clamp(point.y - height / 2, 12, rect.height - height - 12);
    }
  }

  const adjusted = avoidScenarioRail({ left, top, right: left + width, bottom: top + height, width, height });
  const blocked = selectedBlockedRects({ includeCanvas: true });
  const unblocked = avoidBlockedRects(adjusted, blocked, 12, { preferAbove: true });
  return { x: unblocked.left, y: unblocked.top, w: width, h: height };
}

export function selectedSummary() {
  if (hasMultiSelection()) {
    return {
      title: `${selectedItemIds().length} selected`,
      kicker: "Multi-select",
      canInlineEdit: false,
      editLabel: "Align"
    };
  }
  if (state.selection?.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item) return null;
    return {
      title: item.label || "Selected item",
      kicker: item.type === "finance" ? "Finance" : item.type === "text" ? "Text" : "Shape",
      canInlineEdit: !isLockedNode(item),
      locked: isLockedNode(item),
      editLabel: item.type === "finance" ? "Data" : "Edit"
    };
  }
  if (state.selection?.kind === "group") {
    const group = getGroup(state.selection.id);
    if (!group) return null;
    return { title: group.label || "Selected group", kicker: "Group", canInlineEdit: !isLockedNode(group), locked: isLockedNode(group), editLabel: "Edit" };
  }
  if (state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    if (!conn) return null;
    return { title: conn.label || "Selected connector", kicker: "Flow", canInlineEdit: false, editLabel: "Label" };
  }
  if (state.selection?.kind === "sleeve") {
    const selected = findSubBucket(state.selection.itemId, state.selection.sleeveId);
    if (!selected) return null;
    const label = selected.bucket.label ?? selected.bucket.name ?? selected.bucket.title ?? "Sleeve";
    return { title: label, kicker: "Sleeve", canInlineEdit: false, editLabel: "Data" };
  }
  return null;
}

function toolbarMoneyStep(value, mode = "annual") {
  const amount = Math.abs(Number(value) || 0);
  if (mode === "monthly") return amount >= 15000 ? 1000 : 500;
  if (amount >= 500000) return 25000;
  if (amount >= 100000) return 10000;
  if (amount >= 25000) return 5000;
  return 1000;
}

function toolbarQuickControl() {
  if (hasMultiSelection()) return "";
  if (state.selection?.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item || item.type !== "finance" || isLockedNode(item)) return "";
    const data = item.financeId ? state.financeData[item.financeId] || {} : null;
    if (!data) return "";
    const isPaycheck = item.visual === "paycheck";
    const value = isPaycheck ? Number(state.scenario.monthlyNeed) || 0 : Number(data.value) || 0;
    const input = isPaycheck ? "scenario-monthly-need" : "finance-value";
    const label = isPaycheck ? "Need" : "Value";
    const step = toolbarMoneyStep(value, isPaycheck ? "monthly" : "annual");
    return `
      <label class="toolbar-money-control" title="${escapeHtml(label)}">
        <span>${escapeHtml(label)}</span>
        <button type="button" data-action="quick-adjust" data-delta="${-step}" aria-label="Decrease ${escapeHtml(label)}">-</button>
        <input type="text" value="${escapeHtml(formatMoneyInput(value))}" inputmode="decimal" data-input="${input}" data-money-input="true" aria-label="${escapeHtml(label)}">
        <button type="button" data-action="quick-adjust" data-delta="${step}" aria-label="Increase ${escapeHtml(label)}">+</button>
      </label>
    `;
  }
  if (state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    if (!conn) return "";
    const amount = connectorEditorAmount(conn);
    const amountMode = connectorUsesMonthlyDisplay(conn) ? "monthly" : "annual";
    const step = toolbarMoneyStep(amount, amountMode);
    const title = connectorAmountTitle(conn);
    return `
      <label class="toolbar-money-control is-flow" title="${escapeHtml(title)}">
        <span>${connectorUsesMonthlyDisplay(conn) ? "Monthly" : "Amount"}</span>
        <button type="button" data-action="quick-adjust" data-delta="${-step}" aria-label="Decrease flow amount">-</button>
        <input type="text" value="${escapeHtml(formatMoneyInput(amount))}" inputmode="decimal" data-input="connector-amount" data-money-input="true" aria-label="${escapeHtml(title)}">
        <button type="button" data-action="quick-adjust" data-delta="${step}" aria-label="Increase flow amount">+</button>
      </label>
    `;
  }
  if (state.selection?.kind === "sleeve") {
    const selected = findSubBucket(state.selection.itemId, state.selection.sleeveId);
    if (!selected) return "";
    const value = Number(selected.bucket.value ?? selected.bucket.amount ?? selected.bucket.balance) || 0;
    const step = toolbarMoneyStep(value);
    return `
      <label class="toolbar-money-control" title="Sleeve value">
        <span>Value</span>
        <button type="button" data-action="quick-adjust" data-delta="${-step}" aria-label="Decrease sleeve value">-</button>
        <input type="text" value="${escapeHtml(formatMoneyInput(value))}" inputmode="decimal" data-input="sleeve-value" data-money-input="true" aria-label="Sleeve value">
        <button type="button" data-action="quick-adjust" data-delta="${step}" aria-label="Increase sleeve value">+</button>
      </label>
    `;
  }
  return "";
}

export function toolbarButtonsForSelection(summary) {
  if (hasMultiSelection()) {
    return `
      <button type="button" data-action="align-left" title="Align left" aria-label="Align left">L</button>
      <button type="button" data-action="align-center-x" title="Align center" aria-label="Align center">C</button>
      <button type="button" data-action="align-right" title="Align right" aria-label="Align right">R</button>
      <button type="button" data-action="align-top" title="Align top" aria-label="Align top">T</button>
      <button type="button" data-action="align-middle-y" title="Align middle" aria-label="Align middle">M</button>
      <button type="button" data-action="align-bottom" title="Align bottom" aria-label="Align bottom">B</button>
      <button type="button" data-action="distribute-x" title="Distribute horizontally" aria-label="Distribute horizontally">H</button>
      <button type="button" data-action="distribute-y" title="Distribute vertically" aria-label="Distribute vertically">V</button>
      <button class="is-danger" type="button" data-action="delete" title="Delete" aria-label="Delete">Del</button>
    `;
  }

  if (state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    const endpointAction = conn && isAttachedEndpoint(conn.source) && isAttachedEndpoint(conn.target) ? "detach-connector" : "reattach-connector";
    const endpointLabel = endpointAction === "detach-connector" ? "Detach" : "Reattach";
    return `
      <button type="button" data-popover="connector-data">Data</button>
      <button type="button" data-popover="connector-style">Style</button>
      <button type="button" data-popover="connector-label">Label</button>
      <button type="button" data-action="reverse-connector" title="Reverse flow direction" aria-label="Reverse flow direction">Reverse</button>
      <button type="button" data-action="${endpointAction}" data-connector-id="${attr(conn?.id || "")}">${endpointLabel}</button>
      <button class="is-danger" type="button" data-action="delete" title="Delete" aria-label="Delete">Del</button>
    `;
  }

  if (state.selection?.kind === "sleeve") {
    return `
      <button type="button" data-popover="selection-data">${escapeHtml(summary.editLabel)}</button>
    `;
  }

  if (state.selection?.kind === "item") {
    const item = getItem(state.selection.id);
    if (item?.type === "finance") {
      return `
        <button type="button" data-popover="selection-data">${escapeHtml(summary.editLabel)}</button>
        <button type="button" data-popover="selection-style">Style</button>
        ${summary.locked ? "" : `
          <button type="button" data-action="duplicate" title="Duplicate" aria-label="Duplicate">Dup</button>
          <button class="is-danger" type="button" data-action="delete" title="Delete" aria-label="Delete">Del</button>
        `}
      `;
    }
  }

  return `
    <button type="button" data-popover="selection-data">${escapeHtml(summary.editLabel)}</button>
    <button type="button" data-popover="selection-style">Style</button>
    ${summary.locked ? "" : `
      <button type="button" data-action="duplicate" title="Duplicate" aria-label="Duplicate">Dup</button>
      <button type="button" data-action="bring-forward" title="Bring forward" aria-label="Bring forward">Up</button>
      <button type="button" data-action="send-backward" title="Send backward" aria-label="Send backward">Dn</button>
      <button class="is-danger" type="button" data-action="delete" title="Delete" aria-label="Delete">Del</button>
    `}
  `;
}

export function renderSelectionToolbar() {
  return "";
}

function quickEditorStyle(layout) {
  return `--quick-x:${cssNumber(layout.x)}px;--quick-y:${cssNumber(layout.y)}px;--quick-w:${cssNumber(layout.w)}px;--quick-h:${cssNumber(layout.h)}px`;
}

function quickEditorSizeForSelection() {
  if (state.selection?.kind === "connector") return { width: 336, height: 104 };
  if (state.selection?.kind === "sleeve") return { width: 312, height: 104 };
  if (state.selection?.kind === "group") return { width: 284, height: 76 };
  if (state.selection?.kind === "item") {
    const item = getItem(state.selection.id);
    if (item?.type === "finance") return { width: 336, height: 106 };
    return { width: 316, height: 104 };
  }
  return { width: 300, height: 96 };
}

function quickEditorLayoutForSelection() {
  const { width, height } = quickEditorSizeForSelection();
  const toolbar = toolbarLayoutForSelection();
  const base = screenLayout(toolbar.x, toolbar.y + toolbar.h + 10, width, height);
  const adjusted = avoidBlockedRects(base, selectedBlockedRects({ includeCanvas: true }), 12);
  return { x: adjusted.left, y: adjusted.top, w: width, h: height };
}

function quickEditorField(label, inputHtml) {
  return `
    <label class="quick-edit-field">
      <span>${escapeHtml(label)}</span>
      ${inputHtml}
    </label>
  `;
}

function quickEditorShell(kicker, title, fields) {
  const layout = quickEditorLayoutForSelection();
  return `
    <div class="selection-quick-editor" style="${quickEditorStyle(layout)}" data-quick-editor>
      <div class="quick-edit-head" data-toolbar-drag>
        <span>${escapeHtml(kicker)}</span>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <div class="quick-edit-grid">${fields}</div>
    </div>
  `;
}

export function renderQuickEditor() {
  if (!state.selection || hasMultiSelection() || state.activePopover) return "";

  if (state.selection.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item || isLockedNode(item)) return "";
    const data = item.financeId ? state.financeData[item.financeId] || {} : null;
    const fields = [
      quickEditorField("Name", `<input type="text" value="${escapeHtml(item.label || "")}" data-input="item-label" aria-label="Name">`)
    ];
    if (item.type === "finance" && data) {
      const isPaycheck = item.visual === "paycheck";
      const input = isPaycheck ? "scenario-monthly-need" : "finance-value";
      const value = isPaycheck ? Number(state.scenario.monthlyNeed) || 0 : Number(data.value) || 0;
      fields.push(quickEditorField(
        isPaycheck ? "Monthly need" : "Value",
        `<input type="text" value="${escapeHtml(formatMoneyInput(value))}" inputmode="decimal" data-input="${input}" data-money-input="true" aria-label="${isPaycheck ? "Monthly need" : "Value"}">`
      ));
    } else {
      fields.push(quickEditorField("Detail", `<input type="text" value="${escapeHtml(item.subtitle || item.note || "")}" data-input="${item.type === "text" ? "item-subtitle" : "item-note"}" aria-label="Detail">`));
    }
    return quickEditorShell(item.type === "finance" ? "Finance edit" : item.type === "text" ? "Text edit" : "Shape edit", item.label || "Selected object", fields.join(""));
  }

  if (state.selection.kind === "connector") {
    const conn = getConnector(state.selection.id);
    if (!conn) return "";
    const amount = connectorEditorAmount(conn);
    const fields = [
      quickEditorField("Flow label", `<input type="text" value="${escapeHtml(conn.label || "")}" data-input="connector-label" aria-label="Flow label">`),
      quickEditorField(
        connectorUsesMonthlyDisplay(conn) ? "Monthly" : "Amount",
        `<input type="text" value="${escapeHtml(formatMoneyInput(amount))}" inputmode="decimal" data-input="connector-amount" data-money-input="true" aria-label="${escapeHtml(connectorAmountTitle(conn))}">`
      )
    ];
    return quickEditorShell("Flow edit", conn.label || "Selected flow", fields.join(""));
  }

  if (state.selection.kind === "sleeve") {
    const selected = findSubBucket(state.selection.itemId, state.selection.sleeveId);
    if (!selected) return "";
    const bucket = selected.bucket || {};
    const label = bucket.label ?? bucket.name ?? bucket.title ?? "Sleeve";
    const value = Number(bucket.value ?? bucket.amount ?? bucket.balance) || 0;
    const fields = [
      quickEditorField("Sleeve", `<input type="text" value="${escapeHtml(label)}" data-input="sleeve-label" aria-label="Sleeve label">`),
      quickEditorField("Value", `<input type="text" value="${escapeHtml(formatMoneyInput(value))}" inputmode="decimal" data-input="sleeve-value" data-money-input="true" aria-label="Sleeve value">`)
    ];
    return quickEditorShell("Sleeve edit", label, fields.join(""));
  }

  if (state.selection.kind === "group") {
    const group = getGroup(state.selection.id);
    if (!group || isLockedNode(group)) return "";
    return quickEditorShell("Group edit", group.label || "Selected group", quickEditorField("Name", `<input type="text" value="${escapeHtml(group.label || "")}" data-input="group-label" aria-label="Group name">`));
  }

  return "";
}

function defaultInspectorSection() {
  if (state.selection?.kind === "connector") return "connector-data";
  return "selection-data";
}

export function sectionForPopoverKind(kind, selectionKind = state.selection?.kind) {
  const value = String(kind || "").trim();
  const connectorSections = ["connector-data", "connector-style", "connector-label", "connector-endpoints"];
  const itemSections = ["selection-data", "selection-style"];
  if (connectorSections.includes(value) || itemSections.includes(value)) return value;

  if (selectionKind === "connector") {
    if (/endpoint|port/.test(value)) return "connector-endpoints";
    if (/label/.test(value)) return "connector-label";
    if (/route|stroke|arrow|width|color|style/.test(value)) return "connector-style";
    return "connector-data";
  }

  if (/style/.test(value)) return "selection-style";
  return "selection-data";
}

function activeInspectorSection() {
  const section = sectionForPopoverKind(state.activePopover || defaultInspectorSection());
  if (state.selection?.kind === "connector") {
    return ["connector-data", "connector-style", "connector-label", "connector-endpoints"].includes(section) ? section : "connector-data";
  }
  if (state.selection?.kind === "item") {
    return section === "selection-style" ? "selection-style" : "selection-data";
  }
  if (state.selection?.kind === "group") return "selection-data";
  if (state.selection?.kind === "sleeve") return "selection-data";
  return section;
}

function inspectorTabsForSelection(section) {
  if (hasMultiSelection()) return "";
  if (state.selection?.kind === "connector") {
    return `
      <button type="button" data-inspector-tab="connector-data" data-popover="connector-data" class="${section === "connector-data" ? "is-active" : ""}">Data</button>
      <button type="button" data-inspector-tab="connector-style" data-popover="connector-style" class="${section === "connector-style" ? "is-active" : ""}">Style</button>
      <button type="button" data-inspector-tab="connector-label" data-popover="connector-label" class="${section === "connector-label" ? "is-active" : ""}">Label</button>
      <button type="button" data-inspector-tab="connector-endpoints" data-popover="connector-endpoints" class="${section === "connector-endpoints" ? "is-active" : ""}">Ports</button>
    `;
  }
  if (state.selection?.kind === "item") {
    return `
      <button type="button" data-inspector-tab="selection-data" data-popover="selection-data" class="${section === "selection-data" ? "is-active" : ""}">Data</button>
      <button type="button" data-inspector-tab="selection-style" data-popover="selection-style" class="${section === "selection-style" ? "is-active" : ""}">Style</button>
    `;
  }
  if (state.selection?.kind === "sleeve") {
    return `<button type="button" data-inspector-tab="selection-data" data-popover="selection-data" class="is-active">Data</button>`;
  }
  if (state.selection?.kind === "group") {
    return `<button type="button" data-inspector-tab="selection-data" data-popover="selection-data" class="is-active">Data</button>`;
  }
  return "";
}

function inspectorActionsForSelection(summary) {
  if (hasMultiSelection()) {
    return `
      <button type="button" data-action="align-left">Align L</button>
      <button type="button" data-action="align-center-x">Align C</button>
      <button type="button" data-action="align-right">Align R</button>
      <button type="button" data-action="align-top">Top</button>
      <button type="button" data-action="align-middle-y">Middle</button>
      <button type="button" data-action="align-bottom">Bottom</button>
      <button type="button" data-action="distribute-x">Distribute X</button>
      <button type="button" data-action="distribute-y">Distribute Y</button>
      <button class="is-danger" type="button" data-action="delete">Delete</button>
    `;
  }
  if (summary?.locked) return "";
  if (state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    const endpointAction = conn && isAttachedEndpoint(conn.source) && isAttachedEndpoint(conn.target) ? "detach-connector" : "reattach-connector";
    const endpointLabel = endpointAction === "detach-connector" ? "Detach" : "Reattach";
    return `
      <button type="button" data-action="reverse-connector">Reverse</button>
      <button type="button" data-action="${endpointAction}" data-connector-id="${attr(conn?.id || "")}">${endpointLabel}</button>
      <button type="button" data-action="duplicate">Duplicate</button>
      <button class="is-danger" type="button" data-action="delete">Delete</button>
    `;
  }
  if (state.selection?.kind === "sleeve") return "";
  if (state.selection?.kind === "group") {
    return `
      <button type="button" data-action="duplicate">Duplicate</button>
      <button type="button" data-action="ungroup">Ungroup</button>
      <button class="is-danger" type="button" data-action="delete">Delete</button>
    `;
  }
  return `
    <button type="button" data-action="duplicate">Duplicate</button>
    <button class="is-danger" type="button" data-action="delete">Delete</button>
  `;
}

// Re-derivable caption ("$X start − $Y out"). Recomputed from the current
// stored value + flows so a value edit is reflected immediately.
export function financeBreakdownText(item) {
  if (!item?.financeId || state.viewMode === "current") return "";
  const data = state.financeData[item.financeId] || {};
  const flows = flowBreakdownForItem(item.id);
  if (!(flows.inflow > 0 || flows.outflow > 0)) return "";
  const startingValue = Number(data.value || 0);
  return `${compactDollars(startingValue)} start${flows.inflow > 0 ? ` + ${compactDollars(flows.inflow)} in` : ""}${flows.outflow > 0 ? ` − ${compactDollars(flows.outflow)} out` : ""}`;
}

// Computed net balances can go negative even though editable inputs clamp to >=0.
// Render such balances as an explicit shortfall (warning state + tooltip) rather
// than a bare "-$48K" on a client-facing card.
export function shortfallClass(value) {
  return Number(value) < 0 ? " is-shortfall" : "";
}
export function shortfallTitle(value) {
  return Number(value) < 0
    ? ` title="Shortfall — projected net balance is ${escapeHtml(compactDollars(value))} (below $0)"`
    : "";
}
function applyShortfallState(el, value) {
  const shortfall = Number(value) < 0;
  el.classList.toggle("is-shortfall", shortfall);
  if (shortfall) el.title = `Shortfall — projected net balance is ${compactDollars(value)} (below $0)`;
  else el.removeAttribute("title");
}

function itemInspectorDataBody(item) {
  const data = item.financeId ? state.financeData[item.financeId] || {} : null;
  const viewModel = computeCanvasViewModel();
  const currentValue = item.financeId ? viewModel.financeValues[item.financeId] ?? state.currentValues[item.financeId] ?? data?.value ?? 0 : 0;
  const isPaycheck = item.visual === "paycheck";
  const isCurrentMode = state.viewMode === "current";
  const cashflow = viewModel.cashflow;
  const balanceLabel = isPaycheck ? "Mapped income / year" : isCurrentMode ? "Current balance" : "Net balance";
  const breakdownText = financeBreakdownText(item);
  return `
    <label class="hud-row">
      <span class="control-label">Name</span>
      <input type="text" value="${escapeHtml(item.label)}" data-input="item-label">
    </label>
    <label class="hud-row">
      <span class="control-label">Subtitle</span>
      <input type="text" value="${escapeHtml(item.subtitle || "")}" data-input="item-subtitle">
    </label>
    ${item.type === "text" ? "" : `
      <label class="hud-row">
        <span class="control-label">Note</span>
        <input type="text" value="${escapeHtml(item.note || "")}" data-input="item-note">
      </label>
    `}
    ${data && isPaycheck ? `
      <div class="finance-value-stack">
        <label class="hud-row">
          <span class="control-label">Monthly need</span>
          <input type="text" value="${escapeHtml(formatMoneyInput(state.scenario.monthlyNeed || 0))}" inputmode="decimal" data-input="scenario-monthly-need" data-money-input="true">
        </label>
        <div class="range-field compact">
          <input type="range" min="0" max="${Math.max(Number(state.scenario.monthlyNeed) || 0, cashflow.mapped || 0, 10000) * 2}" step="50" value="${Number(state.scenario.monthlyNeed) || 0}" data-input="scenario-monthly-need-range">
          <span class="range-value">${currency.format(state.scenario.monthlyNeed || 0)}</span>
        </div>
        <div class="hud-row finance-readout">
          <span class="control-label">Mapped income / mo</span>
          <span class="computed-readout" data-popover-readout="mapped-monthly">${currency.format(cashflow.mapped)}</span>
        </div>
      </div>
      <div class="hud-row">
        <span class="control-label">Category</span>
        <div class="chip-row">${renderChipSet("item-field", "category", accountCategories, data.category || "brokerage")}</div>
      </div>
    ` : data ? `
      <div class="finance-value-stack">
        <label class="hud-row">
          <span class="control-label">Value</span>
          <input type="text" value="${escapeHtml(formatMoneyInput(data.value || 0))}" inputmode="decimal" data-input="finance-value" data-money-input="true">
        </label>
        <div class="range-field compact">
          <input type="range" min="0" max="${Math.max(Number(data.capacity) || 0, Number(data.value) || 0, 100000) * 2}" step="${valueSliderStep(data)}" value="${Number(data.value) || 0}" data-input="finance-value-range">
          <span class="range-value">${compactDollars(data.value || 0)}</span>
        </div>
        <div class="hud-row finance-readout">
          <span class="control-label">${escapeHtml(balanceLabel)}</span>
          <span class="computed-readout${shortfallClass(currentValue)}" data-popover-readout="after-flows" data-item-id="${attr(item.id)}"${shortfallTitle(currentValue)}>${compactDollars(currentValue)}</span>
        </div>
        <div class="flow-breakdown" data-item-id="${attr(item.id)}"${breakdownText ? "" : " hidden"}>${escapeHtml(breakdownText)}</div>
      </div>
      <div class="hud-row">
        <span class="control-label">Category</span>
        <div class="chip-row">${renderChipSet("item-field", "category", accountCategories, data.category || "brokerage")}</div>
      </div>
    ` : ""}
  `;
}

function itemInspectorStyleBody(item) {
  if (item.type === "finance") {
    return `
      <div class="hud-row">
        <span class="control-label">Visual</span>
        <div class="chip-row">${renderChipSet("item-field", "visual", financeVisuals, item.visual)}</div>
      </div>
    `;
  }
  if (item.type === "text") {
    return `
      <div class="hud-row">
        <span class="control-label">Text style</span>
        <div class="chip-row">${renderChipSet("item-field", "textStyle", textStyles, item.style?.textStyle || "caption")}</div>
      </div>
    `;
  }
  return `
    <div class="hud-row">
      <span class="control-label">Shape</span>
      <div class="chip-row">${renderChipSet("item-field", "shape", primitiveShapes, item.shape)}</div>
    </div>
  `;
}

function groupInspectorBody(group) {
  return `
    <label class="hud-row">
      <span class="control-label">Label</span>
      <input type="text" value="${escapeHtml(group.label)}" data-input="group-label">
    </label>
  `;
}

function sleeveInspectorBody(selected) {
  const bucket = selected.bucket || {};
  const label = bucket.label ?? bucket.name ?? bucket.title ?? "Sleeve";
  const note = bucket.note ?? bucket.subtitle ?? bucket.description ?? "";
  const value = Number(bucket.value ?? bucket.amount ?? bucket.balance) || 0;
  const capacity = Number(bucket.capacity ?? bucket.max ?? Math.max(1, value)) || 1;
  return `
    <label class="hud-row">
      <span class="control-label">Label</span>
      <input type="text" value="${escapeHtml(label)}" data-input="sleeve-label">
    </label>
    <label class="hud-row">
      <span class="control-label">Note</span>
      <input type="text" value="${escapeHtml(note)}" data-input="sleeve-note">
    </label>
    <div class="finance-value-stack">
      <label class="hud-row">
        <span class="control-label">Value</span>
        <input type="text" value="${escapeHtml(formatMoneyInput(value))}" inputmode="decimal" data-input="sleeve-value" data-money-input="true">
      </label>
      <label class="hud-row">
        <span class="control-label">Capacity</span>
        <input type="text" value="${escapeHtml(formatMoneyInput(capacity))}" inputmode="decimal" data-input="sleeve-capacity" data-money-input="true">
      </label>
    </div>
  `;
}

function connectorInspectorBody(conn, section) {
  const amount = connectorEditorAmount(conn);
  const amountMax = connectorEditorMax(conn);
  const amountStep = connectorEditorStep(conn);
  if (section === "connector-style") {
    return `
      <div class="hud-row compact">
        <span class="control-label">Route</span>
        <div class="chip-row">${renderChipSet("connector-field", "routeStyle", routeStyles, conn.routeStyle || "smartArc")}</div>
      </div>
      <div class="hud-row compact">
        <span class="control-label">Stroke</span>
        <div class="chip-row">${renderChipSet("connector-field", "strokeStyle", strokeStyles, conn.strokeStyle || "solid")}</div>
      </div>
      <div class="hud-row compact">
        <span class="control-label">Color</span>
        <div class="swatch-row">${renderColorSwatches(conn.colorMode || "flow")}</div>
      </div>
      <div class="hud-row compact">
        <span class="control-label">Width</span>
        <div class="chip-row">${renderChipSet("connector-field", "widthMode", widthModes, conn.widthMode || "amount")}</div>
      </div>
      <div class="range-field">
        <input type="range" min="2.5" max="9" step="0.5" value="${conn.customWidth || 5}" data-input="connector-custom-width">
        <span class="range-value">${Number(conn.customWidth || 5).toFixed(1)}</span>
      </div>
      <div class="hud-row compact">
        <span class="control-label">Start</span>
        <div class="chip-row">${renderChipSet("connector-field", "arrowStart", arrowStyles, conn.arrowStart || "none")}</div>
      </div>
      <div class="hud-row compact">
        <span class="control-label">End</span>
        <div class="chip-row">${renderChipSet("connector-field", "arrowEnd", arrowStyles, conn.arrowEnd || "arrow")}</div>
      </div>
    `;
  }
  if (section === "connector-label") {
    return `
      <div class="chip-row">${renderChipSet("connector-field", "labelMode", labelModes, conn.labelMode || "auto")}</div>
      <p class="popover-note">Drag the selected flow label handle to place it manually.</p>
    `;
  }
  if (section === "connector-endpoints") {
    return `
      <p class="popover-note">${escapeHtml(connectorAttachmentText(conn))}</p>
      <div class="hud-actions compact">
        <button class="secondary-action" type="button" data-action="detach-connector" data-connector-id="${attr(conn.id)}">Detach</button>
        <button class="secondary-action" type="button" data-action="reattach-connector" data-connector-id="${attr(conn.id)}">Reattach</button>
        <button class="secondary-action" type="button" data-action="reverse-connector">Reverse</button>
      </div>
    `;
  }
  return `
    ${connectorSourceStatusHtml(conn)}
    <label class="hud-row">
      <span class="control-label">Label</span>
      <input type="text" value="${escapeHtml(conn.label)}" data-input="connector-label">
    </label>
    <label class="hud-row">
      <span class="control-label">${connectorUsesMonthlyDisplay(conn) ? "Monthly" : "Amount"}</span>
      <input type="text" value="${escapeHtml(formatMoneyInput(amount))}" inputmode="decimal" data-input="connector-amount" data-money-input="true">
    </label>
    <div class="range-field">
      <input type="range" min="0" max="${amountMax}" step="${amountStep}" value="${Math.round(amount)}" data-input="connector-amount-range">
      <span class="range-value">${escapeHtml(connectorAmountText(conn))}</span>
    </div>
    <div class="hud-row">
      <span class="control-label">Flow type</span>
      <div class="chip-row">${renderChipSet("connector-field", "flowType", flowTypes, conn.flowType)}</div>
    </div>
  `;
}

function inspectorBodyForSelection(section) {
  if (hasMultiSelection()) return `<p class="popover-note">Use the controls below to align or distribute the selected objects.</p>`;
  if (state.selection?.kind === "item") {
    const item = getItem(state.selection.id);
    if (!item) return "";
    return section === "selection-style" ? itemInspectorStyleBody(item) : itemInspectorDataBody(item);
  }
  if (state.selection?.kind === "group") {
    const group = getGroup(state.selection.id);
    return group ? groupInspectorBody(group) : "";
  }
  if (state.selection?.kind === "sleeve") {
    const selected = findSubBucket(state.selection.itemId, state.selection.sleeveId);
    return selected ? sleeveInspectorBody(selected) : "";
  }
  if (state.selection?.kind === "connector") {
    const conn = getConnector(state.selection.id);
    return conn ? connectorInspectorBody(conn, section) : "";
  }
  return "";
}

export function renderSelectionInspector() {
  const summary = selectedSummary();
  if (!summary) return "";
  const section = activeInspectorSection();
  const tabs = inspectorTabsForSelection(section);
  const body = inspectorBodyForSelection(section);
  const actions = inspectorActionsForSelection(summary);
  return `
    <aside class="selection-inspector" data-selection-inspector data-inspector-section="${attr(section)}" aria-label="Selection inspector">
      <div class="inspector-head">
        <div>
          <p class="hud-kicker">${escapeHtml(summary.kicker)}</p>
          <h3>${escapeHtml(summary.title)}</h3>
        </div>
        <button class="hud-close" type="button" data-action="close-hud" aria-label="Close inspector">x</button>
      </div>
      ${tabs ? `<div class="inspector-tabs">${tabs}</div>` : ""}
      <div class="inspector-body">${body}</div>
      ${actions ? `<div class="inspector-actions">${actions}</div>` : ""}
    </aside>
  `;
}

export function renderSelectionPopover() {
  return "";
}

export function popoverShell(title, body, options = {}) {
  const layout = popoverLayoutForSelection(options.width || 286, options.height || 240);
  const extraClass = options.className ? classToken(options.className, "") : "";
  return `
    <div class="selection-popover ${extraClass}" style="${popoverStyle(layout)}" data-selection-popover data-popover-kind="${attr(state.activePopover || "")}">
      <div class="popover-head" data-popover-drag>
        <div>
          <p class="hud-kicker">${escapeHtml(options.kicker || "Selected")}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <button class="hud-close" type="button" data-action="close-popover" aria-label="Close">x</button>
      </div>
      <div class="popover-body">${body}</div>
    </div>
  `;
}

function valueSliderStep(data) {
  const reference = Math.max(Number(data?.value) || 0, Number(data?.capacity) || 0);
  if (reference >= 1000000) return 5000;
  if (reference >= 100000) return 1000;
  if (reference >= 10000) return 250;
  return 50;
}

export function renderSleeveDataPopover(selected) {
  const bucket = selected.bucket || {};
  const label = bucket.label ?? bucket.name ?? bucket.title ?? "Sleeve";
  const note = bucket.note ?? bucket.subtitle ?? bucket.description ?? "";
  const value = Number(bucket.value ?? bucket.amount ?? bucket.balance) || 0;
  const capacity = Number(bucket.capacity ?? bucket.max ?? Math.max(1, value)) || 1;
  return popoverShell("Sleeve data", `
    <label class="hud-row">
      <span class="control-label">Label</span>
      <input type="text" value="${escapeHtml(label)}" data-input="sleeve-label">
    </label>
    <label class="hud-row">
      <span class="control-label">Note</span>
      <input type="text" value="${escapeHtml(note)}" data-input="sleeve-note">
    </label>
    <div class="finance-value-stack">
      <label class="hud-row">
        <span class="control-label">Value</span>
        <input type="text" value="${escapeHtml(formatMoneyInput(value))}" inputmode="decimal" data-input="sleeve-value" data-money-input="true">
      </label>
      <label class="hud-row">
        <span class="control-label">Capacity</span>
        <input type="text" value="${escapeHtml(formatMoneyInput(capacity))}" inputmode="decimal" data-input="sleeve-capacity" data-money-input="true">
      </label>
    </div>
  `, { kicker: selected.item.label || "Container sleeve", width: 274, height: 230 });
}

export function renderItemDataPopover(item) {
  const data = item.financeId ? state.financeData[item.financeId] || {} : null;
  const viewModel = computeCanvasViewModel();
  const currentValue = item.financeId ? viewModel.financeValues[item.financeId] ?? state.currentValues[item.financeId] ?? data?.value ?? 0 : 0;
  const isPaycheck = item.visual === "paycheck";
  const isCurrentMode = state.viewMode === "current";
  const cashflow = viewModel.cashflow;
  const balanceLabel = isPaycheck ? "Mapped income / year" : isCurrentMode ? "Current balance" : "Net balance";
  const startingLabel = "Starting value";
  const breakdownText = financeBreakdownText(item);
  const fields = `
    <label class="hud-row">
      <span class="control-label">Label</span>
      <input type="text" value="${escapeHtml(item.label)}" data-input="item-label">
    </label>
    <label class="hud-row">
      <span class="control-label">Subtitle</span>
      <input type="text" value="${escapeHtml(item.subtitle || "")}" data-input="item-subtitle">
    </label>
    ${item.type === "text" ? "" : `
      <label class="hud-row">
        <span class="control-label">Note</span>
        <input type="text" value="${escapeHtml(item.note || "")}" data-input="item-note">
      </label>
    `}
    ${data && isPaycheck ? `
      <div class="finance-value-stack">
        <label class="hud-row">
          <span class="control-label">Monthly need</span>
          <input type="text" value="${escapeHtml(formatMoneyInput(state.scenario.monthlyNeed || 0))}" inputmode="decimal" data-input="scenario-monthly-need" data-money-input="true">
        </label>
        <div class="range-field compact">
          <input type="range" min="0" max="${Math.max(Number(state.scenario.monthlyNeed) || 0, cashflow.mapped || 0, 10000) * 2}" step="50" value="${Number(state.scenario.monthlyNeed) || 0}" data-input="scenario-monthly-need-range">
          <span class="range-value">${currency.format(state.scenario.monthlyNeed || 0)}</span>
        </div>
        <div class="hud-row finance-readout">
          <span class="control-label">Mapped income / mo</span>
          <span class="computed-readout" data-popover-readout="mapped-monthly">${currency.format(cashflow.mapped)}</span>
        </div>
      </div>
      <div class="hud-row">
        <span class="control-label">Category</span>
        <div class="chip-row">${renderChipSet("item-field", "category", accountCategories, data.category || "brokerage")}</div>
      </div>
    ` : data ? `
      <div class="finance-value-stack">
        <label class="hud-row">
          <span class="control-label">${escapeHtml(startingLabel)}</span>
          <input type="text" value="${escapeHtml(formatMoneyInput(data.value || 0))}" inputmode="decimal" data-input="finance-value" data-money-input="true">
        </label>
        <div class="range-field compact">
          <input type="range" min="0" max="${Math.max(Number(data.capacity) || 0, Number(data.value) || 0, 100000) * 2}" step="${valueSliderStep(data)}" value="${Number(data.value) || 0}" data-input="finance-value-range">
          <span class="range-value">${compactDollars(data.value || 0)}</span>
        </div>
        <div class="hud-row finance-readout">
          <span class="control-label">${escapeHtml(balanceLabel)}</span>
          <span class="computed-readout${shortfallClass(currentValue)}" data-popover-readout="after-flows" data-item-id="${attr(item.id)}"${shortfallTitle(currentValue)}>${compactDollars(currentValue)}</span>
        </div>
        <div class="flow-breakdown" data-item-id="${attr(item.id)}"${breakdownText ? "" : " hidden"}>${escapeHtml(breakdownText)}</div>
      </div>
      <div class="hud-row">
        <span class="control-label">Category</span>
        <div class="chip-row">${renderChipSet("item-field", "category", accountCategories, data.category || "brokerage")}</div>
      </div>
    ` : ""}
  `;
  return popoverShell(item.type === "finance" ? "Data" : "Edit text", fields, { kicker: item.type === "finance" ? "Finance" : "Object", width: data ? 248 : 260, height: data ? 190 : 190 });
}

export function renderItemStylePopover(item) {
  let controls = "";
  if (item.type === "finance") {
    controls = `
      <div class="hud-row">
        <span class="control-label">Visual</span>
        <div class="chip-row">${renderChipSet("item-field", "visual", financeVisuals, item.visual)}</div>
      </div>
    `;
  } else if (item.type === "text") {
    controls = `
      <div class="hud-row">
        <span class="control-label">Text style</span>
        <div class="chip-row">${renderChipSet("item-field", "textStyle", textStyles, item.style?.textStyle || "caption")}</div>
      </div>
    `;
  } else {
    controls = `
      <div class="hud-row">
        <span class="control-label">Shape</span>
        <div class="chip-row">${renderChipSet("item-field", "shape", primitiveShapes, item.shape)}</div>
      </div>
    `;
  }
  return popoverShell("Style", controls, { kicker: item.type === "finance" ? "Finance visual" : "Object style", width: 272, height: 204 });
}

export function renderGroupPopover(group) {
  return popoverShell("Group", `
    <label class="hud-row">
      <span class="control-label">Label</span>
      <input type="text" value="${escapeHtml(group.label)}" data-input="group-label">
    </label>
    <div class="hud-actions compact">
      <button class="secondary-action" type="button" data-action="duplicate">Duplicate</button>
      <button class="secondary-action" type="button" data-action="ungroup">Ungroup</button>
      <button class="danger-action" type="button" data-action="delete">Delete</button>
    </div>
  `, { kicker: "Container", width: 260, height: 180 });
}

export function connectorAttachmentText(conn) {
  const source = isAttachedEndpoint(conn.source) ? `Source attached to ${getNode(conn.source.itemId)?.label || conn.source.itemId}` : "Source free";
  const target = isAttachedEndpoint(conn.target) ? `Target attached to ${getNode(conn.target.itemId)?.label || conn.target.itemId}` : "Target free";
  return `${source}. ${target}.`;
}

export function renderConnectorPopover(conn, kind) {
  const amount = connectorEditorAmount(conn);
  const amountMax = connectorEditorMax(conn);
  const amountStep = connectorEditorStep(conn);
  if (kind === "connector-data") {
    return popoverShell("Connector data", `
      ${connectorSourceStatusHtml(conn)}
      <label class="hud-row">
        <span class="control-label">Label</span>
        <input type="text" value="${escapeHtml(conn.label)}" data-input="connector-label">
      </label>
      <label class="hud-row">
        <span class="control-label">${connectorUsesMonthlyDisplay(conn) ? "Monthly" : "Amount"}</span>
        <input type="text" value="${escapeHtml(formatMoneyInput(amount))}" inputmode="decimal" data-input="connector-amount" data-money-input="true">
      </label>
      <div class="range-field">
        <input type="range" min="0" max="${amountMax}" step="${amountStep}" value="${Math.round(amount)}" data-input="connector-amount-range">
        <span class="range-value">${escapeHtml(connectorAmountText(conn))}</span>
      </div>
      <div class="hud-row">
        <span class="control-label">Flow type</span>
        <div class="chip-row">${renderChipSet("connector-field", "flowType", flowTypes, conn.flowType)}</div>
      </div>
    `, { kicker: "Flow", height: 204 });
  }
  if (kind === "connector-style" || kind === "connector-route" || kind === "connector-stroke" || kind === "connector-arrows" || kind === "connector-width") {
    return popoverShell("Style", `
      <div class="hud-row compact">
        <span class="control-label">Route</span>
        <div class="chip-row">${renderChipSet("connector-field", "routeStyle", routeStyles, conn.routeStyle || "smartArc")}</div>
      </div>
      <div class="hud-row compact">
        <span class="control-label">Stroke</span>
        <div class="chip-row">${renderChipSet("connector-field", "strokeStyle", strokeStyles, conn.strokeStyle || "solid")}</div>
      </div>
      <div class="hud-row compact">
        <span class="control-label">Color</span>
        <div class="swatch-row">${renderColorSwatches(conn.colorMode || "flow")}</div>
      </div>
      <div class="hud-row compact">
        <span class="control-label">Width</span>
        <div class="chip-row">${renderChipSet("connector-field", "widthMode", widthModes, conn.widthMode || "amount")}</div>
      </div>
      <div class="range-field">
        <input type="range" min="2.5" max="9" step="0.5" value="${conn.customWidth || 5}" data-input="connector-custom-width">
        <span class="range-value">${Number(conn.customWidth || 5).toFixed(1)}</span>
      </div>
      <div class="hud-row compact">
        <span class="control-label">Start</span>
        <div class="chip-row">${renderChipSet("connector-field", "arrowStart", arrowStyles, conn.arrowStart || "none")}</div>
      </div>
      <div class="hud-row compact">
        <span class="control-label">End</span>
        <div class="chip-row">${renderChipSet("connector-field", "arrowEnd", arrowStyles, conn.arrowEnd || "arrow")}</div>
      </div>
    `, { kicker: "Flow", width: 286, height: 360 });
  }
  if (kind === "connector-label") {
    return popoverShell("Label", `
      <div class="chip-row">${renderChipSet("connector-field", "labelMode", labelModes, conn.labelMode || "auto")}</div>
      <p class="popover-note">Drag the selected flow label handle to place it manually.</p>
    `, { kicker: "Flow", width: 260, height: 170 });
  }
  return popoverShell("Endpoints", `
    <p class="popover-note">${escapeHtml(connectorAttachmentText(conn))}</p>
    <div class="hud-actions compact">
      <button class="secondary-action" type="button" data-action="detach-connector" data-connector-id="${attr(conn.id)}">Detach</button>
      <button class="secondary-action" type="button" data-action="reattach-connector" data-connector-id="${attr(conn.id)}">Reattach</button>
      <button class="secondary-action" type="button" data-action="reverse-connector">Reverse</button>
    </div>
  `, { kicker: "Flow", width: 260, height: 180 });
}

export function renderItemHud(item) {
  const layout = hudLayoutForNode(item, 304, 300);
  const kind = item.type === "finance" ? "Finance starter" : item.type === "text" ? "Text object" : "Primitive shape";
  const financeControls = item.type === "finance" ? renderFinanceHudControls(item) : "";
  const shapeControls = item.type === "shape" ? renderHudSection(
    "shape",
    "Shape",
    `<div class="chip-row">${renderChipSet("item-field", "shape", primitiveShapes, item.shape)}</div>`,
    { collapsed: true }
  ) : "";
  const textControls = item.type === "text" ? renderHudSection(
    "text-style",
    "Text style",
    `<div class="chip-row">${renderChipSet("item-field", "textStyle", textStyles, item.style?.textStyle || "caption")}</div>`,
    { collapsed: true }
  ) : "";
  const noteField = `
    <div class="hud-row">
      <label class="control-label">Note</label>
      <input type="text" value="${escapeHtml(item.note || "")}" data-input="item-note">
    </div>
  `;

  return `
    <div class="context-hud" style="${hudStyle(layout)}">
      <div class="hud-head" data-hud-drag>
        <div>
          <p class="hud-kicker">${kind}</p>
          <h3>${escapeHtml(item.label || "Selected item")}</h3>
        </div>
        <button class="hud-close" type="button" data-action="close-hud">x</button>
      </div>
      ${renderHudSection("content", "Content", `
        <div class="hud-row">
          <label class="control-label">Label</label>
          <input type="text" value="${escapeHtml(item.label)}" data-input="item-label">
        </div>
        <div class="hud-row">
          <label class="control-label">Subtitle</label>
          <input type="text" value="${escapeHtml(item.subtitle || "")}" data-input="item-subtitle">
        </div>
        ${item.type === "text" ? "" : noteField}
      `)}
      ${financeControls}
      ${shapeControls}
      ${textControls}
      <div class="hud-actions">
        <button class="secondary-action" type="button" data-action="duplicate">Duplicate</button>
        <button class="secondary-action" type="button" data-action="${item.type === "finance" ? "split-finance" : "group-selected"}">${item.type === "finance" ? "Edit parts" : "Group"}</button>
        <button class="danger-action" type="button" data-action="delete">Delete</button>
      </div>
      <span class="hud-resize" data-hud-resize aria-hidden="true"></span>
    </div>
  `;
}

export function renderFinanceHudControls(item) {
  const data = state.financeData[item.financeId] || {};
  return [
    renderHudSection(
      "visual",
      "Visual",
      `<div class="chip-row">${renderChipSet("item-field", "visual", financeVisuals, item.visual)}</div>`,
      { collapsed: true }
    ),
    renderHudSection(
      "category",
      "Category",
      `<div class="chip-row">${renderChipSet("item-field", "category", accountCategories, data.category || "brokerage")}</div>`,
      { collapsed: true }
    ),
    renderHudSection("data", "Data", `
      <div class="hud-row two">
        <label class="hud-row">
          <span class="control-label">Value</span>
          <input type="text" value="${escapeHtml(formatMoneyInput(data.value || 0))}" inputmode="decimal" data-input="finance-value" data-money-input="true">
        </label>
        <label class="hud-row">
          <span class="control-label">Capacity</span>
          <input type="text" value="${escapeHtml(formatMoneyInput(data.capacity || 1))}" inputmode="decimal" data-input="finance-capacity" data-money-input="true">
        </label>
      </div>
    `, { collapsed: true })
  ].join("");
}

export function renderGroupHud(group) {
  const layout = hudLayoutForNode(group, 296, 230);
  return `
    <div class="context-hud" style="${hudStyle(layout)}">
      <div class="hud-head" data-hud-drag>
        <div>
          <p class="hud-kicker">Group</p>
          <h3>${escapeHtml(group.label || "Selected group")}</h3>
        </div>
        <button class="hud-close" type="button" data-action="close-hud">x</button>
      </div>
      ${renderHudSection("content", "Content", `
        <div class="hud-row">
          <label class="control-label">Label</label>
          <input type="text" value="${escapeHtml(group.label)}" data-input="group-label">
        </div>
      `)}
      <div class="hud-actions">
        <button class="secondary-action" type="button" data-action="duplicate">Duplicate</button>
        <button class="secondary-action" type="button" data-action="ungroup">Ungroup</button>
        <button class="danger-action" type="button" data-action="delete">Delete</button>
      </div>
      <span class="hud-resize" data-hud-resize aria-hidden="true"></span>
    </div>
  `;
}

export function renderConnectorHud(conn) {
  const computed = computeConnectorPath(conn);
  const layout = hudLayoutFor(computed.label.hidden ? computed.control : computed.label, 322, 390);
  const amount = connectorEditorAmount(conn);
  const amountMax = connectorEditorMax(conn);
  const amountStep = connectorEditorStep(conn);
  return `
    <div class="context-hud is-connector" style="${hudStyle(layout)}">
      <div class="hud-head" data-hud-drag>
        <div>
          <p class="hud-kicker">Connector</p>
          <h3>${escapeHtml(conn.label || "Selected connector")}</h3>
        </div>
        <button class="hud-close" type="button" data-action="close-hud">x</button>
      </div>
      ${renderHudSection("content", "Content", `
        <div class="hud-row">
          <label class="control-label">Label</label>
          <input type="text" value="${escapeHtml(conn.label)}" data-input="connector-label">
        </div>
        <div class="hud-row">
          <label class="control-label">${connectorUsesMonthlyDisplay(conn) ? "Monthly" : "Amount"}</label>
          <input type="text" value="${escapeHtml(formatMoneyInput(amount))}" inputmode="decimal" data-input="connector-amount" data-money-input="true">
          <div class="range-field">
            <input type="range" min="0" max="${amountMax}" step="${amountStep}" value="${Math.round(amount)}" data-input="connector-amount-range">
            <span class="range-value">${escapeHtml(connectorAmountText(conn))}</span>
          </div>
        </div>
      `)}
      ${renderHudSection("flow-type", "Flow type", `
        <div class="chip-row">${renderChipSet("connector-field", "flowType", flowTypes, conn.flowType)}</div>
      `, { collapsed: true })}
      ${renderHudSection("route", "Route + stroke", `
        <p class="hud-kicker">Route</p>
        <div class="chip-row">${renderChipSet("connector-field", "routeStyle", routeStyles, conn.routeStyle || "smartArc")}</div>
        <p class="hud-kicker">Stroke</p>
        <div class="chip-row">${renderChipSet("connector-field", "strokeStyle", strokeStyles, conn.strokeStyle || "solid")}</div>
      `, { collapsed: true })}
      ${renderHudSection("arrows", "Arrows", `
        <p class="hud-kicker">Start</p>
        <div class="chip-row">${renderChipSet("connector-field", "arrowStart", arrowStyles, conn.arrowStart || "none")}</div>
        <p class="hud-kicker">End</p>
        <div class="chip-row">${renderChipSet("connector-field", "arrowEnd", arrowStyles, conn.arrowEnd || "arrow")}</div>
      `, { collapsed: true })}
      ${renderHudSection("label-weight", "Label + weight", `
        <p class="hud-kicker">Label</p>
        <div class="chip-row">${renderChipSet("connector-field", "labelMode", labelModes, conn.labelMode || "auto")}</div>
        <p class="hud-kicker">Weight</p>
        <div class="chip-row">${renderChipSet("connector-field", "widthMode", widthModes, conn.widthMode || "amount")}</div>
        <div class="range-field">
          <input type="range" min="2.5" max="9" step="0.5" value="${conn.customWidth || 5}" data-input="connector-custom-width">
          <span class="range-value">Emphasis</span>
        </div>
      `, { collapsed: true })}
      ${renderHudSection("color", "Color", `
        <div class="swatch-row">${renderColorSwatches(conn.colorMode || "flow")}</div>
      `, { collapsed: true })}
      <div class="hud-actions">
        <button class="secondary-action" type="button" data-action="duplicate">Duplicate</button>
        <button class="secondary-action" type="button" data-action="reverse-connector">Reverse</button>
        <button class="danger-action" type="button" data-action="delete">Delete</button>
      </div>
      <span class="hud-resize" data-hud-resize aria-hidden="true"></span>
    </div>
  `;
}

export function renderChipSet(kind, field, options, activeValue) {
  return Object.entries(options).map(([value, label]) => `
    <button class="chip ${value === activeValue ? "is-active" : ""}" type="button" data-set="${kind}" data-field="${field}" data-value="${value}">
      ${escapeHtml(label)}
    </button>
  `).join("");
}

export function renderColorSwatches(activeValue) {
  const theme = getTheme();
  const colorMap = {
    flow: "linear-gradient(90deg, #176e8a, #a88245, #b84d3f)",
    accent: theme.vars.accent,
    teal: theme.vars.teal,
    metal: theme.vars.metal,
    graphite: theme.vars.text,
    red: theme.vars["accent-2"]
  };
  return Object.entries(colorModes).map(([value, label]) => `
    <button class="swatch ${value === activeValue ? "is-active" : ""}" type="button" data-set="connector-field" data-field="colorMode" data-value="${value}">
      <i style="--swatch:${colorMap[value]}"></i>${escapeHtml(label)}
    </button>
  `).join("");
}

function meetingPlanForTemplate(cashflow) {
  const templateId = state.activeTemplateId || "custom";
  const gapCopy = `${cashflow.gap >= 0 ? "Surplus" : "Gap"} ${currency.format(Math.abs(cashflow.gap))}/mo`;
  const plans = {
    retirementPaycheck: {
      talk: [
        { id: "need", title: "Anchor the spending need", detail: `${currency.format(cashflow.need)}/mo client paycheck target.`, target: { kind: "item", id: "paycheck" } },
        { id: "mapped", title: "Show mapped income", detail: `${currency.format(cashflow.mapped)}/mo currently mapped from portfolio and contract income.`, target: { kind: "connector", id: "portfolioDraw" } },
        { id: "floor", title: "Explain the guaranteed floor", detail: "Clarify what is contractual, optional, and advisor-entered.", target: { kind: "item", id: "annuity" } },
        { id: "reserve", title: "Close with the liquidity backstop", detail: "Use the reserve sleeve as the confidence buffer.", target: { kind: "item", id: "reserve" } }
      ],
      actions: [
        { id: "confirm-need", title: "Confirm monthly spending target", owner: "Advisor + client", detail: `${currency.format(cashflow.need)}/mo baseline before proposal.`, target: { kind: "item", id: "paycheck" } },
        { id: "validate-income", title: "Validate income source details", owner: "Advisor", detail: "Confirm pension, Social Security, and annuity assumptions.", target: { kind: "item", id: "guaranteedIncome" } },
        { id: "set-draw", title: "Set portfolio draw guardrail", owner: "Advisor", detail: `${currency.format(state.scenario.monthlyDistribution || 0)}/mo draw tied to the flexible portfolio.`, target: { kind: "connector", id: "portfolioDraw" } },
        { id: "reserve-policy", title: "Agree reserve backstop threshold", owner: "Advisor + client", detail: "Define when liquidity sleeve supports the paycheck.", target: { kind: "item", id: "reserve" } }
      ],
      decisions: [
        { id: "coverage", title: "Coverage status", detail: gapCopy, target: { kind: "item", id: "paycheck" } },
        { id: "annuity-on", title: "Annuity income treatment", detail: state.scenario.annuityOn ? "Included in mapped income." : "Excluded from mapped income.", target: { kind: "connector", id: "annuityIncome" } },
        { id: "reserve", title: "Liquidity sleeve role", detail: "Reserve is a backstop, not ordinary monthly income.", target: { kind: "item", id: "reserve" } }
      ]
    },
    retirement: {
      talk: [
        { id: "need", title: "Anchor the spending need", detail: `${currency.format(cashflow.need)}/mo client paycheck target.`, target: { kind: "item", id: "clientIncome" } },
        { id: "mapped", title: "Show mapped income", detail: `${currency.format(cashflow.mapped)}/mo currently mapped from portfolio and contract income.`, target: { kind: "connector", id: "incomeDistribution" } },
        { id: "floor", title: "Explain the guaranteed floor", detail: "Clarify what is contractual, optional, and advisor-entered.", target: { kind: "item", id: "incomeAnnuity" } },
        { id: "reserve", title: "Close with the liquidity backstop", detail: "Use the reserve sleeve as the confidence buffer.", target: { kind: "item", id: "cashReserve" } }
      ],
      actions: [
        { id: "confirm-need", title: "Confirm monthly spending target", owner: "Advisor + client", detail: `${currency.format(cashflow.need)}/mo baseline before proposal.`, target: { kind: "item", id: "clientIncome" } },
        { id: "validate-income", title: "Validate income source details", owner: "Advisor", detail: "Confirm pension, Social Security, and annuity assumptions.", target: { kind: "item", id: "incomeAnnuity" } },
        { id: "set-draw", title: "Set portfolio draw guardrail", owner: "Advisor", detail: `${currency.format(state.scenario.monthlyDistribution || 0)}/mo draw tied to the flexible portfolio.`, target: { kind: "connector", id: "incomeDistribution" } },
        { id: "reserve-policy", title: "Agree reserve backstop threshold", owner: "Advisor + client", detail: "Define when liquidity sleeve supports the paycheck.", target: { kind: "item", id: "cashReserve" } }
      ],
      decisions: [
        { id: "coverage", title: "Coverage status", detail: gapCopy, target: { kind: "item", id: "clientIncome" } },
        { id: "annuity-on", title: "Annuity income treatment", detail: state.scenario.annuityOn ? "Included in mapped income." : "Excluded from mapped income.", target: { kind: "connector", id: "annuityIncome" } },
        { id: "reserve", title: "Liquidity sleeve role", detail: "Reserve is a backstop, not ordinary monthly income.", target: { kind: "item", id: "cashReserve" } }
      ]
    },
    estate: {
      talk: [
        { id: "source", title: "Start with current ownership", detail: "Frame which assets are being retitled or reserved.", target: { kind: "item", id: "estateAccount" } },
        { id: "trust", title: "Use the trust as the central object", detail: "Lifestyle, legacy, charitable, and admin sleeves explain intent.", target: { kind: "item", id: "revocableTrust" } },
        { id: "outcomes", title: "Trace household and beneficiary outcomes", detail: "Separate lifestyle support from future transfer paths.", target: { kind: "connector", id: "lifestyleSupport" } },
        { id: "admin", title: "Finish with tax and liquidity support", detail: "Show why reserve funding exists before distribution.", target: { kind: "item", id: "cashReserve" } }
      ],
      actions: [
        { id: "attorney-review", title: "Send trust funding map to estate attorney", owner: "Advisor", detail: "Confirm retitle path and beneficiary intent.", target: { kind: "connector", id: "assetTransfer" } },
        { id: "sleeves", title: "Confirm trust sleeve purposes", owner: "Advisor + client", detail: "Lifestyle, legacy, charitable, and admin/liquidity sleeves.", target: { kind: "item", id: "revocableTrust" } },
        { id: "beneficiaries", title: "Verify beneficiary path", owner: "Client", detail: "Confirm household, heir, and charitable destination assumptions.", target: { kind: "connector", id: "beneficiaryFlow" } },
        { id: "reserve", title: "Review estate liquidity reserve", owner: "Advisor", detail: "Check estimated tax, admin, and settlement support.", target: { kind: "item", id: "cashReserve" } }
      ],
      decisions: [
        { id: "retitle", title: "Retitle story", detail: "Asset transfer feeds the trust container.", target: { kind: "connector", id: "assetTransfer" } },
        { id: "lifestyle", title: "Lifestyle support", detail: "Trust can support surviving household needs.", target: { kind: "connector", id: "lifestyleSupport" } },
        { id: "legacy", title: "Legacy path", detail: "Beneficiary transfer remains future/deferred.", target: { kind: "connector", id: "beneficiaryFlow" } }
      ]
    }
  };
  return plans[templateId] || {
    talk: [
      { id: "orient", title: "Orient the client", detail: "Start with the central planning object.", target: state.items[0] ? { kind: "item", id: state.items[0].id } : null },
      { id: "flows", title: "Walk the primary flows", detail: "Trace what moves, when, and why.", target: state.connectors[0] ? { kind: "connector", id: state.connectors[0].id } : null }
    ],
    actions: [
      { id: "confirm-values", title: "Confirm advisor-entered values", owner: "Advisor", detail: "Review assumptions before presenting.", target: state.items[0] ? { kind: "item", id: state.items[0].id } : null }
    ],
    decisions: [
      { id: "status", title: "Meeting status", detail: gapCopy, target: state.items[0] ? { kind: "item", id: state.items[0].id } : null }
    ]
  };
}

function meetingStatus(kind, id) {
  const bucket = kind === "decision" ? state.meeting?.decisionStatuses : state.meeting?.actionStatuses;
  return bucket?.[id] || "open";
}

function renderMeetingTargetAttrs(target) {
  return target?.kind && target?.id
    ? ` data-meeting-target-kind="${attr(target.kind)}" data-meeting-target-id="${attr(target.id)}"`
    : "";
}

function renderMeetingRows(kind, rows) {
  return rows.map((row, index) => {
    const status = meetingStatus(kind, row.id);
    return `
      <article class="meeting-row meeting-row-${kind} status-${attr(status)}"${renderMeetingTargetAttrs(row.target)} data-meeting-row="${attr(row.id)}">
        <button class="meeting-focus-button" type="button"${renderMeetingTargetAttrs(row.target)} aria-label="Focus ${attr(row.title)}">
          <span class="meeting-row-index">${index + 1}</span>
          <span class="meeting-row-copy">
            <strong>${escapeHtml(row.title)}</strong>
            <em>${escapeHtml(row.detail || "")}</em>
            ${row.owner ? `<small>${escapeHtml(row.owner)}</small>` : ""}
          </span>
        </button>
        ${kind === "action" || kind === "decision" ? `<button class="meeting-status" type="button" data-meeting-status-kind="${kind}" data-meeting-status-id="${attr(row.id)}" data-meeting-status-current="${attr(status)}">${escapeHtml(status === "agreed" ? "Agreed" : status === "deferred" ? "Deferred" : "Open")}</button>` : ""}
      </article>
    `;
  }).join("");
}

function renderMeetingPane(cashflow) {
  const plan = meetingPlanForTemplate(cashflow);
  const activeTab = state.meeting?.activeTab || "actions";
  if (activeTab === "talk") return `<div class="meeting-pane" data-meeting-pane="talk">${renderMeetingRows("talk", plan.talk)}</div>`;
  if (activeTab === "decisions") return `<div class="meeting-pane" data-meeting-pane="decisions">${renderMeetingRows("decision", plan.decisions)}</div>`;
  if (activeTab === "controls") {
    return `
      <div class="meeting-pane scenario-grid" data-meeting-pane="controls">
        ${renderScenarioRange("monthlyNeed", "Monthly need", 1000, 18000, 250, state.scenario.monthlyNeed, currency.format(state.scenario.monthlyNeed))}
        ${renderScenarioRange("monthlyDistribution", "Portfolio draw", 0, 12000, 250, state.scenario.monthlyDistribution, currency.format(state.scenario.monthlyDistribution))}
        ${renderScenarioRange("rothConversion", "Roth conversion", 0, 400000, 5000, state.scenario.rothConversion, compactDollars(state.scenario.rothConversion))}
        ${renderScenarioRange("annuityPremium", "Annuity premium", 0, 600000, 5000, state.scenario.annuityPremium, compactDollars(state.scenario.annuityPremium))}
        ${renderScenarioRange("annuityMonthlyIncome", "Annuity monthly income", 0, 8000, 100, state.scenario.annuityMonthlyIncome, currency.format(state.scenario.annuityMonthlyIncome))}
        <label class="toggle-row">
          <span>Annuity income on</span>
          <input type="checkbox" data-scenario="annuityOn" ${state.scenario.annuityOn ? "checked" : ""}>
        </label>
        ${renderScenarioRange("taxReservePct", "Tax reserve rate", 0, 45, 1, state.scenario.taxReservePct, `${state.scenario.taxReservePct}%`)}
      </div>
    `;
  }
  return `<div class="meeting-pane" data-meeting-pane="actions">${renderMeetingRows("action", plan.actions)}</div>`;
}

function renderMeetingTabs() {
  const active = state.meeting?.activeTab || "actions";
  return `
    <div class="meeting-tabs" role="tablist" aria-label="Meeting layer">
      ${[
        ["talk", "Talk"],
        ["actions", "Actions"],
        ["decisions", "Decisions"],
        ["controls", "Controls"]
      ].map(([id, label]) => `<button type="button" role="tab" class="${active === id ? "is-active" : ""}" data-meeting-tab="${id}">${label}</button>`).join("")}
    </div>
  `;
}

function renderPresentationMeetingSummary(cashflow) {
  const plan = meetingPlanForTemplate(cashflow);
  const actions = plan.actions.slice(0, 3);
  const gapLabel = cashflow.gap >= 0 ? "Surplus" : "Gap";
  return `
    <div class="presentation-meeting-summary">
      <div class="presentation-summary-head">
        <span>Next steps</span>
        <strong>${gapLabel} ${currency.format(Math.abs(cashflow.gap))}/mo</strong>
      </div>
      <div class="presentation-action-list">
        ${actions.map((row) => {
          const status = meetingStatus("action", row.id);
          return `<span class="presentation-action status-${attr(status)}">${escapeHtml(row.title)}</span>`;
        }).join("")}
      </div>
    </div>
  `;
}

// Suppress the meeting-layer Need/Mapped/Gap banner only when there is no
// income/need node for it to describe -- i.e. no paycheck target and no live
// cashflow (estate). A dangling Need/Gap strip with no paycheck is meaningless.
// Templates that DO have a paycheck node (roth, blank) keep the banner, now
// showing honest $0 mapped instead of a figure fabricated from scenario defaults.
export function shouldHideCashflowBanner(cashflow) {
  if (cashflow?.hasLiveCashflow) return false;
  const hasPaycheckNode = state.items.some((item) => item.type === "finance" && item.visual === "paycheck");
  return !hasPaycheckNode;
}

export function renderScenarioRail() {
  const panelOpen = Boolean(state.meeting?.panelOpen);
  dom.scenarioRail.classList.toggle("is-open", panelOpen);
  dom.meetingPanelButton?.setAttribute("aria-expanded", String(panelOpen));
  const cashflow = computeCanvasViewModel().cashflow;
  const gapLabel = cashflow.gap >= 0 ? "Surplus" : "Gap";
  if (document.body.classList.contains("presentation")) {
    dom.scenarioRail.innerHTML = renderPresentationMeetingSummary(cashflow);
    return;
  }
  const hideCashflow = shouldHideCashflowBanner(cashflow);
  dom.scenarioRail.innerHTML = `
    <div class="scenario-head">
      <div>
        <p class="hud-kicker">Advisor meeting layer</p>
        <h3>Meeting plan</h3>
      </div>
      ${hideCashflow ? "" : `<div class="monthly-summary">
        <span>Mapped income</span>
        <strong data-cashflow-rail="mapped">${currency.format(cashflow.mapped)}</strong>
      </div>`}
    </div>
    ${hideCashflow ? "" : `<div class="cashflow-strip ${cashflow.gap >= 0 ? "is-surplus" : "is-gap"}">
      <span>Need <b data-cashflow-rail="need">${currency.format(cashflow.need)}</b>/mo</span>
      <span>Mapped <b data-cashflow-rail="mapped-inline">${currency.format(cashflow.mapped)}</b>/mo</span>
      <span><i data-cashflow-rail="gap-label">${gapLabel}</i> <b data-cashflow-rail="gap">${currency.format(Math.abs(cashflow.gap))}</b>/mo</span>
    </div>`}
    ${renderMeetingTabs()}
    ${renderMeetingPane(cashflow)}
  `;
}

export function renderScenarioRange(key, label, min, max, step, value, displayValue) {
  return `
    <div class="scenario-field">
      <label><span>${escapeHtml(label)}</span><span class="scenario-value" data-scenario-value="${escapeHtml(key)}">${escapeHtml(displayValue)}</span></label>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-scenario="${key}">
    </div>
  `;
}

export function updateScenarioReadouts() {
  const cashflow = computeCanvasViewModel().cashflow;
  const values = {
    monthlyNeed: currency.format(state.scenario.monthlyNeed),
    monthlyDistribution: currency.format(state.scenario.monthlyDistribution),
    rothConversion: compactDollars(state.scenario.rothConversion),
    annuityPremium: compactDollars(state.scenario.annuityPremium),
    annuityMonthlyIncome: currency.format(state.scenario.annuityMonthlyIncome),
    taxReservePct: `${state.scenario.taxReservePct}%`
  };
  Object.entries(values).forEach(([key, value]) => {
    const readout = dom.scenarioRail.querySelector(`[data-scenario-value="${key}"]`);
    if (readout) readout.textContent = value;
  });
  const strip = dom.scenarioRail.querySelector(".cashflow-strip");
  if (strip) {
    strip.classList.toggle("is-surplus", cashflow.gap >= 0);
    strip.classList.toggle("is-gap", cashflow.gap < 0);
  }
  const mapped = dom.scenarioRail.querySelector('[data-cashflow-rail="mapped"]');
  const mappedInline = dom.scenarioRail.querySelector('[data-cashflow-rail="mapped-inline"]');
  const need = dom.scenarioRail.querySelector('[data-cashflow-rail="need"]');
  const gap = dom.scenarioRail.querySelector('[data-cashflow-rail="gap"]');
  const gapLabel = dom.scenarioRail.querySelector('[data-cashflow-rail="gap-label"]');
  if (mapped) mapped.textContent = currency.format(cashflow.mapped);
  if (mappedInline) mappedInline.textContent = currency.format(cashflow.mapped);
  if (need) need.textContent = currency.format(cashflow.need);
  if (gap) gap.textContent = currency.format(Math.abs(cashflow.gap));
  if (gapLabel) gapLabel.textContent = cashflow.gap >= 0 ? "Surplus" : "Gap";
}

export function renderInventory() {
  if (!dom.inventoryPopover || !dom.inventoryCount) return;

  const rows = computeCanvasViewModel().inventory.rows;

  dom.inventoryCount.textContent = String(rows.length);
  dom.inventoryCount.classList.toggle("is-empty", rows.length === 0);

  if (rows.length === 0) {
    dom.inventoryPopover.innerHTML = `
      <div class="inventory-head">
        <h4>Account inventory</h4>
        <span class="inventory-total">empty</span>
      </div>
      <div class="inventory-empty">
        Nothing on the canvas yet.
        <div class="hint">Use Add to drop an account, bucket, or contract.</div>
      </div>
    `;
    return;
  }

  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row.category)) grouped.set(row.category, []);
    grouped.get(row.category).push(row);
  });

  // Known account categories first (fixed order), then any other categories so
  // every aggregated row is actually shown. Previously rows in a category outside
  // accountCategories were dropped from the display yet still counted in the
  // header total, so the header disagreed with the visible rows.
  const knownOrder = Object.keys(accountCategories).filter((cat) => grouped.has(cat));
  const extraOrder = [...grouped.keys()].filter((cat) => !accountCategories[cat]);
  const categoryOrder = [...knownOrder, ...extraOrder];
  const total = categoryOrder.reduce((sum, cat) => sum + grouped.get(cat).reduce((s, r) => s + (Number(r.value) || 0), 0), 0);
  const selectedId = state.selection?.kind === "item" ? state.selection.id : null;

  const sections = categoryOrder
    .map((cat) => {
      const items = grouped.get(cat);
      const catTotal = items.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
      const rowsHtml = items
        .map((row) => `
          <div class="inventory-row ${row.id === selectedId ? "is-selected" : ""}" data-inventory-id="${escapeHtml(row.id)}" role="button" tabindex="0">
            <span class="row-name">${escapeHtml(row.label)}</span>
            <span class="row-value">${escapeHtml(inventoryDollars(row.value))}</span>
          </div>
        `)
        .join("");
      return `
        <section class="inventory-group">
          <div class="inventory-group-head">
            <span class="group-name">${escapeHtml(accountCategories[cat] || cat)}</span>
            <span class="group-total">${escapeHtml(inventoryDollars(catTotal))}</span>
          </div>
          ${rowsHtml}
        </section>
      `;
    })
    .join("");

  dom.inventoryPopover.innerHTML = `
    <div class="inventory-head">
      <h4>Account inventory</h4>
      <span class="inventory-total">${escapeHtml(inventoryDollars(total))} total</span>
    </div>
    ${sections}
  `;
}

function focusEditingItem() {
  if (!state.pendingEditFocus) return;
  state.pendingEditFocus = false;
  const target = state.editingTarget;
  const fieldSelector = state.pendingEditField ? `[data-edit-field="${cssIdent(state.pendingEditField)}"]` : "[contenteditable=\"true\"]";
  state.pendingEditField = null;
  let editable = null;
  if (target?.kind === "connector") {
    editable = dom.labelLayer.querySelector(`.connector-label[data-connector-id="${cssIdent(target.id)}"] ${fieldSelector}`);
  } else if (target?.kind === "sleeve") {
    editable = dom.itemLayer.querySelector(`.sub-bucket-card[data-item-id="${cssIdent(target.itemId)}"][data-sub-bucket-id="${cssIdent(target.sleeveId)}"] ${fieldSelector}`);
  } else if (state.editingItemId) {
    const editingSelectorId = cssIdent(state.editingItemId);
    editable = dom.itemLayer.querySelector(`[data-item-id="${editingSelectorId}"] ${fieldSelector}, [data-group-id="${editingSelectorId}"] ${fieldSelector}`);
  }
  if (!editable) return;
  editable.focus();
  const range = document.createRange();
  range.selectNodeContents(editable);
  const selectionRange = window.getSelection();
  selectionRange.removeAllRanges();
  selectionRange.addRange(range);
}

export function renderCanvasSurface(options = {}) {
  syncComputedValues(options);
  renderConnectors();
  renderItems();
  renderScenarioRail();
  renderInventory();
}

export function renderCanvasOnly(options = {}) {
  renderCanvasSurface(options);
  renderHud();
  focusEditingItem();
}

export function renderAll(options = {}) {
  if (isLiveDragInteraction()) state.inputDiagnostics.fullRenderDuringDrag += 1;
  syncComputedValues(options);
  document.body.classList.toggle("start-screen-open", Boolean(state.startScreenOpen));
  if (dom.startScreen) dom.startScreen.classList.toggle("is-hidden", !state.startScreenOpen);

  document.querySelectorAll("[data-dock]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.dock === state.activeDock);
  });
  document.body.dataset.activeTool = state.activeDock || "select";
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.viewMode);
  });
  document.body.classList.toggle("current-mode", state.viewMode === "current");

  renderDockFlyout();
  renderConnectors();
  renderItems();
  renderHud();
  renderScenarioRail();
  renderInventory();
  renderViewport();
  focusEditingItem();
}
