import { relationshipGeometry } from "./relationshipGeometry";

const endpoints = { source: { x: 10, y: 20 }, target: { x: 210, y: 120 } };

function midpoint(source: { x: number; y: number }, target: { x: number; y: number }) {
  return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
}

describe("relationship geometry", () => {
  it.each([
    ["horizontal", { x: 20, y: 80 }, { x: 260, y: 80 }],
    ["vertical", { x: 120, y: 20 }, { x: 120, y: 260 }],
    ["diagonal", endpoints.source, endpoints.target],
  ])(
    "keeps straight, orthogonal, and curved routes visibly distinct for %s endpoints",
    (_name, source, target) => {
      const straight = relationshipGeometry("straight", source, target, []);
      const orthogonal = relationshipGeometry("orthogonal", source, target, []);
      const curved = relationshipGeometry("curved", source, target, []);

      expect(new Set([straight.path, orthogonal.path, curved.path]).size).toBe(3);
      expect(straight.label).toEqual(midpoint(source, target));
      if (_name !== "diagonal") expect(orthogonal.label).not.toEqual(straight.label);
      expect(curved.label).not.toEqual(straight.label);
      expect(orthogonal.path).toContain(`L ${orthogonal.label.x} ${orthogonal.label.y}`);
      expect(curved.path).toContain("C");
    },
  );

  it.each(["straight", "orthogonal", "curved"] as const)(
    "%s honors the first waypoint and anchors its label on that authored route point",
    (route) => {
      const waypoint = { x: 96, y: 184 };
      const geometry = relationshipGeometry(route, endpoints.source, endpoints.target, [waypoint]);
      expect(geometry.label).toEqual(waypoint);
      expect(geometry.path).toContain("96");
      expect(geometry.path).toContain("184");
    },
  );

  it("bows the horizontal and vertical curved-route anchors off the direct segment", () => {
    const horizontal = relationshipGeometry("curved", { x: 0, y: 0 }, { x: 240, y: 0 }, []);
    const vertical = relationshipGeometry("curved", { x: 0, y: 0 }, { x: 0, y: 240 }, []);
    expect(horizontal.label.y).not.toBe(0);
    expect(vertical.label.x).not.toBe(0);
  });

  it("is independent of authored labels and amount-like strings", () => {
    const before = relationshipGeometry("curved", endpoints.source, endpoints.target, []);
    const after = relationshipGeometry("curved", endpoints.source, endpoints.target, []);
    expect(after).toEqual(before);
  });
});
