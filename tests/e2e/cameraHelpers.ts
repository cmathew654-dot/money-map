import { expect, type Page } from "@playwright/test";

/**
 * Waits for the authoring camera to stop moving, then reports it.
 *
 * Opening a starter runs an animated fitView. Anything that converts between
 * screen and world coordinates — a pointer drag, a hit test, a measured
 * offset — is meaningless until that lands, because both zoom and pan are
 * still changing underneath it. Two consecutive matching reads, not one: a
 * single comparison can be satisfied before the animation has started.
 *
 * Shared by app.spec.ts and surfaces.spec.ts, which both anchor screen-space
 * assertions to a settled camera.
 */
export async function settledCanvasCamera(
  page: Page,
): Promise<{ zoom: number; x: number; y: number }> {
  const read = () =>
    page.locator(".money-map-canvas .react-flow__viewport").evaluate((element) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return { zoom: matrix.a, x: matrix.e, y: matrix.f };
    });

  let previous = await read();
  let stableRuns = 0;
  await expect
    .poll(
      async () => {
        const current = await read();
        const stable =
          Math.abs(current.x - previous.x) < 0.5 &&
          Math.abs(current.y - previous.y) < 0.5 &&
          Math.abs(current.zoom - previous.zoom) < 0.001;
        previous = current;
        stableRuns = stable ? stableRuns + 1 : 0;
        return stableRuns >= 2;
      },
      { timeout: 5000, intervals: [100] },
    )
    .toBe(true);
  return previous;
}
