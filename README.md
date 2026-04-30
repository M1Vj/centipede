
# Centipede

## Project Description

Centipede is a secure, web-based mathematics online competition platform for Mathletes and Coaches. It is built using Next.js for the web application and Supabase (PostgreSQL) for the backend/database. The system supports competitions, problem banks, team mode, open mode, automated scoring, and integrity monitoring (e.g., tab switching logs).

## Internal Releases

| Release Code | Date Released |
| ------------ | ------------- |
| CP.010.008   | 2026-04-25    |
| CP.010.007   | 2026-04-16    |
| CP.010.006   | 2026-04-11    |
| CP.010.005   | 2026-04-08    |
| CP.010.004   | 2026-04-05    |
| CP.010.003   | 2026-03-28    |
| CP.010.002   | 2026-03-14    |
| CP.010.001   | 2026-02-28    |

---

## CP.010.008 Release Notes

- Rolled out the Figma UI refresh across core platform surfaces, including Auth, Admin, Organizer, Mathlete, Teams, and shared interaction primitives.
- Delivered competition discovery improvements with searchable listings, event notices, calendar support, and validated registration/withdrawal flows.
- Rebuilt organizer workspace domains for dashboard and competition operations, including lifecycle mutation hardening and draft deletion reliability improvements.
- Added arena trusted-entry and attempt lifecycle helpers, then applied follow-up fixes for competition state mutations and registration-path edge cases.

Known Issues:

- Registration timing edge cases still exist, especially when using "Open until competition start" schedules.
- Some competition lifecycle transitions can still surface generic failure messaging or delayed state reflection in UI.
- Organizer registration counts and mathlete registration views may intermittently desync after successful actions.
- Team registration and open-competition gating still have unresolved edge-case behavior in specific flows.

---

## CP.010.007 Release Notes

- Designed and integrated the complete Competition Wizard lifecycle, supporting scheduled/open variations, fallback mechanisms, snapshot management, and draft publication flows.
- Implemented robust Team Management systems, including secure invitations, roster management, leadership transfers, and real-time validation via idempotency ledgers.
- Solidified team-based schemas, competition lifecycle definitions, and unified navigation components across mathlete arenas and organizer workspaces.
- Refined validation helpers, testing structures, and domain contracts related to teams, open competitions, and strict data consistency guarantees.

Known Issues:

- None at this time.

---

## CP.010.006 Release Notes

- Designed and integrated the Scoring System foundation spanning database schema setup, signature migrations, and scoring domain contracts.
- Launched the Organizer Scoring UI complete with dynamic workspace rendering, scoring controls, computation summary sheets, and responsive/a11y design patterns.
- Engineered offense tracking modules with automated point-penalty calculations embedded directly inside the scoring previews.
- Solidified scoring security by expanding regression tests and generating rigorous security-fuzzing suites mapped to backend scoring policies.

Known Issues:

- None at this time.

---

## CP.010.005 Release Notes

- Aligned Problem Bank database schema and enforced row-level security (RLS) contracts.
- Built reusable problem authoring UI with dynamic MathLive equation preview loops and template boundaries.
- Integrated bulk CSV import workflows supported by underlying data normalization and deduplication handlers.
- Hardened overall database constraints, client-side draft auto-save pipelines, image normalization routines, and optimistic concurrency patterns.

Known Issues:

- None at this time.

---

## CP.010.004 Release Notes

- Implemented the full organizer eligibility lifecycle including public application entry, legal consent, logo file uploads, and secure status tracking.
- Added encrypted status lookup with strict rate limiting, safeguarding applicant tracking queries.
- Integrated automated communication processes, delivering submission, approval, and rejection messaging effectively.
- Built the organizer-first-run dashboard along with comprehensive profile and settings pages for smooth onboarding.
- Hardened deferred authentication handling, refined form validation, and optimized DB migration idempotency.

Known Issues:

- None at this time.

---

## CP.010.003 Release Notes

- Implemented the Admin dashboard layout, main navigation shell, and resource management views including applications, user moderation, and audit logs.
- Hardened authentication routing, implemented unified role-aware redirection, enhanced session middleware, and resolved comprehensive auth-related bugs.
- Enhanced UI/UX with mobile navigation, interactive competition actions, read-only resource views, and server-side auth hydration to prevent flicker.
- Enforced platform security by blocking suspended users, recording admin actions, and strengthening profile editing boundaries.
- Broadened test suites focusing on authentication and navigation flows, while resolving linting issues and expanding project documentation.

Known Issues:

- None at this time.

---

## CP.010.002 Release Notes

- Added the foundation UI layer with the landing page, protected layout, and standardized authentication page shells.
- Added local Supabase project scaffolding, environment normalization, config alignment, starter migration, seed placeholder, and setup commands for local development.
- Implemented Supabase client wiring and authentication flows for sign-up, login, email confirmation, password recovery, and password updates.
- Enforced protected-route access and profile-completion requirements for authenticated users.
- Added shared interaction feedback primitives, including reusable buttons, dialogs, skeletons, spinners, and a global route loading indicator.
- Stabilized authentication completion flows by exchanging OAuth callback codes for sessions, allowing profile self-insert/upsert, and tightening related test coverage.

Known Issues:

- None at this time.

---

## CP.010.001 Release Notes

- Initialized Next.js project using the Vercel Next.js + Supabase starter template.
- Includes Supabase Auth, middleware, and server/client utility helpers out of the box.
- Set up with TypeScript, Tailwind CSS, App Router, and ESLint.
- Established gitflow branching model with `develop` and `main` branches.
- Created initial project scaffold and documentation.

Known Issues:

- None at this time.

---

## Important Links

- GitHub Repo: https://github.com/M1Vj/centipede
- Design Specs: https://github.com/anthony-celeres/centipede-docportal
- Adviser: Mr. Rodney M. Maniego Jr.
- Team Members:
  - Jaaseia Gian R. Abenoja
  - Anthony L. Celeres
  - Vj Formaran Mabansag
- Tech Stack:
  - Frontend: Next.js
  - Backend/DB: Supabase (PostgreSQL)

## Local Supabase Setup

The repository now includes a local Supabase scaffold under `supabase/` and a
local `.env.local` template.

1. Open `.env.local` and replace the placeholders with your real project values
   from Supabase.
2. If you want a local Supabase stack instead of a hosted project, start Docker
   and run `npm run supabase:start`.
3. Apply the local schema from the migrations with `npm run supabase:db:reset`.
4. When the local stack is running, inspect local keys with `npm run supabase:status`.
5. Generate TypeScript database types with `npm run supabase:types`.

### Minimum Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional fallback for older Supabase projects:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Scheduled competition starts also require:

- `CRON_SECRET`

The app-level cron route at `/api/cron/competitions/start-due` runs every minute in `vercel.json`, requires `Authorization: Bearer $CRON_SECRET`, and uses the Supabase service role key to move due scheduled competitions from `published` to `live`.

### What Is Included

- Supabase CLI config in `supabase/config.toml`
- Initial migration for auth-linked profiles and organizer applications
- Seed file placeholder for local development
- npm scripts for common Supabase CLI workflows
