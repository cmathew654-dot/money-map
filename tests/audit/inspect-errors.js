/**
 * Trace pageerrors to find which call .map() on undefined.
 */
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on("console", (m) => {
  if (m.type() === "error") console.log("[console.error]", m.text(), "\nlocation:", m.location());
});
page.on("pageerror", (e) => console.log("[pageerror]", e.message, "\nstack:", e.stack));

await page.goto("http://localhost:54217/index.html?test=1");
await page.waitForFunction(() => window.__AFV_TEST__);
await page.waitForTimeout(1000);

// Try to render dock to see if it errors
const dockState = await page.evaluate(() => {
  const dock = document.querySelector(".canvas-dock");
  const flyout = document.querySelector(".dock-flyout");
  const workspace = document.querySelector(".workspace");
  const dockButtons = [...document.querySelectorAll("[data-dock]")];
  return {
    workspaceDisplay: workspace ? getComputedStyle(workspace).display : null,
    workspaceVisibility: workspace ? getComputedStyle(workspace).visibility : null,
    dockExists: !!dock,
    dockDisplay: dock ? getComputedStyle(dock).display : null,
    dockVisibility: dock ? getComputedStyle(dock).visibility : null,
    dockRect: dock?.getBoundingClientRect(),
    dockChildCount: dock?.children?.length,
    flyoutClasses: flyout?.className,
    buttons: dockButtons.map((b) => ({
      dock: b.dataset.dock,
      classes: b.className,
      offsetWidth: b.offsetWidth,
      offsetHeight: b.offsetHeight,
      offsetParent: b.offsetParent?.tagName || "null",
      display: getComputedStyle(b).display,
      visibility: getComputedStyle(b).visibility,
      computedW: getComputedStyle(b).width,
      computedH: getComputedStyle(b).height,
    })),
  };
});

console.log("\n=== DOCK STATE ===");
console.log(JSON.stringify(dockState, null, 2));

await browser.close();
