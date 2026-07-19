import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  commitHistory,
  createHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from "../model/history";
import { clearDraft, loadDraft, saveDraft, type StorageLike } from "../model/persistence";
import type { MoneyMapDocument, Selection, StarterId } from "../model/types";
import { createStarterDocument } from "../starters/registry";
import {
  createWorkspaceCommands,
  type WorkspaceCommandContext,
  type WorkspaceCommandResult,
} from "./commands";

const emptySelection: Selection = { moduleIds: [], flowIds: [] };

interface EditorOptions {
  storage?: StorageLike;
  createId?: (kind: string) => string;
}

function defaultCreateId(kind: string): string {
  return `${kind}-${crypto.randomUUID()}`;
}

function validSelection(document: MoneyMapDocument, selection: Selection): Selection {
  const modules = new Set(document.modules.map(({ id }) => id));
  const flows = new Set(document.flows.map(({ id }) => id));
  const moduleIds = selection.moduleIds.filter((id) => modules.has(id));
  const flowIds = selection.flowIds.filter((id) => flows.has(id));
  if (
    moduleIds.length === selection.moduleIds.length &&
    flowIds.length === selection.flowIds.length
  ) {
    return selection;
  }
  return { moduleIds, flowIds };
}

export function useMoneyMapEditor(starterId: StarterId, options: EditorOptions = {}) {
  const storage = options.storage ?? window.localStorage;
  const createId = options.createId ?? defaultCreateId;
  const scaffold = createStarterDocument(starterId);
  const [activeStarter, setActiveStarter] = useState(starterId);
  const [history, setHistory] = useState<HistoryState<MoneyMapDocument>>(() =>
    createHistory(loadDraft(storage, starterId, scaffold)),
  );
  const historyRef = useRef(history);
  historyRef.current = history;
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [announcement, setAnnouncement] = useState("");
  const [lastHistoryStep, setLastHistoryStep] = useState<string | null>(null);
  const registry = useMemo(() => createWorkspaceCommands(createId), [createId]);

  useEffect(() => {
    if (activeStarter === starterId) return;
    setActiveStarter(starterId);
    const nextHistory = createHistory(
      loadDraft(storage, starterId, createStarterDocument(starterId)),
    );
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    setSelection(emptySelection);
    setAnnouncement("");
    setLastHistoryStep(null);
  }, [activeStarter, starterId, storage]);

  const applyDocument = useCallback(
    (
      nextDocument: MoneyMapDocument,
      nextAnnouncement: string,
      historyName = "document mutation",
    ) => {
      const current = historyRef.current;
      if (nextDocument === current.present) return;
      const next = commitHistory(current, nextDocument);
      historyRef.current = next;
      setHistory(next);
      saveDraft(storage, nextDocument);
      setSelection((currentSelection) => validSelection(nextDocument, currentSelection));
      setAnnouncement(nextAnnouncement);
      setLastHistoryStep(historyName);
    },
    [storage],
  );

  const undo = useCallback(() => {
    const current = historyRef.current;
    const next = undoHistory(current);
    if (next === current) return;
    historyRef.current = next;
    setHistory(next);
    saveDraft(storage, next.present);
    setSelection((currentSelection) => validSelection(next.present, currentSelection));
    setAnnouncement("Undo complete.");
  }, [storage]);

  const redo = useCallback(() => {
    const current = historyRef.current;
    const next = redoHistory(current);
    if (next === current) return;
    historyRef.current = next;
    setHistory(next);
    saveDraft(storage, next.present);
    setSelection((currentSelection) => validSelection(next.present, currentSelection));
    setAnnouncement("Redo complete.");
  }, [storage]);

  const reset = useCallback(() => {
    clearDraft(storage, starterId);
    const nextHistory = createHistory(createStarterDocument(starterId));
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    setSelection(emptySelection);
    setAnnouncement("Starter scaffold restored.");
    setLastHistoryStep(null);
  }, [starterId, storage]);

  const commandContext: WorkspaceCommandContext = {
    document: history.present,
    selection,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };

  const executeCommand = useCallback(
    (id: string): WorkspaceCommandResult | undefined => {
      const command = registry.get(id);
      if (!command || !command.isAvailable(commandContext)) return undefined;
      const result = command.execute(commandContext);
      if (result.kind === "mutation") {
        applyDocument(result.mutation.document, result.mutation.announcement, command.label);
        if (result.nextSelection) setSelection(result.nextSelection);
      } else if (result.kind === "history") {
        if (result.action === "undo") undo();
        else redo();
      } else if (result.kind === "reset") {
        reset();
      }
      return result;
    },
    [applyDocument, commandContext, redo, registry, reset, undo],
  );

  return {
    document: history.present,
    selection,
    setSelection,
    announcement,
    setAnnouncement,
    lastHistoryStep,
    registry,
    commandContext,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    applyDocument,
    undo,
    redo,
    reset,
    executeCommand,
  };
}
