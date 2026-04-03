# 09 - Team Management

- Feature branch: `feature/team-management`
- Requirement mapping: UR9, UR9a, UR9b, UR9c — team creation, invites, roster rules, leadership transfer, and ineligibility handling
- Priority: 9
- **Assigned to:** Mabansag, Vj

## Mission

Implement the complete team system for team competitions, including team creation, invite workflows, roster management, leadership transfer, registration lock behavior, and automatic ineligibility handling when a roster becomes invalid.

This branch exists because the old spec describes team participation as a user-facing feature, but the real complexity is in roster integrity rules and how those rules interact with registrations and later competition attempts.

This branch must define lock and eligibility behavior explicitly so discovery and registration flows can consume deterministic team-state contracts.

Depends on: `02-authentication`, `03-interaction-feedback`, `08-competition-wizard`.

Unblocks: team competition registration, team arena participation, participant monitoring.

## Dependency Gate (Explicit)

- Do not start until branch `08-competition-wizard` is merged, because team lock logic depends on canonical competition format and lifecycle contracts.
- Branch `09` owns team-domain lock predicates, invite or membership mutation rules, and deterministic guard helpers; branch `10-competition-search` owns registration-table integration where `competition_registrations` schema and registration mutations exist.
- Branch `10-competition-search` must consume route and entity names from this branch without renaming.

## Full Context

- Business context: team competitions need reliable roster ownership and fair lock rules.
- User roles: mathlete leaders, invited mathletes, organizers validating registered teams, admins handling edge-case moderation.
- UI flow: team list, team create, invite by username or team code, pending invite response, member removal, leave team, transfer leadership messaging.
- Backend flow: team and membership writes, invite acceptance, roster validation against registered competitions, ineligibility status updates.
- Related tables/functions: `teams`, `team_memberships`, `team_invitations`, `competition_registrations`, `notifications`.
- Edge cases: leader leaves, invited user already on conflicting team, duplicate team name, member removed after registration, suspended or deleted user in roster.
- Security concerns: only active team leaders can invite or remove; membership writes are not client-trusted; cross-team conflicts must be enforced server-side.
- Performance concerns: invite lookups and roster reads must stay quick; search should be indexed.
- Accessibility/mobile: invitation flows and roster actions must work cleanly on mobile and via keyboard.

## Research Findings / Implementation Direction

- Separate invites from memberships so pending invites do not contaminate roster logic.
- Keep leadership transfer deterministic using earliest active join time.
- Lock or constrain roster mutation once a team is registered for a scheduled competition, except for account-deletion recovery rules.
- Model invalid rosters as `ineligible` rather than silently withdrawing them so organizers and team leaders retain traceability.

## Requirements

- unique team names and reusable invite code support
- invite by username and by team code entry
- accept/decline and revoke invite behavior with trusted conflict checks
- remove member, leave team, and automatic leadership transfer
- enforce competition-specific roster lock and eligibility rules with explicit lock and unlock transitions
- notify leaders and affected members when a roster becomes invalid after registration using shared notification helpers

### Canonical Routes and Entities (Do Not Rename)

- Routes:
  - `/mathlete/teams`
  - `/mathlete/teams/create`
  - `/mathlete/teams/[teamId]`
  - `/mathlete/teams/invites`
  - `/mathlete/teams/join`
- Entities:
  - Team: `teams` row keyed by `teams.id`
  - ActiveMembership: `team_memberships` row where `is_active = true` and `left_at is null`
  - PendingInvitation: `team_invitations` row where `status = 'pending'`
  - TeamRegistration: `competition_registrations` row with `team_id` populated
  - TeamRosterLock: derived state from competition and registration data, not a standalone table

### Roster Lock and Eligibility Contract (Explicit, Branch10 Handoff)

1. Lock predicate ownership (branch `09`): roster lock is true for a `(team_id, competition_id)` pair when registration state is `registered` for a competition where `format = 'team'` and `type = 'scheduled'`; branch `10` provides `competition_registrations` state integration for this predicate.
2. Lock scope: while locked, block invite creation, invite acceptance, member removal, member leave, manual leadership transfer, and team archival from mathlete-facing flows.
3. Lock release predicate (branch `09` contract): release lock only when registration status transitions to `withdrawn`, `cancelled`, or `ineligible`, or the competition status transitions to `ended` or `archived`; branch `10` executes registration-state wiring.
4. Defensive exception only: trusted moderation flows can force membership deactivation for suspended/deleted users; this must set registration status to `ineligible` with `status_reason` and preserve audit traceability.
5. Re-entry rule: when status becomes `ineligible`, roster edits become allowed again under branch `09` guard rules so the leader can repair membership and re-register through branch `10` if registration is still open.
6. Eligibility authority: all lock and conflict checks must execute in trusted server actions/RPCs. UI warnings are informational and are never the source of truth.
7. Conflict minimum: invitation acceptance must fail if the invitee would become active on two different teams already registered in the same competition; branch `10` registration lookups must consume this deterministic guard contract.

### Notification Ownership Boundary

- Branch `09` owns domain event emission for team lifecycle events: `team_invite_sent`, `team_invite_accepted`, `team_invite_declined`, `team_roster_invalidated`.
- Branch `09` must call shared notification dispatch helpers from trusted server paths and must not write directly to `notifications` from client components.
- Branch `15-notifications-polish` owns inbox UX, preference toggles, email fan-out, and notification-copy standardization.

## Atomic Steps

1. Build the team list and team create flow.
2. Implement memberships, invite creation, and invite response handling.
3. Add username search and team-code invite entry.
4. Build roster management actions for leaders and members.
5. Implement automatic leadership transfer when the current leader leaves or is removed.
6. Implement deterministic team-domain roster-lock and conflict guard helpers through trusted mutation helpers, and publish branch `10` integration handoff for registration-aware wiring where `competition_registrations` exists.
7. Add ineligibility transition and shared notification event-dispatch contracts that branch `10` registration flows consume when a locked team drops below required roster constraints.
8. Add tests for membership validation, leadership transfer, and invite acceptance rules.

## Key Files

- `app/mathlete/teams/page.tsx`
- `app/mathlete/teams/create/page.tsx`
- `app/mathlete/teams/[teamId]/page.tsx`
- `app/mathlete/teams/invites/page.tsx`
- `app/mathlete/teams/join/page.tsx`
- `components/teams/*`
- `lib/teams/*`
- `lib/notifications/*` (shared dispatch helpers only)
- `supabase/migrations/*`
- `tests/teams/*`

## Verification

- Manual QA: create a team, send invites, accept and decline invites, remove members, leave as leader and non-leader, register a team then test lock behavior.
- Automated: invite lifecycle, membership conflict, leadership transfer, and ineligibility helper tests.
- Accessibility: invite dialogs, roster tables, and confirmation actions are keyboard-safe and labeled.
- Performance: user search is indexed and invite-state refreshes are efficient.
- Edge cases: deleted member, suspended member, conflicting team registration, duplicate invite submissions.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(teams): add team creation and roster pages`
  - `feat(teams): implement invite and response flows`
  - `feat(teams): add leadership transfer and roster validation`
  - `test(teams): cover invite and membership edge cases`
- PR title template: `UR9-UR9c: team lifecycle, invites, and roster integrity`
- PR description template:
  - Summary: teams, invites, membership rules, leadership transfer, ineligibility handling
  - Testing: lint, team tests, manual roster management checks
  - Docs: DB doc updated for memberships and roster constraints

## Definition of Done

- teams behave predictably before and after registration with explicit roster lock transitions
- invite and leadership rules are deterministic and tested
- later competition registration and arena features can trust team-state integrity without route or entity renaming
