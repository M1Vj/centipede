# 10 - Competition Search

- Feature branch: `feature/competition-search`
- Requirement mapping: UR10, UR11, UR11a, UR11c, UR12, partial UR11b — competition discovery, search and filtering, calendar localization, registration, withdrawal, and reminder-ready notification hooks
- Priority: 10
- **Assigned to:** Mabansag, Vj and Abenoja, Jaaseia Gian R.

## Mission

Build the mathlete-facing discovery and registration system: searchable competition browsing, description views, timezone-aware calendar display, eligibility-aware registration, withdrawal, and reminder-ready notification hooks.

This branch exists because discovery is more than a search box. It needs registration rules, team eligibility checks, schedule localization, and the participant-facing entry points that later arena and history branches depend on.

This branch must define registration eligibility and ownership boundaries explicitly so implementation does not drift between UI assumptions and trusted backend behavior.

Depends on: `08-competition-wizard`, `09-team-management`.

Unblocks: arena entry, leaderboard visibility, reminders, participant monitoring.

## Dependency Gate (Explicit)

- Do not start until branch `09-team-management` is merged, because team-registration eligibility depends on team-lock and membership contracts.
- Keep registration flow contracts aligned with branch `08-competition-wizard` lifecycle/state guards and branch `11-arena` route extension.
- Use the same route and entity names declared here in downstream branches (`11`, `13`, `14`) to avoid forked path contracts.

## Full Context

- Business context: if discovery and registration are confusing, competitions will never get participation.
- User roles: mathletes, team leaders, organizers viewing their own competition readiness indirectly, admins as support-only readers.
- UI flow: home discovery page, filters, competition detail modal/page, calendar, register, withdraw, eligibility warnings.
- Backend flow: published competition queries, registration creation and withdrawal RPCs, team validation, localized time rendering, registration-domain notification dispatch, and participant consumption of organizer/system lifecycle events.
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
- deterministic route-mode arbitration on `/mathlete/competition/[competitionId]` so detail/register and arena ownership do not conflict
- timezone-aware calendar for upcoming and live competitions
- registration and withdrawal flows for individual and team competitions via trusted mutation paths
- clear eligibility, capacity, and roster warnings
- notification hooks for successful registration and withdrawal event emission via shared dispatch helpers, plus participant UI consumption of schedule-change/cancellation events from organizer or system sources

### Canonical Routes and Entities (Do Not Rename)

- Routes:
  - `/mathlete/competition`
  - `/mathlete/competition/calendar`
  - `/mathlete/competition/[competitionId]`
- Route ownership boundary:
  - Branch `10` owns discovery list, calendar, and base detail/register-withdraw rendering.
  - Branch `11` must use exactly `/mathlete/competition/[competitionId]` for pre-entry and active-attempt runtime entry (nested subroutes under that segment are allowed).
  - Do not introduce alias or equivalent arena root paths (for example `/mathlete/arena/[competitionId]`).
- Deterministic render arbitration for `/mathlete/competition/[competitionId]`:
  1. Trusted loader resolves one `competition_page_mode` value before render.
  2. If mode is `arena_runtime` (active `in_progress` attempt), branch `11` runtime render owns the page.
  3. If mode is `pre_entry` (registered and eligible to start/resume with no active runtime render), branch `11` pre-entry render owns the page.
  4. If mode is `detail_register` (not eligible for pre-entry/runtime), branch `10` detail/register render owns the page.
  5. `submitted`, `auto_submitted`, `graded`, and `disqualified` attempts never route back into runtime mode on this page.
- Entities:
  - DiscoverableCompetition: `competitions` row where `is_deleted = false` and `status IN ('published','live','paused')` for branch `10` discovery surfaces (`ended` and `archived` history ownership is branch `14`)
  - IndividualRegistration: `competition_registrations` row with `profile_id` populated
  - TeamRegistration: `competition_registrations` row with `team_id` populated
  - EligibilityDecision: trusted mutation/RPC result returned to UI as a typed failure or success outcome

### Registration and Eligibility Contract (Explicit)

1. Source of truth: registration and withdrawal must execute through trusted server mutations/RPCs (`register_for_competition`, `withdraw_registration`). Client code must not write directly to `competition_registrations`.
   - accepted registrations must populate immutable `competition_registrations.entry_snapshot_json` from the participant/team context at registration time so later history and export reads do not drift with profile or roster edits
2. Universal eligibility checks before registration:
   - authenticated active profile
   - profile completion already satisfied
  - competition has `is_deleted = false` and `status IN ('published','live','paused')`
  - scheduled competitions require open registration window predicate (`registration_start <= now() < registration_end` and `now() < start_time`)
   - capacity limits not exceeded
   - no duplicate active registration for the same participant/team and competition
3. Team-specific eligibility checks:
   - actor is active leader of the selected team
   - team membership count satisfies competition team-size requirement at registration time
   - team is not blocked by a lock/conflict rule from branch `09`
   - team registration allowed only for scheduled team competitions
4. Withdrawal checks:
  - canonical invariant: any existing `competition_attempts` row for the participant/team registration blocks withdrawal.
  - scheduled: allow only before `start_time` and only when no `competition_attempts` row exists for that registration.
  - open: allow only when no `competition_attempts` row exists for that registration.
   - all withdrawals must set explicit `status_reason`
5. Ineligible-team handling: if branch `09` marks a team registration `ineligible`, discovery must show actionable messaging and a re-registration path when windows remain open.
6. Error contract: eligibility failures must return deterministic machine-readable codes mapped to human-readable UI copy through shared helpers.

### Notification Ownership Boundary

- Branch `10` emits registration-domain events only (`competition_registration_confirmed`, `competition_registration_withdrawn`) through shared dispatch helpers called from trusted server paths.
- Branch `10` consumes organizer/system events (`competition_schedule_changed`, `competition_cancelled`) in participant UI but does not own event creation for those cases.
- Branch `10` must not implement email fan-out, preference evaluation, or direct table writes from UI components; those are owned by branch `15-notifications-polish`.

## Atomic Steps

1. Build the published competition list query with filters for type, format, status, and search text.
2. Add the competition details route at `/mathlete/competition/[competitionId]` with rules, schedule, format summary, register/withdraw actions, and trusted `competition_page_mode` arbitration for branch `11` handoff.
3. Add a timezone-aware calendar route at `/mathlete/competition/calendar` and sync it with list filters.
4. Implement individual registration through `register_for_competition` trusted mutation path.
5. Implement team registration limited to eligible team leaders and valid rosters, reusing branch `09` lock checks.
6. Implement withdrawal rules and confirmation UX through `withdraw_registration` trusted mutation path.
7. Call shared notification dispatch helpers for registration and withdrawal events only.
8. Surface organizer- or system-driven competition cancellations or schedule changes in the participant UI.
9. Add tests around registration validation and any extracted timezone or eligibility helpers.

## Key Files

- `app/mathlete/competition/page.tsx`
- `app/mathlete/competition/calendar/page.tsx`
- `app/mathlete/competition/[competitionId]/page.tsx`
- `components/competitions/*`
- `components/calendar/*`
- `lib/competitions/*`
- `lib/registrations/*`
- `lib/notifications/*` (shared dispatch helper calls only)
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
- calendar and search data form a stable foundation for arena entry and notifications without route/entity drift
