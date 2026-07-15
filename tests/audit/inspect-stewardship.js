/**
 * Live inspection of two reported bugs:
 *  (1) Selection toolbar overlaps card content
 *  (2) Category chips don't appear to do anything
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "screenshots/stewardship-audit");
mkdirSync(OUT, { recursive: true });

const URL = "http://localhost:54217/index.html?test=1";
const log = (...args) => console.log("[audit]", ...args);

async function inspectAt(viewport, label) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  page.on("console", (m) => { if (m.type() === "error") console.log("[err]", m.text()); });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

  await page.goto(URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
  await page.waitForTimeout(300);

  // Find a regular account card (not paycheck) to test category chips
  const accountId = await page.evaluate(() => {
    const items = [...document.querySelectorAll(".canvas-item.finance-card")];
    return items[0]?.dataset.itemId;
  });
  log(`[${label}] account card itemId:`, accountId);

  if (!accountId) { await browser.close(); return; }

  // Select the account card
  await page.evaluate((id) => window.__AFV_TEST__.select("item", id), accountId);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${label}-01-account-selected.png` });

  // Numerical overlap check: toolbar bottom vs card content top
  const overlap = await page.evaluate(() => {
    const toolbar = document.querySelector(".selection-toolbar");
    const card = document.querySelector(".canvas-item.is-selected .item-surface");
    const cornerNw = document.querySelectorAll(".canvas-item.is-selected .selection-handle, .selection-frame, [data-handle]");
    if (!toolbar || !card) return null;
    const tr = toolbar.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    return {
      toolbarBottom: tr.bottom,
      cardTop: cr.top,
      gapPx: cr.top - tr.bottom,
      toolbarHeight: tr.height,
      handlesFound: cornerNw.length,
    };
  });
  log(`[${label}] toolbar/card overlap:`, overlap);

  // Open the Style popover via the test API
  await page.evaluate(() => window.__AFV_TEST__.openPopover("selection-style"));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${label}-02-style-popover.png` });

  // Inspect chips
  const chipsState = await page.evaluate(() => {
    const popover = document.querySelector("[data-selection-popover]");
    if (!popover) return { popoverFound: false };
    const chips = [...popover.querySelectorAll(".chip[data-set]")];
    return {
      popoverFound: true,
      popoverKind: popover.dataset.popoverKind,
      chips: chips.map((c) => ({
        text: c.textContent.trim(),
        set: c.dataset.set,
        field: c.dataset.field,
        value: c.dataset.value,
        active: c.classList.contains("is-active"),
      })),
    };
  });
  log(`[${label}] chips visible:`, chipsState.chips?.length, "popoverKind:", chipsState.popoverKind);
  log(`[${label}] chip details:`, JSON.stringify(chipsState.chips?.slice(0, 8)));

  // Snapshot before chip click — capture a wide net of mutable visual state
  const before = await page.evaluate((id) => {
    const item = window.__AFV_TEST__.getState().items.find((i) => i.id === id);
    const fdata = window.__AFV_TEST__.getState().financeData[item?.financeId];
    const node = document.querySelector(`.canvas-item[data-item-id='${id}']`);
    return {
      itemSubtitle: item?.subtitle,
      itemVisual: item?.visual,
      itemShape: item?.shape,
      financeCategory: fdata?.category,
      cardSubtitleText: node?.querySelector(".finance-note, .finance-type")?.textContent.trim(),
      cardClass: node?.className,
    };
  }, accountId);
  log(`[${label}] BEFORE category chip click:`, before);

  // Click the FIRST non-active CATEGORY chip
  const clicked = await page.evaluate(() => {
    const chips = [...document.querySelectorAll("[data-selection-popover] .chip[data-set='item-field'][data-field='category']")];
    const nonActive = chips.find((c) => !c.classList.contains("is-active"));
    if (!nonActive) return null;
    nonActive.click();
    return { text: nonActive.textContent.trim(), value: nonActive.dataset.value };
  });
  log(`[${label}] clicked CATEGORY chip:`, clicked);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${label}-03-after-category-click.png` });

  const after = await page.evaluate((id) => {
    const item = window.__AFV_TEST__.getState().items.find((i) => i.id === id);
    const fdata = window.__AFV_TEST__.getState().financeData[item?.financeId];
    const node = document.querySelector(`.canvas-item[data-item-id='${id}']`);
    return {
      itemSubtitle: item?.subtitle,
      itemVisual: item?.visual,
      financeCategory: fdata?.category,
      cardSubtitleText: node?.querySelector(".finance-note, .finance-type")?.textContent.trim(),
      cardClass: node?.className,
    };
  }, accountId);
  log(`[${label}] AFTER category chip click:`, after);

  // Now click a VISUAL chip (which should change the rendering shape)
  const clickedVisual = await page.evaluate(() => {
    const chips = [...document.querySelectorAll("[data-selection-popover] .chip[data-set='item-field'][data-field='visual']")];
    const nonActive = chips.find((c) => !c.classList.contains("is-active"));
    if (!nonActive) return null;
    nonActive.click();
    return { text: nonActive.textContent.trim(), value: nonActive.dataset.value };
  });
  log(`[${label}] clicked VISUAL chip:`, clickedVisual);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${label}-04-after-visual-click.png` });

  const afterVisual = await page.evaluate((id) => {
    const item = window.__AFV_TEST__.getState().items.find((i) => i.id === id);
    const node = document.querySelector(`.canvas-item[data-item-id='${id}']`);
    return {
      itemVisual: item?.visual,
      cardClass: node?.className,
    };
  }, accountId);
  log(`[${label}] AFTER visual chip click:`, afterVisual);

  await browser.close();
}

await inspectAt({ width: 1440, height: 900 }, "1440x900");
await inspectAt({ width: 1366, height: 768 }, "1366x768");
await inspectAt({ width: 1280, height: 720 }, "1280x720");

log("\n=== INSPECTION COMPLETE ===");
log("screenshots in", OUT);
