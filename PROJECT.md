# Project state

**Updated:** 2026-07-19

**Branch:** `codex/reference-reset-2026-07-19`

**Checkpoint:** Task 4 shared starter/theme contract freeze

**Phase:** Shared API ready; four isolated final starter compositions are next

## Current product

- Four synthetic advisor story starters open in one React Flow authoring system. Financial content remains exact display text; no amount is parsed, calculated, reconciled, taxed, debited, or used for geometry/style.
- Modules and relationships share one command registry, persisted undo history, local per-starter drafts, direct/advanced editing, resize, routing, reconnect, cadence filters, selection, and accessible keyboard/pointer behavior.
- Custom relationships support straight, orthogonal, and curved routes; authored waypoints; flow, association, and planned semantics; plain, plate, and filled labels; exact custom cadence; and 24px/44px targets.
- Camera controls include wheel/pinch and keyboard zoom, fit map/selection, 100%, and an honest 1180 x 660 authoring minimum.

## Task 4 contract freeze

- Split the former monolithic scaffold into `retirement.ts`, `rmd.ts`, `annuity.ts`, and `roth.ts` without redesigning their current module/flow content.
- Added exhaustive starter IDs, one shared 1440 x 760 artboard, chooser metadata, typed starter definitions, an exhaustive registry, and a deep-cloning `createStarterDocument` factory.
- Kept `getScaffoldDocument` only as a tested temporary compatibility alias. App and editor runtime callers now use the canonical registry/factory.
- Added Overview plus the exact five required story-step names to every scaffold so isolated workers can replace the temporary focus assignments without changing shared APIs.
- Added an exhaustive theme registry and four token-only theme files. The workspace projects the persisted style as one class/data attribute; shared CSS consumes semantic visual tokens while geometry, commands, literals, type/padding anatomy, targets, and relationship semantics remain shared.
- Added structural contracts for exhaustive style mapping, clone isolation, unique IDs, valid non-self endpoints, complete Overview, focus-step endpoint ownership, width limits, and shared-artboard bounds.

## Verification

- Test-first RED: starter/theme imports were absent; the workspace lacked a theme data/class hook.
- Focused GREEN: 5 files, 20 tests passed.
- Fresh `npm run verify`: pass.
- Prettier, ESLint, TypeScript, production build, financial source guard, unit/component, and Chromium: pass.
- Unit/component: 29 files, 187 tests passed.
- Chromium: 17/17 journeys passed.
- Production bundle: 134.54 kB gzip JavaScript and 6.91 kB gzip CSS.
- `git diff --check`: pass.

## Known limitations

- The four documents still contain their intermediate module/flow scaffolds. Their five named steps currently use temporary focus assignments derived from those flows; worker branches must replace them with final authored focus sets.
- Per-starter primitive/route/relationship/label/cadence variety, collision-free final composition, and art-direction quality are intentionally not claimed by this freeze checkpoint.
- Presentation chrome, final step navigation, responsive presentation repair, and screenshot evidence remain Task 5.
- Stale local v1 drafts can mask new defaults until Reset; visual verification must reset each starter first.
- Draft persistence remains local and synchronous. No backend, cloud sync, collaboration, arbitrary import/export, or production-advisory claim exists.
- Nothing from this rebuild has been pushed or deployed.

## Next action

Fork four isolated worktrees from this exact contract SHA. Each worker edits only its starter file/test, matching theme CSS, report, and branch-local project snapshot. Integrate Retirement, RMD, Annuity, and Roth sequentially with focused tests and a full verification gate after each.
