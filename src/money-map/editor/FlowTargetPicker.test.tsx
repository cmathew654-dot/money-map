import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { createTestDocument } from "../model/test-fixtures";
import { FlowTargetPicker } from "./FlowTargetPicker";

describe("FlowTargetPicker", () => {
  it("groups destinations by their actual financial kind, not by shape primitive", () => {
    const document = createTestDocument();
    // Fixture proof: "Investment account" is kind "account" drawn as a "ledger"
    // primitive, and "Illustrative annuity" is kind "income" drawn as a "band"
    // primitive — the old shape-keyed grouping would have filed both under the
    // wrong financial-role heading.
    render(
      <FlowTargetPicker
        document={document}
        sourceId="monthly-need"
        onChoose={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const incomeGroup = screen.getByText("Income").closest(".flow-target-picker__group");
    const accountsGroup = screen.getByText("Accounts").closest(".flow-target-picker__group");

    expect(incomeGroup?.textContent).toContain("Illustrative annuity");
    expect(accountsGroup?.textContent).toContain("Investment account");
    expect(screen.queryByText("Commitments & contracts")).toBeNull();
    expect(screen.queryByText("Goals & needs")).toBeNull();
  });
});
