import type { StarterDefinition } from "./types";
import { withScaffoldPresentation } from "./scaffoldPresentation";

export const annuityStarter = {
  id: "annuity",
  chooser: {
    eyebrow: "Foundation",
    description: "Show how a premium, contract value, rider, and income floor relate over time.",
    accent: "mineral",
  },
  document: withScaffoldPresentation(
    {
      schemaVersion: 1,
      id: "annuity",
      title: "Annuity Income Floor",
      asOf: "As of July 2026",
      style: "foundation",
      modules: [
        {
          id: "annuity-source",
          kind: "account",
          primitive: "ledger",
          position: { x: 58, y: 100 },
          width: 280,
          eyebrow: "Source account",
          title: "Investment account",
          subtitle: "Available by advisor direction",
          rows: [
            { id: "annuity-source-row", label: "Current balance", value: "$250,000" },
            { id: "annuity-range-row", label: "Planned range", value: "$20,000–?" },
          ],
        },
        {
          id: "annuity-policy",
          kind: "income",
          primitive: "band",
          position: { x: 430, y: 104 },
          width: 304,
          eyebrow: "Income floor",
          title: "Illustrative annuity",
          rows: [
            {
              id: "annuity-premium-row",
              label: "Premium",
              value: "$300,000 \u2014 revised illustration",
            },
            { id: "annuity-income-row", label: "Monthly income", value: "~$11,800/mo" },
            { id: "annuity-placeholder-row", label: "Advisor entry", value: "$_____" },
          ],
          total: { label: "Illustrative premium", value: "$300,000" },
          note: "Amounts are advisor-authored display text.",
        },
        {
          id: "annuity-need",
          kind: "need",
          primitive: "plate",
          position: { x: 824, y: 138 },
          width: 248,
          eyebrow: "Household need",
          title: "Core spending",
          rows: [{ id: "annuity-need-row", label: "Monthly", value: "$_____" }],
        },
      ],
      flows: [
        {
          id: "annuity-funding-flow",
          source: "annuity-source",
          target: "annuity-policy",
          relationship: "planned",
          route: "orthogonal",
          labelTreatment: "plate",
          label: "$300,000 premium",
          secondaryLabel: "Advisor-authored illustration",
          cadence: { kind: "one-time", label: "One-time" },
          waypoints: [{ x: 384, y: 184 }],
        },
        {
          id: "annuity-income-flow",
          source: "annuity-policy",
          target: "annuity-need",
          relationship: "flow",
          route: "straight",
          labelTreatment: "plain",
          label: "~$11,800/mo",
          cadence: { kind: "monthly", label: "Monthly" },
          waypoints: [],
        },
      ],
    },
    [
      "Establish household income need",
      "Identify funding sources",
      "Author premium schedule",
      "Review contract and rider",
      "Connect income floor to need",
    ],
  ),
} satisfies StarterDefinition;
