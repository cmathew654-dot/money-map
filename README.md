# Cairn Money Map

Cairn Money Map is a presentation-quality financial story canvas for advisors. It is an upscale, dynamic successor to the PowerPoint diagrams used to explain accounts, income sources, reserves, household needs, and the relationships between them.

The repository is being rebuilt as a focused React and TypeScript portfolio application. The current checkpoint contains the standalone shell, an equal-weight four-story chooser, and a lean automated verification gate. Canvas editing and the four finished narratives are the next implementation phases.

## Product boundary

Money Map displays advisor-authored financial values literally. It does not calculate taxes, reconcile balances, infer funding capacity, debit accounts, or validate financial recommendations.

All public demo data is synthetic and belongs to the fictional Hartwell household. Cairn is a fictional identity.

## Local development

```powershell
npm install
npm run dev
```

Open the local address reported by Vite.

## Verification

```powershell
npm run verify
```

The gate checks formatting, lint, strict TypeScript, unit tests, the production build, and a focused Chromium journey.

## Project documentation

- [Product brief](PRODUCT.md)
- [Design contract](DESIGN.md)
- [Current state](PROJECT.md)
- [Architecture plan](docs/superpowers/plans/2026-07-19-money-map-portfolio-rebuild.md)

## Status

Active portfolio rebuild. This is not production financial-planning software and should not be treated as financial advice.
