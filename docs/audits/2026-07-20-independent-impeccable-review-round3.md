# Independent Impeccable review — 2026-07-20 (round 3)

**Reviewed:** working tree at `2381eb3` plus the full uncommitted remediation.
**Method:** identical harness to rounds 1 and 2, re-run fresh with no cached results. Five blind evaluators denied access to `PROJECT.md`, `AGENTS.md`, `docs/audits/*` and all prior scores; every P0/P1/P2 adversarially verified by an independent agent instructed to refute it; scores re-derived from surviving evidence only. 39 agents.

## Verdict

**Design critique: 24/40** — gate FAIL  
**Technical audit: 14/20** — gate FAIL

### Three runs of the same harness

| Run                                 | Design | Technical |
| ----------------------------------- | ------ | --------- |
| Round 1 (pre-remediation tree)      | 26/40  | 13/20     |
| Round 2 (after rounds 1-2 of fixes) | 27/40  | 15/20     |
| Round 3 (after integration pass)    | 24/40  | 14/20     |

The score is oscillating within a band rather than converging. Two causes, both real:

1. **Measurement variance.** Each run uses fresh blind evaluators who legitimately weight different defects. Round 3 surfaced presentation type-hierarchy findings the earlier runs did not emphasise, and independently RAISED Match to Real World to 4/4 and Responsive Design to 3/4.
2. **Regression churn.** Several fixes introduced new defects. Confirmed self-inflicted across rounds: toolbar overflow (an ellipsis cap and a new Legend button added to the same row by different agents), a step-rail line-clamp that does not engage in current Chromium, off-screen module placement after the search envelope was widened, loss of two-column row alignment as a side effect of fixing value/label overprint, an uncapped content-sized width leaking into the multiline textarea, and arrow keys inside the presentation camera toolbar advancing the story step.

The last two were fixed after this run and are not reflected in the 24/40.

## The consistent signal across all three rounds

Every independent round, with different evaluators, identifies **presentation mode as the weakest surface** — not the authoring canvas. Round 3 states it plainly: the authoring canvas alone would earn 4/4 on Aesthetic and Minimalist Design, while the presentation surface that PRODUCT.md calls "a first-class output" is the worst-composed part of the build. Presentation collapses the type hierarchy the editor establishes, inflates totals against fixed authored geometry, and compresses module spacing until text collides.

This is a design problem, not a defect list. Patching individual collisions has been tried across three rounds and has not moved the dimension. The presentation type and spacing system needs to be derived from the authored geometry rather than scaled on top of it.

## Design scorecard

| Heuristic                                               | Score     | Basis                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visibility of System Status                             | 2/4       | Zoom percentage, cadence state, focus rings, selection ports and presentation step chips all read clearly, and aria-live announcements fire for selection, inline commit, undo and relationship creation. Independently verified again |
| Match Between System and Real World                     | 4/4       | Held at 4; no confirmed finding attacks the vocabulary. Verified on screen: account taxonomy, RMD/withholding, QCD, income rider, DAF, ILIT, cadence phrasing all land as an advisor would say them, and the financial-truth boundary  |
| User Control and Freedom                                | 3/4       | RAISED from provisional 2. The provisional rationale rested substantially on "Reset story is third from the top of the palette" — refuted. Verified in CommandPalette.tsx:22-31 and commands.ts:368: three constructive commands lead, |
| Consistency and Standards                               | 2/4       | LOWERED from provisional 3 on the strength of three confirmed findings the provisional evaluator did not have. Finding 11: three flow-label treatments (plain / plate / dark filled chip) coexist arbitrarily inside a single composit |
| Error Prevention                                        | 2/4       | Held at 2. The domain guardrails are the best thing here and are genuinely excellent: nothing is computed, blanks stay blank, approximation marks and ranges round-trip exactly, and the non-drag flow target picker eliminates a whol |
| Recognition Rather Than Recall                          | 3/4       | Held at 3. Real strengths, verified on screen: Add menu labels carry financial glosses, halo actions are text-labeled rather than icon-only, the legend is one click, cadence filters are named, step chips are named. Gaps are consis |
| Flexibility and Efficiency of Use                       | 2/4       | LOWERED from provisional 3. The accelerator layer is genuinely rich — Ctrl/Cmd+K palette with fuzzy search, L for Draw flow, Ctrl+D, Delete, Ctrl+Z / Ctrl+Shift+Z, Enter to edit, cadence filtering, Fit story / Fit selection / 100% |
| Aesthetic and Minimalist Design                         | 2/4       | LOWERED from provisional 3; this is the most consequential change and I reproduced it myself rather than inheriting it. The authoring canvas alone would earn a 4 — distinctive serif/sans pairing, four real art directions, restrain |
| Help Users Recognize, Diagnose, and Recover from Errors | 2/4       | Held at 2. Recovery genuinely works — undo restores state, and reset now routes through applyDocument so the persisted draft matches what is on screen and stays undoable. The app even authors the correct recovery sentence ("Starte |
| Help and Documentation                                  | 2/4       | Held at 2. Genuine contextual strengths: the legend is non-modal and one click, the Add menu's financial glosses teach the shape vocabulary through action, and the narrow-viewport cover is an honest, well-written state rather than |
| **Total**                                               | **24/40** |                                                                                                                                                                                                                                        |

## Technical scorecard

| Dimension         | Score     | Basis                                                                                                                                                                                                                                  |
| ----------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility     | 3/4       | Held at 3. The affirmative evidence is extensive and independently measured: zero contrast failures across four themes x three viewports x both modes (worst 4.76:1), full keyboard traversal of authoring and presentation, a correct |
| Performance       | 3/4       | Lowered from the provisional 4. The wall-clock numbers are genuinely excellent and I do not dispute them: 2 requests / 156 kB transferred, FCP 100ms, load 65ms, starter-to-canvas 115ms, pan and zoom flat at 16.7ms median with zero |
| Theming           | 3/4       | Held at 3, at the bottom of the band. The token system is real and substantial: ~55 custom properties covering role accents, hairlines, inks, scrims and 13 tinted shadows, 11 --map-* keys with exact parity across all four theme fi |
| Responsive Design | 3/4       | Lowered from the provisional 4, and none of the reduction comes from mobile - I scored only the three supported desktop viewports and the documented minimum, per instruction. The viewport-driven behavior is genuinely excellent: ze |
| Anti-Patterns     | 2/4       | Lowered from the provisional 3. I want to be clear about what is strong, because it is a lot: nobody would look at this and say an AI made it. The register is committed and specific - editorial ledger typography, eight distinct sh |
| **Total**         | **14/20** |                                                                                                                                                                                                                                        |

## Confirmed findings

### P1

**Presentation mode collapses the type hierarchy the editor establishes**

Presentation applies a blunt ~1.4-1.7x type scale to row/label text while collapsing module padding from 20px to 5px against fixed world geometry. Result across all four starters: the three-level hierarchy (12/13/23) flattens to (16/19/20/29), so data rows nearly equal the serif title; values run flush to the card border with no inset ($37,818 gross, $2,436,000, ~$860,000); labels wrap and collide with hairline separators ("Annual grants", "Medicare review", "Planning status"); roundel prose ove

**Presentation output is visibly worse-composed than the authoring view it is meant to polish**

In presentation the row rules disappear (row padding 0, gap 0), two-word labels wrap onto two lines across most modules ("Social Security", "Rental income", "Annual grants", "Income rider", "Medicare review", "Planned range"), and 20-32px values sit ~6px from the card border. PRODUCT.md sells presentation as first-class output; today the editor renders more composed than the presentation. The comments in canvas.css show this was iterated toward a "legibility floor" — the floor is being bought wi

**Presentation mode collapses module spacing and blows up totals, causing text collision in every starter**

Side by side, the same 'Income sources' node goes from a composed editorial card to a wreck: 'Social Security' wraps and its second line collides with the rule above 'Rental income'; 'income' collides with the rule above 'Consulting'; text touches all four strokes at 5px padding; '~$11,800/mo' becomes a 34px hero metric that dwarfs its own labels. In Annuity Income Floor, 'Premium plan' shows 'Planned premium' and '$300,000 — revised illustration' interleaving across wrapped lines while the bott

**Arrow keys inside the presentation camera toolbar also advance/retreat the story step**

Item 8's camera-recovery toolbar is an ARIA toolbar with roving tabindex, so it is a single Tab stop reached by keyboard — but it is nested inside <main class="money-map-presentation" onKeyDown={handleKeyDown}>. useToolbarNavigation calls event.preventDefault() and focuses the next button, but never stops propagation, so the same ArrowRight/ArrowLeft reaches PresentationShell.handleKeyDown and calls showStep(±1). A keyboard advisor who tabs to the camera controls mid-presentation and presses Rig

**Content-sized inline width is applied to the multiline note textarea with no cap**

`shared` is spread into the textarea branch too, so a note field's width is driven by total character count rather than by wrapping. Double-clicking a 200-character note produces `width: 202ch` on a `rows={3}` textarea inside a ~320px node — roughly 1600px wide, overflowing the node and the canvas. `.inline-field` in canvas.css:639-650 sets `width: 100%` but declares no `max-width`, and the inline style overrides it outright, so nothing clamps it. The same unbounded growth applies to the single-

### P2

**Every relationship occupies two identical keyboard tab stops**

The path and its label are separately focusable by design, but they announce the same sentence, so a screen-reader user hears each relationship twice with no way to tell which stop is the route and which is the label. On Retirement Income that is 14 stops before the first module; reaching the far-right Insurance trust card takes roughly 32 tabs with no skip link or roving-tabindex group. Distinguish the two names ("...route" vs "...label") and make the canvas a single tab stop with arrow-key tra

**Newly drawn flows place their label on top of existing cards**

The authored starters have carefully placed labels; the first flow a user creates immediately breaks that quality bar. The label also opens in inline-edit with the text preselected, which swallows Ctrl+Z and Ctrl+K until committed, so a user who reaches for undo at that moment gets nothing. Place new labels at a clear point on the route (nearest gap, or offset off the midpoint if the midpoint intersects a module bounding box).

**Focus is dropped to <body> after inline text editing commits or cancels**

DESIGN.md explicitly contracts focus restoration. Every other dismissable surface honors it; the most-used editing action does not. A keyboard user who edits a shape's title must re-Tab through the entire header, canvas, 7 edge groups and 7 flow labels (19 Tab presses, measured) to get back to the shape they were editing. WCAG 2.4.3.

**role="application" on the canvas has no accessible name**

role="application" switches assistive tech out of browse mode. An unnamed application region gives a screen-reader user no announcement of what they just entered or what keys are available. Name the React Flow container (ariaLabel prop) and consider aria-roledescription plus a describedby pointing at the shortcut hints.

**Edge focus indicator swaps the semantic dash pattern for a solid stroke**

DESIGN.md states relationship semantics are "redundantly conveyed by pattern and label". Making focus a pattern change means a focused replenishment edge visually reads as an income edge. It passes WCAG 2.4.7 (something visible changes) but fails 2.4.11 focus-appearance sizing and creates semantic ambiguity. Use a casing halo or offset outline that preserves the dash pattern.

**Three flow-label treatments coexist with no legible semantic difference**

Plain/plate/filled are legitimate authoring options, but the shipped starters use all three arbitrarily within a single composition, so a viewer reasonably infers the dark chip means something the plain text doesn't — and it doesn't. The Roth Conversion case is worse: two labels with identical text and identical relationship type render differently, which reads as a bug.

**Raw color literals remain in canvas.css, and one leaks an un-themed carbon into the Conversion Path art direction**

Tokenization is real and substantial (~55 custom properties covering role accents, hairlines, inks, scrims, and 13 tinted shadows), so this is a large improvement — but it is not complete, and at least one remaining literal is a live themeable role. The ledger cap rule is overridden by `border-color` in private-ledger.css, distribution-registry.css and foundation.css; conversion-path.css has no ledger rule, so the warm carbon #47473f renders unmodified inside the "near-white, aubergine, controll

**Properties surface height budget is fixed at open time and never recomputed on tab switch**

`positionEditorSurface` clamps `top` to `viewport.height - margin - size.height`. Opening "More properties" passes the 250px content budget, so `top` may sit up to 150px lower than the 400px appearance budget allows. Switching to the Appearance tab calls only `setPropertiesTab` — the surface is never re-placed — so the now-400px-tall panel is anchored with a 250px clamp and its bottom 150px runs off the viewport. Repro: select a module low in the canvas, run "More properties", click the Appearan

**Playwright retries enabled locally in the same change that adds animated camera effects and timing-based e2e assertions**

The change is defensible as local/CI parity, but the timing matters. This same diff replaces React Flow's declarative `fitView` prop with an effect-driven `fitStep()` that animates for 220ms and re-registers a resize listener on every step change, and adds e2e assertions that read a CSS transform string after a fixed 400ms sleep and assert exact string equality (`expect(overviewTransformAgain).toBe(overviewTransform)`). Those are the classic ingredients of a flake, and turning on local retries i

**Roundel ellipse-containment threshold is calibrated to a 3% margin against the known-bad value**

The test's own comment documents that the failure mode it guards against sits at 1.50-1.52 and the pass threshold is 1.46. That is a ~3% band, and the measured quantity is a text element's `getBoundingClientRect` — which is a function of font loading, line-height rounding, and browser text-metrics. A font-version bump or a one-line content edit on the densest roundel flips this test in either direction without any real regression or fix. The honest alternative is to inset the sampled rectangle b

### P3

**Fit story at 1280x720 lands at 65%, below the readable floor for body copy**

1280x720 is a supported desktop viewport and comfortably above the stated 1180x660 authoring minimum, yet the default camera on entry produces text the advisor cannot read without immediately zooming. The first thing a 1280-wide user does is fight the camera. Either clamp Fit story to a minimum legible scale (and accept cropping with a pan hint), or let the fit target the authored default story view rather than the full extent.

**Presentation step chips truncate the story-step names**

The step names are the advisor's own narrative spine and the only navigation in presentation. Truncating them in the one control that selects them means the presenter has to remember which chip is which while a client is watching. With six chips and a full 1440px bar there is room; give the chips a wider max-width, or number them and show the full name in the header.

## Refuted findings

- **"Reset story" destroys authored work with no confirmation and no visible way back** (P1) — Reproduced the exact scenario headless against dist/ (vite preview :4363): opened Roth Conversion, renamed "Traditional IRA" to "ZZZ EDITED TITLE", ran Actions > Reset story. Confirmed: no confirm dialog (document.queryS
- **Presentation mode renders text outside its container (absolute ban)** (P1) — Does not reproduce against the current working tree, on two independent grounds.

(1) ALREADY HANDLED. The finding characterizes presentation mode as applying dt/dd 20px with a flat 5px module padding to unchanged author

- **Roughly a dozen chrome colors are frozen to the Private Ledger art direction across all four themes** (P2) — The MEASUREMENTS reproduce exactly. I served dist/ headless on :4371 and probed all four starters with Playwright. Command-palette selected-row bg is rgb(232,224,210), palette border rgb(131,121,104), input border rgb(15
- **The starter chooser screen sits entirely outside the token system** (P2) — REFUTED. The raw counts reproduce, but every load-bearing claim fails, and this finding was already adjudicated in a prior round.

1. ALREADY REFUTED AND RECORDED. C:\Users\Cyril\Projects\.portfolio-remediation-worktrees

- **Command palette does not behave or look like a command palette** (P1) — Reproduced live against the current working tree (fresh dist/ newer than src, served headless on 4372, module selected, Ctrl+K) and nearly every load-bearing claim fails.

Refuted: (1) "exposes seven commands, omitting E

- **Flagship starter ships with a flow-label occlusion in its default composition** (P1) — REFUTED as stated. I served the current dist build headless on port 4367 (vite preview --strictPort), opened the Retirement Income starter at 1440x900 and 1280x720, measured live DOM geometry, and captured a 5x-deviceSca
- **Curved shapes clip and overflow their own content** (P1) — REFUTED — the claimed defect does not reproduce, including in the reviewer's own evidence files.

Method: served `dist/` headless (vite preview, ports 4371/4373, both killed), re-rendered the Roth Conversion editor and p

- **Cream body ground plus 84px serif display is the current saturated AI aesthetic family** (P1) — Reproduced everything the finding cites, then found the argument does not survive contact with the project's own documents or the rendered output.

What reproduces literally: C:/Users/Cyril/Projects/.portfolio-remediatio

- **Zero self-hosted fonts — the editorial identity is OS-dependent** (P1) — The literal facts reproduce; the defect does not.

WHAT CHECKS OUT (not disputed):

- C:/Users/Cyril/Projects/.portfolio-remediation-worktrees/money-map-approved-remediation-20260714/src/styles.css:4-11 is `Inter, ui-sans
- **Five mutually inconsistent button vocabularies across the chrome** (P2) — Reproduced headless against the current build (vite preview :4361; dist rebuilt 09:13 vs src 08:40, so dist is current). Every load-bearing factual claim fails.

1. "Header actions are outlined/filled buttons at 6px radi

- **Blank financial values render as raw ASCII underscores** (P2) — Reproduced the pixels, refuted the diagnosis.

What reproduces (verified headless at 1440x900 against dist/ served on :4377, screenshots read):

- RMD default view: "Instruction **% / $**___" in both Federal withholding
- **Spotlight priority renders as a PowerPoint SmartArt bevel** (P2) — REFUTED on four independent grounds, verified in the running app (dist served headless on 4383, computed styles dumped, screenshots read, server killed).

1. WRONG SUBJECT. The finding blames "Spotlight priority." The mo

- **Starter chooser pushes 2-3 of the four "equal-finish" starters below the fold at every supported viewport** (P2) — I reproduced the raw numbers but not the defect.

Measured (headless Chromium against `npx vite preview --port 4371` on the current dist, which is newer than src/styles.css and contains the new `.starter-entry` rules):
-

- **Double-click edit test cannot observe the real click sequence, so it asserts a guarantee the browser does not provide** (P2) — The mechanical premise reproduces: MoneyMapEdge.tsx:200-211 has onClick->select and onDoubleClick->select+beginEdit, MoneyMapEdge.test.tsx:140-146 uses fireEvent.doubleClick (which dispatches only dblclick) and asserts s

This document records measured results. No score was manually adjusted.
