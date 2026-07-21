import type { Point, RouteKind } from "../model/types";

export interface RelationshipGeometry {
  path: string;
  label: Point;
}

function midpoint(source: Point, target: Point): Point {
  return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
}

function straightPath(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function orthogonalSegment(previous: Point, next: Point): Point[] {
  const deltaX = next.x - previous.x;
  const deltaY = next.y - previous.y;
  if (deltaY === 0 || deltaX === 0) return [next];
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    const elbowX = (previous.x + next.x) / 2;
    return [
      { x: elbowX, y: previous.y },
      { x: elbowX, y: (previous.y + next.y) / 2 },
      { x: elbowX, y: next.y },
      next,
    ];
  }
  const elbowY = (previous.y + next.y) / 2;
  return [
    { x: previous.x, y: elbowY },
    { x: (previous.x + next.x) / 2, y: elbowY },
    { x: next.x, y: elbowY },
    next,
  ];
}

function orthogonalPoints(points: Point[]): Point[] {
  const routed = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    routed.push(...orthogonalSegment(points[index - 1], points[index]));
  }
  return routed;
}

function polylineMidpoint(points: Point[]): Point {
  const lengths = points
    .slice(1)
    .map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const halfway = lengths.reduce((sum, length) => sum + length, 0) / 2;
  let traversed = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index];
    if (traversed + length >= halfway) {
      const ratio = length === 0 ? 0 : (halfway - traversed) / length;
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio,
      };
    }
    traversed += length;
  }
  return points.at(-1) ?? points[0];
}

interface CurveSegment {
  first: Point;
  second: Point;
  end: Point;
}

function curveSegment(previous: Point, next: Point): CurveSegment {
  const deltaX = next.x - previous.x;
  const deltaY = next.y - previous.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length === 0) return { first: previous, second: next, end: next };
  const bow = Math.min(72, Math.max(28, length * 0.18));
  const normal = { x: -deltaY / length, y: deltaX / length };
  return {
    first: {
      x: previous.x + deltaX / 3 + normal.x * bow,
      y: previous.y + deltaY / 3 + normal.y * bow,
    },
    second: {
      x: previous.x + (deltaX * 2) / 3 + normal.x * bow,
      y: previous.y + (deltaY * 2) / 3 + normal.y * bow,
    },
    end: next,
  };
}

function cubicPoint(start: Point, segment: CurveSegment, time: number): Point {
  const inverse = 1 - time;
  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * time * segment.first.x +
      3 * inverse * time ** 2 * segment.second.x +
      time ** 3 * segment.end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * time * segment.first.y +
      3 * inverse * time ** 2 * segment.second.y +
      time ** 3 * segment.end.y,
  };
}

function curvedPath(points: Point[]): { path: string; midpoint: Point } {
  const commands = [`M ${points[0].x} ${points[0].y}`];
  let firstSegment: CurveSegment | null = null;
  for (let index = 1; index < points.length; index += 1) {
    const segment = curveSegment(points[index - 1], points[index]);
    firstSegment ??= segment;
    commands.push(
      `C ${segment.first.x} ${segment.first.y} ${segment.second.x} ${segment.second.y} ${segment.end.x} ${segment.end.y}`,
    );
  }
  return {
    path: commands.join(" "),
    midpoint: firstSegment ? cubicPoint(points[0], firstSegment, 0.5) : points[0],
  };
}

export function relationshipGeometry(
  route: RouteKind,
  source: Point,
  target: Point,
  waypoints: Point[],
): RelationshipGeometry {
  const points = [source, ...waypoints, target];
  if (route === "straight") {
    return { path: straightPath(points), label: waypoints[0] ?? midpoint(source, target) };
  }
  if (route === "orthogonal") {
    const routed = orthogonalPoints(points);
    return {
      path: straightPath(routed),
      label: waypoints[0] ?? polylineMidpoint(routed),
    };
  }
  const curved = curvedPath(points);
  return { path: curved.path, label: waypoints[0] ?? curved.midpoint };
}
