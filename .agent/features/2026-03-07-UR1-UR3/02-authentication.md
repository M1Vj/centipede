# 02 - Authentication

- Feature branch: `feature/authentication`
- Requirement mapping: UR1, partial UR3 — user authentication, role-aware redirects, profile completion, and suspended-user gating (strict single-session enforcement is delivered in `05b-deferred-foundation-and-auth`)
- Priority: 2
- **Assigned to:** Mabansag, Vj

## Mission

Implement trusted authentication and role-aware access control for mathletes, organizers, and admins. This branch must cover mathlete Google OAuth, organizer/admin credential login, callback hardening, profile completion, suspended-user gating, server-trusted redirects, and safe sign-out behavior. Strict single-session invalidation is explicitly deferred to `05b-deferred-foundation-and-auth`.

This branch exists because auth stability depends on callback hardening, redirect policy extraction, server-side profile persistence, and strict route handling. Those are part of the feature, not post-feature cleanup.

Depends on: `01-foundation`.

Unblocks: all role-based workspaces and protected feature branches.

## Full Context

- Business context: every role-specific feature is invalid until identity and role routing are trustworthy.
- User roles: anonymous visitors, incomplete mathlete profiles, approved organizers, admins, suspended users.
- UI flow: mathlete Google sign-up and sign-in, organizer/admin credential sign-in, email confirmation, password reset, profile completion, sign out, suspended notice.
- Backend flow: `auth.users` trigger -> `profiles`, callback code exchange, server-side `getUser()` checks, trusted profile upserts, and redirect policy.
- Related tables/functions: `profiles`, `organizer_applications`, `insert_profile_for_new_user()`, `handle_profile_changes()`.
- Edge cases: stale local sessions, OAuth callback mismatch, incomplete profile loops, suspended users, missing profile rows, password reset from expired links.
- Security concerns: never trust `getSession()` alone on the server, never expose service role to the client, prevent self role escalation and profile spoofing.
- Performance concerns: avoid auth flicker, do not fetch profile data redundantly on every client render, keep redirect logic pure and testable.
- Accessibility and mobile: auth forms, validation, and alerts must be keyboard-safe and legible on small screens.

## Research Findings / Implementation Direction

- Follow Supabase's current Next.js SSR guide with cookie-aware clients and authoritative `getUser()` checks on trusted boundaries.
- Treat redirect rules as pure logic with unit tests, then wire them into server components/layouts and shared auth utilities (avoid DB lookups in Next.js Edge Middleware).
- Keep sign-up and profile-save mutations on trusted server actions or trusted handlers when RLS or callback timing can cause client hangs, but note that Supabase OAuth sign-in must be initiated from Client Components or standard Route Handlers to handle external redirects properly.
- Model suspended-user handling as a first-class auth state with a dedicated route and redirect branch.

## Requirements

- support Google OAuth for mathlete registration and sign-in plus email/password credential flows for approved organizers and admins
- exchange callback codes safely and redirect users into the correct workspace
- require profile completion before protected usage
- route authenticated users to the correct workspace by role
- block suspended users from protected pages and surface a clear notice page
- ensure sign-out works reliably and does not leave broken local state
- add test coverage for profile completeness logic, redirect logic, and callback behavior

## Atomic Steps

1. Build pure helper functions for profile completeness and route redirection.
2. Add unit tests for auth routing, incomplete-profile behavior, and role-based landing decisions.
3. Implement or refine browser and server auth clients.
4. Build or rewrite login and sign-up forms with shared feedback primitives in mind.
5. Implement Google OAuth with a stable redirect target and callback exchange route.
6. Add organizer/admin credential-login, forgot-password, update-password, sign-up success, and email-confirmed flows where applicable.
7. Add profile completion UI backed by a trusted mutation path.
8. Update middleware/proxy to enforce auth, completion, and suspension rules.
9. Add role-aware home-page redirect behavior so authenticated users land in the correct workspace.
10. Add suspended-user notice page and protect sign-in from stale loop conditions.
11. Verify auth flows manually with multiple accounts and all major routes.
12. Update the DB and learned-rules docs if the auth contract or profile policy changes during implementation.

## Key Files

- `app/auth/login/page.tsx`
- `app/auth/sign-up/page.tsx`
- `app/auth/confirm/route.ts`
- `app/auth/email-confirmed/page.tsx`
- `app/auth/forgot-password/page.tsx`
- `app/auth/update-password/page.tsx`
- `app/auth/sign-out/route.ts`
- `app/auth/suspended/page.tsx`
- `app/profile/complete/page.tsx`
- `components/login-form.tsx`
- `components/sign-up-form.tsx`
- `components/profile-completion-form.tsx`
- `components/providers/auth-provider.tsx`
- `lib/auth/profile.ts`
- `lib/auth/routing.ts`
- `lib/auth/profile-write.ts`
- `lib/supabase/proxy.ts`
- `tests/auth/*`

## Verification

- Manual QA: mathlete OAuth sign-up, organizer/admin credential login, password reset, incomplete profile redirect, suspended-user redirect, and sign-out.
- Automated: `npm run lint`, `npm run test` with auth helpers and callback tests.
- Accessibility: labels, error messaging, status regions, and keyboard order across all auth routes.
- Performance: no auth-state flicker between server render and client hydration on protected pages.
- Edge cases: stale callback params, missing profile row, duplicate profile writes, and repeated sign-in attempts.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `test(auth): add redirect and profile helper coverage`
  - `feat(auth): implement login and signup flows`
  - `feat(auth): add callback, password, and signout routes`
  - `feat(auth): enforce profile completion and suspension handling`
- PR title template: `UR1-UR3: authentication, profile completion, and role redirects`
- PR description template:
  - Summary: auth flows, redirect rules, callback handling, profile completion, suspension gate
  - Testing: lint, auth unit tests, manual multi-account checks
  - Docs: DB auth rules and learned rules updated if needed

## Definition of Done

- every user can authenticate through the intended flows
- protected routes are enforced on trusted server-aware boundaries
- incomplete profiles cannot bypass completion
- suspended users are blocked cleanly
- auth behavior is covered by automated tests and manual verification
