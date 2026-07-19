import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { CommandDefinition } from "../commands/types";
import type { WorkspaceCommandContext, WorkspaceCommandResult } from "./commands";
import { SelectionHalo } from "./SelectionHalo";

type Definition = CommandDefinition<WorkspaceCommandContext, WorkspaceCommandResult>;

function command(id: string, label: string): Definition {
  return {
    id,
    label,
    keywords: [],
    isAvailable: () => true,
    execute: () => ({ kind: "reset" }),
  };
}

describe("SelectionHalo", () => {
  it("uses canonical command IDs for a single module", () => {
    const execute = vi.fn();
    const commands = [
      command("module.edit", "Edit"),
      command("module.style", "Style"),
      command("module.connect", "Connect"),
      command("selection.duplicate", "Duplicate"),
      command("module.properties", "More"),
    ];
    render(<SelectionHalo commands={commands} selectionCount={1} onExecute={execute} />);
    for (const [label, id] of [
      ["Edit", "module.edit"],
      ["Style", "module.style"],
      ["Connect", "module.connect"],
      ["Duplicate", "selection.duplicate"],
      ["More", "module.properties"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(execute).toHaveBeenCalledWith(id);
    }
  });

  it("renders one shared multi-selection toolbar", () => {
    const execute = vi.fn();
    const commands = [
      command("selection.duplicate", "Duplicate"),
      command("selection.remove", "Remove"),
    ];
    render(<SelectionHalo commands={commands} selectionCount={3} onExecute={execute} />);
    expect(screen.getByRole("toolbar", { name: "3 selected items" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("renders the resolved definitions without relabeling or dead buttons", () => {
    const execute = vi.fn();
    render(
      <SelectionHalo
        commands={[command("selection.remove", "Archive these items")]}
        selectionCount={2}
        onExecute={execute}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Archive these items" }));
    expect(execute).toHaveBeenCalledWith("selection.remove");
    expect(screen.queryByRole("button", { name: /duplicate/i })).toBeNull();
  });

  it("projects the compact single-module order from runtime definitions", () => {
    render(
      <SelectionHalo
        commands={[
          command("module.properties", "More"),
          command("selection.duplicate", "Duplicate"),
          command("module.connect", "Connect"),
          command("module.edit", "Edit"),
          command("module.style", "Style"),
        ]}
        selectionCount={1}
        onExecute={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Edit",
      "Style",
      "Connect",
      "Duplicate",
      "More",
    ]);
  });
});
