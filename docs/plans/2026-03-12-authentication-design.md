# Authentication Design

**Date:** 2026-03-12
**Branch:** `feature/authentication`
**Source Spec:** `.agents/features/2026-03-07-UR1-UR3/02-authentication.md`

## Research Notes

- Supabase's current Next.js server-side auth guide uses `@supabase/ssr`, not the deprecated `@supabase/auth-helpers-nextjs`, so this branch should extend the existing SSR setup instead of reintroducing helpers.
- Supabase recommends middleware/proxy-based session refresh plus `auth.getUser()` for protected checks because cookies can be spoofed and `getSession()` is not authoritative on the server.
- Google OAuth and email/password both fit the current browser client. OAuth should use `signInWithOAuth({ provider: "google", options: { redirectTo } })`.
- Cross-device single-session enforcement is primarily a Supabase Auth project setting, not something client-side `signOut()` alone can guarantee. Client sign-out before email login is still useful to clear stale local state.
- Profile synchronization is already partially handled by the existing `profiles` trigger in the initial foundation migration, so this branch should consume that table instead of duplicating account creation logic.

## Chosen Approach

1. Keep the existing server/browser Supabase utilities and add a browser singleton at `lib/supabaseClient.ts` for client components and context consumers.
2. Add a client `AuthProvider` that listens to `onAuthStateChange`, exposes user/profile/session state, and fetches the `profiles` row for completion checks and header rendering.
3. Replace the starter auth forms with Mathwiz-specific sign-up and login flows, including Google OAuth, error alerts, and redirects to profile completion.
4. Extend proxy-based route protection so authenticated users with incomplete profiles are redirected to `/profile/complete`, while protected areas still require auth.
5. Extract pure auth-routing/profile-completeness helpers so the redirect rules can be verified with automated tests before wiring them into the app.

## Design Summary

- **Architecture:** SSR remains the source of truth for request-time protection. The client auth context is only for UI state and auth actions.
- **Profile completeness rule:** A profile is complete when `full_name`, `school`, and `grade_level` are all non-empty after trimming.
- **Public routes:** Home and auth routes stay publicly reachable; authenticated users with incomplete profiles are redirected to `/profile/complete` away from other routes.
- **Navigation:** Anonymous users see `Login` and `Register`. Authenticated users see their profile label and a sign-out action.
- **Verification:** Add focused unit tests for auth routing helpers, then run lint, build/test commands, and a local `npm run dev` browser check.
