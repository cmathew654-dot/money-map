# Independent Impeccable review — 2026-07-20

**Reviewed:** working tree at commit `2381eb3` plus uncommitted eight-finding remediation.
**Method:** five blind evaluators (Nielsen critique, technical audit, slop/craft, closure verification, code review), each denied access to `PROJECT.md`, prior audits, and prior scores. Every P0/P1/P2 finding was then adversarially verified by an independent agent instructed to refute it; refuted findings were discarded. Scores were re-derived from surviving evidence only by separate scorers who re-ran the app. 50 agents total.

## Verdict

**Design critique: 26/40** — gate FAIL  
**Technical audit: 13/20** — gate FAIL

Findings: 0 P0 · 10 P1 · 13 P2 confirmed after refutation. 14 findings were raised and then refuted; they are listed below so they are not re-litigated.

Prior baselines for comparison: 22/40 design and 12/20 technical, both measured against `d9563ec` before the eight-finding remediation. Those numbers are superseded by this review, not adjusted into it — this is an independent re-measurement.

## Design scorecard

| #         | Heuristic                                               | Score     | Basis                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status                             | 3/4       | HOLD 3. Confirmed strengths stand: live-region announcements on every mutation ("New account added.", "Undo complete.", "Starter scaffold restored."), persistent zoom %, step name + aria-current on th |
| 2         | Match Between System and Real World                     | 2/4       | LOWERED 3 -> 2 on new adverse evidence. Authored domain vocabulary is genuinely 4-quality ("2026 RMD", "After W/H", "QCD", "Tax-deferred / Tax-preferred", "As of July 2026", "Synthetic demo · advisor- |
| 3         | User Control and Freedom                                | 3/4       | RAISED 2 -> 3. The provisional's 2 was driven substantially by "a browser refresh silently discards everything" — REFUTED, and I verified the refutation firsthand rather than accepting its absence fro |
| 4         | Consistency and Standards                               | 2/4       | HOLD 2, now on much broader evidence than the provisional had. Three independent evaluators confirmed the 1280x720 breakdown (#5, #16, #22) — a supported viewport above DESIGN.md's own 1180x660 author |
| 5         | Error Prevention                                        | 3/4       | RAISED 2 -> 3. The refuted refresh-data-loss claim was being double-counted here; the rubric's "autosave and draft recovery" checkbox is in fact satisfied. Better than that, the draft loader is a genu |
| 6         | Recognition Rather Than Recall                          | 3/4       | HOLD 3. The Add menu's plain-language shape hints, the five-action halo placed on the object, and the shortcut hints beside palette rows are strong recognition work. Three confirmed gaps keep it off 4 |
| 7         | Flexibility and Efficiency of Use                       | 3/4       | HOLD 3. Real, plural accelerators: Ctrl+K palette, Ctrl+Z/Ctrl+D/Delete, L for draw flow, Enter to edit, arrow-key step navigation, Fit story / Fit selection / Fit step, cadence filter, and both drag- |
| 8         | Aesthetic and Minimalist Design                         | 2/4       | HOLD 2, and this is now the most heavily corroborated score on the card — four independent evaluators (#1, #2, #3, #11, #12, #15, #18, #19) plus my own first-hand reproduction. I rendered Retirement I |
| 9         | Help Users Recognize, Diagnose, and Recover from Errors | 3/4       | RAISED 2 -> 3. The provisional's 2 rested on "the two situations where a user actually loses work — Reset story and refresh — offer zero recovery," and half of that premise is refuted: refresh preserv |
| 10        | Help and Documentation                                  | 2/4       | HOLD 2. Two genuine contextual aids exist and they are good: the Add menu's per-shape usage hints ("Tray — Shallow tray — often short-term reserves") and the picker's "Choose a destination, or drag fr |
| **Total** |                                                         | **26/40** | 26/40 — Acceptable (top of band). Money Map's authoring shell is 30+ work: a distinctive editorial warm-paper aesthetic, four real per-starter art directions, n                                         |

## Technical scorecard

| Dimension         | Score     | Basis                                                                                                                                                                                                    |
| ----------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility     | 3/4       | Real depth, not decorative: keyboard-only traversal works end-to-end in authoring and presentation, focus is trapped and restored to the exact invoker on Escape across all three overlays (palette -> . |
| Performance       | 4/4       | Measured and independently reproduced, not assumed. My own npm run build returned 208 modules in 178 ms, dist JS 473.87 kB / 144.28 kB gzip, CSS 56.74 kB / 10.59 kB gzip, HTML 0.60 kB -- matching the  |
| Theming           | 2/4       | Verified directly. src/styles.css is 404 lines with 41 hex literals, and its only 6 var() references are local component variables (--hover-canvas, --hover-accent, --stone-x/y, --mark-base/mid/cap) ra |
| Responsive Design | 2/4       | Scored only on the three supported desktop viewports plus the documented minimum-viewport cover; mobile authoring/presentation excluded as a stated product non-goal. Genuinely solid: scrollWidth equal |
| Anti-Patterns     | 2/4       | The concept is emphatically not AI slop: Palatino/Iowan serif against a humanist sans is a real contrast-axis pairing, the cairn stone marks differ meaningfully per starter, the eight-primitive gramma |
| **Total**         | **13/20** | 13/20 — Acceptable (significant work needed), at the top of the band. Performance is excellent and independently reproduced (144.28 kB gzip JS, 60fps with zero                                          |

## Confirmed findings

### P1

**Presentation mode collides and overflows the client-facing numbers** (design-critique · Aesthetic and Minimalist Design / Nielsen 8)

The presentation type scale inflates value text without re-fitting the label/value row, so in the shipped starters the label and the figure overprint. This is the artifact a client sees in a meeting. An advisor cannot show a household a card where the balance is printed on top of the word "Balance" — it reads as broken software and undermines the exact credibility the product is built to establish. Fix: constrain the presentation value step (or make the row a min-content grid where the label wraps/truncates before the value scales), and add a fit check across all four starters at all three supported viewports.

Evidence: Presentation, Retirement Income, 1440x900 @2x (shots/05-crop-cards.png): Hartwell Giving Fund renders "Balanc" with "$185,000" printed on top of it; Traditional IRA's "$2,436,000" overruns its row rule to the card border. Same defect class in RMD & Withholding and Roth Conversion.

**Every roundel spills its content outside the ellipse in presentation** (design-critique · Aesthetic and Minimalist Design / Nielsen 8)

The roundel's content box is a rectangle laid over the ellipse rather than inscribed within it, so at presentation type sizes text escapes the shape on both sides and across the bottom curve. It affects all three starters that use a roundel — the shape reserved for goals and needs, the emotional centerpiece of the story. Fix: inscribe the content box (width = 2r/sqrt(2) at the vertical mid-band), or reserve the roundel for Essential density and clamp its text budget.

Evidence: shots/06-crop-roundel.png (Roth IRA) and shots/28-crop-roundel2.png (Outside tax reserve, Roth Conversion @2x): "Outside funds", "Outside tax", "Advisor entry" all begin left of the ellipse stroke; the note's last two lines cross the bottom stroke. Household need in RMD & Withholding does the same.

**Flow labels are struck through by their own edge lines** (design-critique · Aesthetic and Minimalist Design / Nielsen 8)

Plain-treatment labels render with no background casing, so wherever a label sits on its own path the line runs through the text — and DESIGN.md specifically promises "background-colored edge casing clarifies genuine crossings." It hits hardest on labels carrying dollar amounts, which are the ones a client reads. Fix: apply background casing to plain labels as well as plated ones, or default to plate for any label whose bounding box intersects its own path.

Evidence: shots/03-cadence-all.png: "QCD — Up to $105,000" bisected by the dashed vertical it labels. shots/21-present-1.png: "Household transfer", "Review distribution records", "2026 distribution" all overprinted by their edges. shots/21-present-3.png: "Reserve" and "Outside reserve" the same.

**Text overflows and collides inside modules — absolute-ban hit, worst in presentation** (technical-audit · Anti-Patterns)

SKILL.md bans text that overflows its container outright, and this is the client-facing output the whole product exists to produce. Presentation scales type up (totals render around 28px) without re-flowing or re-measuring the module box, so the __total row's label and value overlap and long notes clip against the border. The Conversion Path case is worse because it occurs in the default authored composition at the primary supported viewport with no user interaction at all. Fix by giving the total row an explicit two-column grid with a minimum column gap instead of an overlapping full-width dt, and by allowing module height to grow (or type to scale down) when presentation typography is appl

Evidence: crop-conv-overflow.png at 2× (Conversion Path, 1440×900): the note "A separate planning window, not a calculated continuation." is sliced horizontally by the module's bottom border, with 'continuation.' cut through mid-glyph; measured dx -19px, dy +4px past the module box. p-crop-daf.png at 2× (presentation, Private Ledger): the 'Balance' label is overlapped by '$185,000' in the Hartwell Giving Fu

**Roundel content escapes the ellipse silhouette in all four starters** (technical-audit · Anti-Patterns)

The roundel primitive lays content into its rectangular bounding box while the visual container is an ellipse, so text routinely sits outside the drawn shape. It reads as a rendering bug rather than a style, and it is the one primitive that fails this way in every theme and both modes — undercutting DESIGN.md's claim that all eight shapes are equally finished. Fix by insetting roundel content padding to the inscribed rectangle (width × 0.707, height × 0.707) or by switching roundel content to a shape-inside/clip-aware layout.

Evidence: Inscribed-ellipse test at 1440×900. Authoring: Private Ledger 'Core lifestyle' + 'Roth IRA' (4 elements outside), Distribution Registry 'Household need', Foundation 'Income floor', Conversion Path 'Outside tax reserve' (2 elements). Presentation is worse — Private Ledger reports 6 elements outside. Visually confirmed in p-crop-roth.png at 2×: 'Tax-preferred', '$291,000' and 'No lifetime RMDs — las

**Presentation mode overflows and collides text in every starter** (slop-and-craft · craft / product fitness — absolute ban: text that overflows its container)

Presentation re-renders objects at a ~1.35x type multiplier (16.2px / 17.5px / 20px / 29px / 32.2px / 34px — the fractional values give away a uniform scalar, not a designed ramp) while cutting module padding to 9px (canvas.css:1345), inside world geometry that by contract never reflows. Every authored object was sized against the editor scale, so the larger scale has nowhere to go. Label/value pairs collide, dollar ranges break mid-token, and the hairline row rules that carry the editor's ledger credibility vanish. The editor is the better-looking artifact; the client-facing one is the broken one. This inverts the product's whole premise.

Evidence: scratchpad/shots/11-present-crop-tray.png ("Balance" overlapping "$185,000"), 14-present-conversion.png ("$75,000–" / "$125,000" split; "Discussed / separately"; "No calculated / result"; roundel copy outside the ellipse); src/money-map/styles/canvas.css:1422-1540

**Flow edges strike through amount labels — reads as cancelled figures** (slop-and-craft · craft / financial-truth boundary)

DESIGN.md promises "background-colored edge casing clarifies genuine crossings." The casing is applied to path-on-path crossings but not to path-on-label. The consequence is worse than cosmetic: a horizontal rule through a dollar amount is the universal typographic convention for a superseded or void figure. On a document whose stated contract is that every value is displayed literally, the rendering contradicts the value.

Evidence: scratchpad/shots/11-present-crop-tray.png — dash-dot path runs horizontally through the center of "QCD — Up to $105,000"; same on "Legacy context" and on "2026 distribution" in 13-editor-registry.png

**Header and canvas chrome break at 1280x720** (slop-and-craft · layout — supported viewport)

At 1280x720 — a supported desktop viewport, above DESIGN.md's own 1180x660 authoring minimum — "+ Add" wraps to two lines, the "Ctrl K" hint inside Actions wraps to two lines, and the provenance line "Synthetic demo · advisor-entered values" wraps ragged. Separately, the floating CADENCE strip overlaps and obscures the top-left corner of the leftmost canvas object (no safe-area inset for floating chrome), and the selection halo action bar clamps flush to x=0 with zero margin from the window edge.

Evidence: scratchpad/shots/21-editor-1280.png and 22-halo-1280.png

**Story-step camera never reframes automatically — only the manual "Fit step" button moves it** (closure-check · Item 1 — story steps create focused views)

The de-emphasis half of this fix is real and good (participants full strength, non-participants opacity .3 + saturate .5, Overview unchanged, accessible names intact and no aria-hidden). The camera half is not. The effect at MoneyMapCanvas.tsx:286 does fire — the unit test at src/money-map/canvas/MoneyMapCanvas.test.tsx:635 asserts fitView({nodes, padding:0.22, duration:220}) and passes against a mocked useReactFlow — but against real React Flow the call is a no-op, most likely because the setNodes effect at line 230 replaces the node array in the same commit and the store's node lookup is not measured yet when fitView runs. Net user-visible result: five steps still share one framing; the pr

Evidence: src/money-map/canvas/MoneyMapCanvas.tsx:274-291 (fitStep + effect); measured live at 1440x900: viewport transform identical for Overview and all 5 steps ('translate(22.6301px, 9.49315px) scale(0.975342)', 98%), then 'translate(79.2316px, -337.642px) scale(1.24421)' (124%) only after clicking Fit step. Reproduced on all four starters (auto-changed: false x4; manual Fit step changed: true x4), via d

**Occupancy-aware placement falls back to dropping the new object on top of existing modules after ~8 adds** (closure-check · Item 2 — new objects must not spawn over existing content)

The ring search is bounded at 14 rings x 40px = ±560px around the viewport-center preferred point, and each candidate needs a 348x248 clear box (300x200 + 24px margin on all sides). With ten authored modules plus seven added ones in a starter, that window is exhausted and findOpenModulePlacement returns `preferred` unchanged — i.e. exactly the pre-fix 'spawn at viewport center' behavior, with no offset cascade, no expansion of the search beyond ±560px, and no user-visible signal. surfacePosition.test.ts:56 codifies this fallback as intended for a degenerate 20000x20000 blocker, so the test suite does not catch the realistic case. Reachable in under a minute of ordinary authoring.

Evidence: src/money-map/editor/surfacePosition.ts:117-145 (search) and :144 `return preferred`. Live at 1440x900 on Retirement Income: adds 1-7 placed clear; add 8 (Plate) landed at flow-space (564,290) overlapping retirement-installment-note by 174x80 px, retirement-annuity by 154x10, retirement-reserve by 106x10 (screenshot C:/Users/Cyril/AppData/Local/Temp/claude/C--Users-Cyril/f05cf857-0290-4f44-8c74-0e

### P2

**"+ Add" drops new objects off-screen behind the zoom controls** (design-critique · Visibility of System Status / Nielsen 1)

The primary authoring action places the object below all existing content and never pans the camera to it, so at every supported viewport the new object is half-hidden — including the inline title field the user is expected to type into. The halo then renders above the node, colliding with unrelated cards. Fix: place new objects in the visible viewport's free space (or at the pointer), and pan the camera to frame the object before entering inline edit.

Evidence: shots/13-palette-after-add.png (1440x900) and shots/26-palette-undo.png (1920x1080): after Add > Plate, the new "Account / New account" card lands at the bottom edge with its "Balance $____" row clipped by the viewport and the selection halo overlapping the Short-term reserve card above it.

**Overlays clip off the viewport bottom and the header wraps at 1280x720** (design-critique · Consistency and Standards / layout)

1280x720 is a supported authoring viewport and the likeliest one on a docked advisor laptop. The picker's inner list has its own 318px scroller but the panel itself is not clamped to the viewport, so the last rows sit below the fold; the header's provenance block and Add button have no min-width floor. Fix: clamp overlay panels to the viewport with the internal scroller absorbing the difference, and give the header a nowrap floor with the provenance line truncating.

Evidence: shots/17-picker-1280.png: flow-target picker measured at y=304, height=450, bottom=754 against a 720px viewport. Same shot: header renders "Synthetic demo · advisor-entered / values" across three lines with "values" orphaned, and "+ Add" breaks onto two lines.

**Single click edits a flow label but only selects a node, and the label editor clips its own value** (design-critique · Consistency and Standards / Error Prevention / Nielsen 4, 5)

Two primary object types respond to the identical gesture in incompatible ways, so an advisor clicking a label to reposition it instead starts editing a client-facing figure — and while editing cannot see the whole value, including the approximation mark that carries the product's financial-truth meaning. Fix: align the label to the node model (click selects, Enter/double-click edits) and size the inline input to its content.

Evidence: shots/24-edge-selected.png: one click on the "~$11,800 monthly — after tax" label opened an inline input showing "1,800 monthly — after tax" — the "~$" prefix scrolled out of view and the trailing text cut at the input's right edge.

**No legend for the four flow relationship patterns, in either mode** (design-critique · Help and Documentation / Nielsen 10)

Income, transfer, replenishment, and planned/conditional are conveyed by line pattern plus label, but nothing tells the client — or a new advisor — what the patterns mean, so the redundancy the design contract relies on collapses to label-only. Fix: ship the promised optional legend as a toggleable corner card in both authoring and presentation.

Evidence: Grep of src/money-map/editor and src/money-map/canvas returns no legend component; DESIGN.md line 64 promises "A small optional legend explains authored semantics." Presentation shows solid, dashed, and dash-dot routes side by side with no key (shots/21-present-1.png).

**Advisor-authored note text fails WCAG AA contrast on Private Ledger card gradients** (technical-audit · Accessibility)

WCAG 2.2 AA 1.4.3. The --map-muted token (#6a655b) is safe on the flat --map-surface but drops below threshold on the warmer end of the tray and roundel gradients, where the effective background is 20-30 luminance points darker than the token was tuned against. This is exactly the failure mode SKILL.md flags — muted gray body text on a tinted warm surface. It affects authored prose, which PRODUCT.md says must round-trip exactly and be read literally. Fix by darkening the note ink on gradient-backed primitives (toward #55504a gets both above 5:1) rather than lightening the gradients.

Evidence: Pixel-sampled from a real 1440×900 render (modal background of each text node's bounding box, sRGB relative luminance): "Refilled from the joint account." = 4.01:1 (rgb(106,101,91) on rgb(230,213,173)); "No lifetime RMDs — last money out." = 4.31:1 (rgb(106,101,91) on rgb(236,221,190)). Both 11px/400, requirement 4.5:1. 3 fails out of 86 measured text nodes.

**App shell chrome is hard-coded and identical across all four themes** (technical-audit · Theming)

DESIGN.md commits to four distinct art directions (warm paper / neutral field / graphite-chalk / near-white-aubergine). Because the shell is frozen at warm paper, Foundation (#eceae4 cool canvas) and Conversion Path (#fbfaf8 near-white) render with a visible warm-cream header seam sitting above a cooler canvas — the shell contradicts the art direction it is framing. The chooser screen has the same problem in reverse: it is entirely hard-coded and cannot follow any theme. Fix by promoting the shell colors in src/styles.css to the same --map-* token layer canvas.css already defines and scoping the theme class above the header rather than below it.

Evidence: Computed styles captured in all four workspaces: .workspace-header background-color = rgba(248,244,235,0.96) in every theme, border-bottom rgb(201,192,173) in every theme, .text-button color rgb(61,81,72), .workspace-kicker rgb(110,98,80), .workspace-meta rgb(110,104,93), .cadence-filter rgba(251,248,240,0.96) — all identical — while --map-canvas varies #f6f1e7 / #f2f2ec / #eceae4 / #fbfaf8. Only

**Flow label struck through by its own route in presentation** (technical-audit · Anti-Patterns)

DESIGN.md promises "background-colored edge casing clarifies genuine crossings" and that labels have generous hit targets bound to their paths. The plain label treatment receives no casing, so the route paints over the text. In a financial presentation a horizontal rule through a dollar figure reads as a strikethrough — an unintended and materially misleading semantic on a product whose core constraint is that values display literally. Fix by applying the same background casing to plain-treatment labels, or by masking the path beneath every label's bounding box regardless of treatment.

Evidence: p-crop-roth.png and p-crop-daf.png at 2×, Private Ledger presentation at 1440×900: the dash-dot relationship path is drawn straight across the middle of the plain-treatment label "QCD — Up to $105,000", and the adjacent plated label "2026 RMD — $37,818 gross" abuts it. The plated label renders correctly; the plain one has no casing.

**Header controls degrade at the low end of the supported viewport range** (technical-audit · Responsive Design)

The header is a 1fr auto 1fr grid with no breakpoint, so at 1280 the three zones compete and the action buttons lose their single-line shape. Button labels wrapping mid-token is the clearest possible signal of an untested breakpoint, and it appears on the viewport most likely to be a real advisor laptop. Fix by adding a max-width:1360px rule that drops the meta block to icon/tooltip or shortens the provenance string, and by setting white-space:nowrap on the action buttons.

Evidence: ws-1280x720.png: '+ Add' wraps to two lines, the 'Ctrl K' kbd hint inside Actions wraps to two lines, and 'Synthetic demo · advisor-entered values' wraps to two lines. Measured clearance between .workspace-heading and .workspace-actions = 12px at both 1280 and 1180 (versus 287px at 1920).

**Presentation borrows editor selection language to convey narrative focus** (slop-and-craft · motion & state — state vocabulary bleed)

Story focus is rendered as an 8px double accent ring on modules and a 4px accent outline on labels — the visual grammar of a UI selection state. In front of a client this reads as "something is selected in the software," not "this is the part of the story I'm on." Non-focused content meanwhile drops to opacity 0.3, which leaves numbers ghosted-but-readable across the whole board rather than receding; the composite effect is a rendering artifact, not editorial emphasis.

Evidence: src/money-map/styles/canvas.css:1355-1364 (0 0 0 4px canvas, 0 0 0 8px accent) and :1403-1409 (outline: 4px solid accent); visible on the "As needed" label in scratchpad/shots/10-present-3.png

**Starter chooser is a 2x2 identical card grid under a tracked uppercase eyebrow** (slop-and-craft · AI slop test — two absolute bans on the first screen)

Four cards, each identical in size and anatomy: 56px glyph, micro-label, serif heading, two lines, arrow. The four cairn glyphs are the only differentiator and differ solely by border-radius and hue at 56px — at reading distance the four options are indistinguishable, so the one screen whose entire job is to make four stories feel distinct doesn't. On top of that: a cream body in the exact warm-neutral band the skill names as the current AI default, an uppercase tracked eyebrow, and a fluid clamp h1 that the product register rules out ("fixed rem scale, not fluid"). At 1440x900 only two of the four starters clear the fold, and 3 and 4 are clipped mid-glyph.

Evidence: scratchpad/shots/03-chooser-full.png; src/styles.css:1 (#eee7d8 body), :82-90 (.chooser-kicker uppercase 0.16em), :97-100 (h1 clamp(48px,7vw,84px))

**Default starter view shows nine objects and one flow** (slop-and-craft · first-run state / product fitness)

The first thing an advisor sees after choosing "Retirement Income" is a field of nine cards with one arrow. The authored default cadence filter hides the relationships that make it a map rather than a card scatter. The product is named Money Map; its default view of its lead starter maps almost nothing. The Overview cadence has the edges — the authored default should not be the view that hides them.

Evidence: scratchpad/shots/04-editor-ledger.png — Monthly cadence, single edge from Income sources to Core lifestyle

**Draw-flow group headings are financial-role labels but the grouping key is shape primitive, so destinations land under wrong headings** (closure-check · Item 3 — destinations grouped meaningfully)

The structural half of this fix is done — grouped list, empty groups filtered (only 5 of 6 groups render when the source is the sole ledger), first destination auto-focused, Tab moves between destinations, Escape closes and the picker unmounts. But DESIGN.md states shape 'remains independent of semantic module type', and fix #5 deliberately de-conflated the two in the Add menu; this picker re-conflates them in the opposite direction and asserts a financial claim the data does not support. In RMD & Withholding roughly half the destinations sit under a heading that misdescribes them. Every module already carries a `kind` field (income/account/reserve/need/specialty/charitable/note) that is the

Evidence: src/money-map/editor/FlowTargetPicker.tsx:5-21 groups by `target.primitive`. Live picker on Retirement Income puts 'Roth IRA' (kind: account, primitive: roundel) under 'Goals & needs' and 'Hartwell Giving Fund' (kind: charitable, primitive: band) under 'Commitments & contracts'. Authored kind/primitive pairs across starters: rmd has account/ledger (→'Income'), note/plate (→'Accounts'), note/band x

**Presentation chrome shifts horizontally every time the presenter leaves/returns to Overview** (code-regression · correctness / visual polish)

`showFitStep` is true only when the active step has participants. Overview is normalised to empty moduleIds/flowIds (PresentationShell.tsx:23), so the nav renders 4 camera buttons on Overview and 5 on every focused step. Because `.presentation-nav` is a centred flex row with no `margin-left:auto` on the toolbar, the Overview button, step title, and dot strip all slide left by roughly half the Fit-step button's width the moment the advisor presses Right Arrow, and slide back on return to Overview. A second, smaller jump happens on entering presentation: the toolbar is only rendered once `controller` arrives from the canvas effect (PresentationShell.tsx:132, MoneyMapCanvas.tsx:318-320), so the

Evidence: src/money-map/canvas/CanvasControls.tsx:74-94 (conditional Fit step button); src/money-map/styles/canvas.css:1546-1555 (.presentation-nav { display:flex; justify-content:center })

## Refuted findings

Raised by an evaluator, then disproven by independent verification. Recorded so they are not re-reported:

- **"Reset story" destroys all authoring with no confirmation and no undo** (P0, design-critique) — Ran the current dist build headless on :4358 (server killed after) and drove the palette with Playwright. Most of the finding's stated evidence does not reproduce against the current working tree:

1. "Identical plain styling" / "no danger affordance" — REFUTE

- **All authoring is silently discarded on refresh** (P1, design-critique) — REFUTED by both code and runtime. The app already has per-starter localStorage draft persistence: src/money-map/model/persistence.ts defines saveDraft/loadDraft/clearDraft under key 'money-map:v2:<starterId>' with full schema validation, and src/money-map/edit
- **Shape vocabulary changes name between the Add menu and the command palette** (P1, design-critique) — The finding misreads the code. The two label sets do not belong to the same commands. AddMenu.tsx's eight entries (Ledger/Plate/Tray/Band/Roundel/Frame/Cylinder/Text note) CREATE a new object of that shape; commands.ts's primitiveLabels (Income ledger/Account
- **Advanced properties popover covers the object it is editing** (P1, design-critique) — REFUTED — the claimed evidence does not reproduce, and the exact fix the finding asks for is already implemented in the current working tree.

Code: C:/Users/Cyril/Projects/.portfolio-remediation-worktrees/money-map-approved-remediation-20260714/src/money-map/

- **Cadence toolbar occludes and blocks clicks on an authored module at 1280×720** (P1, technical-audit) — Reproduced headlessly against dist/ served on port 4372 (Retirement Income starter, 1280x720 and 1440x900).

What is true: the geometry number is exact. .cadence-filter = [x18, y92, w268, h40]; first module ("What arrives each month") = [x126, y120, w190, h213

- **Selection halo escapes the viewport, clipping the first primary action** (P2, technical-audit) — Only the raw number reproduces; every consequential claim fails.

VERIFIED IN RUNNING BUILD (vite preview :4371, 1440x900, headless Chromium, all 4 starters / 31 modules):

- halo bounding left = -6 (Retirement Income node 0) and -9 (RMD node 0). Numbers match.
- **Command palette is a three-item stub with an inverted layout** (P1, slop-and-craft) — Refuted. Reproduced live against the current tree (dist served headless on :4372 via `npx vite preview --strictPort`, Playwright, 1440x900; server killed after).

1. "Three-item stub" does not reproduce. C:\Users\Cyril\Projects\.portfolio-remediation-worktrees

- **Editor chrome persists in presentation and reflows between steps** (P1, slop-and-craft) — Verified live against the dist build (vite preview :4386, headless Chromium, 1280x720, Retirement Income starter). Measured nav geometry and read screenshots of C:\Users\Cyril\AppData\Local\Temp\claude\C--Users-Cyril\f05cf857-0290-4f44-8c74-0e6244930bac\scratc
- **The four themes are one theme recolored; art directions don't survive to pixels** (P1, slop-and-craft) — Reproduced headlessly against the dist build (vite preview :4361, 1440x860, all four starters screenshotted and read).

The finding's thesis — "four themes are one theme recolored; art directions don't survive to pixels" — does not reproduce for at least two o

- **Five different button vocabularies across four surfaces** (P2, slop-and-craft) — REFUTED. Cited evidence does not exist and the reproduction contradicts the claim on every specific.

1. Evidence missing: `scratchpad/shots/` does not exist anywhere in the worktree (no `05-toolbar.png`, `09b-selected-crop.png`, `04-editor-ledger.png`). I reb

- **Add-shape menu thumbnails don't distinguish the shapes** (P2, slop-and-craft) — Reproduced headlessly (vite preview :4371; dist confirmed current — the band clip-path is present in dist/assets/index-BLZ0wNIn.css) and screenshotted the open .add-menu panel at 2x. The finding's central evidence does not reproduce.

1. "Band and Text note ar

- **Ad-hoc type scale with fractional sizes** (P2, slop-and-craft) — The raw inventory reproduces, but every inferential claim built on it fails.

WHAT REPRODUCES: C:/Users/Cyril/Projects/.portfolio-remediation-worktrees/money-map-approved-remediation-20260714/src/money-map/styles/canvas.css does contain 16 distinct font-size v

- **Ctrl/Cmd +/- is preventDefault-ed in presentation, replacing pannable browser zoom with an unpannable canvas zoom** (P2, code-regression) — The line-level evidence reproduces (PresentationShell.tsx:35-46 preventDefaults Ctrl/Cmd +/- and routes to controller.zoomIn/zoomOut; MoneyMapCanvas.tsx:559-566 disables panOnDrag/zoomOnScroll/zoomOnPinch/panActivationKeyCode and the canvas keydown handler in
- **Playwright retries changed from CI-only to always-on in the same change that adds animation-timing e2e assertions** (P2, code-regression) — The textual evidence reproduces. `C:/Users/Cyril/Projects/.portfolio-remediation-worktrees/money-map-approved-remediation-20260714/playwright.config.ts:11` is now `retries: 1`, and `git diff` confirms it changed from `retries: process.env.CI ? 1 : 0` in the sa

## Scoring rationale

**Design:** Net +2 vs the provisional 24, and the movement is entirely attributable to evidence rather than leniency. The provisional double-counted a refuted claim — "a browser refresh silently discards everything with no unsaved-work guard" — across three heuristics (User Control, Error Prevention, Error Recovery). I did not merely note its absence from the confirmed list; I verified the opposite firsthand: src/money-map/model/persistence.ts implements a validating localStorage draft layer, useMoneyMapEditor.ts seeds history from it on mount, and live at 1440x900 an added 11th module survived a hard reload intact. Those three heuristics go 2 -> 3. That +3 is partially offset by lowering Match to Real World 3 -> 2 on closure-check finding #26, which the provisional did not have: the draw-flow picker groups by shape primitive under financial-role headings, so it tells an advisor that a Roth IRA is a "Goal or need" — a false domain claim, not a phrasing slip. The two remaining live safety defects are real and I reproduced both: Reset story is unconfirmed and unrecoverable (11 nodes -> 10, Ctrl+Z inert), and the fitStep camera never fires against real React Flow. I also independently reproduced every class of presentation text defect in a clean render rather than inheriting the screenshots, which is why heuristic 8 holds at 2 despite the shell being 4-quality; I considered 1 and rejected it as a rubric-band mismatch. Gate: FAIL. Not on the total — 26 is a respectable score and the shell would survive a hostile read — but on portfolio fitness specifically. PRODUCT.md states the project "must demonstrate WealthTech product judgment and frontend design-engineering taste equally," and the artifact a reviewer will screenshot has "Balanc$185,000" overprinted and a line struck through "QCD

**Technical:** FAIL for publication as a portfolio piece — not because the engineering is weak, but because the defects land precisely on the product's thesis and on the artifact a reviewer sees first.

PRODUCT.md stakes the project on 'presentation-quality output' and a financial-truth boundary where every value displays literally. The confirmed defects concentrate exactly there. In presentation, dollar figures overprint their own labels in 3 of 4 starters (verified structurally: canvas.css:1458 nowrap 34px dd inside minmax(0,1fr) auto in non-reflowing world geometry — the collision is guaranteed, not incidental). Flow labels are struck through by their own routes on amount labels, which on a financial document is the universal convention for a voided figure — a rendering that actively contradicts the stated contract. Roundel content escapes its ellipse in 4 of 4 starters in both modes. A reviewer opening this to judge design-engineering taste hits all three inside the first minute of the demo, and the Conversion Path note clipped by its module border appears in the default authored composition with no interaction at all.

Two things independent of the score reinforce the gate. First, confirmed finding 24: the story-step camera never reframes automatically, so PRODUCT.md's promised fit-to-story camera behavior requires a manual click on every step — and the unit test at MoneyMapCanvas.test.tsx:635 asserting fitView passes against a mocked useReactFlow. A green test certifies a feature that does not work in the running app, so the repo's own evidence is currently wrong; any re-verification that reads tests rather than the app will keep reporting this closed. Second, confirmed finding 25: occupancy-aware placement silently falls back to dropping new objects on top of existing modules a

## Review coverage

Mobile authoring and mobile presentation are explicit product non-goals and were excluded from scoring. Evaluation covered all four starters in authoring and presentation at 1280x720, 1440x900, and 1920x1080, plus the starter chooser, Add menu, Draw Flow, command palette, story steps, undo, Reset, persistence, and the four themes.

This document records measured results. No score in it was manually adjusted, and no claim in it is unaccompanied by the evidence used to reach it.
