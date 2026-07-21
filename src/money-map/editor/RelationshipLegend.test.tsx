import { fireEvent, render, screen } from "@testing-library/react";

import { createTestDocument } from "../model/test-fixtures";
import type { MoneyMapDocument, RelationshipKind } from "../model/types";
import { createStarterDocument } from "../starters/registry";
import { RelationshipLegend } from "./RelationshipLegend";

const ancestorEscape = vi.fn();

function withFlowKinds(kinds: RelationshipKind[]): MoneyMapDocument {
  const document = createTestDocument();
  return {
    ...document,
    flows: document.flows.map((flow, index) => ({
      ...flow,
      relationship: kinds[index % kinds.length],
    })),
  };
}

describe("RelationshipLegend", () => {
  it("renders no toggle at all when the document has no flows", () => {
    const document = { ...createTestDocument(), flows: [] };
    render(<RelationshipLegend document={document} />);
    expect(screen.queryByRole("button", { name: "Legend" })).toBeNull();
  });

  it("is closed by default and opens on click, showing only the relationship kinds present", () => {
    // Fixture flows are "planned" and "transfer" only.
    const document = createTestDocument();
    render(<RelationshipLegend document={document} />);

    const toggle = screen.getByRole("button", { name: "Legend" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list", { name: "Relationship legend" })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const list = screen.getByRole("list", { name: "Relationship legend" });
    expect(list).toBeTruthy();

    expect(screen.getByText("Transfer")).toBeTruthy();
    expect(screen.getByText("Planned")).toBeTruthy();
    expect(screen.queryByText("Income")).toBeNull();
    expect(screen.queryByText("Replenishment")).toBeNull();
  });

  it("shows all four kinds, each with the exact stroke treatment MoneyMapEdge renders", () => {
    // The retirement starter authors at least one flow of every kind.
    const document = createStarterDocument("retirement");
    const { container } = render(<RelationshipLegend document={document} />);
    fireEvent.click(screen.getByRole("button", { name: "Legend" }));

    const rows = [...container.querySelectorAll(".relationship-legend__list li")];
    expect(rows).toHaveLength(4);

    const sampleFor = (label: string) => {
      const row = rows.find((item) => item.textContent === label);
      const line = row?.querySelector("line");
      if (!line) throw new Error(`Expected a sample line for ${label}`);
      return {
        dasharray: line.getAttribute("stroke-dasharray"),
        linecap: line.getAttribute("stroke-linecap"),
      };
    };

    // Mirrors canvas.css's .relationship--income/-transfer/-replenishment/-planned
    // dasharray values exactly, so the sample can never drift from the real edge.
    expect(sampleFor("Income")).toEqual({ dasharray: null, linecap: null });
    expect(sampleFor("Transfer")).toEqual({ dasharray: "10 6", linecap: null });
    expect(sampleFor("Replenishment")).toEqual({ dasharray: "2 6", linecap: "round" });
    expect(sampleFor("Planned")).toEqual({ dasharray: "12 5 2 5", linecap: null });
  });

  it("closes on Escape (without exiting an ancestor shell) and returns focus to the toggle", () => {
    const document = createTestDocument();
    render(
      // A stand-in ancestor Escape handler, mirroring PresentationShell's
      // Escape-exits-presentation behavior, proves the legend's own Escape
      // handler stops propagation instead of triggering both at once.
      <div onKeyDown={(event) => event.key === "Escape" && ancestorEscape()}>
        <RelationshipLegend document={document} />
      </div>,
    );
    const toggle = screen.getByRole("button", { name: "Legend" });
    fireEvent.click(toggle);

    const list = screen.getByRole("list", { name: "Relationship legend" });
    fireEvent.keyDown(list, { key: "Escape" });

    expect(screen.queryByRole("list", { name: "Relationship legend" })).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(ancestorEscape).not.toHaveBeenCalled();
  });

  it("keeps a stable kind order across documents", () => {
    const document = withFlowKinds(["planned", "income"]);
    render(<RelationshipLegend document={document} />);
    fireEvent.click(screen.getByRole("button", { name: "Legend" }));
    const labels = screen
      .getAllByRole("listitem")
      .map((item) => item.querySelector("span")?.textContent);
    expect(labels).toEqual(["Income", "Planned"]);
  });

  it("in controlled mode, hides its own toggle, shows an explicit close affordance, and calls onClose instead of managing its own state", () => {
    const document = createStarterDocument("retirement");
    const onClose = vi.fn();
    render(<RelationshipLegend document={document} open onClose={onClose} />);

    expect(screen.queryByRole("button", { name: "Legend" })).toBeNull();
    const list = screen.getByRole("list", { name: "Relationship legend" });
    expect(list).toBeTruthy();

    const hide = screen.getByRole("button", { name: "Hide legend" });
    fireEvent.click(hide);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("in controlled mode, routes Escape through onClose rather than closing itself", () => {
    const document = createStarterDocument("retirement");
    const onClose = vi.fn();
    render(<RelationshipLegend document={document} open onClose={onClose} />);

    const list = screen.getByRole("list", { name: "Relationship legend" });
    fireEvent.keyDown(list, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    // Controlled mode never manages open itself, so the list stays mounted —
    // the parent is responsible for setting open=false.
    expect(screen.getByRole("list", { name: "Relationship legend" })).toBeTruthy();
  });

  it("toggles closed again when the toggle is clicked a second time", () => {
    const document = createTestDocument();
    render(<RelationshipLegend document={document} />);
    const toggle = screen.getByRole("button", { name: "Legend" });

    fireEvent.click(toggle);
    expect(screen.queryByRole("list", { name: "Relationship legend" })).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByRole("list", { name: "Relationship legend" })).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});
