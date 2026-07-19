import type { MoneyMapDocument } from "./types";

export function createTestDocument(): MoneyMapDocument {
  return {
    schemaVersion: 1,
    id: "annuity",
    title: "Hartwell income foundation",
    asOf: "As of July 2026",
    style: "foundation",
    modules: [
      {
        id: "source-account",
        kind: "account",
        primitive: "ledger",
        position: { x: 40, y: 80 },
        width: 280,
        eyebrow: "Source account",
        title: "Investment account",
        subtitle: "Available by advisor direction",
        rows: [
          { id: "source-value", label: "Current balance", value: "$250,000" },
          { id: "range", label: "Planned range", value: "$20,000–?" },
        ],
      },
      {
        id: "annuity-policy",
        kind: "income",
        primitive: "band",
        position: { x: 420, y: 112 },
        width: 304,
        eyebrow: "Income floor",
        title: "Illustrative annuity",
        rows: [
          { id: "premium", label: "Premium", value: "$300,000 — revised illustration" },
          { id: "income", label: "Monthly income", value: "~$11,800/mo" },
          { id: "placeholder", label: "Advisor entry", value: "$_____" },
        ],
        total: { label: "Illustrative premium", value: "$300,000" },
        note: "Amounts are advisor-authored display text.",
      },
      {
        id: "monthly-need",
        kind: "need",
        primitive: "plate",
        position: { x: 820, y: 144 },
        width: 248,
        eyebrow: "Household need",
        title: "Core spending",
        rows: [{ id: "need", label: "Monthly", value: "$_____" }],
      },
    ],
    flows: [
      {
        id: "funding-flow",
        source: "source-account",
        target: "annuity-policy",
        relationship: "planned",
        route: "orthogonal",
        labelTreatment: "plate",
        label: "$300,000 premium",
        secondaryLabel: "Advisor-authored illustration",
        cadence: { kind: "one-time", label: "One-time" },
        waypoints: [{ x: 360, y: 176 }],
      },
      {
        id: "income-flow",
        source: "annuity-policy",
        target: "monthly-need",
        relationship: "flow",
        route: "straight",
        labelTreatment: "plain",
        label: "~$11,800/mo",
        cadence: { kind: "monthly", label: "Monthly" },
        waypoints: [],
      },
    ],
    presentation: [
      {
        id: "overview",
        title: "Overview",
        moduleIds: ["source-account", "annuity-policy", "monthly-need"],
        flowIds: ["funding-flow", "income-flow"],
      },
    ],
  };
}
