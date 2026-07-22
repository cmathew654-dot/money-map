import { CommandRegistry } from "../commands/registry";
import type { CommandDefinition, EditorMutation } from "../commands/types";
import {
  duplicateSelection,
  moveModules,
  removeSelection,
  updateFlow,
  updateModule,
} from "../model/document";
import { resetFlowLabel, setModulePrimitive } from "./mutations";
import type {
  CadenceKind,
  LabelTreatment,
  ModulePriority,
  MoneyMapDocument,
  ContentDensity,
  PrimitiveStyle,
  RelationshipKind,
  RouteKind,
  Selection,
  ThemeSwatch,
} from "../model/types";
import { clampModuleSize } from "../model/moduleSizing";

export interface WorkspaceCommandContext {
  document: MoneyMapDocument;
  selection: Selection;
  canUndo: boolean;
  canRedo: boolean;
}

export type WorkspaceSurface =
  "inline" | "appearance" | "properties" | "draw-flow" | "flow-inline" | "flow-properties";

export type CameraAction = "fit-story" | "fit-selection" | "reset-zoom";

export type WorkspaceCommandResult =
  | { kind: "mutation"; mutation: EditorMutation; nextSelection?: Selection }
  | { kind: "surface"; surface: WorkspaceSurface }
  | { kind: "history"; action: "undo" | "redo" }
  | { kind: "camera"; action: CameraAction }
  | { kind: "reset" }
  | { kind: "add" }
  | { kind: "present" }
  | { kind: "legend" };

export type WorkspaceCommandDefinition = CommandDefinition<
  WorkspaceCommandContext,
  WorkspaceCommandResult
>;

const primitives: PrimitiveStyle[] = [
  "ledger",
  "plate",
  "tray",
  "band",
  "roundel",
  "frame",
  "cylinder",
  "text",
];
export const primitiveLabels: Record<PrimitiveStyle, string> = {
  ledger: "Ledger",
  plate: "Plate",
  tray: "Tray",
  band: "Band",
  roundel: "Roundel",
  frame: "Frame",
  cylinder: "Cylinder",
  text: "Text note",
};
const widths = [
  { id: "small", label: "Small", width: 240 },
  { id: "standard", label: "Standard", width: 320 },
  { id: "wide", label: "Wide", width: 400 },
] as const;

function selectedModules(context: WorkspaceCommandContext) {
  const ids = new Set(context.selection.moduleIds);
  return context.document.modules.filter((module) => ids.has(module.id));
}

function hasModules(context: WorkspaceCommandContext): boolean {
  return selectedModules(context).length > 0;
}

function hasSingleModule(context: WorkspaceCommandContext): boolean {
  return selectedModules(context).length === 1 && context.selection.flowIds.length === 0;
}

function hasAtLeastModules(count: number) {
  return (context: WorkspaceCommandContext) => selectedModules(context).length >= count;
}

function selectedFlows(context: WorkspaceCommandContext) {
  const ids = new Set(context.selection.flowIds);
  return context.document.flows.filter((flow) => ids.has(flow.id));
}

function hasSingleFlow(context: WorkspaceCommandContext): boolean {
  return context.selection.moduleIds.length === 0 && selectedFlows(context).length === 1;
}

function updateSelectedFlow(
  context: WorkspaceCommandContext,
  update: Parameters<typeof updateFlow>[2],
): MoneyMapDocument {
  const flow = selectedFlows(context)[0];
  return flow ? updateFlow(context.document, flow.id, update) : context.document;
}
function hasActionableSelection(context: WorkspaceCommandContext): boolean {
  if (hasModules(context)) return true;
  const ids = new Set(context.selection.flowIds);
  return context.document.flows.some((flow) => ids.has(flow.id));
}

function updateSelectedModules(
  context: WorkspaceCommandContext,
  update: Parameters<typeof updateModule>[2],
): MoneyMapDocument {
  return context.selection.moduleIds.reduce(
    (document, id) => updateModule(document, id, update),
    context.document,
  );
}

function mutation(document: MoneyMapDocument, announcement: string): WorkspaceCommandResult {
  return { kind: "mutation", mutation: { document, announcement } };
}

function alignSelection(
  context: WorkspaceCommandContext,
  axis: "x" | "y",
  edge: "start" | "center" | "end",
): MoneyMapDocument {
  const modules = selectedModules(context);
  if (modules.length < 2) return context.document;
  const starts = modules.map((module) => module.position[axis]);
  const ends = modules.map(
    (module) => module.position[axis] + (axis === "x" ? module.width : module.height),
  );
  const target =
    edge === "start"
      ? Math.min(...starts)
      : edge === "end"
        ? Math.max(...ends)
        : (Math.min(...starts) + Math.max(...ends)) / 2;
  return moveModules(
    context.document,
    new Map(
      modules.map((module) => {
        const size = axis === "x" ? module.width : module.height;
        const coordinate =
          edge === "start" ? target : edge === "end" ? target - size : target - size / 2;
        return [
          module.id,
          axis === "x"
            ? { x: coordinate, y: module.position.y }
            : { x: module.position.x, y: coordinate },
        ];
      }),
    ),
  );
}

function distributeSelection(context: WorkspaceCommandContext, axis: "x" | "y"): MoneyMapDocument {
  const modules = selectedModules(context).sort((first, second) => {
    const firstCenter = first.position[axis] + (axis === "x" ? first.width : first.height) / 2;
    const secondCenter = second.position[axis] + (axis === "x" ? second.width : second.height) / 2;
    return firstCenter - secondCenter;
  });
  if (modules.length < 3) return context.document;
  const firstCenter =
    modules[0].position[axis] + (axis === "x" ? modules[0].width : modules[0].height) / 2;
  const last = modules.at(-1)!;
  const lastCenter = last.position[axis] + (axis === "x" ? last.width : last.height) / 2;
  const interval = (lastCenter - firstCenter) / (modules.length - 1);
  return moveModules(
    context.document,
    new Map(
      modules.map((module, index) => {
        const size = axis === "x" ? module.width : module.height;
        const coordinate = firstCenter + interval * index - size / 2;
        return [
          module.id,
          axis === "x"
            ? { x: coordinate, y: module.position.y }
            : { x: module.position.x, y: coordinate },
        ];
      }),
    ),
  );
}

export function createWorkspaceCommands(
  createId: (kind: string) => string,
): CommandRegistry<WorkspaceCommandContext, WorkspaceCommandResult> {
  const registry = new CommandRegistry<WorkspaceCommandContext, WorkspaceCommandResult>();

  for (const [id, label, surface] of [
    ["module.edit", "Edit shape", "inline"],
    ["module.style", "Style shape", "appearance"],
    // One concept, two doors: Connect mode (C) is the pointer route, this is the
    // keyboard route. They share the word "Connect" deliberately. The surface id
    // stays "draw-flow" so it keeps seeding the palette keywords below — a search
    // for "draw" or "flow" still finds connecting.
    ["module.draw-flow", "Connect to…", "draw-flow"],
    ["module.properties", "More properties", "properties"],
  ] as const) {
    registry.register({
      id,
      label,
      keywords: surface === "properties" ? ["details", "advanced"] : [surface],
      shortcut: surface === "inline" ? "Enter" : surface === "draw-flow" ? "L" : undefined,
      isAvailable: hasSingleModule,
      execute: () => ({ kind: "surface", surface }),
    });
  }

  registry.register({
    id: "selection.duplicate",
    label: "Duplicate selection",
    keywords: ["copy", "clone"],
    shortcut: "Ctrl/Cmd+D",
    isAvailable: hasModules,
    execute: (context) => {
      const existing = new Set(context.document.modules.map(({ id }) => id));
      const document = duplicateSelection(context.document, context.selection, createId);
      const moduleIds = document.modules.filter(({ id }) => !existing.has(id)).map(({ id }) => id);
      return {
        kind: "mutation",
        mutation: { document, announcement: "Selection duplicated." },
        nextSelection: { moduleIds, flowIds: [] },
      };
    },
  });

  for (const [id, label, axis, edge] of [
    ["selection.align.left", "Align left", "x", "start"],
    ["selection.align.center", "Align centers", "x", "center"],
    ["selection.align.right", "Align right", "x", "end"],
    ["selection.align.top", "Align top", "y", "start"],
    ["selection.align.middle", "Align middles", "y", "center"],
    ["selection.align.bottom", "Align bottom", "y", "end"],
  ] as const) {
    registry.register({
      id,
      label,
      keywords: ["arrange", "position", "line up"],
      isAvailable: hasAtLeastModules(2),
      execute: (context) => mutation(alignSelection(context, axis, edge), `${label}.`),
    });
  }

  for (const [id, label, axis] of [
    ["selection.distribute.horizontal", "Distribute horizontally", "x"],
    ["selection.distribute.vertical", "Distribute vertically", "y"],
  ] as const) {
    registry.register({
      id,
      label,
      keywords: ["arrange", "space evenly"],
      isAvailable: hasAtLeastModules(3),
      execute: (context) => mutation(distributeSelection(context, axis), `${label}.`),
    });
  }

  for (const [id, label, delta] of [
    ["module.order.forward", "Bring forward", 1],
    ["module.order.back", "Send back", -1],
  ] as const) {
    registry.register({
      id,
      label,
      keywords: ["arrange", "layer", "z order"],
      isAvailable: hasModules,
      execute: (context) =>
        mutation(
          updateSelectedModules(context, (module) => ({
            ...module,
            zIndex: module.zIndex + delta,
          })),
          `${label}.`,
        ),
    });
  }

  registry.register({
    id: "selection.remove",
    label: "Remove selection",
    keywords: ["delete"],
    shortcut: "Delete",
    shortcutAliases: ["Backspace"],
    isAvailable: hasActionableSelection,
    execute: (context) => ({
      kind: "mutation",
      mutation: {
        document: removeSelection(context.document, context.selection),
        announcement: "Selection removed.",
      },
      nextSelection: { moduleIds: [], flowIds: [] },
    }),
  });

  registry.register({
    id: "history.undo",
    label: "Undo",
    keywords: ["back", "history"],
    shortcut: "Ctrl/Cmd+Z",
    isAvailable: ({ canUndo }) => canUndo,
    execute: () => ({ kind: "history", action: "undo" }),
  });

  registry.register({
    id: "history.redo",
    label: "Redo",
    keywords: ["forward", "history"],
    shortcut: "Ctrl/Cmd+Shift+Z",
    isAvailable: ({ canRedo }) => canRedo,
    execute: () => ({ kind: "history", action: "redo" }),
  });

  registry.register({
    id: "camera.fit-story",
    label: "Fit story",
    keywords: ["camera", "zoom", "frame all", "fit view"],
    isAvailable: () => true,
    execute: () => ({ kind: "camera", action: "fit-story" }),
  });

  registry.register({
    id: "camera.fit-selection",
    label: "Fit selection",
    keywords: ["camera", "zoom", "frame selection", "fit view"],
    isAvailable: () => true,
    execute: () => ({ kind: "camera", action: "fit-selection" }),
  });

  registry.register({
    id: "camera.reset-zoom",
    label: "Reset zoom to 100%",
    keywords: ["camera", "zoom", "100%"],
    isAvailable: () => true,
    execute: () => ({ kind: "camera", action: "reset-zoom" }),
  });

  registry.register({
    id: "workspace.add",
    label: "Add to map",
    keywords: ["shape", "module", "new", "create"],
    isAvailable: () => true,
    execute: () => ({ kind: "add" }),
  });

  registry.register({
    id: "workspace.present",
    label: "Present story",
    keywords: ["presentation", "slideshow", "client view"],
    isAvailable: () => true,
    execute: () => ({ kind: "present" }),
  });

  registry.register({
    id: "workspace.legend",
    label: "Legend",
    keywords: ["relationships", "key", "flows", "colors"],
    isAvailable: (context) => context.document.flows.length > 0,
    execute: () => ({ kind: "legend" }),
  });

  registry.register({
    id: "document.reset",
    label: "Reset story",
    keywords: ["restore", "starter", "scaffold"],
    isAvailable: () => true,
    execute: () => ({ kind: "reset" }),
  });

  for (const preset of widths) {
    registry.register({
      id: `module.width.${preset.id}`,
      label: `${preset.label} width`,
      keywords: ["width", "resize", String(preset.width)],
      isAvailable: hasModules,
      execute: (context) =>
        mutation(
          updateSelectedModules(context, (module) =>
            module.width === preset.width
              ? module
              : {
                  ...module,
                  ...clampModuleSize(module, { width: preset.width, height: module.height }),
                },
          ),
          `${preset.label} width applied.`,
        ),
    });
  }

  for (const primitive of primitives) {
    registry.register({
      id: `module.primitive.${primitive}`,
      label: primitiveLabels[primitive],
      keywords: ["primitive", "appearance", "style"],
      isAvailable: hasSingleModule,
      execute: (context) => {
        const moduleId = context.selection.moduleIds[0];
        const current = context.document.modules.find(({ id }) => id === moduleId);
        const document = setModulePrimitive(context.document, moduleId, primitive);
        const updated = document.modules.find(({ id }) => id === moduleId);
        const dimensionsAdjusted =
          current !== undefined &&
          updated !== undefined &&
          (current.width !== updated.width || current.height !== updated.height);
        const announcement = dimensionsAdjusted
          ? `${primitiveLabels[primitive]} applied. Size expanded to the shape minimum to keep content readable.`
          : `${primitiveLabels[primitive]} applied.`;
        return mutation(document, announcement);
      },
    });
  }

  for (const priority of ["quiet", "standard", "spotlight"] as ModulePriority[]) {
    registry.register({
      id: `module.priority.${priority}`,
      label: `${priority[0].toLocaleUpperCase()}${priority.slice(1)} priority`,
      keywords: ["appearance", "hierarchy", "emphasis"],
      isAvailable: hasModules,
      execute: (context) =>
        mutation(
          updateSelectedModules(context, (module) =>
            module.priority === priority ? module : { ...module, priority },
          ),
          `${priority} priority applied.`,
        ),
    });
  }

  for (const density of ["essential", "standard", "full"] as ContentDensity[]) {
    registry.register({
      id: `module.density.${density}`,
      label: `${density[0].toLocaleUpperCase()}${density.slice(1)} detail`,
      keywords: ["appearance", "content", "density"],
      isAvailable: hasModules,
      execute: (context) =>
        mutation(
          updateSelectedModules(context, (module) => {
            if (module.density === density) return module;
            const next = { ...module, density };
            return { ...next, ...clampModuleSize(next, next) };
          }),
          `${density} detail applied.`,
        ),
    });
  }

  for (const swatch of ["base", "muted", "accent", "contrast"] as ThemeSwatch[]) {
    registry.register({
      id: `module.swatch.${swatch}`,
      label: `${swatch[0].toLocaleUpperCase()}${swatch.slice(1)} color`,
      keywords: ["appearance", "color", "palette"],
      isAvailable: hasModules,
      execute: (context) =>
        mutation(
          updateSelectedModules(context, (module) =>
            module.swatch === swatch ? module : { ...module, swatch },
          ),
          `${swatch} color applied.`,
        ),
    });
  }

  registry.register({
    id: "flow.edit",
    label: "Edit relationship label",
    keywords: ["connection", "text"],
    shortcut: "Enter",
    isAvailable: hasSingleFlow,
    execute: () => ({ kind: "surface", surface: "flow-inline" }),
  });

  registry.register({
    id: "flow.properties",
    label: "Relationship properties",
    keywords: ["connection", "route", "cadence"],
    isAvailable: hasSingleFlow,
    execute: () => ({ kind: "surface", surface: "flow-properties" }),
  });

  for (const route of ["straight", "orthogonal", "curved"] as RouteKind[]) {
    registry.register({
      id: `flow.route.${route}`,
      label: `${route[0].toLocaleUpperCase()}${route.slice(1)} route`,
      keywords: ["relationship", "line", "path"],
      isAvailable: hasSingleFlow,
      execute: (context) =>
        mutation(
          updateSelectedFlow(context, (flow) => (flow.route === route ? flow : { ...flow, route })),
          `${route} route applied.`,
        ),
    });
  }

  for (const relationship of [
    "income",
    "transfer",
    "replenishment",
    "planned",
  ] as RelationshipKind[]) {
    registry.register({
      id: `flow.relationship.${relationship}`,
      label: `${relationship[0].toLocaleUpperCase()}${relationship.slice(1)} relationship`,
      keywords: ["semantic", "connection"],
      isAvailable: hasSingleFlow,
      execute: (context) =>
        mutation(
          updateSelectedFlow(context, (flow) =>
            flow.relationship === relationship ? flow : { ...flow, relationship },
          ),
          `${relationship} relationship applied.`,
        ),
    });
  }

  for (const treatment of ["plain", "plate", "filled"] as LabelTreatment[]) {
    registry.register({
      id: `flow.label-treatment.${treatment}`,
      label: `${treatment[0].toLocaleUpperCase()}${treatment.slice(1)} label`,
      keywords: ["relationship", "label", "appearance"],
      isAvailable: hasSingleFlow,
      execute: (context) =>
        mutation(
          updateSelectedFlow(context, (flow) =>
            flow.labelTreatment === treatment ? flow : { ...flow, labelTreatment: treatment },
          ),
          `${treatment} label applied.`,
        ),
    });
  }

  const cadences: Array<{ kind: CadenceKind; label: string }> = [
    { kind: "monthly", label: "Monthly" },
    { kind: "annual", label: "Annual" },
    { kind: "one-time", label: "One-time" },
    { kind: "as-needed", label: "As needed" },
    { kind: "custom", label: "Custom" },
  ];
  for (const cadence of cadences) {
    registry.register({
      id: `flow.cadence.${cadence.kind}`,
      label: `${cadence.label} cadence`,
      keywords: ["relationship", "timing", "frequency"],
      isAvailable: hasSingleFlow,
      execute: (context) =>
        mutation(
          updateSelectedFlow(context, (flow) =>
            flow.cadence.kind === cadence.kind
              ? flow
              : {
                  ...flow,
                  cadence: {
                    kind: cadence.kind,
                    label: cadence.kind === "custom" ? flow.cadence.label : cadence.label,
                  },
                },
          ),
          `${cadence.label} cadence applied.`,
        ),
    });
  }

  registry.register({
    id: "flow.label-position.reset",
    label: "Reset label position",
    keywords: ["relationship", "route", "waypoint"],
    isAvailable: hasSingleFlow,
    execute: (context) => {
      const flow = selectedFlows(context)[0];
      return mutation(
        flow ? resetFlowLabel(context.document, flow.id) : context.document,
        "Label position reset.",
      );
    },
  });
  return registry;
}
