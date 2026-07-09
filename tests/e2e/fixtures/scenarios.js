const defaultScenario = {
  monthlyDistribution: 4000,
  rothConversion: 125000,
  annuityPremium: 250000,
  annuityMonthlyIncome: 1800,
  annuityOn: true,
  taxReservePct: 24
};

function finance(id, label, value, capacity, x, y, options = {}) {
  return {
    item: {
      id,
      type: "finance",
      visual: options.visual || "card",
      label,
      subtitle: options.subtitle || options.category || "Brokerage",
      note: options.note || "Scenario fixture",
      x,
      y,
      w: options.w || 250,
      h: options.h || 132,
      zIndex: options.zIndex || 20,
      financeId: id,
      style: {}
    },
    data: {
      category: options.category || "brokerage",
      value,
      capacity,
      baseValue: value
    }
  };
}

function flow(id, label, source, target, amount, options = {}) {
  return {
    id,
    label,
    flowType: options.flowType || "transfer",
    amount,
    max: options.max || Math.max(amount * 1.8, 250000),
    source: typeof source === "string" ? { itemId: source } : source,
    target: typeof target === "string" ? { itemId: target } : target,
    routeStyle: options.routeStyle || "smartArc",
    strokeStyle: options.strokeStyle || "solid",
    arrowStart: options.arrowStart || "none",
    arrowEnd: options.arrowEnd || "arrow",
    labelMode: options.labelMode || "auto",
    labelPoint: options.labelPoint || null,
    colorMode: options.colorMode || "flow",
    widthMode: options.widthMode || "amount",
    customWidth: options.customWidth || 5,
    manualMid: Boolean(options.manualMid),
    mid: options.mid || null,
    affectsSource: options.affectsSource,
    affectsTarget: options.affectsTarget
  };
}

function diagram(entries, connectors = [], groups = []) {
  const financeData = {};
  const items = entries.map((entry) => {
    if (entry.data) financeData[entry.item.financeId] = entry.data;
    return entry.item || entry;
  });
  return { items, groups, financeData, connectors, scenario: { ...defaultScenario } };
}

function textItem(id, label, subtitle, x, y, w = 300, h = 72) {
  return { id, type: "text", label, subtitle, x, y, w, h, zIndex: 30, style: { textStyle: "caption" } };
}

function emptyDiagram() {
  return diagram([]);
}

function singleAccount() {
  return diagram([
    finance("solo", "Solo Account", 100000, 200000, 800, 500)
  ]);
}

function selfLoop() {
  return diagram([
    finance("loop", "Self Loop Account", 100000, 200000, 800, 500)
  ], [
    flow("selfLoop", "Self loop", "loop", "loop", 25000)
  ]);
}

function twoNodeCycle() {
  return diagram([
    finance("accountA", "Account A", 100000, 200000, 640, 500),
    finance("accountB", "Account B", 50000, 160000, 960, 500)
  ], [
    flow("aToB", "A to B", "accountA", "accountB", 20000),
    flow("bToA", "B to A", "accountB", "accountA", 10000, { routeStyle: "sCurve" })
  ]);
}

function parallelMultiEdge() {
  return diagram([
    finance("source", "Parallel Source", 100000, 200000, 620, 500),
    finance("target", "Parallel Target", 0, 140000, 980, 500)
  ], [
    flow("parallelOne", "Parallel one", "source", "target", 20000),
    flow("parallelTwo", "Parallel two", "source", "target", 30000, { routeStyle: "sCurve" })
  ]);
}

function overdraft() {
  return diagram([
    finance("source", "Overdrawn Source", 120000, 240000, 620, 500),
    finance("target", "Large Target", 0, 800000, 980, 500)
  ], [
    flow("tooLarge", "Too large", "source", "target", 700000, { max: 900000 })
  ]);
}

function zeroStartingSource() {
  return diagram([
    finance("zero", "Zero Source", 0, 0, 620, 500),
    finance("target", "Target Account", 0, 100000, 980, 500)
  ], [
    flow("zeroFlow", "Zero source flow", "zero", "target", 10000)
  ]);
}

function threeNodeCycle() {
  return diagram([
    finance("a", "Cycle A", 100000, 200000, 600, 420),
    finance("b", "Cycle B", 50000, 160000, 1000, 420),
    finance("c", "Cycle C", 25000, 120000, 800, 690)
  ], [
    flow("aToB", "A to B", "a", "b", 20000),
    flow("bToC", "B to C", "b", "c", 10000),
    flow("cToA", "C to A", "c", "a", 5000)
  ]);
}

function rolloverChain() {
  return diagram([
    finance("old401k", "Old 401(k)", 500000, 700000, 430, 420, { category: "401k", subtitle: "401(k)" }),
    finance("ira", "Rollover IRA", 0, 700000, 760, 420, { category: "ira", subtitle: "IRA" }),
    finance("roth", "Roth IRA", 0, 350000, 1090, 420, { category: "rothIra", subtitle: "Roth IRA" }),
    finance("tax", "Tax Reserve", 0, 140000, 760, 680, { visual: "bucket", category: "cash", subtitle: "Cash" })
  ], [
    flow("rollover", "Rollover", "old401k", "ira", 300000, { flowType: "rollover" }),
    flow("conversion", "Roth conversion", "ira", "roth", 100000, { flowType: "roth" }),
    flow("taxLeak", "Tax reserve", "ira", "tax", 24000, { flowType: "tax", colorMode: "red" })
  ]);
}

function disconnectedComponents() {
  return diagram([
    finance("leftA", "Left A", 150000, 300000, 260, 360),
    finance("leftB", "Left B", 0, 200000, 560, 360),
    finance("rightA", "Right A", 220000, 400000, 1120, 700),
    finance("rightB", "Right B", 0, 300000, 1440, 700)
  ], [
    flow("leftFlow", "Left flow", "leftA", "leftB", 50000),
    flow("rightFlow", "Right flow", "rightA", "rightB", 80000)
  ]);
}

function householdOf18() {
  const entries = [];
  for (let index = 0; index < 18; index += 1) {
    const col = index % 6;
    const row = Math.floor(index / 6);
    entries.push(finance(`member${index + 1}`, `Household Member ${index + 1}`, 25000 + index * 2500, 120000, 260 + col * 210, 280 + row * 190, { w: 185, h: 112 }));
  }
  return diagram(entries);
}

function extremeValueRange() {
  return diagram([
    finance("tiny", "Tiny Balance", 1, 100, 560, 500),
    finance("huge", "Large Balance", 1000000000, 1500000000, 1040, 500)
  ], [
    flow("hugeFlow", "Huge flow", "huge", "tiny", 500000000, { max: 1000000000 })
  ]);
}

function adversarialLabels() {
  return diagram([
    finance("badLabel", "<script>window.__AFV_LABEL_EXECUTED=true</script> Tax-Advantaged Roth Conversion Reserve Bucket אבג", 100000, 200000, 790, 500, { subtitle: "<b>Not HTML</b>" }),
    textItem("caption", "Literal <img src=x onerror=window.__AFV_LABEL_EXECUTED=true>", "Escaped caption", 790, 700)
  ]);
}

module.exports = {
  emptyDiagram,
  singleAccount,
  selfLoop,
  twoNodeCycle,
  parallelMultiEdge,
  overdraft,
  zeroStartingSource,
  threeNodeCycle,
  rolloverChain,
  disconnectedComponents,
  householdOf18,
  extremeValueRange,
  adversarialLabels
};
