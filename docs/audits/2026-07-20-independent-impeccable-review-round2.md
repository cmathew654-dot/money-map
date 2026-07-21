# Independent Impeccable review — 2026-07-20 (round 2)

**Reviewed:** working tree at `2381eb3` plus the full uncommitted remediation (43 files, +2000/-391).
**Method:** identical harness to the round-1 review earlier the same day, re-run fresh with no cached results. Five blind evaluators denied access to `PROJECT.md`, `AGENTS.md`, `docs/audits/*` and all prior scores; every P0/P1/P2 adversarially verified by an independent agent instructed to refute it; scores re-derived from surviving evidence only. 49 agents.

## Verdict

**Design critique: 27/40** — gate FAIL (round 1: 26/40)  
**Technical audit: 15/20** — gate PASS-WITH-NOTES (round 1: 13/20)

Confirmed after refutation: 10 P1 · 12 P2 · 2 P3. 17 findings were raised and then refuted.

Roughly half the surviving P1s were introduced by the remediation itself, at the seams between concurrently-edited files: toolbar overflow (a provenance ellipsis and a new Legend button added to the same row independently), step-rail mid-word clipping (a line-clamp that does not engage in current Chromium), off-screen module placement with no camera follow, and the loss of two-column row alignment as a side effect of fixing value/label overprint.

## Design scorecard

| Heuristic                                               | Score     | Basis                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visibility of System Status                             | 3/4       | Two live regions announce real outcomes ('Selection removed.', 'Undo complete.', 'Starter scaffold restored. Undo to return to your version.'); zoom % is always visible; cadence chips carry aria-pressed; presentation step chips ma |
| Match System / Real World                               | 3/4       | Domain fluency is the product's best quality and I found no counter-evidence: '2026 RMD $37,818 gross / After W/H $25,471', 'QCD — Up to $105,000', 'Prepared outside Money Map', 'No lifetime RMDs — last money out'. The Add menu tr |
| User Control and Freedom                                | 3/4       | Escape cancels every panel and inline edit, Cancel buttons exist, Ctrl+Z/Ctrl+Shift+Z work, focus is restored to the trigger, 'Back to stories' is always available, and Reset story is itself undoable (reset() routes through applyD |
| Consistency and Standards                               | 2/4       | LOWERED from the provisional 3. The underlying discipline is real — one shell, one command registry, one undo history, one halo, four art directions that read as one system. But the confirmed defect load across all four evaluators |
| Error Prevention                                        | 3/4       | RAISED from the provisional 2, which rested almost entirely on 'zero persistence and no beforeunload, so F5 destroys the work silently' — refuted in code and verified live. What actually ships is close to the rubric's own listed c |
| Recognition Rather Than Recall                          | 3/4       | RAISED from the provisional 2, both of whose drivers are refuted. (a) The 'clipped with no scrollbar or fade' claim against .flow-target-picker__targets and .advanced-properties does not hold: canvas.css:720-741 gives both panels  |
| Flexibility and Efficiency of Use                       | 3/4       | Accelerator coverage is genuinely good: Ctrl+K palette, Ctrl+Z/Shift+Z, Ctrl+D, Delete, L for draw flow, Enter to edit, Escape, arrow-key step navigation in presentation, roving-tabindex toolbars, tabbable canvas nodes with rich a |
| Aesthetic and Minimalist Design                         | 2/4       | LOWERED from the provisional 3. The taste is real — warm paper ground, editorial serif, restrained chrome, four art directions that are distinct without fracturing the system. This is not an AI-slop artifact. But nine confirmed co |
| Help Users Recognize, Diagnose, and Recover from Errors | 3/4       | RAISED from the provisional 2, three of whose four drivers are refuted. 'No draft restore after the reload data loss' — refuted, restore verified live. 'Reset story offers no undo affordance in its own moment' — refuted; reset ann |
| Help and Documentation                                  | 2/4       | The help that exists is contextual and well placed — the Legend explains route semantics, the Add menu teaches each shape's financial role, the Draw-flow panel carries an inline hint ('Choose a destination, or drag from any visibl |
| **Total**                                               | **27/40** | 27/40 — top of the \"Acceptable\" band. Genuine art direction and real WealthTech product judgment, undermined by a concentrated class of execution defects that land on the client-facing presentation                                |

## Technical scorecard

| Dimension         | Score     | Basis                                                                                                                                                                                                                                  |
| ----------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility     | 3/4       | Holds at 3. The substantive AA case is genuinely met and in places exceeded: zero measured contrast failures across eight surfaces (lowest 4.50:1, focus ring 5.83:1), visible focus on every tabbable including canvas nodes, a corre |
| Performance       | 4/4       | Holds at 4. Every measurement against the rubric's five checks is clean: no layout thrashing (LayoutCount and RecalcStyleCount 0 after settle), no expensive animation (zero blur, zero backdrop-filter, ease-out-expo only, reduced-m |
| Theming           | 3/4       | Holds at 3, as the weakest 3 on the card. The token system is real and load-bearing: canvas.css carries a 43-token :root layer with 173 var() consumptions, and four art-direction themes each override 11-13 tokens with documented c |
| Responsive Design | 2/4       | Lowered from the provisional 3. Scored only on the three supported desktop viewports plus the 1180x660 minimum-viewport cover; mobile is a documented non-goal and did not enter this score. Credit where due: no horizontal or vertic |
| Anti-Patterns     | 3/4       | Holds at 3, and it stays at 3 for reasons opposite to the usual. On AI-slop tells this is a 4: zero gradient text, zero glassmorphism, no side-stripe borders, no hero-metric block, no identical card grid, no numbered scaffolding,  |
| **Total**         | **15/20** | 15/20 — Good (lower half of band). Substantively strong engineering with a systemically unresolved presentation surface.                                                                                                               |

## Confirmed findings

### P1

**Flow routes are drawn through plain label text, producing strikethroughs on dollar figures** (design-critique)

DESIGN.md promises 'Background-colored edge casing clarifies genuine crossings', and that casing does work where two routes intersect — but a plain-treatment label gets no casing behind its own route, so the line renders as a strikethrough. This appears in the default authored view of three of the four shipped starters. In a client meeting, '2026 distribution' with a line through it reads as cancelled or superseded. Fix: apply the existing background casing (or auto-promote to 'plate' treatment) whenever a label's bounding box intersects any route path.

Evidence: shots/91-rmd-label.png: the RMD starter's '2026 distribution' label has the arrow route passing horizontally through the glyphs. shots/90-roth-labels.png: 'Outside reserve' and 'Advisor review' in the Roth starter each have a dash-dot route running vertically through the text. shots/03-editor-ledger.png: 'QCD — Up to $

**Chrome overflows the viewport at 1180 and 1280 — Legend button clipped, provenance line truncated** (design-critique)

Two of the three supported desktop viewports render a chopped-off toolbar. Worse, the truncated element is the synthetic-data disclosure — 'Synthetic demo · advisor-entered values' shows as 'advisor-enter…' at 1440 and 'ad…' at 1280 — and it collapses to 0x0 entirely when the Legend is opened at 1280 (measured before/after). DESIGN.md requires that presentation retain synthetic-data provenance; the authoring shell drops it at the exact widths most advisor laptops run at. The header needs to reflow (wrap the provenance under the title, or move it to a fixed slot) rather than truncate.

Evidence: Measured Legend button right edge: 1197.3px at vw 1180 (DESIGN.md's stated authoring minimum), 1285.5px at vw 1280, 1426.7px at vw 1440. Document scrollWidth equals clientWidth, so the overflow is clipped and unreachable, not scrollable. Provenance span: scrollWidth 212 / clientWidth 116 at 1280 (renders 'Synthetic dem

**Presentation node rows lose their two-column alignment and wrap** (design-critique)

The editor's tabular label/value alignment is a major part of why this reads as a financial document rather than a whiteboard. Presentation raises the base type size against fixed authored node widths, so rows wrap and the alignment collapses — the client-facing output is visibly less composed than the working view, which inverts the product's whole premise ('presentation-quality output'). Within a single node the behavior is also inconsistent: 'Consulting ~$3,000/mo' stays on one line while the two rows above it wrap.

Evidence: Compare shots/03-editor-ledger.png (editor: 'Social Security ........... $6,400/mo gross' right-aligned on one row) with shots/22-node-crop.png (presentation: 'Social Security' / '$6,400/mo gross' wrapped onto two lines, hairline rules colliding with descenders).

**Presentation step chips truncate mid-word and clip descenders** (design-critique)

These are the controls the advisor clicks live, in front of a client, to move through the story. 'Income to… household' and 'Reserve… withdrawals' are not readable labels, and two chips reading 'Reserve…' are indistinguishable at a glance. Text overflowing the pill boundary is the kind of detail that undermines the composed impression everything else works to build. Fix: let chips size to content with a wider max-width, or show number + short label and put the full step name in the active-chip position only.

Evidence: shots/20-steps-crop.png at 1440x900: chips read 'Income to… household', 'Reserve… withdrawals', 'Reserve… replenishment', 'Annuity… income'. The second line's descenders are cut by the pill border and 'replenishment' overruns the pill's right edge.

**Presentation step-rail pills clip their labels (absolute-ban: text overflow)** (technical-audit)

This hits the impeccable absolute ban 'Text that overflows its container' on both 1440x900 and 1280x720. Beyond the clip there is a comprehension failure: steps 2 and 3 both render as 'Reserve...' on line one, so two adjacent presentation steps are visually indistinguishable while an advisor is presenting. Fix: let the pill width be content-driven (min-width instead of fixed 100px), drop the mid-string ellipsis, and shorten the authored step names ('Withdrawals' / 'Replenishment').

Evidence: 91-pres-rail.png (3x crop, 1440x900) and 61-pr-1280x720.png. Rail buttons measure 100x44px fixed. Rendered labels: 'Income to... household', 'Reserve... withdrawals', 'Reserve... replenishment', 'Annuity... income'. In 'Reserve... replenishment' the terminal 't' is cut by the pill's rounded right edge. Accessible names

**Edge labels are struck through by their own routes — no background casing on plain labels** (technical-audit)

DESIGN.md promises 'Background-colored edge casing clarifies genuine crossings' and 'Labels stay bound to their paths'. Labels using the 'plate' or 'filled' treatment get a background and read cleanly; labels using the 'plain' treatment get no casing, so any route passing behind them strikes the text out. Because these labels carry dollar amounts ('Up to $105,000'), the failure lands on exactly the content PRODUCT.md says must be 'displayed literally'. It recurs in 3 of the 4 starters, so it is systemic, not a one-off authoring slip. Fix: apply the same background casing (paint-order / text st

Evidence: 50-crop-labels.png and 51-crop-legacy.png (3x, 1440x900, Retirement Income). 'QCD — Up to $105,000' has a dash-dot route running horizontally through the numerals and a vertical dashed segment between 'Up' and 'to'. 'Legacy context' has a dash-dot route through the word 'Legacy'. Reproduces identically at 1280x720, 144

**Presentation step chips render broken mid-label truncation that overflows the pill** (slop-and-craft)

An ellipsis is applied to line 1 while line 2 still renders the remainder, so the truncation communicates nothing and reads as a rendering bug rather than a design decision. Second lines sit on or below the rounded bottom border. This is the navigation the advisor clicks in front of a client, five times per story, in all four starters. Either wrap honestly or shorten the authored step names — not both.

Evidence: 3x crop of the step nav at 1440x900 (Retirement Income): chips read "Income to…" / "household", "Reserve…" / "withdrawals", "Reserve…" / "replenishment", "Annuity…" / "income". 4 of 6 chips affected; the final "t" in "replenishment" crosses the pill's stroke.

**Editor toolbar overflows and clips at 1280x720, a supported viewport** (slop-and-craft)

The right-most control is cut off with no horizontal scroll and no overflow menu. DESIGN.md sets the authoring minimum at 1180x660 with an honest cover below that, so 1280 is explicitly in scope. Collapse Legend into the Actions palette or compress the header title block at this width.

Evidence: 1280x720 editor: Legend button getBoundingClientRect right = 1286px against a 1280px viewport; documentElement.scrollWidth = 1280, so it is clipped, not scrollable. Visible at top-right of the 1280 editor screenshot.

**Presentation step rail hard-clips authored step titles — the word-safe line-clamp never engages** (closure-check)

`.presentation-rail__step` sets `display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:1` to produce a word-safe one-line clamp with an ellipsis after the last whole word. In current Chromium that declaration is blockified on the element (computed `display` resolves to `flow-root`, and `CSS.supports('line-clamp','1')` is false), so the clamp never applies. The pills fall back to `white-space:normal` wrapping inside a fixed 44px box with `overflow:hidden` and `text-overflow:clip`, producing 2-3 wrapped lines cut off mid-phrase with the second line bisected by the pill's own botto

Evidence: src/money-map/styles/teaching.css:36-60; measured in HeadlessChrome 149: computed display=flow-root (not -webkit-box), -webkit-line-clamp=1 inert; pill scrollHeight 67-83px vs clientHeight 42px; screenshot C:\Users\Cyril\AppData\Local\Temp\claude\C--Users-Cyril\f05cf857-0290-4f44-8c74-0e6244930bac\scratchpad\shots\nav-

**findOpenModulePlacement can place a new module off-screen and nothing pans the camera to it** (code-regression)

The docstring promises "first preferring positions inside `viewport` ... then any clear position outside it — a caller can use that to decide whether the camera should pan to reveal the new object." The function returns a bare `Point` with no in/out-of-viewport indicator, and the only caller (`createObject`) never pans. I reproduced the pass-2 fallback with a script: with the visible viewport occupied, the returned point is 1250px below the viewport bottom. createObject then calls `editor.setSelection`, `setActiveInlineField({field:"title"})` and `focusNewModuleTitle()` on a node the user cann

Evidence: src/money-map/editor/surfacePosition.ts:117-125 (docstring) and MoneyMapWorkspace.tsx:525-560 (createObject); measured: preferred (800,450), viewport 1600x900 covered by one occupied rect → returns {x:0,y:1250}

### P2

**Presentation silently drops authored eyebrow and title on every text object** (design-critique)

PRODUCT.md states 'Every financial value is authored and displayed literally' and 'advisor-authored prose round-trips exactly'. Here the authoring surface shows a titled note and the client-facing output shows an untitled orphan sentence: '$222,000 balance; payments through February 2028.' floating with no indication of what it refers to. The advisor sets up the note in the editor, switches to Present in front of the client, and the framing disappears. The adjacent CSS comment ('Compact the fixed authored geometry without shrinking presentation type below its tested floor') shows this display:

Evidence: src/money-map/styles/canvas.css:1568 — `.money-map-presentation .money-map-module[data-primitive="text"] .money-map-module__header { display: none; }`. Starter data at src/money-map/starters/retirement.ts:195 authors eyebrow 'Planning note' and title 'Installment note'. Editor innerText contains both; presentation inne

**'Module' jargon leaks into the advisor-facing UI and contradicts the Add menu** (design-critique)

'Module' is an internal data-model word with no meaning to a financial advisor, and it is used in the one place the advisor is most likely to look first — the selection halo. The same concept is called a 'shape' when created and a 'module' when edited. Rename to 'Edit', 'Style', and 'Shape properties'; the halo buttons are already context-scoped to the selection and do not need the noun at all.

Evidence: Halo toolbar: 'Edit module', 'Style module', 'More properties'. Properties panel header: 'MODULE PROPERTIES'. Add menu header: 'Choose a shape'. DESIGN.md calls these objects and shapes; PRODUCT.md says 'eight purposeful shapes'.

**Every relationship occupies two identical tab stops** (design-critique)

A keyboard or screen-reader user hears each of the 7 flows announced twice before reaching any node, so getting to the first module takes 20 tab presses. The SVG group and its label button should not both be in the tab order — make the group tabindex=-1 and keep the labelled button as the single stop.

Evidence: Tab walk from the editor: indices 6-12 focus SVG <g> elements labelled 'income relationship from retirement-income to…', then indices 13-19 focus BUTTON.money-map-flow-label elements with the same aria-labels.

**Presentation module rows collapse to zero leading — rules cut through text** (technical-audit)

In Present mode the dl rows are scaled from 12px to 20px but the flex row keeps `row-gap: 0` and only 4px of vertical padding. Every label/value pair now wraps to two lines with no leading between them, so 'Social Security' / '$6,400/mo gross' stack flush and the 1px divider lands on the descenders of the line above. At 1280x720 the effect is severe enough that the module reads as a solid block of text. PRODUCT.md calls presentation 'a first-class output: clean paper' and 'presentation-quality output' — this is the surface an advisor puts in front of a client, and it is the least typographical

Evidence: src/money-map/styles/canvas.css:1513-1526. Measured computed styles: authoring dt = 12px / line-height 16.2px (1.35); presentation dt = 20px / line-height 20px (effective 1.0) in a 238px column. Row rule is `.money-map-presentation .money-map-module__row { display:flex; flex-wrap:wrap; row-gap:0; padding:4px 0 }`. Scre

**Legend button clipped by the viewport at 1280x720** (technical-audit)

1280x720 is a supported viewport and the most common laptop width. The header action cluster does not fit its container and the last control bleeds off-screen, so the Legend affordance looks broken on first load. This was also caught programmatically as the only off-viewport button at 1280x720 and 1180x660. Fix: make the header actions a flex row with proper gap/padding accounting rather than allowing the last item to overflow, or collapse the Legend into the Actions palette below ~1360px (there is already a @media (max-width: 1360px) block at canvas.css:91).

Evidence: Measured at 1280x720: Legend button rect right edge = 1286px against innerWidth 1280 (parent header container right edge = 1256px, so the button overflows its own container by 30px). At 1440x900 button right = 1427 vs parent right = 1416 — same 11px container overflow, just not yet past the viewport. Screenshot 72-hdr1

**Presentation mode collapses the ledger's two-column alignment — client-facing output is worse than the editor** (slop-and-craft)

The right-aligned amount column is the single thing that makes the editor cards read as an advisor document rather than a diagram. At presentation type sizes the container widths were never recomputed, so the label/value flex wraps and the column disappears. "Consulting ~$3,000/mo" still fits on one line while the two rows above it wrap, so within one card three rows use two different layouts. The artifact the product exists to produce is less legible and less composed than the working state, which inverts the premise of PRODUCT.md.

Evidence: Screenshot compare at 1440x900: editor card "What arrives each month" renders Social Security | $6,400/mo gross as an aligned label/value pair with a right-aligned amount column; in Present the same rows wrap to two stacked left-aligned lines with the hairline rule falling below the value rather than between rows. Ever

**Flow labels have no background casing and are struck through by their own routes** (slop-and-craft)

Computed styles confirm the plain label treatment ships backgroundColor rgba(0,0,0,0) with a transparent border, so no casing exists for it — while the plate and filled treatments do have it. DESIGN.md explicitly promises "background-colored edge casing clarifies genuine crossings." The contract is met for two of three label treatments and broken for the one used most in the authored starters. Struck-through dollar amounts are the worst possible place for this.

Evidence: The dashed route runs horizontally through "Up to $105,000" in the QCD label; a dash-dot route strikes through "context" in "Legacy context" while the filled "$21,475/yr — income rider" plate overlaps its left edge. Same defect on "Outside reserve" and "Advisor review" in Roth Conversion and "2026 distribution" in RMD

**Chooser never shows all four starters at any supported viewport** (slop-and-craft)

PRODUCT.md says "No starter is the hero." The layout makes that impossible — Roth Conversion sits below the fold on every desktop size the product supports, with no scroll affordance on screen. Compounding it, each 1220px row carries content in the left ~470px with a lone → arrow at x≈1553, leaving a ~700px dead gutter. Product register also rejects fluid clamp headings, and here the clamp buys nothing (it is at max everywhere) while shipping brand-hero scale into a task surface. Cutting the hero block and dropping h1 to ~40px fits all four at 1280x720.

Evidence: Measured entry bounds: 1280x720 → 1 of 4 fully visible (entry 2 bottom 767 > 720); 1440x900 → 2 of 4 (entry 3 bottom 989); 1920x1080 → 3 of 4 (entry 4 bottom 1193). h1 is clamp(48px, 7vw, 84px), pinned at 84px at every supported width; the header block consumes 420–479px before the first row.

**Four button vocabularies in a single toolbar row** (slop-and-craft)

Four heights, two font sizes, three weights (including arbitrary 740 and 720 differing by 20 between adjacent buttons), and two border colors in one horizontal cluster. Add and Actions are visually identical outlined buttons with identical semantics (both open a panel) yet one is w740 and one w400. Legend is the giveaway: it is the RelationshipLegend component's own toggle (.relationship-legend__toggle) dropped into the app bar, so it inherits the legend's 12px scale. The bottom-left zoom cluster adds a fifth vocabulary (bordered −/%/+ segment fused to unbordered "Fit story"/"Fit selection" te

Evidence: Computed styles, editor header at 1440x900: Back to stories 40px/16px/w400/no border; "+ Add" 37px/16px/w740/border rgb(149,139,121); Present 39px/16px/w720; Actions 37px/16px/w400/same border as Add; Legend 32px/12px/w400/border rgb(170,161,143).

**Command palette reads as a settings dialog, not a command palette** (slop-and-craft)

Every reference palette (Raycast, Linear, Figma, Stripe) uses a magnifier plus placeholder, no visible close affordance, dense rows with trailing accelerators, and destructive items gated or out of the default list. All four are inverted here. Worse, the Add menu in the same app puts its "Close" link at top-RIGHT, so the two overlay surfaces disagree about where dismissal lives. The app exposes Ctrl K on the Actions button yet no palette row shows its own shortcut, so the palette cannot teach the keyboard model it exists to expose.

Evidence: Palette at 1440x900: "Close" as a bare text link at the panel's top-LEFT above everything; "SEARCH ACTIONS" tracked-uppercase form label above an input with no placeholder and no search icon; 6 rows at ~56px pitch with no icons and no shortcut hints; ~130px empty below the last row; "Reset story" in destructive red inl

**Selection halo is a 440px bare-text bar wider than the object it acts on** (slop-and-craft)

Contextual toolbars in the reference tools are icon-led, sized near the selection, and never wider than what they act on. The labels are also redundantly verbose — "module" repeats twice when the selection already establishes the noun, and "Duplicate selection"/"More properties" should be "Duplicate"/"More". Icons plus short labels would roughly halve the width and stop it covering canvas content.

Evidence: 1280x720 with a 160px-wide card selected: the halo renders "Edit module | Style module | Draw flow | Duplicate selection | More properties" as five unbordered text buttons spanning ~440px, occluding the "Periodic refill" flow label beneath and extending ~280px past the selected object.

**Palette "Add to map" opens the Add menu then yanks focus back to the Actions button** (code-regression)

CommandPalette.execute() calls onExecute(id) and then close(), and closePalette schedules `requestAnimationFrame(() => invoker?.focus())`. For the new `workspace.add` command the sequence is: openAdd() sets addOpen → React commits, AddMenu's `useEffect(() => first.current?.focus(), [])` focuses the first shape → the queued rAF then fires and focuses the still-mounted "Actions" header button. The Add menu is left open with focus behind it on the invoker, so its Escape/arrow key handling (bound to the <aside>) never receives keys. The pre-existing `openAdd` path via the "+ Add" button is unaffec

Evidence: src/money-map/editor/MoneyMapWorkspace.tsx:617 (closePalette rAF) + src/money-map/editor/CommandPalette.tsx:87-92 (execute → onExecute then close) + src/money-map/editor/AddMenu.tsx:24 (mount focus)

### P3

**Editorial identity typeface is never shipped — no @font-face, no webfonts** (technical-audit)

The entire editorial character of this design rests on Iowan Old Style (macOS-only) falling back to Palatino Linotype (Windows-only). On Linux, Android, or any machine without either, both the h1 and every module heading degrade to a generic serif and the 'discerning, composed, editorial' register PRODUCT.md asks for evaporates. Similarly `Inter` is named first but never shipped, so on Windows the UI sans is actually Segoe UI. For a portfolio artifact whose whole point is design-engineering taste, the typography is the one thing that is not guaranteed to arrive. Fix: self-host a subset of one

Evidence: Zero @font-face rules and zero font resources in the network trace (3 requests total: index.html, index-DwDRh9I3.css, index-BbQB5Vs3.js; `performance.getEntriesByType('resource').filter(/font|woff/)` returned []). Display stack is `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif` (7 declarations in can

**playwright retries:1 unconditionally, alongside a change that made presentation's initial fit timing-dependent** (code-regression)

Local-vs-CI parity would be a defensible argument in isolation, but this diff also removed React Flow's declarative `fitView`/`fitViewOptions` props (MoneyMapCanvas.tsx:551-556 deleted) and replaced them with `useEffect(() => { fitStep(); ... })` that calls fitView synchronously on mount. The author-mode fit two effects above deliberately wraps the same call in `requestAnimationFrame(fitMap)` precisely because nodes are unmeasured on the first commit; the presentation path now does not. The new e2e tests added in the same commit lean on `waitForTimeout(400)` and raw `.react-flow__viewport` tra

Evidence: playwright.config.ts:11 (`retries: process.env.CI ? 1 : 0` → `retries: 1`); src/money-map/canvas/MoneyMapCanvas.tsx:286-292 vs :255-261

## Refuted findings

Raised by an evaluator, then disproven by independent verification. Recorded so they are not re-reported:

- **Draw-flow target picker clips 7 of 9 destination groups with no scroll affordance** (P1) — Reproduced headless at 1440x900 and 1280x720 against dist/ (vite preview :4371). The measurement is accurate: `.flow-target-picker__targets` reports scrollHeight 685 / clientHeight 240, 9 destination buttons exist, and the visible cut lands
- **No persistence of any kind — a page reload destroys all authoring with no warning** (P1) — Refuted on both code and runtime. src/money-map/model/persistence.ts implements saveDraft/loadDraft/clearDraft against a starter-scoped localStorage key 'money-map:v2:<starterId>' with full schema validation on read, and src/money-map/edito
- **Advanced properties panel hides 37% of its controls below a clipped fold** (P2) — REFUTED. The raw measurement reproduces, but every interpretive claim built on it fails.

Reproduction (headless Chromium, `npx vite preview --port 4357`, story "Retirement Income" > Joint After-Tax Account > "Style module"):

- `.advanced-p
- **Undo and Redo are absent from the command palette and have no visible affordance** (P2) — Refuted at runtime. Undo/Redo are registered with isAvailable gated on canUndo/canRedo (commands.ts:305, :314). The reviewer only sampled a virgin session where there is literally nothing to undo, so the commands are correctly filtered out
- **Reset story discards all authoring with no confirmation** (P2) — REFUTED against the running build (vite preview :4348, headless, 1440x900, Retirement Income; server killed after). Added an 11th module via the palette, then ran Reset story: modules 10 -> 11 -> 10, dialogs 0, and the live region [role=sta
- **Empty canvas teaches nothing** (P2) — The visual state reproduces (verified headless at localhost:4359, screenshot 02-empty.png: bare dotted field after deleting all modules and flows), but the finding's framing does not survive checking.

1. FABRICATED CITATION. The finding as

- **Add panel has no ARIA role or accessible name** (P2) — REFUTED. The finding's core factual claim — "no ARIA role or accessible name" — is false. C:\Users\Cyril\Projects\.portfolio-remediation-worktrees\money-map-approved-remediation-20260714\src\money-map\editor\AddMenu.tsx line 27-28 renders `
- **Add menu is an untrapped overlay; command palette is a trapped dialog** (P2) — REFUTED as written. Two of the finding's three load-bearing claims are false, and the prescribed fix is an ARIA anti-pattern.

1. The focus-restoration contrast is factually wrong. The finding presents focus restoration as something "the co

- **Starter chooser scrolls at every supported viewport; only one of four equal starters is above the fold** (P2) — Reproduced headless against dist/ (vite preview :4371, Playwright, six viewports). The only claim that survives is the trivial one: the chooser page scrolls. Every load-bearing claim built on top of it fails.

Measured (doc height / viewpor

- **Starter chooser shell has no token layer — 33 raw color literals vs 14 var() uses** (P2) — REFUTED. The raw counts reproduce (33 literals / 14 `var()` in C:\Users\Cyril\Projects\.portfolio-remediation-worktrees\money-map-approved-remediation-20260714\src\styles.css; 51 tokens / 177 var() in src\money-map\styles\canvas.css), but t
- **The four "art directions" are one template with rotated border hues** (P2) — Reproduced headless at 1440x900 against the dist build (vite preview :4387) and read all four screenshots plus the theme CSS. The finding's core evidence does not reproduce.

1. "Identical #eee7d8-family field" is false. #eee7d8 is the app-

- **No fonts are loaded; typographic identity varies per machine** (P2) — Reproduced the literal facts, refuted the defect.

What checks out: `C:\...\src\styles.css:4-12` does list `Inter` first with no `@font-face`; `index.html` has no font `<link>`; runtime `document.fonts.size === 0` in the served build (verif

- **Viewport pass scans all 150 rings even when the ring radius far exceeds the viewport — ~90k wasted iterations per Add** (P2) — The mechanism is real but the defect claim does not hold. Confirmed by an instrumented faithful port: the viewport-full case costs exactly 91,691 iterations (matching the reviewer's figure), so pass 1 genuinely lacks an early break. However
- **fitStep jumps the camera to the world origin at max zoom when a step's modules have all been deleted** (P2) — REFUTED — the triggering state is unreachable. (1) Presentation steps are never authored by the user: `document.presentation` is only written by the four hand-written starters (src/money-map/starters/{annuity,retirement,rmd,roth}.ts); `with
- **InlineField now forces a ch-based width on all nine call sites to fix one** (P2) — Refuted on its load-bearing premise, and one of its two concrete predictions is measurably false.

Setup verified: `git diff` confirms the only new code is `style: { width: `${visibleWidth}ch` }` in C:\Users\Cyril\Projects\.portfolio-remedi

- **Presentation dim opacity 0.15 renders text effectively invisible, and the CSS contract test that forbade it was narrowed** (P2) — Refuted on three of its four legs.

(1) Visual claim does not reproduce. Served the fresh dist headless on :4371 and drove it to Retirement Income > step 1 at 1440x900. Dimmed modules render as clearly legible ghosted context: "Joint after-

- **All four starters' defaultCadence flipped to "all" with no unit coverage of the new value** (P2) — Refuted on four independent points; the value change is real but every assertion the finding builds on it is wrong.

1. "All four starters flipped to 'all'" is false. `C:\Users\Cyril\Projects\.portfolio-remediation-worktrees\money-map-appro

## Scoring rationale

**Design:** Re-derivation method: I treated the confirmed list as the only admissible evidence, then went to code and the running app to test every provisional deduction that no confirmed finding supported. Three drove real corrections.\n\nRefuted and corrected upward:\n1. \"Zero persistence — F5 destroys the work silently\" (drove Error Prevention to 2, and deductions in User Control, Visibility, Error Recovery). False. C:/Users/Cyril/Projects/.portfolio-remediation-worktrees/money-map-approved-remediation-20260714/src/money-map/editor/useMoneyMapEditor.ts calls saveDraft on every applyDocument, undo and redo (lines 84, 98, 109) and seeds history from loadDraft on mount and on starter change. persistence.ts:256-290 validates on load against schemaVersion 2 with a forbidden-key guard and falls back to the starter on malformed JSON. Verified live at localhost:4331: deleted a module (10 to 9), key `money-map:v2:retirement` written, reloaded, re-entered the starter, 9 modules. Work survives.\n2. \"Two panels clip 60%+ of their content with no scroll affordance\" (drove Recognition to 2). False. canvas.css:720-741 gives .advanced-properties and .flow-target-picker overflow:auto with max-height:400px explicitly matched to the surfacePosition.ts clamp constant, and canvas.css:854-858 gives .flow-target-picker__targets max-height:240px + overflow:auto. Overflow is scrollable by design, and no evaluator's confirmed finding alleges otherwise.\n3. \"Undo/redo absent from the palette; the palette lists no shortcuts\" (drove Recognition to 2, Flexibility deduction). False. commands.ts:301-316 regi

**Technical:** I re-derived each dimension from the confirmed findings only and landed at 15/20, one below the provisional 16. The single change is Responsive Design, 3 to 2. The provisional evaluator scored responsive before two pieces of evidence that survived adversarial verification: finding 21, which establishes that the step rail's word-safe clamp is inert in current Chromium (computed display resolves to flow-root, CSS.supports('line-clamp','1') false) and therefore clips 3-5 of 5 pills on every starter at 1280, 1440 and 1920 with max-width:100px making the extra room at 1920 useless; and the part of finding 3 showing the synthetic-data provenance line truncating to 'ad…' and collapsing to 0x0 at 1280. Combined with the Legend button clipping past the viewport edge at both 1280 and the documented 1180 minimum (scrollWidth equals clientWidth, so it is unreachable, not scrollable), the presentation rows losing their two-column alignment at fixed authored widths, and the chooser showing 1 of 4 starters at 1280x720, that is four independent viewport-dependent failures, two of them at the stated authoring floor. 'Responsive, minor overflow issues' does not describe that. Everything else I confirmed at the provisional value. I verified the load-bearing CSS directly rather than taking it on report: teaching.css:36-60 does carry the inert -webkit-line-clamp inside a fixed max-width:100px / min-height:44px / overflow:hidden pill; canvas.css:1513-1526 does set row-gap:0 with 4px padding under a 20px/1.1 type scale; canvas.css:1568 does display:none the authored header on presentation text ob

This document records measured results. No score was manually adjusted; no claim appears without the evidence used to reach it.
