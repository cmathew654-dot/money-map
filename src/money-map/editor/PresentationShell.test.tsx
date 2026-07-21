import { act, fireEvent, render, screen } from "@testing-library/react";
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
  it.each(STARTER_IDS)(
    "retains exact metadata and prints all six step names in the rail for %s",
    (starterId) => {
      const document = createStarterDocument(starterId);
      const { container } = render(<PresentationShell document={document} onExit={vi.fn()} />);

      expect(screen.getByRole("heading", { name: document.title })).toBeTruthy();
      expect(screen.getByText(document.asOf)).toBeTruthy();
      expect(screen.getByText("Synthetic demo \u00b7 advisor-entered values")).toBeTruthy();

      const railSteps = [...container.querySelectorAll(".presentation-rail__step")];
      expect(railSteps).toHaveLength(6);
      expect(railSteps.map((step) => step.textContent)).toEqual(
        document.presentation.map((step) => step.title),
      );
      expect(screen.getByRole("button", { name: "Overview" }).getAttribute("aria-current")).toBe(
        "step",
      );
      expect(canvasMock.props.presentationStep).toEqual({
        ...document.presentation[0],
        moduleIds: [],
        flowIds: [],
      });
    },
  );

  it("shows camera recovery controls in the chrome bar, never over the stage", () => {
    const document = createStarterDocument("annuity");
    render(<PresentationShell document={document} onExit={vi.fn()} />);
    expect(screen.queryByRole("toolbar", { name: "Canvas camera" })).toBeNull();

    const controller = {
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetZoom: vi.fn(),
      fitMap: vi.fn(),
      fitSelection: vi.fn(),
      fitStep: vi.fn(),
    };
    act(() => {
      (canvasMock.props.onControllerChange as (value: unknown) => void)(controller);
      (canvasMock.props.onZoomChange as (value: number) => void)(80);
    });

    const toolbar = screen.getByRole("toolbar", { name: "Canvas camera" });
    expect(toolbar.closest(".presentation-nav")).toBeTruthy();
    expect(toolbar.closest(".presentation-stage")).toBeNull();
    expect(screen.getByRole("button", { name: "Reset zoom to 100%" }).textContent).toBe("80%");
    expect(screen.queryByRole("button", { name: "Fit selection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Fit step" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Fit story" }));
    expect(controller.fitMap).toHaveBeenCalledTimes(1);

    const shell = screen.getByLabelText(`${document.title} presentation`);
    fireEvent.keyDown(shell, { key: "=", ctrlKey: true });
    expect(controller.zoomIn).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(shell, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Fit step" })).toBeTruthy();
  });

  it("clamps arrow and Space navigation and announces each named state", () => {
    const document = createStarterDocument("retirement");
    render(<PresentationShell document={document} onExit={vi.fn()} />);
    const shell = screen.getByLabelText(`${document.title} presentation`);

    fireEvent.keyDown(shell, { key: "ArrowLeft" });
    expect(screen.getByRole("button", { name: "Overview" }).getAttribute("aria-current")).toBe(
      "step",
    );

    fireEvent.keyDown(shell, { key: " " });
    expect(
      screen
        .getByRole("button", { name: document.presentation[1].title })
        .getAttribute("aria-current"),
    ).toBe("step");
    expect(screen.getByRole("status").textContent).toContain(
      `${document.presentation[1].title}, step 1 of 5.`,
    );

    for (let index = 0; index < 8; index += 1) fireEvent.keyDown(shell, { key: "ArrowRight" });
    expect(
      screen
        .getByRole("button", { name: document.presentation[5].title })
        .getAttribute("aria-current"),
    ).toBe("step");
    expect(screen.getByRole("status").textContent).toContain(
      `${document.presentation[5].title}, step 5 of 5.`,
    );

    fireEvent.keyDown(shell, { key: "ArrowRight" });
    expect(
      screen
        .getByRole("button", { name: document.presentation[5].title })
        .getAttribute("aria-current"),
    ).toBe("step");
  });

  it("supports direct Overview and named-step selection with aria-current", () => {
    const document = createStarterDocument("rmd");
    render(<PresentationShell document={document} onExit={vi.fn()} />);

    const directStep = screen.getByRole("button", { name: document.presentation[3].title });
    fireEvent.click(directStep);
    expect(directStep.getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("status").textContent).toContain(
      `${document.presentation[3].title}, step 3 of 5.`,
    );
    expect(canvasMock.props.presentationStep).toEqual(document.presentation[3]);

    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByRole("button", { name: "Overview" }).getAttribute("aria-current")).toBe(
      "step",
    );
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
    const directStep = screen.getByRole("button", { name: document.presentation[2].title });
    fireEvent.click(directStep);
    fireEvent.keyDown(directStep, { key: " ", code: "Space" });

    expect(directStep.getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("status").textContent).toContain(
      `${document.presentation[2].title}, step 2 of 5.`,
    );
  });
});
