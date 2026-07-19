import { MarkerType, type Edge, type Node } from "@xyflow/react";

import { updateModule } from "../model/document";
import type {
  MoneyMapDocument,
  MoneyMapFlow,
  MoneyMapModule,
  Point,
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
}

export interface MoneyMapEdgeData extends Record<string, unknown> {
  flow: MoneyMapFlow;
  editing?: boolean;
  handlers?: MoneyMapEdgeHandlers;
}

export type MoneyMapCanvasEdge = Edge<MoneyMapEdgeData, "moneyMapRelationship">;

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
): Node<MoneyMapNodeData>[] {
  const selected = new Set(selection.moduleIds);
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
      },
      style: { width: module.width },
      selected: selected.has(module.id),
      focusable: true,
      ariaLabel: moduleAriaLabel(module, outgoingCount),
    };
  });
}

export function documentToEdges(
  document: MoneyMapDocument,
  selection: Selection,
  filter: CadenceFilter = "all",
): MoneyMapCanvasEdge[] {
  const selected = new Set(selection.flowIds);

  return document.flows.map((flow) => ({
    id: flow.id,
    source: flow.source,
    target: flow.target,
    type: "moneyMapRelationship",
    data: { flow },
    selected: selected.has(flow.id),
    selectable: true,
    focusable: true,
    reconnectable: true,
    hidden: !cadenceMatchesFilter(flow, filter),
    markerEnd:
      flow.relationship === "association"
        ? undefined
        : { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    ariaLabel: `${flow.relationship} relationship from ${flow.source} to ${flow.target}: ${flow.label}; ${flow.cadence.label}`,
    className: `money-map-edge money-map-edge--${flow.relationship}`,
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
