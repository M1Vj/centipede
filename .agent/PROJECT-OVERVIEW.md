# Mathwiz Arena - Project Overview

## Project Summary

Mathwiz Arena is a greenfield rebuild of the Mathwiz online mathematics competition platform. It is an independent implementation inside the current repository. This `.agent/` folder is written to be self-sufficient for implementation inside the current repository.

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
- mathlete profile/settings edits for school and grade-level changes
- organizer application workflow, applicant status visibility, admin approval, and organizer activation handoff
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

## Target Stack Contracts

This section defines the rebuild target stack contracts. Some dependencies may be introduced by their owner branches and are not guaranteed as present-state workspace dependencies before those branches execute.

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
- browser automation only when an approved `CORE_PATCH_REQUESTS` exception exists; otherwise rely on Vitest plus manual/dev-server QA
- Lighthouse and browser profiling during release hardening

## Research-Backed Implementation Choices

These choices were validated against current official documentation and maintained project docs:

- Next.js App Router streaming and route loading should rely on `loading.tsx` and Suspense rather than a purely client-driven top loader, because Next.js explicitly supports interruptible navigation and prefetched loading fallbacks in the App Router.
- Supabase auth should use `@supabase/ssr` cookie-backed clients and server-side `getUser()` checks, because Supabase's current Next.js SSR guidance treats that as the supported path.
- RLS must be enabled on every public table, view, and callable surface that exposes data APIs, because Supabase's current security guidance assumes RLS as the core enforcement boundary.
- Realtime should be reserved for high-value live surfaces like announcements, notifications, leaderboard refreshes, participant monitoring, and active-attempt signals. Supabase documents that Postgres Changes authorization work scales per subscriber, so broad subscriptions must be avoided on hot tables.
- Complex tables should use shadcn/ui plus `@tanstack/react-table` because the shadcn docs explicitly position the data-table pattern as a custom composition layer rather than a monolithic grid.
- Open-source-first is required for complex UX and infrastructure surfaces: prefer maintained, well-documented libraries over bespoke implementations unless there is a documented blocker.
- Math input is a locked v1 stack: MathLive for editable entry (with symbol toolbox and virtual keyboard), KaTeX for static rendering, and LaTeX as the canonical persisted format.

## Visual Direction

The current Figma direction establishes:

- dark navy and warm amber as the primary brand palette
- white or soft neutral surfaces for content-heavy forms and dashboards
- strong top navigation and role-based portal shells
- card and table-heavy interiors for data management
- mobile-first layouts with stacked cards, drawers, and simplified action density

The rebuilt app should preserve that direction while avoiding fragile one-off implementations.

## Figma Integration Trace (2026-04-18)

- Source design file: `https://www.figma.com/design/cBQPJi1UVMFzrHlfsNPbsx/Mathwiz?node-id=1-125&t=wi7iD40k8rPMSyLH-1`
- Canvas reference node: `1:125`
- Landing source node: `45:2`
- Signin/Signup source node: `62:5`
- Mathlete dashboard nav source nodes: `164:2488`, `167:3350`

Integrated patterns in current repository implementation:

- Landing:
	- floating dark pill header direction with home anchor targets (`product`, `features`, `methodology`, `pricing`)
	- hero hierarchy with highlighted "scaled for schools" copy treatment
	- dual CTA treatment (`Start Free Trial`, `View Demo`) and dashboard mock analytics panel
	- three feature cards, three stacked methodology phases, engagement metrics section, and three-tier pricing with highlighted middle plan
- Auth:
	- split-card composition with dark left story panel and white right form panel
	- segmented auth switch for login vs sign-up context
	- large bordered input style with inline icons, remember-me and forgot-password row, strong orange primary CTA, and Google secondary action
- Mathlete navigation:
	- floating dark pill navbar direction with orange active-state emphasis and responsive mobile nav reveal

Repository surfaces updated for this integration:

- `app/page.tsx`
- `app/layout.tsx`
- `components/header-auth-nav.tsx`
- `components/theme-switcher.tsx`
- `components/auth-shell.tsx`
- `components/login-form.tsx`
- `components/sign-up-form.tsx`
- `components/forgot-password-form.tsx`
- `app/auth/login/page.tsx`
- `app/auth/sign-up/page.tsx`
- `app/auth/forgot-password/page.tsx`
- `app/mathlete/layout.tsx`

## Figma Mathlete Workspace Migration Trace (2026-04-18)

- Source design file: `https://www.figma.com/design/cBQPJi1UVMFzrHlfsNPbsx/Mathwiz?node-id=1-125&t=wi7iD40k8rPMSyLH-1`
- Mathlete dashboard source nodes:
	- nav shell: `164:2488`, `167:3350`
	- hero block: `161:829`
	- dashboard cards/calendar/activity: `161:573`
- Mathlete teams source nodes:
	- team index/list states: `167:3055`, `171:27`
	- create team modal states: `172:628`, `172:682`
	- join via code modal states: `173:726`, `173:794`
	- team detail states: `190:154`, `193:986`

Implemented pattern mapping for this migration:

- Mathlete shell:
	- floating dark pill navbar with amber active state, profile menu, and mobile reveal
	- soft neutral workspace background with dark-shell-first hierarchy
- Mathlete dashboard:
	- dark hero/search treatment
	- white live and upcoming competition cards
	- dark calendar rail and white recent-activity card
	- current data contract does not expose Figma-level live competition payload in this scope, so dashboard cards use presentation-safe preview content instead of mutating shared APIs
- Mathlete teams:
	- white card grid for team list with amber leader emphasis and dashed add-team card
	- centered create/join modal-panel treatment preserving existing POST/join logic
	- invite inbox restyled into Figma-direction acceptance cards
	- team detail reframed into dark hero banner, roster panel, amber code card, dark upcoming placeholder, and leader-side invite panels
	- current team detail endpoint does not expose competition-lock or next-event payload shown in Figma; UI keeps placeholder messaging instead of widening API scope outside owned files

Repository surfaces updated for this migration:

- `app/mathlete/layout.tsx`
- `app/mathlete/page.tsx`
- `app/mathlete/teams/page.tsx`
- `app/mathlete/teams/create/page.tsx`
- `app/mathlete/teams/invites/page.tsx`
- `app/mathlete/teams/join/page.tsx`
- `app/mathlete/teams/[teamId]/page.tsx`
- `components/mathlete/workspace-nav.tsx`
- `components/mathlete/page-frame.tsx`
- `components/mathlete/modal-panel.tsx`
- `components/mathlete/dashboard-overview.tsx`
- `components/teams/teams-page-shell.tsx`
- `components/teams/team-list.tsx`
- `components/teams/team-form.tsx`
- `components/teams/team-join-form.tsx`
- `components/teams/team-invites-list.tsx`
- `components/teams/team-invite-form.tsx`
- `components/teams/team-pending-invites.tsx`
- `components/teams/team-roster.tsx`

## Landing/Auth Visual Refinement Trace (2026-04-18)

- Source design file: `https://www.figma.com/design/cBQPJi1UVMFzrHlfsNPbsx/Mathwiz?node-id=1-125&t=wi7iD40k8rPMSyLH-1`
- Refined source nodes:
	- landing page: `45:2`
	- signin/signup shell: `62:5`
- Refinement goals:
	- replace oversized/generic landing spacing with Figma-matched rhythm and flatter section cards
	- reshape public root chrome into thinner dark pill navigation with orange CTA emphasis
	- rebuild auth shell/forms around Figma proportions, input framing, and CTA hierarchy while preserving current auth behavior

Implemented pattern mapping:

- Landing:
	- centered hero with narrower copy measure, white dashboard-preview card, and lighter section separation
	- three feature cards with Figma-like abstract preview blocks instead of generic dashboard widgets
	- methodology stack with orange/navy/ink panels and diagram-driven right-side visuals
	- dark pricing rail with rounded-top section break and highlighted middle tier
- Public chrome:
	- home route now uses a dedicated floating landing nav with Figma-style dual CTA treatment
	- auth and profile-complete shells suppress global chrome so the card shell owns the screen
- Auth:
	- two-panel shell tightened to the Figma 42/58 split with branded left story panel
	- login/sign-up toggle centered inside the form panel
	- email/password fields migrated to thin bordered frames with icon-leading layout and inline visibility toggle
	- organizer/apply helper copy preserved as compact support cards below the main form instead of separate generic blocks

Repository surfaces updated for this refinement:

- `components/landing/mathwiz-brand.tsx`
- `components/landing/landing-header-nav.tsx`
- `components/landing/landing-page.tsx`
- `components/auth/auth-form-primitives.tsx`
- `app/page.tsx`
- `components/layout/root-chrome.tsx`
- `components/auth-shell.tsx`
- `components/login-form.tsx`
- `components/sign-up-form.tsx`
- `app/auth/login/page.tsx`
- `app/auth/sign-up/page.tsx`

## Figma Organizer Workspace Migration Trace (2026-04-18)

- Source design file: `https://www.figma.com/design/cBQPJi1UVMFzrHlfsNPbsx/Mathwiz?node-id=1-125&t=wi7iD40k8rPMSyLH-1`
- Organizer dashboard reference node:
	- `141:41`
- Organizer competition reference nodes:
	- `83:2772`
	- `93:701`
- Organizer problem-bank reference nodes inspected for consistency only:
	- `102:7`
	- `106:1237`
	- `109:7`
	- `208:317`

Implemented pattern mapping for this migration:

- Organizer shell + navbar:
	- dark floating pill navbar with amber active-state emphasis
	- organizer profile/settings and sign-out collapsed behind organizer pill menu on desktop and mobile overlay on small screens
	- implemented in `app/organizer/layout.tsx` and `components/organizer/organizer-nav.tsx`
- Organizer dashboard:
	- centered welcome header with amber name accent
	- three KPI cards for active competitions, registered participants, and problem-bank volume
	- wide competition-management table with real registration counts and lifecycle states
	- right rail calendar + recent activity panel backed by `competition_events` when available
	- implemented in:
		- `app/organizer/page.tsx`
		- `components/dashboard/dashboard-header.tsx`
		- `components/dashboard/organizer-kpi-grid.tsx`
		- `components/dashboard/active-competitions-table.tsx`
		- `components/dashboard/calendar-widget.tsx`
		- `components/dashboard/recent-activity-panel.tsx`
- Organizer competition surfaces:
	- list page reframed to white/amber Figma-style workspace panel with stronger section hierarchy
	- create/edit routes wrapped in progress-header shells that visually align with wizard and review reference frames while preserving existing `CompetitionWizard` behavior
	- implemented in:
		- `app/organizer/competition/page.tsx`
		- `app/organizer/competition/create/page.tsx`
		- `app/organizer/competition/[competitionId]/page.tsx`

Behavioral boundaries preserved during this migration:

- no competition API contract changes
- no competition validation or mutation workflow changes
- dashboard registration/activity widgets degrade gracefully when `competition_registrations` or `competition_events` schema is unavailable

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
- strict single-session enforcement is a target contract owned by branch `05b-deferred-technical-debt`, backed by a server-trusted session-version model rather than client-only sign-out behavior
- admin self-modification protections are explicit in UI and backend logic
- competition snapshots prevent mutable problem bank edits from corrupting live or historical data
- anti-cheat and audit trails are append-oriented and tamper-resistant from normal user roles
- storage buckets and object-access rules for organizer assets, problem assets, and exports are documented as first-class backend contracts

## Security, Operations, and Release Baseline (2026-04)

- use ASVS-style control verification depth for release: baseline controls for all branches, elevated rigor for auth, access-control, and admin/operator control paths
- treat broken access control, session invalidation regressions, injection risk, and sensitive data leakage as merge-blocking defects
- require deterministic state-mutation behavior under retry and concurrency for every high-impact flow (auth/session, organizer lifecycle, registration, submission, live controls, dispute/recalc, exports)
- require explicit abuse controls for high-frequency endpoints and controls, including deterministic `429` responses where throttling applies
- require structured observability for privileged actions with `request_id`, actor, action, target, and machine-code outcomes, plus redaction of tokens and direct PII
- require incident-readiness artifacts before release: owner, severity model, communication path, containment steps, and replay-safe recovery procedures
- require WCAG 2.2 AA verification for core auth, organizer, admin, competition, and monitoring interactions
- require performance evidence on critical routes and control actions with explicit p95 targets and two-pass stability checks

## Coverage Summary

The execution plan below covers:

- UR1-UR3: auth, profile completion, organizer/admin credential access, single-session behavior, suspended-user handling
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

## Figma Mathlete Competition Discovery Trace (2026-04-22)

- Source design file: `https://www.figma.com/design/cBQPJi1UVMFzrHlfsNPbsx/Mathwiz?node-id=1-125&t=wi7iD40k8rPMSyLH-1`
- Mathlete competition discovery reference nodes:
	- `1:125`
	- `45:2`
	- `62:5`
	- `164:2488`
	- `167:3350`

Implemented pattern mapping for this migration:

- Competition discovery:
	- server-filtered list with search, type, format, and status filters
	- implemented in `app/mathlete/competition/page.tsx` and `components/competitions/*`
- Competition calendar:
	- localized schedule cards and calendar summary using client-side time formatting
	- implemented in `app/mathlete/competition/calendar/page.tsx` and `components/competitions/competition-calendar.tsx`
- Competition detail and registration:
	- detail page, registration panel, withdrawal controls, and mode arbitration placeholders for arena handoff
	- implemented in `app/mathlete/competition/[competitionId]/page.tsx` and `components/competitions/registration-panel.tsx`

Repository surfaces updated for this migration:

- `app/mathlete/competition/page.tsx`
- `app/mathlete/competition/calendar/page.tsx`
- `app/mathlete/competition/[competitionId]/page.tsx`
- `app/api/mathlete/competition/*`
- `components/competitions/*`
- `components/mathlete/workspace-nav.tsx`
- `lib/competition/discovery.ts`
- `lib/registrations/*`
- `lib/notifications/dispatch.ts`
- `supabase/migrations/20260422120000_10_competition_registrations.sql`

Behavioral boundaries preserved during this migration:

- competition discovery remains server-filtered and URL-driven
- registration and withdrawal remain routed through trusted server RPCs
- calendar display localizes on the client while storage stays UTC
- Next.js loading and streaming: https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
- Supabase Next.js SSR auth guide: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase API security and RLS: https://supabase.com/docs/guides/api/securing-your-api
- Supabase Realtime Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes
- shadcn/ui data table docs: https://ui.shadcn.com/docs/components/data-table
- TanStack Table pagination: https://tanstack.com/table/latest/docs/guide/pagination
- TanStack Table virtualization: https://tanstack.com/table/latest/docs/guide/virtualization
- MathLive React guide: https://mathlive.io/mathfield/guides/react/
