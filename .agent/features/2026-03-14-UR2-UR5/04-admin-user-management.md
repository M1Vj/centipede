# 04 - Admin User Management

- Feature branch: `feature/admin-user-management`
- Requirement mapping: UR4, UR5 — admin approvals, user moderation, audit logging, and read-only operational oversight
- Priority: 4
- **Assigned to:** Celeres, Anthony

## Mission

Create the full admin workspace for trusted organizer-review decisions, user moderation, auditable interventions, and read-only operational oversight. This branch also defines the operational admin shell that later monitoring and system-settings work extend.

This branch exists because admin work is not just a list page. It needs service-role-safe helpers, self-protection rules, audit logging, constrained moderation actions, read-only resource views, and mobile-safe navigation.

Depends on: `02-authentication`, `03-interaction-feedback`.

Unblocks: admin-side organizer approval decisions, moderation, admin-backed default bank management scaffolding, and operational oversight.

## Branch Boundaries (Critical)

- branch `04-admin-user-management` owns admin review decision writes only: `organizer_applications.status`, `organizer_applications.reviewed_at`, and `organizer_applications.rejection_reason` through trusted admin paths
- branch `05-organizer-registration` owns organizer activation and provisioning (`profiles.role`, `profiles.approved_at`) through a trusted activation path for approved applications, including `organizer_applications.profile_id IS NULL` cases
- branch `05b-deferred-foundation-and-auth` owns safe anonymization for non-spam account removal and other deferred platform foundations; branch 04 must not re-implement these

## 04 -> 05 Handoff Contract (Idempotent)

- branch 04 is the only writer for organizer review decision fields: `organizer_applications.status`, `organizer_applications.rejection_reason`, and `organizer_applications.reviewed_at`
- decision source of truth is the one-way transition from `pending` to `approved` or `rejected`; repeated decision attempts must be no-op or rejected without rewriting reviewed data
- handoff artifact is the reviewed `organizer_applications` row; branch 05 consumes that decision and runs trusted activation/provisioning for approved rows only
- branch 05 is explicitly prohibited from writing branch 04 decision fields (`status`, `rejection_reason`, `reviewed_at`)
- handoff processing in branch 05 must be deterministic and idempotent: activation/provisioning and applicant communication must remain exactly-once logical outcomes per approved or rejected application

## Full Context

- Business context: the platform cannot safely open organizer access or live competitions without an admin control plane.
- User roles: admins as first-class operators; organizers and mathletes as moderation targets or reviewed entities.
- UI flow: admin dashboard, applications queue, users page, logs page, read-only problem-bank and competition oversight views, settings shell.
- Backend flow: trusted admin server utilities, audit log writes, organizer application approve or reject decisions, suspension toggles, and moderated pause or delete actions through trusted paths.
- Related tables/functions: `profiles`, `organizer_applications`, `problem_banks`, `problems`, `competitions`, `competition_events`, `admin_audit_logs`, `system_settings`, `approve_organizer_application(...)`, `reject_organizer_application(...)`.
- Edge cases: admin attempting to suspend themself, approving already-reviewed application, deleting active competitions, missing service-role key, read-only access to organizer-owned resources.
- Security concerns: admin actions must be server-trusted, auditable, and resistant to client-side spoofing.
- Performance concerns: user and application tables need server-side filtering and pagination-ready design.
- Accessibility/mobile: data tables need keyboard navigation and mobile fallbacks; destructive actions need confirmation and explicit copy.

## Research Findings / Implementation Direction

- Keep admin mutations in server-only helpers backed by the service-role client or tightly-scoped security-definer RPCs.
- Align organizer decision writes to DB contract fields: `organizer_applications.status`, `rejection_reason`, and `reviewed_at`; defer all organizer activation/provisioning writes (`profiles.role`, `profiles.approved_at`) to branch 05 trusted activation handlers.
- Treat organizer decision writes as single-source and idempotent: only unresolved `pending` rows can transition, and already-reviewed rows must not be rewritten by retries.
- Model audit logging as a mandatory write path for approvals, suspensions, deletes, pauses, and settings updates.
- Enforce moderation scope: admin resource views are read-only by default, and intervention actions are limited to trusted pause or delete server paths with audit logging.
- Build admin pages using server data loading with table controls reflected in the URL so filters remain shareable and testable.

## Requirements

- add admin dashboard layout and navigation
- implement organizer applications review with approve and reject actions
- persist organizer decision outcomes in trusted backend paths (`status`, `rejection_reason`, `reviewed_at`) only
- enforce one-way decision transition semantics (`pending` -> `approved|rejected`) so branch 05 can treat reviewed rows as stable handoff inputs for trusted activation/provisioning
- do not implement applicant-facing credential provisioning, secure status lookup, or approval or rejection email delivery in this branch (owned by branch 05)
- implement user moderation with search, filters, suspension/reactivation, and safe update flows
- implement hard-delete guardrails for explicit spam/fake accounts only; non-spam account-removal requests must never use soft-delete or generic hard-delete and must route to the anonymization-only flow delivered by branch `05b-deferred-foundation-and-auth`
- add read-only admin views for competitions and problem banks plus moderated pause or delete actions through trusted server paths only
- add admin system-log and settings shells tied to trusted data sources (`admin_audit_logs`, `system_settings`)
- log all critical admin actions to `admin_audit_logs` with `action_type`, `target_table`, `target_id`, and `metadata_json`
- prevent self-destructive admin actions in UI and trusted backend code

## Atomic Steps

1. Add the admin layout, sidebar or drawer nav, and dashboard landing page.
2. Implement admin-only route protection and role checks in trusted server code.
3. Build the applications queue with approve/reject actions and rejection-reason capture.
4. Persist approval or rejection decisions through trusted backend paths using `approve_organizer_application(...)` and `reject_organizer_application(...)` contracts.
5. Ensure decision writes update only `organizer_applications.status`, `rejection_reason`, and `reviewed_at`.
6. Enforce idempotent review transitions (`pending` -> `approved|rejected`) and treat the reviewed row as the explicit handoff artifact consumed by branch 05 activation/provisioning handlers.
7. Explicitly keep applicant-facing status lookup, communication delivery, organizer activation/provisioning writes, and onboarding UX out of this branch; branch 05 owns them.
8. Build the users page with role/status filters, moderation actions, and safe edit boundaries.
9. Add self-protection rules so an admin cannot suspend, demote, or delete themself accidentally.
10. Build user deletion helpers for permanent removal of explicit spam or fake accounts and route non-spam removals only through the `05b-deferred-foundation-and-auth` anonymization flow.
11. Build admin resource lists and detail pages for competitions and problem banks with read-only access and moderated intervention actions only.
12. Add `admin_audit_logs` writes for every critical admin action.
13. Add the system-log and settings shells backed by trusted sources, without introducing unrelated notifications/history/content-moderation modules here.
14. Add tests for admin route protection, organizer decision mutations, self-protection rules, and critical moderation/audit flows.

## Key Files

- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/applications/page.tsx`
- `app/admin/users/page.tsx`
- `app/admin/users/user-actions.tsx`
- `app/admin/problem-banks/page.tsx`
- `app/admin/problem-banks/[bankId]/page.tsx`
- `app/admin/competitions/page.tsx`
- `app/admin/competitions/[competitionId]/page.tsx`
- `app/admin/logs/page.tsx`
- `app/admin/settings/page.tsx`
- `lib/supabase/admin.ts`
- `supabase/migrations/*admin*`
- `tests/auth/*`

## Admin Routes (Explicit Mapping)

- `/admin` -> dashboard landing and admin workspace shell
- `/admin/applications` -> organizer application queue with approve/reject decision actions
- `/admin/users` -> user search/filter and moderation actions
- `/admin/problem-banks` and `/admin/problem-banks/[bankId]` -> read-only oversight with trusted moderation actions only
- `/admin/competitions` and `/admin/competitions/[competitionId]` -> read-only oversight with trusted moderation actions only
- `/admin/logs` -> admin audit trail viewer backed by `admin_audit_logs`
- `/admin/settings` -> system-settings shell backed by trusted settings data

## Verification

 - Manual QA: approve and reject organizer applications, verify trusted decision writes (`status`, `rejection_reason`, `reviewed_at`), suspend/reactivate a user, exercise spam/fake hard-delete guardrails (and non-spam anonymization-routing behavior), inspect audit logs, open read-only resource pages, and verify mobile nav.
- Automated: lint plus focused tests around admin route protection, trusted mutation helpers, self-action prevention, and audit-log side effects.
- Accessibility: table actions, dialogs, and filters are keyboard reachable and screen-reader labeled.
- Performance: user lists are pagination-ready and do not fetch giant unbounded datasets by default.
- Edge cases: service-role key missing, self-action prevention, already-reviewed applications, moderated delete on protected competitions, and rejection without reason.

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
  - Summary: admin shell, applications queue, user management, hard-delete guardrails for spam/fake users, resource oversight, audit logs
  - Testing: lint, targeted tests, manual moderation flow checks
  - Docs: DB doc updated for audit and moderation rules

## Definition of Done

- admins can safely manage users and organizer approvals
- moderated actions are auditable
- admin resource access is available without bypassing ownership rules casually
- admin-side organizer approval decisions are the single write source for `status`, `reviewed_at`, and `rejection_reason` (`pending` -> `approved|rejected`), while activation/provisioning writes are clearly owned by branch 05 trusted handlers
- non-spam account-removal flows are explicitly deferred to branch 05b safe anonymization behavior
- the branch leaves a stable admin control plane for later monitoring and settings work
