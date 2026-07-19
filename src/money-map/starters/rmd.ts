import type { StarterDefinition } from "./types";
import { withScaffoldPresentation } from "./scaffoldPresentation";

export const rmdStarter = {
  id: "rmd",
  chooser: {
    eyebrow: "Distribution Registry",
    description:
      "Explain the annual distribution sequence without pretending to calculate its outcome.",
    accent: "pine",
  },
  document: withScaffoldPresentation(
    {
      schemaVersion: 1,
      id: "rmd",
      title: "RMD & Withholding",
      asOf: "As of July 2026",
      style: "distribution-registry",
      modules: [
        {
          id: "rmd-account",
          kind: "account",
          primitive: "ledger",
          position: { x: 72, y: 86 },
          width: 286,
          eyebrow: "Distribution source",
          title: "Traditional IRA",
          rows: [
            { id: "rmd-account-row", label: "Display balance", value: "$1,240,000" },
            { id: "rmd-distribution-row", label: "2026 distribution", value: "$48,600 est." },
          ],
        },
        {
          id: "rmd-tax",
          kind: "reserve",
          primitive: "plate",
          position: { x: 458, y: 82 },
          width: 246,
          eyebrow: "Withholding direction",
          title: "Federal & state",
          rows: [{ id: "rmd-tax-row", label: "Advisor entry", value: "__% / __%" }],
          note: "Display-only withholding instruction.",
        },
        {
          id: "rmd-destination",
          kind: "account",
          primitive: "tray",
          position: { x: 804, y: 230 },
          width: 280,
          eyebrow: "Net destination",
          title: "Household reserve",
          rows: [
            { id: "rmd-destination-row", label: "Deposit", value: "Remainder after withholding" },
          ],
        },
      ],
      flows: [
        {
          id: "rmd-tax-flow",
          source: "rmd-account",
          target: "rmd-tax",
          relationship: "flow",
          route: "orthogonal",
          labelTreatment: "filled",
          label: "Withhold per instruction",
          cadence: { kind: "annual", label: "Annual" },
          waypoints: [{ x: 406, y: 168 }],
        },
        {
          id: "rmd-net-flow",
          source: "rmd-account",
          target: "rmd-destination",
          relationship: "flow",
          route: "straight",
          labelTreatment: "plain",
          label: "Net distribution",
          cadence: { kind: "annual", label: "Annual" },
          waypoints: [],
        },
      ],
    },
    [
      "Establish 2026 distribution",
      "Direct qualified charitable distribution",
      "Record withholding instructions",
      "Route net distribution",
      "Review year-end records",
    ],
  ),
} satisfies StarterDefinition;
