import type { CommandDefinition } from "../commands/types";
import { matchCommandShortcut } from "./commandShortcuts";

type Context = Record<string, never>;
type Result = Record<string, never>;

function command(
  id: string,
  shortcut?: string,
  shortcutAliases?: string[],
): CommandDefinition<Context, Result> {
  return {
    id,
    label: id,
    keywords: [],
    shortcut,
    shortcutAliases,
    isAvailable: () => true,
    execute: () => ({}),
  };
}

describe("matchCommandShortcut", () => {
  it("matches command metadata without command-ID knowledge", () => {
    const definitions = [
      command("renamed.duplicate", "Ctrl/Cmd+D"),
      command("renamed.redo", "Ctrl/Cmd+Shift+Z"),
      command("renamed.remove", "Delete", ["Backspace"]),
    ];

    expect(
      matchCommandShortcut(
        { key: "d", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false },
        definitions,
      )?.id,
    ).toBe("renamed.duplicate");
    expect(
      matchCommandShortcut(
        { key: "Z", ctrlKey: false, metaKey: true, shiftKey: true, altKey: false },
        definitions,
      )?.id,
    ).toBe("renamed.redo");
    expect(
      matchCommandShortcut(
        { key: "Delete", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
        definitions,
      )?.id,
    ).toBe("renamed.remove");
    expect(
      matchCommandShortcut(
        { key: "Backspace", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
        definitions,
      )?.id,
    ).toBe("renamed.remove");
  });

  it("does not match unavailable definitions that were not supplied", () => {
    expect(
      matchCommandShortcut(
        { key: "d", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false },
        [command("other", "Ctrl/Cmd+K")],
      ),
    ).toBeUndefined();
  });
});
