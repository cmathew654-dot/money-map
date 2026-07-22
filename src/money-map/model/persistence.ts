import type {
  MoneyMapDocument,
  MoneyMapFlow,
  MoneyMapModule,
  Point,
  PresentationStep,
  StarterId,
} from "./types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const browserMemoryFallback = new Map<string, string>();

/**
 * Resolves browser persistence without letting storage availability become an
 * authoring requirement. Every successful read/write is mirrored in memory,
 * so a storage implementation that becomes unavailable mid-session can still
 * return the last known draft.
 */
export function createResilientStorage(
  primary: StorageLike | undefined,
  fallback: Map<string, string> = browserMemoryFallback,
): StorageLike {
  return {
    getItem(key) {
      if (primary) {
        try {
          const value = primary.getItem(key);
          if (value !== null) {
            fallback.set(key, value);
            return value;
          }
        } catch {
          // The in-memory copy remains available below.
        }
      }
      return fallback.get(key) ?? null;
    },
    setItem(key, value) {
      fallback.set(key, value);
      if (!primary) return;
      try {
        primary.setItem(key, value);
      } catch {
        // Authoring continues with the in-memory copy.
      }
    },
    removeItem(key) {
      fallback.delete(key);
      if (!primary) return;
      try {
        primary.removeItem(key);
      } catch {
        // The current session is still cleared even if browser storage is not.
      }
    },
  };
}

export function resolveEditorStorage(injected?: StorageLike): StorageLike {
  let primary = injected;
  if (!primary && typeof window !== "undefined") {
    try {
      primary = window.localStorage ?? undefined;
    } catch {
      primary = undefined;
    }
  }
  return createResilientStorage(
    primary,
    injected ? new Map<string, string>() : browserMemoryFallback,
  );
}

export const DRAFT_PREFIX = "money-map:v2:";

const FORBIDDEN_DOCUMENT_KEYS = new Set([
  "amount",
  "balance",
  "balancenumber",
  "capacity",
  "computedtotal",
  "debit",
  "fill",
  "remainder",
  "taxrate",
  "warning",
]);

export function draftKey(starterId: StarterId): string {
  return `${DRAFT_PREFIX}${starterId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOnlyKeys(candidate: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(candidate).every((key) => allowed.includes(key));
}

function containsForbiddenDocumentKey(candidate: unknown): boolean {
  if (Array.isArray(candidate)) return candidate.some(containsForbiddenDocumentKey);
  if (!isRecord(candidate)) return false;

  return Object.entries(candidate).some(([key, nested]) => {
    const normalizedKey = key.replace(/[-_]/g, "").toLocaleLowerCase();
    return FORBIDDEN_DOCUMENT_KEYS.has(normalizedKey) || containsForbiddenDocumentKey(nested);
  });
}

function isPoint(value: unknown): value is Point {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["x", "y"]) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y)
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOneOf(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

function isSnappedRotation(rotation: unknown): rotation is number {
  return typeof rotation === "number" && Number.isFinite(rotation) && rotation % 15 === 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isModuleRow(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["id", "label", "value"]) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.value === "string"
  );
}

function isModuleTotal(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["label", "value"]) &&
    typeof value.label === "string" &&
    typeof value.value === "string"
  );
}

function isModule(value: unknown): value is MoneyMapModule {
  if (!isRecord(value)) return false;

  const rowsAreValid = Array.isArray(value.rows) && value.rows.every(isModuleRow);
  const totalIsValid = value.total === undefined || isModuleTotal(value.total);

  return (
    hasOnlyKeys(value, [
      "id",
      "kind",
      "primitive",
      "position",
      "width",
      "height",
      "rotation",
      "priority",
      "density",
      "colorRole",
      "swatch",
      "zIndex",
      "eyebrow",
      "title",
      "subtitle",
      "rows",
      "total",
      "note",
    ]) &&
    typeof value.id === "string" &&
    isOneOf(value.kind, [
      "income",
      "account",
      "reserve",
      "need",
      "specialty",
      "charitable",
      "note",
    ]) &&
    isOneOf(value.primitive, [
      "ledger",
      "plate",
      "tray",
      "band",
      "roundel",
      "frame",
      "cylinder",
      "text",
    ]) &&
    isPoint(value.position) &&
    typeof value.width === "number" &&
    Number.isFinite(value.width) &&
    typeof value.height === "number" &&
    Number.isFinite(value.height) &&
    value.height > 0 &&
    isSnappedRotation(value.rotation) &&
    isOneOf(value.priority, ["quiet", "standard", "spotlight"]) &&
    isOneOf(value.density, ["essential", "standard", "full"]) &&
    isOneOf(value.colorRole, [
      "income",
      "account",
      "reserve",
      "need",
      "specialty",
      "charitable",
      "note",
    ]) &&
    isOneOf(value.swatch, ["base", "muted", "accent", "contrast"]) &&
    typeof value.zIndex === "number" &&
    Number.isFinite(value.zIndex) &&
    typeof value.eyebrow === "string" &&
    typeof value.title === "string" &&
    isOptionalString(value.subtitle) &&
    rowsAreValid &&
    totalIsValid &&
    isOptionalString(value.note)
  );
}

function isFlow(value: unknown): value is MoneyMapFlow {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "id",
      "source",
      "target",
      "relationship",
      "route",
      "labelTreatment",
      "label",
      "secondaryLabel",
      "cadence",
      "labelPosition",
      "waypoints",
    ]) &&
    typeof value.id === "string" &&
    typeof value.source === "string" &&
    typeof value.target === "string" &&
    isOneOf(value.relationship, ["income", "transfer", "replenishment", "planned"]) &&
    isOneOf(value.route, ["straight", "orthogonal", "curved"]) &&
    isOneOf(value.labelTreatment, ["plain", "plate", "filled"]) &&
    typeof value.label === "string" &&
    isOptionalString(value.secondaryLabel) &&
    isRecord(value.cadence) &&
    hasOnlyKeys(value.cadence, ["kind", "label"]) &&
    isOneOf(value.cadence.kind, ["monthly", "annual", "one-time", "as-needed", "custom"]) &&
    typeof value.cadence.label === "string" &&
    isPoint(value.labelPosition) &&
    Array.isArray(value.waypoints) &&
    value.waypoints.every(isPoint)
  );
}

function isPresentationStep(value: unknown): value is PresentationStep {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["id", "title", "moduleIds", "flowIds"]) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isStringArray(value.moduleIds) &&
    isStringArray(value.flowIds)
  );
}

function isDocument(value: unknown, starterId: StarterId): value is MoneyMapDocument {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "schemaVersion",
      "id",
      "title",
      "asOf",
      "style",
      "defaultCadence",
      "modules",
      "flows",
      "presentation",
    ]) &&
    !containsForbiddenDocumentKey(value) &&
    value.schemaVersion === 2 &&
    value.id === starterId &&
    typeof value.title === "string" &&
    typeof value.asOf === "string" &&
    isOneOf(value.style, [
      "private-ledger",
      "distribution-registry",
      "foundation",
      "conversion-path",
    ]) &&
    isOneOf(value.defaultCadence, ["all", "monthly", "annual", "other"]) &&
    Array.isArray(value.modules) &&
    value.modules.every(isModule) &&
    Array.isArray(value.flows) &&
    value.flows.every(isFlow) &&
    Array.isArray(value.presentation) &&
    value.presentation.every(isPresentationStep)
  );
}

export function saveDraft(storage: StorageLike, document: MoneyMapDocument): void {
  storage.setItem(draftKey(document.id), JSON.stringify(document));
}

export function loadDraft(
  storage: StorageLike,
  starterId: StarterId,
  fallback: MoneyMapDocument,
): MoneyMapDocument {
  const stored = storage.getItem(draftKey(starterId));
  if (stored === null) return fallback;

  try {
    const candidate: unknown = JSON.parse(stored);
    return isDocument(candidate, starterId) ? candidate : fallback;
  } catch {
    return fallback;
  }
}

export function clearDraft(storage: StorageLike, starterId: StarterId): void {
  storage.removeItem(draftKey(starterId));
}
