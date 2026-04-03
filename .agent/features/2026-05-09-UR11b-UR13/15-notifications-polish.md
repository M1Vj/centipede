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
- Do not implement organizer announcement composition controls from branch `16-participant-monitoring`; this branch owns shared announcement-delivery infrastructure (delivery for producer-resolved recipients, mandatory inbox delivery, preference enforcement, and idempotent dispatch) for producer-emitted `competition_announcement_posted` events, while branch `16` owns canonical audience resolution.
- Do not modify anti-cheat penalty logic from branch `12-anti-cheat`.
- This branch owns notification payload standardization, producer-resolved recipient delivery, channel preference enforcement, and deterministic dispatch behavior.

## Full Context

- Business context: a competition platform with poor messaging feels unreliable even if the data is correct.
- User roles: all roles receive notifications; organizers and admins also send explicit notifications for disputes and lifecycle events.
- UI flow: global bell or inbox, unread list, detail links, settings/preferences page, toast surfacing, announcement views.
- Backend flow: notification writes, preference checks, email dispatch, producer-event consumption with deterministic inbox delivery, recalculation messages.
- Related tables/functions: `notifications`, `notification_preferences`, `problem_disputes`, `leaderboard_entries`.
- Edge cases: disabled email preference, repeated reminder sends, already-read notifications, recalculation after publish, schedule updates for withdrawn users.
- Security concerns: users only read their own notifications; dispatch jobs respect preferences.
- Performance concerns: inbox queries need recipient-scoped indexes and efficient unread counts.
- Accessibility/mobile: notification drawers, inbox lists, and settings toggles must be keyboard-safe and usable on phones.

## Research Findings / Implementation Direction

- Keep in-app notifications as the primary guaranteed channel and treat email as an opt-in or critical-event augmentation.
- Use a stable notification payload with type, title, body, link, and metadata so future channels remain consistent.
- Preferences should be row-based and created automatically for every user with deterministic defaults: `in_app_enabled = true`, `email_enabled = false`, and all event-category toggles enabled until the user opts out.
- UI polish should focus on system consistency, not random cosmetic tweaks; update shared components where possible instead of patching individual pages.

## Route Naming Contract (Deterministic)

- Inbox route: `/notifications`.
- Notification preferences route: `/settings/notifications`.
- Bell or inbox triggers from `/mathlete`, `/organizer`, and `/admin` must deep-link to `/notifications`.
- Notification links may target only canonical owned routes: `/organizer/status`, `/mathlete/competition/[competitionId]/leaderboard`, `/organizer/competition/[competitionId]/leaderboard`, `/organizer/competition/[competitionId]/participants`, `/mathlete/competition/[competitionId]/review`, `/mathlete/history`, `/organizer/history`, and `/mathlete/competition/[competitionId]/answer-key`.

## Notification Event Ownership Contract

- `05-organizer-registration` owns applicant transactional lifecycle messaging (submission confirmation, secure status lookup, and applicant-facing approval or rejection delivery), including organizer-decision transactional emails for `organizer_application_approved` and `organizer_application_rejected`.
- `15-notifications-polish` handles only account-linked organizer-decision behavior under the channel matrix; after linkage it may project at most one inbox decision notification keyed by `application_id`, and it must never send organizer-decision email.
- `04-admin-user-management` owns organizer approval and rejection decision outcomes; branch 15 consumes those outcomes for account-linked delivery only.
- `08-competition-wizard` owns lifecycle event writes; branch 15 only consumes relevant lifecycle outcomes for recipient messaging.
- `09-team-management` owns team-invite lifecycle transitions; branch 15 only handles delivery templates and recipient fan-out.
- `10-competition-search` owns competition registration and withdrawal state transitions; branch 15 only handles delivery templates and recipient fan-out.
- `14-leaderboard-history` owns dispute outcomes, leaderboard publication, and recalculation outcomes; branch 15 only handles notification fan-out and preference-aware delivery.
- `15-notifications-polish` owns shared `competition_announcement_posted` consumer infrastructure: delivery for producer-resolved recipients, mandatory inbox delivery, preference checks, idempotent dispatch, and inbox representation.
- `16-participant-monitoring` owns organizer announcement authoring, producer emission, and canonical audience resolution for `competition_announcement_posted`; it consumes branch 15 delivery helpers and does not redefine channel guarantees.
- Executable sequencing for `competition_announcement_posted` follows `.agent/PROCESS-FLOW.md`: branch `15` lands consumer-side delivery helpers first, then branch `16` lands producer writes and trigger wiring that call those helpers.
- Branch 15 verification for announcement delivery must use direct helper invocation or fixture producer events and must not depend on branch 16 authoring UI flows or producer persistence tables.
- Notification writes must use the branch 15 dedupe-key contract and must not create duplicate inbox records under retries.

## Notification Idempotency Key Contract

- Notification dedupe key: `(recipient_id, event_identity_key)`.
- `event_identity_key` must be producer-stable across retries for the same domain event.
- Dispatch paths must upsert or no-op on duplicate keys; retrying a job must not create a second `notifications` row for the same recipient and event.

## Critical Event Channel Matrix (Deterministic)

| Event | Channel class | Delivery rule |
| --- | --- | --- |
| `score_recalculated` | `in_app_only` | Write inbox item only; never send email. |
| `team_invite_sent`, `team_invite_accepted`, `team_invite_declined`, `team_roster_invalidated`, `competition_registration_confirmed`, `competition_registration_withdrawn`, `competition_announcement_posted`, `dispute_resolved`, `leaderboard_published` | `email_eligible` | Write inbox item and send email only when the user's preference row allows that event. |
| `organizer_application_submitted`, `organizer_application_approved`, `organizer_application_rejected` | `in_app_only` | Write inbox item only; branch 15 never sends organizer-lifecycle email because applicant transactional lifecycle-email ownership is branch 05. |

- Allowed channel classes are fixed to `in_app_only`, `email_eligible`, and `email_required`.
- `competition_announcement_posted` has a deterministic minimum: write an inbox item whenever a valid producer event is consumed; email follows the mapped channel class policy.
- New notification events must map to one existing channel class in this matrix; do not invent ad hoc delivery policy in code.

## Event-to-Preference Mapping (Deterministic)

- `team_invite_sent`, `team_invite_accepted`, `team_invite_declined`, `team_roster_invalidated` -> `team_invites`
- `competition_registration_confirmed`, `competition_registration_withdrawn` -> `registration_reminders`
- `competition_announcement_posted` -> `announcements`
- `leaderboard_published`, `dispute_resolved` -> `leaderboard_publication`
- `score_recalculated` -> `score_recalculation`
- `organizer_application_submitted`, `organizer_application_approved`, `organizer_application_rejected` -> `organizer_decisions`
- Dispatch validation rule: every emitted event type must map to exactly one preference toggle. Unmapped event types are invalid and must fail dispatch validation.

## Requirements

- implement inbox route `/notifications` with unread state, mark-read, and mark-all-read actions
- implement preferences route `/settings/notifications` with trusted update handling for in-app and email toggles
- use deterministic notification preference defaults (`in_app_enabled = true`, `email_enabled = false`, event-category toggles enabled) when creating rows
- wire notification dispatch for account-linked organizer decision outcomes as in-app-only inbox notifications (no branch-15 decision email), team lifecycle events (`team_invite_sent`, `team_invite_accepted`, `team_invite_declined`, `team_roster_invalidated`), registration changes, dispute outcomes, leaderboard publication, score recalculation, and announcement delivery from producer-emitted `competition_announcement_posted` events
- enforce notification deduplication using `(recipient_id, event_identity_key)`
- enforce critical-event channel delivery using the explicit matrix classes (`in_app_only`, `email_eligible`, `email_required`) and preference rows where applicable
- apply cross-product UI consistency updates only where notification surfaces are touched

## Atomic Steps

1. Implement `/notifications` and `/settings/notifications` route shells with deterministic loading, empty, and error states.
2. Add unread counts, mark-read actions, and mark-all-read flow with recipient-scoped queries.
3. Implement trusted preference updates backed by deterministic `notification_preferences` defaults for every user.
4. Build or standardize shared dispatch helpers that consume existing producer events only and do not reimplement producer-side mutations.
5. Add dispatch safeguards keyed by `(recipient_id, event_identity_key)` for retried jobs and repeated reminders.
6. Integrate critical-event channel behavior using only the matrix classes (`in_app_only`, `email_eligible`, `email_required`) with deterministic preference enforcement.
7. Surface announcement and event links in participant-facing notification items using canonical route targets, including history and answer-key deep links where post-competition flows land.
8. Add tests for preference helpers, deduplication behavior, and recipient-scoped inbox query logic.
9. Apply a scoped UI consistency pass for notification entry points and states.

## Key Files

- `app/notifications/page.tsx`
- `app/settings/notifications/page.tsx`
- `components/notifications/*`
- `lib/notifications/*`
- `supabase/migrations/*`
- `tests/notifications/*` (planned suite; currently absent in repository)

## Verification

- Command verification (all commands must exit 0): `npm run lint`, `npm run test`, `npm run build`.
- Targeted suite verification gate: if `tests/notifications/*` exists, run `npm run test -- tests/notifications`; otherwise `npm run test` remains the required baseline gate.
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
- announcement delivery remains producer-agnostic with mandatory inbox minimum on consumed producer events and is not blocked by branch 16 authoring controls
- critical-event channel behavior is matrix-driven (`in_app_only`, `email_eligible`, `email_required`) and not invented per feature
- organizer decisions and dispute outcomes are part of the notification contract rather than ad hoc follow-up
- route and command verification gates are explicit and repeatable
- the product looks and behaves like one system rather than a stack of branches
