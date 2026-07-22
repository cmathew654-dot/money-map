import { expect, test, type Page } from "@playwright/test";

const stories = [
  "Retirement Income",
  "RMD & Withholding",
  "Annuity Income Floor",
  "Roth Conversion",
];

async function resetChooser(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Choose a story" })).toBeVisible();
}

async function unconnectedPair(page: Page): Promise<[string, string]> {
  const ids = await page
    .locator(".react-flow__node[data-id]")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.id!));
  const pairs = await page
    .locator(".money-map-flow-label-wrap")
    .evaluateAll((labels) =>
      labels.map((label) =>
        [(label as HTMLElement).dataset.flowSource!, (label as HTMLElement).dataset.flowTarget!]
          .sort()
          .join("|"),
      ),
    );
  const connected = new Set(pairs);
  for (let first = 0; first < ids.length; first += 1) {
    for (let second = first + 1; second < ids.length; second += 1) {
      if (!connected.has([ids[first], ids[second]].sort().join("|"))) {
        return [ids[first], ids[second]];
      }
    }
  }
  throw new Error("No unconnected pair found");
}

function card(page: Page, id: string) {
  return page.locator(`.react-flow__node[data-id="${id}"] .money-map-module`);
}

test("1440x900 recruiter journey and four-story production smoke", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await resetChooser(page);
  await page.getByRole("button", { name: /Retirement Income/i }).click();

  const moving = card(page, "retirement-income");
  const before = await moving.boundingBox();
  if (!before) throw new Error("Missing draggable retirement card");
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 36, before.y + before.height / 2 + 24, {
    steps: 8,
  });
  await page.mouse.up();
  const after = await moving.boundingBox();
  expect(after?.x).not.toBe(before.x);

  const sentinel = "≈$11,800/mo — $_____ — advisor note";
  await moving.getByText("$6,400/mo gross", { exact: true }).dblclick();
  const literal = page.getByRole("textbox", { name: "Edit Social Security value" });
  await literal.fill(sentinel);
  await literal.press("Enter");
  await expect(moving.getByText(sentinel, { exact: true })).toBeVisible();

  const moduleCount = await page.locator(".money-map-module").count();
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByRole("button", { name: /^Ledger/ }).click();
  const newTitle = page.getByRole("textbox", { name: "Edit shape title" });
  await newTitle.fill("Recruiter audit card");
  await newTitle.press("Enter");
  await expect(page.locator(".money-map-module")).toHaveCount(moduleCount + 1);
  const addedNode = page.locator(".react-flow__node").filter({ hasText: "Recruiter audit card" });
  const addedId = await addedNode.getAttribute("data-id");
  if (!addedId) throw new Error("Missing created card id");
  await page.getByRole("button", { name: "Fit story" }).click();
  await expect(moving).toBeInViewport();
  await expect(card(page, addedId)).toBeInViewport();

  const relationships = page.locator(".money-map-flow-label-wrap");
  const relationshipCount = await relationships.count();
  await page.getByRole("button", { name: "Connect mode" }).click();
  await moving.click();
  await card(page, addedId).click();
  await expect(relationships).toHaveCount(relationshipCount + 1);
  await expect(page.getByRole("button", { name: "Connect mode" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  const moveAgain = await moving.boundingBox();
  if (!moveAgain) throw new Error("Missing card after relationship creation");
  await page.mouse.move(moveAgain.x + moveAgain.width / 2, moveAgain.y + moveAgain.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    moveAgain.x + moveAgain.width / 2 + 24,
    moveAgain.y + moveAgain.height / 2,
    {
      steps: 8,
    },
  );
  await page.mouse.up();

  await page.getByRole("button", { name: "Connect mode" }).click();
  await moving.click();
  await card(page, addedId).click();
  await expect(relationships).toHaveCount(relationshipCount + 1);
  await expect(page.getByText("Those cards are already connected.", { exact: true })).toBeVisible();

  await moving.click();
  await page.getByRole("button", { name: "Connect to…" }).click();
  await page.locator(`[data-target-id="${addedId}"]`).click();
  await expect(relationships).toHaveCount(relationshipCount + 1);
  await page.keyboard.press("Control+z");
  await expect(relationships).toHaveCount(relationshipCount + 1);
  await page.keyboard.press("Control+z");
  await expect(relationships).toHaveCount(relationshipCount);
  await page.keyboard.press("Control+Shift+z");
  await expect(relationships).toHaveCount(relationshipCount + 1);
  await page.keyboard.press("Control+Shift+z");
  await expect(relationships).toHaveCount(relationshipCount + 1);
  await expect(moving.getByText(sentinel, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Present" }).click();
  const steps = page.locator(".presentation-rail__step");
  await expect(steps).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    await steps.nth(index).click();
    await expect(steps.nth(index)).toHaveAttribute("aria-current", "step");
  }
  await expect(page.getByText(sentinel, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exit presentation" }).click();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search actions" }).fill("reset story");
  await page.getByRole("option", { name: "Reset story", exact: true }).click();
  await expect(page.getByText(sentinel, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to stories" }).click();
  await expect(page.getByRole("heading", { name: "Choose a story" })).toBeVisible();

  for (const story of stories) {
    await page.getByRole("button", { name: new RegExp(story) }).click();
    await expect(page.getByRole("heading", { name: story })).toBeVisible();
    await expect(page.getByText("As of July 2026")).toBeVisible();
    await expect(page.getByText("Synthetic demo · advisor-entered values")).toBeVisible();
    await expect(page.getByRole("toolbar", { name: /cadence/i })).toBeVisible();

    const [source, target] = await unconnectedPair(page);
    const count = await page.locator(".money-map-flow-label-wrap").count();
    await page.getByRole("button", { name: "Connect mode" }).click();
    await card(page, source).click();
    await card(page, target).click();
    await expect(page.locator(".money-map-flow-label-wrap")).toHaveCount(count + 1);

    await page.getByRole("button", { name: "Present" }).click();
    await expect(page.locator(".presentation-rail__step")).toHaveCount(6);
    const labels = await page.locator(".presentation-rail__step").allTextContents();
    expect(labels.every((label) => label.trim().length > 0)).toBe(true);
    await page.getByRole("button", { name: "Exit presentation" }).click();
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: "Search actions" }).fill("reset story");
    await page.getByRole("option", { name: "Reset story", exact: true }).click();
    await page.getByRole("button", { name: "Back to stories" }).click();
  }

  expect(errors).toEqual([]);
});
