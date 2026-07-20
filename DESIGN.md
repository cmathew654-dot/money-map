# Money Map design contract

## Product register

Money Map is an advisor authoring canvas with presentation-quality output. It must not resemble a card-grid SaaS dashboard, generic whiteboard, PowerPoint clip-art diagram, or AI-generated template gallery.

## Shared shell

- One quiet Cairn editor shell and one component/command model.
- Starter chooser is the initial screen.
- World geometry does not reflow when the viewport changes.
- Authoring minimum is 1180×660; narrower viewports receive an honest cover.
- Presentation retains story title, as-of date, and synthetic-data provenance.

## Camera and selection

- Wheel and pinch zoom around the pointer.
- `Ctrl/Cmd +/-`, Fit map, Fit selection, and 100% commands.
- Bottom-left `−`, percentage, `+`, and Fit controls.
- Empty-canvas, middle-button, and Space drag pan. Shift-drag creates a marquee selection.
- Click selects, Shift-click adds, Escape clears or cancels.
- Focus and selection remain visually distinct.

## Editing surfaces

- A screen-space selection halo exposes Edit, Style, Draw flow, Duplicate, and More.
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

- The primary action is `Draw flow`; the user drags from a visible object port to a target object or empty canvas.
- Route geometry: straight, orthogonal, or curved.
- Relationship semantics: income, transfer, replenishment, or planned/conditional, redundantly conveyed by pattern and label.
- Label treatment: plain, plate, or filled.
- Color and weight never communicate amount or confidence.
- Labels stay bound to their paths and have generous invisible hit targets.
- Clicking or pressing Enter edits a label. Labels move independently from route waypoints; route bends, endpoints, and labels have separate hit targets.
- Routing uses all four attachment sides, removes needless doglegs, and keeps authored bends independent from labels. Background-colored edge casing clarifies genuine crossings without a hidden obstacle-avoidance engine.

## Cadence

Monthly, Annual, One-time, As needed, and exact custom cadence are display-only. Starters open on their authored default story/cadence view rather than an indiscriminate All view. All remains an explicit overview; Fit story restores the authored camera.

## Interaction hierarchy

- Single click selects; double-click or Enter edits the visible text under the pointer.
- A compact Add control exposes shapes, flow, text, and note. `L` starts Draw flow; `Ctrl/Cmd+K` exposes every command.
- Dragging from a selected object's quick-create port creates a connected object with the current style.
- Multi-selection supports z-order, align, and distribute without moving unrelated content.
- A small optional legend explains authored semantics.

## Art directions

- **Private Ledger:** warm paper, carbon, burnished ochre; editorial ledger, plates, tray, roundel, curved routes.
- **Distribution Registry:** neutral field, deep pine, iron, rust; annual distribution sequence and orthogonal routes.
- **Foundation:** graphite, chalk, mineral blue, muted amber; architectural income-floor bands and straight/stepped routes.
- **Conversion Path:** near-white, aubergine, controlled vermilion; staged corridor with open frames, bands, roundels, and mixed routes.

## Accessibility and motion

Target WCAG 2.2 AA, keyboard parity, focus restoration, live announcements, reduced motion, non-drag alternatives, at least 24×24px targets, and 44×44px primary targets for coarse pointers.
