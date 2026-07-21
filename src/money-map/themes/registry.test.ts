import { getCanvasTheme, themeRegistry } from "./registry";
import privateLedgerCss from "./private-ledger.css?raw";
import distributionRegistryCss from "./distribution-registry.css?raw";
import foundationCss from "./foundation.css?raw";
import conversionPathCss from "./conversion-path.css?raw";

describe("canvas theme registry", () => {
  it("maps every persisted canvas style to one declarative class", () => {
    expect(themeRegistry).toEqual({
      "private-ledger": {
        id: "private-ledger",
        label: "Private Ledger",
        className: "theme-private-ledger",
      },
      "distribution-registry": {
        id: "distribution-registry",
        label: "Distribution Registry",
        className: "theme-distribution-registry",
      },
      foundation: {
        id: "foundation",
        label: "Foundation",
        className: "theme-foundation",
      },
      "conversion-path": {
        id: "conversion-path",
        label: "Conversion Path",
        className: "theme-conversion-path",
      },
    });
    expect(getCanvasTheme("foundation")).toBe(themeRegistry.foundation);
  });

  it("keeps theme files token-only so art direction cannot alter shared geometry", () => {
    for (const css of [
      privateLedgerCss,
      distributionRegistryCss,
      foundationCss,
      conversionPathCss,
    ]) {
      expect(css).not.toMatch(
        /\b(?:width|height|padding|margin|position|inset|transform|font-size|line-height)\s*:/i,
      );
      expect(css).not.toContain("$");
      expect(css).toContain("--map-");
    }
  });
  it("contains metadata only, never geometry, commands, or financial content", () => {
    const serialized = JSON.stringify(themeRegistry);
    for (const forbidden of [
      "width",
      "height",
      "position",
      "route",
      "command",
      "amount",
      "balance",
      "value",
    ]) {
      expect(serialized.toLocaleLowerCase()).not.toContain(forbidden);
    }
  });
});
