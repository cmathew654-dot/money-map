import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type * as ReactFlowExports from "@xyflow/react";
import { vi } from "vitest";

import { documentGeometry } from "../model/document";
import { createTestDocument } from "../model/test-fixtures";
import { MoneyMapCanvas } from "./MoneyMapCanvas";

const flowMock = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  zoomTo: vi.fn(),
  fitView: vi.fn(),
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const original = await importOriginal<typeof ReactFlowExports>();
  return {
    ...original,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useReactFlow: () => ({
      zoomIn: flowMock.zoomIn,
      zoomOut: flowMock.zoomOut,
      zoomTo: flowMock.zoomTo,
      fitView: flowMock.fitView,
      getNodes: () => [],
    }),
    ReactFlow: (props: Record<string, unknown>) => {
      flowMock.props = props;
      const nodes = props.nodes as {
        id: string;
        selected?: boolean;
        data: { module: { title: string } };
      }[];
      const edges = props.edges as { id: string; label?: string }[];
      return (
        <div data-testid="react-flow-pane" onClick={() => (props.onPaneClick as () => void)()}>
          {nodes.map((node) => (
            <button
              data-selected={node.selected ? "true" : "false"}
              key={node.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                (
                  props.onNodeClick as (
                    event: React.MouseEvent,
                    node: { id: string; data: { module: { title: string } } },
                  ) => void
                )(event, node);
              }}
            >
              {node.data.module.title}
            </button>
          ))}
          {edges.map((edge) => (
            <button
              key={edge.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                (props.onEdgeClick as (event: React.MouseEvent, edge: { id: string }) => void)(
                  event,
                  edge,
                );
              }}
            >
              {edge.label}
            </button>
          ))}
        </div>
      );
    },
  };
});

function renderCanvas(
  selection = { moduleIds: [] as string[], flowIds: [] as string[] },
  onSelectionChange = vi.fn(),
  onDocumentChange = vi.fn(),
) {
  const document = createTestDocument();
  const view = render(
    <MoneyMapCanvas
      document={document}
      selection={selection}
      onSelectionChange={onSelectionChange}
      onDocumentChange={onDocumentChange}
    />,
  );

  return {
    ...view,
    document,
    rerenderWith(nextSelection: typeof selection) {
      view.rerender(
        <MoneyMapCanvas
          document={document}
          selection={nextSelection}
          onSelectionChange={onSelectionChange}
          onDocumentChange={onDocumentChange}
        />,
      );
    },
  };
}

describe("MoneyMapCanvas selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flowMock.props = {};
  });

  it("announces click selection, additive Shift-click, pane clear, and Escape", () => {
    const onSelectionChange = vi.fn();
    const onDocumentChange = vi.fn();
    const view = renderCanvas(
      { moduleIds: ["source-account"], flowIds: [] },
      onSelectionChange,
      onDocumentChange,
    );

    fireEvent.click(screen.getByRole("button", { name: "Illustrative annuity" }), {
      shiftKey: true,
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      moduleIds: ["source-account", "annuity-policy"],
      flowIds: [],
    });
    expect(screen.getByRole("status").textContent).toBe("2 modules selected.");

    fireEvent.click(screen.getByTestId("react-flow-pane"));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ moduleIds: [], flowIds: [] });
    expect(screen.getByRole("status").textContent).toBe("Selection cleared.");

    fireEvent.keyDown(view.container.firstElementChild as Element, { key: "Escape" });
    expect(onSelectionChange).toHaveBeenLastCalledWith({ moduleIds: [], flowIds: [] });
    expect(screen.getByRole("status").textContent).toBe("Selection cleared.");
    expect(onDocumentChange).not.toHaveBeenCalled();
  });

  it("synchronizes node and edge selection changes and announces their results", async () => {
    const onSelectionChange = vi.fn();
    const view = renderCanvas(undefined, onSelectionChange);

    act(() => {
      (
        flowMock.props.onNodesChange as (
          changes: { id: string; type: "select"; selected: boolean }[],
        ) => void
      )([{ id: "source-account", type: "select", selected: true }]);
    });
    const nodeSelection = { moduleIds: ["source-account"], flowIds: [] };
    expect(onSelectionChange).toHaveBeenLastCalledWith(nodeSelection);
    expect(screen.getByRole("status").textContent).toBe("Investment account selected.");

    view.rerenderWith(nodeSelection);
    await waitFor(() => {
      const selectedNode = (flowMock.props.nodes as { id: string; selected?: boolean }[]).find(
        (node) => node.id === "source-account",
      );
      expect(selectedNode?.selected).toBe(true);
    });

    act(() => {
      (
        flowMock.props.onEdgesChange as (
          changes: { id: string; type: "select"; selected: boolean }[],
        ) => void
      )([{ id: "funding-flow", type: "select", selected: true }]);
    });
    const combinedSelection = {
      moduleIds: ["source-account"],
      flowIds: ["funding-flow"],
    };
    expect(onSelectionChange).toHaveBeenLastCalledWith(combinedSelection);
    expect(screen.getByRole("status").textContent).toBe("1 module and 1 relationship selected.");

    view.rerenderWith(combinedSelection);
    await waitFor(() => {
      const selectedEdge = (flowMock.props.edges as { id: string; selected?: boolean }[]).find(
        (edge) => edge.id === "funding-flow",
      );
      expect(selectedEdge?.selected).toBe(true);
    });
  });

  it("announces edge-only selection and additive marquee results", () => {
    const onSelectionChange = vi.fn();
    const view = renderCanvas(undefined, onSelectionChange);

    act(() => {
      (
        flowMock.props.onEdgesChange as (
          changes: { id: string; type: "select"; selected: boolean }[],
        ) => void
      )([{ id: "income-flow", type: "select", selected: true }]);
    });
    expect(screen.getByRole("status").textContent).toBe("~$11,800/mo relationship selected.");

    view.rerenderWith({ moduleIds: ["source-account"], flowIds: [] });
    act(() => {
      (
        flowMock.props.onNodesChange as (
          changes: { id: string; type: "select"; selected: boolean }[],
        ) => void
      )([
        { id: "annuity-policy", type: "select", selected: true },
        { id: "monthly-need", type: "select", selected: true },
      ]);
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      moduleIds: ["source-account", "annuity-policy", "monthly-need"],
      flowIds: [],
    });
    expect(screen.getByRole("status").textContent).toBe("3 modules selected.");
  });

  it("retains content-driven React Flow measurements through selection changes", () => {
    renderCanvas();

    act(() => {
      (flowMock.props.onNodesChange as (changes: Array<Record<string, unknown>>) => void)([
        {
          id: "annuity-policy",
          type: "dimensions",
          dimensions: { width: 304, height: 247 },
        },
      ]);
    });
    expect(
      (flowMock.props.nodes as Array<Record<string, unknown>>).find(
        (node) => node.id === "annuity-policy",
      )?.measured,
    ).toEqual({ width: 304, height: 247 });

    act(() => {
      (
        flowMock.props.onNodesChange as (
          changes: { id: string; type: "select"; selected: boolean }[],
        ) => void
      )([{ id: "annuity-policy", type: "select", selected: true }]);
    });
    expect(
      (flowMock.props.nodes as Array<Record<string, unknown>>).find(
        (node) => node.id === "annuity-policy",
      )?.measured,
    ).toEqual({ width: 304, height: 247 });
  });
  it("does not intercept Escape from editable controls", () => {
    const onSelectionChange = vi.fn();
    const { container } = renderCanvas(
      { moduleIds: ["annuity-policy"], flowIds: [] },
      onSelectionChange,
    );
    const input = document.createElement("input");
    container.firstElementChild?.append(input);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});

describe("MoneyMapCanvas movement and camera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flowMock.props = {};
  });

  it("commits final world position while preserving other geometry and literal content", () => {
    const onDocumentChange = vi.fn();
    const { document } = renderCanvas(undefined, vi.fn(), onDocumentChange);
    const beforeGeometry = documentGeometry(document);
    const node = (
      flowMock.props.nodes as { id: string; position: { x: number; y: number } }[]
    ).find((candidate) => candidate.id === "annuity-policy");
    if (!node) throw new Error("Expected annuity-policy node");

    act(() => {
      (
        flowMock.props.onNodeDragStop as (
          event: unknown,
          node: {
            id: string;
            position: { x: number; y: number };
            data: { module: { title: string } };
          },
        ) => void
      )(
        {},
        {
          ...node,
          position: { x: 512, y: 248 },
          data: { module: { title: "Illustrative annuity" } },
        },
      );
    });

    const moved = onDocumentChange.mock.calls[0][0] as ReturnType<typeof createTestDocument>;
    expect(moved.modules[1].position).toEqual({ x: 512, y: 248 });
    expect(documentGeometry(moved).modules[0]).toEqual(beforeGeometry.modules[0]);
    expect(moved.modules[1].rows).toBe(document.modules[1].rows);
    expect(moved.modules[1].rows[0].value).toBe("$300,000 — revised illustration");
    expect(screen.getByRole("status").textContent).toBe("Illustrative annuity moved.");
  });

  it("uses zero-duration camera commands when reduced motion is requested", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    renderCanvas();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Fit map" }));

    expect(flowMock.zoomIn).toHaveBeenCalledWith({ duration: 0 });
    expect(flowMock.fitView).toHaveBeenCalledWith(expect.objectContaining({ duration: 0 }));
  });
});
