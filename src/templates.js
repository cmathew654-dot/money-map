import { state, dom, clone, endpoint, defaultScenario } from "./state.js";

// === TEMPLATES / THEMES ===
export const themes = {
  stewardship: {
    name: "Stewardship",
    shortName: "Stewardship",
    eyebrow: "Stewardship Review · Aster Ridge Wealth",
    chip: ["#fffdf8", "#a88245", "#176e8a", "#0f9f9a"],
    vars: {
      "page-bg": "radial-gradient(ellipse at 25% 15%, #fbf6e8 0%, #f3ebd5 65%, #ece2c1 100%)",
      "grid-line": "rgba(58, 53, 48, 0.012)",
      "panel-bg": "rgba(255, 253, 240, 0.92)",
      "panel-border": "rgba(168, 137, 63, 0.28)",
      "item-bg": "rgba(255, 253, 240, 0.5)",
      "item-bg-2": "rgba(241, 231, 212, 0.92)",
      "item-border": "#d8cba6",
      "text": "#3a3530",
      "text-soft": "#5a5048",
      "metal": "#a8893f",
      "metal-soft": "#c4a85f",
      "accent": "#a8893f",
      "teal": "#3a5240",
      "accent-2": "#8c3829",
      "presentation-bg": "linear-gradient(160deg, #2a2520 0%, #3a3530 52%, #1a1612 100%)",
      "paper": "#fbf6e8",
      "paper-2": "#f3ebd5",
      "brass-light": "#d4a84e",
      "brass-deep": "#8a6f3a",
      "rule": "#d8cba6",
      "gap": "#8c3829",
      "surplus": "#3a5240",
      "tradeoff": "#8a6f3a"
    },
    flowColors: {
      rollover: "#3a5240",
      transfer: "#3a5240",
      income: "#176e8a",
      annuity: "#176e8a",
      roth: "#4f4942",
      tax: "#8c3829",
      rmd: "#176e8a",
      qcd: "#8c3829",
      fee: "#8c3829",
      rebalance: "#3a5240",
      beneficiary: "#8c3829"
    }
  },
  horizon: {
    name: "Horizon",
    shortName: "Horizon",
    eyebrow: "NextGen Path · Aster Ridge Wealth",
    chip: ["#171915", "#d7bd82", "#58c4bd", "#84e3d7"],
    vars: {
      "page-bg": "radial-gradient(ellipse at 80% 0%, rgba(168, 137, 63, 0.12) 0%, transparent 55%), linear-gradient(180deg, #1a1612 0%, #110d0a 100%)",
      "grid-line": "rgba(244, 238, 220, 0.030)",
      "panel-bg": "rgba(26, 22, 18, 0.92)",
      "panel-border": "rgba(168, 137, 63, 0.28)",
      "item-bg": "rgba(168, 137, 63, 0.04)",
      "item-bg-2": "rgba(54, 52, 44, 0.94)",
      "item-border": "#2c2620",
      "text": "#f4eedc",
      "text-soft": "#b8ad9b",
      "metal": "#d4a84e",
      "metal-soft": "#a8893f",
      "accent": "#d4a84e",
      "teal": "#6a8472",
      "accent-2": "#d96650",
      "presentation-bg": "linear-gradient(160deg, #060403 0%, #1a1612 58%, #110d0a 100%)",
      "paper": "#1a1612",
      "paper-2": "#110d0a",
      "brass-light": "#d4a84e",
      "brass-deep": "#8a6f3a",
      "rule": "#2c2620",
      "gap": "#d96650",
      "surplus": "#6a8472",
      "tradeoff": "#d4a84e"
    },
    flowColors: {
      rollover: "#6a8472",
      transfer: "#6a8472",
      income: "#84e3d7",
      annuity: "#84e3d7",
      roth: "#b8ad9b",
      tax: "#d96650",
      rmd: "#84e3d7",
      qcd: "#d96650",
      fee: "#d96650",
      rebalance: "#6a8472",
      beneficiary: "#d96650"
    }
  },
  camino: {
    name: "Camino",
    shortName: "Camino",
    eyebrow: "Annual Review · Aster Ridge Wealth",
    chip: ["#f6f8fb", "#1f4d6b", "#2f7d91", "#9d7d42"],
    vars: {
      "page-bg": "linear-gradient(180deg, #fafbfc 0%, #f0f3f7 100%)",
      "grid-line": "rgba(44, 65, 99, 0.04)",
      "panel-bg": "rgba(250, 251, 252, 0.92)",
      "panel-border": "rgba(44, 65, 99, 0.20)",
      "item-bg": "rgba(255, 255, 255, 0.6)",
      "item-bg-2": "rgba(229, 238, 245, 0.94)",
      "item-border": "#d8dde3",
      "text": "#0e0e0c",
      "text-soft": "#596371",
      "metal": "#a8893f",
      "metal-soft": "#c4a85f",
      "accent": "#2c4163",
      "teal": "#3a5240",
      "accent-2": "#8c3829",
      "presentation-bg": "linear-gradient(160deg, #1a2840 0%, #2c4163 58%, #0f1e2a 100%)",
      "paper": "#fafbfc",
      "paper-2": "#f0f3f7",
      "brass-light": "#d4a84e",
      "brass-deep": "#8a6f3a",
      "rule": "#d8dde3",
      "gap": "#8c3829",
      "surplus": "#3a5240",
      "tradeoff": "#8a6f3a"
    },
    flowColors: {
      rollover: "#3a5240",
      transfer: "#3a5240",
      income: "#2f7d91",
      annuity: "#2f7d91",
      roth: "#596371",
      tax: "#8c3829",
      rmd: "#2f7d91",
      qcd: "#8c3829",
      fee: "#8c3829",
      rebalance: "#3a5240",
      beneficiary: "#8c3829"
    }
  },
  retirementPaycheck() {
    const finance = [
      financeItem("guaranteedIncome", "policy", "annuity", "Social Security + Pension", "Guaranteed income", "Base paycheck sources", 390, 380, 285, 132, 0, 240000),
      financeItem("portfolio", "card", "brokerage", "Managed Portfolio", "Flexible income", "Discretionary draw source", 390, 620, 255, 132, 920000, 1400000),
      financeItem("reserve", "bucket", "cash", "Cash Reserve", "Liquidity sleeve", "Near-term buffer", 780, 760, 255, 138, 180000, 300000),
      financeItem("annuity", "policy", "annuity", "Income Annuity", "Contract income", "Optional floor", 780, 460, 270, 132, 0, 420000),
      financeItem("paycheck", "paycheck", "household", "Monthly Need", "Client paycheck", "Mapped income coverage", 1180, 500, 270, 132, 0, 160000)
    ];
    const other = [];
    const conns = [
      connector("guaranteedFlow", "Guaranteed income", "income", 36000, { itemId: "guaranteedIncome", port: "right.payout", offsetY: -42 }, { itemId: "paycheck", port: "left.income", offsetY: -86 }, { scenarioKey: "guaranteedIncome", affectsSource: false, routeStyle: "elbow", mid: { x: 770, y: 235 }, manualMid: true, labelMode: "start", max: 120000 }),
      connector("annuityIncome", "Annuity income", "income", 21600, { itemId: "annuity", port: "right.payout", offsetY: 52 }, { itemId: "paycheck", port: "left.income", offsetY: 52 }, { scenarioKey: "annuityIncome", affectsSource: false, routeStyle: "straight", colorMode: "metal", labelMode: "manual", labelPoint: { x: 1330, y: 640 }, max: 100000 }),
      connector("portfolioDraw", "Portfolio draw", "income", 48000, { itemId: "portfolio", port: "right.out" }, { itemId: "paycheck", port: "bottom.gap", offsetX: -84 }, { scenarioKey: "monthlyDistribution", colorMode: "accent", routeStyle: "smartArc", max: 180000 }),
      connector("reserveBackstop", "Reserve backstop", "transfer", 50000, { itemId: "reserve", port: "right.out" }, { itemId: "paycheck", port: "left.income" }, { visible: false, sourceEffect: "none", targetEffect: "none", strokeStyle: "dotted", colorMode: "teal", widthMode: "subtle", labelMode: "hidden", presentationRole: "detail", max: 120000 })
    ];
    return assembleTemplate(
      { id: "retirementPaycheck", name: "Retirement Paycheck Stack", shortName: "Paycheck", canvasTitle: "Retirement Paycheck Stack", layout: storyLayout("income") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 7800, monthlyDistribution: 4000, guaranteedIncome: 3000, annuityMonthlyIncome: 1800, annuityOn: true }
    );
  },
  socialSecurityBridge() {
    const finance = [
      financeItem("taxable", "card", "brokerage", "Taxable Brokerage", "Bridge source", "Delay claiming support", 380, 450, 255, 132, 540000, 900000),
      financeItem("cashBridge", "bucket", "cash", "Bridge Reserve", "Cash ladder", "Ages 62-70 spending", 760, 450, 255, 138, 240000, 360000),
      financeItem("ira", "card", "ira", "Traditional IRA", "Backup source", "Keep optional", 380, 680, 255, 132, 860000, 1200000),
      financeItem("futureSs", "policy", "annuity", "Future Social Security", "Age 70 income", "Delayed benefit", 780, 250, 270, 132, 0, 180000),
      financeItem("paycheck", "paycheck", "household", "Monthly Need", "Bridge paycheck", "Gap before claiming", 1180, 500, 270, 132, 0, 160000)
    ];
    const other = [];
    const conns = [
      connector("fundBridge", "Fund bridge", "transfer", 180000, "taxable", "cashBridge", { colorMode: "teal", max: 300000 }),
      connector("bridgeDraw", "Bridge draw", "income", 66000, "cashBridge", "paycheck", { scenarioKey: "monthlyDistribution", max: 180000 }),
      connector("futureIncome", "Future benefit", "income", 42000, "futureSs", "paycheck", { scenarioKey: "guaranteedIncome", domainRole: "deferredSocialSecurity", timing: "future", targetEffect: "none", strokeStyle: "dotted", affectsSource: false, affectsTarget: false, colorMode: "metal", max: 120000 }),
      connector("iraBackup", "IRA backup", "transfer", 30000, "ira", "paycheck", { strokeStyle: "proposalFade", colorMode: "red", widthMode: "subtle", labelMode: "hidden", presentationRole: "secondary", max: 120000 })
    ];
    return assembleTemplate(
      { id: "socialSecurityBridge", name: "Bridge to Social Security", shortName: "SS bridge", canvasTitle: "Bridge to Social Security", layout: storyLayout("income") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 7200, monthlyDistribution: 5500, guaranteedIncome: 3500, annuityOn: false }
    );
  },
  bucketStrategy() {
    const finance = [
      financeItem("cashBucket", "bucket", "cash", "Cash Bucket", "0-12 months", "Monthly paycheck source", 410, 420, 255, 138, 110000, 220000),
      financeItem("bondBucket", "bucket", "cash", "Stability Bucket", "1-4 years", "Refill reserve", 410, 650, 255, 138, 260000, 420000),
      financeItem("growth", "card", "brokerage", "Growth Portfolio", "Long-term sleeve", "Inflation hedge", 805, 650, 255, 132, 820000, 1200000),
      financeItem("incomeFloor", "policy", "annuity", "Income Floor", "Guaranteed base", "Optional contract income", 805, 420, 270, 132, 0, 400000),
      financeItem("paycheck", "paycheck", "household", "Monthly Need", "Household draw", "Bucket coverage", 1180, 520, 270, 132, 0, 160000)
    ];
    const other = [];
    const conns = [
      connector("cashDraw", "Monthly draw", "income", 54000, { itemId: "cashBucket", port: "right.out", offsetY: 46 }, { itemId: "paycheck", port: "left.income", offsetY: 42 }, { scenarioKey: "monthlyDistribution", routeStyle: "sCurve", mid: { x: 770, y: 650 }, manualMid: true, labelMode: "end", max: 180000 }),
      connector("annuityBase", "Guaranteed base", "income", 18000, { itemId: "incomeFloor", port: "right.payout", offsetY: -42 }, { itemId: "paycheck", port: "left.income", offsetY: -50 }, { scenarioKey: "annuityIncome", affectsSource: false, colorMode: "metal", routeStyle: "straight", labelMode: "end", max: 90000 }),
      connector("bondRefill", "Refill cash", "rebalance", 90000, "bondBucket", "cashBucket", { colorMode: "teal", max: 220000 }),
      connector("growthRefill", "Rebalance sleeve", "rebalance", 140000, "growth", "bondBucket", { strokeStyle: "dotted", widthMode: "subtle", labelMode: "hidden", presentationRole: "secondary", max: 260000 })
    ];
    return assembleTemplate(
      { id: "bucketStrategy", name: "Bucket Strategy Income Plan", shortName: "Buckets", canvasTitle: "Bucket Strategy Income Plan", layout: storyLayout("income") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 6900, monthlyDistribution: 4500, annuityMonthlyIncome: 1500, annuityOn: true }
    );
  },
  rmdTax() {
    const finance = [
      financeItem("ira", "card", "ira", "Traditional IRA", "RMD source", "Tax-deferred account", 395, 450, 255, 132, 980000, 1300000),
      financeItem("taxReserve", "bucket", "cash", "Tax Withholding", "Federal/state set-aside", "Estimated withholding", 800, 650, 250, 138, 0, 180000),
      financeItem("charity", "amountTag", "trust", "QCD / Charity", "Optional branch", "Qualified distribution", 800, 280, 230, 92, 0, 100000),
      financeItem("brokerage", "card", "brokerage", "Taxable Brokerage", "Cash supplement", "Flexible income", 390, 680, 255, 132, 410000, 700000),
      financeItem("paycheck", "paycheck", "household", "Monthly Need", "Client paycheck", "RMD after withholding", 1180, 500, 270, 132, 0, 160000)
    ];
    const other = [];
    const conns = [
      connector("rmdSpend", "Spendable RMD", "rmd", 48000, { itemId: "ira", port: "right.out" }, { itemId: "paycheck", port: "left.income" }, { scenarioKey: "monthlyDistribution", domainRole: "rmdSpendable", cadence: "monthly", targetEffect: "cashflowCoverage", colorMode: "accent", labelMode: "end", max: 180000 }),
      connector("withholding", "Tax withholding", "tax", 30000, { itemId: "ira", port: "bottom.out", offsetX: -74 }, { itemId: "taxReserve", port: "top.in", offsetX: -72 }, { scenarioKey: "taxPayment", domainRole: "rmdWithholding", cadence: "annual", colorMode: "red", max: 140000 }),
      connector("qcd", "QCD", "qcd", 15000, "ira", "charity", { domainRole: "qualifiedCharitableDistribution", cadence: "annual", strokeStyle: "dotted", affectsTarget: false, targetEffect: "none", labelMode: "manual", labelPoint: { x: 930, y: 120 }, presentationRole: "primary", widthMode: "subtle", max: 100000 }),
      connector("supplement", "Brokerage supplement", "income", 18000, "brokerage", "paycheck", { visible: false, domainRole: "optionalBrokerageSupplement", timing: "future", targetEffect: "none", strokeStyle: "proposalFade", labelMode: "hidden", presentationRole: "detail", max: 100000 })
    ];
    return assembleTemplate(
      { id: "rmdTax", name: "RMD + Tax Withholding Flow", shortName: "RMD tax", canvasTitle: "RMD + Tax Withholding Flow", layout: storyLayout("income") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 6500, monthlyDistribution: 4000, rothConversion: 125000, taxReservePct: 24, annuityOn: false }
    );
  },
  withdrawalSequencing() {
    const finance = [
      financeItem("taxable", "card", "brokerage", "Taxable Brokerage", "First draw source", "Step one", 360, 430, 255, 132, 620000, 900000),
      financeItem("ira", "card", "ira", "Traditional IRA", "Deferred source", "Step two", 720, 610, 255, 132, 860000, 1200000),
      financeItem("roth", "card", "rothIra", "Roth IRA", "Tax-free reserve", "Step three", 720, 330, 255, 132, 240000, 650000),
      financeItem("cash", "bucket", "cash", "Cash Reserve", "Smoothing bucket", "Near-term spending", 360, 665, 255, 138, 95000, 220000),
      financeItem("paycheck", "paycheck", "household", "Monthly Need", "Withdrawal plan", "Sequenced coverage", 1160, 500, 270, 132, 0, 160000)
    ];
    const other = [];
    const conns = [
      connector("taxableDraw", "Taxable draw", "income", 54000, "taxable", "paycheck", { scenarioKey: "monthlyDistribution", labelMode: "auto", labelPoint: null, max: 180000 }),
      connector("cashSmoothing", "Cash smoothing", "transfer", 36000, { itemId: "cash", port: "bottom.reserve", offsetX: 62 }, { itemId: "paycheck", port: "bottom.gap", offsetX: -86 }, { colorMode: "teal", routeStyle: "smartArc", labelMode: "auto", labelPoint: null, max: 120000 }),
      connector("iraLater", "Later IRA draw", "rmd", 42000, "ira", "paycheck", { domainRole: "futureIraDraw", timing: "future", targetEffect: "none", strokeStyle: "dotted", labelMode: "start", labelPoint: null, max: 160000 }),
      connector("rothReserve", "Roth reserve", "roth", 24000, "roth", "paycheck", { visible: false, domainRole: "futureRothReserve", timing: "future", targetEffect: "none", strokeStyle: "proposalFade", widthMode: "subtle", labelMode: "hidden", presentationRole: "detail", max: 120000 })
    ];
    return assembleTemplate(
      { id: "withdrawalSequencing", name: "Taxable + IRA Withdrawal Sequencing", shortName: "Sequencing", canvasTitle: "Withdrawal Sequencing Map", layout: storyLayout("income") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 7200, monthlyDistribution: 4500, annuityOn: false }
    );
  },
  cashCleanup() {
    const finance = [
      financeItem("checking", "cashStack", "cash", "Checking + Savings", "Idle cash", "Operating cash", 360, 365, 255, 126, 180000, 300000),
      financeItem("cds", "card", "cash", "CD / Money Market", "Short-term holdings", "Fragmented liquidity", 360, 600, 255, 132, 260000, 420000),
      financeItem("reserve", "bucket", "cash", "Household Reserve", "12-month target", "Spending buffer", 760, 430, 255, 138, 120000, 260000),
      financeItem("investment", "card", "brokerage", "Investable Surplus", "Longer-term assets", "Excess cash", 760, 660, 255, 132, 0, 500000),
      financeItem("paycheck", "paycheck", "household", "Monthly Need", "Cashflow need", "Reserve target", 1160, 500, 270, 132, 0, 160000)
    ];
    const other = [];
    const conns = [
      connector("fundReserve", "Target reserve", "transfer", 120000, "checking", "reserve", { colorMode: "teal", labelMode: "auto", labelPoint: null, max: 260000 }),
      connector("investSurplus", "Invest surplus", "transfer", 180000, "cds", "investment", { colorMode: "accent", labelMode: "auto", labelPoint: null, max: 360000 }),
      connector("reserveDraw", "Monthly draw", "income", 60000, "reserve", "paycheck", { scenarioKey: "monthlyDistribution", max: 180000 }),
      connector("surplusBackup", "Backup source", "rebalance", 50000, "investment", "reserve", { strokeStyle: "dotted", widthMode: "subtle", labelMode: "hidden", presentationRole: "secondary", max: 120000 })
    ];
    return assembleTemplate(
      { id: "cashCleanup", name: "High Cash Household Cleanup", shortName: "Cash cleanup", canvasTitle: "High Cash Household Cleanup", layout: storyLayout("income") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 5000, monthlyDistribution: 5000, annuityOn: false }
    );
  },
  annuityIncomeFloor() {
    const finance = [
      financeItem("portfolio", "card", "brokerage", "Retirement Portfolio", "Premium source", "Funds floor", 390, 520, 255, 132, 980000, 1300000),
      financeItem("annuity", "policy", "annuity", "Income Annuity", "Floor contract", "Guaranteed paycheck", 800, 430, 290, 136, 0, 550000),
      financeItem("discretionary", "bucket", "cash", "Discretionary Bucket", "Flexible spending", "Lifestyle gap", 800, 670, 255, 138, 120000, 260000),
      financeItem("paycheck", "paycheck", "household", "Monthly Need", "Income floor", "Fixed vs flexible", 1180, 520, 270, 132, 0, 160000)
    ];
    const other = [];
    const conns = [
      connector("premium", "Premium", "annuity", 300000, { itemId: "portfolio", port: "right.out" }, { itemId: "annuity", port: "left.funding" }, { scenarioKey: "annuityPremium", colorMode: "metal", strokeStyle: "longDash", max: 600000 }),
      connector("floorIncome", "Income floor", "income", 30000, { itemId: "annuity", port: "right.payout" }, { itemId: "paycheck", port: "left.income" }, { scenarioKey: "annuityIncome", affectsSource: false, colorMode: "metal", max: 120000 }),
      connector("flexDraw", "Flexible draw", "income", 36000, { itemId: "discretionary", port: "right.out" }, { itemId: "paycheck", port: "bottom.gap" }, { scenarioKey: "monthlyDistribution", max: 160000 }),
    ];
    return assembleTemplate(
      { id: "annuityIncomeFloor", name: "Annuity Income Floor", shortName: "Income floor", canvasTitle: "Annuity Income Floor", layout: storyLayout("income") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 6800, monthlyDistribution: 3000, annuityPremium: 300000, annuityMonthlyIncome: 2500, annuityOn: true }
    );
  },
  executiveComp() {
    const finance = [
      financeItem("salaryBonus", "card", "brokerage", "Salary + Bonus", "Annual cashflow", "Current-year income", 360, 360, 255, 132, 420000, 700000),
      financeItem("rsu", "card", "brokerage", "RSU Vesting", "Equity comp", "Concentrated inflow", 360, 610, 255, 132, 300000, 600000),
      financeItem("taxReserve", "bucket", "cash", "Tax Reserve", "Withholding", "Estimated liability", 760, 360, 255, 138, 120000, 260000),
      financeItem("brokerage", "card", "brokerage", "Diversified Brokerage", "Investable surplus", "After-tax proceeds", 760, 650, 255, 132, 0, 800000),
      financeItem("paycheck", "paycheck", "household", "Monthly Need", "Lifestyle cashflow", "Income after taxes", 1160, 500, 270, 132, 0, 180000)
    ];
    const other = [];
    const conns = [
      connector("taxFromBonus", "Tax reserve", "tax", 95000, { itemId: "salaryBonus", port: "right.out", offsetY: -52 }, { itemId: "taxReserve", port: "left.in", offsetY: -44 }, { colorMode: "red", routeStyle: "straight", labelMode: "start", labelPoint: null, max: 220000 }),
      connector("taxFromRsu", "RSU tax", "tax", 75000, "rsu", "taxReserve", { colorMode: "red", strokeStyle: "dotted", widthMode: "subtle", labelMode: "hidden", presentationRole: "secondary", max: 220000 }),
      connector("investRsu", "Diversify", "transfer", 180000, "rsu", "brokerage", { colorMode: "accent", max: 420000 }),
      connector("lifestyle", "Monthly lifestyle", "income", 90000, { itemId: "salaryBonus", port: "right.out", offsetY: 58 }, { itemId: "paycheck", port: "left.income", offsetY: 48 }, { scenarioKey: "monthlyDistribution", affectsSource: false, routeStyle: "sCurve", mid: { x: 780, y: 715 }, manualMid: true, labelMode: "end", labelPoint: null, max: 220000 })
    ];
    return assembleTemplate(
      { id: "executiveComp", name: "Executive Comp Cashflow", shortName: "Exec comp", canvasTitle: "Executive Comp Cashflow", layout: storyLayout("income") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 12500, monthlyDistribution: 7500, annuityOn: false }
    );
  },
  businessOwner() {
    const finance = [
      financeItem("operatingCash", "cashStack", "cash", "Operating Cash", "Business liquidity", "Do not overdraw", 370, 365, 260, 126, 520000, 900000),
      financeItem("taxSetAside", "bucket", "cash", "Tax Set-Aside", "Quarterly payments", "Estimated taxes", 760, 340, 255, 138, 180000, 360000),
      financeItem("retirementPlan", "card", "401k", "Solo 401(k) / SEP", "Retirement plan", "Owner contribution", 760, 610, 260, 132, 260000, 700000),
      financeItem("brokerage", "card", "brokerage", "After-Tax Portfolio", "Surplus capital", "Personal balance sheet", 370, 650, 255, 132, 420000, 800000),
      financeItem("paycheck", "paycheck", "household", "Monthly Need", "Owner draw", "Household cashflow", 1165, 500, 270, 132, 0, 200000)
    ];
    const other = [];
    const conns = [
      connector("quarterlyTax", "Tax reserve", "tax", 160000, { itemId: "operatingCash", port: "right.out", offsetY: -46 }, { itemId: "taxSetAside", port: "left.in", offsetY: -42 }, { colorMode: "red", routeStyle: "straight", labelMode: "start", labelPoint: null, max: 360000 }),
      connector("planContribution", "Plan contribution", "transfer", 66000, "operatingCash", "retirementPlan", { colorMode: "metal", widthMode: "subtle", labelMode: "hidden", presentationRole: "secondary", max: 120000 }),
      connector("ownerDraw", "Owner draw", "income", 120000, { itemId: "operatingCash", port: "right.out", offsetY: 54 }, { itemId: "paycheck", port: "left.income", offsetY: 44 }, { scenarioKey: "monthlyDistribution", affectsSource: false, routeStyle: "sCurve", mid: { x: 790, y: 720 }, manualMid: true, labelMode: "end", max: 240000 }),
      connector("surplusInvest", "Invest surplus", "transfer", 140000, { itemId: "operatingCash", port: "bottom.out", offsetX: -82 }, { itemId: "brokerage", port: "top.in", offsetX: -68 }, { strokeStyle: "dotted", colorMode: "accent", routeStyle: "smartArc", labelMode: "below", max: 320000 })
    ];
    return assembleTemplate(
      { id: "businessOwner", name: "Business Owner Liquidity Map", shortName: "Owner cash", canvasTitle: "Business Owner Liquidity Map", layout: storyLayout("income") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 14500, monthlyDistribution: 10000, annuityOn: false }
    );
  },
  survivorIncome() {
    const finance = [
      financeItem("survivorBenefit", "policy", "annuity", "Survivor Benefit", "Guaranteed income", "Social Security / pension", 330, 430, 285, 132, 0, 180000),
      financeItem("portfolio", "card", "brokerage", "Investment Portfolio", "Gap filler", "Flexible draw", 330, 675, 255, 132, 720000, 1000000),
      financeItem("cashReserve", "bucket", "cash", "Survivor Reserve", "12-18 months", "Transition cash", 820, 315, 255, 138, 150000, 280000),
      financeItem("lifeInsurance", "policy", "insurance", "Insurance Proceeds", "Liquidity event", "Reserve funding", 820, 835, 270, 132, 300000, 600000),
      financeItem("paycheck", "paycheck", "household", "Monthly Need", "Survivor paycheck", "Income reset", 1320, 500, 270, 132, 0, 160000)
    ];
    const other = [];
    const conns = [
      connector("guaranteed", "Guaranteed income", "income", 42000, { itemId: "survivorBenefit", port: "right.payout" }, { itemId: "paycheck", port: "left.income" }, { scenarioKey: "guaranteedIncome", affectsSource: false, colorMode: "metal", routeStyle: "straight", widthMode: "medium", labelMode: "start", max: 120000 }),
      connector("transitionCash", "Transition cash", "transfer", 36000, { itemId: "cashReserve", port: "right.out" }, { itemId: "paycheck", port: "left.income" }, { strokeStyle: "dotted", colorMode: "teal", routeStyle: "smartArc", max: 120000 }),
      connector("gapDraw", "Gap filler", "income", 36000, { itemId: "portfolio", port: "right.out" }, { itemId: "paycheck", port: "left.income", offsetY: 42 }, { scenarioKey: "monthlyDistribution", routeStyle: "sCurve", mid: { x: 820, y: 780 }, manualMid: true, labelMode: "below", max: 160000 }),
      connector("reserveFund", "Fund reserve", "transfer", 150000, { itemId: "lifeInsurance", port: "right.payout" }, { itemId: "cashReserve", port: "left.in" }, { visible: false, sourceEffect: "none", targetEffect: "none", colorMode: "teal", routeStyle: "straight", widthMode: "subtle", labelMode: "hidden", presentationRole: "detail", max: 300000 })
    ];
    return assembleTemplate(
      { id: "survivorIncome", name: "Widow/Widower Income Reset", shortName: "Income reset", canvasTitle: "Survivor Income Reset", layout: storyLayout("income") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 7200, monthlyDistribution: 3000, guaranteedIncome: 3500, annuityOn: false }
    );
  }
};

export const cashflowTemplateFactories = {
  retirementPaycheck: themes.retirementPaycheck,
  socialSecurityBridge: themes.socialSecurityBridge,
  bucketStrategy: themes.bucketStrategy,
  rmdTax: themes.rmdTax,
  withdrawalSequencing: themes.withdrawalSequencing,
  cashCleanup: themes.cashCleanup,
  annuityIncomeFloor: themes.annuityIncomeFloor,
  executiveComp: themes.executiveComp,
  businessOwner: themes.businessOwner,
  survivorIncome: themes.survivorIncome
};

export const shapePalette = [
  { id: "risk-triangle", type: "shape", shape: "triangle", shapeIntent: "riskGap", label: "Risk wedge", subtitle: "Gap / friction", w: 150, h: 132, icon: "triangle" },
  { id: "protection-shield", type: "shape", shape: "shield", shapeIntent: "protection", label: "Protection shield", subtitle: "Insurance / guardrail", w: 150, h: 150, icon: "shield" },
  { id: "guarantee-seal", type: "shape", shape: "seal", shapeIntent: "guarantee", label: "Guarantee seal", subtitle: "Carrier-backed", w: 136, h: 136, icon: "seal" },
  { id: "milestone-flag", type: "shape", shape: "flag", shapeIntent: "milestone", label: "Milestone flag", subtitle: "Age / event", w: 160, h: 118, icon: "flag" },
  { id: "ledger-strip", type: "shape", shape: "ledgerStrip", shapeIntent: "ledgerAssumption", label: "Ledger strip", subtitle: "Thin assumption", w: 260, h: 68, icon: "ledgerStrip" },
  { id: "reserve-gauge", type: "shape", shape: "reserveGauge", shapeIntent: "reserveCapacity", label: "Reserve gauge", subtitle: "Buffer / capacity", w: 188, h: 104, icon: "reserveGauge" },
  { id: "trust-gate", type: "shape", shape: "gate", shapeIntent: "legalThreshold", label: "Trust gate", subtitle: "Legal threshold", w: 190, h: 128, icon: "gate" },
  { id: "split-fork", type: "shape", shape: "fork", shapeIntent: "choiceSplit", label: "Split fork", subtitle: "Decision branch", w: 168, h: 128, icon: "fork" },
  { id: "rectangle", type: "shape", shape: "rectangle", label: "Rectangle", subtitle: "Clean block", w: 190, h: 96, icon: "rectangle" },
  { id: "rounded", type: "shape", shape: "rounded", label: "Rounded card", subtitle: "Polished surface", w: 220, h: 112, icon: "rounded" },
  { id: "pill", type: "shape", shape: "pill", label: "Pill card", subtitle: "Soft status card", w: 210, h: 78, icon: "pill" },
  { id: "ellipse", type: "shape", shape: "ellipse", label: "Circle / ellipse", subtitle: "Marker or endpoint", w: 150, h: 100, icon: "ellipse" },
  { id: "diamond", type: "shape", shape: "diamond", label: "Diamond", subtitle: "Decision point", w: 130, h: 130, icon: "diamond" },
  { id: "parallelogram", type: "shape", shape: "parallelogram", label: "Parallelogram", subtitle: "Input/output", w: 210, h: 96, icon: "parallelogram" },
  { id: "document", type: "shape", shape: "document", label: "Document", subtitle: "Policy or statement", w: 190, h: 118, icon: "document" },
  { id: "bucket", type: "shape", shape: "bucket", label: "Cylinder / bucket", subtitle: "Capacity visual", w: 150, h: 132, icon: "bucket" },
  { id: "cylinder", type: "shape", shape: "cylinder", label: "Tall cylinder", subtitle: "Reserve visual", w: 130, h: 180, icon: "bucket" },
  { id: "cashStack", type: "shape", shape: "cashStack", label: "Cash stack", subtitle: "Liquid assets", w: 190, h: 96, icon: "cashStack" },
  { id: "policy", type: "shape", shape: "policy", label: "Policy tile", subtitle: "Contract style", w: 230, h: 112, icon: "policy" },
  { id: "household", type: "shape", shape: "household", label: "Household marker", subtitle: "Client / family", w: 180, h: 106, icon: "household" },
  { id: "callout", type: "shape", shape: "callout", label: "Callout", subtitle: "Advisor note", w: 250, h: 94, icon: "callout" },
  { id: "note", type: "shape", shape: "note", label: "Note", subtitle: "Sticky context", w: 210, h: 126, icon: "note" },
  { id: "milestone", type: "shape", shape: "milestone", label: "Milestone", subtitle: "Age or event", w: 150, h: 100, icon: "milestone" },
  { id: "table", type: "shape", shape: "table", label: "Table / grid", subtitle: "Small matrix", w: 240, h: 136, icon: "table" },
  { id: "swimlane", type: "shape", shape: "swimlane", label: "Swimlane", subtitle: "Optional lane", w: 420, h: 170, icon: "swimlane" },
  { id: "taxTag", type: "shape", shape: "taxTag", label: "Tax / fee tag", subtitle: "Amount marker", w: 150, h: 58, icon: "amountTag" },
  { id: "bracket", type: "shape", shape: "bracket", label: "Bracket / group", subtitle: "Soft grouping", w: 320, h: 150, icon: "group" },
  { id: "trust", type: "shape", shape: "trust", label: "Trust container", subtitle: "Estate frame", w: 320, h: 170, icon: "trust" }
];

export const textPalette = [
  { id: "title", type: "text", textStyle: "title", label: "Text title", subtitle: "Editable headline", w: 300, h: 62, icon: "text" },
  { id: "caption", type: "text", textStyle: "caption", label: "Caption", subtitle: "Small context", w: 260, h: 58, icon: "text" },
  { id: "amountTag", type: "text", textStyle: "amountTag", label: "$125K", subtitle: "Amount tag", w: 130, h: 44, icon: "amountTag" },
  { id: "callout-text", type: "text", textStyle: "callout", label: "Advisor note", subtitle: "Callout text", w: 260, h: 84, icon: "callout" }
];

const PRODUCT_METADATA_CONTRACT = "heritageAdvisorCanvas";

function productMeta(planningUse, extra = {}) {
  return { contract: PRODUCT_METADATA_CONTRACT, displayOnly: true, planningUse, ...extra };
}

function productText(fields = {}) {
  return [fields.id, fields.visual, fields.category, fields.label]
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())
    .join(" ");
}

function compactProductText(fields = {}) {
  return productText(fields).replace(/[^a-z0-9]/g, "");
}

function nonnegativeAmount(value, fallback = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return fallback;
  return amount;
}

function amountShare(amount, ratio) {
  return Math.round((nonnegativeAmount(amount) * ratio) / 1000) * 1000;
}

function coverageMonthsFor(fields = {}) {
  const text = [fields.label, fields.subtitle, fields.note].filter(Boolean).join(" ").toLowerCase();
  if (/ages?\s*62\s*-\s*70/.test(text)) return 96;
  if (/1\s*-\s*4 years|four years|4 years/.test(text)) return 48;
  if (/two years|2 years|24 months/.test(text)) return 24;
  if (/12\s*-\s*18 months|18 months/.test(text)) return 18;
  if (/0\s*-\s*12 months|12-month|12 months|one year/.test(text)) return 12;
  if (/quarterly/.test(text)) return 3;
  return 6;
}

function inferProductRole(fields = {}) {
  const text = productText(fields);
  const compact = compactProductText(fields);
  const visual = String(fields.visual || "").toLowerCase();
  const category = String(fields.category || "").toLowerCase();

  if (
    compact.includes("taxreserve")
    || compact.includes("taxwithholding")
    || compact.includes("taxsetaside")
    || compact.includes("taxthisyear")
    || /withholding|set-aside|set aside|quarterly payments|estimated liability|conversion cost/.test(text)
  ) return "taxReserve";
  if (/\bfee\b|fees/.test(text)) return "fee";
  if (/\bqcd\b|charity|charitable/.test(text)) return "charity";
  if (/beneficiar/.test(text)) return "beneficiary";
  if (visual === "paycheck" || /monthly need|client paycheck|paycheck|cashflow need|owner draw|household draw|lifestyle cashflow/.test(text)) return "monthlyNeed";
  if (visual === "bucket" || visual === "cashstack" || category === "cash" || /cash reserve|liquidity|cash bucket|money market|\bcd\b/.test(text)) return "cashReserve";
  if (visual === "trust" || category === "trust" || category === "estate" || /\btrust\b/.test(text)) return "trustEstate";
  if (visual === "household" || category === "household") return "household";
  if (visual === "policy" || category === "annuity" || category === "insurance" || /annuity|policy|pension|social security/.test(text)) return "annuityPolicy";
  if (category === "401k" || category === "ira" || category === "rothira" || /401\(k\)|401k|\bira\b|roth|retirement/.test(text)) return "retirementAccount";
  return "investmentAccount";
}

function normalizeSubBuckets(subBuckets) {
  if (!Array.isArray(subBuckets)) return null;
  const normalized = subBuckets
    .filter((bucket) => bucket && typeof bucket === "object")
    .map((bucket, index) => ({
      id: String(bucket.id || `bucket-${index + 1}`),
      label: String(bucket.label || "Sub-bucket"),
      role: String(bucket.role || "display"),
      value: nonnegativeAmount(bucket.value),
      capacity: nonnegativeAmount(bucket.capacity),
      note: String(bucket.note || ""),
      instrument: String(bucket.instrument || ""),
      coverageMonths: nonnegativeAmount(bucket.coverageMonths)
    }));
  return normalized.length ? normalized : null;
}

function defaultSubBucketsForProduct(fields, productRole, options = {}) {
  const value = nonnegativeAmount(fields.value);
  const capacity = nonnegativeAmount(fields.capacity, Math.max(1, value));
  const coverageMonths = coverageMonthsFor(fields);

  if (productRole === "investmentAccount") {
    if (!options.includeAccountSubBuckets) return null;
    return [
      { id: "core", label: "Core portfolio", role: "investedAssets", value: amountShare(value, 0.72), capacity: amountShare(capacity, 0.72), note: "Display-only allocation sleeve", instrument: "Managed portfolio", coverageMonths: 0 },
      { id: "flexible", label: "Flexible sleeve", role: "liquiditySleeve", value: amountShare(value, 0.28), capacity: amountShare(capacity, 0.28), note: "Available for planned flows", instrument: "Taxable account", coverageMonths: 0 }
    ];
  }

  if (productRole === "retirementAccount") {
    if (!options.includeAccountSubBuckets) return null;
    return [
      { id: "tax-deferred", label: "Tax-deferred balance", role: "taxDeferred", value: value, capacity: capacity, note: "Advisor-entered approximate value", instrument: fields.category || "Retirement account", coverageMonths: 0 }
    ];
  }

  if (productRole === "cashReserve") {
    if (!options.includeSubBuckets && !options.includeReserveSubBuckets) return null;
    return [
      { id: "operating", label: "Operating cash", role: "operatingReserve", value: amountShare(value, 0.35), capacity: amountShare(capacity, 0.35), note: "Immediate liquidity", instrument: fields.visual === "cashStack" ? "Checking/savings" : "Cash or money market", coverageMonths: Math.min(coverageMonths, 3) },
      { id: "reserve", label: "Near-term reserve", role: "spendingReserve", value: amountShare(value, 0.65), capacity: amountShare(capacity, 0.65), note: fields.note || "Near-term spending buffer", instrument: "Cash or short-duration holdings", coverageMonths }
    ];
  }

  if (productRole === "monthlyNeed") {
    if (!options.includeSubBuckets) return null;
    return [
      { id: "fixed", label: "Fixed need", role: "essentialExpense", value: 0, capacity: amountShare(capacity, 0.62), note: "Display-only monthly need component", instrument: "Household cashflow", coverageMonths: 1 },
      { id: "flexible", label: "Flexible need", role: "discretionaryExpense", value: 0, capacity: amountShare(capacity, 0.38), note: "Display-only monthly need component", instrument: "Household cashflow", coverageMonths: 1 }
    ];
  }

  if (productRole === "annuityPolicy") {
    if (!options.includeSubBuckets) return null;
    const instrument = String(fields.category || "").toLowerCase() === "insurance" ? "Insurance policy" : "Annuity contract";
    return [
      { id: "contract", label: "Contract value", role: "policyValue", value: value || capacity, capacity, note: fields.note || "Illustrative policy value", instrument, coverageMonths: 0 },
      { id: "income", label: "Income feature", role: "incomeFeature", value: 0, capacity, note: fields.subtitle || "Display-only income feature", instrument, coverageMonths: 12 }
    ];
  }

  if (productRole === "trustEstate") {
    if (!options.includeSubBuckets) return null;
    return [
      { id: "corpus", label: "Trust corpus", role: "trustCorpus", value, capacity, note: fields.note || "Estate container assets", instrument: "Trust / estate", coverageMonths: 0 },
      { id: "settlement", label: "Settlement reserve", role: "estateSettlement", value: amountShare(value, 0.08), capacity: amountShare(capacity, 0.08), note: "Display-only settlement reserve", instrument: "Estate liquidity", coverageMonths: 0 }
    ];
  }

  if (productRole === "household") {
    if (!options.includeSubBuckets) return null;
    return [
      { id: "household", label: "Household marker", role: "clientHousehold", value, capacity, note: fields.note || "Display-only household context", instrument: "Household summary", coverageMonths: 0 }
    ];
  }

  if (productRole === "taxReserve") {
    if (!options.includeSubBuckets) return null;
    return [
      { id: "federal", label: "Federal estimate", role: "federalTax", value: amountShare(value, 0.7), capacity: amountShare(capacity, 0.7), note: "Advisor-entered estimate", instrument: "Withholding / cash set-aside", coverageMonths: 0 },
      { id: "state", label: "State estimate", role: "stateTax", value: amountShare(value, 0.3), capacity: amountShare(capacity, 0.3), note: "Advisor-entered estimate", instrument: "Withholding / cash set-aside", coverageMonths: 0 }
    ];
  }

  if (productRole === "beneficiary") {
    if (!options.includeSubBuckets) return null;
    return [
      { id: "primary", label: "Primary branch", role: "primaryBeneficiary", value: amountShare(value || capacity, 0.8), capacity: amountShare(capacity, 0.8), note: "Display-only beneficiary branch", instrument: "Beneficiary designation", coverageMonths: 0 },
      { id: "contingent", label: "Contingent branch", role: "contingentBeneficiary", value: amountShare(value || capacity, 0.2), capacity: amountShare(capacity, 0.2), note: "Display-only beneficiary branch", instrument: "Beneficiary designation", coverageMonths: 0 }
    ];
  }

  if (productRole === "charity") {
    if (!options.includeSubBuckets) return null;
    return [
      { id: "qcd", label: "QCD allocation", role: "qualifiedCharitableDistribution", value: value || capacity, capacity, note: fields.note || "Display-only charitable branch", instrument: "Qualified charity", coverageMonths: 0 }
    ];
  }

  if (productRole === "fee") {
    if (!options.includeSubBuckets) return null;
    return [
      { id: "advisor-fee", label: "Advisor fee", role: "advisorFee", value, capacity, note: "Display-only fee reserve", instrument: "Fee schedule", coverageMonths: 0 }
    ];
  }

  return null;
}

function defaultProductMeta(fields, productRole) {
  const category = fields.category || "";
  switch (productRole) {
    case "investmentAccount":
      return productMeta("investmentAccount", { accountCategory: category || "brokerage" });
    case "retirementAccount":
      return productMeta("retirementAccount", { accountCategory: category || "retirement" });
    case "cashReserve":
      return productMeta("liquidityCoverage", { coverageMonths: coverageMonthsFor(fields) });
    case "monthlyNeed":
      return productMeta("monthlyNeed", { cadence: "monthly" });
    case "annuityPolicy":
      if (String(category).toLowerCase() === "insurance") {
        return productMeta("insurancePolicy", {
          carrier: fields.carrier || "Carrier TBD",
          issueAge: fields.issueAge || "N/A",
          benefit: fields.benefit || "Review"
        });
      }
      return productMeta("incomePolicy", { policyType: "Income annuity" });
    case "trustEstate":
      return productMeta("estateTransfer", { ownershipContext: String(category).toLowerCase() === "estate" ? "currentEstate" : "trustOrEstateContainer" });
    case "household":
      return productMeta("householdMarker");
    case "taxReserve":
      return productMeta("taxSetAside", { cadence: /quarterly/i.test([fields.label, fields.subtitle, fields.note].join(" ")) ? "quarterly" : "annual" });
    case "fee":
      return productMeta("feeReserve");
    case "beneficiary":
      return productMeta("beneficiaryTransfer");
    case "charity":
      return productMeta("charitableTransfer");
    default:
      return null;
  }
}

function financePaletteItem(entry) {
  const productRole = entry.productRole || inferProductRole(entry);
  const hasSubBuckets = Object.prototype.hasOwnProperty.call(entry, "subBuckets");
  const subBuckets = hasSubBuckets ? normalizeSubBuckets(entry.subBuckets) : defaultSubBucketsForProduct(entry, productRole, entry);
  const meta = entry.meta || defaultProductMeta(entry, productRole);
  return {
    ...entry,
    productRole,
    ...(subBuckets ? { subBuckets } : {}),
    ...(meta ? { meta } : {})
  };
}

export const financePalette = [
  financePaletteItem({ id: "account-card", visual: "card", category: "brokerage", label: "Investment Account", subtitle: "Brokerage", note: "", value: 250000, capacity: 500000, w: 250, h: 132, icon: "card" }),
  financePaletteItem({ id: "retirement-card", visual: "card", category: "ira", label: "Retirement Account", subtitle: "IRA", note: "Tax-advantaged account", value: 300000, capacity: 700000, w: 250, h: 132, icon: "card" }),
  financePaletteItem({ id: "liquid-bucket", visual: "bucket", category: "cash", label: "Liquidity Bucket", subtitle: "Cash reserve", note: "Near-term spending", value: 100000, capacity: 250000, w: 320, h: 210, icon: "bucket", surface: "container", subBuckets: [
    { id: "cash", label: "Cash Reserve", role: "spendingReserve", value: 60000, capacity: 120000, note: "6-12 months of expenses", instrument: "Cash", coverageMonths: 6 },
    { id: "short-term", label: "Short-Term Bonds", role: "bondLadder", value: 40000, capacity: 90000, note: "1-3 year ladder", instrument: "Short-duration bonds", coverageMonths: 0 }
  ] }),
  financePaletteItem({ id: "cash-stack", visual: "cashStack", category: "cash", label: "Cash Stack", subtitle: "Liquidity reserve", note: "Short-term reserve", value: 85000, capacity: 250000, w: 245, h: 126, icon: "cashStack" }),
  financePaletteItem({ id: "policy-tile", visual: "policy", category: "annuity", label: "Income Source", subtitle: "Annuity / insurance", note: "Illustrative policy", value: 200000, capacity: 500000, w: 260, h: 132, icon: "policy" }),
  financePaletteItem({ id: "tax-tag", visual: "taxTag", category: "cash", label: "Tax Reserve", subtitle: "Tax / fee tag", note: "Estimated set-aside", value: 30000, capacity: 140000, w: 220, h: 92, icon: "amountTag" }),
  financePaletteItem({ id: "household", visual: "household", category: "household", label: "Household", subtitle: "Client cash flow", note: "Client-facing summary", value: 0, capacity: 150000, w: 230, h: 112, icon: "household" }),
  financePaletteItem({ id: "trust-container", visual: "trust", category: "trust", label: "Trust / Estate", subtitle: "Estate container", note: "Transfer destination", value: 0, capacity: 1000000, w: 360, h: 240, icon: "trust", surface: "container", subBuckets: [
    { id: "lifestyle", label: "Lifestyle Sleeve", role: "lifestyleSupport", value: 0, capacity: 400000, note: "For lifestyle and personal needs", instrument: "Trust", coverageMonths: 0 },
    { id: "legacy", label: "Legacy Sleeve", role: "legacySupport", value: 0, capacity: 500000, note: "For heirs and future generations", instrument: "Trust", coverageMonths: 0 },
    { id: "charitable", label: "Charitable Sleeve", role: "charitableGiving", value: 0, capacity: 100000, note: "Values-based giving", instrument: "Trust", coverageMonths: 0 }
  ] })
];

export const groupPalette = [
  { id: "planning-group", label: "Planning group", subtitle: "", w: 380, h: 230, icon: "group" }
];

export const connectorPalette = [
  { id: "smartArc", label: "Smart arc", subtitle: "Polished money flow", icon: "connector arc", routeStyle: "smartArc", strokeStyle: "solid" },
  { id: "straight", label: "Straight", subtitle: "Direct line", icon: "connector", routeStyle: "straight", strokeStyle: "solid" },
  { id: "elbow", label: "Elbow", subtitle: "Right-angle route", icon: "connector", routeStyle: "elbow", strokeStyle: "solid" },
  { id: "sCurve", label: "S-curve", subtitle: "Editorial sweep", icon: "connector arc", routeStyle: "sCurve", strokeStyle: "solid" },
  { id: "proposal", label: "Proposal fade", subtitle: "Tentative move", icon: "connector dash", routeStyle: "smartArc", strokeStyle: "proposalFade" },
  { id: "future", label: "Dotted future", subtitle: "Future flow", icon: "connector dot", routeStyle: "smartArc", strokeStyle: "dotted" }
];

export const connectorDefaults = {
  routeStyle: "smartArc",
  strokeStyle: "solid",
  arrowStart: "none",
  arrowEnd: "arrow",
  labelMode: "auto",
  labelPoint: null,
  presentationRole: "primary",
  colorMode: "flow",
  widthMode: "amount",
  customWidth: 5,
  manualMid: false,
  mid: null,
  cadence: "oneTime",
  timing: "current",
  sourceEffect: null,
  targetEffect: null,
  domainRole: null
};

const MONTHLY_SCENARIO_KEYS = new Set(["monthlyDistribution", "guaranteedIncome", "flexibleIncome", "annuityIncome"]);

function connectorSemanticDefaults(flowType, source, target, options = {}) {
  const targetEndpoint = endpoint(target);
  const cadence = options.cadence
    || (MONTHLY_SCENARIO_KEYS.has(options.scenarioKey) ? "monthly" : null)
    || (flowType === "rmd" ? "annual" : "oneTime");
  const timing = options.timing || "current";
  const targetIsPaycheck = targetEndpoint?.itemId && /paycheck|income|need/i.test(String(targetEndpoint.itemId));
  const sourceEffect = options.sourceEffect
    || (options.affectsSource === false ? "none" : "decreaseBalance");
  const targetEffect = options.targetEffect
    || (options.affectsTarget === false ? "none" : null)
    || (targetIsPaycheck && (flowType === "income" || flowType === "rmd") ? "cashflowCoverage" : null)
    || (targetIsPaycheck ? "none" : null)
    || (timing !== "current" ? "none" : "increaseBalance");
  const domainRole = options.domainRole || options.scenarioKey || flowType;
  return { cadence, timing, sourceEffect, targetEffect, domainRole };
}

function connectorVisualDefaults(flowType, options = {}) {
  const semanticType = String(flowType || "transfer");
  const timing = String(options.timing || "current").toLowerCase();
  const futureFlow = timing === "future" || timing === "deferred";
  const base = { colorMode: "flow" };

  if (futureFlow || semanticType === "beneficiary") return { ...base, strokeStyle: "dotted" };
  if (semanticType === "income" || semanticType === "rmd") return { ...base, strokeStyle: "longDash" };
  if (semanticType === "tax" || semanticType === "qcd" || semanticType === "fee") return { ...base, strokeStyle: "fineDash" };
  if (semanticType === "roth") return { ...base, strokeStyle: "fineDash" };
  return { ...base, strokeStyle: "solid" };
}

export function financeItem(id, visual, category, label, subtitle, note, x, y, w, h, value, capacity, zIndex = 20, options = {}) {
  const rawOptions = zIndex && typeof zIndex === "object" ? zIndex : options;
  const resolvedOptions = rawOptions && typeof rawOptions === "object" ? rawOptions : {};
  const resolvedZIndex = zIndex && typeof zIndex === "object" ? 20 : zIndex;
  const fields = { id, visual, category, label, subtitle, note, value, capacity };
  const productRole = resolvedOptions.productRole || inferProductRole(fields);
  const hasSubBuckets = Object.prototype.hasOwnProperty.call(resolvedOptions, "subBuckets");
  const hasMeta = Object.prototype.hasOwnProperty.call(resolvedOptions, "meta");
  const subBuckets = hasSubBuckets ? normalizeSubBuckets(resolvedOptions.subBuckets) : defaultSubBucketsForProduct(fields, productRole, resolvedOptions);
  const meta = hasMeta ? resolvedOptions.meta : defaultProductMeta(fields, productRole);
  const surface = String(resolvedOptions.surface || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return {
    item: { id, type: "finance", visual, label, subtitle, note, x, y, w, h, zIndex: resolvedZIndex, financeId: id, productRole, ...(surface ? { surface } : {}), style: {} },
    data: {
      category,
      value,
      capacity,
      baseValue: value,
      productRole,
      ...(surface ? { surface } : {}),
      ...(subBuckets ? { subBuckets: clone(subBuckets) } : {}),
      ...(meta ? { meta: clone(meta) } : {})
    }
  };
}

export function textItem(id, label, subtitle, x, y, w, h, textStyle = "title", zIndex = 35, options = {}) {
  return { id, type: "text", label, subtitle, x, y, w, h, zIndex, style: { textStyle }, ...options };
}

export function shapeItem(id, shape, label, subtitle, x, y, w, h, zIndex = 18) {
  return { id, type: "shape", shape, label, subtitle, x, y, w, h, zIndex, style: {} };
}

export function groupBox(id, label, x, y, w, h, childIds = [], zIndex = 8) {
  return { id, label, x, y, w, h, childIds, zIndex };
}

export function connector(id, label, flowType, amount, source, target, options = {}) {
  const semantics = connectorSemanticDefaults(flowType, source, target, options);
  const visualDefaults = connectorVisualDefaults(flowType, options);
  return {
    ...clone(connectorDefaults),
    ...semantics,
    ...visualDefaults,
    id,
    label,
    flowType,
    amount,
    max: options.max ?? Math.max(amount * 1.8, 250000),
    source: endpoint(source),
    target: endpoint(target),
    ...options
  };
}

export function templateText(meta) {
  return [
    textItem(`${meta.id}-headline`, meta.canvasTitle || meta.name, meta.canvasEyebrow || "Client meeting visual", 420, 170, 400, 92, "title", 14),
    textItem(`${meta.id}-disclosure`, meta.disclosure || "SYNTHETIC DEMO DATA. Advisor-entered approximate values for illustration only. Not a projection or investment recommendation.", "", meta.disclosureX || 545, meta.disclosureY || 930, meta.disclosureW || 790, 44, "disclosure", 14, { locked: true })
  ];
}

function storyLayout(profile = "standard") {
  const layouts = {
    standard: [
      { id: "source", role: "source", x: 190, y: 235, w: 390, h: 760, weight: 1 },
      { id: "decision", role: "decision", x: 565, y: 225, w: 520, h: 790, weight: 0.8 },
      { id: "outcome", role: "outcome", x: 1045, y: 235, w: 610, h: 760, weight: 1 },
      { id: "support", role: "support", x: 505, y: 570, w: 700, h: 470, weight: 0.7 }
    ],
    income: [
      { id: "source", role: "source", x: 185, y: 235, w: 400, h: 760, weight: 1 },
      { id: "decision", role: "decision", x: 560, y: 225, w: 500, h: 790, weight: 0.8 },
      { id: "paycheck", role: "outcome", x: 1040, y: 235, w: 620, h: 760, weight: 1 },
      { id: "support", role: "support", x: 500, y: 600, w: 700, h: 420, weight: 0.7 }
    ],
    estate: [
      { id: "source", role: "source", x: 165, y: 245, w: 350, h: 820, weight: 1 },
      { id: "trust", role: "decision", x: 520, y: 225, w: 640, h: 880, weight: 0.9 },
      { id: "outcome", role: "outcome", x: 1175, y: 235, w: 520, h: 850, weight: 1 },
      { id: "support", role: "support", x: 560, y: 650, w: 620, h: 470, weight: 0.7 }
    ]
  };
  return { lanes: clone(layouts[profile] || layouts.standard) };
}

export function assembleTemplate(meta, financeEntries, otherItems, templateGroups, templateConnectors, templateScenario) {
  const templateFinanceData = {};
  const financeItems = financeEntries.map((entry) => {
    templateFinanceData[entry.item.financeId] = entry.data;
    return entry.item;
  });

  return {
    ...meta,
    layout: clone(meta.layout || { lanes: [] }),
    items: [...templateText(meta), ...otherItems, ...financeItems],
    groups: templateGroups,
    financeData: templateFinanceData,
    connectors: templateConnectors,
    scenario: { ...defaultScenario, ...templateScenario }
  };
}

export const templateFactories = {
  retirement() {
    const liquiditySleeves = [
      { id: "cash", label: "Cash Reserve", role: "spendingReserve", value: 75000, capacity: 150000, note: "6-12 months of expenses", instrument: "Money market", coverageMonths: 10 },
      { id: "bonds", label: "Short-Term Bonds", role: "bondLadder", value: 50000, capacity: 100000, note: "1-3 year ladder", instrument: "Short-duration bonds", coverageMonths: 0 },
      { id: "opportunity", label: "Opportunistic Cash", role: "opportunityReserve", value: 25000, capacity: 50000, note: "Flexibility and opportunities", instrument: "Cash reserve", coverageMonths: 0 }
    ];
    const annuityMeta = {
      Carrier: "Northbridge Life",
      "Issue age": "67",
      Term: "Lifetime"
    };
    const finance = [
      financeItem("employer401k", "card", "401k", "Employer 401(k)", "Retirement account", "Tax-deferred growth", 300, 300, 268, 136, 920000, 1200000, 20, { surface: "compact" }),
      financeItem("rolloverIra", "card", "ira", "Rollover IRA", "Retirement account", "Consolidation source", 300, 485, 268, 136, 180000, 700000, 20, { surface: "compact" }),
      financeItem("managedPortfolio", "card", "brokerage", "Managed Portfolio", "Investment account", "Flexible draw source", 300, 670, 268, 136, 640000, 900000, 20, { surface: "compact" }),
      financeItem("clientIncome", "paycheck", "household", "Client Paycheck", "Monthly Need", "Need vs mapped income", 750, 325, 310, 164, 0, 160000, 22, { surface: "container" }),
      financeItem("cashReserve", "bucket", "cash", "Liquidity Bucket", "Cash Reserve", "Purpose-built spending sleeves", 735, 620, 370, 300, 150000, 300000, 20, { surface: "container", subBuckets: liquiditySleeves }),
      financeItem("incomeAnnuity", "policy", "annuity", "Income Advantage 7", "Annuity / policy", "Immediate annuity", 1120, 595, 300, 174, 0, 420000, 20, { surface: "contract", meta: annuityMeta }),
      financeItem("household", "household", "household", "Johnson Family", "Household", "Lifestyle and legacy", 1195, 300, 276, 126, 0, 1, 20, { surface: "marker" })
    ];
    const other = [];
    const conns = [
      connector("rollover", "Rollover", "rollover", 325000, { itemId: "employer401k", port: "bottom.out" }, { itemId: "rolloverIra", port: "top.in" }, { scenarioKey: "rollover", colorMode: "teal", widthMode: "subtle", labelMode: "hidden", presentationRole: "secondary", max: 600000 }),
      connector("annuityPremium", "Annuity premium", "annuity", 250000, { itemId: "rolloverIra", port: "right.out" }, { itemId: "incomeAnnuity", port: "left.funding" }, { scenarioKey: "annuityPremium", targetEffect: "increaseBalance", routeStyle: "smartArc", strokeStyle: "solid", colorMode: "teal", widthMode: "subtle", labelMode: "hidden", presentationRole: "secondary", max: 500000 }),
      connector("transfer", "Fund reserve", "transfer", 75000, { itemId: "managedPortfolio", port: "bottom.out" }, { itemId: "cashReserve", port: "left.in" }, { sourceEffect: "none", targetEffect: "none", max: 250000, colorMode: "teal", widthMode: "subtle", routeStyle: "smartArc", mid: { x: 460, y: 850 }, manualMid: true, labelMode: "auto", labelPoint: null, presentationRole: "primary" }),
      connector("annuityIncome", "Annuity income", "income", 21600, { itemId: "incomeAnnuity", port: "top.review", offsetX: -72 }, { itemId: "clientIncome", port: "right.household", offsetY: 50 }, { scenarioKey: "annuityIncome", affectsSource: false, colorMode: "teal", strokeStyle: "longDash", routeStyle: "straight", widthMode: "medium", labelMode: "manual", labelPoint: { x: 1010, y: 460 }, presentationRole: "primary", max: 120000 }),
      connector("incomeDistribution", "Portfolio draw", "income", 48000, { itemId: "managedPortfolio", port: "right.out" }, { itemId: "clientIncome", port: "left.income" }, { scenarioKey: "monthlyDistribution", colorMode: "teal", widthMode: "medium", routeStyle: "elbow", mid: { x: 620, y: 470 }, manualMid: true, labelMode: "manual", labelPoint: { x: 600, y: 430 }, presentationRole: "primary", max: 180000 }),
      connector("householdOutcome", "Household outcome", "income", 90000, { itemId: "clientIncome", port: "right.household" }, { itemId: "household", port: "left.in" }, { sourceEffect: "none", targetEffect: "none", colorMode: "teal", strokeStyle: "dotted", widthMode: "subtle", labelMode: "hidden", presentationRole: "secondary", max: 180000 })
    ];
    return assembleTemplate(
      { id: "retirement", name: "Retirement Income Flow", shortName: "Retirement", canvasTitle: "Retirement Income Money Map", layout: storyLayout("income") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 7500, monthlyDistribution: 4000, annuityPremium: 250000, annuityMonthlyIncome: 1800, annuityOn: true }
    );
  },
  roth() {
    const liquiditySleeves = [
      { id: "tax", label: "Tax Reserve Sleeve", role: "conversionTaxReserve", value: 30000, capacity: 120000, note: "Estimated taxes from conversion", instrument: "Cash reserve", coverageMonths: 0 },
      { id: "cash", label: "Cash Reserve", role: "householdReserve", value: 120000, capacity: 240000, note: "6-12 months of expenses", instrument: "Money market", coverageMonths: 10 },
      { id: "opportunity", label: "Opportunity Sleeve", role: "opportunityReserve", value: 100000, capacity: 180000, note: "Flexibility and opportunities", instrument: "Cash / short duration", coverageMonths: 0 }
    ];
    const trustSleeves = [
      { id: "lifestyle", label: "Lifestyle Sleeve", role: "lifestyleSupport", value: 300000, capacity: 600000, note: "For lifestyle and personal needs", instrument: "Trust", coverageMonths: 0 },
      { id: "legacy", label: "Legacy Sleeve", role: "legacySupport", value: 420000, capacity: 780000, note: "For heirs and future generations", instrument: "Trust", coverageMonths: 0 },
      { id: "charitable", label: "Charitable Sleeve", role: "charitableGiving", value: 120000, capacity: 260000, note: "Values-based giving", instrument: "Trust", coverageMonths: 0 }
    ];
    const taxReserveEntry = financeItem("taxReserve", "taxTag", "cash", "Tax Reserve", "Est. taxes", "", 700, 790, 230, 120, 65000, 220000, 20, { productRole: "taxReserve", surface: "tag" });
    taxReserveEntry.item.stateOverride = "tradeoff";
    const finance = [
      financeItem("traditionalIra", "card", "ira", "Traditional IRA", "Retirement account", "Pre-tax savings", 335, 335, 268, 136, 880000, 1200000, 20, { surface: "compact" }),
      financeItem("rothIra", "card", "rothIra", "Roth IRA", "Retirement account", "Tax-free growth", 335, 535, 268, 136, 120000, 650000, 20, { surface: "compact" }),
      financeItem("brokerage", "card", "brokerage", "Cash Management", "Non-qualified account", "Funds tax payment if needed", 335, 735, 268, 136, 540000, 850000, 20, { surface: "compact" }),
      financeItem("futureIncome", "paycheck", "household", "Future Income Improvement", "Monthly need", "Lower tax drag", 760, 270, 300, 160, 0, 180000, 22, { surface: "container" }),
      financeItem("liquidityBucket", "bucket", "cash", "Liquidity Bucket", "Tax reserve strategy", "Purpose-built reserve sleeves", 750, 575, 340, 280, 250000, 540000, 20, { surface: "container", subBuckets: liquiditySleeves }),
      taxReserveEntry,
      financeItem("household", "household", "household", "Johnson Family", "Household", "Lifestyle and legacy", 1240, 315, 260, 122, 0, 1, 20, { surface: "marker" }),
      financeItem("familyTrust", "trust", "trust", "Johnson Family Trust", "Estate container", "Lifestyle, legacy, charitable sleeves", 1180, 560, 360, 258, 840000, 1640000, 20, { surface: "container", subBuckets: trustSleeves })
    ];
    const other = [];
    const conns = [
      connector("rothConversion", "Roth conversion", "roth", 125000, { itemId: "traditionalIra", port: "right.out" }, { itemId: "rothIra", port: "left.in" }, { scenarioKey: "rothConversion", colorMode: "graphite", routeStyle: "smartArc", presentationRole: "primary", max: 350000 }),
      connector("taxPayment", "Tax reserve", "tax", 30000, { itemId: "brokerage", port: "right.out" }, { itemId: "taxReserve", port: "left.in" }, { scenarioKey: "taxPayment", routeStyle: "sCurve", colorMode: "red", strokeStyle: "longDash", presentationRole: "primary", max: 140000 }),
      connector("reserveSupport", "Supports sustained plan", "transfer", 120000, { itemId: "liquidityBucket", port: "right.out" }, { itemId: "familyTrust", port: "left.funding" }, { cadence: "oneTime", sourceEffect: "none", targetEffect: "none", colorMode: "teal", widthMode: "subtle", labelMode: "hidden", presentationRole: "secondary", max: 240000 }),
      connector("futureRmd", "Future tax-free income", "rmd", 65000, { itemId: "futureIncome", port: "right.household" }, { itemId: "household", port: "left.in" }, { domainRole: "futureRmdPressure", timing: "future", cadence: "annual", strokeStyle: "dotted", routeStyle: "smartArc", affectsSource: false, affectsTarget: false, sourceEffect: "none", targetEffect: "none", colorMode: "teal", presentationRole: "primary", max: 140000 })
    ];
    return assembleTemplate(
      { id: "roth", name: "Roth Conversion + Tax Reserve", shortName: "Roth", canvasTitle: "Roth Conversion Tax Map", layout: storyLayout("standard") },
      finance,
      other,
      [],
      conns,
      { rothConversion: 125000, taxReservePct: 24, monthlyDistribution: 3500, annuityOn: false }
    );
  },
  annuity() {
    const finance = [
      financeItem("portfolio", "card", "brokerage", "Balanced Portfolio", "Investment account", "Funding source", 430, 520, 255, 132, 820000, 1100000),
      financeItem("annuityPolicy", "policy", "annuity", "Deferred Income Annuity", "Policy tile", "Illustrative premium", 825, 520, 290, 136, 0, 550000),
      financeItem("incomeFloor", "paycheck", "household", "Income Floor", "Monthly need", "Guaranteed base income", 1190, 410, 250, 138, 0, 160000),
      financeItem("cashBuffer", "bucket", "cash", "Cash Buffer", "Liquidity reserve", "Two years of distributions", 1190, 655, 250, 138, 175000, 300000)
    ];
    const other = [];
    const conns = [
      connector("annuityPremium", "Annuity premium", "annuity", 250000, "portfolio", "annuityPolicy", { scenarioKey: "annuityPremium", colorMode: "metal", strokeStyle: "longDash", max: 550000 }),
      connector("annuityIncome", "Income start", "income", 21600, "annuityPolicy", "incomeFloor", { scenarioKey: "annuityIncome", affectsSource: false, colorMode: "accent", max: 120000 }),
      connector("cashTransfer", "Buffer transfer", "transfer", 85000, "portfolio", "cashBuffer", { colorMode: "red", widthMode: "subtle", labelMode: "hidden", presentationRole: "secondary", max: 250000 })
    ];
    return assembleTemplate(
      { id: "annuity", name: "Annuity Funding + Income Start", shortName: "Annuity", canvasTitle: "Income Floor Scenario", layout: storyLayout("standard") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 6400, annuityPremium: 250000, annuityMonthlyIncome: 1800, annuityOn: true, monthlyDistribution: 3200 }
    );
  },
  estate() {
    const trustSleeves = [
      { id: "lifestyle", label: "Lifestyle Sleeve", role: "lifestyleSupport", value: 260000, capacity: 520000, note: "Surviving household access", instrument: "Revocable trust", coverageMonths: 0 },
      { id: "legacy", label: "Legacy Sleeve", role: "legacyTransfer", value: 300000, capacity: 760000, note: "Heir distribution branch", instrument: "Revocable trust", coverageMonths: 0 },
      { id: "charitable", label: "Charitable Sleeve", role: "charitableBequest", value: 90000, capacity: 220000, note: "Optional giving branch", instrument: "Revocable trust", coverageMonths: 0 },
      { id: "admin-liquidity", label: "Admin / Liquidity Sleeve", role: "trustLiquiditySupport", value: 70000, capacity: 140000, note: "Trust expenses and tax support", instrument: "Revocable trust", coverageMonths: 0 }
    ];
    const liquiditySleeves = [
      { id: "cash", label: "Cash Reserve", role: "estateCashReserve", value: 110000, capacity: 220000, note: "Immediate liquidity", instrument: "Cash / money market", coverageMonths: 6 },
      { id: "admin", label: "Admin Reserve", role: "estateAdminReserve", value: 70000, capacity: 140000, note: "Advisor and filing costs", instrument: "Estate reserve", coverageMonths: 0 },
      { id: "settlement-costs", label: "Settlement Costs", role: "estateSettlementCosts", value: 100000, capacity: 180000, note: "Estimated closing costs", instrument: "Estate reserve", coverageMonths: 0 }
    ];
    const lifePolicyMeta = {
      Carrier: "Aster Ridge Mutual",
      "Issue age": "58",
      Benefit: "$1.0M"
    };
    const finance = [
      financeItem("estateAccount", "card", "brokerage", "Taxable Brokerage", "Source account", "Current individual ownership", 300, 485, 260, 132, 1250000, 1600000),
      financeItem("retirementAccount", "card", "ira", "Retirement IRA", "Beneficiary asset", "Designation review", 300, 680, 260, 132, 760000, 1100000),
      financeItem("lifePolicy", "policy", "insurance", "Life Insurance Policy", "Legacy protection", "Beneficiary review", 300, 875, 292, 138, 500000, 1000000, 20, { meta: lifePolicyMeta }),
      financeItem("revocableTrust", "trust", "trust", "Revocable Trust", "Central estate container", "Client-facing distribution sleeves", 800, 388, 480, 390, 0, 1600000, 22, { subBuckets: trustSleeves }),
      financeItem("cashReserve", "bucket", "cash", "Estate Liquidity Reserve", "Tax / admin support", "Cash for taxes, filings, and closing costs", 875, 760, 410, 316, 280000, 540000, 20, { subBuckets: liquiditySleeves }),
      financeItem("survivingHousehold", "household", "household", "Surviving Household", "Lifestyle outcome", "Approximate support branch", 1460, 315, 270, 112, 0, 1),
      financeItem("beneficiaries", "household", "household", "Heirs / Beneficiaries", "Legacy outcome", "Approximate future transfer", 1460, 555, 270, 118, 0, 1, 20, { productRole: "beneficiary" }),
      financeItem("charity", "amountTag", "charity", "Charitable Gifts", "Optional outcome", "Advisor-entered branch", 1460, 795, 230, 92, 0, 200000, 20, { productRole: "charity" })
    ];
    const other = [];
    const conns = [
      connector("assetTransfer", "Asset transfer", "transfer", 720000, { itemId: "estateAccount", port: "right.out" }, { itemId: "revocableTrust", port: "left.funding" }, { cadence: "oneTime", domainRole: "retitledAssets", colorMode: "teal", widthMode: "medium", presentationRole: "primary", max: 1200000 }),
      connector("beneficiaryFlow", "Beneficiary transfer", "beneficiary", 500000, { itemId: "revocableTrust", port: "right.legacy", offsetY: 10 }, { itemId: "beneficiaries", port: "left.in" }, { cadence: "oneTime", timing: "future", domainRole: "heirDistribution", sourceEffect: "none", targetEffect: "none", strokeStyle: "dotted", widthMode: "subtle", labelMode: "manual", labelPoint: { x: 1430, y: 450 }, presentationRole: "primary", max: 1000000 }),
      connector("lifestyleSupport", "Lifestyle support", "income", 54000, { itemId: "revocableTrust", port: "right.lifestyle", offsetY: -110 }, { itemId: "survivingHousehold", port: "left.in" }, { cadence: "monthly", domainRole: "survivorLifestyleSupport", sourceEffect: "none", targetEffect: "none", colorMode: "teal", presentationRole: "primary", max: 180000 }),
      connector("charitableGiving", "Charitable giving", "beneficiary", 90000, { itemId: "revocableTrust", port: "right.charitable", offsetY: 132 }, { itemId: "charity", port: "left.in", offsetY: 24 }, { cadence: "oneTime", timing: "future", domainRole: "charitableBequest", sourceEffect: "none", targetEffect: "none", strokeStyle: "dotted", colorMode: "teal", routeStyle: "sCurve", mid: { x: 1260, y: 840 }, manualMid: true, labelMode: "hidden", presentationRole: "secondary", widthMode: "subtle", max: 220000 }),
      connector("taxReserveFunding", "Tax reserve funding", "tax", 180000, { itemId: "estateAccount", port: "right.out" }, { itemId: "cashReserve", port: "left.in" }, { cadence: "oneTime", domainRole: "estateTaxReserveFunding", colorMode: "red", routeStyle: "smartArc", labelMode: "hidden", presentationRole: "detail", widthMode: "subtle", max: 360000 })
    ];
    return assembleTemplate(
      { id: "estate", name: "Estate / Trust Transfer", shortName: "Estate", canvasTitle: "Estate Transfer Map", disclosureX: 620, disclosureY: 1010, disclosureW: 850, layout: storyLayout("estate") },
      finance,
      other,
      [],
      conns,
      { monthlyDistribution: 3000, annuityOn: false }
    );
  },
  cashReserve() {
    const finance = [
      financeItem("portfolio", "card", "brokerage", "Managed Portfolio", "Investment account", "Primary source", 405, 505, 255, 132, 780000, 1000000),
      financeItem("cashBucket", "bucket", "cash", "Cash Reserve", "12-month bucket", "Near-term spending", 790, 410, 255, 138, 120000, 250000),
      financeItem("shortTerm", "bucket", "cash", "Short-Term Bond Bucket", "Stability sleeve", "Two to four years", 790, 660, 255, 138, 210000, 350000),
      financeItem("growthBucket", "card", "brokerage", "Growth Sleeve", "Long-term assets", "Inflation protection", 1180, 530, 255, 132, 450000, 800000),
      financeItem("clientIncome", "paycheck", "household", "Monthly Need", "Client cash flow", "Live distribution scenario", 1180, 330, 255, 132, 0, 150000)
    ];
    const other = [];
    const conns = [
      connector("cashTransfer", "Fund cash reserve", "transfer", 90000, "portfolio", "cashBucket", { colorMode: "teal", max: 250000 }),
      connector("bondTransfer", "Stability sleeve", "rebalance", 160000, "portfolio", "shortTerm", { visible: false, sourceEffect: "none", targetEffect: "none", routeStyle: "sCurve", colorMode: "accent", widthMode: "subtle", labelMode: "hidden", presentationRole: "detail", max: 350000 }),
      connector("incomeDistribution", "Monthly distribution", "income", 48000, "cashBucket", "clientIncome", { scenarioKey: "monthlyDistribution", affectsSource: true, labelMode: "auto", labelPoint: null, max: 180000 }),
      connector("rebalance", "Portfolio refill", "rebalance", 60000, "growthBucket", "portfolio", { strokeStyle: "dotted", labelMode: "auto", labelPoint: null, max: 180000 })
    ];
    return assembleTemplate(
      { id: "cashReserve", name: "Cash Reserve + Risk Bucket", shortName: "Cash reserve", canvasTitle: "Reserve Bucket Scenario", layout: storyLayout("standard") },
      finance,
      other,
      [],
      conns,
      { monthlyNeed: 7000, monthlyDistribution: 4000, annuityOn: false }
    );
  },
  ...cashflowTemplateFactories,
  blankHousehold() {
    const finance = [
      financeItem("household", "household", "household", "Household", "Client household", "Approximate values", 880, 500, 250, 112, 0, 1),
      financeItem("monthlyNeed", "paycheck", "household", "Monthly Need", "Client paycheck", "Advisor-entered need", 1210, 500, 255, 132, 0, 150000)
    ];
    return assembleTemplate(
      { id: "blankHousehold", name: "Blank Household", shortName: "Household", canvasTitle: "Blank Household", layout: storyLayout("income") },
      finance,
      [],
      [],
      [],
      { monthlyNeed: 7500, monthlyDistribution: 0, annuityOn: false }
    );
  }
};

export const templateCatalogSections = [
  {
    id: "reference",
    title: "Reference templates",
    eyebrow: "Advisor exhibits",
    templates: [
      { templateId: "retirement", description: "Polished retirement income map with paycheck, reserve sleeves, and annuity income." },
      { templateId: "estate", description: "Trust transfer map with source lane, beneficiary outcomes, and estate liquidity." },
      { templateId: "roth", description: "Roth conversion and tax reserve conversation map." },
      { templateId: "annuity", description: "Annuity funding and income-floor scenario." },
      { templateId: "cashReserve", description: "Cash reserve and risk bucket strategy." }
    ]
  },
  {
    id: "cashflow",
    title: "Cashflow planning",
    eyebrow: "Meeting workflows",
    templates: [
      { templateId: "retirementPaycheck", name: "Monthly Income Gap", description: "Client need, mapped income, and uncovered monthly gap." },
      { templateId: "socialSecurityBridge", description: "Bridge spending before Social Security begins." },
      { templateId: "bucketStrategy", description: "Cash, stability, and growth buckets for retirement spending." },
      { templateId: "rmdTax", description: "RMD withdrawal, withholding, and tax reserve flow." },
      { templateId: "withdrawalSequencing", description: "Taxable, tax-deferred, and Roth sequencing map." },
      { templateId: "cashCleanup", description: "Idle cash cleanup into reserve and investment sleeves." },
      { templateId: "annuityIncomeFloor", description: "Income floor built from portfolio and annuity sources." },
      { templateId: "executiveComp", description: "Equity compensation, taxes, and liquidity planning." },
      { templateId: "businessOwner", description: "Business sale proceeds into liquidity, legacy, and income buckets." },
      { templateId: "survivorIncome", name: "Survivor Income", description: "Benefits, survivor income, and household support map." }
    ]
  },
  {
    id: "utility",
    title: "Blank and utility",
    eyebrow: "Lightweight starts",
    templates: [
      { templateId: "blankHousehold", description: "Start with a household marker and monthly need tile." }
    ]
  }
];

export const startingLayouts = templateCatalogSections.flatMap((section) => (
  section.templates.map((entry) => ({
    id: entry.templateId,
    name: entry.name || templateFactories[entry.templateId]?.().name || entry.templateId,
    templateId: entry.templateId,
    description: entry.description
  }))
));

export function getTheme() {
  return themes[state.themeId] || themes.stewardship;
}

export function applyTheme(nextThemeId) {
  state.themeId = nextThemeId;
  const theme = getTheme();
  Object.entries(theme.vars).forEach(([name, value]) => {
    document.documentElement.style.setProperty(`--${name}`, value);
  });
  document.body.dataset.theme = state.themeId;
  dom.themeEyebrow.textContent = theme.eyebrow;
  dom.themeButtonText.textContent = theme.shortName;
}
