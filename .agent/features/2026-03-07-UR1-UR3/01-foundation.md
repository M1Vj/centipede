# 01 - Foundation

- Feature branch: `feature/foundation`
- Requirement mapping: UR1-UR16 — platform bootstrap, shared architecture, schema baseline, testing baseline, and legal/static foundations for every later feature
- Priority: 1
- **Assigned to:** Mabansag, Vj

## Mission

Create the production-grade baseline for the rebuild. This branch establishes the repo structure, environment handling, root layouts, shared design tokens, base schema, legal pages, local development workflow, and the testing scaffolding that every later branch assumes exists.

This branch exists because environmental cleanup, layout refinement, local Supabase alignment, and baseline testing are first-class platform work. Later branches must inherit them instead of rediscovering them.

Depends on: none.

Unblocks: every later feature.

## Full Context

- Business context: the platform must feel trustworthy and fast before any role-specific feature lands.
- User roles: anonymous visitors, future mathletes, future organizers, admins.
- UI flow: landing page, top navigation, auth shell styling, legal pages, root layout, base portal placeholders.
- Backend flow: environment normalization, Supabase local config, initial auth-linked tables, seed strategy, generated types.
- Related tables: `profiles`, `organizer_applications`, `notification_preferences` trigger stub if added here.
- Security concerns: no service-role leakage, safe env access during build, no client-only auth assumptions.
- Performance concerns: App Router structure, route segmentation, root-level suspense planning, image and font discipline.
- Accessibility concerns: semantic root layout, keyboard-safe nav, consistent heading hierarchy, contrast-safe token choices.
- Mobile expectations: the landing page and auth shells must work on narrow screens without desktop-only spacing.

## Research Findings / Implementation Direction

- Use the official Next.js App Router baseline and plan for `loading.tsx` and Suspense instead of treating route feedback as an afterthought.
- Use Supabase SSR server and browser clients from the start so later auth and role gating do not require a second foundation pass.
- Keep shadcn/ui as the base component layer and reserve heavier table/grid logic for later branches that truly need it.
- Align the global palette and spacing system with the documented Figma direction now so later dashboards are composed, not restyled branch by branch.

## Requirements

- bootstrap the workspace on Next.js 15, React 19, TypeScript, Tailwind, and Supabase SSR
- normalize environment handling for public keys and future service-role usage
- create a root layout, header, landing page, and legal/static pages
- establish shared color tokens, spacing primitives, and typography rules
- add local Supabase config, initial migration(s), and a repeatable dev reset flow
- add lint, Vitest baseline, and Playwright placeholder configuration for later branches
- document setup in `.agent/`, `README.md`, and any generated local docs if they are part of the branch

## Atomic Steps

1. Scaffold or align the repo to Next.js 15 App Router conventions.
2. Normalize `.env.example`, `.env.local` expectations, and environment helpers.
3. Add `lib/supabase/server.ts`, `lib/supabase/client.ts`, and `lib/supabase/proxy.ts` baseline helpers.
4. Create the initial migration for `profiles`, organizer applications, core enums, and auth trigger functions.
5. Add `supabase/config.toml`, seed placeholders, and local CLI scripts.
6. Build the root layout, global CSS tokens, and the first-pass landing page aligned to the Figma palette and composition style.
7. Add legal pages for privacy and terms because organizer application flows depend on them later.
8. Create auth shell wrappers so auth pages can stay visually consistent without duplicating layout code.
9. Add a minimal protected route placeholder and portal placeholders for later role shells.
10. Configure ESLint, Vitest, testing setup, and baseline CI-friendly scripts.
11. Verify local dev, local Supabase commands, lint, and the baseline tests.
12. Update `.agent/checklist.md`, `.agent/DATABASE-EDR-RLS.md`, and `.agent/learned-rules.md` if scope or schema assumptions changed during implementation.

## Key Files

- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `app/privacy/page.tsx`
- `app/terms/page.tsx`
- `components/auth-shell.tsx`
- `lib/supabase/env.ts`
- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- `lib/supabase/proxy.ts`
- `supabase/config.toml`
- `supabase/migrations/*`
- `tests/setup.ts`
- `vitest.config.ts`

## Verification

- Manual QA: root page, legal pages, and auth shell layouts render correctly on desktop and mobile.
- Automated: `npm run lint`, `npm run test`.
- Accessibility: keyboard navigation works in header and legal/auth pages, and landmark structure is valid.
- Performance: root layout avoids unnecessary client wrappers and large bundled assets.
- Edge cases: missing env vars fail loudly in dev but do not crash static build paths unintentionally.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `chore: bootstrap nextjs and supabase workspace`
  - `feat: add root layout landing page and legal shells`
  - `chore: add local supabase config and initial schema`
  - `test: add baseline lint and vitest setup`
- PR title template: `UR1-UR3: foundation bootstrap and base platform setup`
- PR description template:
  - Summary: bootstrap workspace, base schema, root layout, and test baseline
  - Testing: lint, vitest, local dev, local Supabase reset/status
  - Docs: overview, DB doc, checklist, learned rules updated

## Definition of Done

- the app boots cleanly with the chosen stack
- the initial Supabase schema and local workflow are reproducible
- global tokens and layouts exist and match the intended visual direction
- the branch leaves no missing setup work for authentication to invent later
- `.agent/checklist.md` is ready for `01-foundation` to be marked complete after merge
