import { createTestDocument } from "../model/test-fixtures";
import type { PrimitiveStyle } from "../model/types";
import { createWorkspaceCommands, type WorkspaceCommandContext } from "./commands";

function context(moduleIds = ["annuity-policy"]): WorkspaceCommandContext {
  return {
    document: createTestDocument(),
    selection: { moduleIds, flowIds: [] },
    canUndo: true,
    canRedo: false,
  };
}

describe("workspace command registry", () => {
  it("returns the same canonical command object for every invocation surface", () => {
    const registry = createWorkspaceCommands(() => "copy-id");
    const fromHalo = registry.get("selection.duplicate");
    const fromPalette = registry.search("clone", context())[0];
    expect(fromHalo).toBe(fromPalette);
    expect(fromHalo?.execute(context())).toMatchObject({ kind: "mutation" });
  });

  it("registers canonical commands in stable order and hides unavailable commands", () => {
    const registry = createWorkspaceCommands(() => "copy-id");
    const empty = { ...context([]), canUndo: false };
    expect(registry.available(empty).map(({ id }) => id)).toEqual(["document.reset"]);
    expect(registry.available(context()).map(({ id }) => id)).toEqual([
      "module.edit",
      "module.style",
      "module.draw-flow",
      "module.properties",
      "selection.duplicate",
      "module.order.forward",
      "module.order.back",
      "selection.remove",
      "history.undo",
      "document.reset",
      "module.width.small",
      "module.width.standard",
      "module.width.wide",
      "module.primitive.ledger",
      "module.primitive.plate",
      "module.primitive.tray",
      "module.primitive.band",
      "module.primitive.roundel",
      "module.primitive.frame",
      "module.primitive.cylinder",
      "module.primitive.text",
      "module.priority.quiet",
      "module.priority.standard",
      "module.priority.spotlight",
      "module.density.essential",
      "module.density.standard",
      "module.density.full",
      "module.swatch.base",
      "module.swatch.muted",
      "module.swatch.accent",
      "module.swatch.contrast",
    ]);
  });

  it.each([
    ["module.width.small", 240],
    ["module.width.standard", 320],
    ["module.width.wide", 400],
  ])("changes width only through %s", (id, width) => {
    const commandContext = context();
    const document = commandContext.document;
    const result = createWorkspaceCommands(() => "unused")
      .get(id)
      ?.execute(commandContext);
    if (!result || result.kind !== "mutation") throw new Error("Expected mutation");
    const module = result.mutation.document.modules[1];
    expect(module.width).toBe(width);
    expect(module.title).toBe(document.modules[1].title);
    expect(module.rows).toBe(document.modules[1].rows);
  });

  it.each<PrimitiveStyle>([
    "ledger",
    "plate",
    "tray",
    "band",
    "roundel",
    "frame",
    "cylinder",
    "text",
  ])("changes primitive only to %s", (primitive) => {
    const commandContext = context();
    const document = commandContext.document;
    const result = createWorkspaceCommands(() => "unused")
      .get(`module.primitive.${primitive}`)
      ?.execute(commandContext);
    if (!result || result.kind !== "mutation") throw new Error("Expected mutation");
    const module = result.mutation.document.modules[1];
    expect(module.primitive).toBe(primitive);
    expect(module.width).toBe(document.modules[1].width);
    expect(module.rows).toBe(document.modules[1].rows);
  });

  it("duplicates with injected IDs and returns the new selection; remove clears selection", () => {
    const ids = ["module-copy", "row-1", "row-2", "row-3", "flow-copy"];
    const registry = createWorkspaceCommands(() => ids.shift() ?? "next-id");
    const duplicated = registry.get("selection.duplicate")?.execute(context());
    const removed = registry.get("selection.remove")?.execute(context());
    expect(duplicated).toMatchObject({
      kind: "mutation",
      nextSelection: { moduleIds: ["module-copy"], flowIds: [] },
    });
    expect(removed).toMatchObject({
      kind: "mutation",
      nextSelection: { moduleIds: [], flowIds: [] },
    });
  });

  it("aligns, distributes, layers, and styles through canonical literal-safe commands", () => {
    const registry = createWorkspaceCommands(() => "unused");
    const three = context(["source-account", "annuity-policy", "monthly-need"]);
    const aligned = registry.get("selection.align.top")?.execute(three);
    const distributed = registry.get("selection.distribute.horizontal")?.execute(three);
    const spotlight = registry.get("module.priority.spotlight")?.execute(three);
    const accent = registry.get("module.swatch.accent")?.execute(three);
    const forward = registry.get("module.order.forward")?.execute(three);
    for (const result of [aligned, distributed, spotlight, accent, forward]) {
      if (!result || result.kind !== "mutation") throw new Error("Expected mutation");
    }
    if (!aligned || aligned.kind !== "mutation") return;
    expect(new Set(aligned.mutation.document.modules.map(({ position }) => position.y))).toEqual(
      new Set([80]),
    );
    if (!spotlight || spotlight.kind !== "mutation") return;
    expect(
      spotlight.mutation.document.modules.every(({ priority }) => priority === "spotlight"),
    ).toBe(true);
    if (!accent || accent.kind !== "mutation") return;
    expect(accent.mutation.document.modules.every(({ swatch }) => swatch === "accent")).toBe(true);
    if (!forward || forward.kind !== "mutation") return;
    expect(forward.mutation.document.modules.map(({ zIndex }) => zIndex)).toEqual([1, 2, 3]);
    expect(forward.mutation.document.modules[0].rows[0].value).toBe("$250,000");
    expect(three.document.modules[1].total?.value).toBe("$300,000");
  });

  it("treats one module plus one relationship as a group context", () => {
    const registry = createWorkspaceCommands(() => "copy-id");
    const mixed = {
      ...context(),
      selection: { moduleIds: ["annuity-policy"], flowIds: ["income-flow"] },
    };
    const available = registry.available(mixed).map(({ id }) => id);

    expect(available).toContain("selection.duplicate");
    expect(available).toContain("selection.remove");
    expect(available).not.toContain("module.edit");
    expect(available).not.toContain("module.style");
    expect(available).not.toContain("module.draw-flow");
    expect(available).not.toContain("module.properties");
  });

  it("exposes canonical relationship commands only for one flow selection", () => {
    const registry = createWorkspaceCommands(() => "unused");
    const flowContext = {
      ...context([]),
      selection: { moduleIds: [], flowIds: ["funding-flow"] },
    };
    const ids = registry.available(flowContext).map(({ id }) => id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "flow.edit",
        "flow.properties",
        "flow.route.straight",
        "flow.route.orthogonal",
        "flow.route.curved",
        "flow.relationship.income",
        "flow.relationship.transfer",
        "flow.relationship.replenishment",
        "flow.relationship.planned",
        "flow.label-treatment.plain",
        "flow.label-treatment.plate",
        "flow.label-treatment.filled",
        "flow.cadence.monthly",
        "flow.cadence.annual",
        "flow.cadence.one-time",
        "flow.cadence.as-needed",
        "flow.cadence.custom",
        "flow.label-position.reset",
      ]),
    );
    expect(registry.get("flow.route.curved")).toBe(registry.search("curved", flowContext)[0]);
    expect(
      registry
        .available({
          ...flowContext,
          selection: { moduleIds: ["source-account"], flowIds: ["funding-flow"] },
        })
        .some(({ id }) => id.startsWith("flow.")),
    ).toBe(false);
  });
});
