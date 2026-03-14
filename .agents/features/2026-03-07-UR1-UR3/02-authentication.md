# 02 – Authentication

## Mission

Implement secure user registration and login flows using Supabase Auth.
Support both Google OAuth and email/password sign‑up.  Enforce
single‑session logins and require new users to complete their profile
before accessing the platform.

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/authentication`
* **Requirements:** 01‑foundation
* **Assigned to:** Mabansag, Vj

## Requirements

* `lib/supabaseClient.ts` must initialise the browser Supabase client
  with your environment variables, while the existing SSR helpers keep
  request-time auth in sync on the server.
* The `profiles` table and RLS rules exist (see database design).  A
  trigger or function should insert a row into `profiles` when a new
  Supabase user registers.

## Atomic Steps
0. **Research authentication patterns.**  Before implementing
   authentication, search for recent guides and open‑source examples
   that demonstrate secure Google OAuth and email/password flows in
   Next.js 14 with Supabase.  Pay special attention to single‑session
   enforcement, token refresh handling and profile synchronisation.
   Evaluate whether community packages (e.g. `next-auth`, Supabase
   helpers) provide benefits over using the raw SDK.  Use this
   research to design a robust authentication layer.

1. **Create the Supabase client helper.**  In `/lib`, add
   `supabaseClient.ts` using the current `@supabase/ssr` browser client
   instead of the deprecated auth helpers package.  This helper can be
   imported across client components and forms.
2. **Auth context/provider.**  Create a context (e.g. `AuthProvider`) that
   wraps the app and exposes the `user` object and login/logout
   functions using Supabase’s `onAuthStateChange`.  This allows you to
   protect routes.
3. **Build the sign‑up page.**  Under `app/(auth)/signup/page.tsx`:
   * Provide buttons to sign up with Google:
     ```ts
     const handleGoogle = async () => {
       await supabase.auth.signInWithOAuth({ provider: 'google' })
     }
     ```
   * Provide a form for email and password.  On submit call
     `supabase.auth.signUp({ email, password })` and handle errors.
   * After sign‑up, redirect to `/profile/complete`.
4. **Build the login page.**  Under `app/(auth)/login/page.tsx`:
   * Provide Google and email/password login.
   * Before logging in with email/password, call
     `supabase.auth.signOut({ scope: 'local' })` to terminate any
     existing local session before calling
     `supabase.auth.signInWithPassword({ email, password })`.
   * Catch errors and display them using Shadcn’s `<Alert />`.
5. **Profile completion page.**  Create
   `app/(profile)/complete/page.tsx`.  Only authenticated users with
   incomplete profiles should access this page.  Use a form to collect
   `full_name`, `school` and `grade_level`.  On submit call
   `supabase.from('profiles').update({ full_name, school, grade_level }).eq('id', user.id)`.
   After updating, redirect to the home page.
6. **Protect routes.**  Create a higher‑order component or use
   middleware in `middleware.ts` to check `supabase.auth.getSession()`.
   Redirect unauthenticated requests to `/login` and users with
   incomplete profiles to `/profile/complete`.
7. **Navigation links.**  Update the header to show `Login` and
   `Register` when no user is logged in, and the user’s name and a
   `Sign Out` button when authenticated.  Use
   `supabase.auth.signOut()` for signing out.
8. **Testing.**  Run `npm run dev` and manually register and log in
   using both Google and email/password.  Verify that the `profiles`
   table is populated and that the Supabase project has single-session
   auth enforcement enabled so logging in from a second device logs out
   the first session.
9. **Commit & push.**  Once the flows work, commit your changes and
   open a PR into `develop`.

## Key Files

* `lib/supabaseClient.ts` – Supabase client factory.
* `app/(auth)/signup/page.tsx` – Sign‑up UI and logic.
* `app/(auth)/login/page.tsx` – Login UI and logic.
* `app/(profile)/complete/page.tsx` – Profile completion form.
* `AuthProvider` or equivalent context component.
* `middleware.ts` – optional route protection.

## Verification

* New users can register using Google or email/password.
* After registration, a row appears in the `profiles` table with the
  correct `id` and `role` set to `mathlete` by default.
* Logging in from a second browser ends the first session.
* Users cannot access any page (except `/login` and `/signup`) until
  they fill out their profile.

## Git Branching

Recommended commit titles:

1. **feat: add Supabase client and auth context**
2. **feat: implement sign‑up and login pages with Google and email**
3. **feat: enforce profile completion and single‑session login**

## Definition of Done

* Authentication works for both Google OAuth and email/password.
* Users are inserted into `profiles` and forced to complete their
  profile.
* Navigation reflects authenticated state and sign‑out works.
* The branch merges into `develop` without breaking existing pages.
