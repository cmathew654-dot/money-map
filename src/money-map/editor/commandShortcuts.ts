import type { CommandDefinition } from "../commands/types";

export interface CommandShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

function matchesShortcut(event: CommandShortcutEvent, shortcut: string): boolean {
  const parts = shortcut.toLocaleLowerCase().split("+");
  const key = parts.at(-1);
  const commandModifier = parts.includes("ctrl/cmd");
  const requiresShift = parts.includes("shift");
  const requiresAlt = parts.includes("alt");

  return (
    event.key.toLocaleLowerCase() === key &&
    (event.ctrlKey || event.metaKey) === commandModifier &&
    event.shiftKey === requiresShift &&
    event.altKey === requiresAlt
  );
}

export function matchCommandShortcut<Context, Result>(
  event: CommandShortcutEvent,
  availableCommands: CommandDefinition<Context, Result>[],
): CommandDefinition<Context, Result> | undefined {
  return availableCommands.find(
    (command) => command.shortcut && matchesShortcut(event, command.shortcut),
  );
}
