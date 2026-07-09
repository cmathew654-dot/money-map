const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:4173/index.html?test=1";

async function openApp(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  return errors;
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function finance(id, x, y) {
  return {
    id,
    type: "finance",
    visual: "card",
    label: id === "source" ? "Source Account" : "Target Account",
    subtitle: "Brokerage",
    note: "Stress fixture",
    x,
    y,
    w: 250,
    h: 132,
    zIndex: 20,
    financeId: id,
    style: {}
  };
}

function flow(id, label, amount) {
  return {
    id,
    label,
    flowType: "transfer",
    amount,
    max: 250000,
    source: { itemId: "source" },
    target: { itemId: "target" },
    routeStyle: "smartArc",
    strokeStyle: "solid",
    arrowStart: "none",
    arrowEnd: "arrow",
    labelMode: "auto",
    labelPoint: null,
    colorMode: "flow",
    widthMode: "medium",
    customWidth: 5,
    manualMid: false,
    mid: null
  };
}

async function nearbyMiddleSamples(page) {
  return page.evaluate(() => {
    const paths = [...document.querySelectorAll(".connector-draw[data-connector-id]")].map((path) => {
      const length = path.getTotalLength();
      const matrix = path.getScreenCTM();
      const samples = [];
      for (let index = 3; index <= 21; index += 1) {
        const raw = path.getPointAtLength(length * (index / 24));
        samples.push({
          x: raw.x * matrix.a + raw.y * matrix.c + matrix.e,
          y: raw.x * matrix.b + raw.y * matrix.d + matrix.f
        });
      }
      return { id: path.getAttribute("data-connector-id"), samples };
    });

    const findings = [];
    for (let a = 0; a < paths.length; a += 1) {
      for (let b = a + 1; b < paths.length; b += 1) {
        let close = 0;
        for (const p1 of paths[a].samples) {
          for (const p2 of paths[b].samples) {
            if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 12) close += 1;
          }
        }
        if (close > 2) findings.push(`${paths[a].id}/${paths[b].id}:${close}`);
      }
    }
    return findings;
  });
}

test.describe("layout stress behavior", () => {
  test("parallel automatic flows separate instead of stacking on the same path", async ({ page }) => {
    const errors = await openApp(page);
    const diagram = {
      items: [finance("source", 620, 500), finance("target", 980, 500)],
      financeData: {
        source: { category: "brokerage", value: 500000, capacity: 900000, baseValue: 500000 },
        target: { category: "brokerage", value: 100000, capacity: 700000, baseValue: 100000 }
      },
      connectors: [
        flow("parallelA", "Parallel A", 50000),
        flow("parallelB", "Parallel B", 60000),
        flow("parallelC", "Parallel C", 70000)
      ],
      scenario: {}
    };
    await page.evaluate((nextDiagram) => window.__AFV_TEST__.loadDiagram(nextDiagram), diagram);
    await page.locator("#fitButton").click();
    await settle(page);

    const paths = await page.locator(".connector-draw").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")));
    expect(new Set(paths).size).toBe(3);
    expect(await nearbyMiddleSamples(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
