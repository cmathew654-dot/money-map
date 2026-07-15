// One-off visual verification capture for Phase 2 human checkpoint.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:54217', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // onboarding thumbnails render

  // 1. Onboarding overlay (ONBD-01/02)
  await page.screenshot({ path: 'demos/verify-1-onboarding.png' });

  // 2. Load retirement template — two-plane staged depth + gap vessel
  const tile = page.locator('button', { hasText: /retirement/i }).first();
  await tile.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'demos/verify-2-retirement-scene.png' });

  // 3. Load roth (other two-plane template) for a second look at staged depth
  const info = await page.evaluate(() => window.__AFV_TEST__ ? window.__AFV_TEST__.sceneInfo() : null);
  console.log('sceneInfo:', JSON.stringify(info, null, 2));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
