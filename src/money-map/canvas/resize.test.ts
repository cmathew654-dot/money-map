import { createTestDocument } from "../model/test-fixtures";
import { clampModuleWidth, resizeModule } from "./adapters";

describe("horizontal module resize", () => {
  it.each([
    [100, 220],
    [320, 320],
    [800, 480],
  ])("clamps %s to %s", (input, expected) => {
    expect(clampModuleWidth(input)).toBe(expected);
  });

  it("changes width only and preserves content, height-free geometry, and text data", () => {
    const document = createTestDocument();
    const resized = resizeModule(document, "annuity-policy", 800);
    expect(resized.modules[1].width).toBe(480);
    expect(resized.modules[1].rows).toBe(document.modules[1].rows);
    expect(resized.modules[1].title).toBe(document.modules[1].title);
    expect(resized.modules[1]).not.toHaveProperty("height");
  });
});
