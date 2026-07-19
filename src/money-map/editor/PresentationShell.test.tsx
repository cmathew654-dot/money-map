import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { createStarterDocument } from "../starters/registry";
import { STARTER_IDS } from "../starters/types";
import { PresentationShell } from "./PresentationShell";

const canvasMock = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock("../canvas/MoneyMapCanvas", () => ({
  MoneyMapCanvas: (props: Record<string, unknown>) => {
    canvasMock.props = props;
    return <div aria-label="Presentation map" />;
  },
}));

describe("PresentationShell", () => {
  it.each(STARTER_IDS)("retains exact metadata and six states for %s", (starterId) => {
    const document = createStarterDocument(starterId);
    render(<PresentationShell document={document} onExit={vi.fn()} />);

    expect(screen.getByRole("heading", { name: document.title })).toBeTruthy();
    expect(screen.getByText(document.asOf)).toBeTruthy();
    expect(screen.getByText("Synthetic demo \u00b7 advisor-entered values")).toBeTruthy();
    expect(screen.getByText("Overview", { selector: ".presentation-current-name" })).toBeTruthy();
    expect(screen.getByText("Overview", { selector: ".presentation-step-copy span" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Go to/ })).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Overview" }).getAttribute("aria-current")).toBe(
      "step",
    );
    expect(canvasMock.props.presentationStep).toEqual({
      ...document.presentation[0],
      moduleIds: [],
      flowIds: [],
    });
  });

  it("clamps arrow and Space navigation and announces each named state", () => {
    const document = createStarterDocument("retirement");
    render(<PresentationShell document={document} onExit={vi.fn()} />);
    const shell = screen.getByLabelText(`${document.title} presentation`);

    fireEvent.keyDown(shell, { key: "ArrowLeft" });
    expect(screen.getByText("Overview", { selector: ".presentation-step-copy span" })).toBeTruthy();

    fireEvent.keyDown(shell, { key: " " });
    expect(
      screen.getByText(document.presentation[1].title, {
        selector: ".presentation-current-name",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      `${document.presentation[1].title}, step 1 of 5.`,
    );

    for (let index = 0; index < 8; index += 1) fireEvent.keyDown(shell, { key: "ArrowRight" });
    expect(screen.getByText("Step 5 of 5")).toBeTruthy();
    expect(
      screen.getByText(document.presentation[5].title, {
        selector: ".presentation-current-name",
      }),
    ).toBeTruthy();

    fireEvent.keyDown(shell, { key: "ArrowRight" });
    expect(screen.getByText("Step 5 of 5")).toBeTruthy();
  });

  it("supports direct Overview and named-step selection with aria-current", () => {
    const document = createStarterDocument("rmd");
    render(<PresentationShell document={document} onExit={vi.fn()} />);

    const directStep = screen.getByRole("button", {
      name: `Go to ${document.presentation[3].title}`,
    });
    fireEvent.click(directStep);
    expect(directStep.getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("Step 3 of 5")).toBeTruthy();
    expect(canvasMock.props.presentationStep).toEqual(document.presentation[3]);

    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByRole("button", { name: "Overview" }).getAttribute("aria-current")).toBe(
      "step",
    );
    expect(screen.getByText("Overview", { selector: ".presentation-step-copy span" })).toBeTruthy();
  });

  it("exits with Escape and exposes only presentation navigation plus Exit controls", () => {
    const document = createStarterDocument("annuity");
    const onExit = vi.fn();
    const { container } = render(<PresentationShell document={document} onExit={onExit} />);

    expect(screen.getByLabelText(`${document.title} presentation`)).toBe(
      globalThis.document.activeElement,
    );

    fireEvent.keyDown(screen.getByLabelText(`${document.title} presentation`), { key: "Escape" });
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(
      [...container.querySelectorAll<HTMLElement>("a, button, input, select, textarea, [tabindex]")]
        .filter((element) => element.tabIndex >= 0)
        .every((element) => Boolean(element.closest(".presentation-chrome"))),
    ).toBe(true);
  });

  it("leaves Space to a focused presentation button instead of advancing", () => {
    const document = createStarterDocument("roth");
    render(<PresentationShell document={document} onExit={vi.fn()} />);
    const directStep = screen.getByRole("button", {
      name: `Go to ${document.presentation[2].title}`,
    });
    fireEvent.click(directStep);
    fireEvent.keyDown(directStep, { key: " ", code: "Space" });

    expect(screen.getByText("Step 2 of 5")).toBeTruthy();
  });
});
