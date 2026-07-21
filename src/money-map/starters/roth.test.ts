import conversionPathCss from "../themes/conversion-path.css?raw";
import { rothStarter } from "./roth";
import { STARTER_ARTBOARD } from "./types";

const expectedModules = [
  {
    id: "roth-source",
    primitive: "frame",
    title: "Traditional IRA",
    rows: [["Display balance", "~$860,000"]],
  },
  {
    id: "roth-2026",
    primitive: "band",
    title: "2026 conversion window",
    rows: [["Planned range", "$75,000–$125,000"]],
  },
  {
    id: "roth-destination",
    primitive: "plate",
    title: "Roth IRA",
    rows: [["Display balance", "$291,000"]],
  },
  {
    id: "roth-tax-reserve",
    primitive: "roundel",
    title: "Outside tax reserve",
    rows: [["Advisor entry", "$_____"]],
  },
  {
    id: "roth-guardrails",
    primitive: "ledger",
    title: "Planning guardrails",
    rows: [
      ["Tax review", "Advisor directed"],
      ["Medicare review", "Discussed separately"],
      ["Planning status", "No calculated result"],
    ],
  },
  {
    id: "roth-2027",
    primitive: "band",
    title: "2027 conversion window",
    rows: [["Timing", "After year-end review"]],
  },
  {
    id: "roth-liquidity",
    primitive: "tray",
    title: "Household liquidity",
    rows: [["Availability", "As needed"]],
  },
] as const;

const expectedFlows = [
  ["roth-source", "roth-2026", "planned", "curved", "plain", "Annual", "annual"],
  ["roth-2026", "roth-destination", "transfer", "straight", "plate", "One-time", "one-time"],
  [
    "roth-tax-reserve",
    "roth-2026",
    "planned",
    "orthogonal",
    "plain",
    "Alongside each conversion",
    "custom",
  ],
  ["roth-2026", "roth-guardrails", "planned", "straight", "plain", "Advisor tax review", "custom"],
  ["roth-source", "roth-2027", "planned", "straight", "plain", "Annual", "annual"],
  ["roth-2027", "roth-destination", "transfer", "curved", "plate", "One-time", "one-time"],
  [
    "roth-liquidity",
    "roth-tax-reserve",
    "replenishment",
    "straight",
    "plain",
    "As needed",
    "as-needed",
  ],
  ["roth-liquidity", "roth-source", "planned", "curved", "plain", "Monthly", "monthly"],
] as const;

const expectedSteps = [
  "Overview",
  "Establish source and destination",
  "Frame 2026 conversion range",
  "Identify tax-payment source",
  "Review planning guardrails",
  "Stage the 2027 window",
];

describe("Roth Conversion Path starter", () => {
  it("authors the complete conversion story with exact literal content", () => {
    const { document } = rothStarter;

    expect(document.title).toBe("Roth Conversion");
    expect(document.style).toBe("conversion-path");
    expect(document.modules).toHaveLength(expectedModules.length);

    for (const expected of expectedModules) {
      const module = document.modules.find(({ id }) => id === expected.id);
      expect(module).toBeDefined();
      expect(module).toMatchObject({ primitive: expected.primitive, title: expected.title });
      expect(module?.rows.map(({ label, value }) => [label, value])).toEqual(expected.rows);
    }
  });

  it("round-trips every authored route, relationship, treatment, and cadence bucket", () => {
    const { flows } = rothStarter.document;

    expect(
      flows.map(({ source, target, relationship, route, labelTreatment, cadence }) => [
        source,
        target,
        relationship,
        route,
        labelTreatment,
        cadence.label,
        cadence.kind,
      ]),
    ).toEqual(expectedFlows);

    expect(new Set(flows.map(({ route }) => route))).toEqual(
      new Set(["straight", "orthogonal", "curved"]),
    );
    expect(new Set(flows.map(({ relationship }) => relationship))).toEqual(
      new Set(["transfer", "replenishment", "planned"]),
    );
    // Deliberately NOT asserting that all three treatments appear. That
    // demand is what drove the starters to rotate filled/plate/plain for
    // coverage, producing two identical "To Roth IRA" transfers rendered
    // differently. Treatment now follows relationship type, which the
    // shared invariant in starters.test.ts enforces across all four
    // stories; this story simply has no income relationship to fill.
    expect(new Set(flows.map(({ labelTreatment }) => labelTreatment))).toEqual(
      new Set(["plain", "plate"]),
    );
    expect(new Set(flows.map(({ cadence }) => cadence.kind))).toEqual(
      new Set(["monthly", "annual", "one-time", "as-needed", "custom"]),
    );
  });

  it("keeps relationship labels concise and authored inside the open routing corridors", () => {
    const flowById = new Map(rothStarter.document.flows.map((flow) => [flow.id, flow]));

    expect(rothStarter.document.flows.map(({ label }) => label)).toEqual([
      "2026 conversion",
      "To Roth IRA",
      "Outside reserve",
      "Advisor review",
      "2027 window",
      "To Roth IRA",
      "Reserve",
      "Monthly review",
    ]);
    expect(flowById.get("roth-tax-reserve-to-2026")?.waypoints[0]).toEqual({ x: 640, y: 350 });
    expect(flowById.get("roth-source-to-2027")?.waypoints).toEqual([
      { x: 360, y: 310 },
      { x: 410, y: 310 },
      { x: 410, y: 700 },
      { x: 1075, y: 700 },
      { x: 1075, y: 520 },
    ]);
    expect(flowById.get("roth-liquidity-to-source")?.waypoints[0]).toEqual({ x: 185, y: 350 });
    expect(flowById.get("roth-2026-to-guardrails")?.waypoints[0]).toEqual({ x: 850, y: 320 });
    expect(flowById.get("roth-2027-to-destination")?.waypoints[0]).toEqual({ x: 1300, y: 385 });
  });
  it("provides Overview plus five endpoint-owning named focus states", () => {
    const { document } = rothStarter;
    const flowById = new Map(document.flows.map((flow) => [flow.id, flow]));

    expect(document.presentation.map(({ title }) => title)).toEqual(expectedSteps);
    expect(document.presentation[0]).toEqual({
      id: "overview",
      title: "Overview",
      moduleIds: document.modules.map(({ id }) => id),
      flowIds: document.flows.map(({ id }) => id),
    });

    const focusSignatures = document.presentation
      .slice(1)
      .map(({ moduleIds, flowIds }) => `${moduleIds.join("|")}::${flowIds.join("|")}`);
    expect(new Set(focusSignatures)).toHaveLength(5);

    for (const step of document.presentation.slice(1)) {
      expect(step.flowIds.length).toBeGreaterThan(0);
      for (const flowId of step.flowIds) {
        const flow = flowById.get(flowId);
        expect(flow).toBeDefined();
        expect(step.moduleIds).toContain(flow?.source);
        expect(step.moduleIds).toContain(flow?.target);
      }
    }
  });

  it("keeps the authored composition within the 1440 by 760 artboard without module overlap", () => {
    const authoredHeights = new Map([
      ["roth-source", 180],
      ["roth-2026", 180],
      ["roth-destination", 180],
      ["roth-tax-reserve", 180],
      ["roth-guardrails", 240],
      ["roth-2027", 240],
      ["roth-liquidity", 180],
    ]);
    const rectangles = rothStarter.document.modules.map((module) => ({
      id: module.id,
      left: module.position.x,
      top: module.position.y,
      right: module.position.x + module.width,
      bottom: module.position.y + (authoredHeights.get(module.id) ?? 240),
    }));

    for (const rectangle of rectangles) {
      expect(rectangle.left).toBeGreaterThanOrEqual(STARTER_ARTBOARD.x);
      expect(rectangle.top).toBeGreaterThanOrEqual(STARTER_ARTBOARD.y);
      expect(rectangle.right).toBeLessThanOrEqual(STARTER_ARTBOARD.width);
      expect(rectangle.bottom).toBeLessThanOrEqual(STARTER_ARTBOARD.height);
    }

    for (const rectangle of rectangles) {
      for (const other of rectangles) {
        if (rectangle.id >= other.id) continue;
        const separated =
          rectangle.right <= other.left ||
          other.right <= rectangle.left ||
          rectangle.bottom <= other.top ||
          other.bottom <= rectangle.top;
        expect(separated, `${rectangle.id} overlaps ${other.id}`).toBe(true);
      }
    }
  });

  it("keeps the conversion theme scoped, decorative, and free of financial semantics", () => {
    expect(conversionPathCss.trim().startsWith(".theme-conversion-path {")).toBe(true);
    expect(conversionPathCss).toContain("--map-canvas: #fbfaf8");
    expect(conversionPathCss).toContain("--map-focus: #5b334f");
    expect(conversionPathCss).toContain("--map-accent: #a7442f");
    expect(conversionPathCss).not.toMatch(
      /\b(?:width|height|padding|margin|position|inset|transform|font-size|line-height)\s*:/i,
    );
    expect(conversionPathCss).not.toMatch(/--map-(?:amount|balance|premium|tax|conversion)\b/i);
  });
});
