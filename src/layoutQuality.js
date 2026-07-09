import { state, dom, WORLD, clamp, isLockedNode } from "./state.js";
import { computeConnectorPath, connectorSamplePoints, labelRectForPoint } from "./compute.js";
import {
  lineSegmentIntersectsRect,
  obstacleRectsForConnector,
  pointAllowedByCorridor,
  rectFromNode
} from "./canvasGeometry.js";

const HARD_OVERLAP_PX = 12;
const HARD_OVERLAP_RATIO = 0.04;
const MIN_GAP = 18;
const SEARCH_STEP = 34;
const MAX_SEARCH_RADIUS = 520;
const SOFT_SHAPES = new Set(["swimlane", "bracket"]);
const RESERVED_ID_PATTERN = /(headline|title|disclosure|disclaimer|footer)/i;
const RESERVED_STYLE_PATTERN = /(title|disclosure)/i;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function rectForNode(node, pad = 0) {
  return rectFromNode(node, pad);
}

function rectFromBounds(bounds, pad = 0) {
  return rectForNode(bounds, pad);
}

function rectArea(rect) {
  return Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
}

export function rectOverlap(a, b) {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return { left, right, top, bottom, width, height, area: width * height };
}

function normalizedKind(entry) {
  if (entry.kind) return entry.kind;
  if (entry.type) return "item";
  return "group";
}

export function layoutRoleForNode(node, kind = normalizedKind(node)) {
  if (!node) return "hard";
  const idText = `${node.id || ""}`;
  const styleText = `${node.style?.textStyle || ""}`;
  if (isLockedNode(node) || RESERVED_ID_PATTERN.test(idText) || RESERVED_STYLE_PATTERN.test(styleText)) return "reserved";
  if (kind === "group" || node.type === "group" || (!node.type && Array.isArray(node.childIds))) return "soft";
  if (node.type === "shape" && SOFT_SHAPES.has(node.shape)) return "soft";
  return "hard";
}

function labelRectForSoftNode(node) {
  const rect = rectForNode(node);
  const width = Math.min(Math.max(node.w * 0.56, 160), Math.max(170, node.w - 36));
  const height = 58;
  return {
    left: node.x - width / 2,
    right: node.x + width / 2,
    top: rect.top + 34,
    bottom: rect.top + 34 + height,
    width,
    height
  };
}

function textCoreRect(entry) {
  const rect = rectForNode(entry.node, -10);
  if (entry.role === "soft") return labelRectForSoftNode(entry.node);
  return rect;
}

function layoutEntry(kind, node) {
  const role = layoutRoleForNode(node, kind);
  return {
    id: node.id,
    kind,
    node,
    role,
    rect: rectForNode(node),
    textRect: textCoreRect({ node, role })
  };
}

export function layoutEntries(options = {}) {
  const ignoreIds = options.ignoreIds || new Set();
  return [
    ...state.groups.map((group) => layoutEntry("group", group)),
    ...state.items.map((item) => layoutEntry("item", item))
  ].filter((entry) => !ignoreIds.has(entry.id));
}

function visibleWorldRect(pad = 40) {
  const stage = dom.canvasStage?.getBoundingClientRect?.();
  if (!stage || !stage.width || !stage.height) {
    return { left: pad, top: pad, right: WORLD.width - pad, bottom: WORLD.height - pad };
  }
  const zoom = Math.max(0.01, finite(state.viewport.zoom, 1));
  const left = clamp((-state.viewport.x) / zoom + pad, pad, WORLD.width - pad);
  const top = clamp((-state.viewport.y) / zoom + pad, pad, WORLD.height - pad);
  const right = clamp((stage.width - state.viewport.x) / zoom - pad, left + 1, WORLD.width - pad);
  const bottom = clamp((stage.height - state.viewport.y) / zoom - pad, top + 1, WORLD.height - pad);
  return { left, top, right, bottom };
}

function clampBoundsToRect(bounds, container) {
  const halfW = bounds.w / 2;
  const halfH = bounds.h / 2;
  return {
    ...bounds,
    x: clamp(bounds.x, container.left + halfW, container.right - halfW),
    y: clamp(bounds.y, container.top + halfH, container.bottom - halfH)
  };
}

function candidateEntry(bounds, options = {}) {
  const node = {
    id: options.id || "__candidate",
    type: options.type,
    shape: options.shape,
    style: options.style || {},
    label: options.label || "",
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    locked: false
  };
  const kind = options.kind === "group" ? "group" : "item";
  const role = options.role || layoutRoleForNode(node, kind);
  return {
    id: node.id,
    kind,
    node,
    role,
    rect: rectForNode(node),
    textRect: role === "soft" ? labelRectForSoftNode(node) : rectForNode(node, -10)
  };
}

function hardOverlapIssue(candidate, entry, overlap) {
  const smallerArea = Math.min(rectArea(candidate.rect), rectArea(entry.rect));
  const severeBySize = overlap.width > HARD_OVERLAP_PX && overlap.height > HARD_OVERLAP_PX;
  const severeByArea = overlap.area > smallerArea * HARD_OVERLAP_RATIO;
  return severeBySize && severeByArea;
}

export function placementQuality(bounds, options = {}) {
  const candidate = candidateEntry(bounds, options);
  const entries = layoutEntries({ ignoreIds: options.ignoreIds });
  const issues = [];

  for (const entry of entries) {
    const overlap = rectOverlap(candidate.rect, entry.rect);
    if (overlap.area <= 0) continue;

    if (candidate.role === "soft") {
      const labelOverlap = rectOverlap(candidate.textRect, entry.textRect);
      if ((entry.role === "hard" || entry.role === "reserved") && labelOverlap.area > 80) {
        issues.push({
          type: "label-overlap",
          severity: "blocked",
          ids: [candidate.id, entry.id],
          area: Math.round(labelOverlap.area)
        });
      }
      continue;
    }

    if (entry.role === "reserved") {
      if (hardOverlapIssue(candidate, entry, overlap)) {
        issues.push({
          type: "reserved-zone",
          severity: "blocked",
          ids: [candidate.id, entry.id],
          area: Math.round(overlap.area)
        });
      }
      continue;
    }

    if (candidate.role === "hard" && entry.role === "hard" && hardOverlapIssue(candidate, entry, overlap)) {
      issues.push({
        type: "hard-overlap",
        severity: options.allowMildOverlap ? "warn" : "blocked",
        ids: [candidate.id, entry.id],
        area: Math.round(overlap.area)
      });
    }
  }

  const blocked = issues.some((issue) => issue.severity === "blocked");
  return { status: blocked ? "blocked" : issues.length ? "warn" : "valid", blocked, issues };
}

function candidateOffsets(maxRadius = MAX_SEARCH_RADIUS) {
  const offsets = [{ dx: 0, dy: 0 }];
  for (let radius = SEARCH_STEP; radius <= maxRadius; radius += SEARCH_STEP) {
    offsets.push(
      { dx: radius, dy: 0 },
      { dx: -radius, dy: 0 },
      { dx: 0, dy: radius },
      { dx: 0, dy: -radius },
      { dx: radius, dy: radius },
      { dx: -radius, dy: radius },
      { dx: radius, dy: -radius },
      { dx: -radius, dy: -radius }
    );
  }
  return offsets;
}

export function findClearPlacement(bounds, options = {}) {
  const container = options.viewportOnly === false ? {
    left: MIN_GAP,
    top: MIN_GAP,
    right: WORLD.width - MIN_GAP,
    bottom: WORLD.height - MIN_GAP
  } : visibleWorldRect(MIN_GAP);
  const base = clampBoundsToRect(bounds, container);
  const exact = placementQuality(base, options);
  if (!exact.blocked) return { status: exact.status === "warn" ? "valid" : "valid", bounds: base, issues: exact.issues };

  const maxRadius = options.maxSearchRadius ?? MAX_SEARCH_RADIUS;
  for (const offset of candidateOffsets(maxRadius).slice(1)) {
    const next = clampBoundsToRect({ ...base, x: base.x + offset.dx, y: base.y + offset.dy }, container);
    const quality = placementQuality(next, options);
    if (!quality.blocked) return { status: "nudged", bounds: next, issues: exact.issues, resolvedIssues: quality.issues };
  }

  return { status: "blocked", bounds: base, issues: exact.issues };
}

function pairIssue(entryA, entryB) {
  const overlap = rectOverlap(entryA.rect, entryB.rect);
  if (overlap.area <= 0) return null;

  if ((entryA.role === "reserved" && entryB.role !== "soft") || (entryB.role === "reserved" && entryA.role !== "soft")) {
    if (hardOverlapIssue(entryA, entryB, overlap)) {
      return {
        type: "reserved-zone",
        severity: "error",
        ids: [entryA.id, entryB.id],
        area: Math.round(overlap.area)
      };
    }
    return null;
  }

  if (entryA.role === "hard" && entryB.role === "hard" && hardOverlapIssue(entryA, entryB, overlap)) {
    return {
      type: "hard-overlap",
      severity: "error",
      ids: [entryA.id, entryB.id],
      area: Math.round(overlap.area)
    };
  }

  if (entryA.role === "soft" && (entryB.role === "hard" || entryB.role === "reserved")) {
    const labelOverlap = rectOverlap(entryA.textRect, entryB.textRect);
    if (labelOverlap.area > 80) return {
      type: "label-overlap",
      severity: "error",
      ids: [entryA.id, entryB.id],
      area: Math.round(labelOverlap.area)
    };
  }

  if (entryB.role === "soft" && (entryA.role === "hard" || entryA.role === "reserved")) {
    const labelOverlap = rectOverlap(entryB.textRect, entryA.textRect);
    if (labelOverlap.area > 80) return {
      type: "label-overlap",
      severity: "error",
      ids: [entryB.id, entryA.id],
      area: Math.round(labelOverlap.area)
    };
  }

  return null;
}

function duplicateStackIssue(entryA, entryB) {
  if (entryA.role !== "hard" || entryB.role !== "hard") return null;
  const labelA = String(entryA.node.label || "").toLowerCase();
  const labelB = String(entryB.node.label || "").toLowerCase();
  const sameType = entryA.node.type === entryB.node.type && labelA && labelA === labelB;
  const centerDistance = Math.hypot(entryA.node.x - entryB.node.x, entryA.node.y - entryB.node.y);
  const overlap = rectOverlap(entryA.rect, entryB.rect);
  const smallerArea = Math.min(rectArea(entryA.rect), rectArea(entryB.rect));
  if (sameType && (centerDistance < 42 || overlap.area > smallerArea * 0.5)) {
    return {
      type: "duplicate-stack",
      severity: "error",
      ids: [entryA.id, entryB.id],
      area: Math.round(overlap.area)
    };
  }
  return null;
}

function offscreenIssue(entry) {
  const rect = entry.rect;
  if (rect.left >= -1 && rect.top >= -1 && rect.right <= WORLD.width + 1 && rect.bottom <= WORLD.height + 1) return null;
  return {
    type: "offscreen-object",
    severity: "error",
    ids: [entry.id],
    area: 0
  };
}

function computedConnectorPath(conn, computedPaths) {
  if (!computedPaths) return computeConnectorPath(conn);
  if (!computedPaths.has(conn.id)) computedPaths.set(conn.id, computeConnectorPath(conn));
  return computedPaths.get(conn.id);
}

function connectorLabelIssues(entries, computedPaths) {
  const hardEntries = entries.filter((entry) => entry.role === "hard" || entry.role === "reserved");
  const issues = [];
  state.connectors.forEach((conn) => {
    if (conn.visible === false) return;
    const computed = computedConnectorPath(conn, computedPaths);
    if (!computed?.label || computed.label.hidden) return;
    const labelRect = {
      left: computed.label.x - 72,
      right: computed.label.x + 72,
      top: computed.label.y - 28,
      bottom: computed.label.y + 28,
      width: 144,
      height: 56
    };
    hardEntries.forEach((entry) => {
      const overlap = rectOverlap(labelRect, entry.textRect);
      if (overlap.area > 900) {
        issues.push({
          type: "connector-label-overlap",
          severity: "error",
          ids: [conn.id, entry.id],
          area: Math.round(overlap.area)
        });
      }
    });
  });
  return issues;
}

function corridorRectForSegment(start, end, width = 22) {
  const half = width / 2;
  return {
    left: Math.min(start.x, end.x) - half,
    right: Math.max(start.x, end.x) + half,
    top: Math.min(start.y, end.y) - half,
    bottom: Math.max(start.y, end.y) + half,
    width: Math.abs(end.x - start.x) + width,
    height: Math.abs(end.y - start.y) + width
  };
}

function endpointCorridorsForComputed(conn, computed) {
  const corridors = new Map();
  const add = (ownerId, start, end) => {
    if (!ownerId || !start || !end) return;
    const existing = corridors.get(ownerId) || [];
    existing.push(corridorRectForSegment(start, end));
    corridors.set(ownerId, existing);
  };
  add(conn.source?.itemId, computed.sourcePort || computed.source, computed.routeSource || computed.source);
  add(conn.target?.itemId, computed.targetPort || computed.target, computed.routeTarget || computed.target);
  return corridors;
}

function segmentAllowedByEndpointCorridor(start, end, entry) {
  if (!entry.isEndpoint) return false;
  return pointAllowedByCorridor(start, entry) && pointAllowedByCorridor(end, entry);
}

function issueKeyForConnectorPath(conn, entry) {
  const type = entry.kind === "connector-label"
    ? "flow-label"
    : entry.kind === "text" || entry.kind === "sleeve"
      ? "flow-text"
      : "flow-object";
  return `${type}:${conn.id}:${entry.id}`;
}

function connectorPathIssues(computedPaths) {
  const issues = [];
  const seen = new Set();
  state.connectors.forEach((conn) => {
    if (conn.visible === false) return;
    const computed = computedConnectorPath(conn, computedPaths);
    issues.push(...connectorIssuesForRoutePoints(conn, renderedRoutePoints(conn, computed), computed, seen, computedPaths));
  });
  return issues;
}

function svgPathSamplePoints(d) {
  if (!d || typeof document === "undefined" || !document.createElementNS) return [];
  try {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) return [];
    const steps = Math.max(36, Math.min(160, Math.ceil(length / 14)));
    const points = [];
    for (let index = 0; index <= steps; index += 1) {
      const point = path.getPointAtLength((length * index) / steps);
      points.push({ x: point.x, y: point.y });
    }
    return points;
  } catch {
    return [];
  }
}

function routeKindForComputed(conn, computed) {
  const d = computed?.d || "";
  const commands = new Set((d.match(/[a-zA-Z]/g) || []).map((command) => command.toUpperCase()));
  if (commands.has("C")) return "sCurve";
  if ((conn.routeStyle || "smartArc") === "elbow") return "elbow";
  if (commands.has("Q")) return "smartArc";
  return "straight";
}

function sampledRoutePoints(source, target, control, route) {
  return connectorSamplePoints(source, target, control, route, 72)
    .map((point) => ({ x: point.x, y: point.y }));
}

function fallbackRenderedRoutePoints(conn, computed) {
  if (Array.isArray(computed.waypoints) && computed.waypoints.length > 4) return computed.waypoints;
  const route = routeKindForComputed(conn, computed);
  const routeSamples = sampledRoutePoints(computed.routeSource || computed.source, computed.routeTarget || computed.target, computed.control, route);
  return [
    computed.source,
    computed.routeSource,
    ...routeSamples.slice(1, -1),
    computed.routeTarget,
    computed.target
  ].filter(Boolean);
}

function renderedRoutePoints(conn, computed) {
  const sampled = svgPathSamplePoints(computed?.d);
  return sampled.length ? sampled : fallbackRenderedRoutePoints(conn, computed);
}

function manualRoutePoints(conn, computed) {
  if (!conn.mid) return [];
  const route = conn.routeStyle || "smartArc";
  if (route === "straight") return [];
  const routeSamples = sampledRoutePoints(computed.routeSource || computed.source, computed.routeTarget || computed.target, conn.mid, route);
  return [
    computed.source,
    computed.routeSource,
    ...routeSamples.slice(1, -1),
    computed.routeTarget,
    computed.target
  ].filter(Boolean);
}

function connectorLabelObstacleRects(conn, computedPaths, pad = 6) {
  return state.connectors
    .filter((other) => other.id !== conn.id && other.visible !== false)
    .map((other) => {
      const computed = computedConnectorPath(other, computedPaths);
      if (!computed?.label || computed.label.hidden) return null;
      const rect = labelRectForPoint(computed.label, other);
      return {
        id: `connector-label:${other.id}`,
        ownerId: other.id,
        kind: "connector-label",
        rect: {
          left: rect.left - pad,
          right: rect.right + pad,
          top: rect.top - pad,
          bottom: rect.bottom + pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2
        },
        isEndpoint: false,
        legalCorridors: []
      };
    })
    .filter(Boolean);
}

function connectorIssuesForRoutePoints(conn, points, computed, seen = new Set(), computedPaths = null) {
  const issues = [];
  const corridors = endpointCorridorsForComputed(conn, computed);
  const obstacles = [
    ...obstacleRectsForConnector(conn, {
      pad: 8,
      includeEndpointBodies: true,
      includeText: true,
      includeSleeves: true
    }).map((entry) => ({
      ...entry,
      legalCorridors: corridors.get(entry.ownerId) || []
    })),
    ...connectorLabelObstacleRects(conn, computedPaths, 6)
  ];

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) continue;
    obstacles.forEach((entry) => {
      if (!lineSegmentIntersectsRect(start, end, entry.rect)) return;
      if (entry.isEndpoint && segmentAllowedByEndpointCorridor(start, end, entry)) return;
      const type = entry.kind === "connector-label"
        ? "flow-label"
        : entry.kind === "text" || entry.kind === "sleeve"
          ? "flow-text"
          : "flow-object";
      const key = issueKeyForConnectorPath(conn, entry);
      if (seen.has(key)) return;
      seen.add(key);
      issues.push({
        type,
        severity: "error",
        ids: [conn.id, entry.ownerId || entry.id],
        area: 0
      });
    });
  }
  return issues;
}

function manualRouteIssues(conn, computed) {
  return connectorIssuesForRoutePoints(conn, manualRoutePoints(conn, computed), computed);
}

export function detectLayoutIssues() {
  const entries = layoutEntries();
  const computedPaths = new Map();
  const issues = [];

  entries.forEach((entry) => {
    const issue = offscreenIssue(entry);
    if (issue) issues.push(issue);
  });

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const primary = pairIssue(entries[i], entries[j]);
      if (primary) issues.push(primary);
      const duplicate = duplicateStackIssue(entries[i], entries[j]);
      if (duplicate) issues.push(duplicate);
    }
  }

  issues.push(...connectorLabelIssues(entries, computedPaths));
  issues.push(...connectorPathIssues(computedPaths));
  return issues;
}

function issueBelongsToConnector(issue, connId) {
  return issue.ids?.[0] === connId;
}

function pointDistance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0));
}

export function repairPresentationLayout(options = {}) {
  const hasRepairCandidate = state.connectors.some((conn) => conn.visible !== false && (
    conn.mid ||
    conn.manualMid ||
    conn.labelPoint ||
    (conn.presentationRole === "primary" && options.restorePrimaryLabels && conn.labelMode === "hidden")
  ));
  if (!hasRepairCandidate) return { repaired: 0, before: [], issues: [] };

  const before = detectLayoutIssues();
  let repaired = 0;

  state.connectors.forEach((conn) => {
    if (conn.visible === false) return;
    const hasRouteIssue = before.some((issue) => issueBelongsToConnector(issue, conn.id) && /^flow-/.test(issue.type));
    const hasLabelIssue = before.some((issue) => issueBelongsToConnector(issue, conn.id) && /label/.test(issue.type));
    const shouldRestoreHiddenPrimary = conn.presentationRole === "primary" && options.restorePrimaryLabels;
    const needsComputed = hasRouteIssue ||
      hasLabelIssue ||
      conn.mid ||
      conn.manualMid ||
      conn.labelPoint ||
      shouldRestoreHiddenPrimary;
    if (!needsComputed) return;

    const computed = computeConnectorPath(conn);
    const manualRouteInvalid = conn.mid && manualRouteIssues(conn, computed).length > 0;
    const manualLabelOverridden = conn.labelPoint && computed?.label && !computed.label.hidden && pointDistance(conn.labelPoint, computed.label) > 1;

    if (manualRouteInvalid && (conn.mid || conn.manualMid)) {
      conn.mid = null;
      conn.manualMid = false;
      repaired += 1;
    }

    if ((hasLabelIssue || manualLabelOverridden) && conn.labelPoint) {
      conn.labelPoint = null;
      if (conn.labelMode === "manual") conn.labelMode = "auto";
      repaired += 1;
    }

    if (computed?.label?.hidden && shouldRestoreHiddenPrimary) {
      conn.labelMode = "auto";
      repaired += 1;
    }
  });

  const issues = detectLayoutIssues();
  return { repaired, before, issues };
}

function moveNodeToBounds(entry, bounds) {
  const dx = bounds.x - entry.node.x;
  const dy = bounds.y - entry.node.y;
  entry.node.x = bounds.x;
  entry.node.y = bounds.y;
  if (entry.kind === "group") {
    (entry.node.childIds || []).forEach((childId) => {
      const child = state.items.find((item) => item.id === childId);
      if (!child) return;
      child.x += dx;
      child.y += dy;
    });
  }
}

export function tidyLayout() {
  let moved = 0;
  const movable = [
    ...state.items.map((node) => layoutEntry("item", node)),
    ...state.groups.map((node) => layoutEntry("group", node))
  ].filter((entry) => entry.role !== "reserved" && !isLockedNode(entry.node))
    .sort((a, b) => (a.node.y - b.node.y) || (a.node.x - b.node.x));

  for (let pass = 0; pass < 4; pass += 1) {
    let passMoved = 0;
    movable.forEach((entry) => {
      const ignoreIds = new Set([entry.id, ...(entry.kind === "group" ? entry.node.childIds || [] : [])]);
      const result = findClearPlacement(
        { x: entry.node.x, y: entry.node.y, w: entry.node.w, h: entry.node.h },
        {
          id: entry.id,
          kind: entry.kind,
          type: entry.node.type,
          shape: entry.node.shape,
          style: entry.node.style,
          label: entry.node.label,
          ignoreIds,
          viewportOnly: false,
          maxSearchRadius: 680
        }
      );
      if (result.status !== "blocked" && (Math.abs(result.bounds.x - entry.node.x) > 1 || Math.abs(result.bounds.y - entry.node.y) > 1)) {
        moveNodeToBounds(entry, result.bounds);
        passMoved += 1;
      }
    });
    moved += passMoved;
    if (!passMoved) break;
  }

  state.connectors.forEach((conn) => {
    if (conn.labelMode === "manual") return;
    conn.labelPoint = null;
  });

  return { moved, issues: detectLayoutIssues() };
}
