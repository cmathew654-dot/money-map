import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "screenshots/flyout");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message + "\n" + e.stack));

await page.goto("http://localhost:4173/index.html?test=1");
await page.waitForFunction(() => window.__AFV_TEST__);
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/00-boot.png`, fullPage: false });

console.log("Errors after boot:", errors);

// Click "Templates" button in top bar
console.log("\n=== Clicking topbar #templateButton ===");
await page.evaluate(() => document.getElementById("templateButton").click());
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/01-template-flyout.png`, fullPage: false });

const flyoutHtml = await page.evaluate(() => {
  const f = document.getElementById("dockFlyout");
  return {
    classes: f?.className,
    rect: f?.getBoundingClientRect(),
    innerHTML: f?.innerHTML.slice(0, 800),
    childCount: f?.children?.length,
  };
});
console.log("flyout state after templateButton click:");
console.log(JSON.stringify(flyoutHtml, null, 2));

// Click LEFT DOCK "Templates"
console.log("\n=== Clicking dock [data-dock='templates'] ===");
await page.evaluate(() => document.querySelector('[data-dock="templates"]').click());
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/02-dock-templates.png`, fullPage: false });

const flyoutAfterDock = await page.evaluate(() => {
  const f = document.getElementById("dockFlyout");
  return {
    classes: f?.className,
    rect: f?.getBoundingClientRect(),
    innerHTML: f?.innerHTML.slice(0, 800),
  };
});
console.log("flyout state after dock 'templates' click:");
console.log(JSON.stringify(flyoutAfterDock, null, 2));

// Click LEFT DOCK "Themes"
console.log("\n=== Clicking dock [data-dock='themes'] ===");
await page.evaluate(() => document.querySelector('[data-dock="themes"]').click());
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/03-dock-themes.png`, fullPage: false });

const flyoutAfterThemes = await page.evaluate(() => {
  const f = document.getElementById("dockFlyout");
  return {
    classes: f?.className,
    rect: f?.getBoundingClientRect(),
    innerHTML: f?.innerHTML.slice(0, 800),
  };
});
console.log("flyout state after dock 'themes' click:");
console.log(JSON.stringify(flyoutAfterThemes, null, 2));

// Click LEFT DOCK "Add"
console.log("\n=== Clicking dock [data-dock='add'] ===");
await page.evaluate(() => document.querySelector('[data-dock="add"]').click());
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/04-dock-add.png`, fullPage: false });

const flyoutAfterAdd = await page.evaluate(() => {
  const f = document.getElementById("dockFlyout");
  return {
    classes: f?.className,
    rect: f?.getBoundingClientRect(),
    innerHTML: f?.innerHTML.slice(0, 1200),
  };
});
console.log("flyout state after dock 'add' click:");
console.log(JSON.stringify(flyoutAfterAdd, null, 2));

console.log("\n=== ERRORS (full): ===");
errors.forEach((e) => console.log(e));

await browser.close();
