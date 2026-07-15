/**
 * Confirms two specific bugs:
 *   B-toolbar: when a card is near the top of the canvas, toolbar is clamped against
 *              the viewport edge, sitting visually atop the card content.
 *   B-category: clicking a CATEGORY chip in the Data popover does not visibly change
 *               the rendered card subtitle when the subtitle was customized by template.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "screenshots/categories-audit");
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:54217/index.html?test=1";
const log = (...args) => console.log("[cat]", ...args);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL);
await page.waitForFunction(() => window.__AFV_TEST__);
await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
await page.waitForTimeout(300);

// Pick the topmost item to maximise toolbar/card overlap risk
const itemId = await page.evaluate(() => {
  const items = [...document.querySelectorAll(".canvas-item.finance-card")];
  let best = null; let bestY = Infinity;
  for (const el of items) {
    const r = el.getBoundingClientRect();
    if (r.top < bestY) { bestY = r.top; best = el.dataset.itemId; }
  }
  return best;
});
log("topmost account itemId:", itemId);

await page.evaluate((id) => window.__AFV_TEST__.select("item", id), itemId);
await page.waitForTimeout(200);

// Open DATA popover (where category chips live)
await page.evaluate(() => window.__AFV_TEST__.openPopover("selection-data"));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/01-data-popover-open.png` });

const popoverChips = await page.evaluate(() => {
  const popover = document.querySelector("[data-selection-popover]");
  const chips = popover ? [...popover.querySelectorAll(".chip[data-set='item-field']")] : [];
  return {
    popoverFound: !!popover,
    popoverKind: popover?.dataset.popoverKind,
    chips: chips.map((c) => ({ text: c.textContent.trim(), field: c.dataset.field, value: c.dataset.value, active: c.classList.contains("is-active") })),
  };
});
log("popover state:", popoverChips.popoverKind, "chip count:", popoverChips.chips.length);
log("category chips:", popoverChips.chips.filter((c) => c.field === "category"));

// Capture before
const before = await page.evaluate((id) => {
  const item = window.__AFV_TEST__.getState().items.find((i) => i.id === id);
  const fdata = window.__AFV_TEST__.getState().financeData[item.financeId];
  const node = document.querySelector(`.canvas-item[data-item-id='${id}']`);
  return {
    itemSubtitle: item.subtitle,
    financeCategory: fdata.category,
    cardNoteText: node?.querySelector(".finance-note")?.textContent.trim(),
    cardTypeText: node?.querySelector(".finance-type")?.textContent.trim(),
    cardLabelText: node?.querySelector(".finance-name")?.textContent.trim(),
  };
}, itemId);
log("BEFORE:", before);

// Click a NON-active category chip
const clicked = await page.evaluate(() => {
  const chips = [...document.querySelectorAll("[data-selection-popover] .chip[data-field='category']")];
  const target = chips.find((c) => !c.classList.contains("is-active"));
  if (!target) return null;
  target.click();
  return { text: target.textContent.trim(), value: target.dataset.value };
});
log("clicked category chip:", clicked);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/02-after-category.png` });

const after = await page.evaluate((id) => {
  const item = window.__AFV_TEST__.getState().items.find((i) => i.id === id);
  const fdata = window.__AFV_TEST__.getState().financeData[item.financeId];
  const node = document.querySelector(`.canvas-item[data-item-id='${id}']`);
  return {
    itemSubtitle: item.subtitle,
    financeCategory: fdata.category,
    cardNoteText: node?.querySelector(".finance-note")?.textContent.trim(),
    cardTypeText: node?.querySelector(".finance-type")?.textContent.trim(),
    cardLabelText: node?.querySelector(".finance-name")?.textContent.trim(),
  };
}, itemId);
log("AFTER:", after);
log("VISIBLE TEXT CHANGED:", before.cardNoteText !== after.cardNoteText || before.cardTypeText !== after.cardTypeText);

// Check toolbar geometry at top of canvas
const topPos = await page.evaluate(() => {
  const t = document.querySelector(".selection-toolbar");
  const c = document.querySelector(".canvas-item.is-selected .item-surface");
  if (!t || !c) return null;
  const tr = t.getBoundingClientRect();
  const cr = c.getBoundingClientRect();
  return { toolbarTop: tr.top, toolbarBottom: tr.bottom, cardTop: cr.top, gapPx: cr.top - tr.bottom };
});
log("toolbar near top:", topPos);

await browser.close();
