import { positionEditorSurface } from "./surfacePosition";

describe("editor surface placement", () => {
  it("uses the right side when viable and flips left near the viewport edge", () => {
    expect(
      positionEditorSurface(
        { left: 200, right: 500, top: 120, bottom: 360 },
        { width: 1400, height: 900 },
      ),
    ).toMatchObject({ left: 516, top: 120, side: "right" });

    expect(
      positionEditorSurface(
        { left: 980, right: 1280, top: 700, bottom: 860 },
        { width: 1400, height: 900 },
      ),
    ).toMatchObject({ left: 612, top: 484, side: "left" });
  });

  it("clamps within the viewport when neither side fully fits", () => {
    const position = positionEditorSurface(
      { left: 120, right: 420, top: 20, bottom: 500 },
      { width: 620, height: 560 },
    );
    expect(position.left).toBeGreaterThanOrEqual(16);
    expect(position.left + 352).toBeLessThanOrEqual(604);
    expect(position.top).toBeGreaterThanOrEqual(88);
  });
});
