import type { MoneyMapDocument, MoneyMapModule, Point } from "./types";

/** Matches the canvas reconnectRadius used for endpoint pointer grabs. */
export const FLOW_RECONNECT_RADIUS = 26;

// What a label occupies in world units at 100% zoom, measured against the
// bundled fonts: a resting pill with its label and cadence lines renders
// 98x42.4 (the earlier 96x32 floor predates the cadence line). Kept at the
// measurement deliberately — an inflated footprint cannot fit gaps that a
// real label does (the authored starters have 100px channels between cards),
// which would push every label off its own route for clearances it does not
// need.
const flowLabelFootprint = { width: 100, height: 44 };

interface LabelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function moduleBounds(document: MoneyMapDocument): LabelBounds[] {
  return document.modules.map((module) => ({
    left: module.position.x,
    right: module.position.x + module.width,
    top: module.position.y,
    bottom: module.position.y + module.height,
  }));
}

// A label that grazes a card edge is not the defect; a label sitting ON a card
// is. Same distinction positionEditorSurface draws for anchored surfaces, and
// it matters here because the authored channels between cards are barely wider
// than a label: demanding zero contact would shove labels far off their own
// route to avoid a few pixels of overlap that nobody reads as a collision.
const labelGrazeTolerance = 8;

export function flowAttachmentPoint(module: MoneyMapModule, toward: Point): Point {
  const center = {
    x: module.position.x + module.width / 2,
    y: module.position.y + module.height / 2,
  };
  const deltaX = toward.x - center.x;
  const deltaY = toward.y - center.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return {
      x: deltaX >= 0 ? module.position.x + module.width : module.position.x,
      y: center.y,
    };
  }
  return {
    x: center.x,
    y: deltaY >= 0 ? module.position.y + module.height : module.position.y,
  };
}

function labelClearAt(
  point: Point,
  blockers: LabelBounds[],
  attachmentBlockers: readonly Point[],
): boolean {
  const halfWidth = flowLabelFootprint.width / 2;
  const halfHeight = flowLabelFootprint.height / 2;
  const box: LabelBounds = {
    left: point.x - halfWidth,
    right: point.x + halfWidth,
    top: point.y - halfHeight,
    bottom: point.y + halfHeight,
  };
  const clearsModules = !blockers.some((blocker) => {
    const overlapWidth = Math.min(box.right, blocker.right) - Math.max(box.left, blocker.left);
    const overlapHeight = Math.min(box.bottom, blocker.bottom) - Math.max(box.top, blocker.top);
    return overlapWidth > labelGrazeTolerance && overlapHeight > labelGrazeTolerance;
  });
  if (!clearsModules) return false;

  return attachmentBlockers.every((circleCenter) => {
    const nearest = {
      x: Math.max(box.left, Math.min(circleCenter.x, box.right)),
      y: Math.max(box.top, Math.min(circleCenter.y, box.bottom)),
    };
    const distance = Math.hypot(nearest.x - circleCenter.x, nearest.y - circleCenter.y);
    return FLOW_RECONNECT_RADIUS - distance <= labelGrazeTolerance;
  });
}

/**
 * Where a relationship label can sit without landing on a card.
 *
 * Used for both of the moments that produce a label position the author did not
 * place by hand: drawing a new relationship, and reconnecting an existing one.
 * They differ only in what "ideal" means. A new flow wants the plain
 * centre-to-centre midpoint; a reconnected flow wants the author's existing
 * placement carried across to the new endpoints. Both then need the same thing —
 * the nearest point to that ideal which is clear of *every* module, not just the
 * ones the flow happens to connect.
 *
 * That distinction is the whole reason this lives in one place. Reconnect used
 * to push the label out of its two endpoint rectangles and stop, with no
 * re-check, so it could push the label straight onto a third card: 615 of 1,510
 * possible reconnections across the four starters did exactly that.
 *
 * Candidates are ordered by how far they sit from the ideal, so the result is
 * the smallest correction that actually clears. Ordering matters more than the
 * search space: stepping perpendicular only after exhausting the whole route
 * sent a label 96px off its own line to escape a 12px clip, when a 24px nudge
 * would have done.
 */
export function clearFlowLabelPosition(
  document: MoneyMapDocument,
  sourceId: string,
  targetId: string,
  ideal?: Point,
  waypoints: readonly Point[] = [],
): Point | null {
  const source = document.modules.find(({ id }) => id === sourceId);
  const target = document.modules.find(({ id }) => id === targetId);
  if (!source || !target) return null;

  const from = {
    x: source.position.x + source.width / 2,
    y: source.position.y + source.height / 2,
  };
  const to = { x: target.position.x + target.width / 2, y: target.position.y + target.height / 2 };
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const anchor = ideal ?? midpoint;
  const blockers = moduleBounds(document);
  // A translated ideal means the endpoints just changed, so its preserved
  // route must also leave both reconnect grabs reachable. New/reset labels
  // retain their established midpoint contract and only need card clearance.
  const attachmentBlockers = ideal
    ? [
        flowAttachmentPoint(source, waypoints[0] ?? to),
        flowAttachmentPoint(target, waypoints.at(-1) ?? from),
      ]
    : [];

  const spanX = to.x - from.x;
  const spanY = to.y - from.y;
  const length = Math.hypot(spanX, spanY) || 1;
  const normalX = -spanY / length;
  const normalY = spanX / length;

  const candidates: Array<{ point: Point; displacement: number }> = [
    { point: anchor, displacement: 0 },
  ];
  for (const fraction of [0.5, 0.46, 0.54, 0.42, 0.58, 0.36, 0.64, 0.3, 0.7, 0.24, 0.76]) {
    for (const offset of [0, 24, -24, 48, -48, 80, -80, 120, -120, 180, -180, 260, -260]) {
      const base = {
        x: from.x + spanX * fraction,
        y: from.y + spanY * fraction,
      };
      const point = { x: base.x + normalX * offset, y: base.y + normalY * offset };
      candidates.push({
        point,
        displacement: Math.hypot(point.x - anchor.x, point.y - anchor.y),
      });
    }
  }
  candidates.sort((first, second) => first.displacement - second.displacement);

  for (const { point } of candidates) {
    if (labelClearAt(point, blockers, attachmentBlockers)) return point;
  }

  return anchor;
}
