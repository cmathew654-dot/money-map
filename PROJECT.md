# Project state

**Updated:** 2026-07-19  
**Branch:** `codex/reference-reset-2026-07-19`  
**Last verified commit:** `b52a6f1`  
**Phase:** 0 — execution contract

## Completed

- Confirmed this directory is an isolated Git worktree for `cmathew654-dot/money-map`.
- Preserved the legacy calculation prototype behind the existing archive branch and tag.
- Locked the product, design, repository, financial-safety, checkpoint, and release contracts.

## Verification

- `git status --short --branch` — clean before contract files were created.
- Git worktree isolation verified through distinct Git and common directories.
- Legacy full Playwright suite intentionally not rerun; it is the oversized calculation-era suite being replaced.

## Known limitations

- The checked-out application is still the legacy calculation-heavy prototype.
- The new standalone React application has not yet been scaffolded.
- Nothing from this rebuild has been pushed or deployed.

## Next action

Commit the execution contract, then replace the legacy scaffold with the standalone React/TypeScript foundation and a lean verification gate.

