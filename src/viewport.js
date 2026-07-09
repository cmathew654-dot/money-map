import { state, dom, WORLD, MIN_ZOOM, MAX_ZOOM, clamp } from "./state.js";
import { constrainViewport, computeContentBoundingBox } from "./compute.js";

let renderHudCallback = () => {};

const COMFORT_FIT_WIDTH = 1760;
const COMFORT_FIT_HEIGHT = 980;
const FIT_BREATHING_ROOM = 0.82;
const PRESENTATION_OVERVIEW_MAX_ZOOM = 0.76;
const VIEWPORT_SETTLE_MS = 90;

let viewportSettleTimer = null;
let pendingSettleAnchor = null;

export function setRenderHudCallback(callback) {
  renderHudCallback = callback;
}

function devicePixelRatio() {
  return window.devicePixelRatio || 1;
}

function snapCssPixel(value) {
  const ratio = devicePixelRatio();
  return Math.round(value * ratio) / ratio;
}

function snapZoom(value) {
  return clamp(Math.round(value * 100) / 100, MIN_ZOOM, MAX_ZOOM);
}

function clearViewportSettleTimer() {
  window.clearTimeout(viewportSettleTimer);
  viewportSettleTimer = null;
}

export function markViewportTransforming() {
  document.body.classList.add("viewport-transforming");
}

export function settleViewport(options = {}) {
  const { anchor = pendingSettleAnchor, render = true, snapZoomValue = true } = options;
  clearViewportSettleTimer();
  pendingSettleAnchor = null;

  if (snapZoomValue) {
    const oldZoom = state.viewport.zoom || 1;
    const nextZoom = snapZoom(oldZoom);
    if (anchor && Math.abs(nextZoom - oldZoom) > 0.0001) {
      const worldX = (anchor.x - state.viewport.x) / oldZoom;
      const worldY = (anchor.y - state.viewport.y) / oldZoom;
      state.viewport.zoom = nextZoom;
      state.viewport.x = anchor.x - worldX * nextZoom;
      state.viewport.y = anchor.y - worldY * nextZoom;
    } else {
      state.viewport.zoom = nextZoom;
    }
  }

  state.viewport.x = snapCssPixel(state.viewport.x);
  state.viewport.y = snapCssPixel(state.viewport.y);
  constrainViewport();
  state.viewport.x = snapCssPixel(state.viewport.x);
  state.viewport.y = snapCssPixel(state.viewport.y);
  document.body.classList.remove("viewport-transforming");
  if (render) renderViewport();
}

export function scheduleViewportSettle(anchor = null) {
  markViewportTransforming();
  pendingSettleAnchor = anchor || pendingSettleAnchor;
  clearViewportSettleTimer();
  viewportSettleTimer = window.setTimeout(() => settleViewport(), VIEWPORT_SETTLE_MS);
}

function fitFrame() {
  const rect = dom.canvasStage.getBoundingClientRect();
  const frame = { x: 0, y: 0, w: rect.width, h: rect.height };
  if (document.body.classList.contains("presentation")) {
    const marginX = clamp(rect.width * 0.035, 32, 68);
    const marginTop = clamp(rect.height * 0.03, 22, 42);
    const baseBottom = clamp(rect.height * 0.06, 40, 88);
    const railRect = document.querySelector(".scenario-rail")?.getBoundingClientRect();
    const railBottom = railRect?.height ? railRect.height + clamp(rect.height * 0.011, 12, 20) : 0;
    frame.x = marginX;
    frame.y = marginTop;
    frame.w = Math.max(640, rect.width - marginX * 2);
    frame.h = Math.max(420, rect.height - marginTop - Math.max(baseBottom, railBottom));
    return frame;
  }

  const dockRect = document.querySelector(".canvas-dock")?.getBoundingClientRect();
  if (dockRect?.width && dockRect?.height) {
    const dockRight = clamp(dockRect.right - rect.left, 0, rect.width);
    frame.x = Math.max(frame.x, dockRight + 6);
    frame.w = Math.max(420, rect.width - frame.x);
  }

  return frame;
}

function normalizedTemplateZoom(rect) {
  return clamp(
    Math.min(rect.w / COMFORT_FIT_WIDTH, rect.h / COMFORT_FIT_HEIGHT),
    MIN_ZOOM,
    PRESENTATION_OVERVIEW_MAX_ZOOM
  );
}

// === VIEWPORT ===
export function renderViewport() {
  dom.canvasWorld.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.zoom})`;
  dom.zoomReadout.textContent = `${Math.round(state.viewport.zoom * 100)}%`;
  renderHudCallback();
}

export function setZoom(nextZoom, anchor = null) {
  const rect = dom.canvasStage.getBoundingClientRect();
  const oldZoom = state.viewport.zoom;
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const anchorPoint = anchor || { x: rect.width / 2, y: rect.height / 2 };
  const worldX = (anchorPoint.x - state.viewport.x) / oldZoom;
  const worldY = (anchorPoint.y - state.viewport.y) / oldZoom;
  state.viewport.zoom = zoom;
  state.viewport.x = anchorPoint.x - worldX * zoom;
  state.viewport.y = anchorPoint.y - worldY * zoom;
  constrainViewport();
  renderViewport();
  scheduleViewportSettle(anchorPoint);
}

export function fitView() {
  const rect = fitFrame();
  const bbox = computeContentBoundingBox();
  if (!bbox) {
    state.viewport.zoom = snapZoom(1);
    state.viewport.x = rect.x + rect.w / 2 - WORLD.width / 2;
    state.viewport.y = rect.y + rect.h / 2 - WORLD.height / 2;
  } else {
    const rawFitZoom = Math.min(rect.w / bbox.w, rect.h / bbox.h);
    const contentFitZoom = clamp(
      rawFitZoom * FIT_BREATHING_ROOM,
      MIN_ZOOM,
      1.52
    );
    const largeExhibit = bbox.w >= 1100 || bbox.h >= 720;
    const comfortZoom = largeExhibit ? normalizedTemplateZoom(rect) : 1.08;
    const zoom = snapZoom(Math.min(contentFitZoom, comfortZoom));
    state.viewport.zoom = zoom;
    state.viewport.x = rect.x + rect.w / 2 - (bbox.x + bbox.w / 2) * zoom;
    state.viewport.y = rect.y + rect.h / 2 - (bbox.y + bbox.h / 2) * zoom;
  }
  constrainViewport();
  settleViewport({ render: false, snapZoomValue: false });
  renderViewport();
}

export function fitInitialTemplateView() {
  const rect = fitFrame();
  const bbox = computeContentBoundingBox();
  const targetZoom = snapZoom(normalizedTemplateZoom(rect));
  if (!bbox) {
    state.viewport.zoom = targetZoom;
    state.viewport.x = rect.x + rect.w / 2 - (WORLD.width / 2) * targetZoom;
    state.viewport.y = rect.y + rect.h / 2 - (WORLD.height / 2) * targetZoom;
  } else {
    const overflowSafeZoom = clamp(
      Math.min(rect.w / bbox.w, rect.h / bbox.h),
      MIN_ZOOM,
      MAX_ZOOM
    );
    const zoom = snapZoom(Math.min(targetZoom, overflowSafeZoom));
    state.viewport.zoom = zoom;
    state.viewport.x = rect.x + rect.w / 2 - (bbox.x + bbox.w / 2) * zoom;
    state.viewport.y = rect.y + rect.h / 2 - (bbox.y + bbox.h / 2) * zoom;
  }
  constrainViewport();
  settleViewport({ render: false, snapZoomValue: false });
  renderViewport();
}

export function placeViewportAtZoom(zoom) {
  const rect = fitFrame();
  const bbox = computeContentBoundingBox();
  state.viewport.zoom = snapZoom(zoom);
  if (!bbox) {
    state.viewport.x = rect.x + rect.w / 2 - (WORLD.width / 2) * state.viewport.zoom;
    state.viewport.y = rect.y + rect.h / 2 - (WORLD.height / 2) * state.viewport.zoom;
  } else {
    state.viewport.x = rect.x + rect.w / 2 - (bbox.x + bbox.w / 2) * state.viewport.zoom;
    state.viewport.y = rect.y + rect.h / 2 - (bbox.y + bbox.h / 2) * state.viewport.zoom;
  }
  constrainViewport();
  settleViewport({ render: false, snapZoomValue: false });
  renderViewport();
}
