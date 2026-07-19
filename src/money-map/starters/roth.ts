import type { StarterDefinition } from "./types";
import { withScaffoldPresentation } from "./scaffoldPresentation";

export const rothStarter = {
  id: "roth",
  chooser: {
    eyebrow: "Conversion Path",
    description:
      "Stage a multi-year conversion story across source, reserve, and destination accounts.",
    accent: "aubergine",
  },
  document: withScaffoldPresentation(
    {
      schemaVersion: 1,
      id: "roth",
      title: "Roth Conversion",
      asOf: "As of July 2026",
      style: "conversion-path",
      modules: [
        {
          id: "roth-source",
          kind: "account",
          primitive: "frame",
          position: { x: 64, y: 104 },
          width: 280,
          eyebrow: "Conversion source",
          title: "Traditional IRA",
          rows: [{ id: "roth-source-row", label: "Display balance", value: "~$860,000" }],
        },
        {
          id: "roth-reserve",
          kind: "reserve",
          primitive: "roundel",
          position: { x: 440, y: 258 },
          width: 252,
          eyebrow: "Outside reserve",
          title: "Tax reserve",
          rows: [{ id: "roth-reserve-row", label: "Available", value: "$_____" }],
          note: "Advisor identifies the payment source.",
        },
        {
          id: "roth-destination",
          kind: "account",
          primitive: "band",
          position: { x: 800, y: 102 },
          width: 286,
          eyebrow: "Long-term destination",
          title: "Roth IRA",
          rows: [
            { id: "roth-destination-row", label: "Planned conversion", value: "$75,000–$125,000" },
          ],
        },
      ],
      flows: [
        {
          id: "roth-conversion-flow",
          source: "roth-source",
          target: "roth-destination",
          relationship: "planned",
          route: "curved",
          labelTreatment: "filled",
          label: "Annual conversion window",
          cadence: { kind: "annual", label: "Annual" },
          waypoints: [],
        },
        {
          id: "roth-tax-flow",
          source: "roth-reserve",
          target: "roth-source",
          relationship: "association",
          route: "straight",
          labelTreatment: "plain",
          label: "Tax payment source",
          cadence: { kind: "custom", label: "Alongside each conversion" },
          waypoints: [],
        },
      ],
    },
    [
      "Establish source and destination",
      "Frame 2026 conversion range",
      "Identify tax-payment source",
      "Review planning guardrails",
      "Stage the 2027 window",
    ],
  ),
} satisfies StarterDefinition;
