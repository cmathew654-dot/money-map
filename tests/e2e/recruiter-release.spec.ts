import { expect, test, type Page } from "@playwright/test";

import { settledCanvasCamera } from "./cameraHelpers";

async function openAnnuity(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  await settledCanvasCamera(page);
}

async function findUnconnectedPair(page: Page): Promise<[string, string]> {
  const moduleIds = await page
    .locator(".react-flow__node[data-id]")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.id!));
  const labels = await page
    .locator(".money-map-flow-label-wrap button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? ""));
  const connected = new Set<string>();
  for (const label of labels) {
    const match = label.match(/relationship from ([^ ]+) to ([^:]+):/i);
    if (!match) continue;
    connected.add([match[1], match[2]].sort().join("|"));
  }
  for (let sourceIndex = 0; sourceIndex < moduleIds.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < moduleIds.length; targetIndex += 1) {
      const source = moduleIds[sourceIndex];
      const target = moduleIds[targetIndex];
      if (!connected.has([source, target].sort().join("|"))) return [source, target];
    }
  }
  throw new Error("Expected at least one unconnected pair");
}

function card(page: Page, id: string) {
  return page.locator(`.react-flow__node[data-id="${id}"] .money-map-module`);
}

async function enterConnect(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Connect mode" }).click();
  await expect(page.getByRole("button", { name: "Connect mode" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

test("Connect is one-shot and duplicate-safe through pointer and Connect to", async ({ page }) => {
  await openAnnuity(page);
  const relationships = page.locator(".money-map-flow-label-wrap");
  const baseline = await relationships.count();
  const [source, target] = await findUnconnectedPair(page);

  await enterConnect(page);
  await card(page, source).click();
  await card(page, target).click();
  await expect(relationships).toHaveCount(baseline + 1);
  await expect(page.getByRole("button", { name: "Connect mode" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByText(/click a card, then click another/i)).toHaveCount(0);
  const created = page.getByRole("button", {
    name: new RegExp(`relationship from ${source} to ${target}: New transfer`, "i"),
  });
  await expect(created).toBeFocused();
  await expect(page.getByRole("toolbar", { name: "Selected relationship actions" })).toBeVisible();

  await enterConnect(page);
  await card(page, source).click();
  await card(page, target).click();
  await expect(relationships).toHaveCount(baseline + 1);
  await expect(page.getByText("Those cards are already connected.", { exact: true })).toBeVisible();
  await expect(created).toBeFocused();

  await enterConnect(page);
  await card(page, target).click();
  await card(page, source).click();
  await expect(relationships).toHaveCount(baseline + 1);
  await expect(page.getByText("Those cards are already connected.", { exact: true })).toBeVisible();
  await expect(created).toBeFocused();

  await card(page, source).click();
  await page.keyboard.press("l");
  await expect(page.getByLabel("Connect to…")).toBeVisible();
  await page.locator(`[data-target-id="${target}"]`).click();
  await expect(relationships).toHaveCount(baseline + 1);
  await expect(page.getByText("Those cards are already connected.", { exact: true })).toBeVisible();
  await expect(created).toBeFocused();

  await page.keyboard.press("Control+z");
  await expect(relationships).toHaveCount(baseline);
  await page.keyboard.press("Control+z");
  await expect(relationships).toHaveCount(baseline);
  await page.keyboard.press("Control+Shift+z");
  await expect(relationships).toHaveCount(baseline + 1);
  await page.keyboard.press("Control+Shift+z");
  await expect(relationships).toHaveCount(baseline + 1);
});

test("self-connect and empty-canvas attempts exit cleanly without mutations", async ({ page }) => {
  await openAnnuity(page);
  const modules = page.locator(".money-map-module");
  const relationships = page.locator(".money-map-flow-label-wrap");
  const moduleCount = await modules.count();
  const relationshipCount = await relationships.count();
  const source = await page.locator(".react-flow__node[data-id]").first().getAttribute("data-id");
  if (!source) throw new Error("Expected a source card");

  await enterConnect(page);
  await card(page, source).click();
  await card(page, source).click();
  await expect(modules).toHaveCount(moduleCount);
  await expect(relationships).toHaveCount(relationshipCount);
  await expect(page.getByText("Choose two different cards.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect mode" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await enterConnect(page);
  await card(page, source).click();
  const pane = page.locator(".react-flow__pane");
  const paneBox = await pane.boundingBox();
  if (!paneBox) throw new Error("Expected canvas geometry");
  await pane.click({
    force: true,
    position: { x: paneBox.width - 8, y: paneBox.height - 8 },
  });
  await expect(modules).toHaveCount(moduleCount);
  await expect(relationships).toHaveCount(relationshipCount);
  await expect(page.getByRole("button", { name: "Connect mode" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("Connect never leaks through editor surfaces, presentation, reset, reload, or Back", async ({
  page,
}) => {
  await openAnnuity(page);
  const connect = page.getByRole("button", { name: "Connect mode" });

  await card(page, "annuity-policy").click();
  await page.getByRole("button", { name: "Connect to…" }).click();
  const picker = page.getByLabel("Connect to…");
  await expect(picker).toBeVisible();
  await picker.press("c");
  await expect(connect).toHaveAttribute("aria-pressed", "false");
  await picker.press("Escape");

  await page.getByRole("button", { name: /Actions/ }).click();
  const search = page.getByRole("combobox", { name: "Search actions" });
  await search.fill("c");
  await search.press("c");
  await expect(connect).toHaveAttribute("aria-pressed", "false");
  await search.press("Escape");

  await enterConnect(page);
  await page.getByRole("button", { name: "Present" }).click();
  await expect(page.getByRole("button", { name: "Exit presentation" })).toBeVisible();
  await page.getByRole("button", { name: "Exit presentation" }).click();
  await expect(connect).toHaveAttribute("aria-pressed", "false");

  await enterConnect(page);
  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  await expect(connect).toHaveAttribute("aria-pressed", "false");

  await enterConnect(page);
  await page.getByRole("button", { name: "Back to stories" }).click();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  await expect(connect).toHaveAttribute("aria-pressed", "false");

  await enterConnect(page);
  await page.keyboard.press("Control+k");
  const resetSearch = page.getByRole("combobox", { name: "Search actions" });
  await resetSearch.fill("reset story");
  await page.getByRole("option", { name: "Reset story", exact: true }).click();
  await expect(connect).toHaveAttribute("aria-pressed", "false");
});

test("storage-unavailable startup renders and remains editable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => undefined,
    });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose a story" })).toBeVisible();
  await page.getByRole("button", { name: /Retirement Income/i }).click();
  const title = page.locator('.react-flow__node[data-id="retirement-income"] h2');
  await title.dblclick();
  const editor = page.getByRole("textbox", { name: "Edit shape title" });
  await editor.fill("Memory-only story edit");
  await editor.press("Enter");
  await expect(page.getByText("Memory-only story edit", { exact: true })).toBeVisible();
});

test("a financial card swapped to text keeps exact content in presentation and persistence", async ({
  page,
}) => {
  const sentinel = "≈$11,800/mo — $_____ — advisor note";
  await openAnnuity(page);
  const source = page.locator('.react-flow__node[data-id="annuity-source"]');
  await source.getByText("$250,000", { exact: true }).dblclick();
  const value = page.getByRole("textbox", { name: "Edit Current balance value" });
  await value.fill(sentinel);
  await value.press("Enter");
  await expect(source.getByText(sentinel, { exact: true })).toBeVisible();

  await source.locator(".money-map-module").click();
  await page.getByRole("button", { name: "Style shape" }).click();
  await page.getByRole("button", { name: "Text note" }).click();
  await expect(source.locator(".money-map-module")).toHaveAttribute("data-primitive", "text");
  await page.getByLabel("Advanced properties").getByRole("button", { name: "Close" }).click();
  await expect(source.getByText(sentinel, { exact: true })).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(source.locator(".money-map-module")).not.toHaveAttribute("data-primitive", "text");
  await expect(source.getByText(sentinel, { exact: true })).toBeVisible();
  await page.keyboard.press("Control+Shift+z");
  await expect(source.locator(".money-map-module")).toHaveAttribute("data-primitive", "text");
  await expect(source.getByText(sentinel, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Present" }).click();
  await expect(page.getByRole("main", { name: "Annuity Income Floor presentation" })).toBeVisible();
  await expect(page.getByText("Investment account", { exact: true })).toBeVisible();
  await expect(page.getByText(sentinel, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exit presentation" }).click();

  await page.reload();
  await page.getByRole("button", { name: /Annuity Income Floor/i }).click();
  await expect(page.getByText(sentinel, { exact: true })).toBeVisible();
  await expect(
    page.locator('.react-flow__node[data-id="annuity-source"] .money-map-module'),
  ).toHaveAttribute("data-primitive", "text");
});
