interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface SurfaceSize {
  width: number;
  height: number;
}

export interface EditorSurfacePosition {
  left: number;
  top: number;
  side: "left" | "right" | "clamped";
}

const margin = 16;
const headerFloor = 88;
const defaultSize: SurfaceSize = { width: 352, height: 400 };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function positionEditorSurface(
  selected: Bounds,
  viewport: ViewportSize,
  size: SurfaceSize = defaultSize,
): EditorSurfacePosition {
  const rightLeft = selected.right + margin;
  const leftLeft = selected.left - margin - size.width;
  const top = clamp(selected.top, headerFloor, viewport.height - margin - size.height);

  if (rightLeft + size.width <= viewport.width - margin) {
    return { left: rightLeft, top, side: "right" };
  }
  if (leftLeft >= margin) {
    return { left: leftLeft, top, side: "left" };
  }
  return {
    left: clamp(rightLeft, margin, viewport.width - margin - size.width),
    top,
    side: "clamped",
  };
}
