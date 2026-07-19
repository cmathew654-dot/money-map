# Project state

**Updated:** 2026-07-19
**Branch:** `codex/reference-reset-2026-07-19`
**Checkpoint:** Task 2 review hardening — `fix: harden money map foundation guards`
**Phase:** 2 complete — literal-safe domain foundation

## Completed

- Defined the shared Money Map document schema for all starters, with every financial display value represented only as a literal string.
- Added immutable module and flow updates, compound selection removal, deterministic duplication, and text-independent geometry projection.
- Added reference-preserving generic undo/redo history with no-op and future-clearing semantics.
- Added versioned, starter-scoped draft persistence with runtime corruption checks and exact JSON string round-tripping.
- Added the shared command registry and canonical `selection.duplicate` and `selection.remove` commands for later editor surfaces.
- Added synthetic fixtures and financial-firewall coverage for exact literals, mutation isolation, geometry independence, source-level numeric-coercion guards, commands, history, and persistence.
- Hardened draft loading against recursive forbidden financial keys, command availability against stale selections, and removal reference preservation for untouched collections.
- Replaced the shallow source regex with a self-tested scanner covering production `.ts` and `.tsx`, parsing/coercion calls, compact and compound financial arithmetic, and unary coercion while ignoring strings, comments, type-only names, and geometry arithmetic.

## Verification

- `npm test -- src/money-map/model/persistence.test.ts src/money-map/source-guard.test.ts src/money-map/commands/registry.test.ts src/money-map/model/document.test.ts` — 49 passed across 4 files in 1.01 seconds.
- `npm run verify` — pass in 10.2 seconds.
- Unit: 54 passed across 6 files.
- Chromium: 1 passed.
- Production bundle: 61.01 kB gzip JavaScript.

## Known limitations

- Selecting a starter still opens the scaffold canvas; the React Flow canvas and editor interactions are not implemented yet.
- The domain layer contains representative synthetic fixtures only; the four fully authored starter documents arrive after the shared editor API is frozen.
- Draft persistence is local and synchronous by design; there is no backend, cloud sync, collaboration, or arbitrary import/export.
- Nothing from this rebuild has been pushed or deployed.

## Next action

Implement Task 3: the shared React Flow canvas, node and edge editing, command surfaces, selection, camera controls, and accessible keyboard/pointer interaction on top of this domain foundation.
