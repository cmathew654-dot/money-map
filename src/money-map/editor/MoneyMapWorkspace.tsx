import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import {
  selectionForCadence,
  moveModule,
  resizeModule,
  type CadenceFilter as CadenceFilterValue,
} from "../canvas/adapters";
import { MoneyMapCanvas } from "../canvas/MoneyMapCanvas";
import type { Point, StarterId } from "../model/types";
import { getCanvasTheme } from "../themes/registry";
import { AdvancedProperties, type PropertyField } from "./AdvancedProperties";
import { CommandPalette } from "./CommandPalette";
import { CadenceFilter } from "./CadenceFilter";
import { matchCommandShortcut } from "./commandShortcuts";
import {
  EditorInteractionContext,
  type EditorInteraction,
  type InlineEditTarget,
} from "./EditorInteractionContext";
import {
  createRelationship,
  editFlowField,
  editModuleField,
  moveFlowWaypoint,
  nudgeSelection,
  reconnectFlow,
  type FlowField,
} from "./mutations";
import { RelationshipProperties } from "./RelationshipProperties";
import { positionEditorSurface, type EditorSurfacePosition } from "./surfacePosition";
import { useMoneyMapEditor } from "./useMoneyMapEditor";

interface MoneyMapWorkspaceProps {
  starterId: StarterId;
  onBack(): void;
}

interface Dimensions {
  width: number;
  height: number;
}

const authoringMinimum = { width: 1180, height: 660 };
const relationshipSurfaceSize = { width: 368, height: 604 };

export function isAuthoringViewportSupported(width: number, height: number): boolean {
  return width >= authoringMinimum.width && height >= authoringMinimum.height;
}

function initialDimensions(): Dimensions {
  if (typeof window === "undefined") return authoringMinimum;
  return { width: window.innerWidth, height: window.innerHeight };
}

function useWorkspaceDimensions() {
  const ref = useRef<HTMLElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>(initialDimensions);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        setDimensions({ width: bounds.width, height: bounds.height });
      } else {
        setDimensions(initialDimensions());
      }
    };

    measure();
    window.addEventListener("resize", measure);
    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(([entry]) => {
      setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return { ref, dimensions };
}

function isInteractiveControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("button, a, [role='tab'], [role='option'], [role='combobox']"))
  );
}

function isTextControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  );
}

export function MoneyMapWorkspace({ starterId, onBack }: MoneyMapWorkspaceProps) {
  const editor = useMoneyMapEditor(starterId);
  const theme = getCanvasTheme(editor.document.style);
  const [activeInlineField, setActiveInlineField] = useState<InlineEditTarget | null>(null);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilterValue>("all");
  const [paletteInvoker, setPaletteInvoker] = useState<HTMLElement | null>(null);
  const [propertiesTab, setPropertiesTab] = useState<
    "content" | "appearance" | "connections" | null
  >(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [surfacePosition, setSurfacePosition] = useState<EditorSurfacePosition | null>(null);
  const actionsRef = useRef<HTMLButtonElement>(null);
  const styleRef = useRef<HTMLElement>(null);
  const { ref, dimensions } = useWorkspaceDimensions();
  const supported = isAuthoringViewportSupported(dimensions.width, dimensions.height);
  const selectedModuleId =
    editor.selection.moduleIds.length === 1 && editor.selection.flowIds.length === 0
      ? editor.selection.moduleIds[0]
      : null;
  const selectedFlowId =
    editor.selection.flowIds.length === 1 && editor.selection.moduleIds.length === 0
      ? editor.selection.flowIds[0]
      : null;
  const connectMode = propertiesTab === "connections" && selectedModuleId !== null;
  const availableCommands = editor.registry.available(editor.commandContext);
  const appearanceCommands = availableCommands.filter(
    ({ id }) => id.startsWith("module.primitive.") || id.startsWith("module.width."),
  );
  const primitiveCommands = appearanceCommands.filter(({ id }) =>
    id.startsWith("module.primitive."),
  );
  const relationshipCommands = availableCommands.filter(({ id }) => id.startsWith("flow."));

  useEffect(() => {
    if (selectedModuleId) return;
    setPropertiesTab(null);
    setStyleOpen(false);
  }, [selectedModuleId]);

  useEffect(() => {
    if (activeInlineField && !editor.selection.moduleIds.includes(activeInlineField.moduleId)) {
      setActiveInlineField(null);
    }
  }, [activeInlineField, editor.selection.moduleIds]);
  useEffect(() => {
    if (selectedFlowId) return;
    setActiveFlowId(null);
    setRelationshipOpen(false);
  }, [selectedFlowId]);
  useEffect(() => {
    const nextSelection = selectionForCadence(editor.document, editor.selection, cadenceFilter);
    if (nextSelection === editor.selection) return;
    setActiveFlowId(null);
    setRelationshipOpen(false);
    editor.setSelection(nextSelection);
  }, [cadenceFilter, editor.document, editor.selection, editor.setSelection]);

  const placeSurface = useCallback(() => {
    if (!selectedModuleId) return;
    const node = document.querySelector<HTMLElement>(
      `.react-flow__node[data-id="${selectedModuleId}"]`,
    );
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    setSurfacePosition(
      positionEditorSurface(bounds, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    );
  }, [selectedModuleId]);
  const placeFlowSurface = useCallback(() => {
    if (!selectedFlowId) return;
    const label = document.querySelector<HTMLElement>(`[data-flow-label-id="${selectedFlowId}"]`);
    if (!label) return;
    setSurfacePosition(
      positionEditorSurface(
        label.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        relationshipSurfaceSize,
      ),
    );
  }, [selectedFlowId]);

  const beginSelectedTitle = useCallback(() => {
    if (!selectedModuleId) return;
    const module = editor.document.modules.find(({ id }) => id === selectedModuleId);
    if (module) {
      setActiveInlineField({
        moduleId: module.id,
        field: "title",
        original: module.title,
      });
    }
  }, [editor.document.modules, selectedModuleId]);

  const executeCommand = useCallback(
    (id: string) => {
      const result = editor.executeCommand(id);
      if (result?.kind !== "surface") return;
      if (result.surface === "inline") {
        setPropertiesTab(null);
        setStyleOpen(false);
        setRelationshipOpen(false);
        beginSelectedTitle();
        return;
      }
      if (result.surface === "flow-inline") {
        setPropertiesTab(null);
        setStyleOpen(false);
        setRelationshipOpen(false);
        if (selectedFlowId) setActiveFlowId(selectedFlowId);
        return;
      }
      if (result.surface === "flow-properties") {
        placeFlowSurface();
        setPropertiesTab(null);
        setStyleOpen(false);
        setRelationshipOpen(true);
        return;
      }

      setRelationshipOpen(false);
      placeSurface();
      if (result.surface === "style") {
        setPropertiesTab(null);
        setStyleOpen(true);
      } else {
        setStyleOpen(false);
        setPropertiesTab(result.surface === "connections" ? "connections" : "content");
      }
    },
    [beginSelectedTitle, editor, placeFlowSurface, placeSurface, selectedFlowId],
  );
  const commitInlineEdit = useCallback(
    (literal: string) => {
      if (!activeInlineField) return;
      const target =
        activeInlineField.field === "row-value"
          ? { field: "row-value" as const, rowId: activeInlineField.rowId }
          : { field: activeInlineField.field };
      const next = editModuleField(editor.document, activeInlineField.moduleId, target, literal);
      editor.applyDocument(next, "Inline edit committed.", `edit ${activeInlineField.field}`);
      setActiveInlineField(null);
    },
    [activeInlineField, editor],
  );

  const commitPropertyField = useCallback(
    (moduleId: string, field: PropertyField, literal: string) => {
      const next = editModuleField(editor.document, moduleId, field, literal);
      editor.applyDocument(next, "Property updated.", `edit ${field.field}`);
    },
    [editor],
  );

  const commitModuleWidth = useCallback(
    (moduleId: string, width: number) => {
      const next = resizeModule(editor.document, moduleId, width);
      editor.applyDocument(next, "Module width updated.", "resize module");
    },
    [editor],
  );

  const commitModuleMove = useCallback(
    (moduleId: string, position: Point) => {
      const next = moveModule(editor.document, moduleId, position);
      editor.applyDocument(next, "Module moved.", "move module");
    },
    [editor],
  );

  const nudgeSelected = useCallback(
    (delta: Point) => {
      const next = nudgeSelection(editor.document, editor.selection, delta);
      editor.applyDocument(next, "Selection nudged.", "nudge selection");
    },
    [editor],
  );

  const focusFlowLabel = useCallback((flowId: string) => {
    const focus = (retry: boolean) => {
      const button = document.querySelector<HTMLElement>(`[data-flow-label-id="${flowId}"] button`);
      if (button) {
        button.focus();
      } else if (retry) {
        window.setTimeout(() => focus(false), 60);
      }
    };
    requestAnimationFrame(() => focus(true));
  }, []);

  const selectFlow = useCallback(
    (flowId: string) => editor.setSelection({ moduleIds: [], flowIds: [flowId] }),
    [editor],
  );

  const beginFlowEdit = useCallback(
    (flowId: string) => {
      selectFlow(flowId);
      setRelationshipOpen(false);
      setActiveFlowId(flowId);
    },
    [selectFlow],
  );

  const cancelFlowEdit = useCallback(() => {
    const flowId = activeFlowId;
    setActiveFlowId(null);
    if (flowId) focusFlowLabel(flowId);
  }, [activeFlowId, focusFlowLabel]);

  const commitFlowEdit = useCallback(
    (flowId: string, literal: string) => {
      const next = editFlowField(editor.document, flowId, { field: "label" }, literal);
      editor.applyDocument(next, "Relationship label updated.", "edit relationship label");
      setActiveFlowId(null);
      focusFlowLabel(flowId);
    },
    [editor, focusFlowLabel],
  );

  const commitFlowProperty = useCallback(
    (field: FlowField, literal: string) => {
      if (!selectedFlowId) return;
      const next = editFlowField(editor.document, selectedFlowId, field, literal);
      editor.applyDocument(next, "Relationship updated.", `edit relationship ${field.field}`);
    },
    [editor, selectedFlowId],
  );

  const commitFlowWaypoint = useCallback(
    (flowId: string, point: Point) => {
      const next = moveFlowWaypoint(editor.document, flowId, point);
      editor.applyDocument(next, "Relationship route updated.", "move relationship label");
      focusFlowLabel(flowId);
    },
    [editor, focusFlowLabel],
  );

  const reconnectRelationship = useCallback(
    (flowId: string, connection: { source: string; target: string }) => {
      const next = reconnectFlow(editor.document, flowId, connection);
      editor.applyDocument(next, "Relationship reconnected.", "reconnect relationship");
      focusFlowLabel(flowId);
    },
    [editor, focusFlowLabel],
  );

  const createConnection = useCallback(
    (source: string, target: string) => {
      const previousIds = new Set(editor.document.flows.map(({ id }) => id));
      const next = createRelationship(
        editor.document,
        source,
        target,
        () => `flow-${crypto.randomUUID()}`,
      );
      const created = next.flows.find(({ id }) => !previousIds.has(id));
      if (!created) return;
      editor.applyDocument(next, "Relationship created.", "create relationship");
      editor.setSelection({ moduleIds: [], flowIds: [created.id] });
      setPropertiesTab(null);
      setActiveFlowId(created.id);
    },
    [editor],
  );

  const changeCadenceFilter = useCallback(
    (filter: CadenceFilterValue) => {
      setCadenceFilter(filter);
      editor.setAnnouncement(`Showing ${filter} cadence relationships.`);
    },
    [editor.setAnnouncement],
  );
  const openPalette = useCallback((invoker: HTMLElement) => {
    setPropertiesTab(null);
    setStyleOpen(false);
    setRelationshipOpen(false);
    setActiveFlowId(null);
    setPaletteInvoker(invoker);
  }, []);

  const closePalette = useCallback(() => {
    const invoker = paletteInvoker;
    setPaletteInvoker(null);
    requestAnimationFrame(() => invoker?.focus());
  }, [paletteInvoker]);

  const focusSelectedModule = useCallback(() => {
    if (!selectedModuleId) return;
    requestAnimationFrame(() => {
      const node = document.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${selectedModuleId}"]`,
      );
      node?.focus();
    });
  }, [selectedModuleId]);

  const closeRelationshipProperties = useCallback(() => {
    const flowId = selectedFlowId;
    setRelationshipOpen(false);
    if (flowId) focusFlowLabel(flowId);
  }, [focusFlowLabel, selectedFlowId]);
  const closeProperties = useCallback(() => {
    setPropertiesTab(null);
    focusSelectedModule();
  }, [focusSelectedModule]);

  const closeStyle = useCallback(() => {
    setStyleOpen(false);
    focusSelectedModule();
  }, [focusSelectedModule]);

  useEffect(() => {
    if (styleOpen) styleRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [styleOpen]);

  const interaction = useMemo<EditorInteraction>(
    () => ({
      selectionCount: editor.selection.moduleIds.length + editor.selection.flowIds.length,
      announcement: editor.announcement,
      selectedModuleIds: editor.selection.moduleIds,
      availableCommands,
      activeInlineField,
      activeFlowId,
      connectMode,
      beginInlineEdit: setActiveInlineField,
      commitInlineEdit,
      cancelInlineEdit: () => setActiveInlineField(null),
      beginFlowEdit,
      cancelFlowEdit,
      commitFlowEdit,
      selectFlow,
      commitFlowWaypoint,
      executeCommand,
      openPalette,
      nudgeSelected,
      commitModuleWidth,
      commitModuleMove,
      createConnection,
      reconnectRelationship,
    }),
    [
      activeFlowId,
      activeInlineField,
      availableCommands,
      beginFlowEdit,
      cancelFlowEdit,
      commitFlowEdit,
      commitFlowWaypoint,
      commitInlineEdit,
      commitModuleMove,
      commitModuleWidth,
      connectMode,
      createConnection,
      editor.announcement,
      editor.selection.flowIds.length,
      editor.selection.moduleIds,
      executeCommand,
      nudgeSelected,
      openPalette,
      reconnectRelationship,
      selectFlow,
    ],
  );
  const handleWorkspaceKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isTextControl(event.target) || event.nativeEvent.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
      event.preventDefault();
      openPalette(event.currentTarget);
    }
  };

  useEffect(() => {
    const handleGlobalShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || isTextControl(event.target) || event.isComposing) return;
      const commandKey = event.ctrlKey || event.metaKey;
      const key = event.key.toLocaleLowerCase();
      if (commandKey && key === "k") {
        event.preventDefault();
        if (actionsRef.current) openPalette(actionsRef.current);
        return;
      }
      if (isInteractiveControl(event.target) && !commandKey) return;

      const command = matchCommandShortcut(event, availableCommands);
      if (command) {
        event.preventDefault();
        executeCommand(command.id);
        return;
      }

      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const distance = event.shiftKey ? 32 : 8;
        const delta =
          event.key === "ArrowLeft"
            ? { x: -distance, y: 0 }
            : event.key === "ArrowRight"
              ? { x: distance, y: 0 }
              : event.key === "ArrowUp"
                ? { x: 0, y: -distance }
                : { x: 0, y: distance };
        nudgeSelected(delta);
      }
    };
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, [availableCommands, executeCommand, nudgeSelected, openPalette]);

  return (
    <EditorInteractionContext.Provider value={interaction}>
      <main
        className={`money-map-workspace ${theme.className}`}
        data-canvas-style={theme.id}
        data-connect-mode={connectMode ? "true" : "false"}
        onKeyDown={handleWorkspaceKeyDown}
        ref={ref}
      >
        <header className="workspace-header">
          <button className="text-button" type="button" onClick={onBack}>
            Back to stories
          </button>
          <div className="workspace-heading">
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <div>
              <p className="workspace-kicker">Cairn</p>
              <h1>{editor.document.title}</h1>
            </div>
          </div>
          <div className="workspace-actions">
            <div className="workspace-meta">
              <span>{editor.document.asOf}</span>
              <span>{"Synthetic demo \u00b7 advisor-entered values"}</span>
            </div>
            <button
              className="actions-button"
              onClick={() => actionsRef.current && openPalette(actionsRef.current)}
              ref={actionsRef}
              type="button"
            >
              Actions
              <kbd>Ctrl K</kbd>
            </button>
          </div>
        </header>

        {supported ? (
          <section className="workspace-stage" aria-label={`${editor.document.title} canvas`}>
            <MoneyMapCanvas
              document={editor.document}
              selection={editor.selection}
              onSelectionChange={editor.setSelection}
              onDocumentChange={(document) =>
                editor.applyDocument(document, "Document changed.", "document mutation")
              }
              cadenceFilter={cadenceFilter}
            />
            <CadenceFilter value={cadenceFilter} onChange={changeCadenceFilter} />
          </section>
        ) : (
          <section className="authoring-cover" aria-labelledby="authoring-cover-title">
            <div>
              <p className="workspace-kicker">Authoring canvas</p>
              <h2 id="authoring-cover-title">A larger canvas is required</h2>
              <p>
                Money Map authoring is designed for viewports at least 1180 by 660. Expand this
                window to continue without compressing the financial story.
              </p>
            </div>
          </section>
        )}

        {styleOpen && selectedModuleId ? (
          <aside
            aria-label="Choose module style"
            className="primitive-menu"
            ref={styleRef}
            style={
              surfacePosition
                ? { left: surfacePosition.left, right: "auto", top: surfacePosition.top }
                : undefined
            }
          >
            <header>
              <strong>Module style</strong>
              <button type="button" onClick={closeStyle}>
                Close
              </button>
            </header>
            <div>
              {primitiveCommands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  onClick={() => {
                    executeCommand(command.id);
                    closeStyle();
                  }}
                >
                  {command.label}
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        {propertiesTab && selectedModuleId ? (
          <AdvancedProperties
            commands={appearanceCommands}
            document={editor.document}
            key={selectedModuleId}
            initialTab={propertiesTab}
            moduleId={selectedModuleId}
            onTabChange={setPropertiesTab}
            onClose={closeProperties}
            onCommitField={commitPropertyField}
            onExecute={executeCommand}
            onCreateConnection={createConnection}
            style={
              surfacePosition
                ? { left: surfacePosition.left, right: "auto", top: surfacePosition.top }
                : undefined
            }
          />
        ) : null}

        {relationshipOpen && selectedFlowId ? (
          <RelationshipProperties
            commands={relationshipCommands}
            document={editor.document}
            flowId={selectedFlowId}
            key={selectedFlowId}
            onClose={closeRelationshipProperties}
            onCommitField={commitFlowProperty}
            onExecute={executeCommand}
            onReconnect={(connection) => reconnectRelationship(selectedFlowId, connection)}
            style={
              surfacePosition
                ? { left: surfacePosition.left, right: "auto", top: surfacePosition.top }
                : undefined
            }
          />
        ) : null}
        {paletteInvoker ? (
          <CommandPalette
            context={editor.commandContext}
            invoker={paletteInvoker}
            onClose={closePalette}
            onExecute={executeCommand}
            registry={editor.registry}
          />
        ) : null}
      </main>
    </EditorInteractionContext.Provider>
  );
}
