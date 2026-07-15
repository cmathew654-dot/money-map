const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";

async function openTemplate(page, templateId = "retirementPaycheck") {
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.locator("#fitButton").click();
}

async function state(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

test.describe("advisor meeting layer", () => {
  test("action rail focuses canvas targets and carries next steps into presentation", async ({ page }) => {
    await openTemplate(page, "retirementPaycheck");
    // Open the meeting panel through its discoverable toggle. The rail also
    // expands on :hover, but it collapses to width 0 and the Meeting button
    // (aria-controls="scenarioRail") sits over the rail's hover point, so the
    // button click is the canonical open affordance.
    await page.locator("#meetingPanelButton").click();

    await expect(page.locator(".meeting-tabs")).toBeVisible();
    await expect(page.locator('[data-meeting-pane="actions"]')).toBeVisible();
    await expect(page.locator('[data-meeting-row="confirm-need"]')).toContainText("Confirm monthly spending target");

    await page.locator('[data-meeting-row="confirm-need"] .meeting-focus-button').click();
    await expect(page.locator('.canvas-item[data-item-id="paycheck"]')).toHaveClass(/is-meeting-focus/);
    expect((await state(page)).meeting.focus).toEqual({ kind: "item", id: "paycheck" });

    await page.locator('[data-meeting-row="confirm-need"] .meeting-status').click();
    expect((await state(page)).meeting.actionStatuses["confirm-need"]).toBe("agreed");
    await expect(page.locator('[data-meeting-row="confirm-need"]')).toHaveClass(/status-agreed/);

    await page.locator('[data-meeting-tab="decisions"]').click();
    await expect(page.locator('[data-meeting-pane="decisions"]')).toBeVisible();
    await expect(page.locator('[data-meeting-row="coverage"]')).toContainText("Coverage status");

    await page.locator("#presentationButton").click();
    await expect(page.locator("body")).toHaveClass(/presentation/);
    await expect(page.locator(".presentation-meeting-summary")).toBeVisible();
    await expect(page.locator(".presentation-meeting-summary")).toContainText("Next steps");
    await expect(page.locator(".presentation-meeting-summary")).toContainText("Confirm monthly spending target");
  });

  test("estate meeting layer uses trust and beneficiary-specific actions", async ({ page }) => {
    await openTemplate(page, "estate");
    await page.locator("#meetingPanelButton").click();

    await expect(page.locator('[data-meeting-row="attorney-review"]')).toContainText("estate attorney");
    await page.locator('[data-meeting-row="attorney-review"] .meeting-focus-button').click();
    await expect(page.locator('.connector-draw[data-connector-id="assetTransfer"]')).toHaveClass(/is-meeting-focus/);
    expect((await state(page)).meeting.focus).toEqual({ kind: "connector", id: "assetTransfer" });

    await page.locator('[data-meeting-tab="talk"]').click();
    await expect(page.locator('[data-meeting-pane="talk"]')).toContainText("trust as the central object");
  });
});
