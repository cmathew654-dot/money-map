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
    await expect(page.getByRole("button", { name: /^Go to / })).toHaveCount(5);

    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".presentation-step-copy span")).toHaveText("Step 1 of 5");
    await expect(page.locator(".money-map-presentation > [role='status']")).toContainText(
      "step 1 of 5",
    );
    await page.keyboard.press("Space");
    await expect(page.locator(".presentation-step-copy span")).toHaveText("Step 2 of 5");
  }
});

test("presentation focus, tab order, direct navigation, and Escape stay presentation-only", async ({
  page,
}) => {
  await openPresentation(page, "Retirement Income");
  await expect(page.getByRole("button", { name: /Actions/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back to stories" })).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "Canvas camera" })).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: /cadence/i })).toHaveCount(0);
  await expect(page.locator(".selection-halo, .advanced-properties, .primitive-menu")).toHaveCount(
    0,
  );

  const tabbableLabels = await page
    .locator(".money-map-presentation")
    .evaluate((shell) =>
      [...shell.querySelectorAll<HTMLElement>("a, button, input, select, textarea, [tabindex]")]
        .filter((element) => element.tabIndex >= 0 && !element.hasAttribute("disabled"))
        .map((element) => element.getAttribute("aria-label") ?? element.textContent?.trim()),
    );
  expect(tabbableLabels).toHaveLength(7);
  expect(tabbableLabels.slice(0, 2)).toEqual(["Exit presentation", "Overview"]);
  expect(tabbableLabels.slice(2).every((label) => label?.startsWith("Go to "))).toBe(true);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Exit presentation" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Overview" })).toBeFocused();
  await page.keyboard.press("Tab");
  const firstStep = page.getByRole("button", { name: /^Go to / }).first();
  await expect(firstStep).toBeFocused();
  await firstStep.press("Space");
  await expect(firstStep).toHaveAttribute("aria-current", "step");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Present" })).toBeFocused();
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
      await page.waitForTimeout(300);
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
          (node) => ({ id: node.dataset.id ?? "", box: node.getBoundingClientRect() }),
        );
        const labelEntries = [
          ...shell.querySelectorAll<HTMLElement>(".money-map-flow-label-wrap"),
        ].map((label) => ({
          id: label.dataset.flowLabelId ?? "",
          source: label.dataset.flowSource ?? "",
          target: label.dataset.flowTarget ?? "",
          box: label.getBoundingClientRect(),
        }));
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
              ? [`${label.id}/${id}`]
              : [],
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
        return {
          scale,
          overlaps,
          overlapPairs,
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

      expect(audit.nodesBounded, `${story} nodes bounded ${JSON.stringify(audit)}`).toBe(true);
      expect(audit.chromeBounded, `${story} chrome bounded`).toBe(true);
      expect(audit.overlaps, `${story} node collisions ${JSON.stringify(audit)}`).toBe(0);
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
      expect(
        audit.eyebrow,
        `${story} eyebrow rendered px at scale ${audit.scale}`,
      ).toBeGreaterThanOrEqual(12);
      expect(
        audit.detail,
        `${story} detail rendered px at scale ${audit.scale}`,
      ).toBeGreaterThanOrEqual(13);
      if (audit.primaryValue !== null) {
        expect(
          audit.primaryValue,
          story + " primary value rendered px at scale " + audit.scale,
        ).toBeGreaterThanOrEqual(24);
      }
      expect(
        audit.flow,
        `${story} flow rendered px at scale ${audit.scale}`,
      ).toBeGreaterThanOrEqual(12);
      expect(
        audit.title,
        `${story} title rendered px at scale ${audit.scale}`,
      ).toBeGreaterThanOrEqual(18);
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
