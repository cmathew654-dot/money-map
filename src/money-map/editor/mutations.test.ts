import { createTestDocument } from "../model/test-fixtures";
import {
  createRelationship,
  editFlowField,
  editModuleField,
  moveFlowWaypoint,
  nudgeSelection,
  reconnectFlow,
  resetFlowWaypoint,
} from "./mutations";

describe("editor mutations", () => {
  it("edits one nested literal while preserving unrelated references and data", () => {
    const document = createTestDocument();
    const edited = editModuleField(
      document,
      "annuity-policy",
      { field: "row-value", rowId: "income" },
      "$20,000\u2013?",
    );
    expect(edited.modules[1].rows[1].value).toBe("$20,000\u2013?");
    expect(edited.modules[0]).toBe(document.modules[0]);
    expect(edited.modules[1].rows[0]).toBe(document.modules[1].rows[0]);
    expect(edited.flows).toBe(document.flows);
  });

  it("nudges selected modules by 8 or 32 world pixels without touching literals", () => {
    const document = createTestDocument();
    const selection = { moduleIds: ["annuity-policy"], flowIds: [] };
    const nudged = nudgeSelection(document, selection, { x: -32, y: 8 });
    expect(nudged.modules[1].position).toEqual({
      x: document.modules[1].position.x - 32,
      y: document.modules[1].position.y + 8,
    });
    expect(nudged.modules[1].rows).toBe(document.modules[1].rows);
    expect(nudged.modules[0]).toBe(document.modules[0]);
  });
});

describe("relationship mutations", () => {
  it("round-trips exact label and custom cadence strings without touching financial content", () => {
    const document = createTestDocument();
    const label = "$20,000–? — $_____";
    const cadence = "Beginning in 2027 — after the sale closes";
    const edited = editFlowField(document, "funding-flow", { field: "label" }, label);
    const recadenced = editFlowField(
      edited,
      "funding-flow",
      { field: "cadence", kind: "custom" },
      cadence,
    );
    expect(recadenced.flows[0].label).toBe(label);
    expect(recadenced.flows[0].cadence).toEqual({ kind: "custom", label: cadence });
    expect(recadenced.modules).toBe(document.modules);
    expect(recadenced.modules[0].rows[0].value).toBe("$250,000");
    expect(recadenced.modules[1].total?.value).toBe("$300,000");
    expect(recadenced.flows[1]).toBe(document.flows[1]);
  });

  it("moves, resets, and reconnects only the target relationship", () => {
    const document = createTestDocument();
    const moved = moveFlowWaypoint(document, "funding-flow", { x: 440, y: 220 });
    expect(moved.flows[0].waypoints[0]).toEqual({ x: 440, y: 220 });
    expect(moved.flows[1]).toBe(document.flows[1]);
    expect(resetFlowWaypoint(moved, "funding-flow").flows[0].waypoints).toEqual([]);

    const reconnected = reconnectFlow(document, "funding-flow", {
      source: "source-account",
      target: "monthly-need",
    });
    expect(reconnected.flows[0]).toMatchObject({
      source: "source-account",
      target: "monthly-need",
    });
    expect(
      reconnectFlow(document, "funding-flow", { source: "missing", target: "monthly-need" }),
    ).toBe(document);
  });

  it("creates one neutral relationship with an injected stable ID", () => {
    const document = createTestDocument();
    const created = createRelationship(
      document,
      "source-account",
      "monthly-need",
      () => "new-flow",
    );
    expect(created.flows.at(-1)).toEqual({
      id: "new-flow",
      source: "source-account",
      target: "monthly-need",
      relationship: "flow",
      route: "curved",
      labelTreatment: "plate",
      label: "New relationship",
      cadence: { kind: "as-needed", label: "As needed" },
      waypoints: [],
    });
    expect(created.modules).toBe(document.modules);
  });
});
