const { test, expect } = require("@playwright/test");

const BASE_URL = "http://localhost:4173/index.html";
const APP_URL = `${BASE_URL}?test=1`;

test("publishes Money Map release metadata", async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle("Money Map");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /advisor.*account.*flow/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://cmathew654-dot.github.io/money-map/"
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Money Map");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://cmathew654-dot.github.io/money-map/docs/media/social-preview.png"
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
});

test("every shipped scenario carries visible synthetic-data provenance", async ({ page }) => {
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await expect(page.locator("#demoDataMarker")).toContainText(/fictional demo data/i);
  await expect(page.locator("#demoDataMarker")).toBeVisible();

  const templateIds = await page.evaluate(() => (
    [...document.querySelectorAll(".template-catalog-card[data-template-id]")]
      .map((node) => node.getAttribute("data-template-id"))
  ));
  expect(templateIds).toHaveLength(16);

  for (const templateId of templateIds) {
    await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
    const disclosure = await page.evaluate(() => {
      const item = window.__AFV_TEST__.getState().items.find((entry) => entry.style?.textStyle === "disclosure");
      return item ? { id: item.id, label: item.label, locked: item.locked } : null;
    });
    expect(disclosure, templateId).toBeTruthy();
    expect(disclosure.label, templateId).toMatch(/synthetic demo data/i);
    expect(disclosure.locked, templateId).toBe(true);
    await expect(page.locator(`[data-item-id="${disclosure.id}"]`)).toBeVisible();
  }
});
