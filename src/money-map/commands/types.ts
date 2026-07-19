import type { MoneyMapDocument, Selection } from "../model/types";

export interface CommandContext {
  document: MoneyMapDocument;
  selection: Selection;
}

export interface EditorMutation {
  document: MoneyMapDocument;
  announcement: string;
}

export interface EditorCommand {
  id: string;
  label: string;
  keywords: string[];
  shortcut?: string;
  isAvailable(context: CommandContext): boolean;
  execute(context: CommandContext): EditorMutation;
}
