import type {
  MoneyMapDocument,
  MoneyMapFlow,
  MoneyMapModule,
  Point,
  PrimitiveStyle,
  Selection,
} from "./types";
import { clearFlowLabelPosition } from "./flowLabel";
import { clampModuleSize } from "./moduleSizing";

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

function endpointMidpoint(
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

function translateLabelForEndpoints(
  document: MoneyMapDocument,
  flow: MoneyMapFlow,
  source: string,
  target: string,
): Point {
  const before = endpointMidpoint(document, flow.source, flow.target);
  const after = endpointMidpoint(document, source, target);
  if (!before || !after) return flow.labelPosition;
  return {
    x: flow.labelPosition.x + after.x - before.x,
    y: flow.labelPosition.y + after.y - before.y,
  };
}

export function moveModules(
  document: MoneyMapDocument,
  positions: ReadonlyMap<string, Point>,
): MoneyMapDocument {
  let modulesChanged = false;
  const modules = document.modules.map((module) => {
    const position = positions.get(module.id);
    if (!position || (module.position.x === position.x && module.position.y === position.y)) {
      return module;
    }
    modulesChanged = true;
    return { ...module, position: { x: position.x, y: position.y } };
  });
  if (!modulesChanged) return document;

  const movedDocument = { ...document, modules };
  let flowsChanged = false;
  const flows = document.flows.map((flow) => {
    const before = endpointMidpoint(document, flow.source, flow.target);
    const after = endpointMidpoint(movedDocument, flow.source, flow.target);
    if (!before || !after || (before.x === after.x && before.y === after.y)) return flow;
    flowsChanged = true;
    return {
      ...flow,
      labelPosition: {
        x: flow.labelPosition.x + after.x - before.x,
        y: flow.labelPosition.y + after.y - before.y,
      },
    };
  });

  return { ...movedDocument, flows: flowsChanged ? flows : document.flows };
}

export function updateFlowEndpoints(
  document: MoneyMapDocument,
  flowId: string,
  source: string,
  target: string,
): MoneyMapDocument {
  return updateFlow(document, flowId, (flow) => {
    if (flow.source === source && flow.target === target) return flow;
    // Translate first — carrying the author's relative placement to the new
    // endpoints is the right intent — then clear it against every module, not
    // just the two this flow now connects.
    const translated = translateLabelForEndpoints(document, flow, source, target);
    const labelPosition =
      clearFlowLabelPosition(document, source, target, translated, flow.waypoints) ?? translated;
    return { ...flow, source, target, labelPosition };
  });
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
  const retainedModuleIds = new Set(modules.map(({ id }) => id));
  const retainedFlowIds = new Set(flows.map(({ id }) => id));
  let presentationChanged = false;
  const filteredPresentation = document.presentation.map((step) => {
    const moduleIds = step.moduleIds.filter((id) => retainedModuleIds.has(id));
    const flowIds = step.flowIds.filter((id) => retainedFlowIds.has(id));
    if (moduleIds.length === step.moduleIds.length && flowIds.length === step.flowIds.length) {
      return step;
    }
    presentationChanged = true;
    return { ...step, moduleIds, flowIds };
  });
  const presentation = presentationChanged ? filteredPresentation : document.presentation;

  if (
    modules === document.modules &&
    flows === document.flows &&
    presentation === document.presentation
  ) {
    return document;
  }

  return { ...document, modules, flows, presentation };
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
        labelPosition: offsetPoint(flow.labelPosition),
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

export type NewModuleStyle = Pick<
  MoneyMapModule,
  "primitive" | "kind" | "priority" | "density" | "colorRole" | "swatch" | "width" | "height"
>;

const newModuleDefaults: Record<
  PrimitiveStyle,
  Pick<MoneyMapModule, "kind" | "eyebrow" | "title" | "width" | "height"> & {
    row?: { label: string; value: string };
  }
> = {
  ledger: {
    kind: "income",
    eyebrow: "Income sources",
    title: "New income source",
    width: 280,
    height: 190,
    row: { label: "Amount", value: "$_____" },
  },
  plate: {
    kind: "account",
    eyebrow: "Account",
    title: "New account",
    width: 300,
    height: 190,
    row: { label: "Balance", value: "$_____" },
  },
  tray: {
    kind: "reserve",
    eyebrow: "Liquidity",
    title: "New reserve",
    width: 300,
    height: 180,
    row: { label: "Available", value: "$_____" },
  },
  band: {
    kind: "specialty",
    eyebrow: "Specialty asset",
    title: "New specialty asset",
    width: 320,
    height: 180,
    row: { label: "Value", value: "$_____" },
  },
  roundel: {
    kind: "need",
    eyebrow: "Household target",
    title: "New target",
    width: 260,
    height: 180,
    row: { label: "Target", value: "$_____" },
  },
  frame: {
    kind: "note",
    eyebrow: "Planning note",
    title: "New planning note",
    width: 280,
    height: 152,
  },
  cylinder: {
    kind: "account",
    eyebrow: "Portfolio",
    title: "New portfolio",
    width: 280,
    height: 196,
    row: { label: "Balance", value: "$_____" },
  },
  text: { kind: "note", eyebrow: "Annotation", title: "New annotation", width: 240, height: 90 },
};

export function createModule(
  document: MoneyMapDocument,
  primitive: PrimitiveStyle,
  position: Point,
  createId: CreateId,
  style?: NewModuleStyle,
): MoneyMapDocument {
  const defaults = newModuleDefaults[primitive];
  const compatible = style?.primitive === primitive;
  const kind = compatible ? style.kind : defaults.kind;
  const id = createId("module");
  const row = defaults.row
    ? [{ id: createId("row"), label: defaults.row.label, value: defaults.row.value }]
    : [];
  const module: MoneyMapModule = {
    id,
    kind,
    primitive,
    position: { x: position.x, y: position.y },
    width: compatible ? style.width : defaults.width,
    height: compatible ? style.height : defaults.height,
    rotation: 0,
    priority: style?.priority ?? "standard",
    density: style?.density ?? "standard",
    colorRole: compatible ? style.colorRole : kind,
    swatch: style?.swatch ?? "base",
    zIndex: Math.max(-1, ...document.modules.map(({ zIndex }) => zIndex)) + 1,
    eyebrow: defaults.eyebrow,
    title: defaults.title,
    rows: row,
  };
  const size = clampModuleSize(module, module);
  return { ...document, modules: [...document.modules, { ...module, ...size }] };
}

export function documentGeometry(document: MoneyMapDocument) {
  return {
    modules: document.modules.map(
      ({
        id,
        primitive,
        position,
        width,
        height,
        rotation,
        priority,
        density,
        colorRole,
        swatch,
        zIndex,
      }) => ({
        id,
        primitive,
        position: { x: position.x, y: position.y },
        width,
        height,
        rotation,
        priority,
        density,
        colorRole,
        swatch,
        zIndex,
      }),
    ),
    flows: document.flows.map(({ id, source, target, route, labelPosition, waypoints }) => ({
      id,
      source,
      target,
      route,
      labelPosition: { x: labelPosition.x, y: labelPosition.y },
      waypoints: waypoints.map(({ x, y }) => ({ x, y })),
    })),
  };
}
