import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  ConnectionMode,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnEdgesChange,
  type OnNodesChange,
  type OnNodeDrag,
  type OnReconnect,
  type OnSelectionChangeFunc,
  useReactFlow,
} from "@xyflow/react";

import { matchCommandShortcut } from "../editor/commandShortcuts";
import { useEditorInteraction } from "../editor/EditorInteractionContext";
import type { MoneyMapDocument, PresentationStep, Selection } from "../model/types";
import { CanvasControls, type CanvasController } from "./CanvasControls";
import { MoneyMapEdge } from "./MoneyMapEdge";
import { MoneyMapNode, type MoneyMapCanvasNode } from "./MoneyMapNode";
import {
  cadenceMatchesFilter,
  documentToEdges,
  documentToNodes,
  moveModule,
  type CadenceFilter,
  type MoneyMapCanvasEdge,
} from "./adapters";

interface MoneyMapCanvasProps {
  document: MoneyMapDocument;
  selection: Selection;
  onSelectionChange(selection: Selection): void;
  onDocumentChange(document: MoneyMapDocument): void;
  cadenceFilter?: CadenceFilter;
  mode?: "author" | "presentation";
  presentationStep?: PresentationStep;
}

const nodeTypes = { moneyMapModule: MoneyMapNode };
const edgeTypes = { moneyMapRelationship: MoneyMapEdge };

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
  cadenceFilter = "all",
  mode = "author",
  presentationStep,
}: MoneyMapCanvasProps) {
  const flow = useReactFlow<MoneyMapCanvasNode, MoneyMapCanvasEdge>();
  const editor = useEditorInteraction();
  const screenToFlowPosition = flow.screenToFlowPosition;
  const [zoomPercentage, setZoomPercentage] = useState(100);
  const [announcement, setAnnouncement] = useState("");
  const presenting = mode === "presentation";
  const adaptedNodes = useMemo(
    () => documentToNodes(document, selection, presentationStep),
    [document, presentationStep, selection],
  );
  const adaptedEdges = useMemo(
    () =>
      documentToEdges(document, selection, cadenceFilter, presentationStep).map((edge) => {
        const relationship = edge.data?.flow;
        if (presenting || !editor || !relationship) return edge;
        return {
          ...edge,
          data: {
            ...edge.data,
            flow: relationship,
            editing: editor.activeFlowId === relationship.id,
            handlers: {
              beginEdit: () => editor.beginFlowEdit(relationship.id),
              cancelEdit: editor.cancelFlowEdit,
              commitEdit: (literal: string) => editor.commitFlowEdit(relationship.id, literal),
              moveLabelPosition: (clientPoint: { x: number; y: number }) =>
                editor.commitFlowLabelPosition(
                  relationship.id,
                  screenToFlowPosition ? screenToFlowPosition(clientPoint) : clientPoint,
                ),
              nudgeLabelPosition: (point: { x: number; y: number }) =>
                editor.commitFlowLabelPosition(relationship.id, point),
              moveWaypointPosition: (clientPoint: { x: number; y: number }) =>
                editor.commitFlowWaypoint(
                  relationship.id,
                  screenToFlowPosition ? screenToFlowPosition(clientPoint) : clientPoint,
                ),
              nudgeWaypointPosition: (point: { x: number; y: number }) =>
                editor.commitFlowWaypoint(relationship.id, point),
              select: () => editor.selectFlow(relationship.id),
            },
          },
        };
      }),
    [
      cadenceFilter,
      document,
      editor,
      presentationStep,
      presenting,
      screenToFlowPosition,
      selection,
    ],
  );
  const [nodes, setNodes] = useState(adaptedNodes);
  const [edges, setEdges] = useState(adaptedEdges);
  const previousSelection = useRef(selection);
  const latestSelection = useRef(selection);
  const selectionRevision = useRef(0);
  const selectionSyncTarget = useRef<Selection | null>(null);
  const additiveNodeIntent = useRef<{ moduleId: string; revision: number } | null>(null);
  const visibleFlowIds = useMemo(
    () =>
      new Set(
        document.flows
          .filter((relationship) => cadenceMatchesFilter(relationship, cadenceFilter))
          .map(({ id }) => id),
      ),
    [cadenceFilter, document.flows],
  );

  if (
    !sameIds(previousSelection.current.moduleIds, selection.moduleIds) ||
    !sameIds(previousSelection.current.flowIds, selection.flowIds)
  ) {
    previousSelection.current = selection;
    latestSelection.current = selection;
    selectionRevision.current += 1;
    selectionSyncTarget.current = selection;
    additiveNodeIntent.current = null;
  }

  const syncTarget = selectionSyncTarget.current;
  const localSelectionMatchesTarget =
    syncTarget !== null &&
    sameIds(
      nodes.filter((node) => node.selected).map(({ id }) => id),
      syncTarget.moduleIds,
    ) &&
    sameIds(
      edges.filter((edge) => edge.selected).map(({ id }) => id),
      syncTarget.flowIds,
    );
  if (
    syncTarget &&
    localSelectionMatchesTarget &&
    sameIds(selection.moduleIds, syncTarget.moduleIds) &&
    sameIds(selection.flowIds, syncTarget.flowIds)
  ) {
    selectionSyncTarget.current = null;
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
      latestSelection.current = nextSelection;
      selectionRevision.current += 1;
      selectionSyncTarget.current = nextSelection;
      onSelectionChange(nextSelection);
      setAnnouncement(selectionAnnouncement(document, nextSelection));
    },
    [document, onSelectionChange],
  );

  const fitMap = useCallback(() => {
    void flow.fitView({ padding: 0.16, duration: cameraDuration(180) });
  }, [flow]);

  useEffect(() => {
    if (!presenting) return;
    const fitPresentation = () => {
      void flow.fitView({ padding: 0.08, duration: cameraDuration(220) });
    };
    fitPresentation();
    window.addEventListener("resize", fitPresentation);
    return () => window.removeEventListener("resize", fitPresentation);
  }, [document.id, flow, presenting]);

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
      if (selectionSyncTarget.current) return;

      const emittedModuleIds = selectedNodes.map((node) => node.id);
      const emittedFlowIds = selectedEdges
        .map((edge) => edge.id)
        .filter((id) => visibleFlowIds.has(id));
      const intent = additiveNodeIntent.current;
      const current = latestSelection.current;
      const intentMatches =
        intent !== null &&
        intent.revision === selectionRevision.current &&
        emittedModuleIds.includes(intent.moduleId);
      additiveNodeIntent.current = null;
      const nextSelection = intentMatches
        ? {
            moduleIds: [...new Set([...current.moduleIds, ...emittedModuleIds, intent.moduleId])],
            flowIds: [
              ...new Set([
                ...current.flowIds.filter((id) => visibleFlowIds.has(id)),
                ...emittedFlowIds,
              ]),
            ],
          }
        : { moduleIds: emittedModuleIds, flowIds: emittedFlowIds };
      if (
        sameIds(nextSelection.moduleIds, current.moduleIds) &&
        sameIds(nextSelection.flowIds, current.flowIds)
      ) {
        return;
      }
      applySelection(nextSelection);
    },
    [applySelection, visibleFlowIds],
  );

  const handlePointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.shiftKey || !(event.target instanceof HTMLElement)) {
      selectionSyncTarget.current = null;
      additiveNodeIntent.current = null;
      return;
    }
    const node = event.target.closest<HTMLElement>(".react-flow__node[data-id]");
    const moduleId = node?.dataset.id;
    if (!moduleId) return;
    selectionSyncTarget.current = null;
    additiveNodeIntent.current = { moduleId, revision: selectionRevision.current };
  }, []);

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

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        editor?.createConnection(connection.source, connection.target);
      }
    },
    [editor],
  );

  const handleReconnect = useCallback<OnReconnect<MoneyMapCanvasEdge>>(
    (edge, connection) => {
      if (connection.source && connection.target) {
        editor?.reconnectRelationship(edge.id, {
          source: connection.source,
          target: connection.target,
        });
      }
    },
    [editor],
  );
  const clearSelection = useCallback(() => {
    additiveNodeIntent.current = null;
    applySelection({ moduleIds: [], flowIds: [] });
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
  }, [applySelection]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target) || event.nativeEvent.isComposing) return;

      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLocaleLowerCase() === "k") {
          event.preventDefault();
          editor?.openPalette(event.currentTarget);
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

      const command = matchCommandShortcut(event, editor?.availableCommands ?? []);
      if (command) {
        event.preventDefault();
        editor?.executeCommand(command.id);
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
      className={`money-map-canvas${presenting ? " money-map-canvas--presentation" : ""}`}
      tabIndex={presenting ? -1 : 0}
      aria-label={`${document.title} ${presenting ? "presentation" : "authoring"} canvas`}
      onKeyDown={presenting ? undefined : handleKeyDown}
      onPointerDownCapture={presenting ? undefined : handlePointerDownCapture}
    >
      <ReactFlow<MoneyMapCanvasNode, MoneyMapCanvasEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={presenting ? undefined : handleNodesChange}
        onEdgesChange={presenting ? undefined : handleEdgesChange}
        onSelectionChange={presenting ? undefined : handleFlowSelectionChange}
        onNodeDragStop={presenting ? undefined : handleNodeDragStop}
        onConnect={presenting ? undefined : handleConnect}
        onReconnect={presenting ? undefined : handleReconnect}
        onViewportChange={(viewport) => setZoomPercentage(Math.round(viewport.zoom * 100))}
        minZoom={0.3}
        maxZoom={2}
        fitView={presenting}
        fitViewOptions={presenting ? { padding: 0.08 } : undefined}
        zoomOnScroll={!presenting}
        zoomOnPinch={!presenting}
        panOnDrag={presenting ? false : [0, 1]}
        panActivationKeyCode={presenting ? null : "Space"}
        selectionKeyCode={presenting ? null : "Shift"}
        multiSelectionKeyCode="Shift"
        selectionOnDrag={false}
        nodesDraggable={!presenting}
        elementsSelectable={!presenting}
        nodesConnectable={!presenting}
        connectionMode={ConnectionMode.Loose}
        edgesReconnectable={!presenting}
        reconnectRadius={26}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: presenting }}
      />
      {presenting ? null : (
        <CanvasControls controller={controller} zoomPercentage={zoomPercentage} />
      )}
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
