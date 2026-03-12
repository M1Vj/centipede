
# Centipede

## Project Description

Centipede is a secure, web-based mathematics online competition platform for Mathletes and Coaches. It is built using Next.js for the web application and Supabase (PostgreSQL) for the backend/database. The system supports competitions, problem banks, team mode, open mode, automated scoring, and integrity monitoring (e.g., tab switching logs).

## Internal Releases

| Release Code | Date Released |
| ------------ | ------------- |
| CP.010.001   | 2026-02-28    |

---

## CP.010.001 Release Notes (reverse chronological order)

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

Optional fallback for older Supabase projects:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### What Is Included

- Supabase CLI config in `supabase/config.toml`
- Initial migration for auth-linked profiles and organizer applications
- Seed file placeholder for local development
- npm scripts for common Supabase CLI workflows
