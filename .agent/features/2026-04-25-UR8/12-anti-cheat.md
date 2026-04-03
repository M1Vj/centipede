# 12 - Anti-Cheat

- Feature branch: `feature/anti-cheat`
- Requirement mapping: UR8, supporting UR14 — focus-loss detection, offense logging, penalties, organizer-visible anti-cheat logs, and fair reconnect handling
- Priority: 12
- **Assigned to:** Mabansag, Vj

## Mission

Implement browser-focus monitoring, offense logging, organizer-visible tab-switch logs, warning overlays, penalty application, and deterministic differentiation between focus-loss cheating events and trusted reconnect scenarios.

This branch exists because anti-cheat cannot be a generic event listener. It affects grading, monitoring, user messaging, and dispute defensibility. Offense tracking must be treated as auditable product behavior.

Depends on: `11-arena`.

Unblocks: review/submission fairness, live monitoring, trustworthy leaderboards.

## Full Context

- Business context: competitions need integrity controls without incorrectly penalizing trusted reconnect cases.
- User roles: mathletes experience warnings and penalties; organizers monitor offenses; admins may review logs during incidents.
- UI flow: offense overlay, warning acknowledgement, penalty messaging, organizer log views.
- Backend flow: tab-switch log insertions, offense count increments, penalty application, attempt status transitions for auto-submit or disqualification.
- Related tables/functions: `tab_switch_logs`, `competition_attempts`, `competition_events`, grading penalty rules.
- Edge cases: mobile phone interruption, browser crash, network disconnect vs focus loss, offense during final seconds, multiple tabs open.
- Security concerns: offense count and penalty state must be server-trusted; clients only report focus events.
- Performance concerns: avoid noisy over-logging and redundant realtime fan-out.
- Accessibility/mobile: the overlay must be readable, keyboard operable, and explicit about consequences.

## Research Findings / Implementation Direction

- Keep the client responsible only for reporting focus-loss signals; the server determines offense number and penalty.
- Distinguish reconnect flows from focus-loss penalties using attempt interval transitions and explicit resume helpers.
- Record every offense event with enough metadata to support organizer review and later disputes.
- Apply penalties through trusted backend logic so score deductions and disqualifications remain consistent with branch 07 grading rules.

## Anti-Cheat Event Contract (Deterministic)

- Offense writes must execute only through trusted `log_tab_switch_offense(attempt_id, metadata_json)`.
- `tab_switch_logs` rows must preserve server-authored `offense_number`, `penalty_applied`, and `logged_at`; payload key `metadata_json.client_timestamp` is required and maps to nullable `tab_switch_logs.client_timestamp` (value may be `null`).
- Required `metadata_json` keys for deterministic review and dispute evidence: `event_source`, `visibility_state`, `route_path`, `user_agent`, and `client_timestamp`.
- `metadata_json.client_timestamp` must be ISO-8601 when non-null; `null` is valid when client time is unknown.
- Penalty decisions must read immutable publish-time policy (`competitions.scoring_snapshot_json` and `offense_penalties_json`), not mutable draft state.
- Reconnect entry through `resume_competition_attempt` and interval reopen flows must not create offenses unless an explicit focus-loss signal was recorded.
- Forced penalties must map to trusted attempt transitions:
  - warning or deduction: keep attempt `in_progress`
  - forced submit: set attempt to `auto_submitted` once and close active interval
  - disqualification: set attempt to `disqualified` once and close active interval
- Organizer and admin monitoring surfaces must read trusted projections of offense data, not client-side counters.

## Requirements

- detect focus loss while the arena is active
- block interaction until the user acknowledges the warning overlay
- apply warning, deduction, or auto-submit/disqualification according to competition rules
- log each offense with deterministic server-authored offense number, penalty result, and audit metadata
- avoid treating normal reconnect flows as cheating automatically
- surface organizer-facing offense counts and details for live monitoring

## Atomic Steps

1. Add client-side `visibilitychange`, `focus`, and `blur` listeners scoped to active arena attempts.
2. Build the full-screen warning overlay and acknowledgement flow.
3. Implement a trusted `log_tab_switch_offense` backend path that increments offense count, writes deterministic log fields, and returns the resulting penalty.
4. Apply score deduction, forced submission, or disqualification behavior from immutable publish-time anti-cheat policy.
5. Distinguish reconnect-resume events from focus-loss penalties in server logic, including one-way status transitions and interval closure guards.
6. Expose offense counts and logs to organizer and admin readers through trusted queries.
7. Add tests for offense escalation, penalty application, and reconnect exception logic.

## Key Files

- `components/arena/*`
- `components/anti-cheat/*`
- `lib/anti-cheat/*`
- `supabase/migrations/*`
- `tests/anti-cheat/*` (planned suite; create before enforcing suite-specific verification)

## Verification

- Manual QA: trigger focus loss, acknowledge warnings, hit penalty thresholds, verify overlay and resulting attempt state.
- Automated: escalation and reconnect-exception tests.
- Accessibility: overlay focus handling, messaging clarity, and keyboard acknowledgement flow.
- Performance: offense logging is debounced enough to avoid duplicates from noisy browser events.
- Edge cases: browser crash vs focus switch, late-stage offense, open competition with future attempts remaining.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(anti-cheat): add focus-loss detection and warning overlay`
  - `feat(anti-cheat): implement offense logging and penalty escalation`
  - `feat(anti-cheat): expose organizer-facing offense summaries`
  - `test(anti-cheat): cover reconnect and penalty rules`
- PR title template: `UR8: anti-cheat logging, penalties, and warning flows`
- PR description template:
  - Summary: focus-loss detection, overlay, offense logs, penalty handling
  - Testing: lint, anti-cheat tests, manual offense simulation
  - Docs: DB doc updated for tab-switch logs and penalty rules

## Definition of Done

- focus-loss events are visible, trusted, and auditable
- penalties are applied consistently with competition configuration
- organizer monitoring can rely on the logged data later
