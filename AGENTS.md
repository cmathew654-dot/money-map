# Money Map agent contract

Work only from this repository root. Do not run project commands from the user home directory or the parent worktree directory.

## Sources of truth

1. `PRODUCT.md` — product intent and non-goals.
2. `DESIGN.md` — interaction and visual grammar.
3. `docs/superpowers/plans/2026-07-19-money-map-portfolio-rebuild.md` — execution plan.
4. `PROJECT.md` — concise current-state handoff.

## Non-negotiable rules

- Financial display values are literal strings. Never parse them for arithmetic, capacity checks, taxes, warnings, geometry, color, stroke weight, or flow behavior.
- Numeric domain values are forbidden. Numbers are allowed only for geometry, viewport state, ordering, and schema versions.
- All four starters must receive equal authoring, presentation, responsive, accessibility, and evidence quality.
- Use test-driven development for behavior changes: failing test, minimal implementation, passing test, refactor.
- Keep shared state and commands centralized. Do not create starter-specific behavior forks.
- Update `PROJECT.md` before every checkpoint commit and whenever work pauses. Rewrite it as a snapshot; do not append a diary.
- Do not push, merge, deploy, tag a release, or delete archival worktrees without explicit user approval.

## Verification

- Focused development: `npm test -- <test-file>`
- Typecheck: `npm run typecheck`
- Full local gate: `npm run verify`
- Visual baselines may only be updated after inspecting the rendered output.

