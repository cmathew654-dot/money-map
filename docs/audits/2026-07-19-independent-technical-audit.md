# Independent Impeccable technical audit

**Audited HEAD:** `d9563ecd5da7d9356c6a7a28a6062fabc1583fd2`
**Method:** Independent source and runtime audit performed without reading the prior critique or `PROJECT.md`.
**Date:** 2026-07-19

## Verdict

**12/20 — Acceptable, with significant work needed before publication.**

**Findings:** P0 0 · P1 1 · P2 1 · P3 1.

## Audit scorecard

| Dimension         |     Score | Key finding                                                                                                      |
| ----------------- | --------: | ---------------------------------------------------------------------------------------------------------------- |
| Accessibility     |       2/4 | Strong semantics and keyboard support; presentation collisions and clipped controls prevent WCAG AA confidence.  |
| Performance       |       3/4 | Sensible memoization, no runtime warnings, and 143.16 kB gzip JavaScript.                                        |
| Theming           |       3/4 | Four coherent tokenized themes with several shared hard-coded colors.                                            |
| Responsive Design |       2/4 | Supported desktop presentation content overflows; mobile authoring and presentation are explicitly out of scope. |
| Anti-Patterns     |       2/4 | Distinctive overall, but decorative numbering and a side-stripe hover remain.                                    |
| **Total**         | **12/20** | **Acceptable**                                                                                                   |

## P1 findings

### Presentation typography and labels exceed authored geometry

At 1280×720:

- Retirement: four modules had descendant overflow; the annuity and installment-note modules intersected.
- RMD: two modules overflowed and relationship labels intruded into endpoint content.
- Foundation: four labels deeply overlapped their endpoint modules.
- Roth: seven modules overflowed; one relationship label began outside the presentation stage.

Presentation overrides force 29 px titles, 20 px details/notes, 34 px totals, and non-wrapping labels into fixed authored geometry.

Evidence: `src/money-map/styles/canvas.css:1248-1373` and starter fixtures. Existing presentation tests check wrapper bounds but not visible descendant containment, rotated bodies, stage-bounded labels, or deep endpoint-label overlap.

## P2 finding

Shared canvas styles directly encode several role, overlay, label, and selected-control colors instead of theme-aware tokens. The current themes render coherently, but future theme and contrast changes are harder to make atomically.

Evidence: `src/money-map/styles/canvas.css:74-1055`.

## P3 finding

The chooser uses decorative `01–04` numbering for equal-weight stories and a banned colored side-stripe hover treatment.

Evidence: `src/app/App.tsx:41-49` and `src/styles.css:137-155`.

## Positive findings

- All four authoring compositions remained bounded at 1280×720.
- The 1179×720 minimum cover prevented mounting a compromised canvas.
- Presentation keyboard structure, focus restoration, announcements, and primary target sizes are strong.
- Tested core contrast pairs ranged from 5.03:1 to 14.60:1.
- Reduced-motion handling exists.
- Four themes are visibly distinct.
- Runtime produced no browser warnings.
- Build output remained within budget.

## Reproduced checks

- Formatting, ESLint, and TypeScript passed.
- Vitest: 35 files, 272 tests passed.
- Playwright: 30/30 passed, including the new real port-to-existing-module pointer journey and WebKit smoke.
- Production build: 470.27 kB JavaScript / 143.16 kB gzip; 50.12 kB CSS / 9.48 kB gzip.
- Detector: `[]`.

## Scope decision

Mobile authoring and mobile presentation are explicit non-goals and were removed from scoring. The supported-desktop presentation finding remains the release gate. Findings were not automatically remediated during the evidence-repair pass.

## Supported-desktop remediation

A subsequent scoped repair addressed the supported 1280Ã—720 and 1440Ã—900 presentation failure without adding mobile scope:

- presentation spacing now fits fixed authored geometry while preserving tested type floors;
- text-only annotations render as concise presentation footnotes;
- visible presentation labels keep the primary advisor-authored relationship text while full cadence and secondary text remain in the accessible name;
- Retirement, RMD, Foundation, and Roth received narrowly authored lane corrections where necessary;
- the browser gate now checks visible content overflow, rendered module-body collisions, stage-bounded labels, label/label collisions, deep endpoint-label collisions, unrelated label/module collisions, and unrelated route/module intersections.

The complete Chromium presentation suite passed at 1280Ã—720, 1440Ã—900, and 1920Ã—1080. The original audit score remains a preserved baseline rather than being manually rewritten.
