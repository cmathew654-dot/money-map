# Money Map agent contract

Work only from this repository root. Do not run project commands from the user home directory or the parent worktree directory.

## Sources of truth

1. `PRODUCT.md` — product intent and non-goals.
2. `DESIGN.md` — interaction and visual grammar.
3. `docs/reference-principles.md` — sanitized product-pattern research.
4. `PROJECT.md` — concise current-state handoff and verification snapshot.

## Non-negotiable rules

- Financial display values are literal strings. Never parse them for arithmetic, capacity checks, taxes, warnings, geometry, color, stroke weight, or flow behavior.
- Numeric domain values are forbidden. Numbers are allowed only for geometry, viewport state, ordering, and schema versions.
- All four starters must receive equal authoring, presentation, responsive, accessibility, and evidence quality.
- Use test-driven development for behavior changes: failing test, minimal implementation, passing test, refactor.
- Keep shared state and commands centralized. Do not create starter-specific behavior forks.
- Keep one object model, one flow model, one selection model, and one command registry. Toolbar, halo, palette, shortcuts, and inspector must invoke the same commands.
- Every change must remove obsolete controls and terminology and stay within the recorded dependency and bundle budgets. Implement directly; use subagents only for genuinely parallel read-only work. Do not create subtask briefs, reports, or review loops. Run focused checks during development and the full gate only after a complete user-visible checkpoint.
- Do not expose implementation concepts such as handles, edges, nodes, or connection mode in user-facing language.
- Update `PROJECT.md` before every checkpoint commit and whenever work pauses. Rewrite it as a snapshot; do not append a diary.
- Do not push, merge, deploy, tag a release, or delete archival worktrees without explicit user approval.

## Verification

- Focused development: `npm test -- <test-file>`
- Typecheck: `npm run typecheck`
- Full local gate: `npm run verify`
- Visual baselines may only be updated after inspecting the rendered output.
