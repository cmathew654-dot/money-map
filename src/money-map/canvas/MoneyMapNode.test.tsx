import { render, screen } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";

import { createTestDocument } from "../model/test-fixtures";
import { MoneyMapNode, type MoneyMapCanvasNode } from "./MoneyMapNode";

describe("MoneyMapNode", () => {
  it("renders every semantic region and authored literal exactly", () => {
    const module = createTestDocument().modules[1];
    const props = {
      id: module.id,
      data: { module, outgoingCount: 2 },
      selected: false,
      dragging: false,
      zIndex: 0,
      selectable: true,
      deletable: true,
      draggable: true,
      isConnectable: false,
      positionAbsoluteX: module.position.x,
      positionAbsoluteY: module.position.y,
      type: "moneyMapModule",
    } as NodeProps<MoneyMapCanvasNode>;

    const { container } = render(
      <ReactFlowProvider>
        <MoneyMapNode {...props} />
      </ReactFlowProvider>,
    );

    const node = container.querySelector("[data-primitive='band'][data-kind='income']");
    expect(node).toBeTruthy();
    expect(screen.getByText("Income floor")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Illustrative annuity" })).toBeTruthy();
    expect(screen.getByText("$300,000 — revised illustration")).toBeTruthy();
    expect(screen.getByText("~$11,800/mo")).toBeTruthy();
    expect(screen.getByText("$_____")).toBeTruthy();
    expect(screen.getByText("Illustrative premium")).toBeTruthy();
    expect(screen.getByText("$300,000")).toBeTruthy();
    expect(screen.getByText("Amounts are advisor-authored display text.")).toBeTruthy();
  });

  it("allows reconnect drops but not new connection starts outside Connections mode", () => {
    const module = createTestDocument().modules[0];
    const props = {
      id: module.id,
      data: {
        module,
        outgoingCount: 1,
        selectionCount: 1,
        selectionModuleIds: [],
        haloAnchor: false,
        connectMode: false,
        reconnectMode: true,
      },
      selected: false,
      dragging: false,
      zIndex: 0,
      selectable: true,
      deletable: true,
      draggable: true,
      isConnectable: true,
      positionAbsoluteX: module.position.x,
      positionAbsoluteY: module.position.y,
      type: "moneyMapModule",
    } as NodeProps<MoneyMapCanvasNode>;

    const { container } = render(
      <ReactFlowProvider>
        <MoneyMapNode {...props} />
      </ReactFlowProvider>,
    );
    const handles = [...container.querySelectorAll(".money-map-handle")];
    expect(handles).toHaveLength(8);
    expect(handles.every((handle) => handle.classList.contains("connectableend"))).toBe(true);
    expect(handles.every((handle) => !handle.classList.contains("connectablestart"))).toBe(true);
    expect(container.querySelector('[data-reconnect-mode="true"]')).toBeTruthy();
  });
});
