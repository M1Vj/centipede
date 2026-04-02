# 10 - Competition Search

- Feature branch: `feature/competition-search`
- Requirement mapping: UR10, UR11, UR11a, UR11c, UR12, partial UR11b — competition discovery, search and filtering, calendar localization, registration, withdrawal, and reminder-ready notification hooks
- Priority: 10
- **Assigned to:** Mabansag, Vj and Abenoja, Jaaseia Gian R.

## Mission

Build the mathlete-facing discovery and registration system: searchable competition browsing, description views, timezone-aware calendar display, eligibility-aware registration, withdrawal, and reminder-ready notification hooks.

This branch exists because discovery is more than a search box. It needs registration rules, team eligibility checks, schedule localization, and the participant-facing entry points that later arena and history branches depend on.

Depends on: `08-competition-wizard`, `09-team-management`.

Unblocks: arena entry, leaderboard visibility, reminders, participant monitoring.

## Full Context

- Business context: if discovery and registration are confusing, competitions will never get participation.
- User roles: mathletes, team leaders, organizers viewing their own competition readiness indirectly, admins as support-only readers.
- UI flow: home discovery page, filters, competition detail modal/page, calendar, register, withdraw, eligibility warnings.
- Backend flow: published competition queries, registration creation and withdrawal RPCs, team validation, localized time rendering, notification seed writes.
- Related tables/functions: `competitions`, `competition_registrations`, `teams`, `team_memberships`, `notifications`.
- Edge cases: registration closed, competition full, team below minimum, withdrawing near start time, deleted competition after registration, timezone drift between server and client display.
- Security concerns: registration writes must be server-validated; users cannot register other people or teams they do not lead.
- Performance concerns: search and filters need indexed query paths and paginated results; calendar views should not fetch everything blindly.
- Accessibility/mobile: filters, date views, and registration controls must remain usable on small screens and with keyboards.

## Research Findings / Implementation Direction

- Use server-side filtering and URL-driven search params so discovery state is shareable and testable.
- Localize displayed dates in the client while keeping canonical storage in UTC.
- Reuse validated registration RPCs rather than direct table inserts from the client.
- Treat reminders and registration notifications as a data contract now even if the final preference system lands later.

## Requirements

- searchable and filterable competition list
- competition detail page or modal with description, rules, schedule, and format
- timezone-aware calendar for upcoming and live competitions
- registration and withdrawal flows for individual and team competitions
- clear eligibility, capacity, and roster warnings
- notification hooks for successful registration, withdrawal, schedule updates, and organizer deletes

## Atomic Steps

1. Build the published competition list query with filters for type, format, status, and search text.
2. Add the competition details view with rules, schedule, and format summary.
3. Add a timezone-aware calendar view and sync it with the list filters.
4. Implement individual registration through a trusted mutation path.
5. Implement team registration limited to eligible team leaders and valid rosters.
6. Implement withdrawal rules and confirmation UX.
7. Write notification records for registration and withdrawal events.
8. Surface organizer- or system-driven competition cancellations or schedule changes in the participant UI.
9. Add tests around registration validation and any extracted timezone or eligibility helpers.

## Key Files

- `app/mathlete/page.tsx`
- `components/competitions/*`
- `components/calendar/*`
- `lib/competitions/*`
- `lib/registrations/*`
- `supabase/migrations/*`
- `tests/competitions/*`

## Verification

- Manual QA: search, filter, calendar browse, open details, register individually, register as a team leader, withdraw, and verify messaging when a competition is full or invalid.
- Automated: registration validation tests and any time/localization helper tests.
- Accessibility: filters, calendar navigation, and action buttons are keyboard-safe and screen-reader labeled.
- Performance: list queries are paginated and indexed; calendar rendering does not fetch excessive data.
- Edge cases: schedule localization across timezones, closed registration, invalid rosters, withdrawn then re-registered state.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(discovery): add searchable competition list and details`
  - `feat(discovery): add timezone-aware competition calendar`
  - `feat(registration): implement validated registration and withdrawal flows`
  - `test(registration): cover eligibility and withdrawal rules`
- PR title template: `UR10-UR12: competition discovery, calendar, and registration flows`
- PR description template:
  - Summary: search, filters, details, calendar, registration, withdrawal, notification hooks
  - Testing: lint, helper tests, manual discovery and registration checks
  - Docs: DB doc updated for registration behavior if changed

## Definition of Done

- mathletes can discover and understand competitions before registering
- registration and withdrawal are validated and role-safe
- calendar and search data form a stable foundation for arena entry and notifications
