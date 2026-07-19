# Project state

**Updated:** 2026-07-19
**Branch:** `codex/reference-reset-2026-07-19`
**Checkpoint:** Task 3B low-friction editing, one command registry, and exact persisted history
**Phase:** 3B complete — shared editing checkpoint committed locally

## Completed

- Generalized the command registry with generic context/result types while preserving duplicate rejection, registration order, availability, search, `EditorCommand`, and `createDocumentCommands` behavior.
- Added one canonical workspace registry for inline/style/properties/connections surfaces, duplicate/remove, undo/redo, reset, width presets, and all six primitive styles.
- Added a focused editor hook that owns document history, starter-scoped versioned drafts, transient selection/announcements, exact undo/redo, stale-selection cleanup, Reset, and single-write Strict Mode persistence.
- Added one screen-space selection halo: Edit, Style, Connect, Duplicate, More for one module; Duplicate, Remove, and Small/Standard/Wide widths for one multi-selection toolbar.
- Added the visible Actions control and Ctrl/Cmd+K palette with availability filtering, label/keyword search, stable order, arrow/Enter/Escape behavior, and focus restoration.
- Added exact inline title/row-value/total-value editing with double-click or Enter, select-on-open, Enter/blur commit, Escape restore, IME safety, and canvas shortcut suspension.
- Added compact Content / Appearance / Connections properties with collapsed supporting content, primitive/width alternatives, exact undoable field edits, relationship listing, and an honest Add connection explanation without writing Task 3C data.
- Added horizontal-only 220–480 resize handles with 24px hit areas and end-only document commits; module height remains content-driven and text size does not scale.
- Routed drag, nudge (8/32 world px), duplicate, remove, edit, primitive, width, undo, and redo through one persisted history while selection, viewport, edit buffers, and open surfaces remain transient.
- Added clamped/flipped compact surface placement, keyboard focus treatments, 24px minimum targets, coarse-pointer 44px targets, and corrected provenance to “Synthetic demo · advisor-entered values”.
- Hardened simultaneous document/selection commits so React Flow cannot echo stale selected flags after Duplicate, while preserving the approved atomic selection paths.
- Added focused and Chromium coverage for exact literals, reference preservation, registry parity, history/persistence, halo/palette/properties, resize, nudge, keyboard controls, focus restoration, reload isolation, and Reset.

## Verification

- Initial focused Task 3B GREEN suite: 8 files, 39 tests passed; additional mutation, selection-sync, Strict Mode, surface-placement, and keyboard regressions passed.
- Final fresh `npm run verify`: pass in 18.0 seconds.
- Complete unit/component suite: 20 files, 126 tests passed.
- Chromium suite: 8/8 journeys passed.
- Formatting, ESLint, TypeScript, production build, financial source guard, and existing camera/selection/minimum-cover coverage are included in the full gate.

## Known limitations

- Connection creation/reconnect, custom route geometry, waypoints, label editing, and cadence filters remain Task 3C.
- The four starters remain intermediate scaffolds; final starter art direction remains Task 4.
- Presentation mode remains Task 5.
- Draft persistence is local and synchronous by design; there is no backend, cloud sync, collaboration, or arbitrary import/export.
- Nothing from this rebuild has been pushed or deployed.

## Next action

Implement Task 3C custom connector editing, reconnect, route/label treatment, and cadence filters on top of the one-registry Task 3B history without adding financial computation.
