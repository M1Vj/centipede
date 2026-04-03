# 11 - Arena

- Feature branch: `feature/arena`
- Requirement mapping: UR14, UR14a, UR14b, UR14c — competition entry, rules acknowledgement, trusted timing, autosave, math answering, navigation, and reconnect-safe resume
- Priority: 11
- **Assigned to:** Mabansag, Vj

## Mission

Implement the live competition arena where mathletes actually compete. This includes trusted arena entry, rules acknowledgement, server-side timing, autosave, problem navigation, answer status flagging, visual math input, and reconnect-safe resume behavior.

This branch exists because the arena is the product's highest-risk surface. It combines timing, answer persistence, UX clarity, and fairness rules. The rebuild must treat those concerns as one synchronized runtime feature.

Depends on: `07-scoring-system`, `08-competition-wizard`, `10-competition-search`.

Unblocks: anti-cheat, submission/review, leaderboards, monitoring.

## Full Context

- Business context: the arena is where trust in the platform is won or lost.
- User roles: mathletes and team participants primarily; organizers and admins consume indirect live state through monitoring later.
- UI flow: pre-entry gate, rules acknowledgement, arena shell, problem list, current problem, answer editor, timer, question status grid, review entry point.
- Backend flow: attempt creation, active-interval tracking, autosave answer writes, server-side remaining-time calculation, resume entry after disconnect.
- Related tables/functions: `competition_attempts`, `attempt_intervals`, `attempt_answers`, `competition_problems`, `competition_registrations`.
- Edge cases: exact start-time gating, expired entry, reconnect during active attempt, open competition re-attempt, autosave failure, timer expiry mid-edit.
- Security concerns: attempt creation and resume must be trusted and registration-bound; time left must not be client-authoritative.
- Performance concerns: autosave must be debounced and resilient; problem loading should avoid re-fetching everything on every answer change.
- Accessibility/mobile: math editor, navigation grid, timer, and submission affordances must remain usable on tablets and phones.

## Research Findings / Implementation Direction

- Keep server-side timing authoritative using server clock and trusted deadline fields; reconnect or offline gaps still consume remaining time.
- Persist answers incrementally with debounced trusted writes so users do not lose work on disconnect.
- Use a status model of `blank`, `filled`, `solved`, and `reset` to support the navigation grid and review flow.
- Treat resume after disconnect as a first-class flow, distinct from anti-cheat focus loss.

## Answer-State and Timing Contract (Deterministic)

### Answer-State Contract

- Source of truth for review counts and navigator badges is `attempt_answers.status_flag`, not unsaved client-only state.
- Allowed states are exactly: `blank`, `filled`, `solved`, `reset`.
- `reset` clears answer payload fields and is preserved as a distinct persisted state for branch `13` review summaries.
- Branch `13` must consume the same persisted status set without remapping names.

### Timing Contract

- Remaining time is computed only on trusted backend paths as `max(0, min(attempt_deadline_at, competition_end_at_for_scheduled) - server_now)`; client clocks are display-only.
- `attempt_deadline_at` is fixed when the attempt starts and must never be extended by refresh, reconnect, or interval reopen actions.
- Offline or disconnected periods still consume time because `server_now` advances while the same immutable deadline remains in force.
- `attempt_intervals` record connectivity windows (`started_at`, `ended_at`) for audit and resume authorization only; interval duration must never be used to pause, restore, or grant extra time.
- Timer expiry triggers a trusted attempt transition to `auto_submitted` and immediate UI lock.

## Requirements

- gate arena entry by competition status, schedule, registration, and attempt eligibility
- show rules acknowledgement before starting, including explicit device-responsibility acknowledgements for notifications and sleep settings
- render snapshotted problems with KaTeX and use MathLive for editable numeric and identification answer inputs
- autosave answers and persist `attempt_answers.status_flag` as `blank`, `filled`, `solved`, or `reset`
- show authoritative remaining time
- allow reconnect and resume without inventing extra time
- auto-submit current answers when the timer reaches zero
- support open-competition attempt restarts only through explicit grading policy rules

### Canonical Arena Route Contract (Strict)

- Arena entry and runtime route is exactly `/mathlete/competition/[competitionId]`.
- Branch `11` may add nested subroutes under that segment only; alias or equivalent arena root paths are prohibited.

## Atomic Steps

1. Build the pre-entry page with eligibility checks, rules acknowledgement, and explicit device-responsibility acknowledgement checkboxes.
2. Implement trusted `start_competition_attempt` and `resume_competition_attempt` flows.
3. Build the arena shell with timer, navigation grid, problem viewport, and answer panel.
4. Integrate MathLive for numeric and identification answers with symbol-toolbox support, render static math with KaTeX, and handle MCQ and TF cleanly.
5. Add debounced autosave for `attempt_answers` through the trusted save path and keep status-flag writes deterministic.
6. Implement solved and reset status flagging and reflect it in the question navigator.
7. Track interval `started_at`/`ended_at` transitions on entry, resume, and exit for auditability and reconnect authorization only; never use interval duration to extend deadlines.
8. Handle timer expiry through a trusted transition to `auto_submitted` with immediate UI lock.
9. Add tests for interval math, answer-state helpers, and any extracted server calculations.

## Key Files

- `app/mathlete/competition/[competitionId]/page.tsx`
- `app/mathlete/competition/[competitionId]/layout.tsx`
- `components/arena/*`
- `lib/arena/*`
- `supabase/migrations/*`
- `tests/arena/*`

## Verification

- Manual QA: enter a live or open competition, answer different problem types, refresh or disconnect then resume, watch timer behavior, let the timer expire.
- Automated: timer and interval helper tests, answer-state tests, trusted attempt start/resume helper tests.
- Accessibility: keyboard-safe problem navigation, timer announcements using aria-live, labeled answer controls.
- Performance: autosave is debounced, answer changes do not freeze navigation, problem snapshots are not repeatedly re-fetched.
- Edge cases: start-time boundary, timer expiry during network lag, reconnect after browser crash, open competition with remaining attempts.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(arena): add trusted entry and attempt lifecycle helpers`
  - `feat(arena): build timer navigation and problem shell`
  - `feat(arena): add autosave and answer status handling`
  - `test(arena): cover timing and resume helpers`
- PR title template: `UR14-UR14c: arena entry, timing, autosave, and math answering`
- PR description template:
  - Summary: arena entry, timer, answer input, autosave, resume behavior
  - Testing: lint, arena helper tests, manual live session checks
  - Docs: DB doc updated for attempts, intervals, and answer-state rules

## Definition of Done

- participants can complete a competition attempt without losing work unfairly
- timing is trusted and reconnect-safe
- the arena state model is ready for anti-cheat and review flows
