import {
  DRAFT_PREFIX,
  clearDraft,
  createResilientStorage,
  draftKey,
  loadDraft,
  resolveEditorStorage,
  saveDraft,
  type StorageLike,
} from "./persistence";
import { createTestDocument } from "./test-fixtures";
import { createStarterDocument } from "../starters/registry";
import { STARTER_IDS } from "../starters/types";

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
  it("uses memory when browser storage is undefined", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, value: undefined });
    try {
      const storage = resolveEditorStorage();
      storage.setItem("undefined-storage", "available");
      expect(storage.getItem("undefined-storage")).toBe("available");
      storage.removeItem("undefined-storage");
      expect(storage.getItem("undefined-storage")).toBeNull();
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
      else Reflect.deleteProperty(window, "localStorage");
    }
  });

  it("uses memory when the browser storage getter throws SecurityError", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    try {
      const storage = resolveEditorStorage();
      storage.setItem("blocked-storage", "available");
      expect(storage.getItem("blocked-storage")).toBe("available");
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
      else Reflect.deleteProperty(window, "localStorage");
    }
  });

  it("falls back after getItem throws", () => {
    const fallback = new Map([["draft", "memory"]]);
    const storage = createResilientStorage(
      {
        getItem: () => {
          throw new DOMException("Blocked", "SecurityError");
        },
        setItem: () => undefined,
        removeItem: () => undefined,
      },
      fallback,
    );
    expect(storage.getItem("draft")).toBe("memory");
  });

  it("keeps writes in memory when setItem throws", () => {
    const storage = createResilientStorage(
      {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("Full", "QuotaExceededError");
        },
        removeItem: () => undefined,
      },
      new Map(),
    );
    expect(() => storage.setItem("draft", "memory")).not.toThrow();
    expect(storage.getItem("draft")).toBe("memory");
  });

  it("clears memory even when removeItem throws", () => {
    const storage = createResilientStorage(
      {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => {
          throw new DOMException("Blocked", "SecurityError");
        },
      },
      new Map([["draft", "memory"]]),
    );
    expect(() => storage.removeItem("draft")).not.toThrow();
    expect(storage.getItem("draft")).toBeNull();
  });

  it("uses and mirrors an ordinary storage implementation", () => {
    const primary = createStorage();
    const storage = createResilientStorage(primary, new Map());
    storage.setItem("draft", "primary");
    expect(primary.getItem("draft")).toBe("primary");
    expect(storage.getItem("draft")).toBe("primary");
    storage.removeItem("draft");
    expect(primary.getItem("draft")).toBeNull();
  });

  it("round-trips exact literal strings through JSON and storage", () => {
    const storage = createStorage();
    const document = createTestDocument();
    document.modules[0].rows[1].value = "$20,000\u2013?";
    document.modules[1].note = "\u2014";
    document.modules[2].rows[0].value = "\u2248$11,800/mo";
    document.flows[1].label = "$75,000\u2013$125,000";
    const literals = ["~$11,800/mo", "$20,000–?", "$_____", "$300,000 — revised illustration"];

    literals.push("$20,000\u2013?", "\u2014", "\u2248$11,800/mo", "$75,000\u2013$125,000");
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
    expect(DRAFT_PREFIX).toBe("money-map:v2:");
    expect(draftKey("roth")).toBe("money-map:v2:roth");
  });

  it.each([
    ["absent", null],
    ["malformed", "not json"],
    ["stale v1 version", JSON.stringify({ ...createTestDocument(), schemaVersion: 1 })],
    ["wrong starter", JSON.stringify({ ...createTestDocument(), id: "retirement" })],
    ["invalid style", JSON.stringify({ ...createTestDocument(), style: "unknown" })],
    ["corrupted literals", JSON.stringify({ ...createTestDocument(), title: 42 })],
  ])("returns the fallback for %s draft data", (_description, value) => {
    const storage = createStorage();
    const fallback = createTestDocument();
    if (value !== null) storage.setItem(draftKey("annuity"), value);

    expect(loadDraft(storage, "annuity", fallback)).toBe(fallback);
  });

  it("ignores an old v1 draft when loading the v2 starter key", () => {
    const storage = createStorage();
    const fallback = createTestDocument();
    storage.setItem("money-map:v1:annuity", JSON.stringify(fallback));

    expect(loadDraft(storage, "annuity", fallback)).toBe(fallback);
    expect(storage.getItem(draftKey("annuity"))).toBeNull();
  });

  it.each([
    ["height", (document: UnknownRecord) => (firstRecord(document, "modules").height = null)],
    ["rotation", (document: UnknownRecord) => (firstRecord(document, "modules").rotation = null)],
    ["zIndex", (document: UnknownRecord) => (firstRecord(document, "modules").zIndex = null)],
    [
      "module position",
      (document: UnknownRecord) => (asRecord(firstRecord(document, "modules").position).x = null),
    ],
    [
      "flow label position",
      (document: UnknownRecord) =>
        (firstRecord(document, "flows").labelPosition = { x: 0, y: null }),
    ],
  ])("rejects non-finite %s geometry", (_description, corrupt) => {
    const storage = createStorage();
    const fallback = createTestDocument();
    const corrupted = structuredClone(fallback) as unknown as UnknownRecord;
    corrupt(corrupted);
    storage.setItem(draftKey("annuity"), JSON.stringify(corrupted));

    expect(loadDraft(storage, "annuity", fallback)).toBe(fallback);
  });

  it.each([
    ["zero height", "height", 0],
    ["negative height", "height", -1],
    ["unsnapped rotation", "rotation", 22],
    ["fractional rotation step", "rotation", 7.5],
  ])("rejects %s", (_description, field, value) => {
    const storage = createStorage();
    const fallback = createTestDocument();
    const corrupted = structuredClone(fallback) as unknown as UnknownRecord;
    firstRecord(corrupted, "modules")[field] = value;
    storage.setItem(draftKey("annuity"), JSON.stringify(corrupted));

    expect(loadDraft(storage, "annuity", fallback)).toBe(fallback);
  });

  it.each([
    ["priority", "loud"],
    ["density", "verbose"],
    ["colorRole", "calculated"],
    ["swatch", "#ff0000"],
    ["primitive", "sphere"],
  ])("rejects an unknown module %s token", (field, value) => {
    const storage = createStorage();
    const fallback = createTestDocument();
    const corrupted = structuredClone(fallback) as unknown as UnknownRecord;
    firstRecord(corrupted, "modules")[field] = value;
    storage.setItem(draftKey("annuity"), JSON.stringify(corrupted));

    expect(loadDraft(storage, "annuity", fallback)).toBe(fallback);
  });

  it("validates all four authored v2 fixtures and preserves independent premium literals", () => {
    for (const id of STARTER_IDS) {
      const storage = createStorage();
      const fixture = createStarterDocument(id);
      saveDraft(storage, fixture);
      expect(loadDraft(storage, id, createStarterDocument(id))).toEqual(fixture);
      expect(fixture.schemaVersion).toBe(2);
    }

    const annuity = createStarterDocument("annuity");
    expect(JSON.stringify(annuity)).toContain("$300,000");
    expect(JSON.stringify(annuity)).toContain("$250,000");
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
      "label position",
      (document: UnknownRecord) =>
        (asRecord(firstRecord(document, "flows").labelPosition).magnitude = 1),
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
