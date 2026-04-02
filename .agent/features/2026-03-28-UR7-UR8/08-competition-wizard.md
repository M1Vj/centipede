# 08 - Competition Wizard

- Feature branch: `feature/competition-wizard`
- Requirement mapping: UR7, UR7a, UR7b, part of UR8 — competition creation, schedule and format setup, publish safety, anti-cheat configuration, and organizer lifecycle controls
- Priority: 8
- **Assigned to:** Mabansag, Vj

## Mission

Build the end-to-end competition creation and lifecycle system for organizers. This includes draft creation, schedule and format configuration, problem selection, scoring and anti-cheat configuration, publish safety, and organizer controls for open and scheduled competitions.

This branch exists because the wizard is the structural center of the product. It owns publish rules, snapshots, defensive validation, and the lifecycle that live monitoring, registration, and leaderboards depend on.

Depends on: `06-problem-bank`, `07-scoring-system`.

Unblocks: team registration, discovery, arena, monitoring, leaderboard publication.

## Full Context

- Business context: organizers need a safe way to create high-stakes competitions without accidental publish or invalid configuration.
- User roles: organizers as authors, admins as overseers, mathletes as downstream consumers of published output.
- UI flow: overview page, schedule page, format page, problems and scoring page, anti-cheat page, review and publish page.
- Backend flow: draft persistence, snapshotting competition problems, publish transition, lifecycle events, deletion rules, pause and resume support.
- Related tables/functions: `competitions`, `competition_problems`, `competition_events`, grading rule helpers, problem snapshots.
- Edge cases: duplicate competition names, invalid registration windows, open competition with scheduled-only options, deleting active open competition, editing a published competition.
- Security concerns: only the owning organizer or trusted admin can mutate drafts; publish must be a trusted action; snapshots must be immutable.
- Performance concerns: problem selection and preview must remain fast even with larger banks; drafts should autosave without expensive full-page invalidation.
- Accessibility/mobile: multi-step wizard needs explicit step navigation, save states, summary affordances, and mobile-safe actions.

## Research Findings / Implementation Direction

- Save competition drafts incrementally so organizers can leave and resume without losing work.
- Snapshot problem content at publish time, not at authoring time, so drafts stay editable while published competitions stay immutable.
- Model competition lifecycle with explicit `status` values and event logs rather than boolean-only fields.
- Put destructive controls behind eligibility checks and confirmations so organizers cannot accidentally publish or delete invalid state.

## Requirements

- support scheduled and open competition types
- support individual and team formats with their validation rules, including team mode as scheduled-only
- validate registration window, start time, duration, and attempt rules
- enforce open-competition attempt count between one and three
- allow organizer problem selection with whole-bank and filtered pick strategies
- require between 10 and 100 selected problems before publish
- configure scoring, penalties, shuffling, anti-cheat, and multiple-attempt grading
- require a summary review and defensive confirmation before publish
- block duplicate competition names for the same organizer across unsafe lifecycle states
- block invalid edits or deletes for live and historically significant competitions

## Atomic Steps

1. Build the organizer competition list and draft-create entry point.
2. Implement the multi-step wizard with persistent draft state.
3. Add the overview and schedule steps with strong date/time validation.
4. Add the format step with individual vs team and scheduled vs open rules, including scheduled-only team enforcement and open-attempt limits.
5. Add the problem selection step with bank browsing, filter/search, selected problem ordering, and the 10-to-100 problem guardrail.
6. Add scoring and anti-cheat configuration steps using the rules from branch 07.
7. Add the review and publish step with full validation summary, edit jump-links, and explicit confirmation.
8. Snapshot selected problems into `competition_problems` at publish time.
9. Implement organizer controls for draft edit, publish, pause/resume, safe delete, and later extension hooks.
10. Record `competition_events` for publish and major lifecycle actions.

## Key Files

- `app/organizer/competition/page.tsx`
- `app/organizer/competition/create/page.tsx`
- `app/organizer/competition/[id]/page.tsx`
- `components/competition-wizard/*`
- `lib/competition/*`
- `supabase/migrations/*`
- `tests/competition/*`

## Verification

- Manual QA: create both scheduled and open competitions, switch formats, publish valid drafts, reject invalid drafts, and test safe delete/pause behavior.
- Automated: extracted validation helpers and snapshot logic tests.
- Accessibility: step navigation, summary review, error messaging, and confirmation dialogs are keyboard-safe.
- Performance: draft saving and problem selection remain responsive with larger banks.
- Edge cases: duplicate names, invalid time windows, format switching after selected problems, deleting active open competitions.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(competition): add organizer competition workspace and drafts`
  - `feat(competition): implement wizard schedule and format steps`
  - `feat(competition): add problem selection scoring and anti-cheat steps`
  - `feat(competition): add review publish and lifecycle controls`
- PR title template: `UR7-UR8: competition wizard, snapshots, and lifecycle controls`
- PR description template:
  - Summary: competition drafts, wizard steps, snapshotting, publish safety, lifecycle actions
  - Testing: lint, validation tests, manual scheduled/open competition flows
  - Docs: DB doc updated for competition lifecycle and snapshot rules

## Definition of Done

- organizers can create valid competitions without unsafe manual workarounds
- published competitions carry immutable problem snapshots
- lifecycle actions are explicit, audited, and compatible with future live monitoring
