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

function hasSelection({ selection }: CommandContext): boolean {
  return selection.moduleIds.length > 0 || selection.flowIds.length > 0;
}

export function createDocumentCommands(createId: (kind: string) => string): CommandRegistry {
  const registry = new CommandRegistry();

  registry.register({
    id: "selection.duplicate",
    label: "Duplicate selection",
    keywords: ["copy", "clone"],
    shortcut: "Ctrl/Cmd+D",
    isAvailable: ({ selection }) => selection.moduleIds.length > 0,
    execute: ({ document, selection }) => ({
      document: duplicateSelection(document, selection, createId),
      announcement: "Selection duplicated.",
    }),
  });

  registry.register({
    id: "selection.remove",
    label: "Remove selection",
    keywords: ["delete"],
    shortcut: "Delete",
    isAvailable: hasSelection,
    execute: ({ document, selection }) => ({
      document: removeSelection(document, selection),
      announcement: "Selection removed.",
    }),
  });

  return registry;
}
