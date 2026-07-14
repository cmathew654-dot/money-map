const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:4173/index.html?test=1";

const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  return errors;
}

function parseCompact(text) {
  const m = String(text).match(/\$([\d.]+)\s*([KMB]?)/i);
  if (!m) return NaN;
  const scale = { K: 1e3, M: 1e6, B: 1e9, "": 1 }[m[2].toUpperCase()];
  return Number(m[1]) * scale;
}

test.describe("remediation :: inventory header agrees with rows", () => {
  test("account inventory header total matches the sum of visible category subtotals", async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirement"));
    await settle(page);

    await page.locator("#inventoryButton").click();
    await settle(page);
    const data = await page.evaluate(() => {
      const pop = document.querySelector("#inventoryPopover");
      return {
        header: pop.querySelector(".inventory-total").textContent,
        subtotals: [...pop.querySelectorAll(".group-total")].map((g) => g.textContent),
        rows: [...pop.querySelectorAll(".row-value")].map((r) => r.textContent)
      };
    });

    const headerVal = parseCompact(data.header);
    const subtotalSum = data.subtotals.reduce((s, t) => s + parseCompact(t), 0);
    const rowSum = data.rows.reduce((s, t) => s + parseCompact(t), 0);

    // header must reflect the visible rows, not round $1,592K up to a bare "$2M".
    expect(Math.abs(headerVal - subtotalSum) / Math.max(subtotalSum, 1)).toBeLessThan(0.01);
    expect(Math.abs(headerVal - rowSum) / Math.max(rowSum, 1)).toBeLessThan(0.01);
    expect(errors).toEqual([]);
  });
});

test.describe("remediation :: value-edit caption + shortfall", () => {
  test("editing a card value re-derives its start/out caption", async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirementPaycheck"));
    await settle(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "portfolio");
      window.__AFV_TEST__.openPopover("selection-data");
    });
    await settle(page);

    const caption = page.locator('.flow-breakdown[data-item-id="portfolio"]').first();
    await expect(caption).toHaveCount(1);
    const before = (await caption.textContent()).trim();
    expect(before).toContain("start");

    const input = page.locator('input[data-input="finance-value"]').first();
    await input.focus();
    await input.fill("500000");
    await input.dispatchEvent("change");
    await settle(page);

    const after = (await caption.textContent()).trim();
    expect(after).not.toBe(before); // caption re-derived on edit
    expect(after).toContain("$500K start");
    expect(errors).toEqual([]);
  });

  test("a computed negative net balance renders as an explicit shortfall", async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__AFV_TEST__.loadTemplate("retirementPaycheck"));
    await settle(page);
    await page.evaluate(() => {
      window.__AFV_TEST__.select("item", "portfolio");
      window.__AFV_TEST__.openPopover("selection-data");
    });
    await settle(page);
    const input = page.locator('input[data-input="finance-value"]').first();
    await input.focus();
    await input.fill("10000");
    await input.dispatchEvent("change");
    await settle(page);
    await page.evaluate(() => window.__AFV_TEST__.setScenario("monthlyDistribution", 12000));
    await settle(page);

    const info = await page.evaluate(() => {
      const net = window.__AFV_TEST__.getComputedViewModel().financeValues.portfolio;
      const card = document.querySelector('.canvas-item[data-item-id="portfolio"] .finance-value');
      const readout = document.querySelector('.computed-readout[data-popover-readout="after-flows"][data-item-id="portfolio"]');
      return {
        net,
        cardShortfall: card ? card.classList.contains("is-shortfall") : null,
        cardTitle: card ? card.getAttribute("title") : null,
        readoutShortfall: readout ? readout.classList.contains("is-shortfall") : null,
        readoutTitle: readout ? readout.getAttribute("title") : null
      };
    });

    expect(info.net).toBeLessThan(0);
    expect(info.cardShortfall).toBe(true);
    expect(info.cardTitle || "").toMatch(/shortfall/i);
    expect(info.readoutShortfall).toBe(true);
    expect(info.readoutTitle || "").toMatch(/shortfall/i);
    expect(errors).toEqual([]);
  });
});
