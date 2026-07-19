import {
  documentGeometry,
  duplicateSelection,
  removeSelection,
  updateFlow,
  updateModule,
} from "./document";
import { createHistory, undoHistory } from "./history";
import { createTestDocument } from "./test-fixtures";
import type { MoneyMapDocument } from "./types";

describe("literal-safe money map document", () => {
  it("keeps a larger annuity premium and smaller source balance as independent display strings", () => {
    const document = createTestDocument();
    const snapshot = structuredClone(document);

    expect(document.modules[0].rows[0].value).toBe("$250,000");
    expect(document.modules[1].total?.value).toBe("$300,000");
    expect(document).toEqual(snapshot);
    const collectKeys = (candidate: unknown): string[] => {
      if (Array.isArray(candidate)) return candidate.flatMap(collectKeys);
      if (typeof candidate !== "object" || candidate === null) return [];
      return Object.entries(candidate).flatMap(([key, nested]) => [key, ...collectKeys(nested)]);
    };
    const keys = collectKeys(document);
    for (const forbiddenKey of [
      "amount",
      "balance",
      "capacity",
      "computedTotal",
      "debit",
      "fill",
      "remainder",
      "taxRate",
      "warning",
    ]) {
      expect(keys).not.toContain(forbiddenKey);
    }
  });

  it("updates one row without changing unrelated module or flow references", () => {
    const document = createTestDocument();
    const originalSource = document.modules[0];
    const originalNeed = document.modules[2];
    const originalFlows = document.flows;

    const updated = updateModule(document, "annuity-policy", (module) => ({
      ...module,
      rows: module.rows.map((row) => (row.id === "income" ? { ...row, value: "$12,100/mo" } : row)),
    }));

    expect(updated.modules[1].rows[1].value).toBe("$12,100/mo");
    expect(updated.modules[0]).toBe(originalSource);
    expect(updated.modules[2]).toBe(originalNeed);
    expect(updated.flows).toBe(originalFlows);
    expect(document.modules[1].rows[1].value).toBe("~$11,800/mo");
  });

  it("returns the original document when an update target is missing", () => {
    const document = createTestDocument();

    expect(updateModule(document, "missing", (module) => module)).toBe(document);
    expect(updateFlow(document, "missing", (flow) => flow)).toBe(document);
  });

  it("updates one flow without changing module or unrelated flow references", () => {
    const document = createTestDocument();
    const originalModules = document.modules;
    const unrelatedFlow = document.flows[1];

    const updated = updateFlow(document, "funding-flow", (flow) => ({
      ...flow,
      label: "$300,000 — revised illustration",
    }));

    expect(updated.flows[0].label).toBe("$300,000 — revised illustration");
    expect(updated.modules).toBe(originalModules);
    expect(updated.flows[1]).toBe(unrelatedFlow);
  });

  it("does not let equal-length financial display text affect geometry", () => {
    const document = createTestDocument();
    const replaceDisplayText = (value: string) => "9".repeat(value.length);
    const replaced: MoneyMapDocument = {
      ...document,
      modules: document.modules.map((module) => ({
        ...module,
        rows: module.rows.map((row) => ({ ...row, value: replaceDisplayText(row.value) })),
        total: module.total
          ? { ...module.total, value: replaceDisplayText(module.total.value) }
          : undefined,
      })),
      flows: document.flows.map((flow) => ({
        ...flow,
        label: replaceDisplayText(flow.label),
        secondaryLabel: flow.secondaryLabel ? replaceDisplayText(flow.secondaryLabel) : undefined,
      })),
    };

    expect(documentGeometry(replaced)).toEqual(documentGeometry(document));
  });

  it("removes selected modules, selected flows, and attached flows in one undoable change", () => {
    const document = createTestDocument();
    const removed = removeSelection(document, {
      moduleIds: ["annuity-policy"],
      flowIds: [],
    });

    expect(removed.modules.map(({ id }) => id)).toEqual(["source-account", "monthly-need"]);
    expect(removed.flows).toEqual([]);

    const restored = undoHistory({ past: [document], present: removed, future: [] });
    expect(restored.present).toBe(document);
    expect(restored.present).toEqual(createHistory(document).present);
  });

  it("preserves untouched collection references during selection removal", () => {
    const document = createTestDocument();
    const flowOnly = removeSelection(document, { moduleIds: [], flowIds: ["income-flow"] });

    expect(flowOnly.modules).toBe(document.modules);
    expect(flowOnly.flows).not.toBe(document.flows);

    const unchanged = removeSelection(document, {
      moduleIds: ["missing-module"],
      flowIds: ["missing-flow"],
    });
    expect(unchanged).toBe(document);
    expect(unchanged.modules).toBe(document.modules);
    expect(unchanged.flows).toBe(document.flows);
  });

  it("duplicates selected modules with exact offsets and only their internal flows", () => {
    const document = createTestDocument();
    const suppliedIds = [
      "copy-source",
      "copy-source-value",
      "copy-range",
      "copy-annuity",
      "copy-premium",
      "copy-income",
      "copy-placeholder",
      "copy-flow",
    ];
    const calls: string[] = [];
    const createId = (kind: string) => {
      calls.push(kind);
      const id = suppliedIds.shift();
      if (!id) throw new Error("Unexpected ID request");
      return id;
    };

    const duplicated = duplicateSelection(
      document,
      { moduleIds: ["source-account", "annuity-policy"], flowIds: ["income-flow"] },
      createId,
    );

    expect(duplicated.modules.slice(-2).map(({ id, position }) => ({ id, position }))).toEqual([
      { id: "copy-source", position: { x: 72, y: 112 } },
      { id: "copy-annuity", position: { x: 452, y: 144 } },
    ]);
    expect(duplicated.flows.slice(-1)[0]).toMatchObject({
      id: "copy-flow",
      source: "copy-source",
      target: "copy-annuity",
    });
    expect(duplicated.flows).toHaveLength(3);
    expect(duplicated.modules.at(-2)?.rows.map(({ id }) => id)).toEqual([
      "copy-source-value",
      "copy-range",
    ]);
    expect(duplicated.modules.at(-1)?.rows.map(({ id }) => id)).toEqual([
      "copy-premium",
      "copy-income",
      "copy-placeholder",
    ]);
    expect(calls).toEqual(["module", "row", "row", "module", "row", "row", "row", "flow"]);
  });
});
