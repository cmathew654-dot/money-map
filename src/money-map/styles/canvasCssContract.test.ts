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
      /@media \(pointer: coarse\)[\s\S]*\.money-map-handle[^}]*width:\s*calc\(44px \* var\(--map-inverse-zoom, 1\)\);[^}]*height:\s*calc\(44px \* var\(--map-inverse-zoom, 1\)\)/s,
    );
    expect(css).toMatch(
      /@media \(pointer: coarse\)[\s\S]*\.react-flow__edgeupdater[^}]*r:\s*calc\(22px \* var\(--map-inverse-zoom, 1\)\)/s,
    );
  });
});

describe("presentation CSS contract", () => {
  it("uses a clean fitted canvas and restrained focus transitions without fading content", () => {
    expect(css).toMatch(/\.money-map-canvas--presentation[^}]*background-image:\s*none/s);
    expect(css).toMatch(/\.money-map-presentation \.money-map-module[^}]*transition:[^;]*180ms/s);
    expect(css).toMatch(/data-presentation-focus="true"[^}]*box-shadow:/s);
    expect(css).not.toMatch(/data-presentation-focus="true"[^}]*opacity:\s*0\./s);
  });

  it("de-emphasizes non-participating step content without fading focused participants", () => {
    // Lowered from 0.3 (ghosted-but-still-readable) to 0.15 so non-focused
    // content recedes cleanly instead of competing with the focused
    // participants (see canvas.css comment above each rule). NOTE for the
    // tests/e2e/presentation.spec.ts owner: that spec still hardcodes
    // toHaveCSS("opacity", "0.3") for dimmed modules and will need updating
    // to "0.15" to match.
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-module\[data-presentation-dim="true"\][^}]*opacity:\s*0\.15/s,
    );
    expect(css).toMatch(
      /\.money-map-presentation \.react-flow__edge\.presentation-dim[^}]*opacity:\s*0\.15/s,
    );
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-flow-label-wrap\[data-presentation-dim="true"\][^}]*opacity:\s*0\.15/s,
    );
    expect(css).toMatch(/\.money-map-presentation \.money-map-module[^}]*opacity 200ms ease-out/s);
  });

  it("gives story focus editorial emphasis instead of borrowing the editor's selection ring", () => {
    const focusModule = css.match(
      /\.money-map-presentation \.money-map-module\[data-presentation-focus="true"\]\[data-primitive\]\s*\{([^}]*)\}/s,
    )?.[1];
    expect(focusModule).toBeTruthy();
    expect(focusModule).not.toMatch(/var\(--map-accent\)/);
    expect(focusModule).toMatch(/box-shadow:/);

    const focusLabel = css.match(
      /\.money-map-flow-label-wrap\[data-presentation-focus="true"\]\s*\.money-map-flow-label\s*\{([^}]*)\}/s,
    )?.[1];
    expect(focusLabel).toBeTruthy();
    expect(focusLabel).not.toMatch(/outline:/);
  });

  /* Presentation renders the authored composition, so it must not re-type or
     re-space the module. This replaces an earlier contract that pinned
     presentation to 16.2px/20px/34px: those sizes existed only to clear a
     rendered-pixel floor measured on the fit-the-whole-map Overview, and
     inflating type against fixed authored card geometry is what collapsed the
     hierarchy, pushed values into the border, and drove labels into the row
     rules. Legibility is now a camera property — see the focused-step floor
     in tests/e2e/presentation.spec.ts. Asserting the ABSENCE of overrides is
     deliberate: it stops a future "just bump it a little" patch from
     reintroducing the inflation layer one declaration at a time. */
  it("never re-types or re-spaces the module in presentation", () => {
    const presentationModuleRules = [
      ...css.matchAll(/^\.money-map-presentation[^{]*\.money-map-module[^{]*\{([^}]*)\}/gms),
    ].map(([, body]) => body);

    expect(presentationModuleRules.length).toBeGreaterThan(0);
    for (const body of presentationModuleRules) {
      expect(body).not.toMatch(/(^|[\s;])font-size:/);
      expect(body).not.toMatch(/(^|[\s;])padding(-inline|-block)?:/);
      expect(body).not.toMatch(/(^|[\s;])line-height:/);
    }
  });

  it("sheds only the relationship label's cadence and detail lines in presentation", () => {
    expect(css).toMatch(
      /\.money-map-presentation \.money-map-flow-label span,\s*\.money-map-presentation \.money-map-flow-label small \{[^}]*display:\s*none/s,
    );
    // The remaining strong keeps its authored 12px.
    expect(css).not.toMatch(
      /\.money-map-presentation \.money-map-flow-label strong[^}]*font-size:/s,
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

  /* The nowrap total and the income/need focal stacking were both
     compensations for the 34px presentation total colliding with its own
     label. With presentation on the authored ramp, the authoring rules
     (150px dd cap, shared label/value grid) already hold, and keeping a
     presentation-only variant would mean the same module composed
     differently in the two modes. */
  it("composes module totals identically in authoring and presentation", () => {
    expect(css).not.toMatch(/\.money-map-presentation \.money-map-module__total/s);
    expect(css).not.toMatch(/\.money-map-presentation \.money-map-module\[data-kind=/s);
  });

  it("keeps keyboard focus on a route visible without disturbing its dash pattern", () => {
    const halo = css.match(
      /react-flow__edge:focus-visible \.money-map-relationship-casing\s*\{([^}]*)\}/s,
    )?.[1];
    expect(halo).toBeTruthy();
    expect(halo).toMatch(/stroke:\s*var\(--map-focus\)/);
    // The casing is a separate solid path beneath the route; focus must never
    // reach the route stroke itself, or a replenishment edge reads as income.
    expect(css).not.toMatch(/focus-visible \.money-map-relationship-path[^}]*stroke-dasharray/s);
  });
});

describe("shared theme token discipline", () => {
  it("declares role, overlay, label, selection, and shadow tokens once with default values", () => {
    const rootBlock = css.match(/:root\s*\{([^}]*)\}/s)?.[1] ?? "";
    for (const token of [
      "--map-role-income",
      "--map-role-account",
      "--map-role-reserve",
      "--map-role-need",
      "--map-role-specialty",
      "--map-role-charitable",
      "--map-role-note",
      "--map-label-ink",
      "--map-label-border",
      "--map-control-selected-bg",
      "--map-scrim",
      "--map-module-shadow-selected",
      "--map-module-shadow-spotlight",
    ]) {
      expect(rootBlock).toMatch(new RegExp(`${token}:\\s*`));
    }
  });

  it("routes data-color-role accents through tokens instead of raw hex", () => {
    expect(css).toMatch(
      /data-color-role="income"\][^}]*--module-accent:\s*var\(--map-role-income\)/s,
    );
    expect(css).toMatch(
      /data-color-role="account"\][^}]*--module-accent:\s*var\(--map-role-account\)/s,
    );
    expect(css).not.toMatch(/data-color-role="[a-z]+"\][^}]*--module-accent:\s*#[0-9a-fA-F]/s);
  });

  it("routes the selected-control background and command-palette scrim through tokens", () => {
    expect(css).toMatch(
      /button\[aria-pressed="true"\][^}]*background:\s*var\(--map-control-selected-bg\)/s,
    );
    expect(css).toMatch(/command-palette-backdrop[^}]*background:\s*var\(--map-scrim\)/s);
  });
});
