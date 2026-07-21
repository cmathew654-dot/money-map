import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";

import { moveModules, updateModule } from "../model/document";
import { flowAttachmentPoint } from "../model/flowLabel";
import { clampModuleSize } from "../model/moduleSizing";
export { clampModuleSize, MAX_MODULE_SIZE, minimumModuleSize } from "../model/moduleSizing";
import type {
  MoneyMapDocument,
  CadenceView,
  MoneyMapFlow,
  MoneyMapModule,
  Point,
  PresentationStep,
  Selection,
} from "../model/types";

export type CadenceFilter = CadenceView;

export interface MoneyMapEdgeHandlers {
  beginEdit(): void;
  cancelEdit(): void;
  commitEdit(literal: string): void;
  moveLabelPosition(clientPoint: Point): void;
  nudgeLabelPosition(point: Point): void;
  moveWaypointPosition(clientPoint: Point): void;
  nudgeWaypointPosition(point: Point): void;
  select(): void;
}

export interface MoneyMapNodeData extends Record<string, unknown> {
  module: MoneyMapModule;
  outgoingCount: number;
  selectionCount: number;
  selectionModuleIds: string[];
  haloAnchor: boolean;
  reconnectMode: boolean;
  connectMode: boolean;
  presentation?: boolean;
  presentationFocus?: boolean;
  presentationDim?: boolean;
}

export interface MoneyMapEdgeData extends Record<string, unknown> {
  flow: MoneyMapFlow;
  editing?: boolean;
  handlers?: MoneyMapEdgeHandlers;
  presentation?: boolean;
  presentationFocus?: boolean;
  presentationDim?: boolean;
}

function presentationStepHasMembers(step?: PresentationStep): boolean {
  return Boolean(step) && (step!.moduleIds.length > 0 || step!.flowIds.length > 0);
}

export type MoneyMapCanvasEdge = Edge<MoneyMapEdgeData, "moneyMapRelationship">;

function moduleCenter(module: MoneyMapModule): Point {
  return {
    x: module.position.x + module.width / 2,
    y: module.position.y + module.height / 2,
  };
}

function handleToward(module: MoneyMapModule, point: Point, kind: "source" | "target"): string {
  const attachment = flowAttachmentPoint(module, point);
  const position =
    attachment.x === module.position.x
      ? Position.Left
      : attachment.x === module.position.x + module.width
        ? Position.Right
        : attachment.y === module.position.y
          ? Position.Top
          : Position.Bottom;
  return kind + "-" + position;
}

function relationshipHandles(
  document: MoneyMapDocument,
  flow: MoneyMapFlow,
): Pick<MoneyMapCanvasEdge, "sourceHandle" | "targetHandle"> {
  const source = document.modules.find((module) => module.id === flow.source);
  const target = document.modules.find((module) => module.id === flow.target);
  if (!source || !target) return {};
  return {
    sourceHandle: handleToward(source, flow.waypoints[0] ?? moduleCenter(target), "source"),
    targetHandle: handleToward(target, flow.waypoints.at(-1) ?? moduleCenter(source), "target"),
  };
}

export function cadenceMatchesFilter(flow: MoneyMapFlow, filter: CadenceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "monthly" || filter === "annual") return flow.cadence.kind === filter;
  return flow.cadence.kind !== "monthly" && flow.cadence.kind !== "annual";
}

export function selectionForCadence(
  document: MoneyMapDocument,
  selection: Selection,
  filter: CadenceFilter,
): Selection {
  if (filter === "all") return selection;
  const visibleIds = new Set(
    document.flows.filter((flow) => cadenceMatchesFilter(flow, filter)).map(({ id }) => id),
  );
  const flowIds = selection.flowIds.filter((id) => visibleIds.has(id));
  return flowIds.length === selection.flowIds.length
    ? selection
    : { moduleIds: selection.moduleIds, flowIds };
}
export function moduleAriaLabel(module: MoneyMapModule, outgoingCount: number): string {
  const parts = [`Kind: ${module.kind}`, `Title: ${module.title}`];
  if (module.subtitle) parts.push(`Subtitle: ${module.subtitle}`);
  if (module.total) parts.push(`Total: ${module.total.label} ${module.total.value}`);
  const relationshipPhrase =
    outgoingCount === 1 ? "1 outgoing relationship" : `${outgoingCount} outgoing relationships`;
  return [...parts, relationshipPhrase].join(" | ");
}

export function documentToNodes(
  document: MoneyMapDocument,
  selection: Selection,
  presentationStep?: PresentationStep,
  connectMode = false,
): Node<MoneyMapNodeData>[] {
  const selected = new Set(selection.moduleIds);
  const reconnectMode = selection.moduleIds.length === 0 && selection.flowIds.length === 1;
  const haloAnchorId = selection.moduleIds.find((id) =>
    document.modules.some((module) => module.id === id),
  );
  const stepFocused = presentationStepHasMembers(presentationStep);

  return document.modules.map((module) => {
    const outgoingCount = document.flows.filter((flow) => flow.source === module.id).length;
    const inStep = presentationStep?.moduleIds.includes(module.id) ?? false;
    return {
      id: module.id,
      type: "moneyMapModule",
      position: module.position,
      data: {
        module,
        outgoingCount,
        selectionCount: selection.moduleIds.length + selection.flowIds.length,
        selectionModuleIds: selection.moduleIds,
        haloAnchor: module.id === haloAnchorId,
        reconnectMode,
        connectMode,
        presentation: Boolean(presentationStep),
        presentationFocus: inStep,
        presentationDim: stepFocused && !inStep,
      },
      style: { width: module.width, height: module.height, zIndex: module.zIndex },
      selected: selected.has(module.id),
      draggable: !presentationStep,
      selectable: !presentationStep,
      focusable: !presentationStep,
      ariaLabel: moduleAriaLabel(module, outgoingCount),
    };
  });
}

export function documentToEdges(
  document: MoneyMapDocument,
  selection: Selection,
  filter: CadenceFilter = "all",
  presentationStep?: PresentationStep,
): MoneyMapCanvasEdge[] {
  const selected = new Set(selection.flowIds);
  const reconnectableId =
    selection.moduleIds.length === 0 && selection.flowIds.length === 1
      ? selection.flowIds[0]
      : null;
  const stepFocused = presentationStepHasMembers(presentationStep);

  return document.flows.map((flow) => {
    const inStep = presentationStep?.flowIds.includes(flow.id) ?? false;
    const dim = stepFocused && !inStep;
    return {
      id: flow.id,
      source: flow.source,
      target: flow.target,
      ...relationshipHandles(document, flow),
      type: "moneyMapRelationship",
      data: {
        flow,
        presentation: Boolean(presentationStep),
        presentationFocus: inStep,
        presentationDim: dim,
      },
      selected: selected.has(flow.id),
      selectable: !presentationStep,
      // The route path is deliberately NOT a tab stop. It used to be, which
      // gave every relationship two consecutive stops announcing the exact
      // same sentence (verified: stops 7-13 were paths, 14-20 their labels,
      // aria-label identical), so a screen-reader user had no way to tell
      // which stop was the route and which was the label — and modules on
      // Retirement Income did not begin until stop 21. Nothing is lost: the
      // label button is the relationship's keyboard surface and already
      // handles select, Enter to edit, and arrow-key movement, with the
      // route handle reachable once selected.
      focusable: false,
      reconnectable: !presentationStep && flow.id === reconnectableId,
      hidden: !cadenceMatchesFilter(flow, filter),
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      ariaLabel: `${flow.relationship} relationship from ${flow.source} to ${flow.target}: ${flow.label}; ${flow.cadence.label}`,
      className: `money-map-edge money-map-edge--${flow.relationship}${
        inStep ? " presentation-focus" : ""
      }${dim ? " presentation-dim" : ""}`,
    };
  });
}

export function moveModule(
  document: MoneyMapDocument,
  moduleId: string,
  position: Point,
): MoneyMapDocument {
  return moveModules(document, new Map([[moduleId, position]]));
}
export function resizeModule(
  document: MoneyMapDocument,
  moduleId: string,
  size: { width: number; height: number },
): MoneyMapDocument {
  const module = document.modules.find(({ id }) => id === moduleId);
  if (!module || module.rotation !== 0) return document;
  const next = clampModuleSize(module, size);
  return updateModule(document, moduleId, (current) =>
    current.width === next.width && current.height === next.height
      ? current
      : { ...current, ...next },
  );
}
