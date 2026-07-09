import { state, WORLD, clamp, getNode } from "./state.js";

const MIN_RECT_SIZE = 1;
const DEFAULT_BODY_PAD = 0;
const DEFAULT_TEXT_PAD = 4;
const PORT_CORRIDOR_WIDTH = 18;
const PORT_STUB_MIN = 34;
const PORT_STUB_MAX = 58;

const VISUAL_PORTS = {
  card: ["left.in", "right.out", "top.in", "bottom.out"],
  bucket: ["left.in", "right.out", "top.in", "bottom.reserve"],
  cylinder: ["left.in", "right.out", "top.in", "bottom.reserve"],
  policy: ["left.funding", "right.payout", "top.review", "bottom.reserve"],
  trust: ["left.funding", "right.lifestyle", "right.legacy", "right.charitable", "bottom.admin", "top.review"],
  paycheck: ["left.income", "right.household", "bottom.gap", "top.need"],
  household: ["left.in", "right.out", "top.in", "bottom.out"],
  amountTag: ["left.in", "right.out"],
  taxTag: ["left.in", "right.out"],
  text: ["left.in", "right.out"],
  shape: ["left.in", "right.out", "top.in", "bottom.out"]
};

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function productVisual(node) {
  return node?.visual || node?.shape || node?.type || "card";
}

function nodeMetrics(node) {
  return {
    x: finite(node?.x, WORLD.width / 2),
    y: finite(node?.y, WORLD.height / 2),
    w: Math.max(MIN_RECT_SIZE, finite(node?.w, MIN_RECT_SIZE)),
    h: Math.max(MIN_RECT_SIZE, finite(node?.h, MIN_RECT_SIZE))
  };
}

function rectFromEdges(left, top, right, bottom) {
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

function safeRectFromEdges(left, top, right, bottom) {
  let safeLeft = finite(left);
  let safeTop = finite(top);
  let safeRight = finite(right);
  let safeBottom = finite(bottom);
  if (safeRight < safeLeft) {
    const center = (safeLeft + safeRight) / 2;
    safeLeft = center;
    safeRight = center;
  }
  if (safeBottom < safeTop) {
    const center = (safeTop + safeBottom) / 2;
    safeTop = center;
    safeBottom = center;
  }
  return rectFromEdges(safeLeft, safeTop, safeRight, safeBottom);
}

function clampWithinRange(value, min, max, fallback = null) {
  const safeMin = finite(min);
  const safeMax = finite(max);
  if (safeMin > safeMax) {
    return fallback === null ? (safeMin + safeMax) / 2 : finite(fallback, (safeMin + safeMax) / 2);
  }
  return clamp(finite(value, fallback === null ? (safeMin + safeMax) / 2 : fallback), safeMin, safeMax);
}

function insetRectSafe(rect, inset) {
  return safeRectFromEdges(
    rect.left + inset.left,
    rect.top + inset.top,
    rect.right - inset.right,
    rect.bottom - inset.bottom
  );
}

export function rectFromNode(node, pad = DEFAULT_BODY_PAD) {
  const { x, y, w, h } = nodeMetrics(node);
  return safeRectFromEdges(
    x - w / 2 - pad,
    y - h / 2 - pad,
    x + w / 2 + pad,
    y + h / 2 + pad
  );
}

export function inflateRect(rect, pad = 0) {
  return safeRectFromEdges(
    finite(rect?.left) - pad,
    finite(rect?.top) - pad,
    finite(rect?.right) + pad,
    finite(rect?.bottom) + pad
  );
}

export function rectOverlapArea(a, b) {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

export function pointInsideRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function pointOnSegment(point, a, b) {
  const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
  if (Math.abs(cross) > 0.0001) return false;
  return point.x >= Math.min(a.x, b.x) - 0.0001 &&
    point.x <= Math.max(a.x, b.x) + 0.0001 &&
    point.y >= Math.min(a.y, b.y) - 0.0001 &&
    point.y <= Math.max(a.y, b.y) + 0.0001;
}

function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const ab1 = cross(a, b, c);
  const ab2 = cross(a, b, d);
  const cd1 = cross(c, d, a);
  const cd2 = cross(c, d, b);
  if (Math.sign(ab1) !== Math.sign(ab2) && Math.sign(cd1) !== Math.sign(cd2)) return true;
  return pointOnSegment(c, a, b) ||
    pointOnSegment(d, a, b) ||
    pointOnSegment(a, c, d) ||
    pointOnSegment(b, c, d);
}

export function lineSegmentIntersectsRect(a, b, rect) {
  if (Math.max(a.x, b.x) < rect.left || Math.min(a.x, b.x) > rect.right) return false;
  if (Math.max(a.y, b.y) < rect.top || Math.min(a.y, b.y) > rect.bottom) return false;
  if (pointInsideRect(a, rect) || pointInsideRect(b, rect)) return true;
  const edges = [
    [{ x: rect.left, y: rect.top }, { x: rect.right, y: rect.top }],
    [{ x: rect.right, y: rect.top }, { x: rect.right, y: rect.bottom }],
    [{ x: rect.right, y: rect.bottom }, { x: rect.left, y: rect.bottom }],
    [{ x: rect.left, y: rect.bottom }, { x: rect.left, y: rect.top }]
  ];
  return edges.some(([c, d]) => segmentsIntersect(a, b, c, d));
}

function textZonesForNode(node) {
  const rect = rectFromNode(node);
  const visual = productVisual(node);
  if (visual === "trust") {
    return [
      { id: `${node.id}:title`, role: "title", rect: insetRectSafe(rect, { left: 48, top: 24, right: 48, bottom: Math.max(0, rect.height - 132) }) },
      { id: `${node.id}:sleeves`, role: "sleeves", rect: insetRectSafe(rect, { left: 42, top: 172, right: 42, bottom: 34 }) }
    ];
  }
  if (visual === "bucket" || visual === "cylinder") {
    return [
      { id: `${node.id}:title`, role: "title", rect: insetRectSafe(rect, { left: 92, top: 22, right: 26, bottom: Math.max(0, rect.height - 122) }) },
      { id: `${node.id}:sleeves`, role: "sleeves", rect: insetRectSafe(rect, { left: 24, top: 150, right: 24, bottom: 22 }) }
    ];
  }
  if (visual === "policy") {
    return [
      { id: `${node.id}:title`, role: "title", rect: insetRectSafe(rect, { left: 24, top: 22, right: 24, bottom: Math.max(0, rect.height - 92) }) },
      { id: `${node.id}:meta`, role: "meta", rect: insetRectSafe(rect, { left: 24, top: Math.max(0, rect.height - 72), right: 24, bottom: 18 }) }
    ];
  }
  return [
    { id: `${node.id}:text`, role: "text", rect: insetRectSafe(rect, { left: 18, top: 18, right: 18, bottom: 18 }) }
  ];
}

function sleeveZonesForNode(node) {
  const visual = productVisual(node);
  if (visual !== "trust" && visual !== "bucket" && visual !== "cylinder") return [];
  const sleeveZone = textZonesForNode(node).find((zone) => zone.role === "sleeves");
  if (!sleeveZone) return [];
  const data = node.financeId ? state.financeData[node.financeId] : null;
  const rows = Array.isArray(data?.subBuckets) ? data.subBuckets : [];
  if (!rows.length) return [];
  const gap = 8;
  const rowHeight = Math.max(24, (sleeveZone.rect.bottom - sleeveZone.rect.top - gap * (rows.length - 1)) / rows.length);
  return rows.map((row, index) => {
    const top = sleeveZone.rect.top + index * (rowHeight + gap);
    return {
      id: `${node.id}:sleeve:${row.id || index}`,
      role: "sleeve",
      rect: safeRectFromEdges(sleeveZone.rect.left, top, sleeveZone.rect.right, top + rowHeight)
    };
  });
}

export function geometryForNode(node, options = {}) {
  const body = rectFromNode(node, options.bodyPad ?? DEFAULT_BODY_PAD);
  const text = options.includeText === false ? [] : textZonesForNode(node).map((zone) => ({
    ...zone,
    rect: inflateRect(zone.rect, options.textPad ?? DEFAULT_TEXT_PAD)
  }));
  const sleeves = options.includeSleeves === false ? [] : sleeveZonesForNode(node).map((zone) => ({
    ...zone,
    rect: inflateRect(zone.rect, options.sleevePad ?? DEFAULT_TEXT_PAD)
  }));
  return { id: node?.id, visual: productVisual(node), body, text, sleeves };
}

function portListForNode(node) {
  return VISUAL_PORTS[productVisual(node)] || VISUAL_PORTS.shape;
}

function portEdge(portName) {
  const [edge] = String(portName || "").split(".");
  return ["left", "right", "top", "bottom"].includes(edge) ? edge : "right";
}

function hasFiniteNodeCenter(node) {
  return Number.isFinite(Number(node?.x)) && Number.isFinite(Number(node?.y));
}

function defaultPortForToward(node, toward) {
  if (!hasFiniteNodeCenter(node)) return "right.out";
  const metrics = nodeMetrics(node);
  const dx = finite(toward?.x, metrics.x) - metrics.x;
  const dy = finite(toward?.y, metrics.y) - metrics.y;
  const edge = Math.abs(dx / Math.max(1, metrics.w)) >= Math.abs(dy / Math.max(1, metrics.h))
    ? (dx >= 0 ? "right" : "left")
    : (dy >= 0 ? "bottom" : "top");
  const available = portListForNode(node).filter((port) => portEdge(port) === edge);
  return available[0] || portListForNode(node)[0] || "right.out";
}

export function resolvePortPoint(node, portName, toward = null) {
  const rect = rectFromNode(node);
  const metrics = nodeMetrics(node);
  if (!hasFiniteNodeCenter(node)) {
    return {
      port: "right.out",
      edge: "right",
      x: rect.right,
      y: metrics.y
    };
  }
  const allowedPorts = portListForNode(node);
  const fallbackToward = toward || { x: metrics.x + 1, y: metrics.y };
  const requestedPort = portName || defaultPortForToward(node, fallbackToward);
  const port = allowedPorts.includes(requestedPort) ? requestedPort : defaultPortForToward(node, fallbackToward);
  const edge = portEdge(port);
  const slot = String(port).split(".")[1] || "out";
  const verticalSlots = {
    funding: 0.22,
    income: 0.34,
    lifestyle: 0.22,
    legacy: 0.52,
    charitable: 0.78,
    household: 0.50,
    payout: 0.50,
    out: 0.50,
    in: 0.50
  };
  const horizontalSlots = {
    reserve: 0.66,
    admin: 0.72,
    gap: 0.62,
    need: 0.50,
    review: 0.50,
    out: 0.50,
    in: 0.50
  };
  if (edge === "left" || edge === "right") {
    const ratio = verticalSlots[slot] ?? 0.5;
    return {
      port,
      edge,
      x: edge === "left" ? rect.left : rect.right,
      y: clampWithinRange(rect.top + rect.height * ratio, rect.top + 18, rect.bottom - 18, metrics.y)
    };
  }
  const ratio = horizontalSlots[slot] ?? 0.5;
  return {
    port,
    edge,
    x: clampWithinRange(rect.left + rect.width * ratio, rect.left + 18, rect.right - 18, metrics.x),
    y: edge === "top" ? rect.top : rect.bottom
  };
}

export function outwardStubForPort(portPoint, node) {
  const size = Math.max(finite(node?.w, 1), finite(node?.h, 1));
  const length = clamp(size * 0.13, PORT_STUB_MIN, PORT_STUB_MAX);
  const direction = {
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 },
    top: { dx: 0, dy: -1 },
    bottom: { dx: 0, dy: 1 }
  }[portPoint.edge] || { dx: 1, dy: 0 };
  return {
    x: clamp(portPoint.x + direction.dx * length, 0, WORLD.width),
    y: clamp(portPoint.y + direction.dy * length, 0, WORLD.height)
  };
}

export function portCorridorRect(node, portPoint, stubPoint) {
  const left = Math.min(portPoint.x, stubPoint.x) - PORT_CORRIDOR_WIDTH / 2;
  const right = Math.max(portPoint.x, stubPoint.x) + PORT_CORRIDOR_WIDTH / 2;
  const top = Math.min(portPoint.y, stubPoint.y) - PORT_CORRIDOR_WIDTH / 2;
  const bottom = Math.max(portPoint.y, stubPoint.y) + PORT_CORRIDOR_WIDTH / 2;
  return rectFromEdges(left, top, right, bottom);
}

export function resolveEndpointPort(endpointValue, toward) {
  if (!endpointValue?.itemId) {
    const x = finite(endpointValue?.x, WORLD.width / 2);
    const y = finite(endpointValue?.y, WORLD.height / 2);
    return { point: { x, y }, routePoint: { x, y }, port: null, edge: null, corridor: null, node: null };
  }
  const node = getNode(endpointValue.itemId);
  if (!node) {
    const x = finite(endpointValue?.x, WORLD.width / 2);
    const y = finite(endpointValue?.y, WORLD.height / 2);
    return { point: { x, y }, routePoint: { x, y }, port: null, edge: null, corridor: null, node: null };
  }
  const point = resolvePortPoint(node, endpointValue.port || endpointValue.portId || null, toward);
  const routePoint = outwardStubForPort(point, node);
  return {
    point: { x: point.x, y: point.y },
    routePoint,
    port: point.port,
    edge: point.edge,
    corridor: portCorridorRect(node, point, routePoint),
    node
  };
}

export function allGeometryNodes() {
  return [...state.groups, ...state.items];
}

export function obstacleRectsForConnector(conn, options = {}) {
  const sourceId = conn?.source?.itemId || null;
  const targetId = conn?.target?.itemId || null;
  const includeEndpointBodies = options.includeEndpointBodies !== false;
  const includeText = options.includeText !== false;
  const includeSleeves = options.includeSleeves !== false;
  const pad = options.pad ?? 12;
  const rects = [];
  for (const node of allGeometryNodes()) {
    const isEndpoint = node.id === sourceId || node.id === targetId;
    if (isEndpoint && !includeEndpointBodies) continue;
    const geometry = geometryForNode(node, { bodyPad: pad, textPad: pad, sleevePad: pad });
    rects.push({ id: node.id, ownerId: node.id, kind: "body", rect: geometry.body, isEndpoint });
    if (includeText) {
      geometry.text.forEach((zone) => rects.push({ id: zone.id, ownerId: node.id, kind: "text", rect: zone.rect, isEndpoint }));
    }
    if (includeSleeves) {
      geometry.sleeves.forEach((zone) => rects.push({ id: zone.id, ownerId: node.id, kind: "sleeve", rect: zone.rect, isEndpoint }));
    }
  }
  return rects;
}

export function pointAllowedByCorridor(point, entry) {
  if (!entry?.isEndpoint) return false;
  return (entry.legalCorridors || []).some((corridor) => pointInsideRect(point, corridor));
}

export function storyLaneCorridors(templateLayout = {}) {
  const lanes = Array.isArray(templateLayout.lanes) ? templateLayout.lanes : [];
  return lanes.map((lane) => {
    const left = finite(lane.x, 0);
    const top = finite(lane.y, 0);
    const width = finite(lane.w, WORLD.width);
    const height = finite(lane.h, WORLD.height);
    return {
      id: lane.id,
      role: lane.role || lane.id,
      rect: rectFromEdges(left, top, left + width, top + height),
      weight: finite(lane.weight, 1)
    };
  });
}
