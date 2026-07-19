import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type * as ReactFlowExports from "@xyflow/react";
import { vi } from "vitest";

import { createTestDocument } from "../model/test-fixtures";
import { MoneyMapCanvas } from "./MoneyMapCanvas";

vi.mock("@xyflow/react", async (importOriginal) => {
  const original = await importOriginal<typeof ReactFlowExports>();
  return {
    ...original,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useReactFlow: () => ({
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      zoomTo: vi.fn(),
      fitView: vi.fn(),
      getNodes: () => [],
    }),
    ReactFlow: ({ nodes, onNodeClick, onPaneClick }: Record<string, unknown>) => (
      <div data-testid="react-flow-pane" onClick={() => (onPaneClick as () => void)()}>
        {(nodes as { id: string; data: { module: { title: string } } }[]).map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              (onNodeClick as (event: React.MouseEvent, node: { id: string }) => void)(event, node);
            }}
          >
            {node.data.module.title}
          </button>
        ))}
      </div>
    ),
  };
});

describe("MoneyMapCanvas selection", () => {
  it("reports click selection, pane clear, and Escape without changing the document", () => {
    const document = createTestDocument();
    const onSelectionChange = vi.fn();
    const onDocumentChange = vi.fn();
    const { container } = render(
      <MoneyMapCanvas
        document={document}
        selection={{ moduleIds: [], flowIds: [] }}
        onSelectionChange={onSelectionChange}
        onDocumentChange={onDocumentChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Illustrative annuity" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      moduleIds: ["annuity-policy"],
      flowIds: [],
    });

    fireEvent.click(screen.getByTestId("react-flow-pane"));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ moduleIds: [], flowIds: [] });

    fireEvent.keyDown(container.firstElementChild as Element, { key: "Escape" });
    expect(onSelectionChange).toHaveBeenLastCalledWith({ moduleIds: [], flowIds: [] });
    expect(onDocumentChange).not.toHaveBeenCalled();
  });

  it("does not intercept Escape from editable controls", () => {
    const mapDocument = createTestDocument();
    const onSelectionChange = vi.fn();
    const { container } = render(
      <MoneyMapCanvas
        document={mapDocument}
        selection={{ moduleIds: ["annuity-policy"], flowIds: [] }}
        onSelectionChange={onSelectionChange}
        onDocumentChange={vi.fn()}
      />,
    );
    const input = document.createElement("input");
    container.firstElementChild?.append(input);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});
