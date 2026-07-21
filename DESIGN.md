# Money Map design contract

## Product register

Money Map is an advisor authoring canvas with presentation-quality output. It must not resemble a card-grid SaaS dashboard, generic whiteboard, PowerPoint clip-art diagram, or AI-generated template gallery.

## Shared shell

- One quiet Cairn editor shell and one component/command model.
- Starter chooser is the initial screen.
- World geometry does not reflow when the viewport changes.
- Authoring minimum is 1180×660; narrower viewports receive an honest cover.
- Presentation retains story title, as-of date, and synthetic-data provenance.
- Presentation renders the authored composition unchanged: the same type ramp, inset, and spacing as the canvas. It never re-types or re-spaces a module. The only content it sheds is the relationship label's cadence and detail lines.
- Legibility in presentation is a camera property, not a typography property. Overview is an orientation view — composition, titles, and headline figures read at fit scale; row detail is supporting texture. The five named steps are the reading views, framed by fit-to-step. Authored card geometry is fixed, so inflating type to force detail-level reading at fit scale can only come out of padding and hierarchy.

## Module type ramp

One ramp, both modes: note 11, rows and eyebrow 12, subtitle 13, total 20, title 23 serif. The total is the figure the card exists to communicate and carries its own step in the ramp; it stacks its label above the figure at full card width rather than sharing the row's label/value split, which would squeeze the label into a wrapped column.

## Camera and selection

- Wheel and pinch zoom around the pointer.
- `Ctrl/Cmd +/-`, Fit story, Fit selection, and 100% commands.
- Bottom-left `−`, percentage, `+`, and Fit controls.
- Empty-canvas, middle-button, and Space drag pan. Shift-drag creates a marquee selection.
- Click selects, Shift-click adds, Escape clears or cancels.
- Focus and selection remain visually distinct.

## Editing surfaces

- A screen-space selection halo exposes Edit, Style, Connect to…, Duplicate, and More.
- `Ctrl/Cmd+K` and a visible Actions control open the shared command palette.
- Every command surface uses one registry and one undo history.
- Double-click or Enter starts direct editing; Enter or blur commits; Escape restores exact prior content.
- Advanced properties are optional and progressive: Content, Appearance, and Flows only when needed.
- Objects resize on both axes and rotate in 15° increments without scaling text. Resizing is disabled while rotated; flows continue to use stable unrotated attachment bounds. Numeric fields and presets provide keyboard alternatives.

## Visual grammar

Eight shapes are available: `ledger`, `plate`, `tray`, `band`, `roundel`, `frame`, `cylinder`, and `text`. Every shape must serve a financial-story or annotation role and remains independent of semantic module type and financial value.

- Priority: Quiet, Standard, and Spotlight.
- Content density: Essential, Standard, and Full.
- Color begins with semantic roles and curated per-theme swatches with contrast-paired text.
- Priority levels provide restrained material-quality treatments through layered borders, controlled gradients, soft shadows, inset highlights, and dimensional caps where appropriate.
- Shape swapping preserves content, style, flows, size, rotation, and history. New objects inherit the last compatible style.

## Connections

- Connecting is a mode, not a precision gesture. `C` or the Connect control suspends card dragging and makes each whole card both source and target: click one card, then another. The alternative was asking the pointer to distinguish "move this card" from "start a flow here" on the same pixels, which forced connections onto four 8px hover-only ports.
- `Connect to…` — the selection halo, the palette, or `L` — is the same concept reached by keyboard: it lists candidate destinations for the selected card. Both routes share the word "Connect" because they are one feature with two doors.
- Ports are attachment geometry, not handles. They never start a connection and stay invisible until a selected relationship offers its endpoints for re-anchoring.
- Route geometry: straight, orthogonal, or curved.
- Relationship semantics: income, transfer, replenishment, or planned/conditional, redundantly conveyed by pattern and label.
- Label treatment: plain, plate, or filled. Authoring exposes all three; authored stories derive treatment from relationship type — income is filled, transfer is plate, replenishment and planned are plain — so treatment is a third redundant semantic channel rather than decoration. A story with no income relationship therefore has no filled label.
- Color and weight never communicate amount or confidence.
- Labels stay bound to their paths and have generous invisible hit targets.
- Click selects a label; double-click or Enter edits it, matching module text. Labels move independently from route waypoints; route bends, endpoints, and labels have separate hit targets.
- Routing uses all four attachment sides, removes needless doglegs, and keeps authored bends independent from labels. Background-colored edge casing clarifies genuine crossings without a hidden obstacle-avoidance engine.

## Cadence

Monthly, Annual, One-time, As needed, and exact custom cadence are display-only. Starters open on their authored default story/cadence view rather than an indiscriminate All view. All remains an explicit overview; Fit story restores the authored camera.

## Interaction hierarchy

- Single click selects; double-click or Enter edits the visible text under the pointer.
- A compact Add control exposes the eight purposeful shapes, including text and planning-frame objects. `C` enters Connect mode and `L` opens `Connect to…` for the selected card; `Ctrl/Cmd+K` exposes every command.
- Dragging from a selected object's quick-create port creates a connected object with the current style.
- Multi-selection supports z-order, align, and distribute without moving unrelated content.
- A small optional legend explains authored semantics.

## Art directions

- **Private Ledger:** warm paper, carbon, burnished ochre; editorial ledger, plates, tray, roundel, curved routes.
- **Distribution Registry:** neutral field, deep pine, iron, rust; annual distribution sequence and orthogonal routes.
- **Foundation:** graphite, chalk, mineral blue, muted amber; architectural income-floor bands and straight/orthogonal routes.
- **Conversion Path:** near-white, aubergine, controlled vermilion; staged corridor with open frames, bands, roundels, and mixed routes.

The route signature above is part of what makes four stories read as four
directions rather than one template reskinned, so it is a contract on authored
content, not a description of it. Known open contradiction: each starter's
tests currently assert that every story uses all three route styles, and three
of the four directions no longer match their signature — Private Ledger is
authored orthogonal-plurality despite "curved routes" being its own. Resolve
by re-authoring routes per direction, not by relaxing this line.

## Accessibility and motion

Target WCAG 2.2 AA, keyboard parity, focus restoration, live announcements, reduced motion, non-drag alternatives, at least 24×24px targets, and 44×44px primary targets for coarse pointers.
