# Project state

**Updated:** 2026-07-19  
**Branch:** `codex/reference-reset-2026-07-19`  
**Last checkpoint:** `322afdb`  
**Phase:** 1 complete — standalone scaffold

## Completed

- Replaced the calculation-era runtime with a Vite 8, React 19, TypeScript 6, and Vitest 4 foundation.
- Added the Cairn starter chooser with four equal entry points and synthetic-data labeling.
- Replaced the 1,500+ legacy checks with a focused unit and Chromium smoke surface.
- Added strict typecheck, ESLint, Prettier, production build, and one-command verification.
- Added SHA-pinned GitHub Actions verification and removed obsolete public screenshot media.

## Verification

- `npm run verify` — pass in 11 seconds.
- Unit: 1 passed.
- Chromium: 1 passed.
- Production bundle: 61.01 kB gzip JavaScript.
- `npm audit` — 0 vulnerabilities after install.

## Known limitations

- Selecting a starter currently opens a scaffold canvas rather than the real editor.
- The typed financial document model, commands, history, persistence, nodes, edges, and presentation system are not yet implemented.
- Nothing from this rebuild has been pushed or deployed.

## Next action

Implement the literal-safe document model, immutable command/history layer, and versioned local draft persistence with test-first financial firewall coverage.
