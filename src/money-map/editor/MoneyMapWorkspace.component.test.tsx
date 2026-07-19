import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { createTestDocument } from "../model/test-fixtures";
import type { Selection } from "../model/types";
import { createWorkspaceCommands, type WorkspaceCommandContext } from "./commands";
import { MoneyMapWorkspace } from "./MoneyMapWorkspace";
import type { useMoneyMapEditor } from "./useMoneyMapEditor";

const hookMock = vi.hoisted(() => ({
  editor: undefined as unknown as ReturnType<typeof useMoneyMapEditor>,
}));

vi.mock("./useMoneyMapEditor", () => ({
  useMoneyMapEditor: () => hookMock.editor,
}));

vi.mock("../canvas/MoneyMapCanvas", () => ({
  MoneyMapCanvas: () => <div aria-label="Mock money map canvas" />,
}));

function createEditor() {
  const document = createTestDocument();
  const registry = createWorkspaceCommands(() => "copy");
  const selection: Selection = { moduleIds: ["annuity-policy"], flowIds: [] };
  const commandContext: WorkspaceCommandContext = {
    document,
    selection,
    canUndo: false,
    canRedo: false,
  };
  const editor = {
    document,
    selection,
    setSelection: vi.fn(),
    announcement: "",
    setAnnouncement: vi.fn(),
    lastHistoryStep: null,
    registry,
    commandContext,
    canUndo: false,
    canRedo: false,
    applyDocument: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    reset: vi.fn(),
    executeCommand: vi.fn((id: string) => {
      const command = registry.get(id);
      if (!command || !command.isAvailable(editor.commandContext)) return undefined;
      return command.execute(editor.commandContext);
    }),
  } as unknown as ReturnType<typeof useMoneyMapEditor>;

  return editor;
}

function setSelection(editor: ReturnType<typeof useMoneyMapEditor>, selection: Selection): void {
  editor.selection = selection;
  editor.commandContext = { ...editor.commandContext, selection };
}
function setDocument(
  editor: ReturnType<typeof useMoneyMapEditor>,
  document: ReturnType<typeof createTestDocument>,
): void {
  editor.document = document;
  editor.commandContext = { ...editor.commandContext, document };
}

function openCommand(label: string): void {
  fireEvent.click(screen.getByRole("button", { name: /Actions/ }));
  const search = screen.getByRole("combobox", { name: "Search actions" });
  fireEvent.change(search, { target: { value: label } });
  fireEvent.click(screen.getByRole("option", { name: new RegExp(label, "i") }));
}

describe("MoneyMapWorkspace command lifecycle", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    hookMock.editor = createEditor();
  });

  it("routes global Backspace through the available removal command definition", () => {
    render(<MoneyMapWorkspace starterId="annuity" onBack={vi.fn()} />);

    fireEvent.keyDown(window, { key: "Backspace" });

    expect(hookMock.editor.executeCommand).toHaveBeenCalledWith("selection.remove");
  });

  it("limits create-connection mode to the live Connections surface", () => {
    const view = render(<MoneyMapWorkspace starterId="annuity" onBack={vi.fn()} />);
    const workspace = view.container.querySelector(".money-map-workspace");
    if (!workspace) throw new Error("Expected workspace");

    openCommand("connect module");
    expect(workspace.getAttribute("data-connect-mode")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Content" }));
    expect(workspace.getAttribute("data-connect-mode")).toBe("false");

    openCommand("connect module");
    fireEvent.click(screen.getByRole("button", { name: "Close properties" }));
    expect(workspace.getAttribute("data-connect-mode")).toBe("false");

    openCommand("connect module");
    fireEvent.click(screen.getByRole("button", { name: /Actions/ }));
    expect(workspace.getAttribute("data-connect-mode")).toBe("false");
  });

  it("clears a selected relationship and its panel when a cadence edit hides it", () => {
    const editor = hookMock.editor;
    setSelection(editor, { moduleIds: [], flowIds: ["income-flow"] });
    const view = render(<MoneyMapWorkspace starterId="annuity" onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /^Monthly$/ }));
    vi.mocked(editor.setSelection).mockClear();
    openCommand("relationship properties");
    expect(screen.getByLabelText("Relationship properties")).toBeTruthy();

    const customDocument = {
      ...editor.document,
      flows: editor.document.flows.map((flow) =>
        flow.id === "income-flow"
          ? { ...flow, cadence: { kind: "custom" as const, label: "After closing" } }
          : flow,
      ),
    };
    setDocument(editor, customDocument);
    view.rerender(<MoneyMapWorkspace starterId="annuity" onBack={vi.fn()} />);

    expect(editor.setSelection).toHaveBeenCalledTimes(1);
    expect(editor.setSelection).toHaveBeenCalledWith({ moduleIds: [], flowIds: [] });

    setSelection(editor, { moduleIds: [], flowIds: [] });
    view.rerender(<MoneyMapWorkspace starterId="annuity" onBack={vi.fn()} />);
    expect(screen.queryByLabelText("Relationship properties")).toBeNull();
    expect(editor.setSelection).toHaveBeenCalledTimes(1);
  });

  it("re-evaluates document cadence changes without disturbing visible selection", () => {
    const editor = hookMock.editor;
    const exactSelection = { moduleIds: ["source-account"], flowIds: ["income-flow"] };
    setSelection(editor, exactSelection);
    const view = render(<MoneyMapWorkspace starterId="annuity" onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /^Monthly$/ }));
    vi.mocked(editor.setSelection).mockClear();
    const unrelatedChange = {
      ...editor.document,
      flows: editor.document.flows.map((flow) =>
        flow.id === "funding-flow"
          ? { ...flow, cadence: { kind: "custom" as const, label: "At closing" } }
          : flow,
      ),
    };
    setDocument(editor, unrelatedChange);
    view.rerender(<MoneyMapWorkspace starterId="annuity" onBack={vi.fn()} />);

    expect(editor.setSelection).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^All$/ }));
    const selectedFlowChange = {
      ...unrelatedChange,
      flows: unrelatedChange.flows.map((flow) =>
        flow.id === "income-flow"
          ? { ...flow, cadence: { kind: "annual" as const, label: "Annual" } }
          : flow,
      ),
    };
    setDocument(editor, selectedFlowChange);
    view.rerender(<MoneyMapWorkspace starterId="annuity" onBack={vi.fn()} />);

    expect(editor.selection).toBe(exactSelection);
    expect(editor.setSelection).not.toHaveBeenCalled();
  });

  it.each([
    {
      surface: "more properties",
      invalid: { moduleIds: ["annuity-policy"], flowIds: ["income-flow"] },
      label: "Advanced properties",
    },
    {
      surface: "more properties",
      invalid: { moduleIds: ["source-account", "annuity-policy"], flowIds: [] },
      label: "Advanced properties",
    },
    {
      surface: "style module",
      invalid: { moduleIds: [], flowIds: [] },
      label: "Choose module style",
    },
  ])(
    "clears $surface for an invalid selection and does not reopen it for a later single module",
    ({ surface, invalid, label }) => {
      const view = render(<MoneyMapWorkspace starterId="annuity" onBack={vi.fn()} />);
      openCommand(surface);
      expect(screen.getByLabelText(label)).toBeTruthy();

      setSelection(hookMock.editor, invalid);
      view.rerender(<MoneyMapWorkspace starterId="annuity" onBack={vi.fn()} />);
      expect(screen.queryByLabelText(label)).toBeNull();

      setSelection(hookMock.editor, { moduleIds: ["source-account"], flowIds: [] });
      view.rerender(<MoneyMapWorkspace starterId="annuity" onBack={vi.fn()} />);
      expect(screen.queryByLabelText(label)).toBeNull();
    },
  );
});
