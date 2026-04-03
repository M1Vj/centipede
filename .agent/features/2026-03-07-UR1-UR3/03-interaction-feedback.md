# 03 - Interaction Feedback

- Feature branch: `feature/interaction-feedback`
- Requirement mapping: UR1-UR16 — cross-cutting loading, error, navigation, feedback, and shell support reused by every feature branch
- Priority: 3
- **Assigned to:** Mabansag, Vj

## Mission

Build the shared UX infrastructure for loading, pending, empty, error, confirm, and navigation feedback, then apply it to the early auth and portal surfaces. This branch also establishes shared portal shell behavior, mobile navigation patterns, and stateful UI conventions that later branches must reuse.

This branch exists because the old project repeatedly discovered that loading states, double-submit protection, and mobile nav could not be bolted on reliably after feature pages already diverged.

Depends on: `01-foundation`, `02-authentication`.

Unblocks: admin, organizer, discovery, tables, wizards, and live competition flows.

## Full Context

- Business context: the product must feel stable before the problem bank, wizard, or live arena make it more complex.
- User roles: all roles, because the same feedback primitives and shell rules apply across the app.
- UI flow: route transitions, form submits, destructive confirmations, initial dashboard placeholders, mobile drawers, empty states.
- Backend flow: mostly UI infrastructure, but it must align with server actions and async errors coming from trusted mutations.
- Related tables/functions: none directly, but these components wrap later feature mutations.
- Edge cases: rapid double click, slow network, empty datasets, unauthorized mutation errors, route swaps during redirect.
- Performance concerns: avoid flashy loaders on fast transitions; prefer segment-scoped loading and skeletons.
- Accessibility concerns: `aria-busy`, status regions, focus restoration in dialogs, and mobile-safe action density.
- Mobile expectations: sidebars collapse into drawers; confirm dialogs remain usable on small screens; tables fall back to stacked summaries for viewports below 768px.

## Research Findings / Implementation Direction

- Use App Router-compatible loading patterns, not a brittle global-only client loader.
- Standardize pending button behavior early so server actions and future table actions do not each invent their own disabled and spinner logic.
- Build reusable empty/error/loading states and confirm dialogs as composable primitives.
- Establish role-shell contracts now, including mobile navigation and consistent page headers, before admin and organizer workspaces branch apart.

## Requirements

- create shared pending, loading, empty, and error UI primitives
- add reusable confirmation dialog patterns for destructive and irreversible actions
- define shared page-shell conventions for mathlete, organizer, and admin portals
- refactor current auth and profile flows to use the new shared system
- ensure every primitive is accessible and mobile-safe

## Atomic Steps

1. Create reusable skeleton, empty-state, and error-state components.
2. Extend the shared button component to support pending text, spinner state, and repeat-submit prevention.
3. Add a shared confirmation dialog primitive for delete, suspend, reject, publish, and submit flows.
4. Build a shared page header pattern for portal pages with title, subtitle, and action area.
5. Build the first mobile navigation drawer pattern that later admin and organizer shells will reuse.
6. Apply the primitives to current auth and profile pages.
7. Add tests around shared UI primitives and navigation helpers.
8. Verify behavior on slow network simulation and mobile viewport sizes.

## Key Files

- `components/ui/button.tsx`
- `components/ui/spinner.tsx`
- `components/ui/feedback-states.tsx`
- `components/ui/feedback-skeletons.tsx`
- `components/ui/confirm-dialog.tsx`
- `components/providers/navigation-feedback-provider.tsx`
- `hooks/use-feedback-router.ts`
- `app/admin/layout.tsx`
- `app/organizer/layout.tsx`
- `app/mathlete/layout.tsx`
- `tests/ui/*`

## Verification

- Manual QA: loading feedback appears on slow async transitions without noisy flashing.
- Automated: UI component tests for button pending behavior, feedback states, and confirm dialog interactions.
- Accessibility: dialogs trap focus, status regions announce async state, buttons expose disabled state correctly.
- Performance: shared primitives are small, reusable, and do not force large client-only wrappers unnecessarily.
- Edge cases: destructive dialogs cannot double-submit; empty/error states remain readable with long text and narrow screens.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(ui): add shared loading empty and error primitives`
  - `feat(ui): extend button and confirm dialog patterns`
  - `feat(layout): add portal shell and mobile navigation foundations`
  - `refactor(auth): adopt shared feedback primitives`
- PR title template: `Platform: shared interaction feedback and shell foundations`
- PR description template:
  - Summary: shared UX primitives, navigation feedback, shell conventions, mobile nav
  - Testing: lint, UI tests, manual desktop and mobile checks
  - Docs: learned rules updated if shell conventions changed

## Definition of Done

- shared feedback primitives exist and are already consumed by the early app surfaces
- portal shell conventions are defined before role workspaces expand
- mobile navigation has an agreed reusable pattern
- no later feature needs to invent its own loading or confirm pattern from scratch
