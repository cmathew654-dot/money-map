import { getScaffoldDocument } from "./scaffolds";
import { createStarterDocument, getStarterDefinition, starterRegistry } from "./registry";
import { STARTER_ARTBOARD, STARTER_IDS } from "./types";

const expectedStyles = {
  retirement: "private-ledger",
  rmd: "distribution-registry",
  annuity: "foundation",
  roth: "conversion-path",
} as const;

const expectedSteps = {
  retirement: [
    "Overview",
    "Income to household need",
    "Reserve withdrawals",
    "Reserve replenishment",
    "2026 RMD",
    "Annuity income",
  ],
  rmd: [
    "Overview",
    "Establish 2026 distribution",
    "Direct qualified charitable distribution",
    "Record withholding instructions",
    "Route net distribution",
    "Review year-end records",
  ],
  annuity: [
    "Overview",
    "Establish household income need",
    "Identify funding sources",
    "Author premium schedule",
    "Review contract and rider",
    "Connect income floor to need",
  ],
  roth: [
    "Overview",
    "Establish source and destination",
    "Frame 2026 conversion range",
    "Identify tax-payment source",
    "Review planning guardrails",
    "Stage the 2027 window",
  ],
} as const;

describe("starter registry", () => {
  it("exposes one exhaustive definition for each frozen starter and art direction", () => {
    expect(STARTER_IDS).toEqual(["retirement", "rmd", "annuity", "roth"]);
    expect(STARTER_ARTBOARD).toEqual({ x: 0, y: 0, width: 1440, height: 760 });
    expect(Object.keys(starterRegistry)).toEqual(STARTER_IDS);

    for (const id of STARTER_IDS) {
      const definition = getStarterDefinition(id);
      expect(definition.id).toBe(id);
      expect(definition.document.id).toBe(id);
      expect(definition.document.schemaVersion).toBe(2);
      expect(definition.document.style).toBe(expectedStyles[id]);
      expect(definition.chooser.eyebrow).not.toBe("");
      expect(definition.chooser.description).not.toBe("");
    }
  });

  it("returns deep-cloned documents while the compatibility alias remains isolated", () => {
    const first = createStarterDocument("annuity");
    const second = createStarterDocument("annuity");
    const compatibility = getScaffoldDocument("annuity");

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.modules).not.toBe(second.modules);
    expect(first.modules[0].rows).not.toBe(second.modules[0].rows);
    expect(first.flows[0].cadence).not.toBe(second.flows[0].cadence);
    expect(first.presentation).not.toBe(second.presentation);
    expect(compatibility).toEqual(second);
    expect(compatibility).not.toBe(second);

    first.modules[0].title = "Changed clone";
    expect(createStarterDocument("annuity").modules[0].title).not.toBe("Changed clone");
  });

  it("provides valid overview plus five named focus states for every scaffold", () => {
    for (const id of STARTER_IDS) {
      const document = createStarterDocument(id);
      expect(document.presentation.map(({ title }) => title)).toEqual(expectedSteps[id]);

      const moduleIds = document.modules.map(({ id: moduleId }) => moduleId);
      const rowIds = document.modules.flatMap(({ rows }) => rows.map(({ id: rowId }) => rowId));
      const flowIds = document.flows.map(({ id: flowId }) => flowId);
      const stepIds = document.presentation.map(({ id: stepId }) => stepId);
      for (const ids of [moduleIds, rowIds, flowIds, stepIds]) {
        expect(new Set(ids).size).toBe(ids.length);
      }

      const modules = new Set(moduleIds);
      const flows = new Map(document.flows.map((flow) => [flow.id, flow]));
      for (const flow of document.flows) {
        expect(modules.has(flow.source)).toBe(true);
        expect(modules.has(flow.target)).toBe(true);
        expect(flow.source).not.toBe(flow.target);
      }

      expect(document.presentation[0]).toMatchObject({
        id: "overview",
        moduleIds,
        flowIds,
      });

      for (const step of document.presentation.slice(1)) {
        expect(step.flowIds.length).toBeGreaterThan(0);
        for (const moduleId of step.moduleIds) expect(modules.has(moduleId)).toBe(true);
        for (const flowId of step.flowIds) {
          const flow = flows.get(flowId);
          expect(flow).toBeDefined();
          expect(step.moduleIds).toContain(flow?.source);
          expect(step.moduleIds).toContain(flow?.target);
        }
      }
    }
  });

  it("keeps scaffold geometry inside the shared artboard", () => {
    for (const id of STARTER_IDS) {
      const document = createStarterDocument(id);
      for (const module of document.modules) {
        expect(module.rotation % 15).toBe(0);
        expect(["quiet", "standard", "spotlight"]).toContain(module.priority);
        expect(["essential", "standard", "full"]).toContain(module.density);
        expect(module.colorRole).toBe(module.kind);
        expect(["base", "muted", "accent", "contrast"]).toContain(module.swatch);
        expect(Number.isFinite(module.height)).toBe(true);
        expect(Number.isFinite(module.zIndex)).toBe(true);
        expect(module.width).toBeGreaterThanOrEqual(220);
        expect(module.width).toBeLessThanOrEqual(480);
        expect(module.position.x).toBeGreaterThanOrEqual(STARTER_ARTBOARD.x);
        expect(module.position.y).toBeGreaterThanOrEqual(STARTER_ARTBOARD.y);
        expect(module.position.x + module.width).toBeLessThanOrEqual(STARTER_ARTBOARD.width);
        expect(module.position.y).toBeLessThanOrEqual(STARTER_ARTBOARD.height);
        expect(module.position.y + module.height).toBeLessThanOrEqual(STARTER_ARTBOARD.height);
      }
      expect(document.modules.map(({ zIndex }) => zIndex)).toEqual(
        document.modules.map((_module, index) => index),
      );
      for (const flow of document.flows) {
        expect(Number.isFinite(flow.labelPosition.x)).toBe(true);
        expect(Number.isFinite(flow.labelPosition.y)).toBe(true);
        expect(flow.labelPosition.x).toBeGreaterThanOrEqual(STARTER_ARTBOARD.x);
        expect(flow.labelPosition.x).toBeLessThanOrEqual(STARTER_ARTBOARD.width);
        expect(flow.labelPosition.y).toBeGreaterThanOrEqual(STARTER_ARTBOARD.y);
        expect(flow.labelPosition.y).toBeLessThanOrEqual(STARTER_ARTBOARD.height);
        for (const point of flow.waypoints) {
          expect(point.x).toBeGreaterThanOrEqual(STARTER_ARTBOARD.x);
          expect(point.x).toBeLessThanOrEqual(STARTER_ARTBOARD.width);
          expect(point.y).toBeGreaterThanOrEqual(STARTER_ARTBOARD.y);
          expect(point.y).toBeLessThanOrEqual(STARTER_ARTBOARD.height);
        }
      }
    }
  });

  // DESIGN.md: label treatment is a third redundant channel for relationship
  // semantics, alongside dash pattern and label text. Previously each starter
  // rotated filled/plate/plain to satisfy per-story "uses every treatment"
  // assertions, so two identical Roth transfers rendered differently and a
  // viewer could reasonably infer the dark chip meant something it didn't.
  // This invariant is what keeps treatment meaningful across all four.
  it("derives every authored label treatment from its relationship type", () => {
    const treatmentFor = {
      income: "filled",
      transfer: "plate",
      replenishment: "plain",
      planned: "plain",
    } as const;

    for (const id of STARTER_IDS) {
      const { flows } = createStarterDocument(id);
      expect(flows.length).toBeGreaterThan(0);
      for (const flow of flows) {
        expect(flow.labelTreatment, `${id}/${flow.id} is a ${flow.relationship} relationship`).toBe(
          treatmentFor[flow.relationship],
        );
      }
    }
  });
});
