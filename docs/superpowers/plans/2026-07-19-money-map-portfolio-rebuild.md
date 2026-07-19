# Money Map Portfolio Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for isolated starter work and `superpowers:test-driven-development` for behavior changes. Track durable progress in `PROJECT.md` and `.superpowers/sdd/progress.md`.

**Goal:** Rebuild Money Map as a literal-safe, presentation-quality advisor story canvas with four equally complete starters and a defensible GitHub portfolio surface.

**Architecture:** A standalone React/TypeScript application uses React Flow for graph primitives while owning its typed document model, command registry, undo history, custom nodes/edges, editing surfaces, and four tokenized art directions. Financial values remain strings and never participate in arithmetic or geometry.

**Tech Stack:** Node 24 LTS, npm, React 19.2, TypeScript 6 strict, Vite 8, React Flow 12, Vitest 4.1, Testing Library, Playwright.

## Global constraints

- Work only from `C:\Users\Cyril\Projects\.portfolio-remediation-worktrees\money-map-approved-remediation-20260714` or an explicitly assigned isolated worktree.
- Financial display values are literal strings. Never parse or calculate them.
- Numbers are restricted to geometry, viewport state, ordering, and schema versions.
- All four starters receive equal authoring, presentation, accessibility, responsive, and evidence quality.
- One command registry and one history model serve all interaction surfaces.
- No backend, auth, cloud, collaboration, arbitrary import/export, auto-layout, or production claims.
- Update `PROJECT.md` before every checkpoint commit and every pause.
- Do not push, merge, deploy, release, or delete archival state without explicit user approval.

---

### Task 1: Standalone scaffold and verification gate

**Creates:** Vite/React/TypeScript configuration, `src/app`, test setup, Playwright smoke test, CI workflow.  
**Removes:** calculation-era runtime and oversized legacy test surface from the reset branch.  
**Produces:** `npm run dev`, `npm run build`, `npm run typecheck`, and `npm run verify`.

- [ ] Replace package metadata and lock the approved dependencies.
- [ ] Write a failing smoke test for the Cairn starter chooser.
- [ ] Implement the minimal app shell and chooser.
- [ ] Verify focused tests, typecheck, build, and Chromium smoke.
- [ ] Update `PROJECT.md` and commit `build: scaffold standalone money map app`.

### Task 2: Literal-safe document model, commands, history, and persistence

**Creates:** `src/money-map/model`, `commands`, document fixtures, local draft adapter.  
**Produces:** `MoneyMapDocument`, module/flow types, command interface, immutable mutations, undo/redo, reset, and versioned localStorage.

- [ ] Write failing tests for exact literal round-trips, mutation isolation, coexistence of `$300,000` and `$250,000`, and geometry independence from amount-like strings.
- [ ] Implement the minimal schema and immutable document operations.
- [ ] Write failing tests for shared commands, compound delete, undo/redo, autosave, and reset.
- [ ] Implement the command registry, history, and persistence adapter.
- [ ] Run focused tests and the verification gate.
- [ ] Update `PROJECT.md` and commit `feat: add literal-safe money map foundation`.

### Task 3: Shared canvas, editing, and accessibility

**Creates:** custom node/edge renderers, viewport controls, selection halo, command palette, inline/advanced editors, connection routing, cadence filters, and accessible interaction helpers.

- [ ] Test camera, selection, command parity, editing commit/cancel, resize alternatives, connector label routing, cadence, focus restoration, and reduced motion before implementation.
- [ ] Implement camera and selection using React Flow world coordinates.
- [ ] Implement the shared command surfaces and direct/advanced editors.
- [ ] Implement width-only resizing with auto-height and presets.
- [ ] Implement route, relationship, label-treatment, reconnection, waypoint, and cadence behavior.
- [ ] Verify keyboard-only and pointer workflows.
- [ ] Update `PROJECT.md` and commit `feat: add low-friction canvas editing`.

### Task 4: Four equal-finish starters

**Creates:** four independent typed fixtures and four tokenized art directions behind the frozen shared API.

- [ ] Freeze the starter/theme interfaces and add their contract tests.
- [ ] Build Retirement Income / Private Ledger on the integration branch.
- [ ] Build RMD & Withholding / Distribution Registry in an isolated worktree.
- [ ] Build Annuity Income Floor / Foundation in an isolated worktree.
- [ ] Build Roth Conversion / Conversion Path in an isolated worktree.
- [ ] Require each implementation to provide Overview plus five named steps, purposefully routed flows, cadence, author screenshots, presentation screenshots, and focused tests.
- [ ] Integrate one starter at a time; verify and commit each separately with `PROJECT.md` updated.

### Task 5: Presentation integration and responsive repair

**Produces:** one presentation system shared by all starters with persistent title, as-of date, provenance, Overview, five steps, keyboard navigation, reduced motion, and clean bounded compositions.

- [ ] Write failing integration tests for presentation metadata, step navigation, label ownership, route/module intersection, supported viewports, and the 1179px cover.
- [ ] Implement the shared presentation shell and geometry checks.
- [ ] Repair every starter until the same test matrix passes at 1280×720, 1440×900, and 1920×1080.
- [ ] Update `PROJECT.md` and commit `feat: complete shared presentation system`.

### Task 6: Portfolio packaging and independent review

**Creates:** visitor-first README, architecture/provenance docs, GitHub Pages workflow, final repository hygiene, and lean CI.

- [ ] Test the production base path and Pages artifact.
- [ ] Remove stale public-internal documentation, real-client media, and static test-count badges.
- [ ] Build the README and honest limitations section from verified behavior.
- [ ] Run read-only visual, accessibility, and architecture reviews in parallel; implement confirmed findings sequentially.
- [ ] Update `PROJECT.md` and commit `docs: package money map portfolio`.

### Task 7: Impeccable audit and repair loop

**Produces:** scored technical audit, prioritized findings, repaired application, re-audit, and hash-matched final evidence.

- [ ] Audit accessibility, performance, responsive design, theming, and anti-patterns.
- [ ] Implement all confirmed P0, P1, and P2 findings; resolve high-value P3 findings or document them for explicit approval.
- [ ] Re-run until score is at least 18/20 with no P0/P1 or unapproved P2 findings.
- [ ] Run `npm run verify` and capture final evidence from the exact source commit.
- [ ] Update `PROJECT.md` and commit `fix: resolve impeccable audit findings`.

### Task 8: Controlled release handoff

- [ ] Verify the final diff, release evidence, README, live local build, and limitations.
- [ ] Present the local result to the user before any push.
- [ ] After approval, push a review branch and open a PR.
- [ ] After second approval, merge, deploy Pages, and tag `v0.1.0`.

