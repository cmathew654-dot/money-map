import { readFileSync } from "node:fs";
const css = readFileSync("src/money-map/styles/canvas.css", "utf8");

describe("canvas pointer target CSS", () => {
  it("keeps the React Flow attribution link at least 24px tall", () => {
    expect(css).toMatch(/\.react-flow__attribution a[^}]*\{[^}]*min-height:\s*24px/s);
  });

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
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-module__eyebrow[^}]*font-size:\s*16\.2px/s,
    );
    expect(css).toMatch(/\.money-map-presentation \.money-map-module dt,[\s\S]*font-size:\s*20px/s);
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-flow-label strong[^}]*font-size:\s*16\.2px/s,
    );
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-flow-label span[^}]*display:\s*none;[^}]*font-size:\s*16\.2px/s,
    );
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-flow-label small[^}]*display:\s*none;[^}]*font-size:\s*16\.2px/s,
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
describe("Impeccable visual-system contracts", () => {
  it("uses an open statement band instead of a colored side stripe", () => {
    expect(css).not.toMatch(/data-primitive="band"[^}]*border-left:/s);
    expect(css).toMatch(
      /data-primitive="band"[^}]*border-width:\s*2px 0;[^}]*border-style:\s*solid/s,
    );
  });

  it("keeps module eyebrows readable and sentence case by default", () => {
    const eyebrow = css.match(/\.money-map-module__eyebrow\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(eyebrow).toMatch(/font-size:\s*12px/);
    expect(eyebrow).toMatch(/letter-spacing:\s*0\.025em/);
    expect(eyebrow).not.toMatch(/text-transform:\s*uppercase/);
  });

  it("uses theme tokens for relationships and removes the broad default card shadow", () => {
    const moduleRule = css.match(/\.money-map-module\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(moduleRule).toMatch(/box-shadow:\s*none/);
    expect(css).toMatch(/\.money-map-relationship-path[^}]*stroke:\s*var\(--map-line\)/s);
    expect(css).toMatch(
      /react-flow__edge\.selected \.money-map-relationship-path[^}]*stroke:\s*var\(--map-accent\)/s,
    );
    expect(css).toMatch(/react-flow__attribution[^}]*color:\s*var\(--map-muted\)/s);
  });

  it("keeps primary author controls and fields touch-sized for coarse pointers", () => {
    expect(css).toMatch(
      /@media \(pointer: coarse\)[\s\S]*\.text-button,[\s\S]*\.present-button[^}]*min-height:\s*44px/s,
    );
    expect(css).toMatch(
      /@media \(pointer: coarse\)[\s\S]*\.money-map-resize-control[^}]*width:\s*44px[^}]*height:\s*48px/s,
    );
    expect(css).toMatch(
      /@media \(pointer: coarse\)[\s\S]*\.advanced-properties input,[\s\S]*\.advanced-properties textarea[^}]*min-height:\s*44px/s,
    );
  });

  it("keeps presentation primary totals on one literal line with semantic focal stacking", () => {
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-module__total dd[^}]*white-space:\s*nowrap/s,
    );
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-module\[data-kind="income"\][\s\S]*grid-template-columns:\s*1fr/s,
    );
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-module\[data-kind="need"\][\s\S]*grid-template-columns:\s*1fr/s,
    );
  });
});
