import { readFileSync } from "node:fs";

import { documentGeometry } from "../model/document";
import { retirementStarter } from "./retirement";

const expectedSteps = [
  "Overview",
  "Income to household need",
  "Reserve withdrawals",
  "Reserve replenishment",
  "2026 RMD",
  "Annuity income",
];

describe("Retirement Income — Private Ledger", () => {
  it("contains the complete synthetic advisor story and exact authored literals", () => {
    const { document } = retirementStarter;
    expect(document.modules.map(({ id }) => id)).toEqual([
      "retirement-income",
      "retirement-need",
      "retirement-reserve",
      "retirement-joint",
      "retirement-annuity",
      "retirement-giving",
      "retirement-ira",
      "retirement-roth",
      "retirement-trust",
    ]);
    expect(document.flows).toHaveLength(7);
    expect(JSON.stringify(document)).toContain("~$11,800/mo");
    expect(JSON.stringify(document)).toContain("~$16,000/mo");
    expect(JSON.stringify(document)).toContain("$37,818 gross");
    expect(JSON.stringify(document)).toContain("After W/H: $25,471");
    expect(JSON.stringify(document)).toContain("$21,475/yr gross");
    expect(JSON.stringify(document)).toContain("Up to $105,000");
  });

  it("uses the full visual and relationship vocabulary without encoding magnitude", () => {
    const { document } = retirementStarter;
    expect(new Set(document.modules.map(({ primitive }) => primitive))).toEqual(
      new Set(["ledger", "plate", "tray", "band", "roundel", "frame"]),
    );
    expect(new Set(document.flows.map(({ route }) => route))).toEqual(
      new Set(["straight", "orthogonal", "curved"]),
    );
    expect(new Set(document.flows.map(({ relationship }) => relationship))).toEqual(
      new Set(["flow", "planned", "association"]),
    );
    expect(new Set(document.flows.map(({ labelTreatment }) => labelTreatment))).toEqual(
      new Set(["plain", "plate", "filled"]),
    );
    const cadenceBuckets = new Set(
      document.flows.map(({ cadence }) =>
        cadence.kind === "monthly" || cadence.kind === "annual" ? cadence.kind : "other",
      ),
    );
    expect(cadenceBuckets).toEqual(new Set(["monthly", "annual", "other"]));
    expect(document.flows.some(({ cadence }) => cadence.kind === "custom")).toBe(true);

    const adversarial = structuredClone(document);
    for (const module of adversarial.modules) {
      for (const row of module.rows) row.value = "$999,999,999 — ?";
      if (module.total) module.total.value = "$_____";
    }
    for (const flow of adversarial.flows) flow.label = "$20,000–?";
    expect(documentGeometry(adversarial)).toEqual(documentGeometry(document));
  });

  it("owns every presentation relationship and stays inside the shared artboard", () => {
    const { document } = retirementStarter;
    expect(document.presentation.map(({ title }) => title)).toEqual(expectedSteps);
    expect(document.presentation[0].moduleIds).toEqual(document.modules.map(({ id }) => id));
    expect(document.presentation[0].flowIds).toEqual(document.flows.map(({ id }) => id));
    const flows = new Map(document.flows.map((flow) => [flow.id, flow]));
    for (const step of document.presentation.slice(1)) {
      expect(step.flowIds.length).toBeGreaterThan(0);
      for (const flowId of step.flowIds) {
        const flow = flows.get(flowId);
        expect(flow).toBeDefined();
        expect(step.moduleIds).toContain(flow?.source);
        expect(step.moduleIds).toContain(flow?.target);
      }
    }
    for (const module of document.modules) {
      expect(module.width).toBeGreaterThanOrEqual(220);
      expect(module.width).toBeLessThanOrEqual(480);
      expect(module.position.x).toBeGreaterThanOrEqual(0);
      expect(module.position.y).toBeGreaterThanOrEqual(0);
      expect(module.position.x + module.width).toBeLessThanOrEqual(1440);
      expect(module.position.y).toBeLessThanOrEqual(760);
    }
    for (const flow of document.flows) {
      expect(flow.source).not.toBe(flow.target);
      for (const point of flow.waypoints) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(1440);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(760);
      }
    }
  });

  it("keeps the private-ledger theme scoped to decorative tokens and selectors", () => {
    const css = readFileSync("src/money-map/themes/private-ledger.css", "utf8");
    expect(css).toContain(".theme-private-ledger");
    expect(css).not.toMatch(/\b(?:left|top|right|bottom|width|height|transform|position)\s*:/);
    expect(css).not.toContain("$");
  });
});
