import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { createTestDocument } from "../model/test-fixtures";
import { createWorkspaceCommands } from "./commands";
import { CommandPalette } from "./CommandPalette";

const context = {
  document: createTestDocument(),
  selection: { moduleIds: ["annuity-policy"], flowIds: [] },
  canUndo: false,
  canRedo: false,
};

describe("CommandPalette", () => {
  it("searches, navigates, executes Enter, escapes, and restores focus", () => {
    const execute = vi.fn();
    const close = vi.fn();
    const invoker = document.createElement("button");
    document.body.append(invoker);
    invoker.focus();
    render(
      <CommandPalette
        context={context}
        invoker={invoker}
        onClose={close}
        onExecute={execute}
        registry={createWorkspaceCommands(() => "copy")}
      />,
    );
    const search = screen.getByRole("combobox", { name: "Search actions" });
    fireEvent.change(search, { target: { value: "width" } });
    expect(screen.getAllByRole("option")).toHaveLength(3);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(execute).toHaveBeenCalledWith("module.width.standard");
    fireEvent.keyDown(search, { key: "Escape" });
    expect(close).toHaveBeenCalled();
    expect(document.activeElement).toBe(invoker);
    invoker.remove();
  });
});
