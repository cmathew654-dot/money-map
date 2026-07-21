import type { CanvasStyleId } from "../model/types";
import type { CanvasTheme } from "./types";

export const themeRegistry = {
  "private-ledger": {
    id: "private-ledger",
    label: "Private Ledger",
    className: "theme-private-ledger",
  },
  "distribution-registry": {
    id: "distribution-registry",
    label: "Distribution Registry",
    className: "theme-distribution-registry",
  },
  foundation: {
    id: "foundation",
    label: "Foundation",
    className: "theme-foundation",
  },
  "conversion-path": {
    id: "conversion-path",
    label: "Conversion Path",
    className: "theme-conversion-path",
  },
} as const satisfies Readonly<Record<CanvasStyleId, CanvasTheme>>;

export function getCanvasTheme(id: CanvasStyleId): CanvasTheme {
  return themeRegistry[id];
}
