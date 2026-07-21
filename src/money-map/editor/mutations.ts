import { moveModules, updateFlow, updateFlowEndpoints, updateModule } from "../model/document";
import type {
  CadenceKind,
  ColorRole,
  ContentDensity,
  ModulePriority,
  MoneyMapCadence,
  MoneyMapDocument,
  Point,
  PrimitiveStyle,
  Selection,
  ThemeSwatch,
} from "../model/types";

function finiteNumber(value: number): boolean {
  return Number.isFinite(value);
}

// Roughly what a label occupies in world units at 100% zoom: .money-map-flow-label
// floors at 96x32 (canvas.css). Kept close to that floor deliberately — an
// inflated footprint cannot fit gaps that a real label does (the authored
// starters have 100px channels between cards), which would push every label
// off its own route for clearances it does not need.
const flowLabelFootprint = { width: 100, height: 36 };

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

function labelClearAt(point: Point, blockers: LabelBounds[]): boolean {
  const halfWidth = flowLabelFootprint.width / 2;
  const halfHeight = flowLabelFootprint.height / 2;
  const box: LabelBounds = {
    left: point.x - halfWidth,
    right: point.x + halfWidth,
    top: point.y - halfHeight,
    bottom: point.y + halfHeight,
  };
  return !blockers.some((blocker) => {
    const overlapWidth = Math.min(box.right, blocker.right) - Math.max(box.left, blocker.left);
    const overlapHeight = Math.min(box.bottom, blocker.bottom) - Math.max(box.top, blocker.top);
    return overlapWidth > labelGrazeTolerance && overlapHeight > labelGrazeTolerance;
  });
}

/**
 * Where a new (or reset) relationship label goes.
 *
 * The plain centre-to-centre midpoint is right most of the time and is still
 * tried first, so authored compositions and resets land exactly where they
 * always did. But it is computed with no knowledge of what occupies that
 * point: draw a flow across a populated map and the label lands on top of a
 * card, which is the first thing a user sees after the primary authoring
 * action. So when the midpoint is occupied, walk the route outward from the
 * middle for a clear point, and only if the whole route is covered step
 * perpendicular off it — preferring a spot on the line the label belongs to
 * over one merely near it.
 */
function defaultFlowLabelPosition(
  document: MoneyMapDocument,
  sourceId: string,
  targetId: string,
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
  const blockers = moduleBounds(document);

  const spanX = to.x - from.x;
  const spanY = to.y - from.y;
  const length = Math.hypot(spanX, spanY) || 1;
  const normalX = -spanY / length;
  const normalY = spanX / length;

  // Candidates are ordered by how far they sit from the midpoint, so the
  // result is the smallest correction that actually clears. Ordering matters
  // more than the search space: stepping perpendicular only after exhausting
  // the whole route sent a label 96px off its own line to escape a 12px clip,
  // when a 24px nudge would have done.
  const candidates: Array<{ point: Point; displacement: number }> = [];
  for (const fraction of [0.5, 0.46, 0.54, 0.42, 0.58, 0.36, 0.64, 0.3, 0.7, 0.24, 0.76]) {
    for (const offset of [0, 24, -24, 48, -48, 80, -80, 120, -120, 180, -180, 260, -260]) {
      const base = {
        x: from.x + spanX * fraction,
        y: from.y + spanY * fraction,
      };
      const point = { x: base.x + normalX * offset, y: base.y + normalY * offset };
      candidates.push({
        point,
        displacement: Math.hypot(point.x - midpoint.x, point.y - midpoint.y),
      });
    }
  }
  candidates.sort((first, second) => first.displacement - second.displacement);

  for (const { point } of candidates) {
    if (labelClearAt(point, blockers)) return point;
  }

  return midpoint;
}

export function setModuleHeight(
  document: MoneyMapDocument,
  moduleId: string,
  height: number,
): MoneyMapDocument {
  if (!finiteNumber(height) || height <= 0) return document;
  return updateModule(document, moduleId, (module) =>
    module.height === height ? module : { ...module, height },
  );
}

export function setModuleRotation(
  document: MoneyMapDocument,
  moduleId: string,
  rotation: number,
): MoneyMapDocument {
  if (!finiteNumber(rotation)) return document;
  const snapped = Math.round(rotation / 15) * 15;
  return updateModule(document, moduleId, (module) =>
    module.rotation === snapped ? module : { ...module, rotation: snapped },
  );
}

export function setModulePriority(
  document: MoneyMapDocument,
  moduleId: string,
  priority: ModulePriority,
): MoneyMapDocument {
  return updateModule(document, moduleId, (module) =>
    module.priority === priority ? module : { ...module, priority },
  );
}

export function setModuleDensity(
  document: MoneyMapDocument,
  moduleId: string,
  density: ContentDensity,
): MoneyMapDocument {
  return updateModule(document, moduleId, (module) =>
    module.density === density ? module : { ...module, density },
  );
}

export function setModuleColor(
  document: MoneyMapDocument,
  moduleId: string,
  color: { colorRole: ColorRole; swatch: ThemeSwatch },
): MoneyMapDocument {
  return updateModule(document, moduleId, (module) =>
    module.colorRole === color.colorRole && module.swatch === color.swatch
      ? module
      : { ...module, ...color },
  );
}

export function setModuleZIndex(
  document: MoneyMapDocument,
  moduleId: string,
  zIndex: number,
): MoneyMapDocument {
  if (!finiteNumber(zIndex)) return document;
  return updateModule(document, moduleId, (module) =>
    module.zIndex === zIndex ? module : { ...module, zIndex },
  );
}

export function setModulePrimitive(
  document: MoneyMapDocument,
  moduleId: string,
  primitive: PrimitiveStyle,
): MoneyMapDocument {
  return updateModule(document, moduleId, (module) =>
    module.primitive === primitive ? module : { ...module, primitive },
  );
}

export type ModuleField =
  | { field: "title" | "eyebrow" | "subtitle" | "note" }
  | { field: "row-label" | "row-value"; rowId: string }
  | { field: "total-label" | "total-value" };

export function editModuleField(
  document: MoneyMapDocument,
  moduleId: string,
  target: ModuleField,
  literal: string,
): MoneyMapDocument {
  return updateModule(document, moduleId, (module) => {
    if (target.field === "title" || target.field === "eyebrow") {
      return module[target.field] === literal ? module : { ...module, [target.field]: literal };
    }
    if (target.field === "subtitle" || target.field === "note") {
      return module[target.field] === literal ? module : { ...module, [target.field]: literal };
    }
    if (target.field === "row-label" || target.field === "row-value") {
      const rowIndex = module.rows.findIndex(({ id }) => id === target.rowId);
      if (rowIndex === -1) return module;
      const key = target.field === "row-label" ? "label" : "value";
      if (module.rows[rowIndex][key] === literal) return module;
      const rows = [...module.rows];
      rows[rowIndex] = { ...rows[rowIndex], [key]: literal };
      return { ...module, rows };
    }
    if (!module.total) return module;
    const key = target.field === "total-label" ? "label" : "value";
    if (module.total[key] === literal) return module;
    return { ...module, total: { ...module.total, [key]: literal } };
  });
}

export function nudgeSelection(
  document: MoneyMapDocument,
  selection: Selection,
  delta: { x: number; y: number },
): MoneyMapDocument {
  const selected = new Set(selection.moduleIds);
  return moveModules(
    document,
    new Map(
      document.modules
        .filter(({ id }) => selected.has(id))
        .map((module) => [
          module.id,
          { x: module.position.x + delta.x, y: module.position.y + delta.y },
        ]),
    ),
  );
}

export type FlowField =
  { field: "label" | "secondaryLabel" } | { field: "cadence"; kind: CadenceKind };

export function editFlowField(
  document: MoneyMapDocument,
  flowId: string,
  target: FlowField,
  literal: string,
): MoneyMapDocument {
  return updateFlow(document, flowId, (flow) => {
    if (target.field === "cadence") {
      if (flow.cadence.kind === target.kind && flow.cadence.label === literal) return flow;
      return { ...flow, cadence: { kind: target.kind, label: literal } };
    }
    if (flow[target.field] === literal) return flow;
    return { ...flow, [target.field]: literal };
  });
}

export function moveFlowWaypoint(
  document: MoneyMapDocument,
  flowId: string,
  point: Point,
): MoneyMapDocument {
  return updateFlow(document, flowId, (flow) => ({
    ...flow,
    waypoints: [{ x: point.x, y: point.y }, ...flow.waypoints.slice(1)],
  }));
}

export function moveFlowLabel(
  document: MoneyMapDocument,
  flowId: string,
  point: Point,
): MoneyMapDocument {
  if (!finiteNumber(point.x) || !finiteNumber(point.y)) return document;
  return updateFlow(document, flowId, (flow) =>
    flow.labelPosition.x === point.x && flow.labelPosition.y === point.y
      ? flow
      : { ...flow, labelPosition: { x: point.x, y: point.y } },
  );
}

export function resetFlowLabel(document: MoneyMapDocument, flowId: string): MoneyMapDocument {
  const flow = document.flows.find(({ id }) => id === flowId);
  if (!flow) return document;
  const point = defaultFlowLabelPosition(document, flow.source, flow.target);
  return point ? moveFlowLabel(document, flowId, point) : document;
}

export function resetFlowWaypoint(document: MoneyMapDocument, flowId: string): MoneyMapDocument {
  return updateFlow(document, flowId, (flow) =>
    flow.waypoints.length === 0 ? flow : { ...flow, waypoints: flow.waypoints.slice(1) },
  );
}

export function reconnectFlow(
  document: MoneyMapDocument,
  flowId: string,
  connection: { source: string; target: string },
): MoneyMapDocument {
  const moduleIds = new Set(document.modules.map(({ id }) => id));
  if (
    connection.source === connection.target ||
    !moduleIds.has(connection.source) ||
    !moduleIds.has(connection.target)
  )
    return document;
  return updateFlowEndpoints(document, flowId, connection.source, connection.target);
}

export function createRelationship(
  document: MoneyMapDocument,
  source: string,
  target: string,
  createId: (kind: string) => string,
  cadence: MoneyMapCadence = { kind: "as-needed", label: "As needed" },
): MoneyMapDocument {
  const moduleById = new Map(document.modules.map((module) => [module.id, module]));
  const moduleIds = new Set(moduleById.keys());
  if (source === target || !moduleIds.has(source) || !moduleIds.has(target)) return document;
  const labelPosition = defaultFlowLabelPosition(document, source, target)!;
  return {
    ...document,
    flows: [
      ...document.flows,
      {
        id: createId("flow"),
        source,
        target,
        relationship: "transfer",
        route: "curved",
        labelTreatment: "plate",
        label: "New transfer",
        cadence: { ...cadence },
        labelPosition,
        waypoints: [],
      },
    ],
  };
}
