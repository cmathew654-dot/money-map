import { CommandRegistry } from "../commands/registry";
import type { EditorMutation } from "../commands/types";
import { duplicateSelection, removeSelection, updateModule } from "../model/document";
import type { MoneyMapDocument, PrimitiveStyle, Selection } from "../model/types";

export interface WorkspaceCommandContext {
  document: MoneyMapDocument;
  selection: Selection;
  canUndo: boolean;
  canRedo: boolean;
}

export type WorkspaceSurface = "inline" | "style" | "properties" | "connections";

export type WorkspaceCommandResult =
  | { kind: "mutation"; mutation: EditorMutation; nextSelection?: Selection }
  | { kind: "surface"; surface: WorkspaceSurface }
  | { kind: "history"; action: "undo" | "redo" }
  | { kind: "reset" };

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

  return registry;
}
