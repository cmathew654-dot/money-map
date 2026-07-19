import { createTestDocument } from "../model/test-fixtures";
import type { CommandContext } from "./types";
import { CommandRegistry, createDocumentCommands } from "./registry";

const emptyContext: CommandContext = {
  document: createTestDocument(),
  selection: { moduleIds: [], flowIds: [] },
};

describe("command registry", () => {
  it("rejects duplicate command IDs", () => {
    const registry = new CommandRegistry();
    const command = {
      id: "example.command",
      label: "Example",
      keywords: ["sample"],
      isAvailable: () => true,
      execute: (context: CommandContext) => ({
        document: context.document,
        announcement: "Example complete",
      }),
    };
    registry.register(command);

    expect(() => registry.register(command)).toThrow(/duplicate/i);
  });

  it("filters unavailable commands and searches labels and keywords case-insensitively", () => {
    const registry = new CommandRegistry();
    registry.register({
      id: "always",
      label: "Open properties",
      keywords: ["Inspector", "details"],
      isAvailable: () => true,
      execute: (context) => ({ document: context.document, announcement: "Opened" }),
    });
    registry.register({
      id: "never",
      label: "Hidden command",
      keywords: ["properties"],
      isAvailable: () => false,
      execute: (context) => ({ document: context.document, announcement: "Hidden" }),
    });

    expect(registry.available(emptyContext).map(({ id }) => id)).toEqual(["always"]);
    expect(registry.search("PROPERTIES", emptyContext).map(({ id }) => id)).toEqual(["always"]);
    expect(registry.search("inspector", emptyContext).map(({ id }) => id)).toEqual(["always"]);
    expect(registry.search("", emptyContext).map(({ id }) => id)).toEqual(["always"]);
    expect(registry.get("always")?.label).toBe("Open properties");
    expect(registry.get("missing")).toBeUndefined();
  });

  it("registers unavailable-on-empty duplicate and remove document commands", () => {
    const ids = ["module-copy"];
    const registry = createDocumentCommands(() => ids.shift() ?? "unexpected");

    expect(registry.get("selection.duplicate")).toBeDefined();
    expect(registry.get("selection.remove")).toBeDefined();
    expect(registry.available(emptyContext)).toEqual([]);
  });

  it("executes duplication through the shared document operation", () => {
    const registry = createDocumentCommands(() => "module-copy");
    const command = registry.get("selection.duplicate");
    if (!command) throw new Error("Duplicate command missing");

    const mutation = command.execute({
      document: createTestDocument(),
      selection: { moduleIds: ["monthly-need"], flowIds: [] },
    });

    expect(mutation.document.modules.at(-1)).toMatchObject({
      id: "module-copy",
      position: { x: 852, y: 176 },
    });
    expect(mutation.announcement).toMatch(/duplicated/i);
  });

  it("executes compound removal through the shared document operation", () => {
    const registry = createDocumentCommands(() => "unused");
    const command = registry.get("selection.remove");
    if (!command) throw new Error("Remove command missing");

    const mutation = command.execute({
      document: createTestDocument(),
      selection: { moduleIds: ["annuity-policy"], flowIds: [] },
    });

    expect(mutation.document.modules.map(({ id }) => id)).not.toContain("annuity-policy");
    expect(mutation.document.flows).toEqual([]);
    expect(mutation.announcement).toMatch(/removed/i);
  });
});
