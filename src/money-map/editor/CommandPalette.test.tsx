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
    expect(search.getAttribute("aria-expanded")).toBe("true");
    expect(search.getAttribute("aria-autocomplete")).toBe("list");
    fireEvent.change(search, { target: { value: "width" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options.every((option) => option.tabIndex === -1)).toBe(true);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(execute).toHaveBeenCalledWith("module.width.standard");
    fireEvent.keyDown(search, { key: "Escape" });
    expect(close).toHaveBeenCalled();
    expect(document.activeElement).toBe(invoker);
    invoker.remove();
  });

  it("captures Escape from an option and restores the exact invoker", () => {
    const close = vi.fn();
    const invoker = document.createElement("button");
    document.body.append(invoker);
    render(
      <CommandPalette
        context={context}
        invoker={invoker}
        onClose={close}
        onExecute={vi.fn()}
        registry={createWorkspaceCommands(() => "copy")}
      />,
    );

    const option = screen.getAllByRole("option")[0];
    option.focus();
    fireEvent.keyDown(option, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(invoker);
    invoker.remove();
  });

  it("contains forward and reverse Tab navigation", () => {
    const invoker = document.createElement("button");
    document.body.append(invoker);
    render(
      <CommandPalette
        context={context}
        invoker={invoker}
        onClose={vi.fn()}
        onExecute={vi.fn()}
        registry={createWorkspaceCommands(() => "copy")}
      />,
    );

    const closeButton = screen.getByRole("button", { name: "Close actions" });
    const search = screen.getByRole("combobox", { name: "Search actions" });
    search.focus();
    fireEvent.keyDown(search, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(search);
    invoker.remove();
  });

  it("closes and restores focus after executing an option", () => {
    const execute = vi.fn();
    const close = vi.fn();
    const invoker = document.createElement("button");
    document.body.append(invoker);
    render(
      <CommandPalette
        context={context}
        invoker={invoker}
        onClose={close}
        onExecute={execute}
        registry={createWorkspaceCommands(() => "copy")}
      />,
    );
    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(invoker);
    invoker.remove();
  });
});
