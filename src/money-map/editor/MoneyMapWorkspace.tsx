import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import {
  selectionForCadence,
  moveModule,
  resizeModule,
  type CadenceFilter as CadenceFilterValue,
} from "../canvas/adapters";
import { MoneyMapCanvas } from "../canvas/MoneyMapCanvas";
import { createModule, type NewModuleStyle } from "../model/document";
import type {
  MoneyMapCadence,
  MoneyMapDocument,
  Point,
  PrimitiveStyle,
  StarterId,
} from "../model/types";
import { getCanvasTheme } from "../themes/registry";
import { AddMenu } from "./AddMenu";
import { AdvancedProperties, type PropertyField } from "./AdvancedProperties";
import { CommandPalette } from "./CommandPalette";
import { CadenceFilter } from "./CadenceFilter";
import { matchCommandShortcut } from "./commandShortcuts";
import {
  EditorInteractionContext,
  type EditorInteraction,
  type InlineEditTarget,
} from "./EditorInteractionContext";
import { FlowTargetPicker } from "./FlowTargetPicker";
import {
  createRelationship,
  editFlowField,
  editModuleField,
  moveFlowLabel,
  moveFlowWaypoint,
  nudgeSelection,
  reconnectFlow,
  type FlowField,
} from "./mutations";
import { RelationshipLegend } from "./RelationshipLegend";
import { RelationshipProperties } from "./RelationshipProperties";
import { PresentationShell } from "./PresentationShell";
import {
  findOpenModulePlacement,
  positionEditorSurface,
  SURFACE_HEADER_FLOOR,
  SURFACE_MARGIN,
  type EditorSurfacePosition,
  type PlacementViewport,
} from "./surfacePosition";
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
// The Content tab only ever shows the title field plus a *collapsed* details
// disclosure (AdvancedProperties never renders it open) -- a fixed, modest height
// regardless of which module is selected or how many rows/notes it carries, since
// that variable-length content lives inside the collapsed summary. Reserving the
// full appearance-tab budget (400px, sized for six always-expanded fieldsets) for
// this much shorter tab needlessly forces the surface further from its natural
// position than it ever needs to go.
const propertiesContentSize = { width: 352, height: 250 };

function carriedStyle(module: NewModuleStyle): NewModuleStyle {
  return {
    primitive: module.primitive,
    kind: module.kind,
    priority: module.priority,
    density: module.density,
    colorRole: module.colorRole,
    swatch: module.swatch,
    width: module.width,
    height: module.height,
  };
}

function cadenceForNewRelationship(filter: CadenceFilterValue): MoneyMapCadence {
  if (filter === "monthly") return { kind: "monthly", label: "Monthly" };
  if (filter === "annual") return { kind: "annual", label: "Annual" };
  return { kind: "as-needed", label: "As needed" };
}

interface CanvasPlacementContext {
  point: Point;
  viewport?: PlacementViewport;
}

const newModulePlacementSize = { width: 300, height: 200 };

function visibleCanvasPlacement(mapDocument: MoneyMapDocument): CanvasPlacementContext {
  const viewport = globalThis.document.querySelector<HTMLElement>(
    ".money-map-canvas .react-flow__viewport",
  );
  const pane = globalThis.document.querySelector<HTMLElement>(".money-map-canvas .react-flow");
  if (viewport && pane && typeof DOMMatrixReadOnly !== "undefined") {
    const transform = getComputedStyle(viewport).transform;
    const matrix = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
    return {
      point: {
        x: (pane.clientWidth / 2 - matrix.e) / matrix.a - 150,
        y: (pane.clientHeight / 2 - matrix.f) / matrix.d - 95,
      },
      viewport: {
        left: (0 - matrix.e) / matrix.a,
        top: (0 - matrix.f) / matrix.d,
        right: (pane.clientWidth - matrix.e) / matrix.a,
        bottom: (pane.clientHeight - matrix.f) / matrix.d,
      },
    };
  }
  const left = Math.min(...mapDocument.modules.map(({ position }) => position.x));
  const top = Math.min(...mapDocument.modules.map(({ position }) => position.y));
  const right = Math.max(...mapDocument.modules.map((module) => module.position.x + module.width));
  const bottom = Math.max(
    ...mapDocument.modules.map((module) => module.position.y + module.height),
  );
  return { point: { x: (left + right) / 2 - 150, y: (top + bottom) / 2 - 95 } };
}

export function isAuthoringViewportSupported(width: number, height: number): boolean {
  return width >= authoringMinimum.width && height >= authoringMinimum.height;
}

function initialDimensions(): Dimensions {
  if (typeof window === "undefined") return authoringMinimum;
  return { width: window.innerWidth, height: window.innerHeight };
}

function useWorkspaceDimensions(enabled = true) {
  const ref = useRef<HTMLElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>(initialDimensions);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);

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
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilterValue>(
    editor.document.defaultCadence,
  );
  const [paletteInvoker, setPaletteInvoker] = useState<HTMLElement | null>(null);
  const [propertiesTab, setPropertiesTab] = useState<"content" | "appearance" | null>(null);
  const [drawFlowOpen, setDrawFlowOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const presentingRef = useRef(presenting);
  presentingRef.current = presenting;
  const [surfacePosition, setSurfacePosition] = useState<EditorSurfacePosition | null>(null);
  const actionsRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const presentRef = useRef<HTMLButtonElement>(null);
  const lastModuleStyle = useRef<NewModuleStyle | null>(null);
  // Set synchronously by executeCommand whenever a command opens another
  // focus-owning surface (Add menu, Present, Legend, or any module/relationship
  // panel). closePalette reads it to skip its own focus-restore so it never fights
  // the surface the command itself just opened.
  const suppressPaletteFocusRestore = useRef(false);
  // Tracks a just-created module that landed outside the visible viewport, so the
  // camera can be panned to it once the new selection has actually committed (the
  // canvas controller closes over the previous render's selection until then).
  const pendingRevealModuleId = useRef<string | null>(null);
  const { ref, dimensions } = useWorkspaceDimensions(!presenting);
  const supported = isAuthoringViewportSupported(dimensions.width, dimensions.height);
  const selectedModuleId =
    editor.selection.moduleIds.length === 1 && editor.selection.flowIds.length === 0
      ? editor.selection.moduleIds[0]
      : null;
  const selectedFlowId =
    editor.selection.flowIds.length === 1 && editor.selection.moduleIds.length === 0
      ? editor.selection.flowIds[0]
      : null;
  /* Declared here rather than beside focusSelectedModule below because
     commitInlineEdit/cancelInlineEdit list it as a dependency and would hit
     the temporal dead zone. */
  const focusModule = useCallback((moduleId: string) => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`.react-flow__node[data-id="${moduleId}"]`)?.focus();
    });
  }, []);

  const availableCommands = editor.registry.available(editor.commandContext);
  const appearanceCommands = availableCommands.filter(
    ({ id }) =>
      id.startsWith("module.primitive.") ||
      id.startsWith("module.width.") ||
      id.startsWith("module.priority.") ||
      id.startsWith("module.density.") ||
      id.startsWith("module.swatch.") ||
      id.startsWith("module.order."),
  );
  const relationshipCommands = availableCommands.filter(({ id }) => id.startsWith("flow."));

  useEffect(() => {
    if (!selectedModuleId) return;
    const module = editor.document.modules.find(({ id }) => id === selectedModuleId);
    if (module) lastModuleStyle.current = carriedStyle(module);
  }, [editor.document.modules, selectedModuleId]);

  useEffect(() => {
    if (selectedModuleId) return;
    setPropertiesTab(null);
    setDrawFlowOpen(false);
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

  // Every other clickable canvas object currently on screen -- modules and flow
  // labels -- as plain rects, passed to positionEditorSurface so it can steer the
  // surface clear of canvas content it isn't anchored to, not just the module or
  // flow it's editing. `exceptModuleId`/`exceptFlowId` are the anchor itself
  // (already handled separately, by offsetting instead of avoiding).
  const otherCanvasObstacleRects = useCallback(
    (exceptModuleId: string, exceptFlowId = ""): DOMRect[] => {
      const rects: DOMRect[] = [];
      document.querySelectorAll<HTMLElement>(".react-flow__node[data-id]").forEach((node) => {
        if (node.dataset.id === exceptModuleId) return;
        rects.push(node.getBoundingClientRect());
      });
      document.querySelectorAll<HTMLElement>("[data-flow-label-id]").forEach((label) => {
        if (label.dataset.flowLabelId === exceptFlowId) return;
        rects.push(label.getBoundingClientRect());
      });
      return rects;
    },
    [],
  );

  // The stage's permanent controls (cadence filter, zoom toolbar) -- always on
  // screen, never tied to the open document. Unlike document content
  // (otherCanvasObstacleRects), these are never an acceptable tradeoff to graze:
  // positionEditorSurface treats them as a hard constraint, the same as the object
  // being edited.
  const permanentChromeRects = useCallback((): DOMRect[] => {
    const rects: DOMRect[] = [];
    document
      .querySelectorAll<HTMLElement>(".cadence-filter, .canvas-controls")
      .forEach((chrome) => {
        rects.push(chrome.getBoundingClientRect());
      });
    return rects;
  }, []);

  const placeSurface = useCallback(
    (size?: { width: number; height: number }) => {
      if (!selectedModuleId) return;
      const node = document.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${selectedModuleId}"]`,
      );
      if (!node) return;
      const bounds = node.getBoundingClientRect();
      setSurfacePosition(
        positionEditorSurface(
          bounds,
          { width: window.innerWidth, height: window.innerHeight },
          size,
          otherCanvasObstacleRects(selectedModuleId),
          permanentChromeRects(),
        ),
      );
    },
    [otherCanvasObstacleRects, permanentChromeRects, selectedModuleId],
  );
  const placeFlowSurface = useCallback(() => {
    if (!selectedFlowId) return;
    const label = document.querySelector<HTMLElement>(`[data-flow-label-id="${selectedFlowId}"]`);
    if (!label) return;
    setSurfacePosition(
      positionEditorSurface(
        label.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        relationshipSurfaceSize,
        otherCanvasObstacleRects("", selectedFlowId),
        permanentChromeRects(),
      ),
    );
  }, [otherCanvasObstacleRects, permanentChromeRects, selectedFlowId]);

  // Properties (and Draw flow) intentionally stay open across a plain click on a
  // different module -- the panel swaps in the newly selected module's data rather
  // than closing (see the `selectedModuleId` effect above, which only closes it when
  // selection drops to none). Without this, the surface stayed parked at the
  // position computed for the *previous* module, which could now overlap the newly
  // selected module's own selection halo. Re-anchoring keeps it beside whichever
  // module it's actually showing.
  // Intentionally keyed on selectedModuleId alone: it should re-anchor exactly
  // once per selection change, not on every placeSurface/tab identity change.
  useEffect(() => {
    if (!selectedModuleId) return;
    if (!propertiesTab && !drawFlowOpen) return;
    placeSurface(propertiesTab === "appearance" ? undefined : propertiesContentSize);
  }, [selectedModuleId]);

  // The two tabs have different height budgets (Content 250px, Appearance the
  // 400px default), and positionEditorSurface clamps `top` against the budget
  // it is given. Switching tabs only changed which panel rendered, so a
  // surface opened on Content kept Content's clamp: for a module low in the
  // canvas that leaves `top` up to 150px further down than Appearance's
  // budget allows, running its bottom off the viewport. Re-place on the tab
  // that is actually about to render. Keyed on propertiesTab alone so it
  // re-anchors once per tab change, matching the selection effect above.
  useEffect(() => {
    if (!selectedModuleId || !propertiesTab) return;
    placeSurface(propertiesTab === "appearance" ? undefined : propertiesContentSize);
  }, [propertiesTab]);

  // The height budgets above are declarations, not measurements — Content
  // declares 250px and renders 274px — so positionEditorSurface can clamp
  // against a number the panel does not honour and still leave it hanging
  // past the viewport. Rather than keep re-tuning the constants (the same
  // drift that produced the tab-switch bug), correct against what actually
  // rendered. Settles in one pass: the corrected top produces no overflow,
  // so the guard returns early on the next run rather than oscillating.
  useEffect(() => {
    if (!surfacePosition) return;
    const surface = document.querySelector<HTMLElement>(
      ".advanced-properties, .relationship-properties, .flow-target-picker",
    );
    if (!surface) return;
    const overflow = surface.getBoundingClientRect().bottom - (window.innerHeight - SURFACE_MARGIN);
    if (overflow <= 0) return;
    const top = Math.max(SURFACE_HEADER_FLOOR, surfacePosition.top - overflow);
    if (top === surfacePosition.top) return;
    setSurfacePosition({ ...surfacePosition, top });
  }, [surfacePosition, propertiesTab, relationshipOpen, drawFlowOpen]);

  // Same re-anchoring for relationship properties: it stays open across a plain
  // click on a different flow (see the `selectedFlowId` effect above), so its
  // position has to follow. Keyed on selectedFlowId alone for the same reason.
  useEffect(() => {
    if (!selectedFlowId) return;
    if (!relationshipOpen) return;
    placeFlowSurface();
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

  const openAdd = useCallback(() => {
    setPaletteInvoker(null);
    setPropertiesTab(null);
    setDrawFlowOpen(false);
    setRelationshipOpen(false);
    setActiveFlowId(null);
    setLegendOpen(false);
    setAddOpen(true);
  }, []);

  const enterPresentation = useCallback(() => {
    setActiveInlineField(null);
    setActiveFlowId(null);
    setRelationshipOpen(false);
    setPaletteInvoker(null);
    setPropertiesTab(null);
    setDrawFlowOpen(false);
    setAddOpen(false);
    setLegendOpen(false);
    setPresenting(true);
  }, []);

  const openLegend = useCallback(() => {
    setPaletteInvoker(null);
    setPropertiesTab(null);
    setDrawFlowOpen(false);
    setRelationshipOpen(false);
    setActiveFlowId(null);
    setAddOpen(false);
    setLegendOpen(true);
  }, []);

  const closeLegend = useCallback(() => {
    setLegendOpen(false);
    requestAnimationFrame(() => actionsRef.current?.focus());
  }, []);

  const executeCommand = useCallback(
    (id: string) => {
      // Reset on every call (not just the surface-opening branches below) so a
      // stale `true` from an earlier, non-palette-triggered command (e.g. the
      // "L" shortcut) can never leak into a later palette close.
      suppressPaletteFocusRestore.current = false;
      const result = editor.executeCommand(id);
      if (result?.kind === "add") {
        suppressPaletteFocusRestore.current = true;
        openAdd();
        return;
      }
      if (result?.kind === "present") {
        suppressPaletteFocusRestore.current = true;
        enterPresentation();
        return;
      }
      if (result?.kind === "legend") {
        suppressPaletteFocusRestore.current = true;
        openLegend();
        return;
      }
      if (result?.kind !== "surface") return;
      // Every surface below focuses itself on mount (InlineField autoFocus,
      // FlowTargetPicker/RelationshipProperties/AdvancedProperties effects), so
      // the palette's own focus-restore must not fight it. See closePalette.
      suppressPaletteFocusRestore.current = true;
      setAddOpen(false);
      if (result.surface === "inline") {
        setPropertiesTab(null);
        setRelationshipOpen(false);
        beginSelectedTitle();
        return;
      }
      if (result.surface === "flow-inline") {
        setPropertiesTab(null);
        setRelationshipOpen(false);
        if (selectedFlowId) setActiveFlowId(selectedFlowId);
        return;
      }
      if (result.surface === "flow-properties") {
        placeFlowSurface();
        setPropertiesTab(null);
        setRelationshipOpen(true);
        return;
      }
      if (result.surface === "draw-flow") {
        setPropertiesTab(null);
        setRelationshipOpen(false);
        placeSurface();
        setDrawFlowOpen(true);
        return;
      }

      setRelationshipOpen(false);
      placeSurface(result.surface === "appearance" ? undefined : propertiesContentSize);
      setDrawFlowOpen(false);
      setPropertiesTab(result.surface === "appearance" ? "appearance" : "content");
    },
    [
      beginSelectedTitle,
      editor,
      enterPresentation,
      openAdd,
      openLegend,
      placeFlowSurface,
      placeSurface,
      selectedFlowId,
    ],
  );
  const commitInlineEdit = useCallback(
    (literal: string) => {
      if (!activeInlineField) return;
      const target =
        activeInlineField.field === "row-label" || activeInlineField.field === "row-value"
          ? { field: activeInlineField.field, rowId: activeInlineField.rowId }
          : { field: activeInlineField.field };
      const next = editModuleField(editor.document, activeInlineField.moduleId, target, literal);
      editor.applyDocument(next, "Inline edit committed.", `edit ${activeInlineField.field}`);
      // DESIGN.md contracts focus restoration, and inline editing is the
      // most-used dismissable surface. Without this the field unmounts and
      // focus falls to <body>, costing a full re-Tab through the header,
      // canvas, and every edge group to get back to the edited shape.
      focusModule(activeInlineField.moduleId);
      setActiveInlineField(null);
    },
    [activeInlineField, editor, focusModule],
  );

  const cancelInlineEdit = useCallback(() => {
    if (activeInlineField) focusModule(activeInlineField.moduleId);
    setActiveInlineField(null);
  }, [activeInlineField, focusModule]);

  const commitPropertyField = useCallback(
    (moduleId: string, field: PropertyField, literal: string) => {
      const next = editModuleField(editor.document, moduleId, field, literal);
      editor.applyDocument(next, "Property updated.", `edit ${field.field}`);
    },
    [editor],
  );

  const commitModuleSize = useCallback(
    (moduleId: string, size: { width: number; height: number }) => {
      const next = resizeModule(editor.document, moduleId, size);
      editor.applyDocument(next, "Shape resized.", "resize module");
    },
    [editor],
  );

  const commitModuleMove = useCallback(
    (moduleId: string, position: Point) => {
      const next = moveModule(editor.document, moduleId, position);
      editor.applyDocument(next, "Shape moved.", "move module");
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

  const focusNewModuleTitle = useCallback(() => {
    const focus = (retry: boolean) => {
      const input = document.querySelector<HTMLInputElement>("input.inline-field");
      if (input) {
        input.focus();
        input.select();
      } else if (retry) {
        window.setTimeout(() => focus(false), 60);
      }
    };
    requestAnimationFrame(() => focus(true));
    window.setTimeout(() => focus(false), 90);
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

  const commitFlowLabelPosition = useCallback(
    (flowId: string, point: Point) => {
      const next = moveFlowLabel(editor.document, flowId, point);
      editor.applyDocument(next, "Relationship label position updated.", "move relationship label");
      focusFlowLabel(flowId);
    },
    [editor, focusFlowLabel],
  );

  const commitFlowWaypoint = useCallback(
    (flowId: string, point: Point) => {
      const next = moveFlowWaypoint(editor.document, flowId, point);
      editor.applyDocument(next, "Relationship route updated.", "move relationship bend");
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
        cadenceForNewRelationship(cadenceFilter),
      );
      const created = next.flows.find(({ id }) => !previousIds.has(id));
      if (!created) return;
      editor.applyDocument(next, "Relationship created.", "create relationship");
      editor.setSelection({ moduleIds: [], flowIds: [created.id] });
      setPropertiesTab(null);
      setDrawFlowOpen(false);
      setActiveFlowId(created.id);
    },
    [cadenceFilter, editor],
  );

  const createObject = useCallback(
    (primitive: PrimitiveStyle) => {
      const previousIds = new Set(editor.document.modules.map(({ id }) => id));
      const carried = lastModuleStyle.current;
      const approximateSize =
        carried && carried.primitive === primitive
          ? { width: carried.width, height: carried.height }
          : newModulePlacementSize;
      const { point: preferredPoint, viewport } = visibleCanvasPlacement(editor.document);
      const placement = findOpenModulePlacement(
        preferredPoint,
        approximateSize,
        editor.document.modules.map((module) => ({
          x: module.position.x,
          y: module.position.y,
          width: module.width,
          height: module.height,
        })),
        viewport,
      );
      const next = createModule(
        editor.document,
        primitive,
        placement.point,
        (kind) => `${kind}-${crypto.randomUUID()}`,
        lastModuleStyle.current ?? undefined,
      );
      const created = next.modules.find(({ id }) => !previousIds.has(id));
      if (!created) return;
      editor.applyDocument(next, `${created.title} added.`, "add module");
      editor.setSelection({ moduleIds: [created.id], flowIds: [] });
      // Off-screen placements never happen silently: the camera pans to reveal
      // the new object once the selection above has actually committed (see the
      // pendingRevealModuleId effect — the canvas controller still closes over
      // the previous render's selection at this exact point in the callback).
      if (!placement.withinViewport) pendingRevealModuleId.current = created.id;
      lastModuleStyle.current = carriedStyle(created);
      setAddOpen(false);
      setActiveInlineField({ moduleId: created.id, field: "title", original: created.title });
      focusNewModuleTitle();
    },
    [editor, focusNewModuleTitle],
  );

  // Consumes a pending off-screen reveal exactly once, on the next selection
  // change after createObject flags it. By the time this effect runs, both the
  // selection state and the canvas controller (updated by MoneyMapCanvas's own
  // child effect, which commits before this parent effect) reflect the new
  // module, so fit-selection frames the right object instead of the stale one.
  useEffect(() => {
    const pendingId = pendingRevealModuleId.current;
    if (!pendingId) return;
    pendingRevealModuleId.current = null;
    if (selectedModuleId !== pendingId) return;
    editor.executeCommand("camera.fit-selection");
  }, [selectedModuleId, editor]);

  const quickCreateConnection = useCallback(
    (sourceId: string, point: Point) => {
      const source = editor.document.modules.find(({ id }) => id === sourceId);
      if (!source) return;
      const previousIds = new Set(editor.document.modules.map(({ id }) => id));
      const withModule = createModule(
        editor.document,
        source.primitive,
        { x: point.x - source.width / 2, y: point.y - source.height / 2 },
        (kind) => `${kind}-${crypto.randomUUID()}`,
        carriedStyle(source),
      );
      const created = withModule.modules.find(({ id }) => !previousIds.has(id));
      if (!created) return;
      const next = createRelationship(
        withModule,
        sourceId,
        created.id,
        () => `flow-${crypto.randomUUID()}`,
        cadenceForNewRelationship(cadenceFilter),
      );
      editor.applyDocument(
        next,
        `${created.title} added and connected.`,
        "quick create connected module",
      );
      editor.setSelection({ moduleIds: [created.id], flowIds: [] });
      lastModuleStyle.current = carriedStyle(created);
      setActiveInlineField({ moduleId: created.id, field: "title", original: created.title });
      focusNewModuleTitle();
    },
    [cadenceFilter, editor, focusNewModuleTitle],
  );

  const changeCadenceFilter = useCallback(
    (filter: CadenceFilterValue) => {
      setCadenceFilter(filter);
      editor.setAnnouncement(`Showing ${filter} cadence relationships.`);
    },
    [editor.setAnnouncement],
  );
  const openPalette = useCallback((invoker: HTMLElement) => {
    setAddOpen(false);
    setPropertiesTab(null);
    setDrawFlowOpen(false);
    setRelationshipOpen(false);
    setActiveFlowId(null);
    setLegendOpen(false);
    setPaletteInvoker(invoker);
  }, []);

  const closePalette = useCallback(() => {
    const invoker = paletteInvoker;
    setPaletteInvoker(null);
    // A command executed from the palette may have just opened another surface
    // (Add menu, Present, Legend, an inline/appearance/properties panel) that
    // already focused itself. Restoring focus to the invoker here would steal
    // it right back — see executeCommand's suppressPaletteFocusRestore branches.
    if (suppressPaletteFocusRestore.current) {
      suppressPaletteFocusRestore.current = false;
      return;
    }
    requestAnimationFrame(() => invoker?.focus());
  }, [paletteInvoker]);

  const closeAdd = useCallback(() => {
    setAddOpen(false);
    requestAnimationFrame(() => addRef.current?.focus());
  }, []);

  const focusSelectedModule = useCallback(() => {
    if (!selectedModuleId) return;
    focusModule(selectedModuleId);
  }, [focusModule, selectedModuleId]);

  const closeRelationshipProperties = useCallback(() => {
    const flowId = selectedFlowId;
    setRelationshipOpen(false);
    if (flowId) focusFlowLabel(flowId);
  }, [focusFlowLabel, selectedFlowId]);
  const closeProperties = useCallback(() => {
    setPropertiesTab(null);
    focusSelectedModule();
  }, [focusSelectedModule]);

  const closeDrawFlow = useCallback(() => {
    setDrawFlowOpen(false);
    focusSelectedModule();
  }, [focusSelectedModule]);

  const exitPresentation = useCallback(() => {
    setPresenting(false);
    requestAnimationFrame(() => presentRef.current?.focus());
  }, []);

  const interaction = useMemo<EditorInteraction>(
    () => ({
      selectionCount: editor.selection.moduleIds.length + editor.selection.flowIds.length,
      announcement: editor.announcement,
      selectedModuleIds: editor.selection.moduleIds,
      availableCommands,
      activeInlineField,
      activeFlowId,
      beginInlineEdit: setActiveInlineField,
      commitInlineEdit,
      cancelInlineEdit,
      beginFlowEdit,
      cancelFlowEdit,
      commitFlowEdit,
      selectFlow,
      commitFlowLabelPosition,
      commitFlowWaypoint,
      executeCommand,
      openPalette,
      nudgeSelected,
      commitModuleSize,
      commitModuleMove,
      createConnection,
      quickCreateConnection,
      reconnectRelationship,
    }),
    [
      activeFlowId,
      activeInlineField,
      availableCommands,
      beginFlowEdit,
      cancelFlowEdit,
      cancelInlineEdit,
      commitFlowEdit,
      commitFlowLabelPosition,
      commitFlowWaypoint,
      commitInlineEdit,
      commitModuleMove,
      commitModuleSize,
      createConnection,
      quickCreateConnection,
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
    if (presenting) return;
    const handleGlobalShortcut = (event: globalThis.KeyboardEvent) => {
      if (presentingRef.current) return;
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
  }, [availableCommands, executeCommand, nudgeSelected, openPalette, presenting]);

  if (presenting) {
    return <PresentationShell document={editor.document} onExit={exitPresentation} />;
  }

  return (
    <EditorInteractionContext.Provider value={interaction}>
      <main
        className={`money-map-workspace ${theme.className}`}
        data-canvas-style={theme.id}
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
              aria-expanded={addOpen}
              className="add-button"
              disabled={!supported}
              onClick={openAdd}
              ref={addRef}
              type="button"
            >
              + Add
            </button>
            <button
              className="present-button"
              onClick={enterPresentation}
              ref={presentRef}
              type="button"
            >
              Present
            </button>
            <button
              className="actions-button"
              onClick={() => actionsRef.current && openPalette(actionsRef.current)}
              ref={actionsRef}
              type="button"
            >
              Actions
              <kbd>Ctrl K</kbd>
            </button>
            {legendOpen ? (
              <RelationshipLegend document={editor.document} open onClose={closeLegend} />
            ) : null}
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
              onControllerChange={editor.registerCanvasController}
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

        {addOpen ? <AddMenu onChoose={createObject} onClose={closeAdd} /> : null}

        {drawFlowOpen && selectedModuleId ? (
          <FlowTargetPicker
            document={editor.document}
            sourceId={selectedModuleId}
            onChoose={(targetId) => createConnection(selectedModuleId, targetId)}
            onClose={closeDrawFlow}
            style={
              surfacePosition
                ? { left: surfacePosition.left, right: "auto", top: surfacePosition.top }
                : undefined
            }
          />
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
