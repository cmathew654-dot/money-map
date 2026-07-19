import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";

import { updateModule } from "../model/document";
import type {
  MoneyMapDocument,
  MoneyMapFlow,
  MoneyMapModule,
  Point,
  PresentationStep,
  Selection,
} from "../model/types";

export type CadenceFilter = "all" | "monthly" | "annual" | "other";

export interface MoneyMapEdgeHandlers {
  beginEdit(): void;
  cancelEdit(): void;
  commitEdit(literal: string): void;
  moveWaypoint(clientPoint: Point): void;
  nudgeWaypoint(delta: Point): void;
  select(): void;
}

export interface MoneyMapNodeData extends Record<string, unknown> {
  module: MoneyMapModule;
  outgoingCount: number;
  selectionCount: number;
  selectionModuleIds: string[];
  haloAnchor: boolean;
  connectMode: boolean;
  reconnectMode: boolean;
  presentation?: boolean;
  presentationFocus?: boolean;
}

export interface MoneyMapEdgeData extends Record<string, unknown> {
  flow: MoneyMapFlow;
  editing?: boolean;
  handlers?: MoneyMapEdgeHandlers;
  presentation?: boolean;
  presentationFocus?: boolean;
}

export type MoneyMapCanvasEdge = Edge<MoneyMapEdgeData, "moneyMapRelationship">;

function moduleHorizontalCenter(module: MoneyMapModule): number {
  return module.position.x + module.width / 2;
}

function horizontalHandleToward(
  module: MoneyMapModule,
  pointX: number,
  kind: "source" | "target",
): string {
  const deltaX = pointX - moduleHorizontalCenter(module);
  const position =
    deltaX === 0
      ? kind === "source"
        ? Position.Right
        : Position.Left
      : deltaX > 0
        ? Position.Right
        : Position.Left;
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
    sourceHandle: horizontalHandleToward(
      source,
      flow.waypoints[0]?.x ?? moduleHorizontalCenter(target),
      "source",
    ),
    targetHandle: horizontalHandleToward(
      target,
      flow.waypoints.at(-1)?.x ?? moduleHorizontalCenter(source),
      "target",
    ),
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
  connectMode = false,
  presentationStep?: PresentationStep,
): Node<MoneyMapNodeData>[] {
  const selected = new Set(selection.moduleIds);
  const reconnectMode = selection.moduleIds.length === 0 && selection.flowIds.length === 1;
  const haloAnchorId = selection.moduleIds.find((id) =>
    document.modules.some((module) => module.id === id),
  );

  return document.modules.map((module) => {
    const outgoingCount = document.flows.filter((flow) => flow.source === module.id).length;
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
        connectMode,
        reconnectMode,
        presentation: Boolean(presentationStep),
        presentationFocus: presentationStep?.moduleIds.includes(module.id) ?? false,
      },
      style: { width: module.width },
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

  return document.flows.map((flow) => ({
    id: flow.id,
    source: flow.source,
    target: flow.target,
    ...relationshipHandles(document, flow),
    type: "moneyMapRelationship",
    data: {
      flow,
      presentation: Boolean(presentationStep),
      presentationFocus: presentationStep?.flowIds.includes(flow.id) ?? false,
    },
    selected: selected.has(flow.id),
    selectable: !presentationStep,
    focusable: !presentationStep,
    reconnectable: !presentationStep && flow.id === reconnectableId,
    hidden: !cadenceMatchesFilter(flow, filter),
    markerEnd:
      flow.relationship === "association"
        ? undefined
        : { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    ariaLabel: `${flow.relationship} relationship from ${flow.source} to ${flow.target}: ${flow.label}; ${flow.cadence.label}`,
    className: `money-map-edge money-map-edge--${flow.relationship}${
      presentationStep?.flowIds.includes(flow.id) ? " presentation-focus" : ""
    }`,
  }));
}

export function moveModule(
  document: MoneyMapDocument,
  moduleId: string,
  position: Point,
): MoneyMapDocument {
  return updateModule(document, moduleId, (module) => ({
    ...module,
    position: { x: position.x, y: position.y },
  }));
}
export const MIN_MODULE_WIDTH = 220;
export const MAX_MODULE_WIDTH = 480;

export function clampModuleWidth(width: number): number {
  return Math.min(MAX_MODULE_WIDTH, Math.max(MIN_MODULE_WIDTH, width));
}

export function resizeModule(
  document: MoneyMapDocument,
  moduleId: string,
  width: number,
): MoneyMapDocument {
  const nextWidth = clampModuleWidth(width);
  return updateModule(document, moduleId, (module) =>
    module.width === nextWidth ? module : { ...module, width: nextWidth },
  );
}
