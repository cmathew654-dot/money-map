import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { vi } from "vitest";

import { createModule, updateModule } from "../model/document";
import { createResilientStorage, saveDraft, type StorageLike } from "../model/persistence";
import type { StarterId } from "../model/types";
import { getScaffoldDocument } from "../starters/scaffolds";
import { useMoneyMapEditor } from "./useMoneyMapEditor";

function storageFixture(): StorageLike & { values: Map<string, string>; writes: number } {
  const values = new Map<string, string>();
  return {
    values,
    writes: 0,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      this.writes += 1;
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
  };
}

describe("useMoneyMapEditor", () => {
  it("opens a starter and remains editable with only the memory fallback", () => {
    const storage = createResilientStorage(undefined, new Map());
    const { result } = renderHook(() => useMoneyMapEditor("retirement", { storage }));
    const edited = updateModule(result.current.document, "retirement-income", (module) => ({
      ...module,
      title: "Memory-only edit",
    }));

    expect(() =>
      act(() => result.current.applyDocument(edited, "Edited.", "memory-only edit")),
    ).not.toThrow();
    expect(
      result.current.document.modules.find(({ id }) => id === "retirement-income")?.title,
    ).toBe("Memory-only edit");
  });

  it("loads and isolates the correct starter draft", () => {
    const storage = storageFixture();
    saveDraft(
      storage,
      updateModule(getScaffoldDocument("annuity"), "annuity-policy", (module) => ({
        ...module,
        title: "Saved annuity",
      })),
    );
    saveDraft(
      storage,
      updateModule(getScaffoldDocument("roth"), "roth-source", (module) => ({
        ...module,
        title: "Saved Roth",
      })),
    );
    const { result, rerender } = renderHook(
      ({ starterId }) => useMoneyMapEditor(starterId, { storage, createId: () => "copy" }),
      { initialProps: { starterId: "annuity" as StarterId } },
    );
    expect(result.current.document.modules[1].title).toBe("Saved annuity");

    rerender({ starterId: "roth" });
    expect(result.current.document.id).toBe("roth");
    expect(result.current.document.modules[0].title).toBe("Saved Roth");
  });

  it("saves only committed documents, supports exact undo/redo, and excludes transient state", () => {
    const storage = storageFixture();
    const { result } = renderHook(
      () => useMoneyMapEditor("annuity", { storage, createId: () => "copy" }),
      { wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode> },
    );
    const initial = result.current.document;
    act(() => result.current.setSelection({ moduleIds: ["annuity-policy"], flowIds: [] }));
    expect(storage.writes).toBe(0);

    const edited = updateModule(initial, "annuity-policy", (module) => ({
      ...module,
      title: "~$11,800/mo",
    }));
    act(() => result.current.applyDocument(edited, "Title edited.", "edit title"));
    expect(storage.writes).toBe(1);
    expect(JSON.parse(storage.values.values().next().value as string)).not.toHaveProperty(
      "selection",
    );

    act(() => result.current.undo());
    expect(result.current.document).toBe(initial);
    act(() => result.current.redo());
    expect(result.current.document.modules[1].title).toBe("~$11,800/mo");
  });

  it("reset is undoable and keeps the persisted draft consistent with what's on screen", () => {
    const storage = storageFixture();
    const { result } = renderHook(() =>
      useMoneyMapEditor("annuity", { storage, createId: () => "copy" }),
    );
    const edited = updateModule(result.current.document, "annuity-policy", (module) => ({
      ...module,
      title: "Changed",
    }));
    act(() => result.current.applyDocument(edited, "Changed.", "edit title"));

    act(() => result.current.reset());
    expect(result.current.document).toEqual(getScaffoldDocument("annuity"));
    expect(result.current.canUndo).toBe(true);
    expect(JSON.parse(storage.values.values().next().value as string)).toEqual(
      getScaffoldDocument("annuity"),
    );

    act(() => result.current.undo());
    expect(result.current.document).toBe(edited);
    expect(JSON.parse(storage.values.values().next().value as string)).toEqual(edited);
  });

  it("reset-then-undo restores an added module, not just the pre-reset title", () => {
    const storage = storageFixture();
    const { result } = renderHook(() =>
      useMoneyMapEditor("annuity", { storage, createId: () => "copy" }),
    );
    const starterModuleCount = result.current.document.modules.length;

    const withModule = createModule(
      result.current.document,
      "plate",
      { x: 0, y: 0 },
      () => "added-module",
    );
    act(() => result.current.applyDocument(withModule, "Plate added.", "add module"));
    expect(result.current.document.modules).toHaveLength(starterModuleCount + 1);

    act(() => result.current.reset());
    expect(result.current.document.modules).toHaveLength(starterModuleCount);

    act(() => result.current.undo());
    expect(result.current.document.modules).toHaveLength(starterModuleCount + 1);
    expect(result.current.document.modules.some(({ id }) => id === "added-module")).toBe(true);
  });

  it("dispatches camera commands to a registered canvas controller", () => {
    const storage = storageFixture();
    const { result } = renderHook(() =>
      useMoneyMapEditor("annuity", { storage, createId: () => "copy" }),
    );
    const controller = {
      zoomOut: vi.fn(),
      resetZoom: vi.fn(),
      zoomIn: vi.fn(),
      fitMap: vi.fn(),
      fitSelection: vi.fn(),
    };
    act(() => result.current.registerCanvasController(controller));

    act(() => result.current.executeCommand("camera.fit-story"));
    expect(controller.fitMap).toHaveBeenCalledTimes(1);

    act(() => result.current.executeCommand("camera.fit-selection"));
    expect(controller.fitSelection).toHaveBeenCalledTimes(1);

    act(() => result.current.executeCommand("camera.reset-zoom"));
    expect(controller.resetZoom).toHaveBeenCalledTimes(1);
  });

  it("does not throw executing camera commands before a canvas controller registers", () => {
    const storage = storageFixture();
    const { result } = renderHook(() =>
      useMoneyMapEditor("annuity", { storage, createId: () => "copy" }),
    );
    expect(() => act(() => result.current.executeCommand("camera.fit-story"))).not.toThrow();
  });
});
