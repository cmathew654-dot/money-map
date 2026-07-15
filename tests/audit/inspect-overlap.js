import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:54217/index.html?test=1");
await page.waitForFunction(() => window.__AFV_TEST__);
await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
await page.waitForTimeout(300);

const detail = await page.evaluate(() => {
  const ids = ["retirement-headline", "advisorNote", "householdLabel"];
  return ids.map((id) => {
    const el = document.querySelector(`[data-item-id='${id}']`);
    if (!el) return { id, exists: false };
    const r = el.getBoundingClientRect();
    const item = window.__AFV_TEST__.getState().items.find((i) => i.id === id);
    return {
      id,
      exists: true,
      itemX: item?.x, itemY: item?.y, itemW: item?.w, itemH: item?.h,
      rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
      classList: el.className,
      contentText: el.textContent.trim().slice(0, 60),
    };
  });
});
console.log(JSON.stringify(detail, null, 2));
await browser.close();
