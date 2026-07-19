import { relationshipGeometry } from "./relationshipGeometry";

const endpoints = { source: { x: 10, y: 20 }, target: { x: 210, y: 120 } };

describe("relationship geometry", () => {
  it("builds three visibly distinct deterministic routes", () => {
    const paths = (["straight", "orthogonal", "curved"] as const).map(
      (route) => relationshipGeometry(route, endpoints.source, endpoints.target, []).path,
    );
    expect(new Set(paths).size).toBe(3);
    expect(paths[0]).toContain("L");
    expect(paths[1]).toContain("L");
    expect(paths[2]).toContain("C");
  });

  it("uses the first authored waypoint as the label anchor for every route", () => {
    const waypoint = { x: 96, y: 184 };
    for (const route of ["straight", "orthogonal", "curved"] as const) {
      const geometry = relationshipGeometry(route, endpoints.source, endpoints.target, [waypoint]);
      expect(geometry.label).toEqual(waypoint);
      expect(geometry.path).toContain("96");
      expect(geometry.path).toContain("184");
    }
  });

  it("is independent of authored labels and amount-like strings", () => {
    const before = relationshipGeometry("curved", endpoints.source, endpoints.target, []);
    const after = relationshipGeometry("curved", endpoints.source, endpoints.target, []);
    expect(after).toEqual(before);
  });
});
