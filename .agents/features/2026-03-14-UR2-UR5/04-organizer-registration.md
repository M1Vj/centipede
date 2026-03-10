# 04 – Organizer Registration & Eligibility

## Mission

Allow prospective organizers to apply for eligibility on the platform.
Collect their details via a structured form, persist the application
data, and surface it in the admin queue for review.  Upon approval
their role becomes `organizer` and they gain access to organizer
dashboards.

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/organizer-registration`
* **Requirements:** 02‑authentication (users must be able to log in)
* **Assigned to:** Mabansag, Vj

## Requirements

* `organizer_applications` table is defined (see database schema).
* Admin dashboard is ready to review applications (03‑admin-user-management).

## Atomic Steps
0. **Research form libraries and file uploads.**  Begin by
   researching modern form libraries (e.g. `react-hook-form`,
   `Formik`) and file upload components that provide a smooth user
   experience on both desktop and mobile.  Look for open‑source
   examples of multi‑step forms with validation and image uploads.
   Use this research to design a registration form that is intuitive,
   accessible and performant.

1. **Landing page call‑to‑action.**  On the home page, add a section
   inviting educators to become organizers.  Include a button that
   navigates to `/organizer/apply`.
2. **Application page.**  Create `app/organizer/apply/page.tsx` with a
   form collecting:
   * Personal/organization name.
   * Contact email and phone number.
   * Organization type and optional logo upload.
   * Statement of legitimacy and agreement to data privacy & terms.
   Validate fields client‑side and server‑side.
   On submit, insert into `organizer_applications` with
   `status='pending'` and timestamps.
3. **Application status view.**  Logged‑in applicants should see the
   status of their application (Pending, Approved, Rejected) on their
   dashboard.  Create a page `app/organizer/status/page.tsx` that
   queries `organizer_applications` for the current user.  Display
   review notes or rejection reasons if provided.
4. **Email notifications.**  Trigger a confirmation email to the
   applicant upon submission using Supabase Edge Function.  Admin
   approval should trigger an email with login instructions; rejection
   should trigger an email with the reason and next steps.
5. **Profile upgrade.**  Once an admin approves the application, a
   trigger or RPC should update the applicant’s `profiles.role` to
   `organizer` and set `approved_at = now()`.  Redirect newly
   approved users to the organizer dashboard on their next login.
6. **Testing.**  Submit applications as different test users and
   ensure that data is stored, admins see them in the queue and
   approval/rejection updates the user’s role.

## Key Files

* `pages/organizer/apply/page.tsx`
* `pages/organizer/status/page.tsx`
* `lib/supabase/organizers.ts` (RPC wrappers for submitting and
  checking applications)
* `supabase/functions/sendApplicationEmail.ts` (optional edge function)

## Verification

1. A user can apply to become an organizer and see their status.
2. Admins can approve/reject applications via the admin queue.
3. Approved applicants gain organizer privileges on next login and see
   their organizer dashboard.  Rejected applicants remain mathletes.
4. Email notifications are sent on submission, approval and rejection.

## Git Branching

Recommended commit titles:

- `feat: add organizer application form and submission logic`
- `feat: implement application status page for applicants`
- `feat: integrate email notifications for organizer applications`
- `chore: upgrade applicant role on approval via trigger/RPC`
- `test: organizer registration and approval flow tests`

## Definition of Done

* Prospective organizers can apply through a form and track their
  status.
* Admins can approve or reject applications and trigger role
  upgrades.
* Email notifications keep applicants informed of progress.
* Checklist item `04-organizer-registration` can be checked after
  merge.
