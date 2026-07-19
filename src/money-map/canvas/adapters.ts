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
}

export interface MoneyMapEdgeData extends Record<string, unknown> {
  flow: MoneyMapFlow;
}

const routeTypes = {
  straight: "straight",
  orthogonal: "step",
  curved: "default",
} as const;

function sentence(value: string): string {
  return value.endsWith(".") ? value : `${value}.`;
}

export function moduleAriaLabel(module: MoneyMapModule, outgoingCount: number): string {
  const kind = module.kind.charAt(0).toLocaleUpperCase() + module.kind.slice(1);
  const parts = [sentence(kind), sentence(module.title)];
  if (module.subtitle) parts.push(sentence(module.subtitle));
  if (module.total) parts.push(sentence(`${module.total.label}: ${module.total.value}`));
  const noun = outgoingCount === 1 ? "relationship" : "relationships";
  parts.push(`${outgoingCount} outgoing ${noun}.`);
  return parts.join(" ");
}

export function documentToNodes(
  document: MoneyMapDocument,
  selection: Selection,
): Node<MoneyMapNodeData>[] {
  const selected = new Set(selection.moduleIds);

  return document.modules.map((module) => {
    const outgoingCount = document.flows.filter((flow) => flow.source === module.id).length;
    return {
      id: module.id,
      type: "moneyMapModule",
      position: module.position,
      data: { module, outgoingCount },
      style: { width: module.width },
      initialWidth: module.width,
      initialHeight: 152,
      measured: { width: module.width, height: 152 },
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
