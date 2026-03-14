# Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Mathwiz Arena authentication with Google OAuth, email/password sign-in, profile completion enforcement, and protected routing on top of the existing Supabase SSR foundation.

**Architecture:** Keep SSR request protection in the existing proxy/server Supabase layer, then add a thin client auth provider for UI state and auth actions. Extract routing/profile helper logic into pure functions so redirect rules can be test-driven before being wired into components and middleware.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase SSR, Supabase Auth, Tailwind CSS, Shadcn UI, Vitest

---

### Task 1: Add test seams for auth rules

**Files:**
- Create: `lib/auth/profile.ts`
- Create: `lib/auth/routing.ts`
- Create: `tests/auth/profile.test.ts`
- Create: `tests/auth/routing.test.ts`
- Modify: `package.json`

**Step 1: Write the failing tests**

- Cover profile completeness for blank and valid values.
- Cover route decisions for anonymous users, incomplete profiles, and completed profiles.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand`

Expected: failing tests because the helper modules do not exist yet.

**Step 3: Write minimal implementation**

- Implement `isProfileComplete`.
- Implement redirect helpers for auth/public/profile routes.
- Add the test runner configuration needed to execute the tests.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand`

Expected: helper tests pass.

**Step 5: Commit**

```bash
git add package.json package-lock.json lib/auth tests
git commit -m "test(auth): add auth routing and profile helpers"
```

### Task 2: Build the auth foundation

**Files:**
- Create: `lib/supabaseClient.ts`
- Create: `components/providers/auth-provider.tsx`
- Create: `components/header-auth-nav.tsx`
- Modify: `app/layout.tsx`

**Step 1: Write the failing test/check**

- Use the existing helper tests as the regression baseline and verify the app still lints after wiring in the provider.

**Step 2: Run verification before implementation**

Run: `npm run lint`

Expected: current branch is clean before the provider changes.

**Step 3: Write minimal implementation**

- Add a browser singleton Supabase client for client components.
- Add an auth provider with session/user/profile loading and sign-out support.
- Replace the static header auth actions with provider-driven navigation.

**Step 4: Run verification to verify it passes**

Run: `npm run lint`

Expected: lint passes with the new provider and header.

**Step 5: Commit**

```bash
git add app/layout.tsx components/header-auth-nav.tsx components/providers/auth-provider.tsx lib/supabaseClient.ts
git commit -m "feat(auth): add Supabase client and auth context"
```

### Task 3: Implement sign-up and login flows

**Files:**
- Modify: `components/login-form.tsx`
- Modify: `components/sign-up-form.tsx`
- Modify: `app/auth/login/page.tsx`
- Modify: `app/auth/sign-up/page.tsx`
- Create: `components/ui/alert.tsx`

**Step 1: Write the failing test/check**

- Use lint plus manual flow expectations as the red state because these forms are UI-driven and depend on Supabase/browser APIs.

**Step 2: Run verification before implementation**

Run: `npm run lint`

Expected: baseline passes before form changes.

**Step 3: Write minimal implementation**

- Add Google OAuth buttons and email/password flows.
- Sign out local session before email login.
- Show auth failures in a Shadcn-style alert.
- Redirect new sign-ups and newly authenticated incomplete users to `/profile/complete`.

**Step 4: Run verification to verify it passes**

Run: `npm run lint`

Expected: lint passes after the form rewrite.

**Step 5: Commit**

```bash
git add app/auth/login/page.tsx app/auth/sign-up/page.tsx components/login-form.tsx components/sign-up-form.tsx components/ui/alert.tsx
git commit -m "feat(auth): implement sign-up and login pages"
```

### Task 4: Enforce profile completion and protected redirects

**Files:**
- Create: `app/profile/complete/page.tsx`
- Modify: `proxy.ts`
- Modify: `lib/supabase/proxy.ts`
- Modify: `app/protected/page.tsx`
- Modify: `.agents/features/2026-03-07-UR1-UR3/02-authentication.md`

**Step 1: Write the failing test/check**

- Extend helper tests if redirect rules change.
- Run the targeted helper tests to confirm the new route expectations fail before wiring them into the proxy.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand`

Expected: helper assertions fail until the redirect rules and profile checks are implemented.

**Step 3: Write minimal implementation**

- Build the profile completion form.
- Use the routing helpers inside the proxy to guard protected pages and redirect incomplete profiles.
- Update the protected placeholder so it reflects the real auth branch behavior.
- Document the updated implementation guidance in `.agents` where the legacy helper package/single-session note changed.

**Step 4: Run verification to verify it passes**

Run: `npm test -- --runInBand && npm run lint`

Expected: tests and lint both pass.

**Step 5: Commit**

```bash
git add app/profile/complete/page.tsx proxy.ts lib/supabase/proxy.ts app/protected/page.tsx .agents/features/2026-03-07-UR1-UR3/02-authentication.md
git commit -m "feat(auth): enforce profile completion and route guards"
```

### Task 5: Full verification

**Files:**
- Review only

**Step 1: Run automated verification**

Run: `npm test -- --runInBand && npm run lint`

Expected: exit code 0.

**Step 2: Run app for UI verification**

Run: `npm run dev`

Expected: local app starts and the login, sign-up, header, and profile completion flows render without runtime errors.

**Step 3: Manual checks**

- Visit `/`, `/auth/login`, `/auth/sign-up`, `/protected`, and `/profile/complete`.
- Confirm anonymous vs authenticated navigation states.
- Confirm incomplete profiles redirect to `/profile/complete`.

**Step 4: Commit docs if needed**

```bash
git add docs/plans
git commit -m "docs: add authentication design and implementation plan"
```
