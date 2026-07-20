import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider, type EdgeProps } from "@xyflow/react";
import type * as ReactFlowExports from "@xyflow/react";
import { vi } from "vitest";
import type { ReactNode } from "react";

const useRefCalls = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  return {
    ...original,
    useRef: <T,>(initialValue: T) => {
      useRefCalls();
      return original.useRef(initialValue);
    },
  };
});

vi.mock("@xyflow/react", async (importOriginal) => {
  const original = await importOriginal<typeof ReactFlowExports>();
  return {
    ...original,
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

import { createTestDocument } from "../model/test-fixtures";
import { MoneyMapEdge } from "./MoneyMapEdge";
import type { MoneyMapCanvasEdge } from "./adapters";

function renderEdge(overrides: Partial<MoneyMapCanvasEdge["data"]> = {}) {
  const flow = createTestDocument().flows[0];
  const handlers = {
    beginEdit: vi.fn(),
    cancelEdit: vi.fn(),
    commitEdit: vi.fn(),
    moveLabelPosition: vi.fn(),
    nudgeLabelPosition: vi.fn(),
    select: vi.fn(),
  };
  const props = {
    id: flow.id,
    source: flow.source,
    target: flow.target,
    sourceX: 20,
    sourceY: 40,
    targetX: 420,
    targetY: 180,
    sourcePosition: "right",
    targetPosition: "left",
    data: { flow, handlers, editing: false, ...overrides },
    selected: false,
  } as unknown as EdgeProps<MoneyMapCanvasEdge>;
  const view = render(
    <ReactFlowProvider>
      <MoneyMapEdge {...props} />
    </ReactFlowProvider>,
  );
  const rerender = () =>
    view.rerender(
      <ReactFlowProvider>
        <MoneyMapEdge {...props} />
      </ReactFlowProvider>,
    );
  return { flow, handlers, rerender };
}

describe("MoneyMapEdge", () => {
  it("keeps hook ordering stable when edge data disappears and returns", () => {
    const flow = createTestDocument().flows[0];
    const props = {
      id: flow.id,
      source: flow.source,
      target: flow.target,
      sourceX: 20,
      sourceY: 40,
      targetX: 420,
      targetY: 180,
      sourcePosition: "right",
      targetPosition: "left",
      data: { flow },
      selected: false,
    } as unknown as EdgeProps<MoneyMapCanvasEdge>;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useRefCalls.mockClear();
    const view = render(
      <ReactFlowProvider>
        <MoneyMapEdge {...props} />
      </ReactFlowProvider>,
    );

    expect(useRefCalls).toHaveBeenCalledTimes(3);

    expect(() => {
      view.rerender(
        <ReactFlowProvider>
          <MoneyMapEdge {...props} data={undefined} />
        </ReactFlowProvider>,
      );
      expect(useRefCalls).toHaveBeenCalledTimes(6);
      view.rerender(
        <ReactFlowProvider>
          <MoneyMapEdge {...props} />
        </ReactFlowProvider>,
      );
      expect(useRefCalls).toHaveBeenCalledTimes(9);
    }).not.toThrow();
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/change in the order of Hooks/i);
    consoleError.mockRestore();
  });

  it("renders exact label, secondary label, cadence, semantics, and treatment", () => {
    const { flow } = renderEdge();
    const label = screen.getByRole("button", {
      name: `${flow.relationship} relationship from ${flow.source} to ${flow.target}: ${flow.label}; ${flow.cadence.label}`,
    });
    expect(label.textContent).toContain(flow.label);
    expect(label.textContent).toContain(flow.secondaryLabel ?? "");
    expect(label.textContent).toContain(flow.cadence.label);
    expect(label.closest("[data-treatment]")?.getAttribute("data-treatment")).toBe("plate");
    expect(document.querySelector("path")?.getAttribute("class")).toContain(
      "relationship--planned",
    );
  });

  it("clicks to edit but a drag beyond six pixels moves a waypoint without editing", () => {
    const { handlers } = renderEdge();
    const label = screen.getByRole("button");
    fireEvent.click(label);
    expect(handlers.select).toHaveBeenCalledTimes(1);
    expect(handlers.beginEdit).toHaveBeenCalledTimes(1);

    handlers.select.mockClear();
    handlers.beginEdit.mockClear();
    fireEvent.pointerDown(label, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(label, { clientX: 108, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(label, { clientX: 108, clientY: 100, pointerId: 1 });
    fireEvent.click(label);
    expect(handlers.moveLabelPosition).toHaveBeenCalledWith({ x: 108, y: 100 });
    expect(handlers.beginEdit).not.toHaveBeenCalled();
  });

  it("preserves drag click suppression across the selection rerender", () => {
    const { handlers, rerender } = renderEdge();
    const label = screen.getByRole("button");
    fireEvent.pointerDown(label, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(label, { clientX: 108, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(label, { clientX: 108, clientY: 100, pointerId: 1 });

    rerender();
    fireEvent.click(screen.getByRole("button"));

    expect(handlers.moveLabelPosition).toHaveBeenCalledWith({ x: 108, y: 100 });
    expect(handlers.beginEdit).not.toHaveBeenCalled();
  });

  it("keeps portal label events from reaching the canvas pane", () => {
    renderEdge();
    const canvasClick = vi.fn();
    document.addEventListener("click", canvasClick);

    fireEvent.click(screen.getByRole("button"));

    expect(canvasClick).not.toHaveBeenCalled();
    document.removeEventListener("click", canvasClick);
  });

  it("supports Enter and keyboard label-position movement", () => {
    const { handlers } = renderEdge();
    const label = screen.getByRole("button");
    fireEvent.keyDown(label, { key: "Enter" });
    expect(handlers.beginEdit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(label, { key: "ArrowRight", shiftKey: true });
    expect(handlers.nudgeLabelPosition).toHaveBeenCalledWith({ x: 392, y: 176 });
  });

  it("commits or restores an exact inline label", () => {
    const { handlers } = renderEdge({ editing: true });
    const input = screen.getByRole("textbox", { name: "Edit relationship label" });
    fireEvent.change(input, { target: { value: "$20,000–? — $_____" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(handlers.commitEdit).toHaveBeenCalledWith("$20,000–? — $_____");
  });

  it("selects from the generous invisible path target", () => {
    const { handlers } = renderEdge();
    const target = document.querySelector(".react-flow__edge-interaction");
    if (!target) throw new Error("Expected interaction path");
    expect(target.getAttribute("stroke-width")).toBe("28");
    fireEvent.click(target);
    expect(handlers.select).toHaveBeenCalledTimes(1);
  });

  it("renders presentation labels as non-interactive focused content", () => {
    const { flow, handlers } = renderEdge({ presentation: true, presentationFocus: true });

    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByRole("group", {
        name: `${flow.relationship} relationship from ${flow.source} to ${flow.target}: ${flow.label}; ${flow.cadence.label}`,
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByText(flow.label)
        .closest("[data-presentation-focus]")
        ?.getAttribute("data-presentation-focus"),
    ).toBe("true");
    fireEvent.click(screen.getByText(flow.label));
    expect(handlers.select).not.toHaveBeenCalled();
    expect(handlers.beginEdit).not.toHaveBeenCalled();
  });
});
