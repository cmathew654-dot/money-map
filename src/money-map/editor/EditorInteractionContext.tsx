import { createContext, useContext } from "react";

import type { Point } from "../model/types";
import type { WorkspaceCommandDefinition } from "./commands";

export type InlineEditTarget =
  | { moduleId: string; field: "title"; original: string }
  | { moduleId: string; field: "row-value"; rowId: string; original: string }
  | { moduleId: string; field: "total-value"; original: string };

export interface EditorInteraction {
  selectionCount: number;
  announcement: string;
  selectedModuleIds: string[];
  availableCommands: WorkspaceCommandDefinition[];
  activeInlineField: InlineEditTarget | null;
  activeFlowId: string | null;
  connectMode: boolean;
  beginInlineEdit(target: InlineEditTarget): void;
  commitInlineEdit(exact: string): void;
  cancelInlineEdit(): void;
  beginFlowEdit(flowId: string): void;
  cancelFlowEdit(): void;
  commitFlowEdit(flowId: string, exact: string): void;
  selectFlow(flowId: string): void;
  commitFlowWaypoint(flowId: string, point: Point): void;
  executeCommand(id: string): void;
  openPalette(invoker: HTMLElement): void;
  nudgeSelected(delta: Point): void;
  commitModuleWidth(moduleId: string, width: number): void;
  commitModuleMove(moduleId: string, position: Point): void;
  createConnection(source: string, target: string): void;
  reconnectRelationship(flowId: string, connection: { source: string; target: string }): void;
}

export const EditorInteractionContext = createContext<EditorInteraction | null>(null);

export function useEditorInteraction(): EditorInteraction | null {
  return useContext(EditorInteractionContext);
}
