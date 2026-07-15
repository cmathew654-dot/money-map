# Money Map Remediation Verification Receipts

Date: 2026-07-14
Branch: `codex/money-map-approved-remediation-20260714`
Base: `0fb1840`
Audit cherry-pick: `1da8cd9` (source audit commit `5949a97`)
Canonical spec/plan: `6820a81`

## Environment isolation

All executable test, audit, Playwright, and development-server references on this branch use port 54217. Port 4173 was neither inspected nor stopped.

`npm ci`: completed in 3.5 seconds; 51 packages installed; npm reported one moderate dependency advisory.

The Windows audit-server smoke command successfully started `http://127.0.0.1:54217/index.html?test=1` using `process.execPath` and the local `http-server` entry point, then stopped its own child. The prior `spawn EINVAL` did not recur.

## Baseline constraints

The combined four-project Playwright baseline reached the approved 20-minute ceiling without emitting a final summary and was terminated. A subsequent isolated 1440 run was interrupted when the implementation was moved to a 45-minute hard cap. These runs are timing receipts, not pass/fail evidence.

`npm run audit:layout:strict` started successfully after the Windows spawn fix but exceeded a bounded 124-second run without emitting a summary. It was terminated, and only its branch-owned 54217 child was stopped. This closes the immediate EINVAL startup defect but does not claim a completed strict-layout pass.

The visual suite was not run or updated during the hard-capped implementation. No snapshot was recaptured without the required owner checkpoint.

## Red/green journey evidence

The new visible-control suite is `tests/e2e/remediation-critical-journeys.spec.js`. Financial assertions independently derive gross distribution, withholding, spendable coverage, QCD, IRA balance, mapped monthly cashflow, and connector/card/presentation values from observed raw records, then compare those results to rendered DOM. Raw-state assertions are limited to nonfinancial topology/semantic observations.

Initial red runs reproduced:

- scenario controls unreachable without the visible Controls-tab step;
- visible Detach remained a no-op after ordinary click delegation;
- connector flow-type chips were swallowed at the same inspector-rerender boundary;
- presentation disclosure selector mismatch in the new test;
- compact IRA card formatting required a separate representation assertion.

The user-origin root cause for Detach and connector classification was the inspector rerender replacing the clicked control between pointer-up and click. Endpoint commands and chip selections now commit on user pointer-up with the rendered connector/field identity.

Green receipts:

- Critical visible-control journeys: 4/4 passed in 7.9 seconds.
- Financial, responsive, Meeting, presentation, and undo regressions: 17/17 passed in 16.9 seconds.
- Critical journeys + financial semantics + isolated drag diagnostics: 15/15 passed in 18.8 seconds.
- Added Delete-after-slider-focus + amount-preserving flow transition journey: 1/1 passed in 4.3 seconds.
- Modified JavaScript modules and audit server: `node --check` passed.
- Windows audit-server start/stop smoke: passed.

The covered contracts include:

- exact illustrative RMD gross/withholding/spendable/QCD/IRA arithmetic on rendered editor and presentation surfaces;
- document and undo-history survival across a 1440 → 900 → 1440 responsive gate round-trip;
- a named keyboard-operable Meeting button, expanded state, Escape close, and focus return;
- presentation edge-handle display and pointer-event lockdown;
- visible Detach with invariant connector/card money and one-step topology undo;
- confirmed reversible scenario reset;
- Delete after a scenario range retains focus;
- amount-preserving atomic Income → RMD transition with scenario unlinking and one-step undo;
- removal of the redundant full-document pointer-up repair, with existing drag diagnostics green;
- actual-bound left/right/top/bottom alignment;
- corrected README scope language.

## Unproven final-gate work

This receipt does not claim the full approved release gate. The following remain explicitly unproven in this hard-capped pass:

- the complete four-project Playwright matrix;
- the complete strict layout sweep;
- all four full advisor journeys and all 16 templates in editor/presentation;
- the full viewport/theme/zoom matrix;
- diff-by-diff visual review and the owner-gated snapshot recapture;
- an independent measurement proving every Estate pointer-up task is below 50 ms;
- the broader C3/C4/C7/C8/P5/P6 remediation rows not exercised by the focused blocker implementation.

No merge or push occurred.
