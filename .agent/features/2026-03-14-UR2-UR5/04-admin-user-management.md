# 04 - Admin User Management

- Feature branch: `feature/admin-user-management`
- Requirement mapping: UR4, UR5 — admin approvals, user moderation, audit logging, and read-only operational oversight
- Priority: 4
- **Assigned to:** Celeres, Anthony

## Mission

Create the full admin workspace for approving organizers, managing users, reviewing resources, recording audit trails, and enforcing moderation actions safely. This branch also defines the operational admin shell that later monitoring and system-settings work extend.

This branch exists because admin work is not just a list page. It needs service-role-safe helpers, self-protection rules, audit logging, read-only resource views, and mobile-safe navigation.

Depends on: `02-authentication`, `03-interaction-feedback`.

Unblocks: organizer approval, moderation, admin-backed default bank management, and operational oversight.

## Full Context

- Business context: the platform cannot safely open organizer access or live competitions without an admin control plane.
- User roles: admins as first-class operators; organizers and mathletes as moderation targets or reviewed entities.
- UI flow: admin dashboard, applications queue, users page, logs page, problem-bank/competition read-only views, settings shell.
- Backend flow: trusted admin server utilities, audit log writes, organizer approval RPCs, organizer credential provisioning or invite delivery, suspension toggles, moderated delete/pause actions.
- Related tables/functions: `profiles`, `organizer_applications`, `problem_banks`, `problems`, `competitions`, `competition_events`, `admin_audit_logs`, `system_settings`.
- Edge cases: admin attempting to suspend themself, approving already-reviewed application, deleting active competitions, missing service-role key, read-only access to organizer-owned resources.
- Security concerns: admin actions must be server-trusted, auditable, and resistant to client-side spoofing.
- Performance concerns: user and application tables need server-side filtering and pagination-ready design.
- Accessibility/mobile: data tables need keyboard navigation and mobile fallbacks; destructive actions need confirmation and explicit copy.

## Research Findings / Implementation Direction

- Keep admin mutations in server-only helpers backed by the service-role client or tightly-scoped security-definer RPCs.
- Model audit logging as a mandatory write path for approvals, suspensions, deletes, pauses, and settings updates.
- Read-only admin resource views must share the underlying page language with organizer features but respect ownership rules.
- Build admin pages using server data loading with table controls reflected in the URL so filters remain shareable and testable.

## Requirements

- add admin dashboard layout and navigation
- implement organizer applications review with approve and reject actions
- provision organizer credentials or invite delivery on approval and rejection messaging on denial
- implement user moderation with search, filters, suspension/reactivation, and safe update flows
- add read-only admin views for competitions and problem banks plus moderated delete or pause actions
- log all critical admin actions to `admin_audit_logs`
- prevent self-destructive admin actions in UI and trusted backend code

## Atomic Steps

1. Add the admin layout, sidebar or drawer nav, and dashboard landing page.
2. Implement admin-only route protection and role checks in trusted server code.
3. Build the applications queue with approve/reject actions and rejection-reason capture.
4. Promote approved organizers by creating or linking the organizer auth account, updating `profiles.role` and `approved_at`, and issuing the credential or invite delivery through a trusted backend path.
5. Record rejection messaging payloads and approval-notification payloads so applicant communication is consistent.
6. Build the users page with role/status filters, moderation actions, and safe edit boundaries.
7. Add self-protection rules so an admin cannot suspend, demote, or delete themself accidentally.
8. Build admin resource lists and detail pages for competitions and problem banks with read-only access and moderated intervention actions.
9. Add `admin_audit_logs` writes for every critical admin action.
10. Add the logs page and settings shell.
11. Add tests for callback handling, auth routing, admin utilities, and critical moderation flows.

## Key Files

- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/applications/page.tsx`
- `app/admin/users/page.tsx`
- `app/admin/users/user-actions.tsx`
- `app/admin/problem-banks/page.tsx`
- `app/admin/problem-banks/[id]/page.tsx`
- `app/admin/competitions/page.tsx`
- `app/admin/competitions/[id]/page.tsx`
- `app/admin/logs/page.tsx`
- `app/admin/settings/page.tsx`
- `lib/supabase/admin.ts`
- `supabase/migrations/*admin*`
- `tests/auth/*`

## Verification

- Manual QA: approve and reject organizer applications, verify credential or invite handoff on approval, suspend/reactivate a user, inspect audit logs, open read-only resource pages, and verify mobile nav.
- Automated: lint plus focused tests around admin auth, callbacks, and trusted mutation helpers.
- Accessibility: table actions, dialogs, and filters are keyboard reachable and screen-reader labeled.
- Performance: user lists are pagination-ready and do not fetch giant unbounded datasets by default.
- Edge cases: service-role key missing, self-action prevention, already-reviewed applications, moderated delete on protected competitions.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(admin): add dashboard shell and navigation`
  - `feat(admin): implement applications review flow`
  - `feat(admin): add user moderation and audit logging`
  - `feat(admin): add read-only resource oversight views`
- PR title template: `UR4-UR5: admin management, moderation, and audit controls`
- PR description template:
  - Summary: admin shell, applications queue, user management, resource oversight, audit logs
  - Testing: lint, targeted tests, manual moderation flow checks
  - Docs: DB doc updated for audit and moderation rules

## Definition of Done

- admins can safely manage users and organizer approvals
- moderated actions are auditable
- admin resource access is available without bypassing ownership rules casually
- the branch leaves a stable admin control plane for later monitoring and settings work
