import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { createWorkspaceCommands } from "./commands";
import { createTestDocument } from "../model/test-fixtures";
import { RelationshipProperties } from "./RelationshipProperties";

function renderProperties() {
  const document = createTestDocument();
  const context = {
    document,
    selection: { moduleIds: [], flowIds: ["funding-flow"] },
    canUndo: true,
    canRedo: false,
  };
  const commands = createWorkspaceCommands(() => "unused").available(context);
  const props = {
    document,
    flowId: "funding-flow",
    commands,
    onClose: vi.fn(),
    onCommitField: vi.fn(),
    onExecute: vi.fn(),
    onReconnect: vi.fn(),
  };
  render(<RelationshipProperties {...props} />);
  return props;
}

describe("RelationshipProperties", () => {
  it("closes on Escape from non-text controls but restores an input draft without closing", () => {
    const props = renderProperties();
    const primary = screen.getByRole("textbox", { name: "Primary label" });
    fireEvent.change(primary, { target: { value: "Uncommitted relationship" } });
    fireEvent.keyDown(primary, { key: "Escape" });
    expect((primary as HTMLInputElement).value).toBe("$300,000 premium");
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
  it("uses canonical commands for route, semantics, treatment, cadence, and reset", () => {
    const props = renderProperties();
    fireEvent.click(screen.getByRole("button", { name: "Curved route" }));
    fireEvent.click(screen.getByRole("button", { name: "Replenishment relationship" }));
    fireEvent.click(screen.getByRole("button", { name: "Filled label" }));
    fireEvent.click(screen.getByRole("button", { name: "Monthly cadence" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset label position" }));
    expect(props.onExecute.mock.calls.map(([id]) => id)).toEqual([
      "flow.route.curved",
      "flow.relationship.replenishment",
      "flow.label-treatment.filled",
      "flow.cadence.monthly",
      "flow.label-position.reset",
    ]);
  });

  it("keeps current endpoints valid while excluding the opposing endpoint from each selector", () => {
    renderProperties();
    const source = screen.getByRole("combobox", { name: "Source module" });
    const target = screen.getByRole("combobox", { name: "Target module" });
    expect(source.querySelector('option[value="source-account"]')).toBeTruthy();
    expect(source.querySelector('option[value="annuity-policy"]')).toBeNull();
    expect(target.querySelector('option[value="annuity-policy"]')).toBeTruthy();
    expect(target.querySelector('option[value="source-account"]')).toBeNull();
  });

  it("commits exact secondary/cadence literals and keyboard endpoint alternatives", () => {
    const props = renderProperties();
    const secondary = screen.getByRole("textbox", { name: "Secondary label" });
    fireEvent.change(secondary, { target: { value: "$20,000–? — exact" } });
    fireEvent.blur(secondary);
    expect(props.onCommitField).toHaveBeenCalledWith(
      { field: "secondaryLabel" },
      "$20,000–? — exact",
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Target module" }), {
      target: { value: "monthly-need" },
    });
    expect(props.onReconnect).toHaveBeenCalledWith({
      source: "source-account",
      target: "monthly-need",
    });
  });
});
