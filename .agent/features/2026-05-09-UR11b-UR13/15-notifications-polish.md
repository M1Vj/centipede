# 15 - Notifications Polish

- Feature branch: `feature/notifications-polish`
- Requirement mapping: UR11b, cross-cutting product polish — in-app notifications, preference management, delivery messaging, announcement presentation, and cross-product UI polish
- Priority: 15
- **Assigned to:** Mabansag, Vj

## Mission

Finalize the messaging and polish layer: in-app notifications, preference management, email delivery for critical events, score-recalculation messaging, announcement presentation, and broad UI consistency improvements across the product.

This branch exists because the prior plan treated notifications as a late garnish. In reality, invitations, approvals, schedule changes, publications, and recalculations all depend on a coherent notification contract.

Depends on: `05-organizer-registration`, `08-competition-wizard`, `14-leaderboard-history`.

Unblocks: `16-participant-monitoring` and release readiness.

## Scope Boundary

- Do not rebuild organizer application intake, approval UI, or applicant status lookup from branch `05-organizer-registration`.
- Do not redefine lifecycle state transitions or publish guards from branch `08-competition-wizard`.
- Do not implement dispute-resolution decisions or leaderboard publication actions from branch `14-leaderboard-history`.
- Do not implement organizer announcement composition controls from branch `16-participant-monitoring`; this branch owns the announcement-delivery contract, recipient delivery, inbox surfacing, and preference enforcement for durable announcement records produced by owning branches.
- Do not modify anti-cheat penalty logic from branch `12-anti-cheat`.
- This branch owns notification payload standardization, recipient scoping, channel preference enforcement, and deterministic dispatch behavior.

## Full Context

- Business context: a competition platform with poor messaging feels unreliable even if the data is correct.
- User roles: all roles receive notifications; organizers and admins also send explicit notifications for disputes and lifecycle events.
- UI flow: global bell or inbox, unread list, detail links, settings/preferences page, toast surfacing, announcement views.
- Backend flow: notification writes, preference checks, email dispatch, announcement fan-out, recalculation messages.
- Related tables/functions: `notifications`, `notification_preferences`, `competition_announcements`, `problem_disputes`, `leaderboard_entries`.
- Edge cases: disabled email preference, repeated reminder sends, already-read notifications, recalculation after publish, schedule updates for withdrawn users.
- Security concerns: users only read their own notifications; dispatch jobs respect preferences.
- Performance concerns: inbox queries need recipient-scoped indexes and efficient unread counts.
- Accessibility/mobile: notification drawers, inbox lists, and settings toggles must be keyboard-safe and usable on phones.

## Research Findings / Implementation Direction

- Keep in-app notifications as the primary guaranteed channel and treat email as an opt-in or critical-event augmentation.
- Use a stable notification payload with type, title, body, link, and metadata so future channels remain consistent.
- Preferences should be row-based and created automatically for every user.
- UI polish should focus on system consistency, not random cosmetic tweaks; update shared components where possible instead of patching individual pages.

## Route Naming Contract (Deterministic)

- Inbox route: `/notifications`.
- Notification preferences route: `/settings/notifications`.
- Bell or inbox triggers from `/mathlete`, `/organizer`, and `/admin` must deep-link to `/notifications`.
- Notification links may target only canonical owned routes: `/organizer/status`, `/mathlete/competition/[competitionId]/leaderboard`, `/organizer/competition/[competitionId]/leaderboard`, `/organizer/competition/[competitionId]/participants`, and `/mathlete/competition/[competitionId]/review`.

## Notification Event Ownership Contract

- `05-organizer-registration` owns `organizer_application_submitted` applicant confirmation delivery and status-lookup UX, including pre-account submission email sends.
- `15-notifications-polish` may consume `organizer_application_submitted` payload only after account linkage exists; it normalizes inbox projection and channel preferences for linked profiles and does not own pre-account applicant delivery.
- `04-admin-user-management` owns organizer approval and rejection decision outcomes; branch 15 only standardizes and dispatches user-scoped in-app or email delivery for those outcomes.
- `08-competition-wizard` owns lifecycle event writes; branch 15 only consumes relevant lifecycle outcomes for recipient messaging.
- `09-team-management` owns team-invite lifecycle transitions; branch 15 only handles delivery templates and recipient fan-out.
- `10-competition-search` owns competition registration and withdrawal state transitions; branch 15 only handles delivery templates and recipient fan-out.
- `14-leaderboard-history` owns dispute outcomes, leaderboard publication, and recalculation outcomes; branch 15 only handles notification fan-out and preference-aware delivery.
- `15-notifications-polish` owns announcement notification delivery behavior: recipient scoping, preference checks, idempotent dispatch, and inbox representation from durable `competition_announcements` records.
- `16-participant-monitoring` owns organizer announcement authoring and `competition_announcements` record creation; it consumes branch 15 delivery helpers and does not redefine channel guarantees.
- Branch 15 verification for announcement delivery uses seeded or direct durable announcement records and must not depend on branch 16 authoring UI flows.
- Notification writes must use the branch 15 dedupe-key contract and must not create duplicate inbox records under retries.

## Notification Idempotency Key Contract

- Notification dedupe key: `(recipient_profile_id, event_identity_key)`.
- `event_identity_key` must be producer-stable across retries for the same domain event.
- Dispatch paths must upsert or no-op on duplicate keys; retrying a job must not create a second `notifications` row for the same recipient and event.

## Requirements

- implement inbox route `/notifications` with unread state, mark-read, and mark-all-read actions
- implement preferences route `/settings/notifications` with trusted update handling for in-app and email toggles
- wire notification dispatch for account-linked organizer decision outcomes, team invites, registration changes, dispute outcomes, leaderboard publication, score recalculation, and announcement delivery from durable producer-owned records
- enforce notification deduplication using `(recipient_profile_id, event_identity_key)`
- integrate email delivery for critical event types while honoring preference rows
- apply cross-product UI consistency updates only where notification surfaces are touched

## Atomic Steps

1. Implement `/notifications` and `/settings/notifications` route shells with deterministic loading, empty, and error states.
2. Add unread counts, mark-read actions, and mark-all-read flow with recipient-scoped queries.
3. Implement trusted preference updates backed by `notification_preferences` defaults for every user.
4. Build or standardize shared dispatch helpers that consume existing producer events only and do not reimplement producer-side mutations.
5. Add dispatch safeguards keyed by `(recipient_profile_id, event_identity_key)` for retried jobs and repeated reminders.
6. Integrate critical-event email delivery with strict preference checks.
7. Surface announcement and event links in participant-facing notification items using canonical route targets.
8. Add tests for preference helpers, deduplication behavior, and recipient-scoped inbox query logic.
9. Apply a scoped UI consistency pass for notification entry points and states.

## Key Files

- `app/notifications/page.tsx`
- `app/settings/notifications/page.tsx`
- `components/notifications/*`
- `lib/notifications/*`
- `supabase/migrations/*`
- `tests/notifications/*`

## Verification

- Command verification (all commands must exit 0): `npm run lint`, `npm run test -- tests/notifications`, `npm run build`.
- Dev-server smoke verification (long-running): start `npm run dev`, probe `/notifications` and `/settings/notifications` under role shells, then intentionally stop the process and capture probe evidence.
- Migration verification when `supabase/migrations/*` changes: `npm run supabase:status` and `npm run supabase:db:reset`.
- Route probe verification during smoke run: `/notifications` and `/settings/notifications` load correctly for each role shell and preserve auth guards.
- Manual QA: receive team-invite and organizer-decision notifications, toggle preferences, mark items read, and receive dispute-outcome, leaderboard-publication, recalculation, and announcement notices.
- Accessibility: inbox lists, toggles, and deep links are keyboard reachable and clearly labeled.
- Performance: unread-count and inbox queries stay recipient-scoped and indexed.
- Edge cases: disabled channels, duplicate dispatch retries, recalculation after publication, withdrawn users, and stale deep links.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(notifications): add inbox and unread flows`
  - `feat(notifications): add preferences and critical event writes`
  - `feat(notifications): integrate email and announcement delivery`
  - `chore(ui): apply cross-product polish and consistency pass`
- PR title template: `UR11b: notifications, preferences, and product polish`
- PR description template:
  - Summary: inbox, preferences, event wiring, email delivery, UI polish
  - Testing: lint, notification tests, manual inbox and preference checks
  - Docs: DB doc updated for notification behavior if changed

## Definition of Done

- notifications are reliable, user-scoped, and preference-aware
- event producers remain in their owning branches while this branch provides deterministic delivery behavior
- announcement delivery remains producer-agnostic and is not blocked by branch 16 authoring controls
- organizer decisions and dispute outcomes are part of the notification contract rather than ad hoc follow-up
- route and command verification gates are explicit and repeatable
- the product looks and behaves like one system rather than a stack of branches
