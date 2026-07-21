import { expect, test, type Page } from "@playwright/test";

const stories = [
  "Retirement Income",
  "RMD & Withholding",
  "Annuity Income Floor",
  "Roth Conversion",
] as const;

const viewports = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

interface CameraState {
  x: number;
  y: number;
  scale: number;
}

/**
 * Reads the presentation camera once it has stopped moving.
 *
 * fitStep()/fitView animate for 220ms and re-register a resize listener on
 * every step change, so camera assertions used to sleep a fixed 400ms and
 * hope the animation had finished — the classic ingredient of a flake, and
 * one that was masked rather than fixed by enabling local retries. Polling
 * until two consecutive reads agree waits exactly as long as the machine
 * needs, and fails loudly if the camera never settles.
 */
async function settledCamera(page: Page): Promise<CameraState> {
  const read = (): Promise<CameraState> =>
    page.locator(".react-flow__viewport").evaluate((element) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return { x: matrix.e, y: matrix.f, scale: matrix.a };
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
          Math.abs(current.scale - previous.scale) < 0.001;
        previous = current;
        // Two consecutive stable reads, not one. A single comparison can be
        // satisfied by a camera that has not started animating yet, which
        // would return the pre-move framing and read as "never reframed".
        stableRuns = stable ? stableRuns + 1 : 0;
        return stableRuns >= 2;
      },
      { timeout: 5000, intervals: [100] },
    )
    .toBe(true);
  return previous;
}

async function openPresentation(page: Page, story: (typeof stories)[number]) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: new RegExp(story) }).click();
  const present = page.getByRole("button", { name: "Present" });
  await expect(present).toHaveCount(1);
  await present.click();
  await expect(page.getByRole("main", { name: `${story} presentation` })).toBeFocused();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

test("all four starters retain metadata and the same Overview plus five-step system", async ({
  page,
}) => {
  for (const story of stories) {
    await openPresentation(page, story);
    await expect(page.getByRole("heading", { name: story })).toBeVisible();
    await expect(page.getByText("As of July 2026")).toBeVisible();
    await expect(page.getByText("Synthetic demo \u00b7 advisor-entered values")).toBeVisible();
    await expect(page.getByRole("button", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    // Overview plus five named steps in the rail.
    await expect(page.locator(".presentation-rail__step")).toHaveCount(6);

    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".presentation-rail__step").nth(1)).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(page.locator(".money-map-presentation > [role='status']")).toContainText(
      "step 1 of 5",
    );
    await page.keyboard.press("Space");
    await expect(page.locator(".presentation-rail__step").nth(2)).toHaveAttribute(
      "aria-current",
      "step",
    );
  }
});

test("presentation focus, tab order, direct navigation, and Escape stay presentation-only", async ({
  page,
}) => {
  await openPresentation(page, "Retirement Income");
  await expect(page.getByRole("button", { name: /Actions/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back to stories" })).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "Canvas camera" })).toHaveCount(1);
  await expect(page.getByRole("toolbar", { name: /cadence/i })).toHaveCount(0);
  await expect(page.locator(".selection-halo, .advanced-properties, .add-menu")).toHaveCount(0);

  const tabbableLabels = await page
    .locator(".money-map-presentation")
    .evaluate((shell) =>
      [...shell.querySelectorAll<HTMLElement>("a, button, input, select, textarea, [tabindex]")]
        .filter((element) => element.tabIndex >= 0 && !element.hasAttribute("disabled"))
        .map((element) => element.getAttribute("aria-label") ?? element.textContent?.trim()),
    );
  const railTitles = await page
    .locator(".presentation-rail__step")
    .evaluateAll((buttons) => buttons.map((button) => button.textContent?.trim()));
  // The camera recovery toolbar is a deliberate, roving-tabindex addition:
  // exactly one of its buttons is tabbable at a time. Tab order follows DOM
  // order: the optional relationship-legend toggle (header chrome, closed by
  // default so only its toggle is tabbable), then Exit, then the rail
  // (Overview, then the five named steps), then the camera toolbar.
  expect(tabbableLabels).toHaveLength(9);
  expect(tabbableLabels[0]).toBe("Legend");
  expect(tabbableLabels[1]).toBe("Exit presentation");
  expect(tabbableLabels.slice(2, 8)).toEqual(railTitles);
  expect(tabbableLabels[8]).toBe("Zoom out");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Legend" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Exit presentation" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Overview" })).toBeFocused();
  await page.keyboard.press("Tab");
  const firstStep = page.locator(".presentation-rail__step").nth(1);
  await expect(firstStep).toBeFocused();
  await firstStep.press("Space");
  await expect(firstStep).toHaveAttribute("aria-current", "step");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Present" })).toBeFocused();
});

test("a focused step de-emphasizes non-participants without hiding them or moving the camera onto blank space", async ({
  page,
}) => {
  await openPresentation(page, "Retirement Income");
  const totalModules = await page.locator(".money-map-module").count();

  // Overview shows everything at full strength: nothing is dimmed.
  expect(await page.locator('.money-map-module[data-presentation-dim="true"]').count()).toBe(0);

  await page.locator(".presentation-rail__step").nth(1).click();
  await expect(page.locator(".presentation-rail__step").nth(1)).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.locator(".money-map-presentation > [role='status']")).toContainText(
    "step 1 of 5",
  );

  // This starter's first step focuses exactly two modules (income, need); every
  // other authored module recedes, but none disappear from the DOM.
  const focused = page.locator('.money-map-module[data-presentation-focus="true"]');
  const dimmed = page.locator('.money-map-module[data-presentation-dim="true"]');
  await expect(focused).toHaveCount(2);
  await expect(dimmed).toHaveCount(totalModules - 2);

  await expect(focused.first()).toHaveCSS("opacity", "1");
  // Lowered from 0.3 to 0.15 (canvas.css) so non-focused content recedes
  // cleanly instead of competing with the focused participants.
  await expect(dimmed.first()).toHaveCSS("opacity", "0.15");
  // Dimmed content still occupies its authored geometry (visual-only de-emphasis).
  const dimmedBox = await dimmed.first().boundingBox();
  expect(dimmedBox?.width ?? 0).toBeGreaterThan(0);
  expect(dimmedBox?.height ?? 0).toBeGreaterThan(0);

  // The camera reframed onto the step's participants: a focused module is
  // visible on stage rather than left off-screen.
  await expect(focused.first()).toBeInViewport();
});

test("presentation camera recovery controls and shortcuts restore a lost view", async ({
  page,
}) => {
  await openPresentation(page, "Retirement Income");
  const toolbar = page.getByRole("toolbar", { name: "Canvas camera" });
  await expect(toolbar.getByRole("button", { name: "Zoom out" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Fit story" })).toBeVisible();
  const zoomLabel = toolbar.getByRole("button", { name: /Reset zoom to/ });

  // The toolbar lives in the chrome bar, never overlapping the stage or its
  // authored content (regression: it previously floated over bottom-right cards).
  const toolbarBox = await toolbar.boundingBox();
  const stageBox = await page.locator(".presentation-stage").boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  if (toolbarBox && stageBox) {
    expect(toolbarBox.y >= stageBox.y + stageBox.height - 1).toBe(true);
  }

  await toolbar.getByRole("button", { name: "Zoom in" }).click();
  await expect(zoomLabel).not.toHaveText("100%");

  await toolbar.getByRole("button", { name: "Fit story" }).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();

  // Ctrl/Cmd +/- work while the presentation shell (not the canvas) holds focus.
  await page.getByRole("main", { name: "Retirement Income presentation" }).focus();
  const before = await zoomLabel.textContent();
  await page.keyboard.press("Control+=");
  await expect(zoomLabel).not.toHaveText(before ?? "");
});

test("story steps reframe the camera automatically without clicking Fit story", async ({
  page,
}) => {
  await openPresentation(page, "Retirement Income");

  const overview = await settledCamera(page);

  await page.locator(".presentation-rail__step").nth(1).click();
  // This is what would have caught defect 4: the camera must visibly move
  // onto the step's participants, not silently keep the Overview framing.
  // Polled on the distance itself rather than sampled once after a settle,
  // so the assertion waits for the reframe instead of racing its start, and
  // measured in pixels/scale rather than by string inequality.
  const distanceFrom = (from: CameraState) =>
    page.locator(".react-flow__viewport").evaluate((element, origin) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return (
        Math.abs(matrix.e - origin.x) +
        Math.abs(matrix.f - origin.y) +
        Math.abs(matrix.a - origin.scale) * 1000
      );
    }, from);

  await expect
    .poll(() => distanceFrom(overview), { timeout: 5000, intervals: [100] })
    .toBeGreaterThan(10);
  await settledCamera(page);

  await page.getByRole("button", { name: "Overview" }).click();
  // Overview always fits the whole story back. Polled and compared with a
  // tolerance: this is a float matrix produced by an animated fitView, and
  // asserting exact equality on its serialised form made a real behavioural
  // check hostage to sub-pixel rounding.
  await expect
    .poll(() => distanceFrom(overview), { timeout: 5000, intervals: [100] })
    .toBeLessThan(2);
});

test("author shortcuts cannot mutate a selected document behind presentation", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/ }).click();
  const modules = page.locator(".money-map-module");
  const before = await modules.count();
  await modules.first().click();
  await page.getByRole("button", { name: "Present" }).click();

  const shell = page.getByRole("main", { name: "Annuity Income Floor presentation" });
  await shell.press("Delete");
  await shell.press("Backspace");
  await shell.press("Control+k");
  await shell.press("Control+z");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Exit presentation" }).click();
  await expect(page.locator(".money-map-module")).toHaveCount(before);
});

for (const viewport of viewports) {
  test(`keeps every presentation bounded and readable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const story of stories) {
      await openPresentation(page, story);
      // Every measurement below is scale-dependent, so read them against a
      // camera that has finished animating rather than a fixed sleep.
      await settledCamera(page);
      const audit = await page.locator(".money-map-presentation").evaluate((shell) => {
        const stage = shell
          .querySelector<HTMLElement>(".presentation-stage")
          ?.getBoundingClientRect();
        if (!stage) throw new Error("Expected presentation stage");
        const viewportElement = shell.querySelector<HTMLElement>(".react-flow__viewport");
        const transform = viewportElement ? getComputedStyle(viewportElement).transform : "none";
        const scale = transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a;
        const bounds = [...shell.querySelectorAll<HTMLElement>(".react-flow__node")].map((node) =>
          node.getBoundingClientRect(),
        );
        const nodeEntries = [...shell.querySelectorAll<HTMLElement>(".react-flow__node")].map(
          (node) => ({
            id: node.dataset.id ?? "",
            box: node.getBoundingClientRect(),
            element: node,
            body:
              node.querySelector<HTMLElement>(".money-map-module")?.getBoundingClientRect() ??
              node.getBoundingClientRect(),
          }),
        );
        const labelEntries = [
          ...shell.querySelectorAll<HTMLElement>(".money-map-flow-label-wrap"),
        ].map((label) => ({
          id: label.dataset.flowLabelId ?? "",
          source: label.dataset.flowSource ?? "",
          target: label.dataset.flowTarget ?? "",
          box: label.getBoundingClientRect(),
        }));
        const contentOverflows = nodeEntries.flatMap(({ id, element }) => {
          const body = element.querySelector<HTMLElement>(".money-map-module");
          if (!body) return [];
          return body.scrollHeight > body.clientHeight + 4 ||
            body.scrollWidth > body.clientWidth + 4
            ? [
                {
                  id,
                  scrollHeight: body.scrollHeight,
                  clientHeight: body.clientHeight,
                  scrollWidth: body.scrollWidth,
                  clientWidth: body.clientWidth,
                },
              ]
            : [];
        });
        const intersects = (first: DOMRect, second: DOMRect, inset = 0) =>
          first.left < second.right - inset &&
          first.right > second.left + inset &&
          first.top < second.bottom - inset &&
          first.bottom > second.top + inset;
        const overlaps = bounds.flatMap((first, index) =>
          bounds
            .slice(index + 1)
            .filter(
              (second) =>
                first.left < second.right &&
                first.right > second.left &&
                first.top < second.bottom &&
                first.bottom > second.top,
            ),
        ).length;
        const overlapPairs = bounds.flatMap((first, index) =>
          bounds.slice(index + 1).flatMap((second, offset) =>
            first.left < second.right &&
            first.right > second.left &&
            first.top < second.bottom &&
            first.bottom > second.top
              ? [
                  {
                    first: index,
                    second: index + offset + 1,
                    vertical:
                      Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
                  },
                ]
              : [],
          ),
        );
        const labelLabelPairs = labelEntries.flatMap((first, index) =>
          labelEntries
            .slice(index + 1)
            .flatMap((second) =>
              intersects(first.box, second.box, 1) ? [`${first.id}/${second.id}`] : [],
            ),
        );
        // A label may touch its own source or target at the authored attachment point;
        // only collisions with unrelated modules are presentation defects.
        const labelModulePairs = labelEntries.flatMap((label) =>
          nodeEntries.flatMap(({ id, box }) =>
            id !== label.source && id !== label.target && intersects(label.box, box, 1)
              ? [label.id + "/" + id]
              : [],
          ),
        );
        const deepEndpointPairs = labelEntries.flatMap((label) =>
          nodeEntries.flatMap(({ id, body }) => {
            if (id !== label.source && id !== label.target) return [];
            const horizontal =
              Math.min(label.box.right, body.right) - Math.max(label.box.left, body.left);
            const vertical =
              Math.min(label.box.bottom, body.bottom) - Math.max(label.box.top, body.top);
            return horizontal > 8 && vertical > 8 ? [label.id + "/" + id] : [];
          }),
        );
        const visualModulePairs = nodeEntries.flatMap((first, index) =>
          nodeEntries
            .slice(index + 1)
            .flatMap((second) =>
              intersects(first.body, second.body, 1) ? [first.id + "/" + second.id] : [],
            ),
        );
        const unrelatedPathModulePairs = [
          ...shell.querySelectorAll<SVGPathElement>(".money-map-relationship-path"),
        ].flatMap((path) => {
          const owner = path.closest<SVGGElement>("g[data-flow-source]");
          const flowId = owner?.dataset.flowId ?? "";
          const source = owner?.dataset.flowSource;
          const target = owner?.dataset.flowTarget;
          const matrix = path.getScreenCTM();
          const length = path.getTotalLength();
          if (!matrix || length <= 0) return [];
          const unrelated = nodeEntries.filter(({ id }) => id !== source && id !== target);
          return unrelated.flatMap(({ id, box }) => {
            for (let distance = 4; distance < length - 4; distance += 4) {
              const localPoint = path.getPointAtLength(distance);
              const point = new DOMPoint(localPoint.x, localPoint.y).matrixTransform(matrix);
              if (
                point.x > box.left + 1 &&
                point.x < box.right - 1 &&
                point.y > box.top + 1 &&
                point.y < box.bottom - 1
              )
                return [`${flowId}/${id}`];
            }
            return [];
          });
        });
        const minimumRenderedSize = (selector: string) => {
          const values = [...shell.querySelectorAll<HTMLElement>(selector)].map(
            (element) => Number.parseFloat(getComputedStyle(element).fontSize) * scale,
          );
          return values.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...values);
        };
        // Ink-level check: a row's own label and value must never share ink,
        // even if the row's outer box is fine. Rectangle intersection of the
        // dt/dd elements themselves (not the row container) catches the
        // "Balanc$185,000" overprint that box-overflow probes miss.
        const rowInkOverlapPairs = [
          ...shell.querySelectorAll<HTMLElement>(
            ".money-map-module__row, .money-map-module__total > div",
          ),
        ].flatMap((row) => {
          const label = row.querySelector<HTMLElement>("dt");
          const value = row.querySelector<HTMLElement>("dd");
          if (!label || !value) return [];
          const labelBox = label.getBoundingClientRect();
          const valueBox = value.getBoundingClientRect();
          if (labelBox.width === 0 || valueBox.width === 0) return [];
          return intersects(labelBox, valueBox)
            ? [`${label.textContent ?? ""}/${value.textContent ?? ""}`]
            : [];
        });
        // Ellipse-aware containment: a roundel's content box is a rectangle,
        // but the module renders as an ellipse inscribed in that rectangle,
        // so text tucked in a corner is inside the box and outside the shape.
        //
        // This samples text INK, not element boxes. An element's
        // getBoundingClientRect is the block box — full content width
        // regardless of how short the text is — plus line-height leading
        // above and below the glyphs. Measuring that overstates the ink so
        // badly that containment could only be expressed as a tolerance
        // (previously <= 1.46, a ~3% band against the known-bad value, on a
        // quantity sensitive to font loading and line-height rounding: a
        // font-version bump flipped it either way with no real change).
        //
        // Range.getClientRects returns one rect per rendered LINE, width
        // being the actual text advance. Insetting each to its em box drops
        // the half-leading. What remains is close enough to real ink that
        // the assertion is plain geometric containment (<= 1) with no
        // tolerance to calibrate. Authored worst case measures 0.918.
        const roundelTextOverflow = [
          ...shell.querySelectorAll<HTMLElement>('.money-map-module[data-primitive="roundel"]'),
        ].flatMap((roundel) => {
          const box = roundel.getBoundingClientRect();
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          const rx = box.width / 2;
          const ry = box.height / 2;
          if (rx === 0 || ry === 0) return [];
          const outside = (x: number, y: number) => {
            const nx = (x - cx) / rx;
            const ny = (y - cy) / ry;
            return nx * nx + ny * ny > 1;
          };
          const textElements = [
            ...roundel.querySelectorAll<HTMLElement>(
              ".money-map-module__header h2, .money-map-module__eyebrow, .money-map-module__subtitle, .money-map-module dt, .money-map-module dd, .money-map-module__note",
            ),
          ];
          return textElements.flatMap((element) => {
            const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
            const range = document.createRange();
            range.selectNodeContents(element);
            return [...range.getClientRects()].flatMap((line) => {
              if (line.width === 0 || line.height === 0) return [];
              const leading = Math.max(0, (line.height - fontSize) / 2);
              const top = line.top + leading;
              const bottom = line.bottom - leading;
              const corners: Array<[number, number]> = [
                [line.left, top],
                [line.right, top],
                [line.left, bottom],
                [line.right, bottom],
              ];
              return corners.some(([x, y]) => outside(x, y))
                ? [`${roundel.getAttribute("data-kind") ?? ""}:${element.textContent ?? ""}`]
                : [];
            });
          });
        });
        return {
          scale,
          overlaps,
          overlapPairs,
          contentOverflows,
          visualModulePairs,
          deepEndpointPairs,
          rowInkOverlapPairs,
          roundelTextOverflow,
          labelsBounded: labelEntries.every(
            ({ box }) =>
              box.left >= stage.left - 1 &&
              box.right <= stage.right + 1 &&
              box.top >= stage.top - 1 &&
              box.bottom <= stage.bottom + 1,
          ),
          labelLabelOverlaps: labelLabelPairs.length,
          labelLabelPairs,
          labelModuleOverlaps: labelModulePairs.length,
          labelModulePairs,
          unrelatedPathModuleIntersections: unrelatedPathModulePairs.length,
          unrelatedPathModulePairs,
          nodesBounded: bounds.every(
            (box) =>
              box.left >= stage.left - 1 &&
              box.right <= stage.right + 1 &&
              box.top >= stage.top - 1 &&
              box.bottom <= stage.bottom + 1,
          ),
          chromeBounded: [...shell.querySelectorAll<HTMLElement>(".presentation-chrome")].every(
            (element) => {
              const box = element.getBoundingClientRect();
              return (
                box.left >= 0 &&
                box.top >= 0 &&
                box.right <= innerWidth &&
                box.bottom <= innerHeight
              );
            },
          ),
          eyebrow: minimumRenderedSize(".money-map-module__eyebrow"),
          detail: minimumRenderedSize(
            ".money-map-module dt, .money-map-module dd, .money-map-module__note",
          ),
          primaryValue: (() => {
            const values = [
              ...shell.querySelectorAll<HTMLElement>(".money-map-module__total dd"),
            ].map((element) => Number.parseFloat(getComputedStyle(element).fontSize) * scale);
            return values.length === 0 ? null : Math.min(...values);
          })(),
          flow: minimumRenderedSize(
            ".money-map-flow-label strong, .money-map-flow-label span, .money-map-flow-label small",
          ),
          title: minimumRenderedSize(".money-map-module__header h2"),
        };
      });

      expect(audit.nodesBounded, story + " nodes bounded " + JSON.stringify(audit)).toBe(true);
      expect(audit.labelsBounded, story + " labels bounded " + JSON.stringify(audit)).toBe(true);
      expect(audit.chromeBounded, story + " chrome bounded").toBe(true);
      expect(audit.contentOverflows, story + " module content overflow").toEqual([]);
      expect(audit.visualModulePairs, story + " rendered module collisions").toEqual([]);
      expect(audit.deepEndpointPairs, story + " deep endpoint/label collisions").toEqual([]);
      expect(audit.overlaps, `${story} node collisions ${JSON.stringify(audit)}`).toBe(0);
      expect(audit.rowInkOverlapPairs, `${story} row label/value ink overlap`).toEqual([]);
      expect(audit.roundelTextOverflow, `${story} roundel text escapes ellipse`).toEqual([]);
      expect(
        audit.labelLabelOverlaps,
        `${story} label/label collisions ${JSON.stringify(audit)}`,
      ).toBe(0);
      expect(
        audit.labelModuleOverlaps,
        `${story} label/module collisions ${JSON.stringify(audit)}`,
      ).toBe(0);
      expect(
        audit.unrelatedPathModuleIntersections,
        `${story} unrelated path/module intersections ${JSON.stringify(audit)}`,
      ).toBe(0);
      // Overview is an orientation poster: it fits the whole authored story,
      // so it is responsible for composition and for the levels a presenter
      // actually reads at fit scale — the shape titles and the headline
      // figures. Row detail is present but deliberately not readable here;
      // the named steps are the reading views and carry the full ramp (see
      // the focused-step spec below).
      //
      // The eyebrow >= 12 and detail >= 13 floors used to be asserted at THIS
      // scale. Satisfying them at ~0.65x forced a >= 20px world font, which
      // against fixed authored card geometry is what collapsed the type
      // hierarchy and produced the collisions the checks above now guard.
      expect(
        audit.title,
        `${story} title rendered px at scale ${audit.scale}`,
      ).toBeGreaterThanOrEqual(14);
      if (audit.primaryValue !== null) {
        expect(
          audit.primaryValue,
          story + " primary value rendered px at scale " + audit.scale,
        ).toBeGreaterThanOrEqual(14);
      }
    }
  });
}

for (const viewport of viewports) {
  test(`renders the full type ramp legibly on a focused step at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const story of stories) {
      await openPresentation(page, story);
      // Step 1 is the first named story step; fitStep() frames only that
      // step's participants, which is what buys legibility here.
      await page.getByRole("main", { name: `${story} presentation` }).press("ArrowRight");
      await expect(page.locator("[aria-current='step']")).toHaveCount(1);
      await settledCamera(page);

      const audit = await page.locator(".money-map-presentation").evaluate((shell) => {
        const viewportElement = shell.querySelector<HTMLElement>(".react-flow__viewport");
        const transform = viewportElement ? getComputedStyle(viewportElement).transform : "none";
        const scale = transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a;
        // Only participants are readable on a focused step; the rest is
        // intentionally dimmed to 0.15 and must not hold the floor down.
        const focused = [
          ...shell.querySelectorAll<HTMLElement>(
            '.money-map-module:not([data-presentation-dim="true"])',
          ),
        ];
        const minimumIn = (selector: string) => {
          const values = focused
            .flatMap((module) => [...module.querySelectorAll<HTMLElement>(selector)])
            .map((element) => Number.parseFloat(getComputedStyle(element).fontSize) * scale);
          return values.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...values);
        };
        return {
          scale,
          focusedCount: focused.length,
          total: minimumIn(".money-map-module__total dd"),
          title: minimumIn(".money-map-module__header h2"),
        };
      });

      expect(audit.focusedCount, `${story} focused participants`).toBeGreaterThan(0);
      // The narrative spine — what the room reads off the screen. Measured
      // step scales run 0.72-1.67 (vertically constrained by the stage at
      // 1280x720, where fitView padding costs 22% of 588px), so these floors
      // are what the authored ramp actually delivers at the worst framing,
      // not an aspiration. Row detail is supporting texture the advisor
      // reads from their own screen; asserting a floor on it is what forced
      // the type inflation this change removed.
      expect(
        audit.title,
        `${story} title rendered px at step scale ${audit.scale}`,
      ).toBeGreaterThanOrEqual(16);
      expect(
        audit.total,
        `${story} total rendered px at step scale ${audit.scale}`,
      ).toBeGreaterThanOrEqual(14);
    }
  });
}

test("reduced motion removes presentation focus transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPresentation(page, "Roth Conversion");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('.money-map-module[data-presentation-focus="true"]').first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await expect(
    page
      .locator('.money-map-flow-label-wrap[data-presentation-focus="true"] .money-map-flow-label')
      .first(),
  ).toHaveCSS("transition-duration", "0s");
});
test("Retirement overview avoids blanket focus, wrapped totals, and deep endpoint-label overlap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPresentation(page, "Retirement Income");

  const audit = await page.locator(".money-map-presentation").evaluate((shell) => {
    const nodes = [...shell.querySelectorAll<HTMLElement>(".react-flow__node")].map((node) => ({
      id: node.dataset.id ?? "",
      box: node.getBoundingClientRect(),
    }));
    const deepEndpointOverlaps = [
      ...shell.querySelectorAll<HTMLElement>(".money-map-flow-label-wrap"),
    ].flatMap((label) => {
      const box = label.getBoundingClientRect();
      const endpoints = new Set([label.dataset.flowSource, label.dataset.flowTarget]);
      return nodes.flatMap((node) => {
        if (!endpoints.has(node.id)) return [];
        const horizontal = Math.min(box.right, node.box.right) - Math.max(box.left, node.box.left);
        const vertical = Math.min(box.bottom, node.box.bottom) - Math.max(box.top, node.box.top);
        return horizontal > 8 && vertical > 8 ? [`${label.dataset.flowLabelId}/${node.id}`] : [];
      });
    });
    const wrappedTotals = [...shell.querySelectorAll<HTMLElement>(".money-map-module__total dd")]
      .filter((value) => {
        const range = document.createRange();
        range.selectNodeContents(value);
        return range.getClientRects().length > 1;
      })
      .map((value) => value.textContent);

    return {
      deepEndpointOverlaps,
      focusedModules: shell.querySelectorAll('.money-map-module[data-presentation-focus="true"]')
        .length,
      focusedLabels: shell.querySelectorAll(
        '.money-map-flow-label-wrap[data-presentation-focus="true"]',
      ).length,
      wrappedTotals,
    };
  });

  expect(audit.focusedModules).toBe(0);
  expect(audit.focusedLabels).toBe(0);
  expect(audit.wrappedTotals).toEqual([]);
  expect(audit.deepEndpointOverlaps).toEqual([]);
});

test("relationship legend is off by default, opens to only the kinds actually present, and its samples match the real edge strokes", async ({
  page,
}) => {
  await openPresentation(page, "Retirement Income");

  const toggle = page.getByRole("button", { name: "Legend" });
  await expect(toggle).toBeVisible();
  await expect(page.locator(".relationship-legend__list")).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const list = page.locator(".relationship-legend__list");
  await expect(list).toBeVisible();

  // Retirement Income authors all four relationship kinds, so all four rows show.
  await expect(list.locator("li")).toHaveCount(4);
  await expect(list.getByText("Income", { exact: true })).toBeVisible();
  await expect(list.getByText("Transfer", { exact: true })).toBeVisible();
  await expect(list.getByText("Replenishment", { exact: true })).toBeVisible();
  await expect(list.getByText("Planned", { exact: true })).toBeVisible();

  // Cross-check the legend's inline sample strokes against a real rendered
  // edge of each kind, so the samples cannot silently drift from reality.
  const drift = await page.evaluate(() => {
    const kinds = ["income", "transfer", "replenishment", "planned"] as const;
    const legendRows = [...document.querySelectorAll(".relationship-legend__list li")];
    return kinds.flatMap((kind) => {
      const realPath = document.querySelector(`.relationship--${kind}`);
      const label = kind[0].toUpperCase() + kind.slice(1);
      const sampleLine = legendRows
        .find((row) => row.querySelector("span")?.textContent === label)
        ?.querySelector("line");
      if (!realPath || !sampleLine) return [`missing sample or edge for ${kind}`];
      const real = getComputedStyle(realPath).strokeDasharray;
      const sample = getComputedStyle(sampleLine).strokeDasharray;
      return real === sample ? [] : [`${kind}: real=${real} sample=${sample}`];
    });
  });
  expect(drift).toEqual([]);

  // Escape closes the disclosure without exiting presentation, and returns
  // focus to the toggle rather than leaking to the shell.
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(
    page.getByRole("main", { name: "Retirement Income presentation" }),
  ).not.toBeFocused();
});

for (const viewport of viewports) {
  test(`relationship legend never overlaps authored content or the camera chrome at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openPresentation(page, "Retirement Income");
    await page.getByRole("button", { name: "Legend" }).click();
    await expect(page.locator(".relationship-legend__list")).toBeVisible();

    const geometry = await page.locator(".money-map-presentation").evaluate((shell) => {
      const header = shell.querySelector(".presentation-header")?.getBoundingClientRect();
      const legend = shell.querySelector(".relationship-legend")?.getBoundingClientRect();
      const stageContent = [...shell.querySelectorAll<HTMLElement>(".react-flow__node")].map(
        (node) => node.getBoundingClientRect(),
      );
      const toolbar = shell.querySelector(".canvas-controls")?.getBoundingClientRect();
      const rail = shell.querySelector(".presentation-rail")?.getBoundingClientRect();
      if (!header || !legend) throw new Error("Expected the header and legend to render");
      const intersects = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        legend,
        header,
        // The legend is in-flow chrome inside the header row (not a floating
        // overlay), so the real invariant is that opening it never pushes the
        // header wider than the viewport or taller than its own fixed track —
        // either of those would be the only way it could spill onto the stage.
        headerWithinViewport: header.left >= 0 && header.right <= innerWidth,
        legendWithinHeader:
          legend.top >= header.top - 1 &&
          legend.bottom <= header.bottom + 1 &&
          legend.right <= header.right + 1,
        overlapsContent: stageContent.some((box) => intersects(legend, box)),
        overlapsToolbar: toolbar ? intersects(legend, toolbar) : false,
        overlapsRail: rail ? intersects(legend, rail) : false,
      };
    });

    expect(geometry.headerWithinViewport, JSON.stringify(geometry)).toBe(true);
    expect(geometry.legendWithinHeader, JSON.stringify(geometry)).toBe(true);
    expect(geometry.overlapsContent, JSON.stringify(geometry)).toBe(false);
    expect(geometry.overlapsToolbar).toBe(false);
    expect(geometry.overlapsRail).toBe(false);
  });
}

// The step names are the advisor's narrative spine and the only navigation
// in presentation, so a chip must not truncate while the rail still has room
// for it. A fixed max-width cap did exactly that: at 1920, with a 1880px rail
// and a 210px toolbar, five of six chips still clipped. Asserted from 1440 up
// — at 1280 the three verbose stories genuinely exceed the rail, and ellipsis
// there is a real constraint rather than a self-inflicted ceiling.
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const) {
  test(`shows every story step name in full at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const story of stories) {
      await openPresentation(page, story);
      const clipped = await page
        .locator(".presentation-nav")
        .evaluate((nav) =>
          [...nav.querySelectorAll<HTMLElement>(".presentation-rail__step")]
            .filter((chip) => chip.scrollWidth > chip.clientWidth + 1)
            .map((chip) => chip.textContent),
        );
      expect(clipped, `${story} truncated step names`).toEqual([]);
    }
  });
}

test("author header keeps the story identity clear of metadata and actions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Retirement Income/ }).click();

  const geometry = await page.locator(".workspace-header").evaluate((header) => {
    const heading = header
      .querySelector<HTMLElement>(".workspace-heading")
      ?.getBoundingClientRect();
    const actions = header
      .querySelector<HTMLElement>(".workspace-actions")
      ?.getBoundingClientRect();
    if (!heading || !actions) throw new Error("Expected workspace header regions");
    return { headingRight: heading.right, actionsLeft: actions.left };
  });

  expect(geometry.headingRight + 12).toBeLessThanOrEqual(geometry.actionsLeft);
});
