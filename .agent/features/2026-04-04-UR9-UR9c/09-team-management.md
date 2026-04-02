# 09 - Team Management

- Feature branch: `feature/team-management`
- Requirement mapping: UR9, UR9a, UR9b, UR9c — team creation, invites, roster rules, leadership transfer, and ineligibility handling
- Priority: 9
- **Assigned to:** Mabansag, Vj

## Mission

Implement the complete team system for team competitions, including team creation, invite workflows, roster management, leadership transfer, registration lock behavior, and automatic ineligibility handling when a roster becomes invalid.

This branch exists because the old spec describes team participation as a user-facing feature, but the real complexity is in roster integrity rules and how those rules interact with registrations and later competition attempts.

Depends on: `02-authentication`, `03-interaction-feedback`.

Unblocks: team competition registration, team arena participation, participant monitoring.

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
- accept/decline and revoke invite behavior
- remove member, leave team, and automatic leadership transfer
- enforce competition-specific roster lock and eligibility rules
- notify leaders when a roster becomes invalid after registration

## Atomic Steps

1. Build the team list and team create flow.
2. Implement memberships, invite creation, and invite response handling.
3. Add username search and team-code invite entry.
4. Build roster management actions for leaders and members.
5. Implement automatic leadership transfer when the current leader leaves or is removed.
6. Integrate registration-aware roster lock and conflict checks.
7. Add ineligibility handling and leader notifications when a registered team drops below minimum requirements.
8. Add tests for membership validation, leadership transfer, and invite acceptance rules.

## Key Files

- `app/mathlete/teams/page.tsx` or equivalent portal route
- `components/teams/*`
- `lib/teams/*`
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

- teams behave predictably before and after registration
- invite and leadership rules are deterministic and tested
- later competition registration and arena features can trust team-state integrity
