import { createTestDocument } from "../model/test-fixtures";
import { editModuleField, nudgeSelection } from "./mutations";

describe("editor mutations", () => {
  it("edits one nested literal while preserving unrelated references and data", () => {
    const document = createTestDocument();
    const edited = editModuleField(
      document,
      "annuity-policy",
      { field: "row-value", rowId: "income" },
      "$20,000\u2013?",
    );
    expect(edited.modules[1].rows[1].value).toBe("$20,000\u2013?");
    expect(edited.modules[0]).toBe(document.modules[0]);
    expect(edited.modules[1].rows[0]).toBe(document.modules[1].rows[0]);
    expect(edited.flows).toBe(document.flows);
  });

  it("nudges selected modules by 8 or 32 world pixels without touching literals", () => {
    const document = createTestDocument();
    const selection = { moduleIds: ["annuity-policy"], flowIds: [] };
    const nudged = nudgeSelection(document, selection, { x: -32, y: 8 });
    expect(nudged.modules[1].position).toEqual({
      x: document.modules[1].position.x - 32,
      y: document.modules[1].position.y + 8,
    });
    expect(nudged.modules[1].rows).toBe(document.modules[1].rows);
    expect(nudged.modules[0]).toBe(document.modules[0]);
  });
});
