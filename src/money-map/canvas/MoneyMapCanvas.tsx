import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type OnEdgesChange,
  type OnNodesChange,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
  useReactFlow,
} from "@xyflow/react";

import { useEditorInteraction } from "../editor/EditorInteractionContext";
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.matches("input, textarea, select") ||
    target.isContentEditable ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("button, a, [role='tab'], [role='option'], [role='combobox']"))
  );
}

function sameIds(first: string[], second: string[]): boolean {
  if (first.length !== second.length) return false;
  const secondIds = new Set(second);
  return first.every((id) => secondIds.has(id));
}

function cameraDuration(duration: number): number {
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduceMotion ? 0 : duration;
}

function selectionAnnouncement(document: MoneyMapDocument, selection: Selection): string {
  const moduleCount = selection.moduleIds.length;
  const relationshipCount = selection.flowIds.length;

  if (moduleCount === 0 && relationshipCount === 0) return "Selection cleared.";

  if (moduleCount === 1 && relationshipCount === 0) {
    const module = document.modules.find((candidate) => candidate.id === selection.moduleIds[0]);
    if (module) return `${module.title} selected.`;
  }

  if (moduleCount === 0 && relationshipCount === 1) {
    const flow = document.flows.find((candidate) => candidate.id === selection.flowIds[0]);
    if (flow) return `${flow.label} relationship selected.`;
  }

  const modulePhrase = `${moduleCount} ${moduleCount === 1 ? "module" : "modules"}`;
  const relationshipPhrase = `${relationshipCount} ${
    relationshipCount === 1 ? "relationship" : "relationships"
  }`;
  if (moduleCount === 0) return `${relationshipPhrase} selected.`;
  if (relationshipCount === 0) return `${modulePhrase} selected.`;
  return `${modulePhrase} and ${relationshipPhrase} selected.`;
}

function MoneyMapCanvasInner({
  document,
  selection,
  onSelectionChange,
  onDocumentChange,
}: MoneyMapCanvasProps) {
  const flow = useReactFlow<MoneyMapCanvasNode, MoneyMapCanvasEdge>();
  const editor = useEditorInteraction();
  const [zoomPercentage, setZoomPercentage] = useState(100);
  const [announcement, setAnnouncement] = useState("");
  const adaptedNodes = useMemo(() => documentToNodes(document, selection), [document, selection]);
  const adaptedEdges = useMemo(() => documentToEdges(document, selection), [document, selection]);
  const [nodes, setNodes] = useState(adaptedNodes);
  const [edges, setEdges] = useState(adaptedEdges);
  const previousSelection = useRef(selection);
  const selectionSyncPending = useRef(false);

  if (
    !sameIds(previousSelection.current.moduleIds, selection.moduleIds) ||
    !sameIds(previousSelection.current.flowIds, selection.flowIds)
  ) {
    previousSelection.current = selection;
    selectionSyncPending.current = true;
  }

  const localSelectionIsCurrent =
    sameIds(
      nodes.filter((node) => node.selected).map(({ id }) => id),
      selection.moduleIds,
    ) &&
    sameIds(
      edges.filter((edge) => edge.selected).map(({ id }) => id),
      selection.flowIds,
    );
  if (selectionSyncPending.current && localSelectionIsCurrent) {
    selectionSyncPending.current = false;
  }

  useEffect(() => {
    setNodes((currentNodes) =>
      adaptedNodes.map((nextNode) => {
        const currentNode = currentNodes.find((candidate) => candidate.id === nextNode.id);
        return currentNode?.measured ? { ...nextNode, measured: currentNode.measured } : nextNode;
      }),
    );
  }, [adaptedNodes]);

  useEffect(() => {
    setEdges(adaptedEdges);
  }, [adaptedEdges]);

  const applySelection = useCallback(
    (nextSelection: Selection) => {
      onSelectionChange(nextSelection);
      setAnnouncement(selectionAnnouncement(document, nextSelection));
    },
    [document, onSelectionChange],
  );

  const fitMap = useCallback(() => {
    void flow.fitView({ padding: 0.16, duration: cameraDuration(180) });
  }, [flow]);

  const fitSelection = useCallback(() => {
    if (selection.moduleIds.length === 0) {
      fitMap();
      return;
    }

    void flow.fitView({
      nodes: selection.moduleIds.map((id) => ({ id })),
      padding: 0.22,
      duration: cameraDuration(180),
    });
  }, [fitMap, flow, selection.moduleIds]);

  const controller = useMemo<CanvasController>(
    () => ({
      zoomOut: () => void flow.zoomOut({ duration: cameraDuration(140) }),
      resetZoom: () => void flow.zoomTo(1, { duration: cameraDuration(140) }),
      zoomIn: () => void flow.zoomIn({ duration: cameraDuration(140) }),
      fitMap,
      fitSelection,
    }),
    [fitMap, fitSelection, flow],
  );

  const handleNodesChange = useCallback<OnNodesChange<MoneyMapCanvasNode>>(
    (changes: NodeChange<MoneyMapCanvasNode>[]) => {
      const runtimeChanges = changes.filter(
        (change) =>
          change.type === "dimensions" || change.type === "position" || change.type === "select",
      );
      if (runtimeChanges.length > 0) {
        // Select changes stay in React Flow's controlled runtime state. Only
        // the combined listener below may commit document selection.
        setNodes((currentNodes) => applyNodeChanges(runtimeChanges, currentNodes));
      }
    },
    [],
  );

  const handleEdgesChange = useCallback<OnEdgesChange<MoneyMapCanvasEdge>>(
    (changes: EdgeChange<MoneyMapCanvasEdge>[]) => {
      const runtimeChanges = changes.filter((change) => change.type === "select");
      if (runtimeChanges.length > 0) {
        setEdges((currentEdges) => applyEdgeChanges(runtimeChanges, currentEdges));
      }
    },
    [],
  );

  const handleFlowSelectionChange = useCallback<
    OnSelectionChangeFunc<MoneyMapCanvasNode, MoneyMapCanvasEdge>
  >(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (selectionSyncPending.current) return;

      const nextSelection = {
        moduleIds: selectedNodes.map((node) => node.id),
        flowIds: selectedEdges.map((edge) => edge.id),
      };
      if (
        sameIds(nextSelection.moduleIds, selection.moduleIds) &&
        sameIds(nextSelection.flowIds, selection.flowIds)
      ) {
        return;
      }
      applySelection(nextSelection);
    },
    [applySelection, selection],
  );

  const handleNodeDragStop = useCallback<OnNodeDrag<MoneyMapCanvasNode>>(
    (_event, node) => {
      if (editor) {
        editor.commitModuleMove(node.id, node.position);
        setAnnouncement(`${node.data.module.title} moved.`);
        return;
      }
      const nextDocument = moveModule(document, node.id, node.position);
      if (nextDocument === document) return;
      onDocumentChange(nextDocument);
      setAnnouncement(`${node.data.module.title} moved.`);
    },
    [document, editor, onDocumentChange],
  );

  const clearSelection = useCallback(() => {
    setNodes((currentNodes) => {
      const changes: NodeChange<MoneyMapCanvasNode>[] = currentNodes
        .filter((node) => node.selected)
        .map((node) => ({ id: node.id, type: "select", selected: false }));
      return changes.length > 0 ? applyNodeChanges(changes, currentNodes) : currentNodes;
    });
    setEdges((currentEdges) => {
      const changes: EdgeChange<MoneyMapCanvasEdge>[] = currentEdges
        .filter((edge) => edge.selected)
        .map((edge) => ({ id: edge.id, type: "select", selected: false }));
      return changes.length > 0 ? applyEdgeChanges(changes, currentEdges) : currentEdges;
    });
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target) || event.nativeEvent.isComposing) return;

      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLocaleLowerCase() === "k") {
          event.preventDefault();
          editor?.openPalette(event.currentTarget);
          return;
        }
        if (event.key.toLocaleLowerCase() === "d") {
          event.preventDefault();
          editor?.executeCommand("selection.duplicate");
          return;
        }
        if (event.key.toLocaleLowerCase() === "z") {
          event.preventDefault();
          editor?.executeCommand(event.shiftKey ? "history.redo" : "history.undo");
          return;
        }
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          controller.zoomIn();
          return;
        }
        if (event.key === "-") {
          event.preventDefault();
          controller.zoomOut();
          return;
        }
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearSelection();
        return;
      }

      if (event.shiftKey && (event.key === "1" || event.code === "Digit1")) {
        event.preventDefault();
        fitMap();
        return;
      }

      if (event.shiftKey && (event.key === "2" || event.code === "Digit2")) {
        event.preventDefault();
        fitSelection();
        return;
      }

      if (isInteractiveTarget(event.target)) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        editor?.executeCommand("selection.remove");
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        editor?.executeCommand("module.edit");
        return;
      }

      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const distance = event.shiftKey ? 32 : 8;
        const delta =
          event.key === "ArrowLeft"
            ? { x: -distance, y: 0 }
            : event.key === "ArrowRight"
              ? { x: distance, y: 0 }
              : event.key === "ArrowUp"
                ? { x: 0, y: -distance }
                : { x: 0, y: distance };
        editor?.nudgeSelected(delta);
      }
    },
    [clearSelection, controller, editor, fitMap, fitSelection],
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
        onSelectionChange={handleFlowSelectionChange}
        onNodeDragStop={handleNodeDragStop}
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
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {editor?.announcement || announcement}
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
