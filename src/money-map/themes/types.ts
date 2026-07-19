import type { CanvasStyleId } from "../model/types";

export interface CanvasTheme {
  id: CanvasStyleId;
  label: string;
  className:
    | "theme-private-ledger"
    | "theme-distribution-registry"
    | "theme-foundation"
    | "theme-conversion-path";
}
