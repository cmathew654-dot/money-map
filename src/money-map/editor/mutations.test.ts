import { createTestDocument } from "../model/test-fixtures";
import { commitHistory, createHistory, redoHistory, undoHistory } from "../model/history";
import type { MoneyMapDocument, MoneyMapModule, Point, StarterId } from "../model/types";
import { createStarterDocument, starterRegistry } from "../starters/registry";

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

// The renderer's label floor (100x36 in world units) and the graze allowance
// that separates touching a card edge from sitting on the card. Restated here
// rather than imported: this is the contract the search has to satisfy, and a
// test that borrows the implementation's own constants cannot catch the
// implementation redefining them.
function coveredModuleIds(document: MoneyMapDocument, labelPosition: Point): string[] {
  return document.modules
    .filter((module) => {
      const overlapWidth =
        Math.min(labelPosition.x + 50, module.position.x + module.width) -
        Math.max(labelPosition.x - 50, module.position.x);
      const overlapHeight =
        Math.min(labelPosition.y + 18, module.position.y + module.height) -
        Math.max(labelPosition.y - 18, module.position.y);
      return overlapWidth > 8 && overlapHeight > 8;
    })
    .map(({ id }) => id);
}

function moduleCenter(module: MoneyMapModule): Point {
  return {
    x: module.position.x + module.width / 2,
    y: module.position.y + module.height / 2,
  };
}

// Restated independently from the canvas/model contract: reconnect grabs are
// radius-26 circles on the dominant-axis attachment side (horizontal wins
// ties), and may graze the 100x36 label box by at most 8 world units.
function attachmentPoint(module: MoneyMapModule, toward: Point): Point {
  const center = moduleCenter(module);
  const deltaX = toward.x - center.x;
  const deltaY = toward.y - center.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return { x: deltaX >= 0 ? module.position.x + module.width : module.position.x, y: center.y };
  }
  return { x: center.x, y: deltaY >= 0 ? module.position.y + module.height : module.position.y };
}

function grabCoversLabel(circleCenter: Point, labelPosition: Point): boolean {
  const nearest = {
    x: Math.max(labelPosition.x - 50, Math.min(circleCenter.x, labelPosition.x + 50)),
    y: Math.max(labelPosition.y - 18, Math.min(circleCenter.y, labelPosition.y + 18)),
  };
  return 26 - Math.hypot(nearest.x - circleCenter.x, nearest.y - circleCenter.y) > 8;
}

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
    });
    // Asserted as a property, not a coordinate. The literal this replaced,
    // (546, 172.75), sat inside annuity-policy (x 420-724, y 112-359) — the
    // fixture was recording the defect, so updating the numbers would have
    // re-recorded it.
    expect(coveredModuleIds(reconnected, reconnected.flows[0].labelPosition)).toEqual([]);
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

    // Translating the author's placement alone would land on annuity-policy,
    // so the translation has to be followed by a clearance pass...
    const translatedOnly = { x: 414, y: 213.25 };
    expect(coveredModuleIds(reconnected, translatedOnly)).toEqual(["annuity-policy"]);

    // ...and the pass has to clear it of every card, including source-account,
    // which the previous single-rect push shoved it onto. The literal this
    // replaced asserted x <= 280 — a label centred inside source-account.
    expect(coveredModuleIds(reconnected, reconnected.flows[0].labelPosition)).toEqual([]);
    expect(reconnected.flows[0].waypoints).toBe(document.flows[0].waypoints);
  });

  // Exhaustive rather than sampled: the defect this replaced was invisible to
  // hand-picked fixtures because clearing the two endpoints is exactly what the
  // old code did — it was the third card it pushed the label onto that nobody
  // wrote a case for. Sweeping every reconnection the UI can produce, on the
  // authored starters, is the only version of this assertion that could have
  // caught it.
  it("never parks a reconnected label on an unrelated card or endpoint grab", () => {
    const offenders: string[] = [];
    let reconnections = 0;

    for (const starterId of Object.keys(starterRegistry) as StarterId[]) {
      const document = createStarterDocument(starterId);
      for (const flow of document.flows) {
        for (const source of document.modules) {
          for (const target of document.modules) {
            if (source.id === target.id) continue;
            if (source.id === flow.source && target.id === flow.target) continue;
            reconnections += 1;

            const next = reconnectFlow(document, flow.id, {
              source: source.id,
              target: target.id,
            });
            const moved = next.flows.find(({ id }) => id === flow.id)!;
            const unrelated = coveredModuleIds(document, moved.labelPosition).filter(
              (moduleId) => moduleId !== source.id && moduleId !== target.id,
            );
            const sourceGrab = attachmentPoint(source, flow.waypoints[0] ?? moduleCenter(target));
            const targetGrab = attachmentPoint(
              target,
              flow.waypoints.at(-1) ?? moduleCenter(source),
            );
            if (grabCoversLabel(sourceGrab, moved.labelPosition)) {
              offenders.push(
                [
                  starterId,
                  "/",
                  flow.id,
                  " ",
                  source.id,
                  "->",
                  target.id,
                  " source-grab collision",
                ].join(""),
              );
            }
            if (grabCoversLabel(targetGrab, moved.labelPosition)) {
              offenders.push(
                [
                  starterId,
                  "/",
                  flow.id,
                  " ",
                  source.id,
                  "->",
                  target.id,
                  " target-grab collision",
                ].join(""),
              );
            }
            if (unrelated.length > 0) {
              offenders.push(
                `${starterId}/${flow.id} ${source.id}->${target.id} covers ${unrelated.join(", ")}`,
              );
            }
          }
        }
      }
    }

    // The probe has to be able to fail: if reconnectFlow ever stopped producing
    // work, an empty offender list would read as a pass.
    expect(reconnections).toBeGreaterThan(1400);
    const requiredProbe =
      "annuity/annuity-source-plan annuity-source->annuity-policy target-grab collision";
    expect({
      count: offenders.length,
      sample: offenders.includes(requiredProbe) ? requiredProbe : (offenders[0] ?? null),
    }).toEqual({ count: 0, sample: null });
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

  it("rejects same-direction and reverse-direction duplicate creation", () => {
    const document = createTestDocument();
    expect(
      createRelationship(document, "source-account", "annuity-policy", () => "duplicate"),
    ).toBe(document);
    expect(createRelationship(document, "annuity-policy", "source-account", () => "reverse")).toBe(
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
      // Not the centre-to-centre midpoint (562, 202): the route from
      // source-account to monthly-need passes straight through annuity-policy
      // (x 420-724, y 112-359), so that midpoint put the label squarely on top
      // of a card — on the very first thing a user does after drawing a flow.
      // The label now clears above it, by the smallest displacement that does.
      labelPosition: { x: 570.4605682741974, y: 82.29862663913315 },
      waypoints: [],
    });
    expect(created.modules).toBe(document.modules);
  });

  it("keeps a new relationship label clear of every module it crosses", () => {
    const document = createTestDocument();
    const created = createRelationship(
      document,
      "source-account",
      "monthly-need",
      () => "crossing-flow",
    );
    const { labelPosition } = created.flows.at(-1)!;

    // Asserted as geometry rather than a fixed point, so the guarantee
    // survives any future retuning of the search.
    expect(coveredModuleIds(created, labelPosition)).toEqual([]);
  });

  it("uses the active authored cadence when one is supplied", () => {
    const document = createTestDocument();
    const created = createRelationship(
      document,
      "source-account",
      "monthly-need",
      () => "monthly-flow",
      { kind: "monthly", label: "Monthly" },
    );
    expect(created.flows.at(-1)?.cadence).toEqual({ kind: "monthly", label: "Monthly" });
  });
});
