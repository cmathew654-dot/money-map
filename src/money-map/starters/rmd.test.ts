import distributionRegistryCss from "../themes/distribution-registry.css?raw";
import { rmdStarter } from "./rmd";
import { STARTER_ARTBOARD } from "./types";

const expectedModuleIds = [
  "rmd-source",
  "rmd-instruction",
  "rmd-charitable",
  "rmd-federal",
  "rmd-state",
  "rmd-reserve",
  "rmd-need",
  "rmd-review",
];

const expectedFlowIds = [
  "rmd-establish",
  "rmd-qcd",
  "rmd-federal-withholding",
  "rmd-state-withholding",
  "rmd-net-distribution",
  "rmd-household-need",
  "rmd-year-end-review",
];

describe("RMD & Withholding starter", () => {
  it("authors the complete distribution register with exact synthetic literals", () => {
    const document = rmdStarter.document;

    expect(document).toMatchObject({
      id: "rmd",
      title: "RMD & Withholding",
      asOf: "As of July 2026",
      style: "distribution-registry",
    });
    expect(document.modules.map(({ id }) => id)).toEqual(expectedModuleIds);
    expect(document.flows.map(({ id }) => id)).toEqual(expectedFlowIds);

    expect(document.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rmd-source",
          primitive: "ledger",
          title: "Traditional IRA",
          rows: [
            expect.objectContaining({ label: "Balance", value: "$1,240,000" }),
            expect.objectContaining({ label: "2026 distribution", value: "$48,600 est." }),
          ],
        }),
        expect.objectContaining({
          id: "rmd-instruction",
          primitive: "plate",
          title: "2026 distribution instruction",
          note: "Advisor-authored amount and sequence",
        }),
        expect.objectContaining({
          id: "rmd-charitable",
          primitive: "band",
          title: "Qualified charitable distribution",
          rows: [
            expect.objectContaining({
              label: "Planned gift",
              value: "Up to $105,000 — advisor entered",
            }),
          ],
        }),
        expect.objectContaining({
          id: "rmd-federal",
          primitive: "band",
          title: "Federal withholding",
          rows: [expect.objectContaining({ label: "Instruction", value: "__% / $_____" })],
        }),
        expect.objectContaining({
          id: "rmd-state",
          primitive: "band",
          title: "State withholding",
          rows: [expect.objectContaining({ label: "Instruction", value: "__% / $_____" })],
        }),
        expect.objectContaining({
          id: "rmd-reserve",
          primitive: "tray",
          title: "Household reserve",
          rows: [
            expect.objectContaining({
              label: "Net deposit",
              value: "$_____ — advisor entered",
            }),
          ],
        }),
        expect.objectContaining({
          id: "rmd-need",
          primitive: "roundel",
          title: "Household need",
          total: expect.objectContaining({ value: "$12,500/mo" }),
        }),
        expect.objectContaining({
          id: "rmd-review",
          primitive: "frame",
          title: "Year-end records",
          rows: [
            expect.objectContaining({ label: "Form 1099-R", value: "Advisor review" }),
            expect.objectContaining({
              label: "Tax return",
              value: "Prepared outside Money Map",
            }),
          ],
        }),
      ]),
    );
  });

  it("covers every route, relationship, label treatment, cadence filter, and five primitives", () => {
    const { modules, flows } = rmdStarter.document;

    expect(new Set(flows.map(({ route }) => route))).toEqual(
      new Set(["straight", "orthogonal", "curved"]),
    );
    expect(new Set(flows.map(({ relationship }) => relationship))).toEqual(
      new Set(["flow", "association", "planned"]),
    );
    expect(new Set(flows.map(({ labelTreatment }) => labelTreatment))).toEqual(
      new Set(["plain", "plate", "filled"]),
    );
    expect(new Set(flows.map(({ cadence }) => cadence.kind))).toEqual(
      new Set(["monthly", "annual", "custom"]),
    );
    expect(new Set(modules.map(({ primitive }) => primitive)).size).toBeGreaterThanOrEqual(5);

    expect(flows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rmd-net-distribution",
          source: "rmd-instruction",
          target: "rmd-reserve",
          relationship: "flow",
          route: "orthogonal",
          labelTreatment: "plate",
          label: "Net distribution — advisor entered",
          cadence: { kind: "annual", label: "Annual" },
        }),
        expect.objectContaining({
          id: "rmd-household-need",
          source: "rmd-reserve",
          target: "rmd-need",
          relationship: "flow",
          route: "curved",
          labelTreatment: "plain",
          cadence: { kind: "monthly", label: "Monthly" },
        }),
        expect.objectContaining({
          id: "rmd-year-end-review",
          source: "rmd-instruction",
          target: "rmd-review",
          relationship: "association",
          route: "straight",
          labelTreatment: "plain",
          cadence: { kind: "custom", label: "At year-end" },
        }),
      ]),
    );
  });

  it("keeps every endpoint and presentation focus state complete", () => {
    const { modules, flows, presentation } = rmdStarter.document;
    const moduleIds = new Set(modules.map(({ id }) => id));
    const flowById = new Map(flows.map((flow) => [flow.id, flow]));

    expect(presentation.map(({ title }) => title)).toEqual([
      "Overview",
      "Establish 2026 distribution",
      "Direct qualified charitable distribution",
      "Record withholding instructions",
      "Route net distribution",
      "Review year-end records",
    ]);
    expect(presentation[0]).toMatchObject({
      id: "overview",
      moduleIds: expectedModuleIds,
      flowIds: expectedFlowIds,
    });

    for (const flow of flows) {
      expect(moduleIds.has(flow.source)).toBe(true);
      expect(moduleIds.has(flow.target)).toBe(true);
      expect(flow.source).not.toBe(flow.target);
    }
    for (const step of presentation.slice(1)) {
      expect(step.flowIds.length).toBeGreaterThan(0);
      for (const flowId of step.flowIds) {
        const flow = flowById.get(flowId);
        expect(flow).toBeDefined();
        expect(step.moduleIds).toContain(flow?.source);
        expect(step.moduleIds).toContain(flow?.target);
      }
    }

    expect(presentation[1].flowIds).toEqual(["rmd-establish"]);
    expect(presentation[2].flowIds).toEqual(["rmd-qcd"]);
    expect(presentation[3].flowIds).toEqual(["rmd-federal-withholding", "rmd-state-withholding"]);
    expect(presentation[4].flowIds).toEqual(["rmd-net-distribution", "rmd-household-need"]);
    expect(presentation[5].flowIds).toEqual(["rmd-year-end-review"]);
  });

  it("keeps authored geometry and reserved routing lanes inside the 1440×760 artboard", () => {
    const { modules, flows } = rmdStarter.document;
    const occupied = modules.map((module) => ({
      id: module.id,
      left: module.position.x,
      right: module.position.x + module.width,
      top: module.position.y,
    }));

    for (const module of modules) {
      expect(module.width).toBeGreaterThanOrEqual(220);
      expect(module.width).toBeLessThanOrEqual(480);
      expect(module.position.x).toBeGreaterThanOrEqual(STARTER_ARTBOARD.x);
      expect(module.position.y).toBeGreaterThanOrEqual(STARTER_ARTBOARD.y);
      expect(module.position.x + module.width).toBeLessThanOrEqual(STARTER_ARTBOARD.width);
      expect(module.position.y).toBeLessThanOrEqual(STARTER_ARTBOARD.height);
    }
    for (const flow of flows) {
      for (const point of flow.waypoints) {
        expect(point.x).toBeGreaterThanOrEqual(STARTER_ARTBOARD.x);
        expect(point.x).toBeLessThanOrEqual(STARTER_ARTBOARD.width);
        expect(point.y).toBeGreaterThanOrEqual(STARTER_ARTBOARD.y);
        expect(point.y).toBeLessThanOrEqual(STARTER_ARTBOARD.height);
      }
    }

    expect(occupied.find(({ id }) => id === "rmd-source")?.right).toBeLessThan(
      occupied.find(({ id }) => id === "rmd-instruction")?.left ?? 0,
    );
    expect(occupied.find(({ id }) => id === "rmd-instruction")?.right).toBeLessThan(
      occupied.find(({ id }) => id === "rmd-reserve")?.left ?? 0,
    );
  });

  it("places relationship labels on reserved register lanes", () => {
    const flowById = new Map(rmdStarter.document.flows.map((flow) => [flow.id, flow]));
    const moduleById = new Map(rmdStarter.document.modules.map((module) => [module.id, module]));

    expect(moduleById.get("rmd-instruction")?.position).toEqual({ x: 424, y: 274 });
    expect(flowById.get("rmd-qcd")?.waypoints).toEqual([{ x: 560, y: 180 }]);
    expect(flowById.get("rmd-federal-withholding")?.waypoints).toEqual([{ x: 600, y: 250 }]);
    expect(flowById.get("rmd-state-withholding")?.waypoints).toEqual([{ x: 500, y: 480 }]);
    expect(flowById.get("rmd-net-distribution")?.waypoints).toEqual([
      { x: 700, y: 480 },
      { x: 1004, y: 470 },
    ]);
    expect(flowById.get("rmd-household-need")?.waypoints).toEqual([{ x: 1226, y: 500 }]);
    expect(flowById.get("rmd-year-end-review")?.waypoints).toEqual([{ x: 1090, y: 258 }]);
  });
  it("keeps financial content literal and theme styling decorative only", () => {
    const serialized = JSON.stringify(rmdStarter.document);
    for (const literal of [
      "$1,240,000",
      "$48,600 est.",
      "Up to $105,000 — advisor entered",
      "__% / $_____",
      "$_____ — advisor entered",
      "$12,500/mo",
    ]) {
      expect(serialized).toContain(literal);
    }
    expect(serialized).not.toContain("Remainder after withholding");
    expect(serialized).not.toContain("calculated");
    expect(serialized).not.toContain("tax estimate");

    expect(distributionRegistryCss).toContain(".theme-distribution-registry");
    expect(distributionRegistryCss).not.toMatch(
      /\b(?:width|height|padding|margin|position|inset|transform|font-size|line-height)\s*:/i,
    );
    expect(distributionRegistryCss).not.toMatch(/\b(?:route|relationship|cadence)\b/i);
    expect(distributionRegistryCss).not.toContain("$");
  });
});
