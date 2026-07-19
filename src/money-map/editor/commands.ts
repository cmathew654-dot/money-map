import { CommandRegistry } from "../commands/registry";
import type { CommandDefinition, EditorMutation } from "../commands/types";
import { duplicateSelection, removeSelection, updateFlow, updateModule } from "../model/document";
import { resetFlowWaypoint } from "./mutations";
import type {
  CadenceKind,
  LabelTreatment,
  MoneyMapDocument,
  PrimitiveStyle,
  RelationshipKind,
  RouteKind,
  Selection,
} from "../model/types";

export interface WorkspaceCommandContext {
  document: MoneyMapDocument;
  selection: Selection;
  canUndo: boolean;
  canRedo: boolean;
}

export type WorkspaceSurface =
  "inline" | "style" | "properties" | "connections" | "flow-inline" | "flow-properties";

export type WorkspaceCommandResult =
  | { kind: "mutation"; mutation: EditorMutation; nextSelection?: Selection }
  | { kind: "surface"; surface: WorkspaceSurface }
  | { kind: "history"; action: "undo" | "redo" }
  | { kind: "reset" };

export type WorkspaceCommandDefinition = CommandDefinition<
  WorkspaceCommandContext,
  WorkspaceCommandResult
>;

const primitives: PrimitiveStyle[] = ["ledger", "plate", "tray", "band", "roundel", "frame"];
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

export function createWorkspaceCommands(
  createId: (kind: string) => string,
): CommandRegistry<WorkspaceCommandContext, WorkspaceCommandResult> {
  const registry = new CommandRegistry<WorkspaceCommandContext, WorkspaceCommandResult>();

  for (const [id, label, surface] of [
    ["module.edit", "Edit module", "inline"],
    ["module.style", "Style module", "style"],
    ["module.connect", "Connect module", "connections"],
    ["module.properties", "More properties", "properties"],
  ] as const) {
    registry.register({
      id,
      label,
      keywords: surface === "properties" ? ["details", "advanced"] : [surface],
      shortcut: surface === "inline" ? "Enter" : undefined,
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
            module.width === preset.width ? module : { ...module, width: preset.width },
          ),
          `${preset.label} width applied.`,
        ),
    });
  }

  for (const primitive of primitives) {
    registry.register({
      id: `module.primitive.${primitive}`,
      label: `${primitive[0].toLocaleUpperCase()}${primitive.slice(1)} style`,
      keywords: ["primitive", "appearance", "style"],
      isAvailable: hasSingleModule,
      execute: (context) =>
        mutation(
          updateSelectedModules(context, (module) =>
            module.primitive === primitive ? module : { ...module, primitive },
          ),
          `${primitive} style applied.`,
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

  for (const relationship of ["flow", "association", "planned"] as RelationshipKind[]) {
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
    id: "flow.waypoint.reset",
    label: "Reset label position",
    keywords: ["relationship", "route", "waypoint"],
    isAvailable: hasSingleFlow,
    execute: (context) => {
      const flow = selectedFlows(context)[0];
      return mutation(
        flow ? resetFlowWaypoint(context.document, flow.id) : context.document,
        "Label position reset.",
      );
    },
  });
  return registry;
}
