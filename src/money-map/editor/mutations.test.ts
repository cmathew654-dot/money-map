import { createTestDocument } from "../model/test-fixtures";
import { commitHistory, createHistory, redoHistory, undoHistory } from "../model/history";
import {
  createRelationship,
  editFlowField,
  editModuleField,
  moveFlowWaypoint,
  moveFlowLabel,
  nudgeSelection,
  reconnectFlow,
  resetFlowLabel,
  resetFlowWaypoint,
  setModuleColor,
  setModuleDensity,
  setModuleHeight,
  setModulePrimitive,
  setModulePriority,
  setModuleRotation,
  setModuleZIndex,
} from "./mutations";

describe("editor mutations", () => {
  const literalContent = (document: ReturnType<typeof createTestDocument>) =>
    document.modules.map(({ id, eyebrow, title, subtitle, rows, total, note }) => ({
      id,
      eyebrow,
      title,
      subtitle,
      rows,
      total,
      note,
    }));

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
    expect(nudged.flows[0].labelPosition).toEqual({ x: 344, y: 180 });
    expect(nudged.flows[1].labelPosition).toEqual({ x: 756, y: 214 });
    expect(nudged.flows[0].waypoints).toBe(document.flows[0].waypoints);
    expect(nudged.flows[1].waypoints).toBe(document.flows[1].waypoints);
  });

  it("nudges a flow's two endpoints once while translating singly-owned labels by half", () => {
    const document = createTestDocument();
    const nudged = nudgeSelection(
      document,
      { moduleIds: ["source-account", "annuity-policy"], flowIds: [] },
      { x: 32, y: -16 },
    );

    expect(nudged.flows[0].labelPosition).toEqual({ x: 392, y: 160 });
    expect(nudged.flows[1].labelPosition).toEqual({ x: 788, y: 202 });
    expect(nudged.modules[2]).toBe(document.modules[2]);
    expect(nudged.flows[0].waypoints).toBe(document.flows[0].waypoints);
    expect(nudged.flows[1].waypoints).toBe(document.flows[1].waypoints);
  });

  it("updates each v2 geometry/style field without changing literal content or unrelated records", () => {
    const document = createTestDocument();
    const content = structuredClone(literalContent(document));
    const unrelatedModule = document.modules[0];
    const flows = document.flows;
    const updated = [
      (current: typeof document) => setModuleHeight(current, "annuity-policy", 288),
      (current: typeof document) => setModuleRotation(current, "annuity-policy", 31),
      (current: typeof document) => setModulePriority(current, "annuity-policy", "spotlight"),
      (current: typeof document) => setModuleDensity(current, "annuity-policy", "essential"),
      (current: typeof document) =>
        setModuleColor(current, "annuity-policy", { colorRole: "income", swatch: "accent" }),
      (current: typeof document) => setModuleZIndex(current, "annuity-policy", 12),
      (current: typeof document) => setModulePrimitive(current, "annuity-policy", "cylinder"),
    ].reduce((current, mutate) => mutate(current), document);

    expect(updated.modules[1]).toMatchObject({
      height: 288,
      rotation: 30,
      priority: "spotlight",
      density: "essential",
      colorRole: "income",
      swatch: "accent",
      zIndex: 12,
      primitive: "cylinder",
    });
    expect(literalContent(updated)).toEqual(content);
    expect(updated.modules[0]).toBe(unrelatedModule);
    expect(updated.flows).toBe(flows);
  });

  it("snaps rotation to 15 degrees and undo/redo restores exact document states", () => {
    const document = createTestDocument();
    const rotated = setModuleRotation(document, "annuity-policy", 22);
    const committed = commitHistory(createHistory(document), rotated);
    const undone = undoHistory(committed);
    const redone = redoHistory(undone);

    expect(rotated.modules[1].rotation).toBe(15);
    expect(undone.present).toBe(document);
    expect(redone.present).toBe(rotated);
    expect(redone).toEqual(committed);
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
      labelPosition: { x: 546, y: 172.75 },
    });
    expect(reconnected.flows[0].waypoints).toBe(document.flows[0].waypoints);
    expect(
      reconnectFlow(document, "funding-flow", { source: "missing", target: "monthly-need" }),
    ).toBe(document);
  });

  it("keeps a translated label clear of a newly reconnected endpoint", () => {
    const document = createTestDocument();
    const starting = {
      ...document,
      flows: document.flows.map((flow) =>
        flow.id === "funding-flow"
          ? {
              ...flow,
              target: "monthly-need",
              labelPosition: { x: 600, y: 210 },
            }
          : flow,
      ),
    };

    const reconnected = reconnectFlow(starting, "funding-flow", {
      source: "source-account",
      target: "annuity-policy",
    });

    expect(reconnected.flows[0].labelPosition.x).toBeLessThanOrEqual(280);
    expect(reconnected.flows[0].labelPosition.y).toBe(213.25);
    expect(reconnected.flows[0].waypoints).toBe(document.flows[0].waypoints);
  });

  it("moves label position independently from authored route waypoints", () => {
    const document = createTestDocument();
    const waypoints = document.flows[0].waypoints;
    const labelPosition = document.flows[0].labelPosition;
    const labelMoved = moveFlowLabel(document, "funding-flow", { x: 444, y: 222 });
    const waypointMoved = moveFlowWaypoint(document, "funding-flow", { x: 555, y: 333 });

    expect(labelMoved.flows[0].labelPosition).toEqual({ x: 444, y: 222 });
    expect(labelMoved.flows[0].waypoints).toBe(waypoints);
    expect(waypointMoved.flows[0].waypoints[0]).toEqual({ x: 555, y: 333 });
    expect(waypointMoved.flows[0].labelPosition).toBe(labelPosition);
    expect(labelMoved.flows[1]).toBe(document.flows[1]);

    const resetLabel = resetFlowLabel(labelMoved, "funding-flow");
    expect(resetLabel.flows[0].labelPosition).toEqual({ x: 376, y: 205.25 });
    expect(resetLabel.flows[0].waypoints).toBe(waypoints);
  });

  it("rejects self reconnect and self creation with the exact original document", () => {
    const document = createTestDocument();
    expect(
      reconnectFlow(document, "funding-flow", {
        source: "source-account",
        target: "source-account",
      }),
    ).toBe(document);
    expect(createRelationship(document, "source-account", "source-account", () => "self")).toBe(
      document,
    );
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
      relationship: "transfer",
      route: "curved",
      labelTreatment: "plate",
      label: "New transfer",
      cadence: { kind: "as-needed", label: "As needed" },
      labelPosition: { x: 562, y: 202 },
      waypoints: [],
    });
    expect(created.modules).toBe(document.modules);
  });
});
