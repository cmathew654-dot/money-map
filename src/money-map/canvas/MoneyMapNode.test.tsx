import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";

import { createTestDocument } from "../model/test-fixtures";
import {
  EditorInteractionContext,
  type EditorInteraction,
} from "../editor/EditorInteractionContext";
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
    expect(node?.getAttribute("data-priority")).toBe("standard");
    expect(node?.getAttribute("data-density")).toBe("standard");
    expect(node?.getAttribute("data-color-role")).toBe("income");
    expect(node?.getAttribute("data-swatch")).toBe("base");
    expect(screen.getByText("Income floor")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Illustrative annuity" })).toBeTruthy();
    expect(screen.getByText("$300,000 — revised illustration")).toBeTruthy();
    expect(screen.getByText("~$11,800/mo")).toBeTruthy();
    expect(screen.getByText("$_____")).toBeTruthy();
    expect(screen.getByText("Illustrative premium")).toBeTruthy();
    expect(screen.getByText("$300,000")).toBeTruthy();
    expect(screen.getByText("Amounts are advisor-authored display text.")).toBeTruthy();
  });

  it("uses essential density to show only title and total without mutating literals", () => {
    const source = createTestDocument().modules[1];
    const module = { ...source, density: "essential" as const };
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

    render(
      <ReactFlowProvider>
        <MoneyMapNode {...props} />
      </ReactFlowProvider>,
    );

    expect(screen.getByRole("heading", { name: module.title })).toBeTruthy();
    expect(screen.getByText(module.total!.value)).toBeTruthy();
    expect(screen.queryByText(module.rows[0].value)).toBeNull();
    expect(screen.queryByText(module.note!)).toBeNull();
    expect(module.rows[0].value).toBe(source.rows[0].value);
  });

  it("opens direct editing from every visible authored text role", () => {
    const module = { ...createTestDocument().modules[1], subtitle: "Advisor-owned" };
    const begun: string[] = [];
    const editor = {
      activeInlineField: null,
      beginInlineEdit: (target: { field: string }) => begun.push(target.field),
      selectionCount: 0,
      selectedModuleIds: [],
      availableCommands: [],
      announcement: "",
      activeFlowId: null,
    } as unknown as EditorInteraction;
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
      <EditorInteractionContext.Provider value={editor}>
        <ReactFlowProvider>
          <MoneyMapNode {...props} />
        </ReactFlowProvider>
      </EditorInteractionContext.Provider>,
    );
    for (const selector of [
      ".money-map-module__eyebrow",
      ".money-map-module__subtitle",
      ".money-map-module__row dt",
      ".money-map-module__total dt",
      ".money-map-module__note",
    ]) {
      fireEvent.doubleClick(container.querySelector(selector)!);
    }

    expect(begun).toEqual(["eyebrow", "subtitle", "row-label", "total-label", "note"]);
  });

  it("allows new flow starts and reconnect drops whenever authoring", () => {
    const module = createTestDocument().modules[0];
    const props = {
      id: module.id,
      data: {
        module,
        outgoingCount: 1,
        selectionCount: 1,
        selectionModuleIds: [],
        haloAnchor: false,
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
    expect(handles.every((handle) => handle.classList.contains("connectablestart"))).toBe(true);
    expect(container.querySelector('[data-reconnect-mode="true"]')).toBeTruthy();
  });

  it("renders presentation focus without author handles or editing affordances", () => {
    const module = createTestDocument().modules[0];
    const props = {
      id: module.id,
      data: {
        module,
        outgoingCount: 1,
        selectionCount: 0,
        selectionModuleIds: [],
        haloAnchor: false,
        reconnectMode: false,
        presentation: true,
        presentationFocus: true,
      },
      selected: false,
      dragging: false,
      zIndex: 0,
      selectable: false,
      deletable: false,
      draggable: false,
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

    expect(container.querySelector('[data-presentation-focus="true"]')).toBeTruthy();
    expect(container.querySelectorAll(".money-map-handle")).toHaveLength(8);
    expect(container.querySelector(".money-map-handle.connectablestart")).toBeNull();
    expect(container.querySelector(".selection-halo")).toBeNull();
    expect(container.querySelector("input, button")).toBeNull();
  });
});
