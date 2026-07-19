import {
  DRAFT_PREFIX,
  clearDraft,
  draftKey,
  loadDraft,
  saveDraft,
  type StorageLike,
} from "./persistence";
import { createTestDocument } from "./test-fixtures";

function createStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

type UnknownRecord = Record<string, unknown>;

function asRecord(candidate: unknown): UnknownRecord {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    throw new Error("Expected record fixture");
  }
  return candidate as UnknownRecord;
}

function recordAt(parent: UnknownRecord, key: string, index: number): UnknownRecord {
  const candidates = parent[key];
  if (!Array.isArray(candidates) || candidates.length <= index) {
    throw new Error(`Expected ${key} fixture at index ${index}`);
  }
  return asRecord(candidates[index]);
}

function firstRecord(parent: UnknownRecord, key: string): UnknownRecord {
  return recordAt(parent, key, 0);
}

describe("draft persistence", () => {
  it("round-trips exact literal strings through JSON and storage", () => {
    const storage = createStorage();
    const document = createTestDocument();
    const literals = ["~$11,800/mo", "$20,000–?", "$_____", "$300,000 — revised illustration"];

    const jsonRoundTrip = JSON.parse(JSON.stringify(document)) as typeof document;
    saveDraft(storage, document);
    const loaded = loadDraft(storage, "annuity", createTestDocument());

    for (const literal of literals) {
      expect(JSON.stringify(jsonRoundTrip)).toContain(literal);
      expect(JSON.stringify(loaded)).toContain(literal);
    }
    expect(loaded).toEqual(document);
  });

  it("uses a versioned starter-specific key", () => {
    expect(DRAFT_PREFIX).toBe("money-map:v1:");
    expect(draftKey("roth")).toBe("money-map:v1:roth");
  });

  it.each([
    ["absent", null],
    ["malformed", "not json"],
    ["wrong version", JSON.stringify({ ...createTestDocument(), schemaVersion: 2 })],
    ["wrong starter", JSON.stringify({ ...createTestDocument(), id: "retirement" })],
    ["invalid style", JSON.stringify({ ...createTestDocument(), style: "unknown" })],
    ["corrupted literals", JSON.stringify({ ...createTestDocument(), title: 42 })],
  ])("returns the fallback for %s draft data", (_description, value) => {
    const storage = createStorage();
    const fallback = createTestDocument();
    if (value !== null) storage.setItem(draftKey("annuity"), value);

    expect(loadDraft(storage, "annuity", fallback)).toBe(fallback);
  });

  it("clears only the selected starter draft", () => {
    const storage = createStorage();
    storage.setItem(draftKey("annuity"), "annuity");
    storage.setItem(draftKey("roth"), "roth");

    clearDraft(storage, "annuity");

    expect(storage.getItem(draftKey("annuity"))).toBeNull();
    expect(storage.getItem(draftKey("roth"))).toBe("roth");
  });

  it.each([
    "balance",
    "amount",
    "taxRate",
    "capacity",
    "fill",
    "warning",
    "computedTotal",
    "debit",
    "remainder",
  ])("returns the exact fallback when nested payload data contains forbidden key %s", (key) => {
    const storage = createStorage();
    const fallback = createTestDocument();
    const corrupted = {
      ...createTestDocument(),
      extra: { nested: { [key]: 1 } },
    };
    storage.setItem(draftKey("annuity"), JSON.stringify(corrupted));

    expect(loadDraft(storage, "annuity", fallback)).toBe(fallback);
  });

  it.each([
    ["document", (document: UnknownRecord) => (document.accountBalance = 1)],
    ["module", (document: UnknownRecord) => (firstRecord(document, "modules").annualAmount = 1)],
    [
      "row",
      (document: UnknownRecord) =>
        (firstRecord(firstRecord(document, "modules"), "rows").premiumAmount = 1),
    ],
    ["flow", (document: UnknownRecord) => (firstRecord(document, "flows").warningMessage = 1)],
    [
      "total",
      (document: UnknownRecord) =>
        (asRecord(recordAt(document, "modules", 1).total).computedValue = 1),
    ],
    [
      "cadence",
      (document: UnknownRecord) =>
        (asRecord(firstRecord(document, "flows").cadence).taxPercent = 1),
    ],
    [
      "waypoint",
      (document: UnknownRecord) =>
        (firstRecord(firstRecord(document, "flows"), "waypoints").magnitude = 1),
    ],
    [
      "presentation step",
      (document: UnknownRecord) => (firstRecord(document, "presentation").calculatedOrder = 1),
    ],
  ])("returns the exact fallback for an unknown %s key", (_level, corrupt) => {
    const storage = createStorage();
    const fallback = createTestDocument();
    const corrupted = structuredClone(createTestDocument()) as unknown as UnknownRecord;
    corrupt(corrupted);
    storage.setItem(draftKey("annuity"), JSON.stringify(corrupted));

    expect(loadDraft(storage, "annuity", fallback)).toBe(fallback);
  });
});
