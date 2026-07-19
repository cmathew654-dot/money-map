export type StarterId = "retirement" | "rmd" | "annuity" | "roth";

export type CanvasStyleId =
  "private-ledger" | "distribution-registry" | "foundation" | "conversion-path";

export type ModuleKind =
  "income" | "account" | "reserve" | "need" | "specialty" | "charitable" | "note";

export type PrimitiveStyle = "ledger" | "plate" | "tray" | "band" | "roundel" | "frame";

export type RelationshipKind = "flow" | "association" | "planned";

export type RouteKind = "straight" | "orthogonal" | "curved";

export type LabelTreatment = "plain" | "plate" | "filled";

export type CadenceKind = "monthly" | "annual" | "one-time" | "as-needed" | "custom";

export interface Point {
  x: number;
  y: number;
}

export interface ModuleRow {
  id: string;
  label: string;
  value: string;
}

export interface ModuleTotal {
  label: string;
  value: string;
}

export interface MoneyMapModule {
  id: string;
  kind: ModuleKind;
  primitive: PrimitiveStyle;
  position: Point;
  width: number;
  eyebrow: string;
  title: string;
  subtitle?: string;
  rows: ModuleRow[];
  total?: ModuleTotal;
  note?: string;
}

export interface MoneyMapCadence {
  kind: CadenceKind;
  label: string;
}

export interface MoneyMapFlow {
  id: string;
  source: string;
  target: string;
  relationship: RelationshipKind;
  route: RouteKind;
  labelTreatment: LabelTreatment;
  label: string;
  secondaryLabel?: string;
  cadence: MoneyMapCadence;
  waypoints: Point[];
}

export interface PresentationStep {
  id: string;
  title: string;
  moduleIds: string[];
  flowIds: string[];
}

export interface MoneyMapDocument {
  schemaVersion: 1;
  id: StarterId;
  title: string;
  asOf: string;
  style: CanvasStyleId;
  modules: MoneyMapModule[];
  flows: MoneyMapFlow[];
  presentation: PresentationStep[];
}

export interface Selection {
  moduleIds: string[];
  flowIds: string[];
}
