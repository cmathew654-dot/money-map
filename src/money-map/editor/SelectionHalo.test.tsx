import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { SelectionHalo } from "./SelectionHalo";

describe("SelectionHalo", () => {
  it("uses canonical command IDs for a single module", () => {
    const execute = vi.fn();
    render(<SelectionHalo selectionCount={1} onExecute={execute} />);
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
    render(<SelectionHalo selectionCount={3} onExecute={execute} />);
    expect(screen.getByRole("toolbar", { name: "3 selected modules" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });
});
