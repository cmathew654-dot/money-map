# Project state

**Updated:** 2026-07-19

**Branch:** `codex/advisor-shape-studio`

**Checkpoint:** R7 final audit and remediation complete locally

**Phase:** Ready for user review; no release action authorized

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
- Public packaging includes a visitor-first README, architecture and provenance docs, recruiter-facing media, relative Pages asset validation, and SHA-pinned verify/deploy workflows. Nothing has been pushed or deployed.

## Verification

- ESLint, TypeScript, production build, and Pages asset validation pass in the integration worktree.
- Final unit/component gate: 35 files, 272 tests passed.
- Final browser gate: 28/28 Chromium journeys and 1/1 WebKit presentation smoke passed.
- All four stories pass presentation geometry and readability checks at 1280x720, 1440x900, and 1920x1080: bounded content, no module/label collisions, no unrelated route crossings, and enforced text floors.
- Final production build passed on 2026-07-19: 470.27 kB JavaScript / 143.16 kB gzip and 50.12 kB CSS / 9.48 kB gzip, within the audited budget.
- Final independent Impeccable audit: 20/20, gate PASS, no unresolved P0/P1/P2. The attribution target and the two over-soft Private Ledger shadows found during the gate were repaired and re-verified.
- Final runtime audit: zero console warnings/errors/page errors, no unnamed visible controls, favicon HTTP 200, and primary theme contrast pairs from 5.03:1 to 10.49:1.
- The 1440x900 Retirement slice was inspected in-browser: no module content clips; direct title editing opens on double-click; one two-axis resize control appears on selection.

## Known boundaries

- This is a clean portfolio demonstration, not production financial-planning software or financial advice.
- Authoring requires at least 1180x660 and shows an honest cover below that minimum; presentation targets the three verified desktop viewports.
- Draft persistence is local and synchronous. There is no backend, cloud sync, collaboration, authentication, or arbitrary import/export.
- Stale local drafts can mask updated starter defaults until Reset.
- No branch has been pushed, merged, deployed, or released.

## Active direction

- R1 through R7 are complete locally. The branch is ready for user review; pushing, merging, Pages deployment, and release remain prohibited without explicit approval.
- Eight purposeful shapes, three priority levels, three content densities, and curated theme swatches form the release grammar. Rotation remains available to every object with explicit React Flow-safe constraints.
- Per explicit user instruction, ceremony has been removed: direct implementation, focused checks during development, full gates only after user-visible checkpoints, and independent review only at four-starter integration/final audit.
- Nothing will be pushed, merged, deployed, or released without explicit user approval.
