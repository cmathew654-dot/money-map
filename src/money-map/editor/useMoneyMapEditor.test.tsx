import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";

import { updateModule } from "../model/document";
import { saveDraft, type StorageLike } from "../model/persistence";
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

  it("reset clears the starter draft and restores a fresh history boundary", () => {
    const storage = storageFixture();
    const { result } = renderHook(() =>
      useMoneyMapEditor("annuity", { storage, createId: () => "copy" }),
    );
    act(() =>
      result.current.applyDocument(
        updateModule(result.current.document, "annuity-policy", (module) => ({
          ...module,
          title: "Changed",
        })),
        "Changed.",
        "edit title",
      ),
    );
    act(() => result.current.reset());
    expect(result.current.document).toEqual(getScaffoldDocument("annuity"));
    expect(result.current.canUndo).toBe(false);
    expect(storage.values.size).toBe(0);
  });
});
