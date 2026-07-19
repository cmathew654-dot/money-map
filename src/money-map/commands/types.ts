import type { MoneyMapDocument, Selection } from "../model/types";

export interface CommandDefinition<Context, Result> {
  id: string;
  label: string;
  keywords: string[];
  shortcut?: string;
  shortcutAliases?: string[];
  isAvailable(context: Context): boolean;
  execute(context: Context): Result;
}

export interface CommandContext {
  document: MoneyMapDocument;
  selection: Selection;
}

export interface EditorMutation {
  document: MoneyMapDocument;
  announcement: string;
}

export type EditorCommand = CommandDefinition<CommandContext, EditorMutation>;
