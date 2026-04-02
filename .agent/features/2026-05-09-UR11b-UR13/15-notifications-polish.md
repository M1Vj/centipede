# 15 - Notifications Polish

- Feature branch: `feature/notifications-polish`
- Requirement mapping: UR11b, cross-cutting product polish — in-app notifications, preference management, delivery messaging, announcement presentation, and cross-product UI polish
- Priority: 15
- **Assigned to:** Mabansag, Vj

## Mission

Finalize the messaging and polish layer: in-app notifications, preference management, email delivery for critical events, score-recalculation messaging, announcement presentation, and broad UI consistency improvements across the product.

This branch exists because the prior plan treated notifications as a late garnish. In reality, invitations, approvals, schedule changes, publications, and recalculations all depend on a coherent notification contract.

Depends on: `04-admin-user-management`, `14-leaderboard-history`.

Unblocks: participant monitoring completeness and release readiness.

## Full Context

- Business context: a competition platform with poor messaging feels unreliable even if the data is correct.
- User roles: all roles receive notifications; organizers and admins also send some of them.
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

## Requirements

- user inbox with unread state and mark-read actions
- preferences page for in-app and email toggles
- notification writes for organizer approvals, team invites, registration changes, leaderboard publication, score recalculation, and announcements
- email delivery integration for critical events
- broad UI consistency pass across touched product areas

## Atomic Steps

1. Build the notification inbox entry point and list UI.
2. Add unread counts, mark-read actions, and a mark-all-read flow.
3. Build the notification preferences page and trusted update path.
4. Add notification writes across already-implemented flows.
5. Integrate email dispatch for critical event types while honoring preferences.
6. Surface live competition announcements within the participant UI.
7. Perform a deliberate UI consistency pass across headers, empty states, forms, and action spacing.
8. Add tests for preference helpers and notification query logic.

## Key Files

- `components/notifications/*`
- `app/settings/notifications/page.tsx`
- `lib/notifications/*`
- `supabase/migrations/*`
- `tests/notifications/*`

## Verification

- Manual QA: receive team invite and organizer-decision notifications, toggle preferences, mark items read, receive leaderboard publication and recalculation notices.
- Automated: preference and notification helper tests.
- Accessibility: inbox, toggles, and links are keyboard reachable and clearly labeled.
- Performance: unread count and inbox queries are recipient-scoped and indexed.
- Edge cases: disabled channels, duplicate events, recalculation after publication, withdrawn users and stale announcement links.

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
- critical competition events communicate through consistent channels
- the product looks and behaves like one system rather than a stack of branches
