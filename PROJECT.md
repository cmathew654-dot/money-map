# Project state

**Updated:** 2026-07-19

**Branch:** `codex/reference-reset-2026-07-19`

**Checkpoint:** Task 3C custom relationship editing

**Phase:** Task 3C complete locally; ready for Task 4 starter composition

## Current product

- Four synthetic advisor story starters open in a React Flow authoring canvas with exact display-only financial strings. Nothing parses, reconciles, taxes, debits, validates, or derives geometry/style from amounts.
- One persisted document/history model now covers module and relationship edits, undo/redo, per-starter local drafts, and Reset. Selection, camera, open surfaces, pointer drafts, and cadence filters remain transient.
- One runtime command registry drives the halo, command palette, keyboard shortcuts, module surfaces, and relationship properties.
- Modules support direct literal editing, drag/nudge, horizontal resize, six visual primitives, duplicate/remove, compact advanced properties, and connection creation.
- Relationships use one custom edge renderer with distinct straight/polyline, orthogonal/Manhattan, and curved routes; authored waypoints; solid flow, dotted association, and dashed planned semantics; and plain, paper-plate, or filled labels.
- Relationship labels preserve primary text, secondary text, and cadence exactly. Click/Enter edits; pointer drag beyond 6 screen px routes without opening the editor; arrows move 8 world px and Shift+Arrow moves 32; Reset removes the authored label waypoint.
- Either endpoint can reconnect through React Flow handles or keyboard-selectable source/target controls. Add connection creates one neutral default, selects it, and opens exact label editing.
- Cadence is display-only. All, Monthly, Annual, and Other are transient author filters; hiding a selected relationship clears that selection atomically.
- Canvas controls include wheel/keyboard zoom, subtle camera controls, fit map/selection, honest 1180 x 660 minimum cover, visible focus, 24px pointer targets, and 44px coarse-pointer targets.

## Task 3C implementation notes

- Geometry is owned by a deterministic path builder and depends only on endpoints, route, and waypoints.
- Resting relationship color/weight are constant. Direction and class are redundant through marker, dash pattern, and literal label; accent indicates selection only.
- Portal label events are isolated from the canvas pane. A controlled-selection bridge preserves an already selected relationship when Shift-click adds a module.
- All relationship mutations are immutable, exact-string, command/history backed, and persistence-compatible. The existing schema and validator required no change.
- No private or Pro React Flow implementation was copied; connection/reconnect use public callbacks and handles.

## Verification

- Test-first RED evidence covered absent geometry/mutations/commands, absent custom edge and surfaces, connection creation, filter selection cleanup, portal event bubbling, and controlled mixed selection.
- Fresh `npm run verify`: pass.
- Prettier, ESLint, TypeScript, production build, and financial source guard: pass.
- Unit/component: 26 files, 160 tests passed.
- Chromium: 15/15 journeys passed, including the three Task 3C contract journeys.
- Production bundle: 133.17 kB gzip JavaScript and 6.54 kB gzip CSS.
- `git diff --check`: pass before checkpoint.

## Known limitations

- The four starters are still intermediate scaffolds; Task 4 must give every story a finished wealth-advisor composition and resolve final routing/label placement at target viewports.
- Presentation mode, named story steps, final presentation chrome, and export remain Task 5.
- Pointer reconnect is implemented with React Flow's public reconnect handles and covered at callback/mutation level; the lean browser contract exercises the keyboard endpoint path because pointer-handle automation is brittle. Task 4/5 visual audit should manually exercise both endpoints once.
- Draft persistence is local and synchronous. There is no backend, cloud sync, collaboration, arbitrary import/export, or production security posture.
- Nothing from this rebuild has been pushed or deployed.

## Next action

Implement Task 4: finish all four starter compositions to the same portfolio-quality visual and narrative standard, preserving the Task 3C interaction grammar and financial-string invariants. Then run the scoped visual/accessibility audit before Task 5 presentation mode.
