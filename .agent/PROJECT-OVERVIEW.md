# Mathwiz Arena - Project Overview

## Project Summary

Mathwiz Arena is a greenfield rebuild of the Mathwiz online mathematics competition platform. It is not a continuation of any legacy codebase. This `.agent/` folder is written to be self-sufficient for implementation inside the current repository.

The platform serves three primary roles:

- `mathlete`: discovers competitions, manages teams, competes, reviews results, and tracks history
- `organizer`: applies for organizer access, builds problem banks, configures competitions, monitors live events, and publishes results
- `admin`: approves organizers, moderates users and content, manages the default problem bank, audits system activity, and intervenes in live incidents

## Execution Source of Truth

Implementation work must rely only on the following sources:

- `.agent/` as the primary execution contract
- `.agent/PROCESS-FLOW.md` as the role and workflow source of truth
- repo-local files such as `README.md`, `app/`, `components/`, `lib/`, `supabase/`, and `tests/`
- the live Figma frame `https://www.figma.com/design/cBQPJi1UVMFzrHlfsNPbsx/Mathwiz?node-id=1-125&t=1d0SstSZz2y1FYZG-1` for visual alignment
- current internet research for framework, library, accessibility, performance, and deployment guidance

No external local files are required or assumed. If a requirement was learned from prior planning work, it must be restated directly inside `.agent/` before it is allowed to influence implementation.
Figma is a design-validation input only. Behavior, permissions, validation rules, and data contracts must already be written in `.agent/` and repo-local sources rather than inferred from visuals alone.
If ownership matters for a branch, use the `**Assigned to:**` field inside that feature guide itself.

## Product Goal

Deliver a secure, mobile-friendly, competition-ready web application for math contests with:

- strong identity and role gating
- fast discovery and registration flows
- reliable live competition sessions
- rich mathematical authoring and answering
- transparent scoring, disputes, and publishing
- auditability, moderation, and operational controls

## Target Users and Roles

### Mathletes

- high-school students joining scheduled and open competitions
- individual participants and team members
- mobile and desktop users with varying math-editor familiarity

### Organizers

- schools, coaches, clubs, teachers, and legitimate event hosts
- problem authors and competition operators
- users who need high-volume forms, tables, bulk imports, exports, and live controls

### Admins

- platform operators who approve organizer access
- moderators who need safe intervention tools and complete audit trails
- owners of the shared default bank and system-wide policies

## In Scope

- authentication, profile completion, and role-aware redirects
- organizer application workflow and admin approval
- admin user management, moderation, audit logs, and resource access
- organizer profile/settings workspace
- problem bank CRUD, bulk import, problem snapshots, images, and math authoring
- scoring rules, answer normalization, tie-breakers, and recalculation
- scheduled and open competitions
- team creation, invites, roster locking, and ineligibility handling
- competition discovery, search, registration, withdrawal, and timezone-aware calendar
- arena session entry, autosave, server-side timer recovery, and review/submission
- anti-cheat focus loss logging, penalties, and organizer monitoring
- leaderboards, answer keys, disputes, history, notifications, and exports
- accessibility, responsiveness, testing, performance hardening, and release readiness

## Explicitly Out of Scope

- native mobile apps
- offline-first competition participation
- payment processing
- LMS integrations
- AI-generated problems or automated tutoring
- multi-tenant white-label deployments in the first release

## Full Tech Stack

### Frontend

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS 3
- shadcn/ui primitives
- `@tanstack/react-table` for complex admin and organizer tables
- TanStack Virtual only where lists or tables exceed practical client-side rendering limits
- MathLive for editable math input
- KaTeX for static math rendering

### Backend and Platform

- Supabase Auth
- Supabase Postgres
- Supabase Storage for logos and problem assets
- Supabase Realtime for targeted live updates
- server actions and server components for trusted mutations and data loading
- Vercel for deployment

### Testing and Quality

- ESLint
- Vitest for unit and integration tests
- Playwright for end-to-end flows and live UX regression checks
- Lighthouse and browser profiling during release hardening

## Research-Backed Implementation Choices

These choices were validated against current official documentation and maintained project docs:

- Next.js App Router streaming and route loading should rely on `loading.tsx` and Suspense rather than a purely client-driven top loader, because Next.js explicitly supports interruptible navigation and prefetched loading fallbacks in the App Router.
- Supabase auth should use `@supabase/ssr` cookie-backed clients and server-side `getUser()` checks, because Supabase's current Next.js SSR guidance treats that as the supported path.
- RLS must be enabled on every public table, view, and callable surface that exposes data APIs, because Supabase's current security guidance assumes RLS as the core enforcement boundary.
- Realtime should be reserved for high-value live surfaces like announcements, notifications, leaderboard refreshes, participant monitoring, and active-attempt signals. Supabase documents that Postgres Changes authorization work scales per subscriber, so broad subscriptions must be avoided on hot tables.
- Complex tables should use shadcn/ui plus `@tanstack/react-table` because the shadcn docs explicitly position the data-table pattern as a custom composition layer rather than a monolithic grid.
- MathLive is the primary math editor because it has current React guidance, touch-friendly virtual keyboard support, and a modern `math-field` API. MathQuill remains an evaluated fallback but is not the default direction.

## Visual Direction

The current Figma direction establishes:

- dark navy and warm amber as the primary brand palette
- white or soft neutral surfaces for content-heavy forms and dashboards
- strong top navigation and role-based portal shells
- card and table-heavy interiors for data management
- mobile-first layouts with stacked cards, drawers, and simplified action density

The rebuilt app should preserve that direction while avoiding fragile one-off implementations.

## Performance Expectations

- use server components by default for read-heavy pages
- add `loading.tsx` and segmented Suspense boundaries for heavy routes
- avoid client-only auth gating flicker by hydrating trusted server state first
- use server-side pagination, search params, and indexed queries for large lists
- add virtualization only where table size justifies it
- keep Realtime subscriptions scoped to the current competition or current user
- snapshot competition content at publish time to avoid expensive joins and mutable historical reads
- lazy-load expensive editors, charts, and export utilities

## Accessibility Expectations

- semantic HTML and correct landmarks across every route
- keyboard-complete dialogs, dropdowns, drawers, editors, and tables
- visible focus states and high-contrast interactions
- labeled fields, help text, validation messaging, and ARIA status regions
- reduced-motion-safe transitions
- mobile-safe targets for competition, review, and moderation actions
- screen-reader-safe math display and fallback text for complex equations where needed

## Security Expectations

- service-role keys are server-only and never exposed to the browser
- every table, view, and RPC in `public` gets explicit access rules
- profiles and organizer approvals are enforced from trusted server paths
- admin self-modification protections are explicit in UI and backend logic
- competition snapshots prevent mutable problem bank edits from corrupting live or historical data
- anti-cheat and audit trails are append-oriented and tamper-resistant from normal user roles

## Coverage Summary

The execution plan below covers:

- UR1-UR3: auth, profile completion, single-session behavior, suspended-user handling
- UR4-UR5: admin moderation, audit logs, resource access, default-bank governance
- UR6-UR8: problem banks, scoring rules, competition configuration, tab-switching oversight
- UR9-UR12: teams, discovery, registration, notifications, and calendar localization
- UR13-UR16: live monitoring, arena, review/submission, answer key, leaderboard, history, and export flows
- cross-cutting platform requirements that must be treated as first-class work: loading systems, mobile navigation, role-aware redirects, server-side profile persistence, read-only admin resources, defensive publish/delete/pause rules, and release-quality verification

## Implementation Philosophy

- keep branches atomic but not naive
- plan cross-cutting concerns in the feature that should own them
- prefer shared infrastructure over repeated ad hoc implementations
- design the database for immutable competition history and trusted grading
- keep `.agent/` as a living source of truth and update it whenever backend or workflow assumptions change

## Primary References

- Next.js App Router docs: https://nextjs.org/docs/app
- Next.js loading and streaming: https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
- Supabase Next.js SSR auth guide: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase API security and RLS: https://supabase.com/docs/guides/api/securing-your-api
- Supabase Realtime Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes
- shadcn/ui data table docs: https://ui.shadcn.com/docs/components/data-table
- TanStack Table pagination: https://tanstack.com/table/latest/docs/guide/pagination
- TanStack Table virtualization: https://tanstack.com/table/latest/docs/guide/virtualization
- MathLive React guide: https://mathlive.io/mathfield/guides/react/
