import { createTestDocument } from "../model/test-fixtures";
import { clampModuleSize, resizeModule } from "./adapters";

describe("two-axis module resize", () => {
  it("clamps both axes to content-safe bounds", () => {
    const module = createTestDocument().modules[1];
    expect(clampModuleSize(module, { width: 100, height: 40 })).toEqual({
      width: 220,
      height: 152,
    });
    expect(clampModuleSize(module, { width: 900, height: 900 })).toEqual({
      width: 520,
      height: 520,
    });
  });

  it("changes width and height while preserving authored content", () => {
    const document = createTestDocument();
    const resized = resizeModule(document, "annuity-policy", { width: 430, height: 310 });
    expect(resized.modules[1]).toMatchObject({ width: 430, height: 310 });
    expect(resized.modules[1].rows).toBe(document.modules[1].rows);
    expect(resized.modules[1].title).toBe(document.modules[1].title);
  });

  it("does not resize a rotated object", () => {
    const document = createTestDocument();
    const rotated = {
      ...document,
      modules: document.modules.map((module, index) =>
        index === 1 ? { ...module, rotation: 15 } : module,
      ),
    };
    expect(resizeModule(rotated, "annuity-policy", { width: 430, height: 310 })).toBe(rotated);
  });
});
