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
    expect(nodes[0].style).toMatchObject({ width: 280 });
    expect(nodes[0]).toMatchObject({
      initialWidth: 280,
      initialHeight: 152,
      measured: { width: 280, height: 152 },
    });
  });

  it("builds a useful accessible label without changing authored text", () => {
    const module = createTestDocument().modules[1];

    expect(moduleAriaLabel(module, 2)).toBe(
      "Income. Illustrative annuity. Illustrative premium: $300,000. 2 outgoing relationships.",
    );
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
});
