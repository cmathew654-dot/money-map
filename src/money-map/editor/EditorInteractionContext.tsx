import { createContext, useContext } from "react";

import type { Point } from "../model/types";
import type { WorkspaceCommandDefinition } from "./commands";

export type InlineEditTarget =
  | { moduleId: string; field: "title" | "eyebrow" | "subtitle" | "note"; original: string }
  | { moduleId: string; field: "row-label" | "row-value"; rowId: string; original: string }
  | { moduleId: string; field: "total-label" | "total-value"; original: string };

export interface EditorInteraction {
  selectionCount: number;
  announcement: string;
  selectedModuleIds: string[];
  availableCommands: WorkspaceCommandDefinition[];
  activeInlineField: InlineEditTarget | null;
  activeFlowId: string | null;
  beginInlineEdit(target: InlineEditTarget): void;
  commitInlineEdit(exact: string): void;
  cancelInlineEdit(): void;
  beginFlowEdit(flowId: string): void;
  cancelFlowEdit(): void;
  commitFlowEdit(flowId: string, exact: string): void;
  selectFlow(flowId: string): void;
  commitFlowLabelPosition(flowId: string, point: Point): void;
  commitFlowWaypoint(flowId: string, point: Point): void;
  executeCommand(id: string): void;
  openPalette(invoker: HTMLElement): void;
  nudgeSelected(delta: Point): void;
  commitModuleSize(moduleId: string, size: { width: number; height: number }): void;
  commitModuleMove(moduleId: string, position: Point): void;
  createConnection(source: string, target: string): void;
  reconnectRelationship(flowId: string, connection: { source: string; target: string }): void;
}

export const EditorInteractionContext = createContext<EditorInteraction | null>(null);

export function useEditorInteraction(): EditorInteraction | null {
  return useContext(EditorInteractionContext);
}
