import type { MoneyMapDocument, StarterId } from "../model/types";

export const STARTER_IDS = [
  "retirement",
  "rmd",
  "annuity",
  "roth",
] as const satisfies readonly StarterId[];

export const STARTER_ARTBOARD = { x: 0, y: 0, width: 1440, height: 760 } as const;

export interface StarterChooserMeta {
  eyebrow: string;
  description: string;
  accent: "ochre" | "pine" | "mineral" | "aubergine";
}

export interface StarterDefinition {
  id: StarterId;
  chooser: StarterChooserMeta;
  document: MoneyMapDocument;
}
