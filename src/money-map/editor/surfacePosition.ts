import type { Point } from "../model/types";

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

/** Viewport inset every anchored surface keeps. Exported so callers
 *  correcting a placement against a measured height use the same value. */
export const SURFACE_MARGIN = 16;
/** Lowest `top` a surface may be lifted to: clears the editor header. */
export const SURFACE_HEADER_FLOOR = 88;

const margin = SURFACE_MARGIN;
const headerFloor = SURFACE_HEADER_FLOOR;
const defaultSize: SurfaceSize = { width: 352, height: 400 };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function rectsOverlap(a: Bounds, b: Bounds): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function overlapArea(a: Bounds, b: Bounds): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

// A click (Playwright's or a real advisor's) lands on an object's center, not just
// anywhere inside its rect. A surface that merely grazes an obstacle's edge doesn't
// stop that object from being clicked, so "blocks interaction" is judged by center
// coverage, not raw overlap -- overlap is still tracked, but only as a tiebreaker for
// picking the least-intrusive candidate when nothing avoids every center outright.
function coversCenter(rect: Bounds, obstacle: Bounds): boolean {
  const centerX = (obstacle.left + obstacle.right) / 2;
  const centerY = (obstacle.top + obstacle.bottom) / 2;
  return rect.left < centerX && centerX < rect.right && rect.top < centerY && centerY < rect.bottom;
}

/**
 * Places an anchored editor surface (Advanced properties, the flow-target picker,
 * relationship properties) beside `selected` -- the canvas object it edits -- without
 * covering it, and without blocking interaction with unrelated canvas content. Two
 * tiers of "unrelated content" are recognized. `permanentChrome` (the cadence filter,
 * the zoom toolbar -- controls that are always on screen, not tied to any one
 * document) is non-negotiable: a candidate that covers one of their centers is
 * discarded outright, the same as one that overlaps `selected`. `obstacles` (every
 * other visible module and flow label -- document content that varies by what's
 * open) is a softer preference: minimized, not guaranteed, because a sufficiently
 * dense document can leave no slot that clears all of it, and refusing to place the
 * surface at all would be worse than grazing one more label. Tries flush right of
 * `selected` first, then flush left, each only accepted when it both fits the
 * viewport and doesn't cover the *center* of any obstacle or chrome control -- a
 * real click (Playwright's or an advisor's) lands there, so that's what "blocks
 * interaction" actually means; a surface that only grazes an edge doesn't stop
 * something from being clicked. When the preferred side would block something, it
 * flips to the other side; when neither flush position is fully clear, it searches
 * the same row for the slot that blocks the fewest obstacles (ties broken by least
 * total overlap area), evaluated at every blocker's edges -- the only x-positions
 * where what a candidate overlaps can change, so the true optimum always sits at one
 * of them -- while still discarding any candidate that overlaps `selected` or covers
 * a chrome control's center. If even that search comes up empty (the surface is
 * wider than the canvas has room for anywhere), it falls back to clamping toward
 * whichever side has more open space, same as the plain viewport-only clamp this
 * replaces.
 */
export function positionEditorSurface(
  selected: Bounds,
  viewport: ViewportSize,
  size: SurfaceSize = defaultSize,
  obstacles: Bounds[] = [],
  permanentChrome: Bounds[] = [],
): EditorSurfacePosition {
  const rightLeft = selected.right + margin;
  const leftLeft = selected.left - margin - size.width;
  const top = clamp(selected.top, headerFloor, viewport.height - margin - size.height);
  const bottom = top + size.height;

  const rectAt = (left: number): Bounds => ({ left, right: left + size.width, top, bottom });
  const violatesHardConstraint = (rect: Bounds): boolean =>
    rectsOverlap(rect, selected) || permanentChrome.some((chrome) => coversCenter(rect, chrome));
  const blocksNothing = (rect: Bounds): boolean =>
    !violatesHardConstraint(rect) && obstacles.every((obstacle) => !coversCenter(rect, obstacle));

  const fitsRight = rightLeft + size.width <= viewport.width - margin;
  const fitsLeft = leftLeft >= margin;

  if (fitsRight && blocksNothing(rectAt(rightLeft))) {
    return { left: rightLeft, top, side: "right" };
  }
  if (fitsLeft && blocksNothing(rectAt(leftLeft))) {
    return { left: leftLeft, top, side: "left" };
  }

  const minLeft = margin;
  const maxLeft = viewport.width - margin - size.width;
  const candidateLefts = new Set<number>([minLeft, maxLeft]);
  for (const blocker of [selected, ...obstacles, ...permanentChrome]) {
    candidateLefts.add(blocker.right + margin);
    candidateLefts.add(blocker.left - margin - size.width);
  }

  let best: { left: number; blocked: number; area: number } | null = null;
  for (const rawLeft of candidateLefts) {
    const left = clamp(rawLeft, minLeft, maxLeft);
    const rect = rectAt(left);
    if (violatesHardConstraint(rect)) continue;
    let blocked = 0;
    let area = 0;
    for (const obstacle of obstacles) {
      if (coversCenter(rect, obstacle)) blocked += 1;
      area += overlapArea(rect, obstacle);
    }
    const closerToPreferredSide =
      best !== null && Math.abs(left - rightLeft) < Math.abs(best.left - rightLeft);
    const better =
      !best ||
      blocked < best.blocked ||
      (blocked === best.blocked &&
        (area < best.area || (area === best.area && closerToPreferredSide)));
    if (better) {
      best = { left, blocked, area };
    }
  }

  if (best) {
    return { left: best.left, top, side: "clamped" };
  }

  // Nothing clears `selected` and every chrome control (pathological: the surface has
  // nowhere to go that isn't on top of the very object it edits, or of a permanent
  // control). Clamp toward whichever side has more open room, same as the original
  // viewport-only fallback.
  const rightRoom = viewport.width - margin - selected.right;
  const leftRoom = selected.left - margin;
  const left =
    rightRoom >= leftRoom ? clamp(rightLeft, minLeft, maxLeft) : clamp(leftLeft, minLeft, maxLeft);
  return { left, top, side: "clamped" };
}

/**
 * Horizontal counterpart of positionEditorSurface's `top` clamp, for a surface
 * whose placement is owned elsewhere: the selection halo rides React Flow's
 * node toolbar, which centers it on the selected module with no viewport
 * awareness, so a module against the canvas's left edge pushes the halo's
 * first commands off-screen. Takes the measured box — measured, not declared,
 * since declared size budgets drift from rendered sizes — and returns the X
 * shift that keeps it inside the viewport at the standard margin. A box wider
 * than the viewport pins its left edge so the leading commands stay reachable.
 */
export function horizontalViewportShift(
  box: { left: number; right: number },
  viewportWidth: number,
): number {
  const minLeft = margin;
  const maxRight = viewportWidth - margin;
  if (box.right - box.left > maxRight - minLeft) return minLeft - box.left;
  if (box.left < minLeft) return minLeft - box.left;
  if (box.right > maxRight) return maxRight - box.right;
  return 0;
}

export interface ModuleFootprint {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacementViewport {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const placementMargin = 24;
const placementStep = 40;
// The canvas world is far larger than one viewport. 150 rings * 40px reaches
// a 6,000px radius around the preferred point — comfortably past any
// realistic document density — while still resolving in well under a frame
// even in the pathological case where the search never finds a clear spot.
const placementMaxRings = 150;

function footprintsIntersect(a: ModuleFootprint, b: ModuleFootprint): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function withMargin(footprint: ModuleFootprint, inset: number): ModuleFootprint {
  return {
    x: footprint.x - inset,
    y: footprint.y - inset,
    width: footprint.width + inset * 2,
    height: footprint.height + inset * 2,
  };
}

function withinViewport(footprint: ModuleFootprint, viewport: PlacementViewport): boolean {
  return (
    footprint.x >= viewport.left &&
    footprint.y >= viewport.top &&
    footprint.x + footprint.width <= viewport.right &&
    footprint.y + footprint.height <= viewport.bottom
  );
}

function ringOffsets(ring: number, step: number): Point[] {
  if (ring === 0) return [{ x: 0, y: 0 }];
  const reach = ring * step;
  const offsets: Point[] = [];
  for (let x = -reach; x <= reach; x += step) {
    offsets.push({ x, y: -reach });
    offsets.push({ x, y: reach });
  }
  for (let y = -reach + step; y <= reach - step; y += step) {
    offsets.push({ x: -reach, y });
    offsets.push({ x: reach, y });
  }
  return offsets;
}

/** What `findOpenModulePlacement` found: the point itself, plus whether that point's
 * footprint actually lands inside the caller's viewport (when one was supplied). A
 * caller with a `false` signal knows the new object was placed somewhere the advisor
 * cannot currently see and should pan/fit the camera to reveal it. */
export interface ModulePlacement {
  point: Point;
  withinViewport: boolean;
}

/**
 * Finds the first position near `preferred` whose module-sized footprint (padded by a
 * small margin) does not overlap any occupied module rect. Searches outward in square
 * rings across a large envelope, first preferring positions inside `viewport` when one
 * is supplied, then any clear position outside it — reported via `withinViewport` so a
 * caller can decide whether the camera should pan to reveal the new object. As an
 * absolute last resort, when nothing clear turns up anywhere in the expanded search,
 * cascades to a deterministic offset derived from the occupied count so repeated adds
 * against a fully crowded document never land on the exact same point (never silently
 * stack).
 */
export function findOpenModulePlacement(
  preferred: Point,
  size: SurfaceSize,
  occupied: ModuleFootprint[],
  viewport?: PlacementViewport,
): ModulePlacement {
  const isClear = (point: Point): boolean => {
    const footprint = withMargin(
      { x: point.x, y: point.y, width: size.width, height: size.height },
      placementMargin,
    );
    return !occupied.some((existing) => footprintsIntersect(footprint, existing));
  };

  // When we have no viewport to measure against, there is nothing to report: assume
  // visible rather than triggering a pan the caller has no geometry to justify.
  const reportPlacement = (point: Point): ModulePlacement => ({
    point,
    withinViewport: viewport
      ? withinViewport({ x: point.x, y: point.y, width: size.width, height: size.height }, viewport)
      : true,
  });

  const passes = viewport ? [true, false] : [false];
  for (const requireViewport of passes) {
    for (let ring = 0; ring <= placementMaxRings; ring++) {
      for (const offset of ringOffsets(ring, placementStep)) {
        const point = { x: preferred.x + offset.x, y: preferred.y + offset.y };
        if (requireViewport && viewport) {
          const footprint = { x: point.x, y: point.y, width: size.width, height: size.height };
          if (!withinViewport(footprint, viewport)) continue;
        }
        if (isClear(point)) return reportPlacement(point);
      }
    }
  }

  const cascadeSpacing = size.width + placementMargin * 2;
  const cascadeIndex = occupied.length + 1;
  return reportPlacement({ x: preferred.x + cascadeIndex * cascadeSpacing, y: preferred.y });
}
