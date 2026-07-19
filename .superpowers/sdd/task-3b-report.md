# Task 3B report ? one command system, halo, palette, direct editing, history, resize

## Status

- Status: DONE
- Local checkpoint: this commit (`feat: add low-friction money map editing`)
- Push/deploy: not performed

## RED evidence

### Initial Task 3B contract suite

Command:

`npm test -- src/money-map/commands/registry.test.ts src/money-map/editor/commands.test.ts src/money-map/editor/useMoneyMapEditor.test.tsx src/money-map/editor/InlineField.test.tsx src/money-map/editor/CommandPalette.test.tsx src/money-map/editor/SelectionHalo.test.tsx src/money-map/editor/AdvancedProperties.test.tsx src/money-map/canvas/resize.test.ts`

Observed before production implementation:

- Exit code 1.
- Six suites failed to resolve intentionally absent editor modules.
- Resize tests failed because clamp/resize APIs were absent.
- The pre-existing registry suite remained green.

### Exact immutable field edits and nudge

Command: `npm test -- src/money-map/editor/mutations.test.ts`

Observed before implementation: exit 1 because the mutation module was absent. The GREEN tests prove one nested literal edit preserves unrelated module/row/flow references and nudge changes only selected geometry by exact world pixels.

### Simultaneous document/selection synchronization

Command: `npm test -- src/money-map/canvas/MoneyMapCanvas.test.tsx`

Observed before the fix: the new regression received a stale `source-account` selection callback when document and selection changed together. This reproduced the Chromium Duplicate update loop. The fix marks only external controlled-selection synchronization as pending, ignores the stale combined payload, and retains every approved user selection path.

### Strict Mode persistence

Command: `npm test -- src/money-map/editor/useMoneyMapEditor.test.tsx`

Observed before the fix: one committed edit wrote storage twice under React Strict Mode. History transitions now use a synchronous history ref and pure state assignment, so every commit saves exactly once.

### Surface placement and keyboard controls

- `surfacePosition.test.ts` initially failed to resolve the absent clamp/flip helper.
- The focused canvas test initially showed Enter on a focused button was prevented by canvas editing shortcuts. Interactive controls now retain Enter/arrow behavior while Escape, camera, and command shortcuts remain available.

## Files changed

- `commands/types.ts`, `commands/registry.ts`, and tests ? generic registry plus backward-compatible document commands.
- `editor/commands.ts` and tests ? canonical workspace command objects and results.
- `editor/useMoneyMapEditor.ts` and tests ? starter drafts, history, selection validation, named steps, exact undo/redo/reset, Strict Mode single-save behavior.
- `InlineField`, `SelectionHalo`, `CommandPalette`, `AdvancedProperties`, `EditorInteractionContext`, mutations, surface placement, and tests ? low-friction editing surfaces and shared interactions.
- `MoneyMapNode.tsx`, `MoneyMapCanvas.tsx`, adapters, resize tests, and CSS ? one halo, exact inline fields, horizontal end-only resize, keyboard parity, history-routed drag/nudge, accessible targets/focus, and stale-selection hardening.
- `MoneyMapWorkspace.tsx` ? one editor integration, Actions palette, compact style/properties surfaces, persistence, focus restoration, and corrected provenance.
- `tests/e2e/app.spec.ts` ? eight Chromium journeys covering all prior canvas behavior plus Task 3B authoring/history/persistence.
- `PROJECT.md` ? measured Task 3B snapshot and Task 3C handoff.

## Verification

- Initial focused GREEN suite: 8 files, 39 tests.
- Final fresh `npm run verify`: exit 0 in 18.0 seconds.
- Prettier, ESLint, TypeScript, financial source guard, and production build: pass.
- Unit/component: 126/126 across 20 files.
- Chromium: 8/8.
- Production bundle: 129.36 kB gzip JavaScript and 5.93 kB gzip CSS.
- `git diff --check`: pass before commit.

## Self-review

- Financial literals are copied and replaced only as strings; no parsing, formatting, normalization, or value-driven geometry/style was added.
- Halo, palette, shortcuts, style menu, and advanced properties execute canonical registry IDs against one history.
- Inline edits, advanced fields, style, width, drag, nudge, duplicate, and remove are undoable; viewport, selection, surfaces, and edit buffers are not persisted.
- Resize is horizontal, clamped 220?480, committed only on end, and has presets; height remains DOM/content-driven and text does not scale.
- Connections only list current relationships and explain the next step; no Task 3C relationship mutation, presentation, or final art direction was added.
- Compact surfaces clamp/flip beside the selected module, controls have visible focus, and primary targets meet the requested minimums.

## Concerns

- No known Critical or Important Task 3B concerns.
- Operational note: Vite/Vitest/Playwright child processes require the approved out-of-sandbox path on this Windows environment.

