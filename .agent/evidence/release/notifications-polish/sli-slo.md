# Notifications Polish SLI/SLO Evidence

Branch: `feature/notifications-polish`

## SLI

- Notification inbox availability: successful authenticated loads of `/notifications`.
- Preference update reliability: successful authenticated saves through `update_notification_preferences`.
- Dispatch idempotency: duplicate `(recipient_id, event_identity_key)` dispatches create at most one inbox row.
- Read-state reliability: authenticated `mark_notification_read` and `mark_all_notifications_read` complete without cross-user mutation.

## SLO

- Release-one reliability target: `>= 99.5%` successful notification and preference operations over a rolling 28-day window.
- Error budget: `0.5%` failed notification route/action/dispatch attempts over the same window.

## Evidence

- Unit and SQL contract tests cover event mapping, link allowlist behavior, invalid-event rejection, default preferences, RLS contracts, idempotent enqueue, and read-state RPCs.
- Local Supabase reset applies the branch-15 migration in timestamp order.
- Playwright smoke covered mobile, tablet, and desktop routes with real navigation from the mathlete workspace notification entry point.

## Release Decision

Release can proceed when final branch gates pass: lint, test, build, Supabase status, Supabase reset, and Playwright smoke. Any high/critical notification privacy, access-control, or migration defect blocks release.
