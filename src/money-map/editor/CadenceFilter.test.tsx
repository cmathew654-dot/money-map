import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { CadenceFilter } from "./CadenceFilter";

describe("CadenceFilter", () => {
  it("exposes one transient pressed filter without mutating documents", () => {
    const onChange = vi.fn();
    render(<CadenceFilter value="monthly" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    expect(onChange).toHaveBeenCalledWith("other");
  });
  it("moves one roving tab stop across cadence choices", () => {
    render(<CadenceFilter value="all" onChange={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1, -1]);
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1].tabIndex).toBe(0);
  });
});
