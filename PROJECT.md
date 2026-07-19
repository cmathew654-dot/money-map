# Project state

**Updated:** 2026-07-19

**Branch:** `codex/reference-reset-2026-07-19`

**Checkpoint:** Task 4 complete — four equal-finish starters

**Phase:** Task 4 complete; shared presentation implementation next

## Current product

- Four synthetic advisor story starters share one React Flow authoring system, command registry, persisted undo history, direct/advanced editing, custom relationship renderer, cadence filters, and accessible camera/selection controls.
- Financial content remains exact display text. Nothing parses, calculates, reconciles, taxes, debits, validates funding capacity, or derives geometry/style from amounts.
- The frozen starter registry deep-clones defaults; four scoped theme files may change decorative art direction without changing shared behavior or financial semantics.

## Task 4 progress

- The shared starter/theme API freeze at `29f3b67` is independently approved.
- Retirement Income is now a complete Private Ledger composition with nine modules, seven relationships, a reserved lower routing lane, and exact Overview plus five authored focus states.
- Retirement uses all six visual primitives; straight, orthogonal, and curved routes; flow, planned, and association semantics; plain, plate, and filled labels; and Monthly, Annual, Other, and exact custom cadence.
- Exact authored literals include `~$11,800/mo`, `~$16,000/mo`, `$37,818 gross`, `After W/H: $25,471`, `$21,475/yr gross`, and `Up to $105,000`.
- RMD now has eight modules, seven relationships, all route/relationship/label/cadence variants, and Overview plus five named distribution steps.
- Annuity now has six distinct modules and six semantic relationships, preserving the `$250,000` source and `$300,000 — revised illustration` premium plan as independent literal display text with no funding-capacity inference.
- Roth now has seven modules, eight relationships, all relationship vocabulary, and five distinct endpoint-owning focus states across its 2026/2027 conversion story.
- The seven stale Annuity journeys now use final source-to-plan-to-contract semantics; the shared relationship panel also stays usable near the lower viewport edge.

## Verification

- Retirement RED: three fixture/theme contract failures against the intermediate scaffold.
- Retirement focused GREEN: 2 files, 8 tests passed.
- Fresh `npm run verify`: pass in the integration worktree.
- Prettier, ESLint, TypeScript, financial source guard, and production build: pass.
- Unit/component: 33 files, 210 tests passed.
- Chromium: 17/17 journeys passed.
- Production bundle: 137.26 kB gzip JavaScript and 7.49 kB gzip CSS.

## Known limitations

- All four final starters are integrated and green. The rendered 1440×760 probes report zero module/module, label/module, label/label, and unrelated path/module intersections.
- Default author compositions still need cross-starter visual collision checks after all four branches land.
- Presentation chrome, named-step navigation behavior, responsive presentation repair, and screenshot evidence remain Task 5.
- Stale local v1 drafts can mask new defaults until Reset; visual verification must reset each starter first.
- Draft persistence is local and synchronous. No backend, cloud sync, collaboration, arbitrary import/export, or production-advisory claim exists.
- Nothing from this rebuild has been pushed or deployed.

## Next action

Implement the shared presentation system with persistent metadata, Overview plus five named steps, keyboard navigation, reduced motion, and bounded responsive compositions.
