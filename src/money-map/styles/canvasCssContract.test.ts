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

describe("presentation CSS contract", () => {
  it("uses a clean fitted canvas and restrained focus transitions without fading content", () => {
    expect(css).toMatch(/\.money-map-canvas--presentation[^}]*background-image:\s*none/s);
    expect(css).toMatch(/\.money-map-presentation \.money-map-module[^}]*transition:[^;]*180ms/s);
    expect(css).toMatch(/data-presentation-focus="true"[^}]*box-shadow:/s);
    expect(css).not.toMatch(/money-map-presentation[^}]*opacity:\s*0\./s);
  });

  it("raises presentation detail and relationship label source sizes for fitted viewports", () => {
    expect(css).toMatch(/\.money-map-presentation \.money-map-module dt,[\s\S]*font-size:\s*20px/s);
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-flow-label strong[^}]*font-size:\s*16px/s,
    );
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-flow-label (?:span|small),[\s\S]*font-size:\s*16px/s,
    );
  });

  it("keeps presentation controls touch-sized and preserves each story's canvas token", () => {
    expect(css).toContain(`.presentation-exit,
.presentation-overview,
.presentation-dots button {
  min-width: 44px;
  min-height: 44px;`);
    expect(css).not.toContain("#f3ecdf");
    expect(css).toContain("background: var(--map-canvas);");
    expect(css).toContain("background-color: var(--map-canvas);");
  });
});
