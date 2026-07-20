import type { MoneyMapModule, Point } from "./types";

export const MAX_MODULE_SIZE = 520;

export function minimumModuleSize(module: MoneyMapModule): Point {
  if (module.primitive === "text") {
    return module.density === "essential"
      ? { x: 160, y: 60 }
      : module.density === "standard"
        ? { x: 200, y: 90 }
        : { x: 240, y: 120 };
  }
  if (module.density === "essential") return { x: 180, y: 112 };
  if (module.density === "full") return { x: 260, y: 196 };
  return { x: 220, y: 152 };
}

export function clampModuleSize(
  module: MoneyMapModule,
  size: { width: number; height: number },
): { width: number; height: number } {
  const minimum = minimumModuleSize(module);
  return {
    width: Math.min(MAX_MODULE_SIZE, Math.max(minimum.x, size.width)),
    height: Math.min(MAX_MODULE_SIZE, Math.max(minimum.y, size.height)),
  };
}
