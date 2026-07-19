import type { Edge, Node } from "@xyflow/react";

import { updateModule } from "../model/document";
import type {
  MoneyMapDocument,
  MoneyMapFlow,
  MoneyMapModule,
  Point,
  Selection,
} from "../model/types";

export interface MoneyMapNodeData extends Record<string, unknown> {
  module: MoneyMapModule;
  outgoingCount: number;
  selectionCount: number;
  selectionModuleIds: string[];
  haloAnchor: boolean;
}

export interface MoneyMapEdgeData extends Record<string, unknown> {
  flow: MoneyMapFlow;
}

const routeTypes = {
  straight: "straight",
  orthogonal: "step",
  curved: "default",
} as const;

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
        selectionCount: selection.moduleIds.length,
        selectionModuleIds: selection.moduleIds,
        haloAnchor: module.id === haloAnchorId,
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
): Edge<MoneyMapEdgeData>[] {
  const selected = new Set(selection.flowIds);

  return document.flows.map((flow) => ({
    id: flow.id,
    source: flow.source,
    target: flow.target,
    type: routeTypes[flow.route],
    label: flow.label,
    data: { flow },
    selected: selected.has(flow.id),
    selectable: true,
    focusable: true,
    ariaLabel: `${flow.relationship} relationship: ${flow.label}`,
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
