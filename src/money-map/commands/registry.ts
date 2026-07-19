import { duplicateSelection, removeSelection } from "../model/document";
import type { CommandContext, EditorCommand } from "./types";

export class CommandRegistry {
  private readonly commands = new Map<string, EditorCommand>();

  register(command: EditorCommand): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Duplicate command ID: ${command.id}`);
    }
    this.commands.set(command.id, command);
  }

  get(id: string): EditorCommand | undefined {
    return this.commands.get(id);
  }

  available(context: CommandContext): EditorCommand[] {
    return [...this.commands.values()].filter((command) => command.isAvailable(context));
  }

  search(query: string, context: CommandContext): EditorCommand[] {
    const available = this.available(context);
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (normalizedQuery === "") return available;

    return available.filter((command) =>
      [command.label, ...command.keywords].some((term) =>
        term.toLocaleLowerCase().includes(normalizedQuery),
      ),
    );
  }
}

function hasSelectedModule({ document, selection }: CommandContext): boolean {
  const selectedIds = new Set(selection.moduleIds);
  return document.modules.some((module) => selectedIds.has(module.id));
}

function hasActionableSelection({ document, selection }: CommandContext): boolean {
  if (hasSelectedModule({ document, selection })) return true;
  const selectedIds = new Set(selection.flowIds);
  return document.flows.some((flow) => selectedIds.has(flow.id));
}

export function createDocumentCommands(createId: (kind: string) => string): CommandRegistry {
  const registry = new CommandRegistry();

  registry.register({
    id: "selection.duplicate",
    label: "Duplicate selection",
    keywords: ["copy", "clone"],
    shortcut: "Ctrl/Cmd+D",
    isAvailable: hasSelectedModule,
    execute: ({ document, selection }) => {
      const updated = duplicateSelection(document, selection, createId);
      return {
        document: updated,
        announcement: updated === document ? "Nothing to duplicate." : "Selection duplicated.",
      };
    },
  });

  registry.register({
    id: "selection.remove",
    label: "Remove selection",
    keywords: ["delete"],
    shortcut: "Delete",
    isAvailable: hasActionableSelection,
    execute: ({ document, selection }) => {
      const updated = removeSelection(document, selection);
      return {
        document: updated,
        announcement: updated === document ? "Nothing to remove." : "Selection removed.",
      };
    },
  });

  return registry;
}
