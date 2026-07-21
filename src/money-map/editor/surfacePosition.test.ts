import {
  findOpenModulePlacement,
  horizontalViewportShift,
  positionEditorSurface,
} from "./surfacePosition";

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

  it("flips to the left when an obstacle covers the preferred right-side placement", () => {
    const selected = { left: 400, right: 600, top: 100, bottom: 300 };
    const viewport = { width: 1000, height: 600 };
    const size = { width: 200, height: 200 };
    // Sits directly in the naive right-side slot (selected.right + margin = 616) but
    // leaves the left side (184..384) completely clear.
    const blockingObstacle = { left: 620, right: 900, top: 50, bottom: 500 };

    const position = positionEditorSurface(selected, viewport, size, [blockingObstacle]);

    expect(position.side).toBe("left");
    expect(position.left + size.width).toBeLessThanOrEqual(selected.left - 16);
    const rect = {
      left: position.left,
      right: position.left + size.width,
      top: position.top,
      bottom: position.top + size.height,
    };
    expect(
      rect.left < blockingObstacle.right &&
        rect.right > blockingObstacle.left &&
        rect.top < blockingObstacle.bottom &&
        rect.bottom > blockingObstacle.top,
    ).toBe(false);
  });

  it("never covers the selected object, and reaches past a blocked side to a clear slot further out", () => {
    const selected = { left: 400, right: 600, top: 100, bottom: 300 };
    const viewport = { width: 1200, height: 600 };
    const size = { width: 200, height: 200 };
    // Blocks both the flush-right slot (616..816) and runs right up to the viewport's
    // left margin, so flush-left has nowhere to go either -- but a clear lane exists
    // further right, past the obstacle.
    const obstacles = [
      { left: 616, right: 850, top: 50, bottom: 500 },
      { left: 0, right: 390, top: 0, bottom: 400 },
    ];

    const position = positionEditorSurface(selected, viewport, size, obstacles);

    const rect = {
      left: position.left,
      right: position.left + size.width,
      top: position.top,
      bottom: position.top + size.height,
    };
    // Never touches the object it edits.
    expect(rect.left < selected.right && rect.right > selected.left).toBe(false);
    // Clears every obstacle too -- a fully open slot exists past the blocker, so the
    // search should find it rather than settling for a merely "less bad" overlap.
    for (const obstacle of obstacles) {
      const overlaps =
        rect.left < obstacle.right &&
        rect.right > obstacle.left &&
        rect.top < obstacle.bottom &&
        rect.bottom > obstacle.top;
      expect(overlaps).toBe(false);
    }
  });

  it("when no slot avoids every obstacle's center, picks the side with more open room and still never covers the selection", () => {
    const selected = { left: 400, right: 600, top: 100, bottom: 300 };
    const viewport = { width: 1000, height: 600 };
    const size = { width: 200, height: 200 };
    // A field of obstacles dense enough that no 200-wide slot anywhere in the row
    // clears every center, but the right side of the viewport has more open room
    // (one obstacle in the way) than the left (which is fully walled off).
    const obstacles = [
      { left: 0, right: 390, top: 0, bottom: 400 },
      { left: 616, right: 700, top: 0, bottom: 400 },
      { left: 760, right: 840, top: 0, bottom: 400 },
    ];

    const position = positionEditorSurface(selected, viewport, size, obstacles);

    const rect = {
      left: position.left,
      right: position.left + size.width,
      top: position.top,
      bottom: position.top + size.height,
    };
    expect(rect.left < selected.right && rect.right > selected.left).toBe(false);
    expect(position.left).toBeGreaterThan(selected.right);
  });

  it("prefers grazing an obstacle's edge over covering its center -- a graze still leaves it clickable", () => {
    const selected = { left: 400, right: 600, top: 100, bottom: 300 };
    const viewport = { width: 1000, height: 600 };
    const size = { width: 200, height: 200 };
    // Sits mostly to the right of the flush-right slot but pokes 40px into it --
    // its center stays clear of that slot, so the surface shouldn't need to flip or
    // search at all.
    const grazedOnly = { left: 776, right: 900, top: 100, bottom: 300 };

    const position = positionEditorSurface(selected, viewport, size, [grazedOnly]);

    expect(position).toMatchObject({ left: 616, top: 100, side: "right" });
  });
});

describe("horizontal viewport shift for an externally anchored surface", () => {
  it("leaves a fully visible box alone", () => {
    expect(horizontalViewportShift({ left: 400, right: 800 }, 1280)).toBe(0);
  });

  it("shifts a left-clipped box right to the standard margin", () => {
    // The measured repro: a toolbar centered on a module at the viewport's
    // left edge landed at x = -102.
    expect(horizontalViewportShift({ left: -102, right: 350 }, 1280)).toBe(118);
  });

  it("shifts a right-clipped box left to the standard margin", () => {
    expect(horizontalViewportShift({ left: 1100, right: 1300 }, 1280)).toBe(-36);
  });

  it("pins the left edge when the box is wider than the viewport, keeping the leading commands reachable", () => {
    expect(horizontalViewportShift({ left: -200, right: 1400 }, 1280)).toBe(216);
  });
});

describe("collision-aware module placement", () => {
  const size = { width: 100, height: 80 };

  it("returns the preferred center untouched on an empty canvas", () => {
    const preferred = { x: 500, y: 400 };
    expect(findOpenModulePlacement(preferred, size, [])).toEqual({
      point: preferred,
      withinViewport: true,
    });
  });

  it("steps outward to an offset spot when the preferred center is occupied", () => {
    const preferred = { x: 500, y: 400 };
    const occupied = [{ x: preferred.x, y: preferred.y, width: size.width, height: size.height }];

    const placed = findOpenModulePlacement(preferred, size, occupied);

    expect(placed.point).not.toEqual(preferred);
    const placedFootprint = {
      x: placed.point.x,
      y: placed.point.y,
      width: size.width,
      height: size.height,
    };
    const overlaps =
      placedFootprint.x < occupied[0].x + occupied[0].width &&
      placedFootprint.x + placedFootprint.width > occupied[0].x &&
      placedFootprint.y < occupied[0].y + occupied[0].height &&
      placedFootprint.y + placedFootprint.height > occupied[0].y;
    expect(overlaps).toBe(false);
  });

  it("keeps searching well past the old ±560px envelope for a genuinely crowded document", () => {
    const preferred = { x: 0, y: 0 };
    const moduleSize = { width: 300, height: 200 };
    // A single occupied block larger than the pre-fix 14-ring/40px search bound
    // (±560px) but well inside the expanded envelope. The pre-fix search gave up
    // here and returned `preferred` unchanged, landing the new module on top of
    // this block — exactly the P1 stacking defect.
    const occupied = [{ x: -620, y: -620, width: 1240, height: 1240 }];

    const placed = findOpenModulePlacement(preferred, moduleSize, occupied);

    expect(placed.point).not.toEqual(preferred);
    const footprint = {
      x: placed.point.x - 24,
      y: placed.point.y - 24,
      width: moduleSize.width + 48,
      height: moduleSize.height + 48,
    };
    const overlaps =
      footprint.x < occupied[0].x + occupied[0].width &&
      footprint.x + footprint.width > occupied[0].x &&
      footprint.y < occupied[0].y + occupied[0].height &&
      footprint.y + footprint.height > occupied[0].y;
    expect(overlaps).toBe(false);
  });

  it("cascades to a new deterministic point instead of stacking when nothing is clear anywhere", () => {
    const preferred = { x: 500, y: 400 };
    const viewport = { left: 0, top: 0, right: 1000, bottom: 800 };
    const wall = { x: -10000, y: -10000, width: 20000, height: 20000 };

    const firstAdd = findOpenModulePlacement(preferred, size, [wall], viewport);
    expect(firstAdd.point).not.toEqual(preferred);

    const secondAdd = findOpenModulePlacement(
      preferred,
      size,
      [wall, { x: firstAdd.point.x, y: firstAdd.point.y, width: size.width, height: size.height }],
      viewport,
    );
    expect(secondAdd.point).not.toEqual(preferred);
    expect(secondAdd.point).not.toEqual(firstAdd.point);
  });
});

describe("placement viewport signal", () => {
  const size = { width: 100, height: 80 };

  it("reports withinViewport: true when a clear spot exists inside the visible area", () => {
    const preferred = { x: 800, y: 450 };
    const viewport = { left: 0, top: 0, right: 1600, bottom: 900 };

    const placed = findOpenModulePlacement(preferred, size, [], viewport);

    expect(placed.withinViewport).toBe(true);
  });

  it("reports withinViewport: false when the search must fall back outside the visible area, so the caller knows to pan the camera", () => {
    const preferred = { x: 800, y: 450 };
    const viewport = { left: 0, top: 0, right: 1600, bottom: 900 };
    // Covers the entire viewport (plus margin), so no in-viewport ring can ever be
    // clear and the search must fall through to the outside-viewport pass — the
    // exact repro the reviewer measured: a new module landing ~1250px below the
    // viewport bottom with nothing to report it.
    const occupied = [{ x: -100, y: -100, width: 1800, height: 1100 }];

    const placed = findOpenModulePlacement(preferred, size, occupied, viewport);

    expect(placed.withinViewport).toBe(false);
    const footprint = {
      x: placed.point.x,
      y: placed.point.y,
      width: size.width,
      height: size.height,
    };
    const inViewport =
      footprint.x >= viewport.left &&
      footprint.y >= viewport.top &&
      footprint.x + footprint.width <= viewport.right &&
      footprint.y + footprint.height <= viewport.bottom;
    expect(inViewport).toBe(false);
  });

  it("reports withinViewport: true (never triggers a pan) when the caller has no viewport geometry to measure against", () => {
    const preferred = { x: 500, y: 400 };
    const occupied = [{ x: 500, y: 400, width: size.width, height: size.height }];

    const placed = findOpenModulePlacement(preferred, size, occupied);

    expect(placed.withinViewport).toBe(true);
  });
});
