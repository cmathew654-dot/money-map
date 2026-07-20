# Advisor-Safe Shape Studio — Audited Lean Plan

> Required workflow: test-driven behavior changes, one implementer at a time, independent review at the four named gates, and a final Impeccable audit. Update `PROJECT.md` before each checkpoint commit. Do not push, merge, deploy, or release without explicit approval.

## Goal

Turn the literal-safe prototype into a polished, near-freeform advisor story studio that is clearer than the original PowerPoint workflow, expressive without becoming a generic diagrammer, and defensible as a GitHub portfolio project.

## Fixed constraints

- Financial display values remain exact strings and never drive arithmetic, validation, geometry, routing, color, depth, or emphasis.
- One shared schema, command registry, history, canvas, flow renderer, and presentation shell serve all four starters.
- No new runtime dependencies.
- Production budgets are hard ceilings, not targets: JavaScript ≤ 500 kB raw / 155 kB gzip; CSS ≤ 62 kB raw / 12 kB gzip.
- Persistent-field ceiling: at most 8 new module fields, 2 new flow fields, and 2 new document fields. A field ships only with its user-visible consumer.
- Interaction surfaces finish at net +1: add one Add menu; remove the Connections tab and standalone style menu. No other panel, mode, or toolbar.
- Registered commands remain at or below 64. Starter-specific TypeScript behavior remains zero.
- Test ceilings are not quotas: at most 390 unit/component tests and 40 end-to-end journeys unless a reviewed exception replaces lower-value coverage.
- Superseded controls, flags, and terminology are removed in the checkpoint that replaces them.

## Review and evidence cadence

- Full three-viewport evidence and fresh implementation plus bloat review occur at four gates: reference slice, flow system, four-starter integration, and final audit.
- Interior checkpoints require focused tests, typecheck, build, and one inspected 1440×900 render.
- The external pre-implementation audit is recorded in the audit ledger. Internal reviewers do not substitute for any later external review explicitly requested by the user.

## R0 — Lock audited scope

**Outcome:** governing documents describe the lean release; raw local critique remains ignored; baseline remains 240 tests and 450.30 kB JavaScript.

**Work:**

- Record the external audit and accepted revisions.
- Align PRODUCT, DESIGN, AGENTS, PROJECT, and this plan.
- Establish bloat budgets and explicit deferrals.

**Verification:** documentation consistency, `git diff --check`, baseline tests/build already reverified.

**Commit:** `docs: lock audited shape studio scope`

## R1 — Reference slice and schema v2-lite

**User-visible outcome:** a small Retirement Income slice proves the complete visual and editing grammar: dimensional roundel, tray, plate, band, text object, two distinct flows, direct editing of every visible string, two-axis resize without clipping, snapped rotation, priority, density, and curated color.

**Schema only as consumed:**

- Module: `height`, `rotation`, `priority`, `density`, `colorRole`, `swatch`, and `zIndex`. Existing `primitive` becomes the eight-shape identity.
- Flow: independent `labelPosition`.
- Document: one authored default cadence and one authored default camera if both are required by the rendered slice; otherwise defer them to R4.
- Bump persistence to `money-map:v2:`. Old v1 drafts are intentionally ignored because they are synthetic, local, undeployed, and superseded. Do not build a migration framework.

**Implementation:**

- Render ledger, plate, tray, band, roundel, frame, cylinder, and text through one shared node contract; R1 needs only the reference-slice subset visually finished.
- Priority is the sole emphasis/material axis: Quiet, Standard, Spotlight.
- Density is Essential, Standard, Full and only changes visibility of existing literal fields.
- Colors come from semantic roles and curated per-theme swatches with contrast-paired text.
- Rotation works on every object in 15° increments. Resizing is disabled while rotated; flows use unrotated attachment bounds.
- Every shape × density declares a content-derived minimum width and height; resize clamps rather than clips.
- Fix the conditional-hook ordering defect in `MoneyMapEdge.tsx`.
- Consolidate duplicate shortcut handling into one command path.

**Explicit exclusions:** sphere, pyramid, materials axis, arbitrary color picker, scenarios, named views, grouping, locking, Tidy selected, migration framework.

**Tests:**

- Literal strings round-trip through shape swap, density changes, resize, rotation, persistence, reset, undo, and redo.
- Amount-like string changes do not affect geometry or style.
- Unknown or stale v1 drafts safely fall back to the starter.
- Rendered no-clip matrix for the slice shapes × densities at minimum size.
- Computed AA contrast for every slice semantic style × theme.

**Gate:** at 1280×720, 1440×900, and 1920×1080 the slice reads at a glance, nothing clips, all visible text edits directly, and no style implies financial magnitude. Fresh implementation and bloat reviews required.

**Commit:** `feat: establish literal-safe advisor canvas grammar`

## R2 — Reliable Draw flow

**User-visible outcome:** `Connect module` and hidden connection mode disappear. Hover-visible ports and `Draw flow` make creation obvious; labels unmistakably belong to routes; aligned objects do not generate doglegs.

**Implementation:**

- Draw flow is available from Add, `L`, halo, palette, and a keyboard-only start/source/target path, all backed by one command.
- Drag onto an object creates a flow. Drag onto empty canvas invokes quick-create; Escape or an invalid drop restores exact prior state.
- Four advisor-language semantics: income, transfer, replenishment, planned/conditional.
- Three routes: straight, orthogonal, curved.
- Use all four object sides and stable boundary attachment.
- Separate route bends from `labelPosition`; labels drag independently.
- Preserve reconnect and authored bends.
- Remove generated doglegs between aligned objects.
- Use background-colored edge casing to clarify genuine crossings.
- Arrow/no-arrow remains a minimal semantic choice; no free weight or magnitude styling.

**Explicit exclusions:** obstacle avoidance, line jumps, stepped routes, hidden routing intelligence.

**Tests:**

- Pointer and keyboard creation, quick-create, cancel, reconnect, bend drag, label drag, undo/redo.
- Aligned horizontal and vertical fixtures generate direct paths.
- Every route has an attached endpoint, readable label ownership, and adequate hit target.
- No amount-like string changes path geometry.

**Gate:** a first-time user can find and create a labeled flow in ten seconds; the known screenshots’ janky doglegs, floating labels, and side-exit errors cannot recur. Fresh implementation and bloat reviews required.

**Commit:** `feat: make money flows obvious and reliable`

## R3 — Complete catalog and low-friction authoring

**User-visible outcome:** eight purposeful shapes are finished and fast to create, restyle, arrange, and edit without form-heavy friction.

**Implementation:**

- Finish ledger, plate, tray, band, roundel, frame, cylinder, and text.
- One compact Add menu is the sole creation surface.
- Shape swap preserves content, flows, geometry, style, and history.
- New objects inherit the last compatible style.
- Quick-create from a port creates a connected object with title editing active.
- Bring forward, send back, align, distribute, duplicate, and delete use shared commands.
- Halo, palette, and optional inspector invoke the same commands.
- Absorb the standalone style menu into Appearance; remove Connections from the inspector.
- Double-click or Enter edits the visible field under focus, including eyebrow, title, subtitle, rows, totals, notes, and flow labels.

**Explicit exclusions:** sphere, pyramid, groups, locks, Tidy selected, favorites/recents system, new editor panels.

**Verification:** no-clip matrix for all eight shapes × three densities; computed contrast matrix; command parity; literal regression; one inspected 1440×900 render.

**Commit:** `feat: add expressive low-friction authoring`

## R4 — Authored story defaults and presentation polish

**User-visible outcome:** each starter opens on its intended cadence and camera instead of the cluttered All view; Fit story and a compact legend restore orientation.

**Implementation:**

- Add exactly one authored default cadence/camera per starter if not already introduced in R1.
- Keep All as an explicit overview, not the initial state.
- Fit story uses the authored story bounds.
- Verify existing zoom, fit-selection, 100%, pointer zoom, keyboard zoom, named steps, title, as-of, provenance, focus restoration, and reduced motion against the new defaults.
- Add one unobtrusive legend component only where authored semantics require explanation.

**Explicit exclusions:** named views, per-view cameras, privacy curtain, presentation marker, new presentation modes.

**Verification:** default-view journeys for all starters, presentation invariants, one inspected 1440×900 render.

**Commit:** `feat: open every map on its authored story`

## R5 — Four equal-finish starters

**User-visible outcome:** Retirement Income, RMD & Withholding, Annuity Income Floor, and Roth Conversion each demonstrate the shared visual grammar with distinct, meeting-ready compositions.

**Requirements per starter:**

- Authored default cadence and camera.
- Overview plus five meaningful presentation steps.
- Intentional hierarchy using priority, density, semantic color, and varied purposeful shapes.
- Reliable, deliberately routed flows with clear labels.
- Direct-edit, resize, rotate, shape-swap, and presentation compatibility.
- No module/label collisions, off-viewport content, or unrelated route crossings at supported viewports.

**Implementation rule:** one fixture/theme at a time; no starter-specific TypeScript renderer, command, or state branch.

**Evidence:** up to two screenshots per starter per mode. Capture two recruiter-facing GIFs total: one authoring journey and one presentation journey—not one pair per starter.

**Gate:** full 1280×720, 1440×900, and 1920×1080 evidence plus fresh implementation and bloat reviews.

**Commits:** one reviewed commit per starter, followed by a shared integration commit only if needed.

## R6 — Portfolio packaging

**Outcome:** the repository communicates the product clearly and runs cleanly for a hiring reviewer.

**Work:**

- Remove dead flags, stale connection language, debug output, obsolete docs, and public-internal artifacts.
- Fix the favicon request.
- Update README, architecture, provenance, screenshots, GIFs, accessibility notes, and honest limitations.
- Preserve lean SHA-pinned CI and Pages validation.
- Add one WebKit presentation smoke project without multiplying the entire browser matrix.

**Verification:** unit gate, Chromium journeys, WebKit presentation smoke, production build, Pages artifact check, clean console, repository hygiene.

**Commit:** `docs: package advisor shape studio portfolio`

## R7 — Independent Impeccable audit and remediation

Run a fresh Impeccable audit plus code, accessibility, responsive, interaction, and literal-safety review. Exercise every starter in author and presentation modes at the three supported desktop viewports.

Fix all P0/P1/P2 findings and high-value P3 findings that do not expand scope. Re-run `npm run verify`, compare bundle and schema budgets, and produce a concise local handoff.

**Release gate:** at least 18/20, no unresolved P0/P1/P2, no console errors or warnings, zero literal-value regressions, and explicit user approval before any push or deploy.

**Commit:** `fix: close advisor shape studio audit`

## Explicitly deferred

Backend, authentication, cloud sync, collaboration, arbitrary import/export, global auto-layout, financial computation, tax logic, production-advisory claims, scenario identity/UI, named views, per-view cameras, sphere and pyramid shapes, materials as an independent axis, arbitrary color pickers, grouping, locking, Tidy selected, obstacle avoidance, line jumps, stepped routing, privacy curtain, presentation marker, and persisted freehand drawing.
