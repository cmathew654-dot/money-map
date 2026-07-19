import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { createTestDocument } from "../model/test-fixtures";
import { AdvancedProperties } from "./AdvancedProperties";

describe("AdvancedProperties", () => {
  it("offers keyboard-reachable tabs and starts Content concise with details collapsed", () => {
    render(
      <AdvancedProperties
        document={createTestDocument()}
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
    fireEvent.keyDown(screen.getByRole("tab", { name: "Content" }), { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Appearance" }));
  });

  it("commits exact field changes and Connections never creates a relationship", () => {
    const commit = vi.fn();
    const execute = vi.fn();
    render(
      <AdvancedProperties
        document={createTestDocument()}
        moduleId="annuity-policy"
        initialTab="content"
        onClose={vi.fn()}
        onCommitField={commit}
        onExecute={execute}
      />,
    );
    const title = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "$20,000\u2013?" } });
    fireEvent.blur(title);
    expect(commit).toHaveBeenCalledWith({ field: "title" }, "$20,000\u2013?");

    fireEvent.click(screen.getByRole("tab", { name: "Connections" }));
    fireEvent.click(screen.getByRole("button", { name: "Add connection" }));
    expect(screen.getByText(/connection editing arrives in the next step/i)).toBeTruthy();
    expect(execute).not.toHaveBeenCalledWith(expect.stringMatching(/create/));
  });
});
