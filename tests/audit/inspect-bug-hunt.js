/**
 * Aggressive UI bug hunt — drives the live prototype, clicks every interactive
 * element, captures screenshots + console errors at each step. Records to
 * tests/audit/screenshots/bug-hunt/ and prints a structured findings log.
 *
 * Run after: npx http-server -p 54217 --silent
 * Run cmd:   node tests/audit/inspect-bug-hunt.js
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "screenshots/bug-hunt");
mkdirSync(OUT, { recursive: true });

const URL = "http://localhost:54217/index.html?test=1";
const findings = [];
const errors = [];

const log = (...args) => console.log("[hunt]", ...args);
const note = (level, where, msg) => {
  findings.push({ level, where, msg });
  console.log(`[${level}] ${where}: ${msg}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

page.on("console", (m) => {
  if (m.type() === "error") errors.push({ kind: "console.error", text: m.text() });
});
page.on("pageerror", (e) => errors.push({ kind: "pageerror", text: e.message }));

await page.goto(URL);
await page.waitForFunction(() => window.__AFV_TEST__);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/00-initial.png`, fullPage: false });

// === 1. Inventory the topbar buttons ===
log("\n=== 1. TOPBAR BUTTONS ===");
const topbarButtons = await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".topbar button, .topbar [role='button'], .topbar [data-action], .topbar [data-dock]")];
  return btns.map((b) => ({
    text: b.textContent.trim().slice(0, 30),
    id: b.id,
    classList: b.className,
    dataset: { ...b.dataset },
    visible: b.offsetParent !== null,
    rect: (() => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })(),
  }));
});
log("topbar buttons:", topbarButtons.length);
topbarButtons.forEach((b) => log("  -", b.id || b.text, "→", b.dataset, b.rect.w + "x" + b.rect.h));

// === 2. Try each topbar button ===
log("\n=== 2. CLICK EACH TOPBAR BUTTON ===");
for (const btn of topbarButtons) {
  if (!btn.visible || btn.rect.w === 0) {
    note("WARN", `topbar/${btn.id || btn.text}`, "button invisible or zero-size");
    continue;
  }
  try {
    const sel = btn.id ? `#${btn.id}` : `.topbar button:has-text("${btn.text}")`;
    await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (el) el.click();
    }, sel);
    await page.waitForTimeout(300);
    const safe = (btn.id || btn.text).replace(/[^a-z0-9]/gi, "_").slice(0, 30);
    await page.screenshot({ path: `${OUT}/topbar-click-${safe}.png`, fullPage: false });

    // What appeared after the click?
    const opened = await page.evaluate(() => {
      const flyouts = [...document.querySelectorAll(".dock-flyout, .theme-flyout, .template-flyout, [data-flyout-open]")];
      const visibleFlyouts = flyouts.filter((f) => f.offsetParent !== null);
      const flyoutContent = visibleFlyouts.map((f) => ({
        cls: f.className,
        rect: (() => { const r = f.getBoundingClientRect(); return { w: r.width, h: r.height }; })(),
        textLen: f.textContent.trim().length,
        firstChildren: [...f.children].slice(0, 3).map((c) => c.tagName + "." + (c.className || "").slice(0, 40)),
      }));
      const popovers = [...document.querySelectorAll("[data-selection-popover], .popover.is-open")];
      const visiblePopovers = popovers.filter((p) => p.offsetParent !== null);
      return { flyoutContent, popoverCount: visiblePopovers.length };
    });
    if (opened.flyoutContent.length > 0) {
      const f = opened.flyoutContent[0];
      if (f.textLen < 5) {
        note("BUG", `topbar/${btn.id || btn.text}`, `clicked → flyout opens but EMPTY (${f.rect.w}x${f.rect.h}, text=${f.textLen}ch)`);
      } else {
        log(`  ✓ ${btn.id || btn.text}: flyout opened (${f.rect.w}x${f.rect.h}, ${f.textLen}ch)`);
      }
    } else if (opened.popoverCount > 0) {
      log(`  ✓ ${btn.id || btn.text}: popover opened`);
    } else {
      log(`  ?  ${btn.id || btn.text}: clicked, no flyout/popover detected`);
    }
  } catch (err) {
    note("ERR", `topbar/${btn.id || btn.text}`, err.message);
  }
}

// === 3. Inventory dock (left menu) buttons ===
log("\n=== 3. DOCK / LEFT MENU BUTTONS ===");
const dockButtons = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("[data-dock], .dock button, .dock [role='button']")];
  return btns.map((b) => ({
    text: b.textContent.trim().slice(0, 30),
    dock: b.dataset.dock,
    rect: (() => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })(),
    visible: b.offsetParent !== null,
    pointerEvents: getComputedStyle(b).pointerEvents,
    zIndex: getComputedStyle(b).zIndex,
    classList: b.className,
  }));
});
log("dock buttons found:", dockButtons.length);
dockButtons.forEach((b) => log("  -", b.dock || b.text, "→", `rect=${b.rect.w}x${b.rect.h}`, `pe=${b.pointerEvents}`, `z=${b.zIndex}`, b.visible ? "visible" : "HIDDEN"));

// === 4. Click each dock button ===
log("\n=== 4. CLICK EACH DOCK BUTTON ===");
for (const btn of dockButtons) {
  if (!btn.visible || btn.rect.w === 0) {
    note("BUG", `dock/${btn.dock || btn.text}`, "dock button invisible or zero-size");
    continue;
  }
  if (btn.pointerEvents === "none") {
    note("BUG", `dock/${btn.dock || btn.text}`, "pointer-events: none (cannot be clicked)");
    continue;
  }
  try {
    if (btn.dock) {
      await page.evaluate((d) => {
        const el = document.querySelector(`[data-dock="${d}"]`);
        if (el) el.click();
      }, btn.dock);
    } else {
      await page.locator(`text=${btn.text}`).first().click({ timeout: 2000 });
    }
    await page.waitForTimeout(300);
    const safe = (btn.dock || btn.text).replace(/[^a-z0-9]/gi, "_").slice(0, 30);
    await page.screenshot({ path: `${OUT}/dock-click-${safe}.png`, fullPage: false });

    // Check what showed up
    const opened = await page.evaluate(() => {
      const flyout = document.querySelector(".dock-flyout, [data-dock-flyout]");
      if (!flyout) return { found: false };
      return {
        found: true,
        visible: flyout.offsetParent !== null,
        textLen: flyout.textContent.trim().length,
        rect: (() => { const r = flyout.getBoundingClientRect(); return { w: r.width, h: r.height }; })(),
        innerHTML: flyout.innerHTML.slice(0, 150),
      };
    });
    if (!opened.found) {
      log(`  ?  ${btn.dock}: clicked, no dock-flyout element exists`);
    } else if (!opened.visible) {
      note("BUG", `dock/${btn.dock}`, "clicked → flyout exists but not visible");
    } else if (opened.textLen < 5) {
      note("BUG", `dock/${btn.dock}`, `clicked → flyout EMPTY (${opened.rect.w}x${opened.rect.h}, text=${opened.textLen}ch)`);
    } else {
      log(`  ✓ ${btn.dock}: flyout open with content (${opened.rect.w}x${opened.rect.h}, ${opened.textLen}ch)`);
    }
  } catch (err) {
    note("ERR", `dock/${btn.dock || btn.text}`, err.message);
  }
}

// === 5. Click each template tile (if templates flyout works) ===
log("\n=== 5. CLICK EACH TEMPLATE TILE ===");
await page.evaluate(() => document.getElementById("templateButton")?.click());
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/templates-flyout.png` });
const templates = await page.evaluate(() => {
  const tiles = [...document.querySelectorAll("[data-template], .template-tile")];
  return tiles.map((t) => ({ id: t.dataset.template, text: t.textContent.trim().slice(0, 40) }));
});
log("templates listed:", templates.length);
templates.forEach((t) => log("  -", t.id || "?", t.text));
if (templates.length === 0) note("BUG", "templates", "no [data-template] tiles found in flyout");

// === 6. Theme flyout content ===
log("\n=== 6. CLICK THEME BUTTON ===");
await page.evaluate(() => document.getElementById("themeButton")?.click());
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/themes-flyout.png` });
const themes = await page.evaluate(() => {
  const tiles = [...document.querySelectorAll("[data-theme-choice], .theme-choice, [data-theme-id]")];
  return tiles.map((t) => ({
    id: t.dataset.themeChoice || t.dataset.themeId || "?",
    text: t.textContent.trim().slice(0, 40),
    visible: t.offsetParent !== null,
  }));
});
log("themes listed:", themes.length);
themes.forEach((t) => log("  -", t.id, t.text, t.visible ? "visible" : "HIDDEN"));
if (themes.length === 0) note("BUG", "themes", "no theme tiles found in flyout");

// Close flyouts
await page.evaluate(() => { document.body.click(); });

// === 7. Load retirement template, look for visual issues ===
log("\n=== 7. LOAD RETIREMENT, LOOK FOR OVERLAPS / CUT-OFF TEXT ===");
await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/retirement-loaded.png` });

const overlapCheck = await page.evaluate(() => {
  // Look for overlapping items
  const items = [...document.querySelectorAll(".canvas-item")];
  const rects = items.map((el) => ({ id: el.dataset.itemId, rect: el.getBoundingClientRect() }));
  const overlaps = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].rect, b = rects[j].rect;
      const overlap = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
      if (overlap) overlaps.push([rects[i].id, rects[j].id]);
    }
  }
  return { itemCount: rects.length, overlaps };
});
log("items rendered:", overlapCheck.itemCount, "overlaps:", overlapCheck.overlaps.length);
if (overlapCheck.overlaps.length > 0) note("BUG", "canvas/items", `${overlapCheck.overlaps.length} item pairs overlap: ${JSON.stringify(overlapCheck.overlaps.slice(0, 5))}`);

// Check for text overflow / clipping
const overflowCheck = await page.evaluate(() => {
  const findClipped = (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  const candidates = [...document.querySelectorAll(".finance-name, .finance-value, .finance-type, .finance-note, .paycheck-amount, .paycheck-eyebrow, .paycheck-delta, .acc-name, .item-headline")];
  const clipped = candidates.filter(findClipped).map((el) => ({
    cls: el.className,
    text: el.textContent.trim().slice(0, 30),
    scrollW: el.scrollWidth,
    clientW: el.clientWidth,
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
  }));
  return clipped;
});
log("clipped text elements:", overflowCheck.length);
overflowCheck.forEach((c) => note("BUG", `text/${c.cls.split(" ")[0]}`, `clipped: "${c.text}" (${c.clientW}x${c.clientH} <- ${c.scrollW}x${c.scrollH})`));

// === 8. Try every chip kind on a regular account card ===
log("\n=== 8. TRY EVERY CHIP IN EVERY POPOVER ===");
const accountId = await page.evaluate(() => [...document.querySelectorAll(".canvas-item.finance-card")][0]?.dataset.itemId);
log("test account:", accountId);

if (accountId) {
  await page.evaluate((id) => window.__AFV_TEST__.select("item", id), accountId);
  await page.waitForTimeout(200);

  for (const popoverKind of ["selection-data", "selection-style"]) {
    log(`\n  -- ${popoverKind} --`);
    await page.evaluate((k) => window.__AFV_TEST__.openPopover(k), popoverKind);
    await page.waitForTimeout(200);

    const allChips = await page.evaluate(() => {
      const chips = [...document.querySelectorAll("[data-selection-popover] .chip[data-set]")];
      return chips.map((c) => ({ text: c.textContent.trim(), set: c.dataset.set, field: c.dataset.field, value: c.dataset.value, active: c.classList.contains("is-active") }));
    });
    log(`    chips: ${allChips.length}`);

    // Group by field
    const byField = {};
    for (const c of allChips) (byField[c.field] = byField[c.field] || []).push(c);

    for (const [field, chips] of Object.entries(byField)) {
      const target = chips.find((c) => !c.active);
      if (!target) continue;

      const before = await page.evaluate((id) => {
        const node = document.querySelector(`.canvas-item[data-item-id='${id}']`);
        const item = window.__AFV_TEST__.getState().items.find((i) => i.id === id);
        const fdata = window.__AFV_TEST__.getState().financeData[item?.financeId];
        return {
          cls: node?.className,
          name: node?.querySelector(".finance-name, .item-headline")?.textContent.trim(),
          note: node?.querySelector(".finance-note")?.textContent.trim(),
          type: node?.querySelector(".finance-type")?.textContent.trim(),
          subtitle: item?.subtitle,
          category: fdata?.category,
        };
      }, accountId);

      await page.evaluate((field) => {
        const chip = [...document.querySelectorAll(`[data-selection-popover] .chip[data-field='${field}']`)].find((c) => !c.classList.contains("is-active"));
        if (chip) chip.click();
      }, field);
      await page.waitForTimeout(250);

      const after = await page.evaluate((id) => {
        const node = document.querySelector(`.canvas-item[data-item-id='${id}']`);
        const item = window.__AFV_TEST__.getState().items.find((i) => i.id === id);
        const fdata = window.__AFV_TEST__.getState().financeData[item?.financeId];
        return {
          cls: node?.className,
          name: node?.querySelector(".finance-name, .item-headline")?.textContent.trim(),
          note: node?.querySelector(".finance-note")?.textContent.trim(),
          type: node?.querySelector(".finance-type")?.textContent.trim(),
          subtitle: item?.subtitle,
          category: fdata?.category,
        };
      }, accountId);

      const visualChanged = JSON.stringify({ ...before, subtitle: 0, category: 0 }) !== JSON.stringify({ ...after, subtitle: 0, category: 0 });
      const stateChanged = JSON.stringify(before) !== JSON.stringify(after);

      const tag = visualChanged ? "OK" : (stateChanged ? "BUG" : "WARN");
      const why = visualChanged
        ? `visible change after clicking ${field}=${target.value}`
        : (stateChanged ? `${field}=${target.value}: state changed but NOTHING VISIBLE changed` : `${field}=${target.value}: nothing changed at all`);
      if (tag === "OK") log(`    ✓ ${field}: ${why}`);
      else note(tag, `chip/${popoverKind}/${field}`, why);
    }
  }
}

await page.evaluate(() => window.__AFV_TEST__.clearSelection());

// === 9. Theme switch sanity ===
log("\n=== 9. SWITCH THEMES ===");
for (const theme of ["stewardship", "horizon", "camino"]) {
  await page.evaluate((t) => window.__AFV_TEST__.setTheme(t), theme);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/theme-${theme}.png` });
  const themeNow = await page.evaluate(() => document.body.dataset.theme);
  if (themeNow !== theme) note("BUG", `theme/${theme}`, `setTheme called but body data-theme is "${themeNow}"`);
}

// === 10. Each template ===
log("\n=== 10. LOAD EACH TEMPLATE ===");
const allTemplateIds = await page.evaluate(() => {
  const tpl = window.__AFV_TEST__.getState();
  return Object.keys(tpl.templates || {});
});
log("templates available via state:", allTemplateIds);
for (const tplId of allTemplateIds.slice(0, 6)) {
  try {
    await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), tplId);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/template-${tplId}.png` });
    log(`  ✓ ${tplId}: loaded`);
  } catch (err) {
    note("BUG", `template/${tplId}`, err.message);
  }
}

await browser.close();

// === Summary ===
const bugs = findings.filter((f) => f.level === "BUG");
const warns = findings.filter((f) => f.level === "WARN");
const errs = findings.filter((f) => f.level === "ERR");
log("\n========== SUMMARY ==========");
log(`Bugs:   ${bugs.length}`);
log(`Warns:  ${warns.length}`);
log(`Errors: ${errs.length}`);
log(`Console errors: ${errors.length}`);
log("\nbug findings:");
bugs.forEach((f) => log(`  [BUG] ${f.where}: ${f.msg}`));
log("\nwarn findings:");
warns.forEach((f) => log(`  [WARN] ${f.where}: ${f.msg}`));
log("\nerr findings:");
errs.forEach((f) => log(`  [ERR] ${f.where}: ${f.msg}`));
log("\nconsole errors:");
errors.forEach((e) => log(`  [${e.kind}] ${e.text}`));

writeFileSync(resolve(OUT, "findings.json"), JSON.stringify({ findings, errors, summary: { bugs: bugs.length, warns: warns.length, errs: errs.length, console: errors.length } }, null, 2));
log(`\nfindings written to ${OUT}/findings.json`);
