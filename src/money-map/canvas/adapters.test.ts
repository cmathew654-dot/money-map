import { documentGeometry } from "../model/document";
import { createTestDocument } from "../model/test-fixtures";
import { documentToEdges, documentToNodes, moduleAriaLabel, moveModule } from "./adapters";

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

  it("maps authored route kinds to available built-in React Flow edge types", () => {
    const document = createTestDocument();
    const curvedDocument = {
      ...document,
      flows: [{ ...document.flows[0], route: "curved" as const }],
    };

    expect(
      documentToEdges(document, { moduleIds: [], flowIds: [] }).map((edge) => edge.type),
    ).toEqual(["step", "straight"]);
    expect(documentToEdges(curvedDocument, { moduleIds: [], flowIds: [] })[0].type).toBe("default");
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
});
