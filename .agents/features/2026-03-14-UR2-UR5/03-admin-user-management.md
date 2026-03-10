# 03 – Admin User Management

## Mission

Provide administrators with tools to manage all platform users.  This
includes reviewing and approving organizer applications, updating user
details, suspending or deleting accounts, and accessing organizer
resources in read‑only mode.

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/admin-user-management`
* **Requirements:** 02‑authentication
* **Assigned to:** Celeres, Anthony

## Requirements

* A dedicated admin role exists in the `profiles` table.
* Supabase RLS policies allow admins to read and update all tables.
* Organizer applications table (`organizer_applications`) exists.

## Atomic Steps
0. **Research admin dashboards.**  Start by exploring open‑source
   React admin dashboards and libraries (e.g. `react-admin`, `Tabler
   Dashboard`) to understand common patterns for user management,
   moderation queues and audit logs.  Evaluate whether any
   components or layouts can be reused to speed up development while
   maintaining accessibility and responsiveness.  Choose the best
   approach and integrate it with our design system.

1. **Admin layout and navigation.**  Under `app/admin/`, create a
   layout that includes a sidebar with links: `Dashboard`, `Users`,
   `Applications`, `Problem Banks`, `Competitions`, `Logs`, `Settings`.
   Use Shadcn’s `<NavigationMenu>` to style the sidebar.
2. **Applications queue.**  Create `app/admin/applications/page.tsx` that
   fetches rows from `organizer_applications` where `status = 'pending'`.
   Display applicant name, organization and submission date.  Provide
   `Approve` and `Reject` buttons that call Supabase RPCs (or direct
   updates) to set `status` accordingly.  On approval, insert a row
   into `profiles` with role `organizer` and send an email via
   Supabase Edge Function.  On rejection, record a `rejection_reason` and
   notify the applicant.
3. **User list and moderation.**  Create `app/admin/users/page.tsx` to
   display all users (mathletes, organizers, admins) with filters by
   role and status.  Include actions to suspend/reactivate or delete
   accounts.  Suspending sets `is_active = false` on the user; deletion
   sets `is_active = false` and anonymises personal data.  Provide a
   detail modal to view and edit user information (name, email, role).
4. **Organizer resource access.**  Add pages under `app/admin/` to view
   problem banks and competitions created by organizers.  These pages
   should be read‑only to admins but allow them to delete inappropriate
   content or force‑pause competitions if required.
5. **Logs & system audit.**  Create an admin logs page to view recent
   system actions (e.g. account approvals, suspensions, competition
   publishes).  This can read from an `audit_logs` view or table.  Ensure
   sensitive actions are logged with actor, action and timestamp.
6. **Testing & Validation.**  Log in as admin and verify that you can
   review applications, approve/reject organizers, manage users, view
   resources and logs.  Test that RLS policies prevent non‑admin
   accounts from accessing these pages.

## Key Files

* `pages/admin/applications/page.tsx`
* `pages/admin/users/page.tsx`
* `pages/admin/problem-banks/[id].tsx` (read‑only view)
* `pages/admin/competitions/[id].tsx` (read‑only view)
* `pages/admin/logs/page.tsx`
* `lib/supabase/admin.ts` (RPC wrappers for approvals and moderation)

## Verification

1. Submit an organizer application and log in as admin.  Approve and
   reject applications and verify that profiles are updated and
   notifications are sent.
2. Suspend a user and confirm they can no longer log in.  Reactivate
   and verify access is restored.  Delete a user and ensure their
   data is anonymised.
3. View organizer resources and confirm that admins cannot edit them
   directly (read‑only).  Delete an inappropriate problem bank or
   competition and verify it is removed.
4. Check audit logs for each action taken and confirm entries exist.

## Git Branching

Recommended commit titles:

- `feat: implement admin dashboard layout and navigation`
- `feat: add organizer applications queue with approval/rejection`
- `feat: build user management page with suspension and deletion`
- `feat: add read‑only views for organizer resources`
- `feat: implement admin logs page`
- `test: admin user management end‑to‑end tests`

## Definition of Done

* Admins can approve/reject organizers, manage user accounts and view
  organizer resources and system logs.
* RLS policies prevent non‑admin users from accessing admin pages.
* Audit logs capture all critical admin actions.
* Checklist item `03-admin-user-management` can be checked after
  merge.
