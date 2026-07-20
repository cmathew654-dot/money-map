# Independent bloat review

## Purpose

This review exists to challenge the Shape Studio plan and the four implementation gates named in the audited plan from outside the implementation loop. Its job is to identify complexity that does not materially improve advisor comprehension, authoring speed, presentation quality, accessibility, or portfolio defensibility.

The reviewer must not assume that a planned feature deserves to ship. “Already implemented,” “common in diagramming tools,” and “might be useful later” are not sufficient justification.

## Independence rules

- The reviewer must not be the checkpoint implementer.
- Review the written acceptance criteria and the complete BASE..HEAD diff, not the implementer’s summary alone.
- Findings cite concrete files, controls, states, or user journeys.
- Recommend deletion or simplification before recommending new abstraction.
- Preserve literal-value safety, accessibility, and undo integrity even when simplifying.
- Record disagreements and dispositions; do not silently waive findings.

## Reviewer autonomy

The framework below is a minimum evidence floor, not a prescribed methodology or limit on scope. The reviewer is explicitly expected to use its own judgment, tools, heuristics, research, and review methods.

- Challenge the plan’s premises, checkpoint boundaries, feature classifications, budgets, and severity definitions when they appear wrong.
- Identify risks, omissions, contradictions, or better simplifications that this brief does not anticipate.
- Inspect architecture, interaction design, product strategy, accessibility, visual hierarchy, testing, performance, documentation, and repository hygiene in whatever order produces the strongest review.
- Reframe or combine findings when the supplied categories obscure the underlying problem.
- Distinguish necessary complexity from accidental complexity; do not equate fewer files or fewer lines with a better product automatically.
- Consider whether removing a capability would damage the locked product thesis or merely reduce implementation cost.
- Use external primary or secondary sources when they materially improve the analysis, and distinguish sourced facts from reviewer inference.
- Report uncomfortable conclusions directly, including a recommendation to restructure, defer, or reject a checkpoint.

The reviewer does not need to complete every checklist item mechanically when a stronger method covers the same ground. It must explain its method, evidence, assumptions, and confidence well enough for another agent to reproduce or challenge the verdict.

## Pre-implementation plan challenge

For every planned capability, classify it:

1. **Essential now** — required for the locked advisor workflow or a known visible defect.
2. **Cheap multiplier** — small implementation that materially improves discoverability, consistency, or presentation.
3. **Defer** — credible later value but unnecessary for the portfolio release.
4. **Reject** — generic-canvas expansion, hidden financial logic, or complexity without clear user benefit.

The plan may proceed only when:

- Every Checkpoint 1–5 feature is classified.
- Checkpoints have coherent vertical outcomes rather than infrastructure-only work.
- No capability is implemented twice through separate state or command paths.
- The feature set fits the existing dependency budget and avoids speculative frameworks.
- Explicit deferrals remain excluded from schemas and UI except for narrowly documented compatibility fields.

## Mandatory checkpoint questions

### User value

- What specific advisor task became faster, clearer, safer, or more presentable?
- Could the same benefit be achieved by removing friction instead of adding a control?
- Is the feature visible and discoverable without onboarding theater?
- Does the result still read at a glance to a client who never sees the editor?

### Surface-area audit

- Did this checkpoint add a panel, mode, tab, toolbar, menu, or persistent status element?
- If so, why could it not live in the existing Add menu, halo, palette, direct-edit surface, or optional inspector?
- Are the same actions duplicated with divergent labels, defaults, enabled states, or undo behavior?
- Did an old path remain after its replacement shipped?

### Architecture audit

- Did the change introduce a starter-specific renderer, command, state branch, fixture exception, or CSS fork?
- Are new types grounded in shipped behavior, or are they speculative generalization?
- Is object, flow, selection, history, persistence, and presentation state still centralized?
- Are migrations explicit, bounded, tested, and free of silent fallback behavior?

### Financial-safety audit

- Are all display values still exact strings?
- Did any amount-like text reach parsing, comparison, arithmetic, capacity checks, warnings, geometry, routing, color, depth, emphasis, or animation?
- Can approximation marks, ranges, blanks, cadence prose, and em dashes round-trip unchanged?

### Cost audit

- Runtime dependency delta.
- Production JS/CSS raw and gzip delta against baseline.
- New files, new exported symbols, new persistent fields, and removed equivalents.
- Test growth relative to actual behavior coverage.
- Any build, accessibility, responsiveness, or interaction regression.

### Language audit

- Search user-facing copy for node, edge, handle, connection mode, module schema, waypoint, route algorithm, or other implementation vocabulary.
- Prefer task language: object, shape, Draw flow, bend, label, story, cadence, view, and presentation.

## Finding severity

- **P0 — Stop:** financial-safety violation, data loss, inaccessible core workflow, or destructive migration.
- **P1 — Must simplify:** duplicate architecture, unusable primary journey, major visual regression, or unjustified product expansion.
- **P2 — Fix before checkpoint:** avoidable control/state/file growth, dead path, confusing terminology, or material bundle increase.
- **P3 — Consider:** localized complexity or polish debt with low immediate risk.

All P0–P2 findings must be fixed before the checkpoint commit. A P3 may be deferred only with a concise reason in this file.

## Baseline

- Tests: 240 passed across 35 files.
- Production JavaScript: 450.30 kB raw / 138.72 kB gzip.
- Production CSS: 43.88 kB raw / 8.26 kB gzip.
- Runtime libraries: React, React DOM, React Flow.
- Known debt: crowded All view; opaque Connect module workflow; one-axis resize; rectangle-heavy vocabulary; incomplete direct editing; unreliable flow routing and label ownership; no rotation; insufficient color hierarchy; missing favicon.

## Review record

### External plan review — complete

- Reviewer: external independent agent in a separate session.
- Date: 2026-07-19.
- Method and tools used: read all governing documents and relevant source architecture; inspected the document model, persistence, 32-command registry, canvas, node/edge renderers, relationship geometry, workspace shell, starter fixtures, tests, and build; ran 240 tests and enumerated 26 Chromium journeys; verified the 450,300-byte bundle; checked current primary React Flow documentation and issue/discussion history.
- Assumptions and confidence: high confidence on repository facts and React Flow constraints; medium confidence on effort estimates; assumes four authored starters of roughly twelve modules each and a hiring-reviewer audience.
- Verdict: **PROCEED AFTER MANDATORY REVISIONS.**
- Principal finding: the original plan was approximately 30–40% heavier than the product thesis required because of a multiplicative style matrix, hand-rolled obstacle avoidance/line jumps, speculative schema, reversed flow/catalog sequencing, and excessive review ritual.
- Accepted mandatory revisions: eight shapes; priority absorbs material treatments; curated swatches replace arbitrary pickers; obstacle avoidance, line jumps, stepped routing, scenarios, named views, groups, locks, Tidy selected, privacy curtain, and marker are deferred; v2 draft key replaces migration; schema merges into the reference slice; flows precede catalog; bundle budget becomes 500 kB raw / 155 kB gzip; review evidence concentrates at four gates.
- Accepted repository defects to repair: conditional hook ordering in `MoneyMapEdge`; duplicate shortcut paths; label/waypoint coupling; generated doglegs for aligned modules; left/right-only attachment selection; hidden Connections-tab connection mode.
- Deliberate adjudication changes: rotation remains available to every object but uses 15° snaps, disables resize while rotated, and retains stable unrotated flow bounds. Evidence is two recruiter-facing GIFs total rather than one authoring/presentation pair per starter.
- Plan updated: `docs/superpowers/plans/2026-07-19-advisor-safe-shape-studio.md`.

### R0 scope checkpoint — complete

- BASE: `a262228`.
- HEAD: the `docs: lock audited shape studio scope` checkpoint commit containing this record.
- Review basis: external audit findings reconciled against the repository and current primary React Flow documentation.
- Bundle/dependency delta: zero; documentation-only checkpoint.
- Findings and dispositions: all ten mandatory revisions applied. Rotation remains available to every object under explicit safe constraints; recruiter evidence is capped at two GIFs total to avoid the reviewer’s own per-starter evidence inflation.
- Consistency check: `git diff --check` passes; governing documents contain removed features only as explicit deferrals or audit history.
- Verdict: **PASS. R1 may begin.**

### Gates R1, R2, R5, and R7

Add one section per gate using the same fields. Interior checkpoints use focused self-review and verification without expanding the standing evidence set. Keep this document concise; link to test output or screenshots rather than embedding them.

### Workflow amendment — 2026-07-19

The user explicitly removed subtask briefs, reports, repeated full-suite runs, and internal review loops after observing that ceremony—not product engineering—was dominating elapsed time. R1 and R2 now use direct implementation plus focused verification; independent implementation/bloat review is reserved for R5 integration and R7 final audit.
