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
  beginInlineEdit(target: InlineEditTarget): void;
  commitInlineEdit(exact: string): void;
  cancelInlineEdit(): void;
  executeCommand(id: string): void;
  openPalette(invoker: HTMLElement): void;
  nudgeSelected(delta: Point): void;
  commitModuleWidth(moduleId: string, width: number): void;
  commitModuleMove(moduleId: string, position: Point): void;
}

export const EditorInteractionContext = createContext<EditorInteraction | null>(null);

export function useEditorInteraction(): EditorInteraction | null {
  return useContext(EditorInteractionContext);
}
