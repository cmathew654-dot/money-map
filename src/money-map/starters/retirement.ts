import type { StarterDefinition } from "./types";
import { withScaffoldPresentation } from "./scaffoldPresentation";

export const retirementStarter = {
  id: "retirement",
  chooser: {
    eyebrow: "Private Ledger",
    description:
      "Trace recurring income, reserves, required distributions, and the household need.",
    accent: "ochre",
  },
  document: withScaffoldPresentation(
    {
      schemaVersion: 1,
      id: "retirement",
      title: "Retirement Income",
      asOf: "As of July 2026",
      style: "private-ledger",
      modules: [
        {
          id: "retirement-income",
          kind: "income",
          primitive: "band",
          position: { x: 64, y: 84 },
          width: 260,
          eyebrow: "Recurring income",
          title: "Social Security",
          subtitle: "Hartwell household",
          rows: [{ id: "retirement-income-row", label: "Monthly benefit", value: "$5,420/mo" }],
          note: "Begins on the advisor-authored date.",
        },
        {
          id: "retirement-reserve",
          kind: "reserve",
          primitive: "ledger",
          position: { x: 412, y: 224 },
          width: 286,
          eyebrow: "Flexible reserve",
          title: "Traditional IRA",
          rows: [
            { id: "retirement-reserve-row", label: "Display balance", value: "~$1.18M" },
            { id: "retirement-rmd-row", label: "Annual distribution", value: "Advisor to enter" },
          ],
        },
        {
          id: "retirement-need",
          kind: "need",
          primitive: "tray",
          position: { x: 798, y: 104 },
          width: 276,
          eyebrow: "Household need",
          title: "Core lifestyle",
          rows: [{ id: "retirement-need-row", label: "Monthly target", value: "$12,500/mo" }],
          total: { label: "Planning posture", value: "Income sources + reserves" },
        },
      ],
      flows: [
        {
          id: "retirement-income-flow",
          source: "retirement-income",
          target: "retirement-need",
          relationship: "flow",
          route: "curved",
          labelTreatment: "plain",
          label: "$5,420/mo",
          cadence: { kind: "monthly", label: "Monthly" },
          waypoints: [],
        },
        {
          id: "retirement-reserve-flow",
          source: "retirement-reserve",
          target: "retirement-need",
          relationship: "planned",
          route: "orthogonal",
          labelTreatment: "plate",
          label: "As needed",
          secondaryLabel: "Advisor-directed withdrawals",
          cadence: { kind: "as-needed", label: "As needed" },
          waypoints: [{ x: 744, y: 316 }],
        },
      ],
    },
    [
      "Income to household need",
      "Reserve withdrawals",
      "Reserve replenishment",
      "2026 RMD",
      "Annuity income",
    ],
  ),
} satisfies StarterDefinition;
