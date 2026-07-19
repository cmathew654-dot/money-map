import { useCallback, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type NodeMouseHandler,
  type OnEdgesChange,
  type OnNodesChange,
  type OnNodeDrag,
  useReactFlow,
} from "@xyflow/react";

import type { MoneyMapDocument, Selection } from "../model/types";
import { CanvasControls, type CanvasController } from "./CanvasControls";
import { MoneyMapNode, type MoneyMapCanvasNode } from "./MoneyMapNode";
import { documentToEdges, documentToNodes, moveModule, type MoneyMapEdgeData } from "./adapters";

interface MoneyMapCanvasProps {
  document: MoneyMapDocument;
  selection: Selection;
  onSelectionChange(selection: Selection): void;
  onDocumentChange(document: MoneyMapDocument): void;
}

type MoneyMapCanvasEdge = Edge<MoneyMapEdgeData>;

const nodeTypes = { moneyMapModule: MoneyMapNode };
const emptySelection: Selection = { moduleIds: [], flowIds: [] };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.matches("input, textarea, select") ||
    target.isContentEditable ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

function MoneyMapCanvasInner({
  document,
  selection,
  onSelectionChange,
  onDocumentChange,
}: MoneyMapCanvasProps) {
  const flow = useReactFlow<MoneyMapCanvasNode, MoneyMapCanvasEdge>();
  const [zoomPercentage, setZoomPercentage] = useState(100);
  const [announcement, setAnnouncement] = useState("");
  const nodes = useMemo(() => documentToNodes(document, selection), [document, selection]);
  const edges = useMemo(() => documentToEdges(document, selection), [document, selection]);

  const fitMap = useCallback(() => {
    void flow.fitView({ padding: 0.16, duration: 180 });
  }, [flow]);

  const fitSelection = useCallback(() => {
    if (selection.moduleIds.length === 0) {
      fitMap();
      return;
    }

    void flow.fitView({
      nodes: selection.moduleIds.map((id) => ({ id })),
      padding: 0.22,
      duration: 180,
    });
  }, [fitMap, flow, selection.moduleIds]);

  const controller = useMemo<CanvasController>(
    () => ({
      zoomOut: () => void flow.zoomOut({ duration: 140 }),
      resetZoom: () => void flow.zoomTo(1, { duration: 140 }),
      zoomIn: () => void flow.zoomIn({ duration: 140 }),
      fitMap,
      fitSelection,
    }),
    [fitMap, fitSelection, flow],
  );

  const handleNodesChange = useCallback<OnNodesChange<MoneyMapCanvasNode>>(
    (changes: NodeChange<MoneyMapCanvasNode>[]) => {
      const selectChanges = changes.filter(
        (change): change is Extract<NodeChange, { type: "select" }> => change.type === "select",
      );
      if (selectChanges.length === 0) return;

      const selectedIds = new Set(selection.moduleIds);
      for (const change of selectChanges) {
        if (change.selected) selectedIds.add(change.id);
        else selectedIds.delete(change.id);
      }
      onSelectionChange({ moduleIds: [...selectedIds], flowIds: selection.flowIds });
    },
    [onSelectionChange, selection],
  );

  const handleEdgesChange = useCallback<OnEdgesChange<MoneyMapCanvasEdge>>(
    (changes: EdgeChange<MoneyMapCanvasEdge>[]) => {
      const selectChanges = changes.filter(
        (change): change is Extract<EdgeChange, { type: "select" }> => change.type === "select",
      );
      if (selectChanges.length === 0) return;

      const selectedIds = new Set(selection.flowIds);
      for (const change of selectChanges) {
        if (change.selected) selectedIds.add(change.id);
        else selectedIds.delete(change.id);
      }
      onSelectionChange({ moduleIds: selection.moduleIds, flowIds: [...selectedIds] });
    },
    [onSelectionChange, selection],
  );

  const handleNodeClick = useCallback<NodeMouseHandler<MoneyMapCanvasNode>>(
    (event, node) => {
      const moduleIds = event.shiftKey
        ? Array.from(new Set([...selection.moduleIds, node.id]))
        : [node.id];
      onSelectionChange({
        moduleIds,
        flowIds: event.shiftKey ? selection.flowIds : [],
      });
    },
    [onSelectionChange, selection],
  );

  const handleEdgeClick = useCallback(
    (event: MouseEvent, edge: { id: string }) => {
      const flowIds = event.shiftKey
        ? Array.from(new Set([...selection.flowIds, edge.id]))
        : [edge.id];
      onSelectionChange({
        moduleIds: event.shiftKey ? selection.moduleIds : [],
        flowIds,
      });
    },
    [onSelectionChange, selection],
  );

  const handleNodeDragStop = useCallback<OnNodeDrag<MoneyMapCanvasNode>>(
    (_event, node) => {
      const nextDocument = moveModule(document, node.id, node.position);
      if (nextDocument === document) return;
      onDocumentChange(nextDocument);
      setAnnouncement(`${node.data.module.title} moved.`);
    },
    [document, onDocumentChange],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onSelectionChange(emptySelection);
        setAnnouncement("Selection cleared.");
        return;
      }

      if (event.shiftKey && event.key === "1") {
        event.preventDefault();
        fitMap();
        return;
      }

      if (event.shiftKey && event.key === "2") {
        event.preventDefault();
        fitSelection();
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        controller.zoomIn();
      } else if (event.key === "-") {
        event.preventDefault();
        controller.zoomOut();
      }
    },
    [controller, fitMap, fitSelection, onSelectionChange],
  );

  return (
    <div
      className="money-map-canvas"
      tabIndex={0}
      aria-label={`${document.title} authoring canvas`}
      onKeyDown={handleKeyDown}
    >
      <ReactFlow<MoneyMapCanvasNode, MoneyMapCanvasEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={() => onSelectionChange(emptySelection)}
        onViewportChange={(viewport) => setZoomPercentage(Math.round(viewport.zoom * 100))}
        minZoom={0.3}
        maxZoom={2}
        zoomOnScroll
        zoomOnPinch
        panOnDrag={[0, 1]}
        panActivationKeyCode="Space"
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        selectionOnDrag={false}
        nodesConnectable={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: false }}
      />
      <CanvasControls controller={controller} zoomPercentage={zoomPercentage} />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}

export function MoneyMapCanvas(props: MoneyMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <MoneyMapCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
