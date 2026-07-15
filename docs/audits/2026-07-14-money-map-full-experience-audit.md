# Money Map full-experience audit

**Audit date:** 2026-07-14<br>
**Audited commit:** `0fb1840e820a59016b16e6b58f9ca807062ba06c` (`origin/main`)<br>
**Audience:** an advisor operating Money Map live with a client<br>
**Method:** one auditor; synthetic data; visible UI actions; test API used only for observation<br>
**Status:** **NO-GO for portfolio demo and NO-GO for paying-client production**

This report supersedes, but does not overwrite, `C:\Users\Cyril\money-map-audit-20260714-01\REPORT.md`. It evaluates the current commit rather than assuming that a passing automated suite closes the earlier findings.

## Executive verdict

Money Map is visually coherent and its generic journal arithmetic is substantially stronger than the prior audit suggested: 1,439 functional checks passed, the strict layout sweep reported no findings, all 16 templates opened through the catalog, presentation retained disclosures, and an independent oracle reconciled the ordinary templates within $1. The Annuity Income Floor controls also reconciled correctly through their committed states.

The product nevertheless fails the stated portfolio-demo boundary. Six High findings were reproduced twice: RMD withholding is counted as both a reduction of spendable income and a second IRA debit; crossing below 1060 px reloads and destroys the document and history; Estate pointer-up repair blocks for 1.11–1.15 seconds; keyboard users cannot reach the meeting controls; visible connector inspector actions do not detach or expose the newly created flow for classification; and Reset scenario discards the document history and cannot be undone. Presentation also reveals connector edge handles on hover, and all 18 checked-in visual baselines fail.

No Critical issue was found. That is not a release recommendation: the findings directly violate seven of the nine portfolio-demo acceptance conditions. Money Map is suitable only as a controlled synthetic prototype after the presenter avoids the affected paths. It is not ready for an unscripted portfolio demo or any paying-client meeting.

## Scope, receipts, and evidence handling

The audit ran from 19:40 to 20:45 CDT (65 minutes). A disposable copy on port 54217 held traces, video, screenshots, logs, and a standalone oracle. It imported no production compute, selector, or renderer code. Port 4173 was already occupied and was not used or terminated. All evidence artifacts were temporary and were deleted after this report was verified; their names below are stable receipt references, not repository additions.

| Receipt | Result | Duration / count |
|---|---|---:|
| Four-project Playwright gate | PASS | 1,439 passed, 0 failed; 861.093 s |
| Initial Playwright attempt | harness setup failure before collection (`@playwright/test` absent in disposable copy) | 2.470 s |
| `npm run test:visual` (no update) | FAIL | 0 passed, 18 failed; 57.325 s |
| `npm run audit:layout:strict` wrapper | harness failure: Windows `spawn EINVAL` at `tests/audit/server.js:27` | 0.806 s |
| Strict layout engine against separately started audit server | PASS, “No layout stress findings” | 210.564 s |
| Headed composite client run | 68 visible-control steps; 9 initial harness misses, all material misses retested in focused runs | 6.0 min |
| Focused adversarial runs | two complete independent repetitions for every High finding | 2 result ledgers |
| Template matrix | 16 editor + 16 presentation states; deep-template viewport sweep | 23 recorded matrix rows plus focused RMD row |

The 18 visual failures were stable, approximately 1% each. Differing-pixel counts were 929, 987, 1,023, 4,755, 5,062, 5,143, 5,623, 5,675, 5,840, 5,986, 6,178, 6,186, 6,342, 6,366, 6,720, 6,742, 6,891, and 6,919. No snapshot was updated.

The in-app browser collector could not start because the Windows sandbox failed with `SetTokenInformation(TokenDefaultDacl) failed: 1344`. The run therefore used headed standalone Chromium with Playwright trace, video, console, page-error, failed-request, long-task, geometry, and state observers. Actions remained visible-control actions. One unattributed 404 console message appeared per fresh context, but no corresponding HTTP response of 400 or greater was captured. Two `net::ERR_ABORTED` navigation records were caused by the intentional responsive reload probes.

## Journey scorecards

| Journey | Visible-control result | Financial result | Mechanical / presentation result | Verdict |
|---|---|---|---|---|
| Retirement Paycheck Stack | Need changed $7,800→$8,500; draw changed $4,000→$5,000; inventory, themes, current/proposed, undo/redo, and presentation exercised | Committed state reconciled: mapped $9,800/mo, gap +$1,300/mo, portfolio $860,000, inventory $1,040,000. Input preview left mapped/gap stale until commit | Detach button was a no-op in two runs; crossing 390 and 900 px destroyed the running document | **Blocked** |
| RMD + Tax Withholding Flow | Distribution $6,000/mo, withholding 30%, QCD $20,000 entered through meeting rail/inspector | App showed $6,000/mo spendable and debited IRA $113,600; oracle showed $4,200/mo spendable and $92,000 debit | Delete was initially suppressed by slider focus; Fit then Delete/undo/redo worked. Presentation retained disclosure and terminology | **Blocked / financially misleading** |
| Annuity Income Floor | Premium $250,000, payout $2,200/mo, flexible draw $3,500/mo; annuity toggled off/on | Final mapped $5,700/mo and inventory $1,058,000 reconciled; off state mapped $3,500/mo; undo/redo restored both | Drag, endpoint movement, Escape cancellation, theme/current/proposed, and presentation completed; generic presentation-handle defect remains | **Conditional pass** |
| Estate / Trust Transfer | Trust drag/cancel, resize/nudge, multi-select/alignment, connector creation, delete/undo, and presentation exercised | Geometry did not mutate financial values in observed snapshots | New IRA→Beneficiaries connector was created and snapped, but visible inspector editing could not classify/set $250,000; pointer-up froze >1 s; edge handles appeared in presentation | **Blocked** |

“First attempt” usability was poor in the same places that produced the findings: meeting controls required discovering an unlabelled hover rail; connector endpoint controls either did nothing or could not be reached; deleting after a slider edit silently did nothing; and responsive loss required a complete restart. These are hitches under the audit definition, not cosmetic recovery actions.

## Sixteen-template matrix

All templates were selected through the catalog. Editor and presentation were inspected at 1440×900. The four deep templates were also crossed through 1920, 1440, 1366, 1280, 1060, 1024, 900, and 390 px; 90% and 110% browser zoom were sampled. Retirement Paycheck was inspected in all three themes in editor and presentation.

| Template | Need / mapped / gap per month | Inventory | Items / flows | Editor + presentation result |
|---|---:|---:|---:|---|
| retirement | $7,500 / $5,800 / −$1,700 | $1,592,000 | 9 / 6 | PASS |
| roth | $7,500 / $0 / −$7,500 | $1,855,000 | 10 / 4 | PASS, except trust sleeve semantics (F-08) |
| annuity | $6,400 / $1,800 / −$4,600 | $995,000 | 6 / 3 | PASS |
| estate | $7,500 / $0 / −$7,500 | $2,790,000 | 10 / 5 | Visual smoke PASS; deep mechanics blocked |
| cashReserve | $7,000 / $4,000 / −$3,000 | $1,512,000 | 7 / 4 | PASS |
| retirementPaycheck | $7,800 / $8,800 / +$1,000 | $1,052,000 | 7 / 4 | Visual smoke PASS; deep mechanics blocked |
| socialSecurityBridge | $7,200 / $5,500 / −$1,700 | $1,544,000 | 7 / 4 | PASS |
| bucketStrategy | $6,900 / $6,000 / −$900 | $1,136,000 | 7 / 4 | PASS |
| rmdTax | $6,500 / $4,000 / −$2,500 | $1,327,000 | 7 / 4 | Visual smoke PASS; oracle fails after edits |
| withdrawalSequencing | $7,200 / $4,500 / −$2,700 | $1,725,000 | 7 / 4 | PASS |
| cashCleanup | $5,000 / $5,000 / $0 | $500,000 | 7 / 4 | PASS |
| annuityIncomeFloor | $6,800 / $5,500 / −$1,300 | $1,064,000 | 6 / 3 | PASS baseline and committed deep controls |
| executiveComp | $12,500 / $7,500 / −$5,000 | $840,000 | 7 / 4 | PASS |
| businessOwner | $14,500 / $10,000 / −$4,500 | $1,380,000 | 7 / 4 | PASS |
| survivorIncome | $7,200 / $6,500 / −$700 | $1,098,000 | 7 / 4 | PASS |
| blankHousehold | $7,500 / $0 / −$7,500 | $0 | 4 / 0 | PASS |

For the 15 ordinary baseline rows, the independent journal oracle found zero mapped-cashflow, balance, or inventory differences greater than $1. Every presentation retained one disclosure and exposed zero visible form inputs. No NaN or Infinity was found. The strict 15-template × 3-theme × 3-viewport layout audit reported no layout findings. The focused RMD presentation completed after the composite harness initially missed its hover-only controls.

At 1024, 900, and 390 px the editor is replaced by a narrow-screen gate. At 1060 px and above it returns. That breakpoint itself is a documented constraint; the finding is that crossing it performs a hard reload and destroys the active state.

Accessibility sampling found nonempty accessible names on 42 interactive controls. The raw computed foreground/background ratios ranged from 1.01:1 to 19.45:1, but the low samples sat on translucent or gradient layers, so those uncomposited pairs are not valid final-pixel WCAG measurements and were not promoted as findings. A release check should composite rendered pixels and require 4.5:1 for normal text and 3:1 for large text and control boundaries. With `prefers-reduced-motion: reduce`, the representative drag completed without financial mutation; its 1,173 ms whole-script duration included settling waits and is not used as isolated latency evidence.

## Findings

### F-01 — RMD withholding is double-debited and spendable coverage is overstated — High

**Lens / journey:** financial truth; RMD + Tax Withholding Flow.<br>
**Reproduction:** through the visible Meeting rail set distribution to $6,000/mo and withholding to 30%; select QCD and enter $20,000; blur to commit; compare the paycheck, connectors, IRA card, inventory, and presentation. Repeated in two fresh documents.<br>
**Expected:** gross distribution $72,000/year; withholding $21,600/year; spendable coverage $50,400/year ($4,200/mo); QCD $20,000/year; IRA reduction $92,000.<br>
**Observed:** the paycheck maps $6,000/mo as spendable. IRA falls from $980,000 to $866,400, a $113,600 reduction: gross $72,000 + withholding $21,600 + QCD $20,000. The exact error is +$1,800/mo mapped and +$21,600 IRA reduction.<br>
**Evidence:** `focus-results-run1.json`, `focus-results-run2.json`, `focus-rmd-edited.png`, `oracle-corrected.json`; raw state and DOM agreed with the measured app values.<br>
**Root cause:** `src/compute.js:221-230` treats the scenario distribution as “spendable” while separately calculating withholding from the same amount; the template posts both at `src/templates.js:219-221`. `README.md:49` additionally claims the app performs no tax calculation.<br>
**Missing-system classification:** **not found** — no independent gross→withholding→net invariant exists in the release gate.<br>
**Remediation contract:** define the slider as either gross or net, never both; journal one gross IRA debit, split it into withholding and spendable destinations, add QCD once, and label the UI precisely. Acceptance: for 6,000/30%/20,000 every financial surface and presentation must show $72,000 gross, $21,600 withholding, $50,400 spendable, $20,000 QCD, $92,000 IRA reduction, within $1.

### F-02 — Responsive crossing reloads and loses the document and history — High

**Lens / journey:** responsive integrity; Retirement Paycheck.<br>
**Reproduction:** edit draw to $9,876, resize 1440→390→1440. Repeat in a fresh document with $9,123 and 1440→900→1440.<br>
**Expected:** a responsive gate may cover the editor, but returning must restore the same document, values, selection, and undo history.<br>
**Observed:** both runs returned to the catalog/start screen with no active template, items, or history.<br>
**Evidence:** two raw-state ledgers in `focus-results-run1.json` and `focus-results-run2.json`; responsive video/trace in `live-audit-trace.zip`.<br>
**Root cause:** `index.html:212-221` listens to the 1060 px media query and calls `window.location.reload()` on every crossing.<br>
**Missing-system classification:** **not found** — narrow-screen tests validate the gate, not round-trip state preservation.<br>
**Remediation contract:** render the gate without navigation/reload and preserve the in-memory document. Acceptance: cross 1440→390→1440 during a drag and after a committed financial edit; state and history snapshots must be byte-equivalent and undo must revert the edit.

### F-03 — Estate pointer-up repair visibly freezes for more than one second — High

**Lens / journey:** performance/mechanics; Estate.<br>
**Reproduction:** drag Revocable Trust through 12 pointer moves and time only the final pointer-up through settled rendering. Repeat in a fresh document.<br>
**Expected:** pointer-up <50 ms, with repair deferred or bounded.<br>
**Observed:** 1,146 ms and 1,110 ms. The prior report measured 2,403 ms, so the path improved but remains a visible freeze and is 22× the acceptance budget.<br>
**Evidence:** focused timing ledgers and `live-audit-trace.zip`.<br>
**Root cause:** `src/interaction.js:2092-2264` performs placement, history commit, presentation repair, reconciliation, and rendering synchronously; `src/layoutQuality.js:577-625` scans layout and recomputes connector paths during repair.<br>
**Missing-system classification:** **present but insufficient** — drag performance coverage does not gate the isolated final pointer-up budget on this template.<br>
**Remediation contract:** make pointer-up commit bounded and move full-layout repair off the interaction frame. Acceptance: p95 and max <50 ms over 20 Estate trust drops on the release machine, with identical repaired geometry and history.

### F-04 — Keyboard users cannot reach the meeting controls — High

**Lens / journey:** accessibility; Retirement Paycheck keyboard-only journey.<br>
**Reproduction:** from a fresh load, Tab to the Retirement Paycheck catalog card and press Enter; continue Tab for 160 post-entry focus moves. Repeat.<br>
**Expected:** a labelled, visibly focused control opens the Meeting panel and its tabs/ranges are reachable in logical order.<br>
**Observed:** catalog entry succeeded, as did Ctrl+P and Escape, but no focus step reached `[data-meeting-tab="controls"]`; Need remained $7,800 and draw $4,000. Both runs were identical.<br>
**Evidence:** `focus-results-run1.json` and `focus-results-run2.json` contain 177 total focus steps per run and the unchanged values.<br>
**Root cause:** `.scenario-rail` is a 14 px hover target at `styles.css:4116-4140`; its children are `visibility:hidden` at `styles.css:4178-4188` until hover or focus-within, while the rail itself is not a keyboard entry point.<br>
**Missing-system classification:** **not found** — no full keyboard journey reaches and changes scenario controls.<br>
**Remediation contract:** provide a real button with name, expanded state, focus management, and Escape restoration. Acceptance: keyboard-only entry changes Need and draw, operates inventory and presentation, and returns focus to the opener without mouse or scripted focus.

### F-05 — Visible connector inspector controls do not complete detach/edit workflows — High

**Lens / journeys:** interaction integrity; Retirement Paycheck and Estate.<br>
**Reproduction A:** click the Portfolio Draw label to select it, open its visible inspector, click Detach. Repeat in a fresh document. **Observed:** both endpoints remain attached (`portfolio/right.out`→`paycheck/bottom.gap`), amount remains $60,000, mapped remains $9,800, and the button still says Detach.<br>
**Reproduction B:** create Retirement IRA→Heirs/Beneficiaries through visible edge handles. The connector is created and snaps correctly, but its visible inspector does not expose an operable label/type/amount path, so it cannot be classified as beneficiary transfer or set to $250,000.<br>
**Expected:** Detach changes only geometry, Reattach restores topology, and a newly created flow is immediately editable through visible controls.<br>
**Evidence:** two focused detach ledgers plus headed Estate trace/video. The created connector was `connector-1`, `smartArc`, with attached retirementAccount and beneficiaries endpoints.<br>
**Root cause locus:** dispatch and action exposure are at `src/main.js:860-940`, `src/main.js:1483`, and `src/render.js:2025-2026`; endpoint mutation is implemented at `src/interaction.js:973-984`. The audit localizes the break to the UI-origin inspector action path but does not claim a narrower mechanism without evidence.<br>
**Missing-system classification:** **not found** — tests assert inspector action visibility, not successful canvas-origin click effects and immediate editing of a newly drawn connector.<br>
**Remediation contract:** make inspector action dispatch selection-stable and add an explicit post-create editor. Acceptance: real clicks detach, preserve every dollar, offer Reattach, restore endpoints, then create/classify/set/reroute/delete a $250,000 beneficiary flow with one undo per commit.

### F-06 — Reset scenario is destructive and cannot be undone — High

**Lens / journeys:** history/data recovery; Retirement Paycheck.<br>
**Reproduction:** edit draw to $6,250, click Reset scenario, press Ctrl+Z; repeat with $6,500.<br>
**Expected:** Reset is one committed history operation, so one undo restores the complete prior document.<br>
**Observed:** Reset returns draw to $4,000 and Ctrl+Z leaves it at $4,000 in both runs.<br>
**Evidence:** two focused state ledgers.<br>
**Root cause:** Reset calls `loadTemplate` at `src/main.js:221-223`; template loading clears history at `src/main.js:179-217`, backed by `src/state.js:362-364`.<br>
**Missing-system classification:** **not found** — no release test requires undo after Reset.<br>
**Remediation contract:** snapshot before reset, replace the document without clearing history, and expose a confirmation or undo toast. Acceptance: one Ctrl+Z restores values, geometry, topology, selection, and view after Reset; Ctrl+Y reapplies it.

### F-07 — Scenario and connector previews tell contradictory financial stories — Medium

**Lens / journeys:** transient financial feedback; Retirement Paycheck and RMD.<br>
**Reproduction:** type $5,000 into Portfolio Draw and inspect during `input`; separately type QCD $20,000 and inspect before blur.<br>
**Expected:** all dependent surfaces either preview atomically or clearly remain in an uncommitted state.<br>
**Observed:** connector/field amounts change immediately while mapped cashflow, gap, or IRA remain stale until commit. In RMD, QCD preview showed $20,000 while IRA remained $871,400, then changed to $866,400 on commit.<br>
**Evidence:** composite step snapshots and focused RMD ledger.<br>
**Root cause:** preview and committed scenario paths update different portions of derived state; scenario linkage begins at `src/compute.js:221-239`.<br>
**Missing-system classification:** **present but insufficient** — reactivity tests do not assert cross-surface atomicity during native input events.<br>
**Remediation contract:** use one preview journal for every visible surface or label the state “pending.” Acceptance: sample every animation frame during input and assert all displayed values reconcile within $1.

### F-08 — Trust sleeves are labels, not subledgers — Medium

**Lens / templates:** financial semantics; Roth and Estate.<br>
**Reproduction:** open inventory and compare parent trust value with displayed sleeves.<br>
**Expected:** sleeve totals reconcile to the parent, with a nonnegative unallocated remainder.<br>
**Observed:** Roth familyTrust parent is $0 while sleeves total $840,000; Estate revocableTrust parent is $0 while sleeves total $720,000, producing remainders of −$840,000 and −$720,000. Ordinary inventory totals still reconcile only because compute ignores sleeve values.<br>
**Evidence:** `oracle-corrected.json` and template matrix snapshots.<br>
**Root cause:** templates store `subBuckets` (`src/templates.js:897-900`, `src/templates.js:961-962`) and render them (`src/render.js:321-327`), but the journal/inventory path does not treat them as child balances.<br>
**Missing-system classification:** **not found** — no parent=sleeves+unallocated invariant.<br>
**Remediation contract:** either make sleeves nonfinancial percentages/labels or journal them as children. Acceptance: parent equals sleeves plus unallocated within $1 in cards, inventory, and presentation.

### F-09 — Delete silently fails after scenario-slider use — Medium

**Lens / journey:** keyboard interaction; RMD.<br>
**Reproduction:** use a range control, click the QCD connector label, press Delete; then click visible Fit and press Delete.<br>
**Expected:** canvas selection activation transfers command focus or Delete gives an explicit reason it is unavailable.<br>
**Observed:** with the range still focused, Delete leaves four connectors and QCD $20,000. After Fit receives focus, Delete removes QCD; Ctrl+Z/Y correctly restores/removes it.<br>
**Evidence:** focused state/active-element ledger.<br>
**Root cause:** `src/main.js:1719-1724` combines event target and active element; `src/state.js:539-540` classifies range inputs as form fields, suppressing non-text canvas commands even after pointer selection.<br>
**Missing-system classification:** **not found** — no pointer-selection-after-slider keyboard test.<br>
**Remediation contract:** move focus to an appropriate canvas command target on selection or scope Delete to the event target. Acceptance: select a connector after any control edit and Delete/Backspace both work once, with one-step undo.

### F-10 — Presentation reveals editor edge handles on hover — Medium

**Lens / journey:** presentation lockdown; Estate.<br>
**Reproduction:** enter presentation, hover Revocable Trust.<br>
**Expected:** no editor affordance or editable hit target is visible.<br>
**Observed:** `.item-edge-handles` becomes `display:block`, `visibility:visible`, opacity 0.68. State mutation remained guarded and there were zero visible inputs, but the editor affordance is visibly present.<br>
**Evidence:** `focus-estate-presentation-hover.png` and computed-style ledger.<br>
**Root cause:** handles render at `src/render.js:688-696`; hover reveals them at `styles.css:1791-1811`; the presentation hide list at `styles.css:4589-4596` omits `.item-edge-handles`.<br>
**Missing-system classification:** **present but insufficient** — lockdown tests assert mutation and common controls, not hover-computed visibility for every editor affordance.<br>
**Remediation contract:** do not render edge handles in presentation or hide/disable them comprehensively. Acceptance: scan every editor affordance before/after hover/focus and assert hidden plus `pointer-events:none`.

### F-11 — Checked-in visual truth is entirely red — Medium

**Lens:** release truth / visual regression.<br>
**Reproduction:** run `npm run test:visual` without update.<br>
**Expected:** committed release imagery matches the current release candidate or has an approved, reviewed baseline change.<br>
**Observed:** 18 of 18 screenshots fail, each stably around 1% difference.<br>
**Evidence:** `gate-visual.log` and 18 temporary actual/diff/expected folders; exact pixel counts are listed above.<br>
**Root cause locus:** current UI and checked-in snapshots are out of sync; this audit intentionally did not update them.<br>
**Missing-system classification:** **present and failing**.<br>
**Remediation contract:** review the diffs as product changes, fix unintended changes, and update only approved baselines in a separate change. Acceptance: 18/18 pass twice on the release runner.

### F-12 — Audit server wrapper cannot start on this Windows environment — Minor

**Lens:** release infrastructure.<br>
**Reproduction:** run `npm run audit:layout:strict`.<br>
**Expected:** wrapper starts its server and executes the audit.<br>
**Observed:** `spawn EINVAL` at `tests/audit/server.js:27`. Starting the same isolated server separately and running the inspector passed in 210.564 s.<br>
**Evidence:** `gate-layout-strict.log` and `gate-layout-strict-manual.log`.<br>
**Root cause locus:** Windows child-process startup in `tests/audit/server.js:27`; no product layout defect was inferred.<br>
**Missing-system classification:** **present but platform-broken**.<br>
**Remediation contract:** make server startup Windows-safe and preserve child PID cleanup. Acceptance: the exact npm command exits 0 twice and leaves its port closed.

## Prior C1–C10 / P1–P6 disposition

| Prior ID | Current disposition | Evidence |
|---|---|---|
| C1 invalid hybrid flow semantics | **Open** | Generic baseline arithmetic passes, but the model still allows scenario key, flow type, domain role, and target effect to diverge; F-01 is the consequential example. |
| C2 detach changes money/global state | **Partially mitigated, not closed** | Monetary invariance code exists, but visible Detach is now a no-op in the tested UI path (F-05), so the required journey still cannot complete. |
| C3 hidden postings affect balances | **Open** | Ordinary oracle reconciliation confirms implementation consistency, not that hidden current/future postings are client-legible. No new control exposes the journal. |
| C4 sleeves are not subledgers | **Open, reconfirmed** | F-08: −$840,000 and −$720,000 parent remainders. |
| C5 special cards disagree with inventory | **Improved / conditionally closed** | Focused annuity premium, payout, draw, source debit, and inventory reconciled within $1. Keep covered while F-08 remains. |
| C6 RMD arithmetic | **Open, High** | F-01 reproduced twice with exact $21,600 double debit. |
| C7 Reset to linked has no reset semantics | **Open** | `scenarioAmountForConnector` still falls back to current connector amount for unsupported links (`src/compute.js:236-239`); deep Detach/Reattach was blocked by F-05. |
| C8 split preview model | **Open** | F-07 reproduced in Retirement Paycheck and RMD. |
| C9 Align Left aligns centers | **Open** | `src/main.js:813-821` assigns the minimum center x, not the minimum left bound (`x - w/2`). |
| C10 rounded parts contradict total | **Improved, not fully falsified** | Current focused inventory headers reconciled, but compact-rounded component-to-total additivity is not release-gated. |
| P1 responsive reload/session loss | **Open, High** | F-02 reproduced twice. |
| P2 Reset scenario irreversible | **Open, High** | F-06 reproduced twice. |
| P3 2.4 s pointer-up | **Improved but Open, High** | 1.146 s / 1.110 s; still far above 50 ms (F-03). |
| P4 README inaccurately denies tax calculation | **Open** | `README.md:49` conflicts with `src/compute.js:223-225` and visible withholding output. |
| P5 dead HUD capacity/edit-parts controls | **Open / not exercised as a core flow** | No evidence in this run closed the earlier source-backed finding. |
| P6 stale images and counts | **Open** | 18/18 visual baselines fail (F-11). |

## Positive controls and falsified suspicions

- The four-project gate genuinely passed: 1,439/1,439, including 390 px gate coverage.
- The strict layout engine found no issues across 15 templates, three themes, and three viewports when run against an already-started server.
- For 15 ordinary template baselines, the independent oracle found no >$1 difference in mapped cashflow, balances, or inventory.
- Annuity Income Floor committed controls reconciled: premium $250,000, payout $2,200/mo, flexible draw $3,500/mo, mapped $5,700/mo, inventory $1,058,000; toggling off mapped $3,500 and undo/redo restored states.
- Presentation retained disclosure text and exposed zero visible inputs in all 16 templates. Ctrl+P and Escape worked. The mutation lockdown held despite F-10’s visible handles.
- QCD deletion was reversible once command focus was moved away from the slider: delete, undo, redo, and undo produced the expected connector and IRA states.
- No geometry or navigation action, other than the explicit responsive reload, was observed to mutate financial amounts.
- No NaN, Infinity, page error, or attributable failed resource response appeared. The two aborted requests were expected navigation cancellation.
- Current/proposed switching, theme switching, inventory navigation, fit/zoom, ordinary pan, and reduced-motion samples did not produce a financial discrepancy.
- The broad visual/layout quality was not the primary blocker; the failures are interaction, financial meaning, accessibility, recovery, and release truth.

## Root-cause groups

1. **Scenario semantics are distributed rather than journal-led.** Flow role, scenario key, cadence, and destination effects can each contribute money independently, producing F-01, F-07, and the unresolved C1/C7 family.
2. **State lifecycle is coupled to navigation/template initialization.** Hard reload on breakpoint and history clearing on Reset cause F-02 and F-06.
3. **Interaction completion does too much synchronously.** Layout detection, route recomputation, reconciliation, and render on pointer-up cause F-03.
4. **Discoverability and focus are hover-first.** The Meeting rail and retained form focus cause F-04 and F-09.
5. **Inspector rendering, selection, and command dispatch are not tested end-to-end through user-origin clicks.** This produces F-05 despite action functions existing.
6. **Editor/presentation DOM is shared with incomplete affordance suppression.** This produces F-10.
7. **Display-only financial decoration is mixed with ledger data.** Trust sleeves look monetary but are excluded from the inventory journal (F-08).
8. **Release gates disagree about truth.** Functional tests are green while visual baselines are wholly red and the strict audit wrapper is platform-broken (F-11/F-12).

## Ranked remediation sequence

1. Correct the RMD gross/net/QCD journal and add the independent invariant from F-01. Do not demo RMD until it passes.
2. Remove responsive reload and make Reset a reversible document operation; add round-trip state/history tests.
3. Repair the real connector inspector path and cover detach/reattach plus new-connector classification with visible clicks.
4. Move Estate layout repair out of pointer-up and enforce a <50 ms release budget.
5. Replace the hover-only Meeting rail with a keyboard-operable disclosure pattern and repair command focus after form controls.
6. Unify transient preview computation so every financial surface tells one story per frame.
7. Decide whether sleeves are financial; then enforce parent reconciliation or remove dollar implications.
8. Eliminate presentation edge handles, reconcile README claims, make the Windows audit wrapper reliable, and review/approve visual baselines.

## Production boundary and release acceptance

**Synthetic controlled prototype:** acceptable only if the presenter uses a preselected non-RMD template, stays above 1060 px, avoids Reset and connector editing, does not rely on keyboard access, and accepts a possible >1 s Estate pause. That constraint set is too narrow for the requested portfolio-demo readiness.

**Portfolio demo:** **NO-GO.** All four journeys did not complete through visible controls; Critical/High count is six; Reset and responsive crossings do not preserve history; RMD surfaces differ from the oracle by more than $1; presentation exposes an editor affordance; and Estate pointer-up is ≥1,110 ms.

**Paying-client production:** **NO-GO.** In addition to all demo blockers, the product has contradictory tax-language boundaries, display-only sleeves that resemble balances, keyboard-inaccessible core controls, and no durable document/session boundary across responsive changes.

Release may be reconsidered only when:

- all four visible-control journeys complete without reload, test shortcuts, or recovery hitches;
- all 16 templates pass editor and presentation smoke;
- Critical and High findings are zero;
- geometry/navigation never mutate financial state;
- every committed/destructive action has exactly one complete undo step;
- every financial surface reconciles to an independent oracle within $1, including RMD gross/net/QCD;
- breakpoint crossings preserve the running document and history;
- presentation is non-editable, retains disclosure, and exposes no editor affordance;
- console/page/request errors, NaN/Infinity, orphan flows, visual baseline failures, and Estate pointer-up tasks ≥50 ms are all zero.

Until those conditions are met on the release commit, green functional tests should be treated as necessary but not sufficient evidence.
