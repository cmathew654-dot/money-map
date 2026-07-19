# Project state

**Updated:** 2026-07-19
**Branch:** `codex/reference-reset-2026-07-19`
**Checkpoint:** Task 3A review hardening — literal-safe labels, content-driven nodes, and verified interaction evidence
**Phase:** 3A complete — shared authoring canvas foundation, review-hardened

## Completed

- Added one shared React Flow canvas for all four starters with literal-safe document/node/edge adapters and immutable final node movement.
- Added one memoized module renderer spanning every primitive and module kind through data attributes, with semantic authored content, quiet four-sided handles, exact literal values, accessible node labels, and distinct focus/selection states.
- Added transient camera and selection behavior: pointer-centered wheel/pinch zoom, empty-pane/middle/Space panning, Shift marquee/multi-select, click selection, Escape clear, and keyboard zoom/Fit commands.
- Added bottom-left screen-space zoom, 100%, Fit map, and Fit selection controls; Fit selection falls back to the complete map when nothing is selected.
- Added a responsive workspace shell with Cairn identity, story metadata, synthetic-data provenance, polite move/selection announcements, and an honest 1180 by 660 authoring minimum cover that does not mount React Flow.
- Added intermediate literal-only scaffold documents for Retirement Income, RMD & Withholding, Annuity Income Floor, and Roth Conversion so every starter exercises the same shared canvas.
- Hardened the review checkpoint so accessible labels join authored fragments byte-for-byte, module height is measured from DOM content, all selection paths announce, and camera animations honor reduced motion.
- Strengthened adapter/component/Chromium evidence for punctuation/placeholders/ranges, node and edge callback synchronization, additive/marquee selection, final world movement, numeric zoom changes, Fit commands, keyboard Fit parity, and drag displacement relative to a stationary node.

## Verification

- Focused Task 3A tests: 7 files, 40 tests passed.
- `npm run verify`: pass in 13.9 seconds.
- Formatting, ESLint, and TypeScript: pass.
- Unit/component: 85 passed across 11 files.
- Chromium: 4 passed.
- Production bundle: 121.92 kB gzip JavaScript and 4.98 kB gzip CSS.

## Known limitations

- The four starter documents are intentionally small intermediate scaffolds; fully authored fixtures and distinct final art directions arrive in Task 4.
- Task 3A does not include the selection halo, command palette, inline or advanced editing, width resize, custom edge editing/routing, cadence filters, or presentation mode.
- Draft persistence remains local and synchronous by design; there is no backend, cloud sync, collaboration, or arbitrary import/export.
- Nothing from this rebuild has been pushed or deployed.

## Next action

Implement Task 3B shared editing surfaces and command parity on top of the frozen canvas/camera/selection checkpoint without creating starter-specific behavior forks.
