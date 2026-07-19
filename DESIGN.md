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

- A screen-space selection halo exposes Edit, Style, Connect, Duplicate, and More.
- `Ctrl/Cmd+K` and a visible Actions control open the shared command palette.
- Every command surface uses one registry and one undo history.
- Double-click or Enter starts direct editing; Enter or blur commits; Escape restores exact prior content.
- Advanced properties open deliberately in Content, Appearance, and Connections tabs.
- Modules resize horizontally with content-driven height. Text never scales. Width presets provide a keyboard alternative.

## Visual primitives

`ledger`, `plate`, `tray`, `band`, `roundel`, and `frame` are appearance choices independent of semantic module type and financial value.

## Connections

- Route geometry: straight, orthogonal, or curved.
- Relationship semantics: directional flow, association, or planned/conditional.
- Label treatment: plain, plate, or filled.
- Color and weight never communicate amount or confidence.
- Labels stay bound to their paths and have generous invisible hit targets.
- Clicking or pressing Enter edits a label. Dragging beyond threshold inserts or moves its waypoint.

## Cadence

Monthly, Annual, One-time, As needed, and exact custom cadence are display-only. Author mode can filter All, Monthly, Annual, and Other.

## Art directions

- **Private Ledger:** warm paper, carbon, burnished ochre; editorial ledger, plates, tray, roundel, curved routes.
- **Distribution Registry:** neutral field, deep pine, iron, rust; annual distribution sequence and orthogonal routes.
- **Foundation:** graphite, chalk, mineral blue, muted amber; architectural income-floor bands and straight/stepped routes.
- **Conversion Path:** near-white, aubergine, controlled vermilion; staged corridor with open frames, bands, roundels, and mixed routes.

## Accessibility and motion

Target WCAG 2.2 AA, keyboard parity, focus restoration, live announcements, reduced motion, non-drag alternatives, at least 24×24px targets, and 44×44px primary targets for coarse pointers.

