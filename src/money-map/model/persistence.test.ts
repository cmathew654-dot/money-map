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
});
