import { readFileSync } from "node:fs";
const css = readFileSync("src/money-map/styles/canvas.css", "utf8");

describe("canvas pointer target CSS", () => {
  it("keeps normal edge and handle targets at least 28px and 24px", () => {
    expect(css).toMatch(/\.money-map-handle[^}]*\{[^}]*width:\s*24px;[^}]*height:\s*24px/s);
  });

  it("expands actual edge corridors and create/reconnect handles to 44px for coarse pointers", () => {
    expect(css).toMatch(
      /@media \(pointer: coarse\)[\s\S]*\.react-flow__edge-interaction[^}]*stroke-width:\s*44px/s,
    );
    expect(css).toMatch(
      /@media \(pointer: coarse\)[\s\S]*\.money-map-handle[^}]*width:\s*44px;[^}]*height:\s*44px/s,
    );
  });
});
