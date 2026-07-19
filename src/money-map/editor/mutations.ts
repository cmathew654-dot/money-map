import { updateModule } from "../model/document";
import type { MoneyMapDocument, Selection } from "../model/types";

export type ModuleField =
  | { field: "title" | "eyebrow" | "subtitle" | "note" }
  | { field: "row-label" | "row-value"; rowId: string }
  | { field: "total-label" | "total-value" };

export function editModuleField(
  document: MoneyMapDocument,
  moduleId: string,
  target: ModuleField,
  literal: string,
): MoneyMapDocument {
  return updateModule(document, moduleId, (module) => {
    if (target.field === "title" || target.field === "eyebrow") {
      return module[target.field] === literal ? module : { ...module, [target.field]: literal };
    }
    if (target.field === "subtitle" || target.field === "note") {
      return module[target.field] === literal ? module : { ...module, [target.field]: literal };
    }
    if (target.field === "row-label" || target.field === "row-value") {
      const rowIndex = module.rows.findIndex(({ id }) => id === target.rowId);
      if (rowIndex === -1) return module;
      const key = target.field === "row-label" ? "label" : "value";
      if (module.rows[rowIndex][key] === literal) return module;
      const rows = [...module.rows];
      rows[rowIndex] = { ...rows[rowIndex], [key]: literal };
      return { ...module, rows };
    }
    if (!module.total) return module;
    const key = target.field === "total-label" ? "label" : "value";
    if (module.total[key] === literal) return module;
    return { ...module, total: { ...module.total, [key]: literal } };
  });
}

export function nudgeSelection(
  document: MoneyMapDocument,
  selection: Selection,
  delta: { x: number; y: number },
): MoneyMapDocument {
  return selection.moduleIds.reduce(
    (current, moduleId) =>
      updateModule(current, moduleId, (module) => ({
        ...module,
        position: {
          x: module.position.x + delta.x,
          y: module.position.y + delta.y,
        },
      })),
    document,
  );
}
