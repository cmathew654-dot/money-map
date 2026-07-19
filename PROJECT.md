# Project state

**Updated:** 2026-07-19
**Branch:** `codex/reference-reset-2026-07-19`
**Checkpoint:** Task 3B low-friction editing, one runtime command registry, exact persisted history, and independent-review hardening
**Phase:** 3B complete - reviewed editing checkpoint committed locally

## Completed

- Generalized the command registry with generic context/result types while preserving duplicate rejection, registration order, availability, search, `EditorCommand`, and `createDocumentCommands` behavior.
- Added one canonical workspace registry for inline/style/properties/connections surfaces, duplicate/remove, undo/redo, reset, width presets, and all six primitive styles.
- Made the halo, style surface, advanced Appearance controls, palette, and keyboard routing consume resolved runtime command definitions so labels, availability, IDs, and shortcuts cannot drift.
- Added one screen-space selection halo: single-module actions only for exactly one selected item, and one group toolbar anchored to selected modules for multi-module or mixed module/relationship selections.
- Added the visible Actions control and Ctrl/Cmd+K modal palette with availability filtering, label/keyword search, stable order, arrow/Enter behavior, root-captured Escape, contained Tab/Shift+Tab, a close control, and exact invoker focus restoration.
- Added exact inline title/row-value/total-value editing with double-click or Enter, select-on-open, Enter/blur commit, Escape restore, IME safety, and canvas shortcut suspension.
- Added compact Content / Appearance / Connections properties with synchronized module/history drafts, synchronized command-selected tabs, collapsed supporting content, primitive/width commands, exact undoable field edits, relationship listing, and an honest Add connection explanation without writing Task 3C data.
- Made Style and Properties mutually exclusive, moved focus into each opened surface, restored focus to the selected module on close, and made Connect switch an already-open properties surface to Connections.
- Added horizontal-only 220-480 resize handles with 24px hit areas and end-only document commits; module height remains content-driven and text size does not scale.
- Routed drag, nudge (8/32 world px), duplicate, remove, edit, primitive, width, undo, and redo through one persisted history while selection, viewport, edit buffers, and open surfaces remain transient.
- Made removal prune deleted module and relationship IDs from every presentation step in the same undoable document mutation, including flows removed incidentally with a module.
- Added clamped/flipped compact surface placement, keyboard focus treatments, 24px minimum targets, coarse-pointer 44px targets, and preserved the provenance string "Synthetic demo · advisor-entered values".
- Hardened simultaneous document/selection commits so React Flow cannot echo stale selected flags after Duplicate, while preserving the approved atomic selection paths.
- Added focused and Chromium coverage for exact literals, reference preservation, registry metadata propagation, history/persistence, mixed-selection halo behavior, palette focus containment, properties freshness, panel focus, presentation integrity, resize, nudge, keyboard controls, reload isolation, and Reset.

## Verification

- Independent-review RED suite: 12 targeted regressions failed across the reviewed seams before the repair.
- Focused review GREEN suite: 7 files, 40 tests passed.
- Complete unit/component suite: 21 files, 136 tests passed.
- Chromium suite: 10/10 journeys passed.
- Production bundle: 129.80 kB gzip JavaScript and 5.93 kB gzip CSS.
- Final fresh `npm run verify`: pass.
- Formatting, ESLint, TypeScript, production build, financial source guard, and existing camera/selection/minimum-cover coverage are included in the full gate.

## Known limitations

- Connection creation/reconnect, custom route geometry, waypoints, label editing, and cadence filters remain Task 3C.
- The four starters remain intermediate scaffolds; final starter art direction remains Task 4.
- Presentation mode remains Task 5.
- Draft persistence is local and synchronous by design; there is no backend, cloud sync, collaboration, or arbitrary import/export.
- Nothing from this rebuild has been pushed or deployed.

## Next action

Implement Task 3C custom connector editing, reconnect, route/label treatment, and cadence filters on top of the one-registry Task 3B history without adding financial computation.
