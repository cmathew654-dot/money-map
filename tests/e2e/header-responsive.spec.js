const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";
const HEADER_HEIGHT = 72;
const NARROW_WIDTHS = [1060, 1280];

function overlaps(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

for (const width of NARROW_WIDTHS) {
  test.describe(`header layout at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`header bar, breadcrumb, and Present button stay contained at ${width}px`, async ({ page }) => {
      await page.goto(APP_URL);
      await page.waitForFunction(() => window.__AFV_TEST__);

      const topbar = await page.locator(".topbar").boundingBox();
      const lockup = await page.locator(".brand-lockup").boundingBox();
      const cluster = await page.locator(".command-cluster").boundingBox();
      const presentButton = await page.locator("#presentationButton").boundingBox();

      expect(topbar).toBeTruthy();
      expect(lockup).toBeTruthy();
      expect(cluster).toBeTruthy();
      expect(presentButton).toBeTruthy();

      // The header bar itself never grows past its declared height (no wrap-driven spill).
      expect(topbar.height, "header bar height").toBeLessThanOrEqual(HEADER_HEIGHT);

      // Breadcrumb/title block and the toolbar both stay vertically inside the header bar.
      expect(lockup.y, "breadcrumb/title top").toBeGreaterThanOrEqual(topbar.y);
      expect(lockup.y + lockup.height, "breadcrumb/title bottom").toBeLessThanOrEqual(topbar.y + topbar.height + 0.5);
      expect(cluster.y, "toolbar top").toBeGreaterThanOrEqual(topbar.y);
      expect(cluster.y + cluster.height, "toolbar bottom").toBeLessThanOrEqual(topbar.y + topbar.height + 0.5);

      // Present button is always fully inside the viewport (never clipped at the edge).
      expect(presentButton.x, "Present button left edge").toBeGreaterThanOrEqual(0);
      expect(presentButton.x + presentButton.width, "Present button right edge").toBeLessThanOrEqual(width);
      expect(presentButton.y, "Present button top edge").toBeGreaterThanOrEqual(0);
      expect(presentButton.y + presentButton.height, "Present button bottom edge").toBeLessThanOrEqual(900);

      // Breadcrumb/title block and the command toolbar never overlap each other.
      const lockupRect = { left: lockup.x, right: lockup.x + lockup.width, top: lockup.y, bottom: lockup.y + lockup.height };
      const clusterRect = { left: cluster.x, right: cluster.x + cluster.width, top: cluster.y, bottom: cluster.y + cluster.height };
      expect(overlaps(lockupRect, clusterRect), "breadcrumb/title should not overlap the toolbar").toBe(false);
    });
  });
}
