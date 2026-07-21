import type { MoneyMapDocument, StarterId } from "../model/types";
import { annuityStarter } from "./annuity";
import { retirementStarter } from "./retirement";
import { rmdStarter } from "./rmd";
import { rothStarter } from "./roth";
import type { StarterDefinition } from "./types";

export const starterRegistry = {
  retirement: retirementStarter,
  rmd: rmdStarter,
  annuity: annuityStarter,
  roth: rothStarter,
} as const satisfies Readonly<Record<StarterId, StarterDefinition>>;

export function getStarterDefinition(id: StarterId): StarterDefinition {
  return starterRegistry[id];
}

export function createStarterDocument(id: StarterId): MoneyMapDocument {
  return structuredClone(starterRegistry[id].document);
}
