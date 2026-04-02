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

## Full Context

- Business context: organizers need confidence and control during live competitions, especially when handling incidents.
- User roles: organizers operate the dashboard; admins may step in; participants receive downstream announcements and state changes.
- UI flow: participant list, active attempt monitor, announcements composer, pause/resume/extend controls, event timeline, detail drill-downs.
- Backend flow: registration reads, attempt summary subscriptions, competition-event writes, announcement inserts, state transitions, notification fan-out.
- Related tables/functions: `competition_registrations`, `competition_attempts`, `tab_switch_logs`, `competition_announcements`, `competition_events`, `notifications`.
- Edge cases: paused open competition with active attempts, extending a competition while users are active, organizer reconnecting to stale monitoring state, announcement sent to withdrawn users accidentally.
- Security concerns: only owning organizers or admins can issue live controls; live data must be competition-scoped.
- Performance concerns: monitoring views need targeted subscriptions and summarized queries, not row-by-row client storms.
- Accessibility/mobile: monitoring is primarily desktop-oriented but still needs safe tablet fallback and keyboard operability.

## Research Findings / Implementation Direction

- Use summarized active-attempt queries plus targeted realtime updates instead of naive full-table subscriptions.
- Keep competition state changes event-driven and record every pause, resume, extend, or publish action in `competition_events`.
- Announcements should write durable records first, then fan out to realtime and notifications.
- Monitoring tables need explicit risk indicators and filters so organizers can act quickly under pressure.

## Requirements

- participants list with search, filters, and registration-state context
- active-attempt monitoring with score, time, and offense indicators
- organizer announcement broadcast for the current competition
- pause, resume, and extend controls with audit trail
- trusted attempt reset for legitimate disconnection cases
- event timeline for lifecycle and intervention actions

## Atomic Steps

1. Build the participants list view with search and registration-state filters.
2. Build the live attempt monitor with active time, offense count, and current progress summaries.
3. Add announcement composer and delivery flow.
4. Add trusted pause, resume, extend, and legitimate-disconnection attempt reset controls with confirmation UX.
5. Write competition events for every control action and surface them in a timeline view.
6. Add tests for control helpers, event logging, disconnection-reset rules, and summary queries.

## Key Files

- `app/organizer/competition/[id]/participants/page.tsx` or equivalent
- `components/monitoring/*`
- `components/announcements/*`
- `lib/monitoring/*`
- `supabase/migrations/*`
- `tests/monitoring/*`

## Verification

- Manual QA: view participants, watch a live attempt, send announcements, pause and resume, extend duration, and inspect the event timeline.
- Automated: trusted control helper tests, event-log helper tests, summary-query coverage.
- Accessibility: controls and tables are keyboard operable, announcements are labeled, and state changes are readable.
- Performance: subscriptions are scoped by competition and use summarized datasets.
- Edge cases: extending during active attempts, paused open competition behavior, withdrawn or ineligible participants in the list.

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
- monitoring data is ready for final release verification
