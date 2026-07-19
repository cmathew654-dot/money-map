# Project state

**Updated:** 2026-07-19

**Branch:** `codex/reference-reset-2026-07-19`

**Checkpoint:** Task 4 Retirement Income / Private Ledger

**Phase:** Shared API frozen; Retirement final fixture complete; RMD, Annuity, and Roth isolated workers in progress

## Current product

- Four synthetic advisor story starters share one React Flow authoring system, command registry, persisted undo history, direct/advanced editing, custom relationship renderer, cadence filters, and accessible camera/selection controls.
- Financial content remains exact display text. Nothing parses, calculates, reconciles, taxes, debits, validates funding capacity, or derives geometry/style from amounts.
- The frozen starter registry deep-clones defaults; four scoped theme files may change decorative art direction without changing shared behavior or financial semantics.

## Task 4 progress

- The shared starter/theme API freeze at `29f3b67` is independently approved.
- Retirement Income is now a complete Private Ledger composition with nine modules, seven relationships, a reserved lower routing lane, and exact Overview plus five authored focus states.
- Retirement uses all six visual primitives; straight, orthogonal, and curved routes; flow, planned, and association semantics; plain, plate, and filled labels; and Monthly, Annual, Other, and exact custom cadence.
- Exact authored literals include `~$11,800/mo`, `~$16,000/mo`, `$37,818 gross`, `After W/H: $25,471`, `$21,475/yr gross`, and `Up to $105,000`.
- RMD, Annuity, and Roth are being implemented in isolated local worktrees from the frozen contract SHA. Their branches cannot modify shared canvas/model/editor files.

## Verification

- Retirement RED: three fixture/theme contract failures against the intermediate scaffold.
- Retirement focused GREEN: 2 files, 8 tests passed.
- Fresh `npm run verify`: pass in the integration worktree.
- Prettier, ESLint, TypeScript, financial source guard, and production build: pass.
- Unit/component: 30 files, 191 tests passed.
- Chromium: 17/17 journeys passed.
- Production bundle: 135.55 kB gzip JavaScript and 7.08 kB gzip CSS.

## Known limitations

- Only Retirement is final on the integration branch. RMD, Annuity, and Roth remain intermediate here until their isolated commits pass review and are integrated sequentially.
- Default author compositions still need cross-starter visual collision checks after all four branches land.
- Presentation chrome, named-step navigation behavior, responsive presentation repair, and screenshot evidence remain Task 5.
- Stale local v1 drafts can mask new defaults until Reset; visual verification must reset each starter first.
- Draft persistence is local and synchronous. No backend, cloud sync, collaboration, arbitrary import/export, or production-advisory claim exists.
- Nothing from this rebuild has been pushed or deployed.

## Next action

Checkpoint Retirement locally, review it independently, then integrate reviewed RMD, Annuity, and Roth commits one at a time with `PROJECT.md` and the full verification gate updated after each.
