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

function defaultFlowLabelPosition(
  document: MoneyMapDocument,
  sourceId: string,
  targetId: string,
): Point | null {
  const source = document.modules.find(({ id }) => id === sourceId);
  const target = document.modules.find(({ id }) => id === targetId);
  if (!source || !target) return null;
  return {
    x: (source.position.x + source.width / 2 + target.position.x + target.width / 2) / 2,
    y: (source.position.y + source.height / 2 + target.position.y + target.height / 2) / 2,
  };
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
