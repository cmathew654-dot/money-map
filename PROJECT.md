# Project state

**Updated:** 2026-07-19

**Branch:** `codex/advisor-shape-studio`

**Checkpoint:** R5 four-starter Shape Studio integration complete locally

**Phase:** R6 GitHub packaging, then final Impeccable audit

## Current product

- Four synthetic advisor stories share one literal-safe React Flow document model, authoring system, command registry, persisted undo history, and read-only presentation shell.
- Retirement Income, RMD & Withholding, Annuity Income Floor, and Roth Conversion each provide a complete authored composition with Overview plus five distinct named steps.
- The v2 authoring model now carries independent width/height, snapped rotation, priority, density, semantic color, curated swatch, z-order, and independent flow-label position. Local v1 drafts are intentionally abandoned under the new `money-map:v2:` key.
- Retirement is the reference slice: ledger, tabbed plate, liquidity tray, dimensional roundel, statement band, frame, and text object now read as distinct financial-story primitives. Priority and density create visible hierarchy without deriving anything from amounts.
- Every visible module text role is directly editable by double-click. Modules resize on both axes with content-safe clamping; rotated objects deliberately do not resize. Existing selection halo, Actions palette, undo/redo, persistence, and presentation history remain shared.
- Draw flow is available from the selection halo, Actions palette, and `L`. Hover-visible ports and a compact keyboard-accessible destination picker replace the hidden connection mode and Connections tab. Labels and route bends move independently; endpoint reconnect remains available by pointer and properties.
- One compact Add menu creates eight financial-story shapes. Appearance now owns shape, priority, detail, curated color, size, and layer controls; compatible style carries forward, objects can be quick-created from a port, and every shape/density pair has a shared no-clipping floor.
- Each starter opens on its authored cadence and fits its story rather than defaulting to the crowded All view. New relationships inherit the visible Monthly or Annual cadence so they remain visible for immediate labeling.
- Four advisor-language relationship meanings - income, transfer, replenishment, and planned - use redundant label and line-pattern cues. Aligned modules no longer receive manufactured doglegs, routes use all four module sides, and edge casing keeps genuine crossings legible.
- Presentation keeps title, as-of date, and synthetic-data provenance visible; offers direct and keyboard step navigation; restores focus on exit; and disables author mutations.
- Financial content remains exact display text. Nothing parses, calculates, reconciles, taxes, debits, validates funding capacity, or derives geometry/style from amounts.
- Public packaging includes a visitor-first README, architecture and provenance docs, relative Pages asset validation, and SHA-pinned verify/deploy workflows. Nothing has been pushed or deployed.
- The final Impeccable pass removed the side-stripe/ghost-card residue, improved presentation typography and coarse targets, added Escape closure to transient surfaces, tokenized shared relationship colors, and repaired the remaining Retirement total/label lanes.

## Verification

- ESLint, TypeScript, production build, and Pages asset validation pass in the integration worktree.
- R5 unit/component gate: 35 files, 270 tests passed.
- Full Chromium: 28/28 journeys passed.
- All four stories pass presentation geometry and readability checks at 1280x720, 1440x900, and 1920x1080: bounded content, no module/label collisions, no unrelated route crossings, and enforced text floors.
- Independent Task 5 review found no P0/P1 defects. Its three P2 findings - coarse-pointer targets, per-theme presentation surfaces, and fake-height connector ports - were repaired and covered before integration.
- The independent Impeccable baseline was 13/20. The repaired build is 19/20 with no scoped P0/P1/P2 finding open; the remaining point is incomplete decorative tokenization in stable shared editor chrome.
- Fresh `npm run verify` passed: formatting, lint, TypeScript, 240 tests, production build, Pages asset validation, and 26 Chromium journeys. The Impeccable static detector returned zero findings.
- R5 production build passed on 2026-07-19: 470.10 kB JavaScript / 143.12 kB gzip and 50.00 kB CSS / 9.47 kB gzip, within the audited budget.
- The 1440x900 Retirement slice was inspected in-browser: no module content clips; direct title editing opens on double-click; one two-axis resize control appears on selection.

## Known boundaries

- This is a clean portfolio demonstration, not production financial-planning software or financial advice.
- Authoring requires at least 1180x660 and shows an honest cover below that minimum; presentation targets the three verified desktop viewports.
- Draft persistence is local and synchronous. There is no backend, cloud sync, collaboration, authentication, or arbitrary import/export.
- Stale local drafts can mask updated starter defaults until Reset.
- No branch has been pushed, merged, deployed, or released.

## Active direction

- Implement the externally audited lean plan in `docs/superpowers/plans/2026-07-19-advisor-safe-shape-studio.md`.
- The external verdict was `PROCEED AFTER MANDATORY REVISIONS`. The accepted plan removes the multiplicative material matrix, speculative schema/migration, obstacle avoidance, line jumps, and generic-canvas extras; it promotes reliable flows ahead of the full catalog.
- R1 through R5 are complete locally. R6 is limited to GitHub-facing cleanup and a WebKit presentation smoke before the final Impeccable audit/remediation gate.
- Eight purposeful shapes, three priority levels, three content densities, and curated theme swatches form the release grammar. Rotation remains available to every object with explicit React Flow-safe constraints.
- Per explicit user instruction, ceremony has been removed: direct implementation, focused checks during development, full gates only after user-visible checkpoints, and independent review only at four-starter integration/final audit.
- Nothing will be pushed, merged, deployed, or released without explicit user approval.
