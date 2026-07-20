import foundationCss from "../themes/foundation.css?raw";
import { annuityStarter } from "./annuity";
import { STARTER_ARTBOARD } from "./types";

const document = annuityStarter.document;

describe("annuity foundation starter", () => {
  it("authors the complete six-module income-floor story with literal values", () => {
    expect(document).toMatchObject({
      id: "annuity",
      title: "Annuity Income Floor",
      asOf: "As of July 2026",
      style: "foundation",
    });
    expect(document.modules.map(({ id, primitive }) => [id, primitive])).toEqual([
      ["annuity-income", "ledger"],
      ["annuity-policy", "band"],
      ["annuity-need", "roundel"],
      ["annuity-source", "plate"],
      ["annuity-plan", "frame"],
      ["annuity-reserve", "tray"],
    ]);

    expect(document.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "annuity-income",
          title: "Existing income sources",
          rows: [
            expect.objectContaining({ label: "Pension", value: "$4,800/mo gross" }),
            expect.objectContaining({ label: "Social Security", value: "$5,420/mo gross" }),
          ],
        }),
        expect.objectContaining({
          id: "annuity-need",
          title: "Household need",
          rows: [expect.objectContaining({ label: "Monthly target", value: "$16,000/mo" })],
        }),
        expect.objectContaining({
          id: "annuity-source",
          title: "Investment account",
          rows: [
            expect.objectContaining({ label: "Current balance", value: "$250,000" }),
            expect.objectContaining({ label: "Planned range", value: "$20,000–?" }),
          ],
        }),
        expect.objectContaining({
          id: "annuity-plan",
          title: "Premium plan",
          rows: [
            expect.objectContaining({
              label: "Planned premium",
              value: "$300,000 — revised illustration",
            }),
            expect.objectContaining({ label: "Advisor entry", value: "$_____" }),
          ],
          note: "Funding cadence is authored, not calculated.",
        }),
        expect.objectContaining({
          id: "annuity-policy",
          title: "Illustrative annuity",
          rows: [
            expect.objectContaining({ label: "FMV", value: "$109,000" }),
            expect.objectContaining({ label: "Income rider", value: "$21,475/yr gross" }),
          ],
          total: { label: "Illustrative premium", value: "$300,000" },
        }),
        expect.objectContaining({
          id: "annuity-reserve",
          title: "Short-term reserve",
          rows: [expect.objectContaining({ label: "Available", value: "$90,000" })],
          note: "Displayed independently of the premium plan.",
        }),
      ]),
    );
  });

  it("uses the complete relationship, route, label, and cadence vocabulary", () => {
    expect(
      document.flows.map(
        ({ id, source, target, relationship, route, labelTreatment, cadence, label }) => ({
          id,
          source,
          target,
          relationship,
          route,
          labelTreatment,
          cadence,
          label,
        }),
      ),
    ).toEqual([
      {
        id: "annuity-income-need",
        source: "annuity-income",
        target: "annuity-need",
        relationship: "income",
        route: "orthogonal",
        labelTreatment: "filled",
        cadence: { kind: "monthly", label: "Monthly" },
        label: "Monthly income",
      },
      {
        id: "annuity-source-plan",
        source: "annuity-source",
        target: "annuity-plan",
        relationship: "planned",
        route: "straight",
        labelTreatment: "plain",
        cadence: { kind: "custom", label: "Advisor-selected funding source" },
        label: "Funding source",
      },
      {
        id: "annuity-plan-contract",
        source: "annuity-plan",
        target: "annuity-policy",
        relationship: "planned",
        route: "orthogonal",
        labelTreatment: "plate",
        cadence: { kind: "custom", label: "Monthly installments — advisor entered" },
        label: "Premium schedule",
      },
      expect.objectContaining({
        id: "annuity-contract-need",
        source: "annuity-policy",
        target: "annuity-need",
        relationship: "income",
        route: "straight",
        labelTreatment: "filled",
        cadence: { kind: "annual", label: "Annual" },
        label: "$21,475/yr gross — income rider",
      }),
      expect.objectContaining({
        id: "annuity-reserve-need",
        source: "annuity-reserve",
        target: "annuity-need",
        relationship: "transfer",
        route: "orthogonal",
        labelTreatment: "plate",
        cadence: { kind: "as-needed", label: "As needed" },
      }),
      expect.objectContaining({
        id: "annuity-contract-reserve",
        source: "annuity-policy",
        target: "annuity-reserve",
        relationship: "planned",
        route: "curved",
        labelTreatment: "plain",
        cadence: { kind: "custom", label: "Liquidity context" },
      }),
    ]);

    expect(new Set(document.modules.map(({ primitive }) => primitive))).toEqual(
      new Set(["ledger", "plate", "tray", "band", "roundel", "frame"]),
    );
    expect(new Set(document.flows.map(({ relationship }) => relationship))).toEqual(
      new Set(["income", "transfer", "planned"]),
    );
    expect(new Set(document.flows.map(({ route }) => route))).toEqual(
      new Set(["straight", "orthogonal", "curved"]),
    );
    expect(new Set(document.flows.map(({ labelTreatment }) => labelTreatment))).toEqual(
      new Set(["plain", "plate", "filled"]),
    );
    expect(new Set(document.flows.map(({ cadence }) => cadence.kind))).toEqual(
      new Set(["monthly", "annual", "as-needed", "custom"]),
    );
  });

  it("provides Overview plus five endpoint-owning named presentation steps", () => {
    expect(document.presentation.map(({ title }) => title)).toEqual([
      "Overview",
      "Establish household income need",
      "Identify funding sources",
      "Author premium schedule",
      "Review contract and rider",
      "Connect income floor to need",
    ]);
    expect(document.presentation[0]).toEqual({
      id: "overview",
      title: "Overview",
      moduleIds: document.modules.map(({ id }) => id),
      flowIds: document.flows.map(({ id }) => id),
    });

    const flowById = new Map(document.flows.map((flow) => [flow.id, flow]));
    for (const step of document.presentation.slice(1)) {
      expect(step.flowIds.length).toBeGreaterThan(0);
      for (const id of step.flowIds) {
        const flow = flowById.get(id);
        expect(flow).toBeDefined();
        expect(step.moduleIds).toContain(flow?.source);
        expect(step.moduleIds).toContain(flow?.target);
      }
    }
  });

  it("keeps authored modules and label anchors inside the 1440 by 760 artboard", () => {
    const estimatedHeights: Record<string, number> = {
      "annuity-income": 190,
      "annuity-need": 170,
      "annuity-source": 190,
      "annuity-plan": 250,
      "annuity-policy": 220,
      "annuity-reserve": 190,
    };
    const rectangles = document.modules.map((module) => ({
      id: module.id,
      left: module.position.x,
      right: module.position.x + module.width,
      top: module.position.y,
      bottom: module.position.y + estimatedHeights[module.id],
    }));

    for (const rectangle of rectangles) {
      expect(rectangle.left).toBeGreaterThanOrEqual(STARTER_ARTBOARD.x);
      expect(rectangle.top).toBeGreaterThanOrEqual(STARTER_ARTBOARD.y);
      expect(rectangle.right).toBeLessThanOrEqual(STARTER_ARTBOARD.width);
      expect(rectangle.bottom).toBeLessThanOrEqual(STARTER_ARTBOARD.height);
    }
    for (const [index, first] of rectangles.entries()) {
      for (const second of rectangles.slice(index + 1)) {
        const overlaps =
          first.left < second.right &&
          first.right > second.left &&
          first.top < second.bottom &&
          first.bottom > second.top;
        expect(overlaps, `${first.id} overlaps ${second.id}`).toBe(false);
      }
    }
    for (const flow of document.flows) {
      for (const point of flow.waypoints) {
        expect(point.x).toBeGreaterThanOrEqual(STARTER_ARTBOARD.x);
        expect(point.x).toBeLessThanOrEqual(STARTER_ARTBOARD.width);
        expect(point.y).toBeGreaterThanOrEqual(STARTER_ARTBOARD.y);
        expect(point.y).toBeLessThanOrEqual(STARTER_ARTBOARD.height);
      }
    }
  });

  it("keeps source capacity and premium planning as independent literal display text", () => {
    const source = document.modules.find(({ id }) => id === "annuity-source");
    const plan = document.modules.find(({ id }) => id === "annuity-plan");
    const serialized = JSON.stringify(document);

    expect(source?.rows.map(({ value }) => value)).toEqual(["$250,000", "$20,000–?"]);
    expect(plan?.rows.map(({ value }) => value)).toEqual([
      "$300,000 — revised illustration",
      "$_____",
    ]);
    expect(serialized).not.toMatch(/warning|debit|remainder|capacity|insufficient/i);
    expect(source?.height).toBe(190);
    expect(plan?.height).toBe(250);
  });

  it("keeps Foundation art direction decorative and free of geometry or financial semantics", () => {
    expect(foundationCss).toContain(".theme-foundation");
    expect(foundationCss).toContain("--map-canvas: #eceae4");
    expect(foundationCss).toContain("--map-ink: #292e31");
    expect(foundationCss).toContain("--map-focus: #486e7a");
    expect(foundationCss).toContain("--map-accent: #a36f2c");
    expect(foundationCss).toContain('.theme-foundation .money-map-module[data-primitive="band"]');
    expect(foundationCss).not.toMatch(
      /\b(?:width|height|padding|margin|position|inset|transform|font-size|line-height)\s*:/i,
    );
    expect(foundationCss).not.toMatch(/\$|premium|income|balance|cadence|route|amount/i);
  });
});
