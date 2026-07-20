# Independent Impeccable design critique

**Audited HEAD:** `d9563ecd5da7d9356c6a7a28a6062fabc1583fd2`
**Method:** Independent review performed without reading the prior critique or `PROJECT.md`; source inspection plus fresh browser sessions across all four starters in authoring and presentation.
**Date:** 2026-07-19

## Verdict

**22/40 — Acceptable foundation with significant release blockers.**

The authoring canvases demonstrate substantive financial-product judgment, real primitive variation, strong literal-value discipline, and credible direct editing. Presentation mode currently degrades the strongest work through clipping, crowded labels, weak focus states, and unreliable framing. This is not publish-ready as a portfolio demonstration.

**Findings:** P0 0 · P1 5 · P2 5 · P3 1.

## Nielsen scorecard

| #         | Heuristic                           |     Score | Key issue                                                                                         |
| --------- | ----------------------------------- | --------: | ------------------------------------------------------------------------------------------------- |
| 1         | Visibility of system status         |       2/4 | Cadence, zoom, selection, and step state are clear; draft/save state is not visible.              |
| 2         | Match between system and real world |       3/4 | Advisor language, literal values, provenance, and story metaphors are strong.                     |
| 3         | User control and freedom            |       3/4 | Undo, Escape, Back, cancellation, and presentation exit work; presentation lacks camera recovery. |
| 4         | Consistency and standards           |       3/4 | Shared editor behavior is cohesive; presentation quality diverges from authoring.                 |
| 5         | Error prevention                    |       2/4 | Financial guardrails are strong; Reset is irreversible and new objects can overlap content.       |
| 6         | Recognition rather than recall      |       2/4 | Primary controls are visible; many capabilities remain selection-dependent.                       |
| 7         | Flexibility and efficiency          |       3/4 | Direct editing, shortcuts, palette, multi-selection, routes, and quick creation are substantive.  |
| 8         | Aesthetic and minimalist design     |       1/4 | Presentation collisions and the chooser's familiar AI-editorial grammar damage credibility.       |
| 9         | Error recovery                      |       2/4 | Undo and Escape restoration are strong; Reset clears both draft and history.                      |
| 10        | Help and documentation              |       1/4 | Microcopy exists, but there is little visible onboarding or contextual guidance.                  |
| **Total** |                                     | **22/40** | **Acceptable**                                                                                    |

## P1 findings

### Presentation camera does not reliably fit rendered stories

Roth clipped content and labels at 1440×900. Retirement and RMD underused the stage at larger viewports. Presentation disables camera recovery while the stage clips overflow.

Evidence: `src/money-map/styles/canvas.css:1248`, `src/money-map/canvas/MoneyMapCanvas.tsx:255`, and `src/money-map/canvas/MoneyMapCanvas.tsx:524`.

### Relationship labels dominate every presentation

Long, duplicated label/cadence copy collides with modules and other relationships. Presentation forces enlarged, non-wrapping labels into authored geometry.

Evidence: `src/money-map/styles/canvas.css:1282` and `src/money-map/styles/canvas.css:1366`.

### Five story steps do not create five focused views

Step changes add outlines but retain all unrelated modules and labels at full opacity. The result reads as Overview plus highlight instead of a guided story.

Evidence: `src/money-map/styles/canvas.css:1269` and `src/money-map/styles/canvas.css:1277`.

### Reset Story is destructive and non-undoable

With no selection, Actions exposes Reset as the only command. Reset discards the saved draft and constructs fresh history without confirmation or recovery.

Evidence: `src/money-map/editor/useMoneyMapEditor.ts:113` and `src/money-map/editor/commands.ts:313`.

### Default cadence framing hides the primary story in three starters

Retirement Monthly shows one relationship across ten objects. Foundation Monthly hides the annuity/premium story. Roth Annual omits the destination, reserve, and guardrail relationships. RMD Annual is the only default that communicates its core narrative.

## P2 findings

- New-object placement uses visible viewport center without occupancy checks and can cover authored content (`MoneyMapWorkspace.tsx:77`).
- Draw Flow can present ten ungrouped destinations in a scrolling panel (`FlowTargetPicker.tsx:21`).
- Empty-selection Actions communicates only the most destructive command.
- Add-menu names couple geometry to financial meaning, weakening the near-freeform model (`AddMenu.tsx:14`).
- The starter chooser uses a familiar beige editorial/numbered-list aesthetic that lowers first-impression credibility.

## P3 finding

React Flow attribution remains visible during authoring. This is legally acceptable but makes the portfolio surface read more like a library demonstration.

## Positive findings

- Literal financial content and synthetic provenance are unusually disciplined.
- The eight shapes render as materially different primitives rather than simple rectangular skins.
- Direct editing, immediate creation focus, Enter/blur commit, Escape restoration, and shared undo behavior are strong.
- The honest minimum-viewport cover works.
- Four themes are genuinely differentiated.

## Run notes

- Deterministic detector: `node C:\Users\Cyril\.agents\skills\impeccable\scripts\detect.mjs --json src` → `[]`.
- Browser logs: no warnings or errors.
- Inspected all four starters in authoring and presentation; additional checks at 1440×900 and below the authoring minimum.
- Audit server and browser tabs were stopped after inspection.

## Supported-desktop remediation

A subsequent scoped repair closed the objective desktop presentation defects at the three supported viewports. It compacted presentation spacing without lowering tested type floors, reduced visible relationship-label density while retaining complete accessible names, rendered text annotations as footnotes, and corrected the few authored lanes that still collided. New browser assertions cover content containment and communication geometry rather than wrapper bounds alone.

This note records remediation evidence; it does not replace the independent critique or manufacture a new score. Reset safety, default cadence storytelling, focus treatment, onboarding, and chooser direction remain separate product decisions.
