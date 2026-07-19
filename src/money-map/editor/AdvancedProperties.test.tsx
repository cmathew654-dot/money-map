import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { updateModule } from "../model/document";
import { createTestDocument } from "../model/test-fixtures";
import { createWorkspaceCommands, type WorkspaceCommandContext } from "./commands";
import { AdvancedProperties } from "./AdvancedProperties";

const baseDocument = createTestDocument();
const context: WorkspaceCommandContext = {
  document: baseDocument,
  selection: { moduleIds: ["annuity-policy"], flowIds: [] },
  canUndo: false,
  canRedo: false,
};

function appearanceCommands() {
  return createWorkspaceCommands(() => "copy")
    .available(context)
    .filter(({ id }) => id.startsWith("module.primitive.") || id.startsWith("module.width."));
}

describe("AdvancedProperties", () => {
  it("closes on Escape from non-text controls but restores an input draft without closing", () => {
    const onClose = vi.fn();
    render(
      <AdvancedProperties
        commands={appearanceCommands()}
        document={baseDocument}
        moduleId="annuity-policy"
        initialTab="content"
        onClose={onClose}
        onCommitField={vi.fn()}
        onExecute={vi.fn()}
      />,
    );

    const title = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "Uncommitted title" } });
    fireEvent.keyDown(title, { key: "Escape" });
    expect((title as HTMLInputElement).value).toBe("Illustrative annuity");
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole("tab", { name: "Content" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("offers keyboard-reachable tabs and starts Content concise with details collapsed", () => {
    render(
      <AdvancedProperties
        commands={appearanceCommands()}
        document={baseDocument}
        moduleId="annuity-policy"
        initialTab="content"
        onClose={vi.fn()}
        onCommitField={vi.fn()}
        onExecute={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab", { name: "Content" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Supporting fields and narrative").closest("details")?.open).toBe(
      false,
    );
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Content" }));
    fireEvent.keyDown(screen.getByRole("tab", { name: "Content" }), { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Appearance" }));
  });

  it("reports controlled tab changes from clicks and arrow keys", () => {
    const onTabChange = vi.fn();
    render(
      <AdvancedProperties
        commands={appearanceCommands()}
        document={baseDocument}
        moduleId="annuity-policy"
        initialTab="content"
        onClose={vi.fn()}
        onCommitField={vi.fn()}
        onExecute={vi.fn()}
        onTabChange={onTabChange}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Connections" }));
    expect(onTabChange).toHaveBeenCalledWith("connections");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Content" }), { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenLastCalledWith("appearance");
  });

  it("commits exact fields and creates a keyboard-selected relationship target", () => {
    const commit = vi.fn();
    const execute = vi.fn();
    const createConnection = vi.fn();
    render(
      <AdvancedProperties
        commands={appearanceCommands()}
        document={baseDocument}
        moduleId="annuity-policy"
        initialTab="content"
        onClose={vi.fn()}
        onCommitField={commit}
        onExecute={execute}
        onCreateConnection={createConnection}
      />,
    );
    const title = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "$20,000\u2013?" } });
    fireEvent.blur(title);
    expect(commit).toHaveBeenCalledWith("annuity-policy", { field: "title" }, "$20,000\u2013?");

    fireEvent.click(screen.getByRole("tab", { name: "Connections" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Connection target" }), {
      target: { value: "monthly-need" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add connection" }));
    expect(createConnection).toHaveBeenCalledWith("annuity-policy", "monthly-need");
  });

  it("refreshes drafts for document history and never carries stale text to a new module", () => {
    const commit = vi.fn();
    const { rerender } = render(
      <AdvancedProperties
        commands={appearanceCommands()}
        document={baseDocument}
        moduleId="annuity-policy"
        initialTab="content"
        onClose={vi.fn()}
        onCommitField={commit}
        onExecute={vi.fn()}
      />,
    );
    const title = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "stale annuity draft" } });

    const undone = updateModule(baseDocument, "annuity-policy", (module) => ({
      ...module,
      title: "History-restored annuity",
    }));
    rerender(
      <AdvancedProperties
        commands={appearanceCommands()}
        document={undone}
        moduleId="annuity-policy"
        initialTab="content"
        onClose={vi.fn()}
        onCommitField={commit}
        onExecute={vi.fn()}
      />,
    );
    expect((screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value).toBe(
      "History-restored annuity",
    );

    rerender(
      <AdvancedProperties
        commands={appearanceCommands()}
        document={baseDocument}
        moduleId="source-account"
        initialTab="content"
        onClose={vi.fn()}
        onCommitField={commit}
        onExecute={vi.fn()}
      />,
    );
    const sourceTitle = screen.getByRole("textbox", { name: "Title" });
    expect((sourceTitle as HTMLInputElement).value).toBe("Investment account");
    fireEvent.blur(sourceTitle);
    expect(commit).toHaveBeenLastCalledWith(
      "source-account",
      { field: "title" },
      "Investment account",
    );
  });

  it("follows an updated initial tab and renders appearance labels from command definitions", () => {
    const execute = vi.fn();
    const commands = appearanceCommands();
    const ledger = commands.find(({ id }) => id === "module.primitive.ledger");
    if (!ledger) throw new Error("Expected ledger command");
    ledger.label = "Book-style module";
    const filtered = commands.filter(({ id }) => id !== "module.width.wide");
    const { rerender } = render(
      <AdvancedProperties
        commands={filtered}
        document={baseDocument}
        moduleId="annuity-policy"
        initialTab="content"
        onClose={vi.fn()}
        onCommitField={vi.fn()}
        onExecute={execute}
      />,
    );
    rerender(
      <AdvancedProperties
        commands={filtered}
        document={baseDocument}
        moduleId="annuity-policy"
        initialTab="appearance"
        onClose={vi.fn()}
        onCommitField={vi.fn()}
        onExecute={execute}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Book-style module" }));
    expect(execute).toHaveBeenCalledWith("module.primitive.ledger");
    expect(screen.queryByRole("button", { name: /wide width/i })).toBeNull();
    expect(screen.getByRole("tab", { name: "Appearance" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });
});
