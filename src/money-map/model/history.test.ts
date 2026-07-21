import { commitHistory, createHistory, redoHistory, undoHistory } from "./history";

describe("history", () => {
  it("commits new references and clears the future", () => {
    const first = { name: "first" };
    const second = { name: "second" };
    const history = { past: [], present: first, future: [{ name: "future" }] };

    expect(commitHistory(history, second)).toEqual({
      past: [first],
      present: second,
      future: [],
    });
  });

  it("preserves the same history reference for an identical present commit", () => {
    const present = { name: "same" };
    const history = createHistory(present);

    expect(commitHistory(history, present)).toBe(history);
  });

  it("moves exact references through undo and redo", () => {
    const first = { name: "first" };
    const second = { name: "second" };
    const committed = commitHistory(createHistory(first), second);
    const undone = undoHistory(committed);
    const redone = redoHistory(undone);

    expect(undone.present).toBe(first);
    expect(undone.future[0]).toBe(second);
    expect(redone.present).toBe(second);
    expect(redone.past[0]).toBe(first);
  });

  it("preserves the same history reference at undo and redo boundaries", () => {
    const history = createHistory({ name: "only" });

    expect(undoHistory(history)).toBe(history);
    expect(redoHistory(history)).toBe(history);
  });
});
