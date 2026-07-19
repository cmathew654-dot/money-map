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

export const DRAFT_PREFIX = "money-map:v1:";

export function draftKey(starterId: StarterId): string {
  return `${DRAFT_PREFIX}${starterId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPoint(value: unknown): value is Point {
  return (
    isRecord(value) &&
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isModule(value: unknown): value is MoneyMapModule {
  if (!isRecord(value)) return false;

  const rowsAreValid =
    Array.isArray(value.rows) &&
    value.rows.every(
      (row) =>
        isRecord(row) &&
        typeof row.id === "string" &&
        typeof row.label === "string" &&
        typeof row.value === "string",
    );
  const totalIsValid =
    value.total === undefined ||
    (isRecord(value.total) &&
      typeof value.total.label === "string" &&
      typeof value.total.value === "string");

  return (
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
    isOneOf(value.primitive, ["ledger", "plate", "tray", "band", "roundel", "frame"]) &&
    isPoint(value.position) &&
    typeof value.width === "number" &&
    Number.isFinite(value.width) &&
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
    typeof value.id === "string" &&
    typeof value.source === "string" &&
    typeof value.target === "string" &&
    isOneOf(value.relationship, ["flow", "association", "planned"]) &&
    isOneOf(value.route, ["straight", "orthogonal", "curved"]) &&
    isOneOf(value.labelTreatment, ["plain", "plate", "filled"]) &&
    typeof value.label === "string" &&
    isOptionalString(value.secondaryLabel) &&
    isRecord(value.cadence) &&
    isOneOf(value.cadence.kind, ["monthly", "annual", "one-time", "as-needed", "custom"]) &&
    typeof value.cadence.label === "string" &&
    Array.isArray(value.waypoints) &&
    value.waypoints.every(isPoint)
  );
}

function isPresentationStep(value: unknown): value is PresentationStep {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isStringArray(value.moduleIds) &&
    isStringArray(value.flowIds)
  );
}

function isDocument(value: unknown, starterId: StarterId): value is MoneyMapDocument {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    value.id === starterId &&
    typeof value.title === "string" &&
    typeof value.asOf === "string" &&
    isOneOf(value.style, [
      "private-ledger",
      "distribution-registry",
      "foundation",
      "conversion-path",
    ]) &&
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
