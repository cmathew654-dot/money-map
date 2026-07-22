import { expect, test } from "@playwright/test";

import { settledCanvasCamera } from "./cameraHelpers";

test.use({ hasTouch: true });

test("coarse-pointer reconnect grips are at least 44px and reconnect the intended endpoint", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await settledCanvasCamera(page);

  const literal = "$250,000";
  const sourceLiteral = page
    .locator('.react-flow__node[data-id="annuity-source"]')
    .getByText(literal, { exact: true });
  await expect(sourceLiteral).toBeVisible();
  const relationship = page.getByRole("button", {
    name: /planned relationship from annuity-source to annuity-plan/i,
  });
  await expect(page.locator(".react-flow__edgeupdater")).toHaveCount(0);
  await relationship.click();

  const updaters = page.locator(".react-flow__edgeupdater");
  await expect(updaters).toHaveCount(2);
  for (const updater of await updaters.all()) {
    const box = await updater.boundingBox();
    if (!box) throw new Error("Expected reconnect grip geometry");
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const liveHandles = page.locator(
    '.money-map-module[data-reconnect-mode="true"] .money-map-handle',
  );
  await expect(liveHandles).not.toHaveCount(0);
  const handleBox = await liveHandles.first().boundingBox();
  if (!handleBox) throw new Error("Expected coarse attachment target geometry");
  expect(handleBox.width).toBeGreaterThanOrEqual(44);
  expect(handleBox.height).toBeGreaterThanOrEqual(44);

  const from = page.locator(".react-flow__edgeupdater-target");
  const to = page.locator(
    '.react-flow__node[data-id="annuity-policy"] .react-flow__handle-left.source',
  );
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) throw new Error("Expected endpoint reconnection bounds");
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(
    page.getByRole("button", {
      name: /planned relationship from annuity-source to annuity-policy/i,
    }),
  ).toBeVisible();
  await expect(sourceLiteral).toBeVisible();

  await page.locator(".react-flow__pane").click({ position: { x: 8, y: 8 }, force: true });
  await expect(page.locator(".react-flow__edgeupdater")).toHaveCount(0);
});
