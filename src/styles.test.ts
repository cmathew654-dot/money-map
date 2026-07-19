import { readFileSync } from "node:fs";

function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe("starter chooser visual contracts", () => {
  it("keeps the small starter index above the WCAG AA text contrast floor", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const color = css.match(/\.starter-number\s*\{[^}]*color:\s*(#[0-9a-f]{6})/i)?.[1];

    expect(color).toBeTruthy();
    expect(contrast(color ?? "#ffffff", "#eee7d8")).toBeGreaterThanOrEqual(4.5);
  });
});
describe("workspace composition contracts", () => {
  it("keeps display tracking within the Impeccable floor and right-aligns workspace actions", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/h1\s*\{[^}]*letter-spacing:\s*-0\.04em/s);
    const canvasCss = readFileSync("src/money-map/styles/canvas.css", "utf8");
    expect(canvasCss).toMatch(/\.workspace-actions\s*\{[^}]*justify-self:\s*end/s);
  });
});
