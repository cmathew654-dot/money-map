# Task 3C report - custom relationship editing

## Status

- Status: DONE
- Local checkpoint: this commit (`fix: harden relationship editing`), atop `0e3880d`
- Push/deploy: not performed
- Schema/persistence validator: unchanged

## Delivered

- One custom React Flow edge for every relationship.
- Deterministic straight/polyline, orthogonal/Manhattan, and curved geometry with authored waypoints and label anchors.
- Redundant non-financial semantics: solid directional flow, dotted non-directional association, dashed directional planned; constant resting weight/color and selection-only accent.
- Plain, paper-plate, and filled label treatments with exact primary, secondary, and cadence text.
- Inline click/Enter label editing; 6px pointer drag threshold; screen-to-world waypoint conversion; 8/32 world-pixel keyboard routing; waypoint reset.
- Public React Flow connect/reconnect callbacks and handles plus keyboard source/target controls.
- Neutral Add connection behavior that creates one relationship, selects it, and opens label editing.
- Transient All/Monthly/Annual/Other cadence filtering with atomic hidden-selection cleanup.
- Canonical registry entries for label edit/properties, all route/semantic/treatment/cadence choices, and waypoint reset.
- Focus/target/reduced-motion styling, portal event isolation, and controlled mixed-selection preservation.

## Test-first evidence

- Geometry, mutation, and registry tests began RED against absent APIs; focused GREEN reached 22 tests.
- Custom-edge tests began RED before the renderer existed; GREEN covers exact text/ARIA, semantics/treatment, click-vs-drag, keyboard routing, inline commit, path targeting, and portal propagation.
- Relationship-properties, cadence-filter, and real Add connection tests began RED and passed after the surfaces were implemented.
- Browser regression exposed two genuine integration defects: portal clicks reached the canvas and cleared the relationship; then React Flow's node selection superseded an externally controlled edge during Shift-click. Both were repaired without weakening assertions; focused mixed-selection browser coverage passes 2/2.
- Three lean Task 3C journeys pass 3/3: exact label + appearance + undo/redo; pointer drag + keyboard nudge + reset/undo; keyboard reconnect + exact custom cadence + filter + reload.

## Review repair

- Axis-aligned orthogonal routes retain an intentional dogleg; curved routes retain a visible perpendicular bow; label anchors stay on the authored route.
- Create/reconnect mutations reject self-links and invalid endpoints with the exact original document reference; endpoint selectors omit the opposing endpoint.
- Pointer reconnect is available whenever exactly one relationship is selected, while create handles are lifecycle-bound to the live Connections tab.
- The delayed mixed-selection bridge was replaced by synchronous selection intent/revision state; rapid Shift-add, filtering, and Escape cannot replay stale selections.
- Fine/coarse connector targets are 28/44 px; visible create/reconnect handles are 24/44 px.
- A browser-discovered render race in drag click suppression received a RED rerender regression and a ref-backed fix with pointer-cancel/lost-capture cleanup.

## Fresh verification

- `npm run verify`: exit 0.
- Format, lint, TypeScript, source guard, and production build: pass.
- Unit/component: 27 files, 177 tests.
- Playwright Chromium: 16/16 journeys.
- Production bundle: 429.69 kB JavaScript / 134.04 kB gzip; 33.21 kB CSS / 6.57 kB gzip.
- `git diff --check`: pass before commit.

## Design and safety decisions

- No financial-looking string is parsed or used for geometry, style, cadence, warnings, or command availability.
- Pointer client coordinates are converted with `screenToFlowPosition`; persisted waypoints are world coordinates.
- Path construction is local and deterministic; no Pro example or private React Flow API was copied.
- Relationship document changes go through the existing registry/history/persistence path. Filters, surfaces, selection, and pointer drafts remain transient.
- Invalid reconnect endpoints return the exact original document; exact literals, unrelated references, and the `$300,000` / `$250,000` coexistence invariant remain intact.

## Remaining concerns

- No Critical or Important Task 3C concern is known.
- Pointer reconnect is verified through public callbacks, immutable mutations, adapter eligibility, and a physical Chromium journey that drags both source and target endpoints.
- Windows Vite/Vitest/Playwright child processes require the approved out-of-sandbox execution path.