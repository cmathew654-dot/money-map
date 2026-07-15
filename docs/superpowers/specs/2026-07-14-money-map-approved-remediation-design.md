# Money Map — Approved Remediation Implementation Spec

Version: 1.0 — 2026-07-14. Approved by Cyril (owner) via Claude (verifier/coordinator).
Base commit: `0fb1840` (origin/main). Implementer: Codex. Verifier: Claude runs the final
adversarial verification; Cyril does a short manual pass before any claim of completion.

This is the document referenced as "the approved remediation spec." Finding IDs are the C/P IDs
from `C:\Users\Cyril\money-map-audit-20260714-01\REPORT.md` (audit at d6200e0). Any F-numbered
addendum mapping is DEPRECATED — where an addendum conflicts with this spec, this spec wins.

## §1 Accepted corrections (from Codex's pre-implementation review)

1. Severity mapping errors in the addendum are acknowledged; this spec maps stages directly to
   C/P IDs and does not use F-numbers.
2. The detach-related behavioral transition (C2-adjacent) is NOT attributed to c52db99/0fb1840 —
   the detach dispatcher and implementation are unchanged since 35ab442 (src/main.js:939,
   src/interaction.js:973). Treat as observed behavior with unknown causation; the journey-level
   test requirement stands regardless of causation.
3. "Zero console errors" is restated precisely: the audit recorded one unattributed 404 console
   message; zero page errors; no attributable failed HTTP responses. The final gate must include
   failed-request checks, and the 404 must be attributed or eliminated.
4. The 15-template conservation oracle proves ordinary baseline consistency only. It does NOT
   falsify C3 (hidden postings) or C4 (sleeve semantics). Those require the render-truth tests
   defined below.
5. The 18 stale screenshot-project baselines are PLAUSIBLY intentional (marker/disclosure pixel
   changes) but not established. Stage 6 requires reviewing each diff before updating any
   baseline; no blind `--update-snapshots`.
6. The final gate retains the audit's complete check list: full non-visual suite, remediation +
   journey specs, failed-request checks, and explicit locked-disclosure retention on all 16
   templates.
7. The four current-audit deltas are first-class acceptance requirements, without F-numbering:
   the Meeting panel has a real keyboard-operable disclosure button with an accessible name,
   `aria-expanded`, deterministic focus entry, Escape dismissal, and focus return; Detach and
   Reattach work from user-origin inspector clicks and a newly drawn connector immediately
   exposes classify/amount/reroute controls; Delete and Backspace operate on the canvas
   selection after any form-control edit; and presentation hides every editor affordance with
   `pointer-events:none` before and after hover/focus. These are scoped exceptions to the later
   design pass, not permission to redesign the full header, toolbar, or Tab model.

## §2 Contract framework (acceptance principles — every stage is judged against these)

(i) money invariant under geometry; (ii) aggregates equal the sum of parts; (iii) scenario
encapsulation; (iv) annotation inertness; (v) affordance honesty and reversibility; (vi)
presentation-mode safety; (vii) temporal consistency (state(t0) == state(reload) == state
(re-entry), and every "reset" either resets everything or says what it keeps); (viii)
representation coherence (every datum shown in 2+ places agrees everywhere, always, mid-edit
included).

Method rule (binding): no fix may be verified by state-vs-state assertions alone. Every journey
test asserts RENDERED text/DOM against sums recomputed independently from raw template data.
(The hidden-posting class survived earlier waves precisely because both sides of the old
conservation check consumed the same hidden set.)

## §3 Ground rules (binding for all stages)

- Branch: create a clean implementation branch off `0fb1840`. Cherry-picking Codex's existing
  `5949a97` onto it is approved. Never commit to main directly; never force-push; never rewrite
  pushed history. Exact-path staging only. Conventional commits, one logical group per commit.
- TDD: each stage begins with failing journey tests reproducing the finding's exact measured
  repro (the REPORT.md tables are the oracle), then the fix, then green.
- Keep green at every stage: tests/e2e/remediation-*.spec.js, drag-invariants.spec.js,
  portfolio-release.spec.js, narrow-screen (chromium-390-gate), and the full chromium-1440
  project. Updating an existing test is allowed only when it encoded the defect (state why in
  the commit message).
- Environment traps: never use port 4173 (foreign process owns it); patch ports in your own
  clone/branch only; headless always; CRLF warnings benign; do not touch
  C:\Users\Cyril\Projects\money-map, other worktrees, or C:\Users\Cyril\Backups.
- Out of scope for Codex (reserved for the separate design pass; do not touch except where a
  stage explicitly requires it): header overflow at 1060-1300px, the general Tab/focus keyboard
  model (except the Meeting-panel entry/dismissal/return contract in Stage 1),
  alignment-toolbar labeling, scenario-scoped sidebar UI, cadence display on canvas flow labels,
  disclosure draggability, typography/fills, card collision/snap.

## §4 Stages

Stage 0 — Preflight. Branch off 0fb1840; cherry-pick 5949a97; run the four-project non-visual
baseline gate and record totals. Run the visual gate without updating snapshots and preserve its
18-failure receipt for Stage 6. The Windows strict-layout wrapper is an expected baseline failure
until Stage 1; prove the layout engine itself against an isolated non-4173 server. CHECKPOINT:
the four-project non-visual baseline is green before any product change.

Stage 1 — Command/history boundary (Disease V; fixes C1-undo, C5-visual-undo, C7, P2, d5).
Every user-visible mutation routes through reversible history: flow-type chips, item-visual
chips, reset-to-linked, keyboard quick-adjust, connector slider commits. Fix `=`/`+`/`-`
selected-object money mutation: quick-adjust must be an explicit, discoverable, undoable
command — zoom vs mutate may not depend silently on selection state. "Reset scenario" gets an
explicit confirmation, preserves the pre-reset state in history (undoable), and its label must
say what it resets. Delete and Backspace must act on a canvas selection after a slider, checkbox,
text input, or select was used; selecting the canvas object establishes command context without
stealing text-edit semantics. The Meeting panel gets the keyboard-operable disclosure contract
from §1. Presentation renders no edge handles or other editor affordances, including after
hover/focus. Fix the Windows `spawn EINVAL` path in `tests/audit/server.js` so the exact strict
layout command starts and cleans up its own isolated server. Journey tests: every mutation class
× undo × redo, plus the four boundary journeys above.

Stage 2 — Dimensional integrity (Disease III; fixes C1). Flow-type transitions become atomic:
changing type revalidates and normalizes driver, amount, and cadence together; a stored amount
may never be consumed under a different unit than it was authored in. Minimal typed-quantity
normalization at write time is sufficient; a full type-system rewrite is not required. Exact
regression: $4,000/mo portfolio draw → RMD chip must never yield $48,000/mo MAPPED, and must
undo cleanly.

Stage 3 — One ledger truth (Diseases IV/VI; fixes C2, C3, C4, C5, C8). (a) A connector that
posts to balances or cashflow must be visible or its posting must be surfaced — no invisible
current postings (C3: retirement $250K burn, annuity $85K, execComp $75K, bizOwner $66K). (b)
Sleeves become coherent with parents: sleeve edits either derive the parent (sum + explicit
unallocated remainder) or are clamped/labeled as display-only — no $575K sleeves under a $150K
parent, no built-in template contradictions (C4 table in REPORT.md). (c) Same-named objects may
not show unlabeled contradictory values; special-card figures get explicit labels sourced from
the same model as inventory (C5). (d) Slider `input` preview updates all coupled surfaces or
visibly marks the pending state; on `change` everything reconciles (C8). (e) Endpoint detachment
is geometry-only: preserve semantic source and target identity separately, keep the posting counted
exactly once in global and target cashflow, and leave every monetary surface invariant (C2;
causation unknown — test the behavior, not the blame). Removing a posting would require a separate
explicit financial command, which is outside this remediation. Detach and Reattach must be asserted as user-origin clicks,
not direct function calls: endpoints change, all rendered monetary surfaces remain invariant,
and one undo restores the prior topology. A newly edge-drawn connector must immediately expose
visible label/type/amount/endpoint controls, accept beneficiary transfer + $250,000, reroute,
delete, undo, and redo through the rendered inspector.

Stage 4 — Domain honesty (fixes C6, P4 core). Make the RMD template's arithmetic internally
true: pick ONE interpretation (net or gross), make withholding math exact, and give QCD a real
target leg. Do NOT claim IRS-RMD computation: relabel to an honest "illustrative distribution +
withholding story" unless prior-year balance/divisor inputs are actually implemented.
The binding arithmetic fixture is gross distribution: $6,000/mo + 30% withholding + $20,000 QCD
must render $72,000 gross, $21,600 withholding, $50,400 spendable ($4,200/mo), $20,000 QCD, and
$92,000 IRA reduction within $1 on every editor, inventory, caption, banner, inspector, and
presentation surface.
DOMAIN CHECKPOINT: Cyril reviews the chosen wording/math before this stage merges. Fix the
README's false "no tax calculation" claim and the other P4 stale claims (test counts, module
count, template count) as part of this stage.

Stage 5 — Session survival and commit-time performance (fixes P1, P3). Crossing the 1060px
threshold must not destroy work: persist session state before any gate-driven reload and restore
it after (sessionStorage is acceptable); the gate remains, data loss goes. Pointer-up layout
repair: restrict to the moved node's affected connectors/spatial neighbors with a synchronous
budget; measurable acceptance: the Estate 4-flow drop's pointer-up long task goes from ~2,400ms
to <50ms, verified by the audit's profiling method, two runs.

Stage 6 — Minor/polish (fixes C9, C10, P5, P6). Align-left/right/top/bottom operate on bounding
edges, not centers. Rounding coherence: header totals use a precision that cannot contradict
their rows (follow the "$1.59M" convention). Capacity: expose parent capacity in the live
inspector or remove its dead renderer path (P5) — pick one, no dead UI. Screenshots: review the
18 stale visual baselines diff-by-diff; update only those whose change is the intended
marker/disclosure delta; recapture README media on the finished build (may be deferred to the
design pass if Cyril prefers — ask at checkpoint).

## §5 Final gate (all required, in one run, on the implementation branch head)

1. Full non-visual Playwright suite green (all four projects; record totals).
2. All remediation-*, drag-invariants, and new journey specs green.
3. Zero page errors; zero unattributed console messages (the 404 attributed or gone); zero
   failed HTTP requests (explicit request-failure listener).
4. Locked SYNTHETIC DEMO DATA disclosure present and undeletable on all 16 templates.
5. Render-truth spot audit: banner, inventory, special cards, and sleeve surfaces agree with
   independently recomputed sums on at least Retirement, Roth, Estate, RMD templates.
6. Each fixed C/P finding re-run through its REPORT.md repro, twice, with before/after recorded.
7. The four full client journeys from the 2026-07-14 full-experience audit complete through
   visible controls without reload or test-only actions; breakpoint round-trip preserves the
   document and history; every committed/destructive action has one complete undo step;
   presentation retains disclosure and exposes no editor affordance.
8. Estate final pointer-up is <50ms in both isolated runs; no NaN/Infinity, orphan connector,
   visual-baseline failure, failed request, page error, or unattributed console message remains.
9. No changes outside the branch; no port 4173; worktree clean except known eol-only artifact.

## §6 Verification and merge protocol

Codex reports per-stage: commits, journey-test names, measured before/after. At final gate,
Claude runs independent verification (same adversarial standard applied to Claude's own agents),
then merge to main is a plain fast-forward or merge commit — never a rebase of pushed history.
Cyril's manual pass (15-20 min) happens on the live Pages deploy after push.

## §7 Current state inventory (for orientation)

Fixed on main as of 0fb1840: phantom-connector fabrication (d6200e0); relevance gating /
de-fabricated Mapped (c52db99); duplicate-drops-semantics, undo focus guard, presentation
lockdown (0fb1840); inventory 2-frac header, caption refresh, shortfall styling (c52db99).
Open and owned by this spec: C1-C10, P1-P6. Open and reserved for the design pass: the §3
out-of-scope list. Systemic diagnoses III-VII in REPORT.md are the architectural rationale for
Stages 1-5; implement the minimal structural slice each stage defines, not full rewrites.
