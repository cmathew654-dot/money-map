const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:54217/index.html?test=1";
const DEFAULT_FINANCE_TEMPLATES = ["retirement", "roth", "annuity", "estate", "cashReserve"];
const PRESENTATION_STORY_LABELS = {
  retirement: ["incomeDistribution", "annuityIncome", "transfer"],
  roth: ["rothConversion", "taxPayment", "futureRmd"],
  annuity: ["annuityPremium", "annuityIncome"],
  estate: ["assetTransfer", "lifestyleSupport", "beneficiaryFlow"],
  cashReserve: ["cashTransfer", "incomeDistribution", "rebalance"],
  retirementPaycheck: ["guaranteedFlow", "annuityIncome", "portfolioDraw"],
  socialSecurityBridge: ["fundBridge", "bridgeDraw", "futureIncome"],
  bucketStrategy: ["cashDraw", "annuityBase", "bondRefill"],
  rmdTax: ["rmdSpend", "withholding", "qcd"],
  withdrawalSequencing: ["taxableDraw", "cashSmoothing", "iraLater"],
  cashCleanup: ["fundReserve", "investSurplus", "reserveDraw"],
  annuityIncomeFloor: ["premium", "floorIncome", "flexDraw"],
  executiveComp: ["taxFromBonus", "investRsu", "lifestyle"],
  businessOwner: ["quarterlyTax", "ownerDraw", "surplusInvest"],
  survivorIncome: ["guaranteed", "transitionCash", "gapDraw"],
  blankHousehold: []
};
const PRESENTATION_TEMPLATES = Object.keys(PRESENTATION_STORY_LABELS);
const MONTHLY_SCENARIO_KEYS = new Set([
  "monthlyDistribution",
  "guaranteedIncome",
  "flexibleIncome",
  "annuityIncome"
]);
const LEGACY_SUB_BUCKET_PATTERNS = [
  /\bOperating cash\b/i,
  /\bNear-term reserve\b/i,
  /\bTrust corpus\b/i,
  /\bSettlement reserve\b/i,
  /\bDisplay-only\b/i
];
const METADATA_LEAK_PATTERNS = [
  /\bcontractType\b/,
  /\baccountCategory\b/,
  /\bownershipContext\b/,
  /\bdisplayOnly\b/,
  /\bplanningUse\b/,
  /\bcontract\s+type\b/i,
  /\baccount\s+category\b/i,
  /\bownership\s+context\b/i,
  /\bdisplay\s+only\b/i,
  /\bplanning\s+use\b/i,
  /\b[a-z][a-z0-9]+[A-Z][A-Za-z0-9]*\b/
];

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function openApp(page, templateId) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__AFV_TEST__);
  await loadTemplate(page, templateId);
  return errors;
}

async function loadTemplate(page, templateId) {
  await page.evaluate((id) => window.__AFV_TEST__.loadTemplate(id), templateId);
  await page.evaluate(() => window.__AFV_TEST__.fit());
  await settle(page);
}

async function getState(page) {
  return page.evaluate(() => window.__AFV_TEST__.getState());
}

function connector(snapshot, id) {
  return snapshot.connectors.find((entry) => entry.id === id);
}

function currentCashflowEffect(conn) {
  if (conn.targetEffect) return conn.targetEffect;
  return conn.affectsTarget === false ? "none" : "increaseBalance";
}

function connectorMonthlyAmount(conn) {
  const amount = Number(conn.amount) || 0;
  return conn.cadence === "monthly" || MONTHLY_SCENARIO_KEYS.has(conn.scenarioKey)
    ? amount / 12
    : amount;
}

function dollars(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

async function subBucketLabels(surface) {
  return surface.locator(".sub-bucket-label").evaluateAll((nodes) => (
    nodes.map((node) => (node.textContent || "").trim()).filter(Boolean)
  ));
}

async function surfaceText(locator) {
  return locator.evaluate((node) => (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim());
}

async function financeSurfaceTexts(page) {
  return page.locator(".canvas-item[data-product-role] .finance-surface").evaluateAll((nodes) => (
    nodes
      .map((node) => (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
  ));
}

function stateSubBucketLabels(snapshot, itemId) {
  const financeId = snapshot.items.find((item) => item.id === itemId)?.financeId || itemId;
  const buckets = snapshot.financeData[financeId]?.subBuckets || [];
  const labels = buckets.map((bucket) => String(bucket.label || "").trim()).filter(Boolean);
  // C4: sleeved accounts render an auto-maintained, non-negative "Unallocated"
  // remainder row whenever the reconciled parent value exceeds the sum of its
  // authored sleeves (e.g. estate liquidity carries a legitimate $180K
  // remainder). Mirror that derived row so this stays a real DOM/state coherence
  // check instead of drifting on the intended remainder.
  const sleeveSum = buckets.reduce(
    (sum, bucket) => sum + (Number(bucket.value ?? bucket.amount ?? bucket.balance) || 0),
    0
  );
  const parentValue = Number(snapshot.currentValues?.[financeId] ?? snapshot.financeData[financeId]?.value) || 0;
  if (buckets.length && Math.round(parentValue) - Math.round(sleeveSum) > 0) {
    labels.push("Unallocated");
  }
  return labels;
}

function expectNoLegacySubBucketLabels(labels, context) {
  for (const pattern of LEGACY_SUB_BUCKET_PATTERNS) {
    expect(labels.join(" | "), context).not.toMatch(pattern);
  }
}

function expectConceptLabel(labels, pattern, context) {
  expect(labels.some((label) => pattern.test(label)), context).toBe(true);
}

function expectNoMetadataLeaks(text, context) {
  for (const pattern of METADATA_LEAK_PATTERNS) {
    expect(text, context).not.toMatch(pattern);
  }
}

test.describe("Heritage product visual semantics", () => {
  test("Heritage chrome uses dark advisor workspace controls", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    const chromeColors = await page.evaluate(() => {
      function rgbChannels(value) {
        const match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        return match ? match.slice(1, 4).map(Number) : [255, 255, 255];
      }
      const topbar = document.querySelector(".topbar");
      const dock = document.querySelector(".canvas-dock");
      const topbarRgb = rgbChannels(getComputedStyle(topbar).backgroundColor);
      const dockRgb = rgbChannels(getComputedStyle(dock).backgroundColor);
      return { topbarRgb, dockRgb };
    });

    expect(Math.max(...chromeColors.topbarRgb), "topbar should read as graphite/black").toBeLessThan(72);
    expect(Math.max(...chromeColors.dockRgb), "left rail should read as graphite/black").toBeLessThan(72);
    expect(errors).toEqual([]);
  });

  test("workspace chrome is neutral graphite rather than chocolate across themes", async ({ page }) => {
    const errors = await openApp(page, "retirement");

    for (const themeId of ["stewardship", "horizon", "camino"]) {
      await page.evaluate((id) => window.__AFV_TEST__.setTheme(id), themeId);
      const colors = await page.evaluate(() => {
        function rgbChannels(value) {
          const match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
          return match ? match.slice(1, 4).map(Number) : [255, 255, 255];
        }
        const topbarRgb = rgbChannels(getComputedStyle(document.querySelector(".topbar")).backgroundColor);
        const dockRgb = rgbChannels(getComputedStyle(document.querySelector(".canvas-dock")).backgroundColor);
        return { topbarRgb, dockRgb };
      });

      for (const [name, rgb] of Object.entries(colors)) {
        const spread = Math.max(...rgb) - Math.min(...rgb);
        expect(Math.max(...rgb), `${themeId} ${name} should stay dark`).toBeLessThan(72);
        expect(spread, `${themeId} ${name} should be neutral graphite, not warm brown`).toBeLessThanOrEqual(6);
      }
    }

    expect(errors).toEqual([]);
  });

  test("key finance items expose product roles in state and DOM", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    const snapshot = await getState(page);
    const expectedRoles = {
      employer401k: "retirementAccount",
      managedPortfolio: "investmentAccount",
      incomeAnnuity: "annuityPolicy",
      cashReserve: "cashReserve",
      clientIncome: "monthlyNeed"
    };

    for (const [itemId, role] of Object.entries(expectedRoles)) {
      const item = snapshot.items.find((entry) => entry.id === itemId);
      expect(item?.productRole, itemId).toBe(role);
      expect(snapshot.financeData[itemId]?.productRole, itemId).toBe(role);
      await expect(page.locator(`.canvas-item[data-item-id='${itemId}']`), itemId)
        .toHaveAttribute("data-product-role", role);
    }

    expect(errors).toEqual([]);
  });

  test("estate liquidity and trust surfaces render Heritage client-facing sleeves", async ({ page }) => {
    const errors = await openApp(page, "estate");
    const snapshot = await getState(page);

    const liquidity = page.locator(".canvas-item[data-item-id='cashReserve']");
    await expect(liquidity).toHaveAttribute("data-product-role", "cashReserve");
    expect(await liquidity.locator(".sub-bucket-card").count()).toBeGreaterThanOrEqual(2);
    const liquidityLabels = await subBucketLabels(liquidity);
    expect(liquidityLabels, "estate cash reserve labels should render from finance data")
      .toEqual(stateSubBucketLabels(snapshot, "cashReserve"));
    expectNoLegacySubBucketLabels(liquidityLabels, "estate liquidity should not use generic generated bucket labels");
    expectConceptLabel(liquidityLabels, /\bCash Reserve\b|\bAdmin Reserve\b|\bSettlement Costs?\b|\bEstate Liquidity\b/i, "estate liquidity needs a client-facing reserve label");
    expectConceptLabel(liquidityLabels, /\bAdmin Reserve\b|\bSettlement Costs?\b|\bTaxes?\b|\bExpense\b/i, "estate liquidity needs an admin, tax, or settlement cost label");
    const liquiditySleeveFit = await liquidity.evaluate((node) => {
      const surface = node.querySelector(".liquidity-container-surface")?.getBoundingClientRect();
      const cards = [...node.querySelectorAll(".sub-bucket-card")].map((card) => card.getBoundingClientRect());
      if (!surface || cards.length === 0) return false;
      return cards.every((card) => card.top >= surface.top - 1 && card.bottom <= surface.bottom + 1);
    });
    expect(liquiditySleeveFit, "all estate liquidity sleeves should be visible inside the reserve container").toBe(true);

    const trust = page.locator(".canvas-item[data-item-id='revocableTrust']");
    await expect(trust).toHaveAttribute("data-product-role", "trustEstate");
    expect(await trust.locator(".sub-bucket-card").count()).toBeGreaterThanOrEqual(3);
    const trustLabels = await subBucketLabels(trust);
    expect(trustLabels, "trust sleeve labels should render from finance data")
      .toEqual(stateSubBucketLabels(snapshot, "revocableTrust"));
    expectNoLegacySubBucketLabels(trustLabels, "estate trust should not use generic generated trust labels");
    expectConceptLabel(trustLabels, /\bLifestyle Sleeve\b|\bLifestyle\b|\bSupport\b|\bIncome\b/i, "trust needs a lifestyle/support sleeve");
    expectConceptLabel(trustLabels, /\bLegacy Sleeve\b|\bLegacy\b|\bHeirs?\b|\bBeneficiar/i, "trust needs a legacy/beneficiary sleeve");
    expectConceptLabel(trustLabels, /\bCharitable Sleeve\b|\bCharit|\bGiving\b/i, "trust needs a charitable/giving sleeve");
    expectConceptLabel(trustLabels, /\bAdmin\b|\bLiquidity\b|\bTax\b|\bExpense\b/i, "trust needs an admin/liquidity sleeve");
    const trustSleeveFit = await trust.evaluate((node) => {
      const surface = node.querySelector(".trust-container-surface")?.getBoundingClientRect();
      const cards = [...node.querySelectorAll(".sub-bucket-card")].map((card) => card.getBoundingClientRect());
      if (!surface || cards.length === 0) return false;
      return cards.every((card) => card.top >= surface.top - 1 && card.bottom <= surface.bottom + 1);
    });
    expect(trustSleeveFit, "all trust sleeves should be visible inside the trust container").toBe(true);

    expect(errors).toEqual([]);
  });

  test("container sleeve rows remain fully visible inside reference products", async ({ page }) => {
    const errors = await openApp(page, "retirement");

    for (const templateId of ["retirement", "estate"]) {
      await loadTemplate(page, templateId);
      await page.locator("#fitButton").click();
      await settle(page);

      const clipped = await page.evaluate(() => {
        return [...document.querySelectorAll(".canvas-item .sub-bucket-card")].flatMap((row) => {
          const surface = row.closest(".item-surface");
          if (!surface) return [];
          const rowRect = row.getBoundingClientRect();
          const surfaceRect = surface.getBoundingClientRect();
          const clippedVertically = rowRect.bottom > surfaceRect.bottom - 3 || rowRect.top < surfaceRect.top + 3;
          return clippedVertically
            ? [`${row.closest(".canvas-item")?.getAttribute("data-item-id")}:${row.getAttribute("data-sub-bucket-id")}`]
            : [];
        });
      });

      expect(clipped, `${templateId} sleeve rows clipped by their product container`).toEqual([]);
    }

    expect(errors).toEqual([]);
  });

  test("benchmark templates expose visible semantic flow styling", async ({ page }) => {
    const errors = await openApp(page, "retirement");

    async function flowStyle(id) {
      return page.locator(`.connector-draw[data-connector-id='${id}']`).evaluate((node) => ({
        classes: [...node.classList],
        dash: getComputedStyle(node).strokeDasharray,
        stroke: getComputedStyle(node).stroke
      }));
    }

    const transfer = await flowStyle("rollover");
    const income = await flowStyle("incomeDistribution");

    expect(transfer.classes).toContain("stroke-solid");
    expect(income.classes, "portfolio income should use a dashed support treatment").toContain("stroke-longDash");
    expect(income.dash, "income stroke should have a visible dash pattern").not.toBe("none");

    await loadTemplate(page, "estate");
    const lifestyle = await flowStyle("lifestyleSupport");
    const estateTax = await flowStyle("taxReserveFunding");
    const beneficiary = await flowStyle("beneficiaryFlow");

    expect(lifestyle.classes, "lifestyle support should use dashed income/support styling").toContain("stroke-longDash");
    expect(estateTax.classes, "tax/admin support should use oxblood dashed styling").toContain("stroke-fineDash");
    expect(beneficiary.classes, "future beneficiary transfer should use dotted styling").toContain("stroke-dotted");
    expect(estateTax.stroke).not.toBe(lifestyle.stroke);
    expect(errors).toEqual([]);
  });


  test("compact source account cards do not render sub-bucket cards by default", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    const compactAccountCases = {
      retirement: ["employer401k", "managedPortfolio", "rolloverIra"],
      roth: ["traditionalIra", "rothIra", "brokerage"],
      estate: ["estateAccount"]
    };

    for (const [templateId, itemIds] of Object.entries(compactAccountCases)) {
      await loadTemplate(page, templateId);
      for (const itemId of itemIds) {
        const card = page.locator(`.canvas-item[data-item-id='${itemId}']`);
        await expect(card, `${templateId}:${itemId}`).toHaveClass(/finance-card/);
        await expect(card.locator(".sub-bucket-card"), `${templateId}:${itemId}`).toHaveCount(0);
        await expect(card.locator(".sub-bucket-stack"), `${templateId}:${itemId}`).toHaveCount(0);
      }
    }

    expect(errors).toEqual([]);
  });

  test("reference templates do not include default advisor or annuity fee pills", async ({ page }) => {
    const errors = await openApp(page, "retirement");

    for (const templateId of ["retirement", "roth"]) {
      await loadTemplate(page, templateId);
      const snapshot = await getState(page);
      const defaultFeeItems = snapshot.items.filter((item) => /advisorFee|annuityFee/i.test(item.id) || /\bAdvisor Fee\b|\bAnnuity Fee\b/i.test(item.label || ""));
      expect(defaultFeeItems, `${templateId} should not ship visible fee assumption pills`).toEqual([]);
      await expect(page.locator(".canvas-item").filter({ hasText: /Advisor Fee|Annuity Fee/ })).toHaveCount(0);
    }

    expect(errors).toEqual([]);
  });

  test("reference meeting exhibits do not ship worksheet instruction callouts", async ({ page }) => {
    const errors = await openApp(page, "retirement");

    for (const templateId of ["retirement", "estate"]) {
      await loadTemplate(page, templateId);
      const snapshot = await getState(page);
      const instructionCallouts = snapshot.items.filter((item) => (
        item.id === "advisorNote" ||
        (item.type === "shape" && item.shape === "callout" && /start with|use this as|not a legal diagram|meeting frame|planning note/i.test(`${item.label || ""} ${item.subtitle || ""}`))
      ));
      expect(instructionCallouts, `${templateId} should read as an exhibit, not an editing worksheet`).toEqual([]);
    }

    expect(errors).toEqual([]);
  });

  test("all default templates open with hard presentation-story density", async ({ page }) => {
    // Iterates all templates with fit/geometry rendering; the geometry contract can exceed the default 30s budget.
    test.setTimeout(60000);
    const errors = await openApp(page, "retirement");

    for (const templateId of PRESENTATION_TEMPLATES) {
      await loadTemplate(page, templateId);
      const snapshot = await getState(page);
      const allowedLabels = PRESENTATION_STORY_LABELS[templateId];
      const visibleConnectors = snapshot.connectors.filter((conn) => conn.visible !== false);
      const labels = await page.locator(".connector-label").evaluateAll((nodes) => nodes.map((node) => ({
        id: node.getAttribute("data-connector-id"),
        role: node.getAttribute("data-presentation-role"),
        text: node.textContent.replace(/\s+/g, " ").trim()
      })));
      const advisorNotes = snapshot.items.filter((item) => (
        item.id === "advisorNote" ||
        (item.type === "shape" && item.shape === "callout" && /start with|show|make|use this|frame|worksheet|planning note|gently/i.test(`${item.label || ""} ${item.subtitle || ""}`))
      )).map((item) => item.id);
      const missingRoles = visibleConnectors.filter((conn) => !conn.presentationRole).map((conn) => conn.id);
      const visibleLabelIds = labels.map((entry) => entry.id).sort();
      const expectedLabelIds = [...allowedLabels].sort();

      expect(missingRoles, `${templateId} visible connectors need explicit presentation roles`).toEqual([]);
      expect(labels.length, `${templateId} should show no more than three client-story labels`).toBeLessThanOrEqual(3);
      expect(visibleLabelIds, `${templateId} should only show approved first-read story labels`).toEqual(expectedLabelIds);
      expect(labels.filter((entry) => entry.role !== "primary"), `${templateId} should not label secondary/detail mechanics`).toEqual([]);
      expect(advisorNotes, `${templateId} should not ship worksheet/advisor instruction callouts`).toEqual([]);
      expect(labels.map((entry) => entry.text).join(" "), `${templateId} should not show default fee/admin clutter`)
        .not.toMatch(/advisor fee|annuity fee|tax reserve funding|rebalance after draw|backup|plan contribution/i);
    }

    expect(errors).toEqual([]);
  });

  test("all visible household and tax marker objects are connected to the default story or omitted", async ({ page }) => {
    // Iterates all templates with fit/geometry rendering; the geometry contract can exceed the default 30s budget.
    test.setTimeout(60000);
    const errors = await openApp(page, "retirement");

    for (const templateId of PRESENTATION_TEMPLATES) {
      await loadTemplate(page, templateId);
      const snapshot = await getState(page);
      if (templateId === "blankHousehold") continue;
      const connectorNodeIds = new Set(snapshot.connectors
        .filter((conn) => conn.visible !== false)
        .flatMap((conn) => [conn.source?.itemId, conn.target?.itemId])
        .filter(Boolean));
      const floating = snapshot.items
        .filter((item) => (
          item.visual === "household" ||
          item.visual === "taxTag" ||
          item.productRole === "taxReserve" ||
          item.productRole === "fee"
        ))
        .filter((item) => !connectorNodeIds.has(item.id))
        .map((item) => item.id);

      expect(floating, `${templateId} should not display disconnected household/tax/fee trivia`).toEqual([]);
    }

    expect(errors).toEqual([]);
  });

  test("visible bucket sleeve totals match their displayed container value", async ({ page }) => {
    // Iterates all templates with fit/geometry rendering; the geometry contract can exceed the default 30s budget.
    test.setTimeout(60000);
    const errors = await openApp(page, "retirement");

    for (const templateId of PRESENTATION_TEMPLATES) {
      await loadTemplate(page, templateId);
      const mismatches = await page.evaluate(() => {
        const snapshot = window.__AFV_TEST__.getState();
        return snapshot.items.flatMap((item) => {
          const financeId = item.financeId || item.id;
          const data = snapshot.financeData[financeId];
          const sleeves = data?.subBuckets || [];
          if (!sleeves.length || item.visual === "trust" || data?.productRole === "trustEstate") return [];
          const sum = sleeves.reduce((total, bucket) => total + (Number(bucket.value) || 0), 0);
          const value = Number(data.value) || 0;
          return Math.abs(sum - value) > 1000
            ? [`${item.id}: value ${value}, sleeves ${sum}`]
            : [];
        });
      });

      expect(mismatches, `${templateId} bucket/container sleeve math should be trustworthy`).toEqual([]);
    }

    expect(errors).toEqual([]);
  });

  test("reference exhibits default to presentation density instead of worksheet density", async ({ page }) => {
    const errors = await openApp(page, "retirement");

    for (const templateId of ["retirement", "estate"]) {
      await loadTemplate(page, templateId);
      const snapshot = await getState(page);
      const visibleConnectors = snapshot.connectors.filter((conn) => conn.visible !== false);
      const visibleLabels = await page.locator(".connector-label").evaluateAll((labels) => labels.map((label) => ({
        id: label.getAttribute("data-connector-id"),
        text: label.textContent.replace(/\s+/g, " ").trim()
      })));

      expect(visibleConnectors.every((conn) => conn.presentationRole), `${templateId} connectors need explicit presentation roles`).toBe(true);
      expect(visibleLabels.length, `${templateId} should open with only the client-story labels visible`).toBeLessThanOrEqual(3);
      expect(visibleLabels.map((entry) => entry.text).join(" "), `${templateId} should not show technical/admin labels by default`)
        .not.toMatch(/tax reserve funding|annuity premium|charitable giving|advisor fee|annuity fee/i);
    }

    expect(errors).toEqual([]);
  });

  test("reference connector labels keep clear of product cards and sleeve rows", async ({ page }) => {
    const errors = await openApp(page, "retirement");

    for (const templateId of ["retirement", "estate"]) {
      await loadTemplate(page, templateId);
      const overlaps = await page.evaluate(() => {
        const productRects = [...document.querySelectorAll(".canvas-item .item-surface, .canvas-item .sub-bucket-card")]
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              id: node.closest(".canvas-item")?.getAttribute("data-item-id") || node.getAttribute("data-sub-bucket-id") || node.textContent.trim(),
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom
            };
          });
        return [...document.querySelectorAll(".connector-label")].flatMap((label) => {
          const labelRect = label.getBoundingClientRect();
          return productRects.flatMap((product) => {
            const overlaps =
              labelRect.left < product.right + 8 &&
              labelRect.right > product.left - 8 &&
              labelRect.top < product.bottom + 8 &&
              labelRect.bottom > product.top - 8;
            return overlaps
              ? [`${label.getAttribute("data-connector-id")} overlaps ${product.id}`]
              : [];
          });
        });
      });

      expect(overlaps, `${templateId} connector labels should not sit on cards or sleeves`).toEqual([]);
    }

    expect(errors).toEqual([]);
  });

  test("estate outcome flows leave the trust from visibly separated ports", async ({ page }) => {
    const errors = await openApp(page, "estate");
    const snapshot = await getState(page);
    const outcomeOffsets = snapshot.connectors
      .filter((conn) => conn.visible !== false && conn.source?.itemId === "revocableTrust" && ["lifestyleSupport", "beneficiaryFlow", "charitableGiving"].includes(conn.id))
      .map((conn) => ({ id: conn.id, offsetY: conn.source.offsetY }))
      .sort((a, b) => a.offsetY - b.offsetY);

    expect(outcomeOffsets.length, "estate should expose the three client outcome branches").toBe(3);
    for (let index = 1; index < outcomeOffsets.length; index += 1) {
      expect(
        outcomeOffsets[index].offsetY - outcomeOffsets[index - 1].offsetY,
        JSON.stringify(outcomeOffsets)
      ).toBeGreaterThanOrEqual(96);
    }

    expect(errors).toEqual([]);
  });

  test("optional fee tags fit their text and avoid meaningless progress tracks", async ({ page }) => {
    const errors = await openApp(page, "retirement");
    await page.evaluate(() => {
      window.__AFV_TEST__.loadDiagram({
        items: [
          {
            id: "feeTag",
            type: "finance",
            visual: "amountTag",
            label: "Advisory Planning Fee Reserve",
            subtitle: "Annual advisory fee",
            note: "0.65%",
            x: 800,
            y: 500,
            w: 184,
            h: 82,
            zIndex: 10,
            financeId: "feeTag",
            productRole: "fee",
            surface: "tag",
            style: {}
          }
        ],
        financeData: {
          feeTag: {
            category: "cash",
            value: 0,
            capacity: 1,
            baseValue: 0,
            productRole: "fee",
            surface: "tag"
          }
        },
        groups: [],
        connectors: [],
        scenario: {}
      });
      window.__AFV_TEST__.fit();
    });
    await settle(page);

    const tag = page.locator(".canvas-item[data-item-id='feeTag']");
    await expect(tag).toHaveAttribute("data-product-role", "fee");
    await expect(tag.locator(".fill-track"), "fee tags should not show a zero-value progress bar").toHaveCount(0);

    const overflow = await tag.evaluate((node) => [...node.querySelectorAll(".finance-name, .finance-type, .finance-value")].map((el) => ({
      text: el.textContent.trim(),
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth
    })).filter((entry) => entry.scrollWidth > entry.clientWidth + 1));
    expect(overflow).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("default finance surfaces do not leak implementation metadata", async ({ page }) => {
    const errors = await openApp(page, "retirement");

    for (const templateId of DEFAULT_FINANCE_TEMPLATES) {
      await loadTemplate(page, templateId);
      const texts = await financeSurfaceTexts(page);
      expect(texts.length, templateId).toBeGreaterThan(0);
      texts.forEach((text, index) => {
        expectNoMetadataLeaks(text, `${templateId}: finance surface ${index + 1}`);
      });
    }

    expect(errors).toEqual([]);
  });

  test("annuity and policy surfaces use contract-facing language instead of generic account rows", async ({ page }) => {
    const errors = await openApp(page, "annuity");

    const annuity = page.locator(".canvas-item[data-item-id='annuityPolicy']");
    await expect(annuity.locator(".annuity-contract-readout")).toBeVisible();
    await expect(annuity.locator(".annuity-contract-readout")).toContainText("Payout");
    await expect(annuity.locator(".annuity-contract-readout")).toContainText("Funding");
    await expect(annuity.locator(".finance-value"), "annuity policy should not render a generic account value row").toHaveCount(0);
    expectNoMetadataLeaks(await surfaceText(annuity), "annuity policy surface");

    await loadTemplate(page, "estate");
    const policy = page.locator(".canvas-item[data-item-id='lifePolicy']");
    await expect(policy).toHaveAttribute("data-product-role", "annuityPolicy");
    const policyText = await surfaceText(policy);
    const contractLanguageHits = ["Carrier", "Issue age", "Benefit", "Payout", "Funding"]
      .filter((label) => new RegExp(`\\b${label}\\b`, "i").test(policyText));
    expect(contractLanguageHits.length, `life policy contract language in: ${policyText}`).toBeGreaterThanOrEqual(2);
    await expect(policy.locator(".finance-value"), "life policy should show contract details instead of a generic account value row").toHaveCount(0);
    expectNoMetadataLeaks(policyText, "life policy surface");

    expect(errors).toEqual([]);
  });

  test("future flow remains visible but excluded from current cashflow", async ({ page }) => {
    const errors = await openApp(page, "socialSecurityBridge");
    const snapshot = await getState(page);
    const future = connector(snapshot, "futureIncome");

    expect(future).toMatchObject({
      cadence: "monthly",
      timing: "future",
      targetEffect: "none",
      domainRole: "deferredSocialSecurity"
    });
    await expect(page.locator(".connector-label[data-connector-id='futureIncome'] .amount")).toHaveText("$3,500/mo");

    const currentMonthly = snapshot.connectors
      .filter((conn) => conn.timing !== "future" && currentCashflowEffect(conn) === "cashflowCoverage")
      .reduce((sum, conn) => sum + connectorMonthlyAmount(conn), 0);

    expect(connectorMonthlyAmount(future)).toBe(3500);
    expect(currentMonthly).toBe(5500);
    await expect(page.locator(".paycheck-surface [data-cashflow-value='mapped']").first())
      .toHaveText(dollars(currentMonthly));

    expect(errors).toEqual([]);
  });
});
