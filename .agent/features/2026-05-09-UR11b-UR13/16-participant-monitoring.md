# 16 - Participant Monitoring

- Feature branch: `feature/participant-monitoring`
- Requirement mapping: UR13, operational completion for UR8 and live competition controls — live participant monitoring, announcements, pause/resume/extend controls, and organizer intervention tooling
- Priority: 16
- **Assigned to:** Mabansag, Vj

## Mission

Build the organizer live-operations surface for participant lists, active attempt monitoring, announcements, pause/resume/extend controls, and competition event timelines.

This branch exists because participant monitoring is not only a table of registrants. It is the organizer's control room for the live event and must reflect attempt state, offenses, announcements, and lifecycle controls in one coherent surface.

Depends on: `08-competition-wizard`, `12-anti-cheat`, `15-notifications-polish`.

Unblocks: final QA and release readiness.

## Scope Boundary

- Do not redefine lifecycle states, transition rules, or publish guards from branch `08-competition-wizard`.
- Do not implement offense detection, escalation policy, or penalty logic from branch `12-anti-cheat`.
- Do not reimplement notification inbox, preference infrastructure, or channel-specific delivery rules from branch `15-notifications-polish`; consume branch 15 dispatch helpers.
- Do not change submission, grading, dispute-resolution, or leaderboard-publication ownership from branches `13-review-submission` and `14-leaderboard-history`.
- Do not emit publish domain events in this branch; branch `08-competition-wizard` owns competition publish-state events and branch `14-leaderboard-history` owns leaderboard publication events.
- Do not grant admin resume, extend, or disconnect-reset controls in this branch contract; admin live support is force-pause only via trusted moderation paths.
- This branch owns operator-facing monitoring views, trusted invocation of live controls, and durable event timeline visibility.

## Full Context

- Business context: organizers need confidence and control during live competitions, especially when handling incidents.
- User roles: organizers operate the dashboard; admins may step in; participants receive downstream announcements and state changes.
- UI flow: participant list, active attempt monitor, announcements composer, pause/resume/extend controls, event timeline, detail drill-downs.
- Backend flow: registration reads, attempt summary subscriptions, competition-event writes, announcement inserts, trusted live-control state transitions, disconnection-reset helpers, and invocation of branch 15 notification fan-out.
- Related tables/functions: `competition_registrations`, `competition_attempts`, `tab_switch_logs`, `competition_announcements`, `competition_events`, `notifications`.
- Edge cases: paused open competition with active attempts, extending a competition while users are active, organizer reconnecting to stale monitoring state, announcement sent to withdrawn users accidentally.
- Security concerns: owning organizers issue open-competition pause plus organizer-owned resume, extend, and legitimate-disconnection reset controls; admins can force-pause live competitions for incidents through trusted moderation paths only; live data must be competition-scoped.
- Performance concerns: monitoring views need targeted subscriptions and summarized queries, not row-by-row client storms.
- Accessibility/mobile: monitoring is primarily desktop-oriented but still needs safe tablet fallback and keyboard operability.

## Research Findings / Implementation Direction

- Use summarized active-attempt queries plus targeted realtime updates instead of naive full-table subscriptions.
- Keep competition state changes event-driven and record every pause, resume, extend, or legitimate-disconnection-reset action in `competition_events`.
- Treat publish-domain events as read-only inputs in this branch.
- Announcements should write durable records first, then invoke shared branch 15 delivery helpers for realtime and notification fan-out.
- Monitoring tables need explicit risk indicators and filters so organizers can act quickly under pressure.

## Announcement Producer/Consumer Contract

- Branch 16 is the producer for organizer-authored announcements by writing durable `competition_announcements` rows and associated organizer metadata.
- Branch 15 is the consumer for channel delivery behavior, inbox projection, and preference-aware dispatch based on durable announcement records.
- Executable dependency model follows `.agent/PROCESS-FLOW.md`: branch `15` lands shared delivery helpers first; branch `16` then lands announcement authoring that calls those helpers.
- Branch 16 announcement flow writes the durable record first, then calls branch 15 dispatch helpers using the same stable event identity payload for retries.
- Branch 16 must not add separate channel-specific delivery guarantees.

## Route Naming Contract (Deterministic)

- Organizer monitoring route: `/organizer/competition/[competitionId]/participants`.
- Admin live-support route: `/admin/competitions/[competitionId]/participants`.
- Monitoring UI tabs must use query contract `?tab=participants|announcements|timeline`.
- Control actions must preserve route state and return to the same route context after confirmation.

## Live Control Safety Guard Contract

- Allowed actors and actions:
  - owning organizer: open-competition pause, resume, extend, and legitimate-disconnection reset
  - admin: incident force-pause only on live competitions through trusted moderation path and separate moderation delete path; never resume, extend, or disconnect-reset
- Guard rules:
  - organizer pause is allowed only for `open` competitions when competition state is `live`; it blocks new attempt starts while allowing already-active attempts to finish
  - admin force-pause for incidents is allowed only when competition state is `live` and may target any live competition type
  - resume is organizer-only and allowed only when competition state is `paused`
  - extend is organizer-only and allowed only when competition state is `live` or `paused`
  - disconnection reset is organizer-only and allowed only for eligible active attempts that are not already finalized

### Legitimate Disconnection Reset Criteria (Objective)

1. Eligible active-attempt gate: `reset_attempt_for_disconnect` is allowed only when the target attempt is active in the same competition scope and not finalized (`submitted`, `auto_submitted`, `graded`, and `disqualified` are ineligible).
2. Recent-evidence gate: a trusted disconnect evidence signal must exist within a bounded recency window before the reset request.
3. Duplicate-reset gate: deny reset when the same `attempt_id` already has a successful disconnect reset within the bounded cooldown window.
4. Required request tuple gate: both non-empty `reason` and `request_idempotency_token` are mandatory; missing either must fail validation.
5. Audit-evidence gate: every reset decision must persist auditable evidence metadata in `competition_events`, including `attempt_id`, `disconnect_evidence_type`, `disconnect_evidence_observed_at`, `disconnect_evidence_ref`, `reason`, `request_idempotency_token`, actor identity, and decision outcome.

- Every control action must require explicit confirmation.
- Canonical control tuple for pause, resume, extend, and disconnect reset is `(reason, request_idempotency_token)`; both are required and `reason` must be non-empty.
- Reason capture follows canonical RPC signatures:
  - `pause_competition(competition_id, reason, request_idempotency_token)` requires non-empty `reason`; admin live support remains force-pause only through trusted moderation path
  - `resume_competition(competition_id, reason, request_idempotency_token)` requires non-empty `reason`
  - `extend_competition(competition_id, additional_minutes, reason, request_idempotency_token)` requires non-empty `reason`
  - `reset_attempt_for_disconnect(attempt_id, reason, request_idempotency_token)` requires non-empty `reason`
- Every control action must write one durable `competition_events` row with actor, action, and before or after state metadata, including `request_idempotency_token` and required reason fields.
- Every control action request must include `request_idempotency_token`.
- Control invocations must dedupe by `(competition_id, event_type, actor_user_id, request_idempotency_token)` so retried requests do not create duplicate state transitions or duplicate `competition_events` rows.

## Competition Control Idempotency Key Contract

- Required token: `request_idempotency_token` on every pause, resume, extend, and legitimate-disconnection-reset request.
- Control-event dedupe key: `(competition_id, event_type, actor_user_id, request_idempotency_token)`.
- Retry behavior: repeated requests with the same token must return the original outcome and must not append a second control-event row.

## Requirements

- implement organizer monitoring route `/organizer/competition/[competitionId]/participants` and admin route `/admin/competitions/[competitionId]/participants`
- implement participant list with search, filters, and registration-state context
- implement active-attempt monitoring with score, time, and offense indicators
- implement organizer announcement broadcast for the active competition scope by writing durable announcement records and invoking shared branch 15 dispatch helpers
- implement organizer-owned open-competition pause plus organizer-owned resume, extend, and legitimate-disconnection reset controls with mandatory confirmation, canonical reason-capture rules, and objective disconnect-reset legitimacy criteria
- implement admin live-support hooks for trusted force-pause only, reusing the same guard and event contracts
- implement durable event timeline for lifecycle and intervention actions from `competition_events`
- enforce canonical control tuple (`reason`, `request_idempotency_token`) and idempotent dedupe behavior using `(competition_id, event_type, actor_user_id, request_idempotency_token)`

## Atomic Steps

1. Build `/organizer/competition/[competitionId]/participants` with deterministic participants, announcements, and timeline tab states.
2. Build `/admin/competitions/[competitionId]/participants` as a live-support view that reuses the same trusted monitoring queries and trusted force-pause moderation helper.
3. Add participant list search and registration-state filters with competition-scoped reads.
4. Add live attempt summaries with active time, offense counts, and progress indicators.
5. Add announcement composer flow that writes durable announcement records before invoking shared branch 15 fan-out helpers.
6. Add trusted organizer-owned open-competition pause plus organizer-owned resume, extend, and legitimate-disconnection reset controls that enforce lifecycle guards, canonical reason-capture behavior, objective disconnect-reset legitimacy criteria, and confirmation requirements.
7. Write one `competition_events` row per control action and render timeline entries in chronological order.
8. Add tests for control guards, idempotency-token dedupe behavior, event logging, disconnection-reset legitimacy rules (active and non-finalized gate, recent-evidence gate, bounded-window duplicate prevention), and summary queries.

## Key Files

- `app/organizer/competition/[competitionId]/participants/page.tsx`
- `app/admin/competitions/[competitionId]/participants/page.tsx`
- `components/monitoring/*`
- `components/announcements/*`
- `lib/monitoring/*`
- `supabase/migrations/*`
- `tests/monitoring/*`

## Verification

- Command verification (all commands must exit 0): `npm run lint`, `npm run test -- tests/monitoring`, `npm run build`.
- Dev-server smoke verification (long-running): start `npm run dev`, probe `/organizer/competition/[competitionId]/participants` and `/admin/competitions/[competitionId]/participants`, then intentionally stop the process and capture probe evidence.
- Migration verification when `supabase/migrations/*` changes: `npm run supabase:status` and `npm run supabase:db:reset`.
- Route probe verification during smoke run: `/organizer/competition/[competitionId]/participants` and `/admin/competitions/[competitionId]/participants` load with correct role guards and stable tab query handling.
- Manual QA: view participants, watch live attempts, send announcements, run organizer pause/resume/extend/reset flows, verify admin force-pause only behavior, and inspect timeline entries for every control action.
- Automated: trusted control helper tests, event-log helper tests, idempotency checks, and summary-query coverage.
- Accessibility: controls and tables are keyboard operable, announcements are labeled, and state changes are readable.
- Performance: subscriptions remain competition-scoped and use summarized datasets.
- Edge cases: extend during active attempts, paused-open behavior, withdrawn or ineligible participants, and retried control requests.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(monitoring): add participant list and active attempt summaries`
  - `feat(monitoring): add announcements and live control actions`
  - `feat(monitoring): add competition event timeline`
  - `test(monitoring): cover live control and event helpers`
- PR title template: `UR13: participant monitoring and live organizer controls`
- PR description template:
  - Summary: participant list, active monitoring, announcements, pause/resume/extend, event timeline
  - Testing: lint, monitoring tests, manual live-control checks
  - Docs: DB doc updated for event and monitoring behavior

## Definition of Done

- organizers can observe and control live competitions without leaving the product
- live control actions are durable and auditable
- admin live support is limited to trusted force-pause while organizer-owned controls remain organizer-only
- monitoring controls enforce explicit safety guards and idempotent behavior
- monitoring data is ready for final release verification
