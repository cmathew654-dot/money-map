# Architecture

Money Map is a client-only React application with one shared authoring system and four data-driven starters.

## Boundaries

- `src/app` owns entry and starter selection.
- `src/money-map/model` defines the document schema, immutable document operations, history, and validated local persistence. Financial display fields are strings; numeric domain values are deliberately absent.
- `src/money-map/starters` contains the four synthetic documents and their authored Overview plus five focus states. The registry returns deep-cloned defaults so one draft cannot mutate another.
- `src/money-map/commands` and `src/money-map/editor` own the command registry, editing orchestration, transient surfaces, selection rules, and accessibility announcements. Palette, shortcuts, selection halo, and property panels resolve the same command definitions.
- `src/money-map/canvas` translates typed documents into React Flow nodes and edges. Custom renderers own module and relationship interaction; route geometry depends only on authored world coordinates and route choices.
- `src/money-map/themes` and `src/money-map/styles` own visual grammar. A theme may change tokens and decorative treatment, never behavior or the meaning of a financial value.

## State and data flow

```text
starter registry
  -> validated document + per-starter local draft
  -> editor history and selection
  -> shared commands / immutable mutations
  -> canvas adapters
  -> custom React Flow renderers
```

Committed document edits enter one undo/redo history and are saved synchronously to a starter-scoped `localStorage` key. Selection, filters, viewport, open surfaces, and inline drafts are transient. Reset clears the stored draft and restores a fresh clone of the selected starter.

The canvas reports drag, resize, selection, connection, and waypoint intent back to the editor. The editor applies a typed mutation, validates selection against the resulting document, announces the result, and then renders the next document. Financial text is copied or replaced verbatim; it is never parsed for arithmetic, warnings, capacity, geometry, or styling.

## Maintainability rules

- Add shared behavior through the command/mutation layer, not starter-specific conditionals.
- Keep starter differences in fixtures and theme tokens.
- Preserve immutable updates so history and focused renders remain predictable.
- Treat React Flow as a rendering/interaction dependency behind adapters, not as the domain model.
- Reject persisted data that adds unknown or financially computed fields.

## Testing

Vitest covers document invariants, persistence validation, history, commands, geometry, adapters, renderers, editor surfaces, accessibility behavior, all four starter contracts, and the financial source guard. Playwright covers representative keyboard, pointer, persistence, focus, filtering, relationship, and reset journeys in Chromium. The production build is followed by `npm run check:pages`, which rejects root-relative or missing asset references before a Pages artifact can be uploaded.
