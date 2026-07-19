import { updateFlow, updateModule } from "../model/document";
import type { CadenceKind, MoneyMapDocument, Point, Selection } from "../model/types";

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
  return selection.moduleIds.reduce(
    (current, moduleId) =>
      updateModule(current, moduleId, (module) => ({
        ...module,
        position: {
          x: module.position.x + delta.x,
          y: module.position.y + delta.y,
        },
      })),
    document,
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
  if (!moduleIds.has(connection.source) || !moduleIds.has(connection.target)) return document;
  return updateFlow(document, flowId, (flow) =>
    flow.source === connection.source && flow.target === connection.target
      ? flow
      : { ...flow, source: connection.source, target: connection.target },
  );
}

export function createRelationship(
  document: MoneyMapDocument,
  source: string,
  target: string,
  createId: (kind: string) => string,
): MoneyMapDocument {
  const moduleIds = new Set(document.modules.map(({ id }) => id));
  if (!moduleIds.has(source) || !moduleIds.has(target)) return document;
  return {
    ...document,
    flows: [
      ...document.flows,
      {
        id: createId("flow"),
        source,
        target,
        relationship: "flow",
        route: "curved",
        labelTreatment: "plate",
        label: "New relationship",
        cadence: { kind: "as-needed", label: "As needed" },
        waypoints: [],
      },
    ],
  };
}
