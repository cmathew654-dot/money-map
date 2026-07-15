# Money Map Approved Remediation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task. Apply superpowers:test-driven-development and superpowers:systematic-debugging at every red/green cycle, and superpowers:verification-before-completion before every stage commit and final handoff.

**Goal:** Make Money Map safe for unscripted advisor use by enforcing command/history, financial-dimension, ledger, persistence, presentation, and performance contracts through rendered-output journey tests.

**Architecture:** Keep the current browser-only ES-module application. Add a narrow command boundary around user mutations, separate connector geometry from semantic posting identity, centralize cadence/flow-type transitions, and persist the complete document envelope across the deliberate 1060px responsive gate. Tests may read raw state only as oracle input; every acceptance assertion compares independently recomputed values with rendered DOM/text reached through visible controls.

**Tech Stack:** Vanilla JavaScript ES modules, HTML/CSS, Playwright, Node's built-in test runner, `http-server`, Git stage commits.

**Canonical spec:** `docs/superpowers/specs/2026-07-14-money-map-approved-remediation-design.md`

---

## Global execution rules

- Work only in `C:\Users\Cyril\Projects\.portfolio-remediation-worktrees\money-map-approved-remediation-20260714` on `codex/money-map-approved-remediation-20260714`.
- Never bind, inspect, or stop port 4173. The remediation branch uses 54217.
- Open/select templates and perform actions through visible controls. `window.__moneyMapTest` may return raw snapshots for observation only.
- No state-vs-state financial assertions. Feed raw snapshot records into test-local arithmetic, then compare those results with card, connector, caption, banner, inspector, inventory, and presentation DOM.
- For each defect: write one focused failing journey first, run it and capture the expected failure, implement the smallest coherent fix, rerun the focused test, then run the stage regression set.
- Preserve read-only legacy fields until their compatibility tests are green.
- Commit only after `git diff --check`, focused tests, and the stage regression set pass.
- Stop for owner input before Stage 4 product changes and before any Stage 6 screenshot update.

## Shared rendered-truth test support

Create `tests/e2e/helpers/rendered-financial-oracle.js` before the first financial test. It must import no production compute, selector, template, or renderer code and expose:

- `readMoney(text)` and `readCadence(text)`
- `normalizeRecurring({ amount, cadence }, period)`
- `sumVisiblePostings(snapshot, options)`
- `computeBalances(snapshot)`
- `computeMappedCashflow(snapshot)`
- `computeSleeves(snapshot)`
- `computeInventory(snapshot)`
- `computeRmdStory(snapshot)`
- DOM readers for cards, connectors, banners, inventory rows, inspector fields, and presentation values
- `expectRenderedMoney(actualText, expected, tolerance = 1)`

Create `tests/e2e/helpers/visible-journey.js` with catalog navigation, visible-control selection, keyboard helpers, presentation entry/exit, inventory opening, and error collectors. It may observe snapshots but must not call test-only mutation/load/select APIs.

---

### Task 0: Freeze provenance, isolate the server, and record the baseline

**Files:**
- Modify mechanically: `package.json`, `playwright.config.js`, `tests/e2e/*.spec.js`, `tests/audit/*.js`
- Create: `docs/audits/2026-07-14-money-map-remediation-receipts.md`

**Step 1: Record immutable provenance**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -5
git show --stat --oneline 1da8cd9
git diff 0fb1840..1da8cd9 --name-only
```

Expected: clean branch, audit commit present, and the cherry-pick contains only the master report.

**Step 2: Move every executable test URL from 4173 to 54217**

Mechanically replace literal port 4173 with 54217 only in the branch's package/config/test/audit files. Do not touch application URLs or historical audit prose. Confirm:

```powershell
rg -n "4173" package.json playwright.config.js tests
```

Expected: no executable references.

**Step 3: Install and run the nonvisual baseline**

Run:

```powershell
npm ci
npx playwright test --project=chromium-1366 --project=chromium-1440 --project=chromium-1920 --project=chromium-390-gate
npm run audit:layout:strict
```

Expected: record exact pass/fail counts and duration. The strict wrapper may reproduce Windows `spawn EINVAL`; if so, run the underlying strict inspector against the already-running branch server and record both results.

**Step 4: Run visual baseline without updating**

Run:

```powershell
npm run test:visual
```

Expected: record all 18 known baseline diffs individually; do not update snapshots.

**Step 5: Write receipt and commit**

The receipt records SHA, branch, dirty state, exact commands, duration, pass/fail counts, failed requests/page errors, and artifact paths.

Run:

```powershell
git diff --check
git add package.json playwright.config.js tests docs/audits/2026-07-14-money-map-remediation-receipts.md
git commit -m "test: isolate remediation verification"
```

---

### Task 1: Establish the command/history and accessibility boundary

**Files:**
- Create: `tests/e2e/remediation-command-boundary-journey.spec.js`
- Create: `tests/audit/server.test.js`
- Modify: `index.html`, `styles.css`
- Modify: `src/state.js`, `src/main.js`, `src/interaction.js`, `src/render.js`
- Modify: `tests/audit/server.js`, `package.json`

**Step 1: Write failing rendered journey tests**

Cover through visible controls:

1. template reset asks for confirmation, changes content, and one undo/redo restores the rendered document;
2. connector label, type, amount, reverse, duplicate, slider commit, explicit quick-adjust controls, delete, and reset each create exactly one visible undo step;
3. bare `+`, `=`, `-`, and `0` always control zoom, never money;
4. after editing a range/text control then clicking the canvas selection, Delete/Backspace deletes the selection and undo restores it; while the field itself owns focus, deletion remains local;
5. Meeting is a real named button, keyboard reachable, maintains `aria-expanded`, opens the scenario controls, closes with Escape, and restores focus;
6. presentation hides every editor affordance (including `.item-edge-handles`) before/after hover and focus, with `pointer-events: none`;
7. visual-history actions produce immediate rendered feedback and one undo;
8. the audit server starts on Windows via a child Node process and shuts down only its own child.

Run the focused specs and retain the red failure messages in the receipt.

**Step 2: Add one command transaction primitive**

In `src/state.js`, add a single API such as:

```js
export function runDocumentCommand(mutator, { render = true } = {}) {
  const before = historySnapshot();
  const result = mutator();
  if (historyChanged(before)) pushHistorySnapshot(before);
  if (render) renderAllCallback();
  return result;
}
```

Use it only for committed user commands. Keep preview/input state outside history and commit once on `change`/pointer-up.

Extend `historySnapshot` and `restoreHistorySnapshot` to include every document field required for exact visible restoration: template identity/layout/title metadata, view mode, and other persisted document semantics, excluding ephemeral hover/focus/popover state.

**Step 3: Make reset reversible**

Refactor `loadTemplate(id, options)` so ordinary catalog loads clear history but reset can replace the document inside one command. `resetCanvas()` must obtain explicit confirmation, preserve the pre-reset snapshot, render the factory state, and allow one undo/redo without reloading.

**Step 4: Route all Stage 1 mutations through commands**

Replace mutation-before-history paths for edits, connector type/amount/label, scenario sliders, reverse, duplicate, delete, quick adjust, and visual actions. Remove the selection-sensitive bare-key monetary shortcut; retain explicit visible stepper controls.

Transfer canvas command focus when a canvas selection is activated without stealing keystrokes from a currently edited form control.

**Step 5: Make Meeting and presentation controls honest**

Add a persistent `button#meetingPanelButton` with accessible name, `aria-controls="scenarioRail"`, and `aria-expanded`. Render the rail from explicit open state rather than hover-only visibility; support click, Enter/Space, Escape, and focus return.

Add all editor selectors, especially `.item-edge-handles`, to presentation hide and pointer-event lockdown rules. Verify hover/focus cannot reveal them.

**Step 6: Fix the Windows audit server**

Refactor `tests/audit/server.js` to resolve the local `http-server` entry point and spawn `process.execPath` with the script path, configurable port defaulting to 54217, deterministic readiness, child-specific shutdown, and no shell. Export the small units needed by `tests/audit/server.test.js`. Add `test:audit-server` using `node --test`.

**Step 7: Verify and commit**

Run:

```powershell
node --test tests/audit/server.test.js
npx playwright test tests/e2e/remediation-command-boundary-journey.spec.js --project=chromium-1440
npx playwright test tests/e2e/remediation-undo-guard.spec.js tests/e2e/undo-redo.spec.js tests/e2e/meeting-layer.spec.js tests/e2e/remediation-present-lockdown.spec.js --project=chromium-1440
git diff --check
git add index.html styles.css src tests package.json docs/audits/2026-07-14-money-map-remediation-receipts.md
git commit -m "fix: enforce command and history boundaries"
```

---

### Task 2: Normalize financial dimensions atomically

**Files:**
- Create: `tests/e2e/helpers/rendered-financial-oracle.js`
- Create: `tests/e2e/helpers/visible-journey.js`
- Create: `tests/e2e/remediation-dimensional-integrity.spec.js`
- Create: `src/flowSemantics.js`
- Modify: `src/compute.js`, `src/interaction.js`, `src/render.js`, `src/templates.js`

**Step 1: Write failing transition journeys**

Using the catalog and inspector only:

- start with `Retirement Paycheck Stack`;
- capture rendered Portfolio Draw amount/cadence, mapped total, paycheck total, inventory, and presentation;
- change flow type Income → RMD → Contribution → Transfer;
- assert each transition preserves the displayed magnitude unless the user explicitly edits it, never interprets `$4,000/mo` as `$48,000/mo`, and updates every rendered surface to the independently recomputed value;
- undo/redo each transition and verify one step;
- exercise the same transition after an `input` preview and after committed `change`.

**Step 2: Add an atomic transition API**

In `src/flowSemantics.js`, define a pure transition function such as:

```js
export function transitionConnectorSemantics(connector, nextFlowType, context) {
  // derive prior displayed monthly/annual magnitude
  // choose compatible domainRole, cadence, scenario binding, and inclusion flags
  // store the normalized amount once
  // return a complete replacement semantic record
}
```

The caller must replace the relevant semantic fields atomically, then run one compute/render pass and one history commit. Renderer code must never guess a different cadence from stale fields.

**Step 3: Verify and commit**

Run:

```powershell
npx playwright test tests/e2e/remediation-dimensional-integrity.spec.js --project=chromium-1440
npx playwright test tests/e2e/domain-invariants.spec.js tests/e2e/financial-semantics.spec.js tests/e2e/cashflow.spec.js --project=chromium-1440
git diff --check
git add src tests docs/audits/2026-07-14-money-map-remediation-receipts.md
git commit -m "fix: normalize connector dimensions atomically"
```

---

### Task 3: Make the ledger, sleeves, previews, and connector editing truthful

**Files:**
- Create: `tests/e2e/remediation-ledger-truth.spec.js`
- Modify: `src/state.js`, `src/compute.js`, `src/templates.js`, `src/interaction.js`, `src/render.js`

**Step 1: Write failing ledger journeys**

Use visible controls and compare independent oracle output to rendered DOM for:

- all current-dated nonzero postings: each is visibly represented or explicitly disclosed, source/target balance effects reconcile, and nothing is a hidden debit/credit;
- Trust/Roth and Cash Reserve sleeves: parent equals sleeve sum plus explicit unallocated remainder, never a contradictory zero parent;
- annuity contract inventory, premium, payout, flexible draw, and special card labels;
- slider `input` preview: cards, connector label, mapped banner, caption, inspector, and inventory are coherent during input and after change;
- visible Detach/Reattach clicks: visual endpoints change and restore, semantic source/target identity remains, global/target/card/inventory/presentation money stays invariant, and one undo restores topology;
- a newly edge-drawn IRA → Heirs connector immediately exposes visible label/type/amount/endpoint controls, accepts Beneficiary transfer + $250,000, reroutes, and deletes/undoes cleanly.

**Step 2: Surface every real posting**

For current-dated nonzero connectors, either render the connector or render a specific disclosed posting row tied to the same semantic record. Do not keep financially active `visible: false` postings without a disclosure surface. Make inventory and presentation consume the same posting set.

**Step 3: Enforce sleeve conservation**

Derive parent balance from sleeve sum plus explicit unallocated remainder for built-in templates. Preserve legacy parent fields read-only until migration coverage passes. Render an `Unallocated` row when nonzero; do not silently clamp away money.

**Step 4: Unify annuity labels and preview projection**

Give contract value, premium/source debit, monthly payout, flexible draw, and inventory balance distinct labels backed by one model. During slider `input`, compute a noncommitted projected document/view model and update every dependent surface; on `change`, commit that projection once.

**Step 5: Separate connector geometry from semantic identity**

Add durable semantic attachment fields (for example `semanticSourceId` and `semanticTargetId`, with compatibility fallback from attached endpoints). Detach changes only drawn endpoints and preserves those semantic IDs. Reattach restores/snap-updates drawn endpoints without duplicating the posting. Compute, inventory, and presentation resolve postings from semantic identity, never free endpoint coordinates.

Fix the user-origin inspector command path, and render immediate type/amount/label/source/target controls for a newly drawn connector before dismissal.

**Step 6: Verify and commit**

Run:

```powershell
npx playwright test tests/e2e/remediation-ledger-truth.spec.js --project=chromium-1440
npx playwright test tests/e2e/drag-invariants.spec.js tests/e2e/financial-semantics.spec.js tests/e2e/remediation-display.spec.js tests/e2e/portfolio-release.spec.js --project=chromium-1440
git diff --check
git add src tests docs/audits/2026-07-14-money-map-remediation-receipts.md
git commit -m "fix: reconcile ledger and rendered financial truth"
```

---

### Task 4: RMD arithmetic and licensed wording checkpoint

**Owner checkpoint — stop before product edits.**

Present the exact proposed visible copy and arithmetic contract to Cyril. Default proposal:

- title/story language: illustrative gross IRA distribution, not an IRS-calculated required minimum distribution;
- `$6,000/mo` distribution = `$72,000` annual gross;
- 30% withholding = `$21,600`;
- spendable coverage = `$50,400/year` = `$4,200/mo`;
- QCD = `$20,000`;
- IRA reduction = `$92,000`;
- disclosure states the app does not determine an individual's statutory RMD or QCD eligibility;
- README uses the same distinction.

Do not continue until the owner approves or edits this copy/math choice.

**Files:**
- Create: `tests/e2e/remediation-rmd-truth.spec.js`
- Modify: `src/compute.js`, `src/templates.js`, `src/render.js`, `README.md`

**Step 1: Write the failing rendered RMD journey**

From the catalog, use visible controls to enter the exact fixture above. Assert within $1 on connector labels, cards, captions, banner, inspector, inventory, and presentation. Delete QCD, undo, redo, and restore. Assert the approved disclosure and terminology remain visible in presentation.

**Step 2: Implement one journal**

Create exactly two independent IRA reductions: gross distribution `72,000` and QCD `20,000`. Withholding is a split of gross, not another IRA debit. Spendable coverage is gross minus withholding. All surfaces read this journal.

**Step 3: Update approved copy and README**

Replace contradictory claims such as “performs no tax calculation” with the approved narrow statement: illustrative withholding arithmetic is shown, but statutory RMD and eligibility are not determined.

**Step 4: Verify and commit**

Run:

```powershell
npx playwright test tests/e2e/remediation-rmd-truth.spec.js --project=chromium-1440
npx playwright test tests/e2e/financial-semantics.spec.js tests/e2e/domain-invariants.spec.js --project=chromium-1440
git diff --check
git add src tests README.md docs/audits/2026-07-14-money-map-remediation-receipts.md
git commit -m "fix: make illustrative distribution math honest"
```

---

### Task 5: Preserve the complete session across the responsive gate and remove pointer-up stalls

**Files:**
- Create: `tests/e2e/remediation-persistence-performance.spec.js`
- Modify: `index.html`, `src/state.js`, `src/main.js`, `src/interaction.js`, `src/layoutQuality.js`

**Step 1: Write failing persistence journey**

Through visible controls, modify money, add/delete/duplicate objects and connectors, change geometry/theme/view/zoom, create history, and start from a nondefault template. Cross wide → narrow (<1060) → wide. Assert the same document, selection-safe state, theme/view/viewport, and undo/redo timeline return without a reset or reload loss. Use sessionStorage only as observable browser storage, not a mutation shortcut.

**Step 2: Define a versioned document envelope**

In `src/state.js`, export serialization/hydration for:

- schema version;
- items, groups, finance data, connectors, scenario, template identity/layout;
- theme, view mode, viewport;
- history past/future;
- enough selection/meeting state to restore safely, excluding transient drag/hover/focus data.

Validate shape/version before hydration and fall back safely with an explicit message on invalid data.

**Step 3: Persist before gate reload and hydrate after return**

Keep the deliberate 1060px gate. Before the media-query reload, synchronously store the envelope. On wide boot, hydrate it before default template/start-screen initialization; clear only after successful restoration. Do not reload for ordinary resize events that remain on the same side.

**Step 4: Write and pass the isolated pointer-up performance test**

On `Estate / Trust Transfer`, profile final pointer-up repair separately. Assert no long task ≥50ms. Replace full-document duplicate geometry scans with a localized affected-set repair and one final render; retain collision/disclosure protection and route validity.

**Step 5: Verify and commit**

Run:

```powershell
npx playwright test tests/e2e/remediation-persistence-performance.spec.js --project=chromium-1440
npx playwright test tests/e2e/narrow-screen.spec.js tests/e2e/drag-performance.spec.js tests/e2e/layout-governor.spec.js --project=chromium-1440
git diff --check
git add index.html src tests docs/audits/2026-07-14-money-map-remediation-receipts.md
git commit -m "fix: preserve sessions across responsive transitions"
```

---

### Task 6: Release journeys, visual review, and final evidence

**Files:**
- Create: `tests/e2e/remediation-release-journeys.spec.js`
- Modify only if tests prove a defect: `src/render.js`, `src/interaction.js`, `src/compute.js`, `styles.css`
- Modify after owner approval only: `tests/e2e/visual.spec.js-snapshots/*`
- Update: `docs/audits/2026-07-14-money-map-remediation-receipts.md`

**Step 1: Encode all four visible-control release journeys**

Implement the complete Retirement Paycheck, RMD/Charitable, Annuity Income Floor, and Estate/Trust flows from the approved audit. Every financial checkpoint uses the independent oracle and rendered DOM. Every destructive/committed action receives exactly one undo assertion. Capture console, page-error, failed-request, orphan-connector, NaN/Infinity, disclosure, presentation-affordance, and hitch evidence.

**Step 2: Run breadth and viewport/theme gates**

Run all 16 templates at 1440 editor/presentation and the four deep templates at 1920, 1440, 1366, 1280, 1060, 1024, 900, and 390, plus browser zoom 90%/110%. Run all three themes for Retirement Paycheck.

**Step 3: Run the complete nonvisual release gate**

```powershell
npx playwright test --project=chromium-1366 --project=chromium-1440 --project=chromium-1920 --project=chromium-390-gate
npm run audit:layout:strict
```

Expected: four journeys complete, all 16 templates pass, zero Critical/High, exact financial differences ≤$1, one undo per command, responsive history preserved, disclosure retained, presentation noneditable/no affordances, zero page/console/failed-request/NaN/orphan failures, and Estate pointer-up <50ms.

**Step 4: Review visual diffs before any update**

Run:

```powershell
npm run test:visual
```

Create a diff-by-diff ledger of every baseline failure with expected source change and visual inspection result.

**Owner checkpoint — stop before snapshot recapture.**

Ask Cyril whether the reviewed diffs should be accepted now. Do not run `test:visual:update` without approval.

**Step 5: If approved, update and verify visual baselines**

```powershell
npm run test:visual:update
npm run test:visual
```

Expected: zero visual-baseline failures after the approved recapture.

**Step 6: Final verification and final stage commit**

Run fresh:

```powershell
node --test tests/audit/server.test.js
npx playwright test --project=chromium-1366 --project=chromium-1440 --project=chromium-1920 --project=chromium-390-gate
npm run test:visual
npm run audit:layout:strict
git diff --check
git status --short
```

Update receipts with exact commands, durations, counts, errors, and artifact references. Then commit only reviewed files:

```powershell
git add src index.html styles.css README.md package.json playwright.config.js tests docs
git diff --cached --check
git commit -m "test: prove money map release contracts"
git show --stat --oneline HEAD
git status --short --branch
```

Do not merge or push. Hand off the branch and commit sequence for independent verification.
