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

function orthogonalPath(points: Point[]): string {
  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    const elbowX = (previous.x + next.x) / 2;
    commands.push(`L ${elbowX} ${previous.y}`, `L ${elbowX} ${next.y}`, `L ${next.x} ${next.y}`);
  }
  return commands.join(" ");
}

function curvedPath(points: Point[]): string {
  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    const firstX = previous.x + (next.x - previous.x) / 3;
    const secondX = previous.x + ((next.x - previous.x) * 2) / 3;
    commands.push(`C ${firstX} ${previous.y} ${secondX} ${next.y} ${next.x} ${next.y}`);
  }
  return commands.join(" ");
}

export function relationshipGeometry(
  route: RouteKind,
  source: Point,
  target: Point,
  waypoints: Point[],
): RelationshipGeometry {
  const points = [source, ...waypoints, target];
  const path =
    route === "straight"
      ? straightPath(points)
      : route === "orthogonal"
        ? orthogonalPath(points)
        : curvedPath(points);
  return { path, label: waypoints[0] ?? midpoint(source, target) };
}
