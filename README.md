# Cairn Money Map

Money Map turns a household's accounts, income sources, reserves, needs, and relationships into a composed visual story an advisor can shape with the household in front of them. It is a portfolio demonstration of WealthTech product judgment and frontend design engineering—not a financial calculator.

## Try the demo locally

```powershell
npm ci
npm run dev
```

Open the address reported by Vite, choose a story, and edit the map. Authoring requires a viewport of at least 1180 × 660; smaller viewports receive an explicit cover instead of a compromised editor.

## Four starting stories

- **Retirement Income — Private Ledger:** connects recurring income, household needs, liquidity, accounts, and planned withdrawals.
- **RMD & Withholding — Distribution Registry:** lays out distribution instructions, charitable direction, withholding, net destination, and year-end records.
- **Annuity Income Floor — Foundation:** shows household income, advisor-authored premium planning, an illustrative contract, liquidity, and an income need without implying funding capacity.
- **Roth Conversion — Conversion Path:** stages source and destination accounts, separate 2026 and 2027 windows, outside tax reserves, and planning guardrails.

Each starter has its own visual direction and contains an Overview plus five named focus states in the document model. The current public interface is the authoring experience; live presentation-step navigation is not yet exposed.

## Financial boundary

Every financial value is stored and displayed as literal text. Approximation marks, ranges, blanks, cadence phrases, and advisor-authored prose round-trip unchanged.

Money Map does **not** calculate taxes, reconcile balances, annualize cash flows, infer funding capacity, debit accounts, validate recommendations, or use financial values to control geometry, color, line weight, or flow behavior.

## Key interactions

- Select, multi-select, move, duplicate, remove, and horizontally resize modules.
- Edit module and relationship text directly; use the property surfaces for appearance, routes, semantics, endpoints, label treatment, and cadence.
- Pan and zoom the canvas, fit the map or selection, and route relationship labels by pointer or keyboard.
- Filter relationships by cadence and use one searchable Actions palette (`Ctrl/Cmd+K`) for shared commands.
- Undo, redo, reset a starter, and restore committed edits from local browser storage.

## Stack

React 19, TypeScript, Vite, React Flow, Vitest, Testing Library, Playwright, ESLint, and Prettier. There is no backend, authentication, cloud sync, collaboration, or arbitrary import/export.

## Build and verify

Node 24 and npm 11 are required.

```powershell
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run check:pages
```

`npm run verify` runs the complete local gate, including the focused Chromium journeys. The Pages artifact check confirms that production assets remain relative and resolvable under a repository subpath.

## Architecture

Starter fixtures feed a typed, literal-safe document model. A shared editor hook owns history and per-starter persistence; a single command registry drives keyboard, palette, halo, and property actions. React Flow is isolated behind canvas adapters and custom module/relationship renderers, while themes change presentation without changing behavior or financial meaning.

See [architecture](docs/architecture.md), [data provenance](docs/provenance.md), [product intent](PRODUCT.md), and [design contract](DESIGN.md).

## Accessibility

The editor provides keyboard alternatives for core canvas actions, visible focus distinct from selection, focus restoration for transient surfaces, polite live announcements, reduced-motion handling, and labeled modules, relationships, camera controls, tabs, and dialogs. Primary coarse-pointer targets expand to 44 × 44 pixels. Accessibility is covered by component and browser tests, but this portfolio build does not claim independent WCAG certification.

## Demo data and status

Cairn, the Hartwell family, and every displayed scenario are fictional. No real client data, firm logos, or raw reference media is included; see [provenance](docs/provenance.md).

This repository is an active portfolio build, not production financial-planning software or financial advice. The GitHub Pages workflow is prepared but has not been run, and no public deployment URL is claimed here.
