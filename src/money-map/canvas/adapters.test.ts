import { documentGeometry } from "../model/document";
import { createTestDocument } from "../model/test-fixtures";
import {
  documentToEdges,
  documentToNodes,
  moduleAriaLabel,
  moveModule,
  selectionForCadence,
} from "./adapters";

describe("canvas document adapters", () => {
  it("preserves literal strings and geometry independently", () => {
    const document = createTestDocument();
    const changedLiteral = {
      ...document,
      modules: document.modules.map((module, index) =>
        index === 0
          ? {
              ...module,
              rows: module.rows.map((row, rowIndex) =>
                rowIndex === 0 ? { ...row, value: "$999,999-ish?" } : row,
              ),
            }
          : module,
      ),
    };

    const nodes = documentToNodes(document, { moduleIds: [], flowIds: [] });
    const changedNodes = documentToNodes(changedLiteral, { moduleIds: [], flowIds: [] });

    expect(nodes[0].data.module.rows[0].value).toBe("$250,000");
    expect(changedNodes[0].data.module.rows[0].value).toBe("$999,999-ish?");
    expect(nodes.map(({ position, style }) => ({ position, style }))).toEqual(
      changedNodes.map(({ position, style }) => ({ position, style })),
    );
    expect(nodes[0].position).toEqual({ x: 40, y: 80 });
    expect(nodes[0].style).toEqual({ width: 280 });
    expect(nodes[0]).not.toHaveProperty("height");
    expect(nodes[0]).not.toHaveProperty("initialHeight");
    expect(nodes[0]).not.toHaveProperty("measured");
  });

  it("joins exact authored fragments without inspecting or punctuating them", () => {
    const module = {
      ...createTestDocument().modules[1],
      title: "What now?",
      subtitle: "Approx. $20,000–?",
      total: { label: "Target.", value: "$_____" },
    };

    const label = moduleAriaLabel(module, 2);

    expect(label).toBe(
      "Kind: income | Title: What now? | Subtitle: Approx. $20,000–? | Total: Target. $_____ | 2 outgoing relationships",
    );
    expect(label).toContain("What now?");
    expect(label).toContain("Approx. $20,000–?");
    expect(label).toContain("Target.");
    expect(label).toContain("$_____");
    expect(label).not.toContain("What now?.");
    expect(label).not.toContain("$_____.");
  });

  it("keeps authored totals ending in punctuation byte-for-byte", () => {
    const module = {
      ...createTestDocument().modules[1],
      total: { label: "Range", value: "~$11,800/mo?" },
    };

    const label = moduleAriaLabel(module, 1);

    expect(label).toContain("Total: Range ~$11,800/mo?");
    expect(label).not.toContain("~$11,800/mo?.");
    expect(label).toContain("1 outgoing relationship");
  });

  it("moves only the target module and preserves literal text and references", () => {
    const document = createTestDocument();
    const beforeGeometry = documentGeometry(document);
    const moved = moveModule(document, "annuity-policy", { x: 512, y: 248 });

    expect(moved).not.toBe(document);
    expect(moved.modules[0]).toBe(document.modules[0]);
    expect(moved.modules[1]).not.toBe(document.modules[1]);
    expect(moved.modules[1].position).toEqual({ x: 512, y: 248 });
    expect(moved.modules[1].rows).toBe(document.modules[1].rows);
    expect(moved.modules[1].total).toBe(document.modules[1].total);
    expect(moved.flows).toBe(document.flows);
    expect(beforeGeometry.modules[0]).toEqual(documentGeometry(moved).modules[0]);
    expect(moveModule(document, "missing", { x: 1, y: 2 })).toBe(document);
  });

  it("maps every relationship to the shared custom edge and preserves authored route data", () => {
    const document = createTestDocument();
    const curvedDocument = {
      ...document,
      flows: [{ ...document.flows[0], route: "curved" as const }],
    };

    expect(
      documentToEdges(document, { moduleIds: [], flowIds: [] }).map((edge) => edge.type),
    ).toEqual(["moneyMapRelationship", "moneyMapRelationship"]);
    expect(
      documentToEdges(curvedDocument, { moduleIds: [], flowIds: [] })[0].data?.flow.route,
    ).toBe("curved");
  });

  it("attaches relationships to deterministic sides from authored geometry", () => {
    const document = createTestDocument();
    const edges = documentToEdges(document, { moduleIds: [], flowIds: [] });

    expect(
      edges.map(({ id, sourceHandle, targetHandle }) => ({ id, sourceHandle, targetHandle })),
    ).toEqual([
      {
        id: "funding-flow",
        sourceHandle: "source-right",
        targetHandle: "target-left",
      },
      {
        id: "income-flow",
        sourceHandle: "source-right",
        targetHandle: "target-left",
      },
    ]);

    const vertical = {
      ...document,
      modules: document.modules.map((module, index) =>
        index === 1 ? { ...module, position: { x: 40, y: -260 } } : module,
      ),
      flows: [{ ...document.flows[0], target: "annuity-policy", waypoints: [] }],
    };
    expect(documentToEdges(vertical, { moduleIds: [], flowIds: [] })[0]).toMatchObject({
      sourceHandle: "source-right",
      targetHandle: "target-left",
    });
  });

  it("counts modules and relationships together for one mixed-selection halo anchor", () => {
    const document = createTestDocument();
    const mixed = documentToNodes(document, {
      moduleIds: ["annuity-policy"],
      flowIds: ["income-flow"],
    });

    expect(mixed.find(({ id }) => id === "annuity-policy")?.data).toMatchObject({
      selectionCount: 2,
      selectionModuleIds: ["annuity-policy"],
      haloAnchor: true,
    });
    expect(mixed.filter(({ data }) => data.haloAnchor)).toHaveLength(1);

    const multiple = documentToNodes(document, {
      moduleIds: ["source-account", "annuity-policy"],
      flowIds: [],
    });
    expect(multiple[0].data.selectionCount).toBe(2);
    expect(multiple.filter(({ data }) => data.haloAnchor)).toHaveLength(1);
  });

  it("enables reconnect completion only for exactly one selected relationship", () => {
    const document = createTestDocument();
    const single = { moduleIds: [], flowIds: ["funding-flow"] };
    const nodes = documentToNodes(document, single);
    const edges = documentToEdges(document, single);
    expect(nodes.every(({ data }) => data.reconnectMode && !data.connectMode)).toBe(true);
    expect(edges.find(({ id }) => id === "funding-flow")?.reconnectable).toBe(true);
    expect(edges.find(({ id }) => id === "income-flow")?.reconnectable).toBe(false);

    const mixed = documentToNodes(document, {
      moduleIds: ["annuity-policy"],
      flowIds: ["funding-flow"],
    });
    expect(mixed.every(({ data }) => !data.reconnectMode)).toBe(true);
    expect(
      documentToEdges(document, { moduleIds: [], flowIds: [] }).every(
        ({ reconnectable }) => !reconnectable,
      ),
    ).toBe(true);
  });

  it("atomically removes only relationships hidden by a transient cadence filter", () => {
    const document = createTestDocument();
    const selection = {
      moduleIds: ["annuity-policy"],
      flowIds: ["funding-flow", "income-flow"],
    };
    expect(selectionForCadence(document, selection, "monthly")).toEqual({
      moduleIds: ["annuity-policy"],
      flowIds: ["income-flow"],
    });
    expect(selectionForCadence(document, selection, "all")).toBe(selection);
  });

  it("projects a presentation step without changing geometry or enabling author interaction", () => {
    const document = createTestDocument();
    const step = {
      id: "focus",
      title: "Focused state",
      moduleIds: [document.modules[0].id],
      flowIds: [document.flows[0].id],
    };
    const nodes = documentToNodes(document, { moduleIds: [], flowIds: [] }, false, step);
    const edges = documentToEdges(document, { moduleIds: [], flowIds: [] }, "all", step);

    expect(nodes.map(({ position, style }) => ({ position, style }))).toEqual(
      documentToNodes(document, { moduleIds: [], flowIds: [] }).map(({ position, style }) => ({
        position,
        style,
      })),
    );
    expect(
      nodes.every(
        ({ focusable, draggable, selectable }) => !focusable && !draggable && !selectable,
      ),
    ).toBe(true);
    expect(nodes.find(({ id }) => id === step.moduleIds[0])?.data.presentationFocus).toBe(true);
    expect(nodes.find(({ id }) => id !== step.moduleIds[0])?.data.presentationFocus).toBe(false);
    expect(
      edges.every(
        ({ focusable, reconnectable, selectable }) => !focusable && !reconnectable && !selectable,
      ),
    ).toBe(true);
    expect(edges.find(({ id }) => id === step.flowIds[0])?.data?.presentationFocus).toBe(true);
  });
});
