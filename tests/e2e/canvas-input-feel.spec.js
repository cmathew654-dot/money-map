const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:4173/index.html?test=1";
const CARD_ID = "cashReserve";

async function openApp(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
  await page.locator("#fitButton").click();
  await settle(page);
  return errors;
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function appState(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

async function itemState(page, itemId = CARD_ID) {
  const state = await appState(page);
  return state.items.find((item) => item.id === itemId);
}

async function diagnostics(page) {
  return page.evaluate(() => {
    const api = window.__AFV_TEST__;
    if (!api) return null;
    if (typeof api.getDiagnostics === "function") return api.getDiagnostics();
    return api.getState?.().diagnostics || null;
  });
}

function readPath(source, path) {
  return path.reduce((value, key) => value?.[key], source);
}

function historyDepthFromDiagnostics(value) {
  const paths = [
    ["historyPastLength"],
    ["historyPast"],
    ["undoDepth"],
    ["undoStackLength"],
    ["history", "pastLength"],
    ["history", "past"],
    ["history", "undoDepth"],
    ["history", "undoStackLength"],
    ["undo", "pastLength"],
    ["undo", "depth"]
  ];

  for (const path of paths) {
    const raw = readPath(value, path);
    if (Array.isArray(raw)) return raw.length;
    const candidate = Number(raw);
    if (Number.isFinite(candidate)) return candidate;
  }
  return null;
}

async function historyDepth(page) {
  return historyDepthFromDiagnostics(await diagnostics(page));
}

async function canvasPoint(page, xRatio = 0.58, yRatio = 0.52) {
  const box = await page.locator("#canvasStage").boundingBox();
  expect(box).toBeTruthy();
  return {
    x: box.x + box.width * xRatio,
    y: box.y + box.height * yRatio,
    stageX: box.width * xRatio,
    stageY: box.height * yRatio
  };
}

function worldPointAt(viewport, point) {
  return {
    x: (point.stageX - viewport.x) / viewport.zoom,
    y: (point.stageY - viewport.y) / viewport.zoom
  };
}

async function dispatchWheel(page, point, init) {
  await page.evaluate(({ point: wheelPoint, init: wheelInit }) => {
    const target = document.elementFromPoint(wheelPoint.x, wheelPoint.y) || document.getElementById("canvasStage");
    target.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: wheelPoint.x,
      clientY: wheelPoint.y,
      deltaX: wheelInit.deltaX || 0,
      deltaY: wheelInit.deltaY || 0,
      shiftKey: Boolean(wheelInit.shiftKey),
      ctrlKey: Boolean(wheelInit.ctrlKey),
      metaKey: Boolean(wheelInit.metaKey),
      altKey: Boolean(wheelInit.altKey)
    }));
  }, { point, init });
  await settle(page);
}

async function waitForViewportSettle(page) {
  await page.waitForTimeout(180);
  await settle(page);
}

function isDevicePixelSnapped(value, dpr = 1) {
  return Math.abs(value * dpr - Math.round(value * dpr)) < 0.001;
}

async function centerOf(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function clickCard(page, itemId = CARD_ID) {
  const point = await centerOf(page.locator(`.canvas-item[data-item-id='${itemId}']`));
  await page.mouse.click(point.x, point.y);
  await settle(page);
}

async function dragCard(page, itemId = CARD_ID, dx = 96, dy = 42) {
  const point = await centerOf(page.locator(`.canvas-item[data-item-id='${itemId}']`));
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 8 });
  await page.mouse.up();
  await settle(page);
}

async function beginCardDrag(page, itemId = CARD_ID) {
  const point = await centerOf(page.locator(`.canvas-item[data-item-id='${itemId}']`));
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 20, point.y + 12, { steps: 4 });
  await expect(page.locator("body")).toHaveClass(/dragging/);
}

test.describe("canvas input feel", () => {
  test("plain wheel zooms around the cursor", async ({ page }) => {
    const errors = await openApp(page);
    const point = await canvasPoint(page);
    const before = (await appState(page)).viewport;
    const beforeWorld = worldPointAt(before, point);

    await dispatchWheel(page, point, { deltaY: -180 });

    const after = (await appState(page)).viewport;
    const afterWorld = worldPointAt(after, point);
    expect(after.zoom).toBeGreaterThan(before.zoom);
    expect(Math.abs(afterWorld.x - beforeWorld.x)).toBeLessThan(1);
    expect(Math.abs(afterWorld.y - beforeWorld.y)).toBeLessThan(1);
    expect(errors).toEqual([]);
  });

  test("settled zoom stays crisp by removing world filters and snapping transforms", async ({ page }) => {
    const errors = await openApp(page);
    const point = await canvasPoint(page);

    await dispatchWheel(page, point, { deltaY: -180 });
    await waitForViewportSettle(page);

    const settled = await page.evaluate(() => {
      const world = document.querySelector(".canvas-world");
      const styles = getComputedStyle(world);
      const { viewport } = window.__AFV_TEST__.getState();
      return {
        viewport,
        dpr: window.devicePixelRatio || 1,
        filter: styles.filter,
        willChange: styles.willChange,
        transform: styles.transform
      };
    });

    expect(settled.filter).toBe("none");
    expect(settled.willChange).toBe("auto");
    expect(Math.abs(settled.viewport.zoom * 100 - Math.round(settled.viewport.zoom * 100))).toBeLessThan(0.001);
    expect(isDevicePixelSnapped(settled.viewport.x, settled.dpr), JSON.stringify(settled)).toBe(true);
    expect(isDevicePixelSnapped(settled.viewport.y, settled.dpr), JSON.stringify(settled)).toBe(true);

    await page.locator("#presentationButton").click();
    await expect(page.locator("body")).toHaveClass(/presentation-ready/);
    const presentationWorld = await page.evaluate(() => {
      const styles = getComputedStyle(document.querySelector(".canvas-world"));
      return { filter: styles.filter, willChange: styles.willChange };
    });
    expect(presentationWorld.filter).toBe("none");
    expect(presentationWorld.willChange).toBe("auto");
    expect(errors).toEqual([]);
  });

  test("Shift+wheel pans without changing zoom", async ({ page }) => {
    const errors = await openApp(page);
    const point = await canvasPoint(page);
    const before = (await appState(page)).viewport;

    await dispatchWheel(page, point, { deltaX: 72, deltaY: 40, shiftKey: true });

    const after = (await appState(page)).viewport;
    expect(Math.abs(after.zoom - before.zoom)).toBeLessThan(0.0001);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });

  test("click-only card selection does not create undo history", async ({ page }) => {
    const errors = await openApp(page);
    const beforeDepth = await historyDepth(page);

    await clickCard(page);

    const selected = (await appState(page)).selection;
    expect(selected).toEqual({ kind: "item", id: CARD_ID });

    const afterDepth = await historyDepth(page);
    if (beforeDepth !== null && afterDepth !== null) {
      expect(afterDepth).toBe(beforeDepth);
    }

    await page.keyboard.press("Control+Z");
    await settle(page);
    expect((await appState(page)).selection).toEqual({ kind: "item", id: CARD_ID });
    expect(errors).toEqual([]);
  });

  test("card drag creates exactly one undo step", async ({ page }) => {
    const errors = await openApp(page);
    const beforeItem = await itemState(page);
    const beforeDepth = await historyDepth(page);

    await dragCard(page);

    const movedItem = await itemState(page);
    expect(movedItem.x).toBeGreaterThan(beforeItem.x + 30);

    const afterDepth = await historyDepth(page);
    if (beforeDepth !== null && afterDepth !== null) {
      expect(afterDepth - beforeDepth).toBe(1);
    }

    await page.keyboard.press("Control+Z");
    await expect.poll(async () => (await itemState(page)).x).toBe(beforeItem.x);
    await expect.poll(async () => (await itemState(page)).y).toBe(beforeItem.y);

    if (beforeDepth === null || afterDepth === null) {
      // Without stack diagnostics, exact count degrades to observable undo behavior.
      await page.keyboard.press("Control+Z");
      await settle(page);
      expect(await itemState(page)).toMatchObject({ x: beforeItem.x, y: beforeItem.y });
    }
    expect(errors).toEqual([]);
  });

  for (const cancelMode of ["Escape", "window blur", "pointercancel"]) {
    test(`${cancelMode} clears body.dragging during card drag`, async ({ page }) => {
      const errors = await openApp(page);

      await beginCardDrag(page);
      if (cancelMode === "Escape") {
        await page.keyboard.press("Escape");
      } else if (cancelMode === "window blur") {
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      } else {
        await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointercancel", {
          bubbles: true,
          pointerId: 1
        })));
      }

      await expect(page.locator("body")).not.toHaveClass(/dragging/);
      await page.mouse.up();
      expect(errors).toEqual([]);
    });
  }
});
