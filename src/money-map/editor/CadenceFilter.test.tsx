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
});
