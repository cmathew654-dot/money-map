import type { MoneyMapDocument, MoneyMapFlow, MoneyMapModule, Point, Selection } from "./types";

type CreateId = (kind: string) => string;

export function updateModule(
  document: MoneyMapDocument,
  moduleId: string,
  updater: (module: MoneyMapModule) => MoneyMapModule,
): MoneyMapDocument {
  const index = document.modules.findIndex((module) => module.id === moduleId);
  if (index === -1) return document;

  const updatedModule = updater(document.modules[index]);
  if (updatedModule === document.modules[index]) return document;

  const modules = [...document.modules];
  modules[index] = updatedModule;
  return { ...document, modules };
}

export function updateFlow(
  document: MoneyMapDocument,
  flowId: string,
  updater: (flow: MoneyMapFlow) => MoneyMapFlow,
): MoneyMapDocument {
  const index = document.flows.findIndex((flow) => flow.id === flowId);
  if (index === -1) return document;

  const updatedFlow = updater(document.flows[index]);
  if (updatedFlow === document.flows[index]) return document;

  const flows = [...document.flows];
  flows[index] = updatedFlow;
  return { ...document, flows };
}

export function removeSelection(
  document: MoneyMapDocument,
  selection: Selection,
): MoneyMapDocument {
  const selectedModules = new Set(selection.moduleIds);
  const selectedFlows = new Set(selection.flowIds);
  const filteredModules = document.modules.filter((module) => !selectedModules.has(module.id));
  const filteredFlows = document.flows.filter(
    (flow) =>
      !selectedFlows.has(flow.id) &&
      !selectedModules.has(flow.source) &&
      !selectedModules.has(flow.target),
  );
  const modules =
    filteredModules.length === document.modules.length ? document.modules : filteredModules;
  const flows = filteredFlows.length === document.flows.length ? document.flows : filteredFlows;

  if (modules === document.modules && flows === document.flows) return document;

  return { ...document, modules, flows };
}

function offsetPoint(point: Point): Point {
  return { x: point.x + 32, y: point.y + 32 };
}

export function duplicateSelection(
  document: MoneyMapDocument,
  selection: Selection,
  createId: CreateId,
): MoneyMapDocument {
  const selectedModules = new Set(selection.moduleIds);
  const duplicatedIds = new Map<string, string>();
  const duplicatedModules = document.modules
    .filter((module) => selectedModules.has(module.id))
    .map((module) => {
      const id = createId("module");
      duplicatedIds.set(module.id, id);
      return {
        ...module,
        id,
        position: offsetPoint(module.position),
        rows: module.rows.map((row) => ({ ...row, id: createId("row") })),
        total: module.total ? { ...module.total } : undefined,
      };
    });

  if (duplicatedModules.length === 0) return document;

  const duplicatedFlows = document.flows.flatMap((flow) => {
    const source = duplicatedIds.get(flow.source);
    const target = duplicatedIds.get(flow.target);
    if (!source || !target) return [];

    return [
      {
        ...flow,
        id: createId("flow"),
        source,
        target,
        cadence: { ...flow.cadence },
        waypoints: flow.waypoints.map(offsetPoint),
      },
    ];
  });

  return {
    ...document,
    modules: [...document.modules, ...duplicatedModules],
    flows: [...document.flows, ...duplicatedFlows],
  };
}

export function documentGeometry(document: MoneyMapDocument) {
  return {
    modules: document.modules.map(({ id, position, width }) => ({
      id,
      position: { x: position.x, y: position.y },
      width,
    })),
    flows: document.flows.map(({ id, source, target, route, waypoints }) => ({
      id,
      source,
      target,
      route,
      waypoints: waypoints.map(({ x, y }) => ({ x, y })),
    })),
  };
}
