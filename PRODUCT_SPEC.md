# Product Spec: Account Flow Visualizer Prototype

## Summary
Account Flow Visualizer replaces static advisor PowerPoint money maps with a polished, interactive browser-based canvas. The prototype is designed to prove that an advisor can explain account movement, retirement-income strategy, annuity positioning, and household cash flow with visuals that feel materially better than the current slide workflow.

This is not a financial projection engine. The first version is a visual product test focused on presentation quality, direct manipulation, and client-meeting clarity.

## Problem
Financial advisors often prepare client-facing account-flow visuals in PowerPoint with primitive shapes, manual arrows, inconsistent labels, and dated formatting. The work is slow to edit, difficult to reuse, and rarely looks premium without manual design effort.

The product opportunity is to turn that workflow into an opinionated visual canvas where advisor-entered account values, account buckets, and flow lines are easy to adjust and impressive by default.

## Target User
The first user is an individual advisor or small RIA team preparing for client meetings. The prototype should support an advisor who wants to create or modify a retirement-income visual quickly, without learning a generic diagramming tool.

Enterprise home-office users, firm administrators, compliance teams, and multi-tenant security reviewers are not the first audience for this prototype.

## MVP Goal
The first milestone is a narrow visual/product test:

An advisor can create or modify a retirement-income money map in under 10 minutes, and the result looks clearly more modern, polished, and client-ready than the PowerPoint alternative.

## Template Set
The default scenario is `Retirement Income Flow`, now framed around monthly need, mapped monthly income, and the gap or surplus.

The prototype includes the original Roth conversion, annuity income, estate / trust transfer, and cash reserve scenarios, plus ten cashflow-oriented meeting templates: Retirement Paycheck Stack, Bridge to Social Security, Bucket Strategy Income Plan, RMD + Tax Withholding Flow, Taxable + IRA Withdrawal Sequencing, High Cash Household Cleanup, Annuity Income Floor, Executive Comp Cashflow, Business Owner Liquidity Map, and Widow/Widower Income Reset. Every template uses fake data, pre-positioned account visuals, styled flow lines, a monthly need / client paycheck tile where relevant, and a presentation-ready disclosure footer.

## In Scope
- Browser-based visual prototype.
- Fake/demo data only.
- Fifteen preloaded advisor templates.
- Three visual themes: Stewardship, Horizon, and Camino.
- Account visuals for cards, monthly need / client paycheck tiles, buckets/cylinders, policy tiles, trust containers, household markers, and amount/tax tags.
- Flow types for rollover, transfer, income distribution, annuity premium, Roth conversion, tax payment, RMD, fee, rebalance, and beneficiary transfer.
- Direct flow amount editing.
- Inline finance value editing.
- Edge-drag connector creation.
- Multi-select with align/distribute controls.
- Undo/redo and canvas keyboard shortcuts.
- Deterministic value and fill updates when a flow changes.
- Presentation mode that hides editing chrome and improves meeting-room polish.
- Lightweight prototype disclaimers such as "For illustration only" and "Advisor-entered approximate values."

## Out of Scope for Prototype
- Enterprise auth, SSO, SCIM, firm administration, and role management.
- Database persistence, encrypted snapshots, audit logging, and tenant isolation.
- Real PowerPoint parsing or import.
- PDF export.
- Compliance workflow, archiving, supervisory approval, or advice generation.
- External data integrations, market values, CRM imports, custodian imports, tax analysis, investment optimization, or projections.

## Product Principles
- Template first, not blank canvas first.
- Premium by default, not configurable into quality later.
- Visual clarity beats feature count.
- Motion should make value movement feel alive, not distract from the story.
- Account and flow labels must be readable at normal meeting-room sizes.
- The app should feel like an advisor tool, not a generic whiteboard.

## Success Criteria
- The default diagram is understandable without onboarding text.
- The first screen already looks like a premium advisor presentation.
- Editing a flow amount immediately updates connected values, labels, and fill states.
- Presentation mode feels client-ready.
- The prototype uses no real client data.
- Deferred platform features remain deferred until the visual prototype proves demand.
