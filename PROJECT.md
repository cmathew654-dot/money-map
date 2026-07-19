# Project state

**Updated:** 2026-07-19

**Branch:** `codex/reference-reset-2026-07-19`

**Checkpoint:** Portfolio rebuild complete and locally verified

**Phase:** Local handoff ready; publishing remains user-controlled

## Current product

- Four synthetic advisor stories share one literal-safe React Flow document model, authoring system, command registry, persisted undo history, and read-only presentation shell.
- Retirement Income, RMD & Withholding, Annuity Income Floor, and Roth Conversion each provide a complete authored composition with Overview plus five distinct named steps.
- Authoring includes direct editing, advanced properties, selection halo, Actions palette, cadence filters, pan/zoom/fit controls, horizontal module resize, relationship waypoints, reconnect, undo/redo, reset, and per-starter local persistence.
- Presentation keeps title, as-of date, and synthetic-data provenance visible; offers direct and keyboard step navigation; restores focus on exit; and disables author mutations.
- Financial content remains exact display text. Nothing parses, calculates, reconciles, taxes, debits, validates funding capacity, or derives geometry/style from amounts.
- Public packaging includes a visitor-first README, architecture and provenance docs, relative Pages asset validation, and SHA-pinned verify/deploy workflows. Nothing has been pushed or deployed.
- The final Impeccable pass removed the side-stripe/ghost-card residue, improved presentation typography and coarse targets, added Escape closure to transient surfaces, tokenized shared relationship colors, and repaired the remaining Retirement total/label lanes.

## Verification

- ESLint, TypeScript, production build, and Pages asset validation pass in the integration worktree.
- Unit/component: 35 files, 240 tests passed.
- Full Chromium: 26/26 journeys passed.
- All four stories pass presentation geometry and readability checks at 1280x720, 1440x900, and 1920x1080: bounded content, no module/label collisions, no unrelated route crossings, and enforced text floors.
- Independent Task 5 review found no P0/P1 defects. Its three P2 findings - coarse-pointer targets, per-theme presentation surfaces, and fake-height connector ports - were repaired and covered before integration.
- The independent Impeccable baseline was 13/20. The repaired build is 19/20 with no scoped P0/P1/P2 finding open; the remaining point is incomplete decorative tokenization in stable shared editor chrome.
- Fresh `npm run verify` passed: formatting, lint, TypeScript, 240 tests, production build, Pages asset validation, and 26 Chromium journeys. The Impeccable static detector returned zero findings.

## Known boundaries

- This is a clean portfolio demonstration, not production financial-planning software or financial advice.
- Authoring requires at least 1180x660 and shows an honest cover below that minimum; presentation targets the three verified desktop viewports.
- Draft persistence is local and synchronous. There is no backend, cloud sync, collaboration, authentication, or arbitrary import/export.
- Stale local drafts can mask updated starter defaults until Reset.
- No branch has been pushed, merged, deployed, or released.

## Next action

Review the local checkpoint. Push, open a pull request, enable Pages, merge, deploy, or release only with explicit user approval.
