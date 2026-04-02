# 14 - Leaderboard History

- Feature branch: `feature/leaderboard-history`
- Requirement mapping: UR15, UR16 — leaderboard publication, participant history, organizer archives, immutable result views, and exports
- Priority: 14
- **Assigned to:** Abenoja, Jaaseia Gian R. and Mabansag, Vj

## Mission

Build competition leaderboards, leaderboard publication controls, participant and organizer history archives, and export workflows for completed competitions.

This branch exists because post-competition surfaces are not just read-only lists. They depend on publication rules, ranking logic, immutable snapshots, and exportable results for organizers.

Depends on: `10-competition-search`, `13-review-submission`.

Unblocks: notifications, operational monitoring, release readiness.

## Full Context

- Business context: results and history are a core trust signal for both participants and organizers.
- User roles: mathletes view personal history and published leaderboards; organizers view competition history and export results; admins review if needed.
- UI flow: leaderboard page, publish leaderboard action, mathlete history, organizer history, export trigger.
- Backend flow: leaderboard refresh, publication state transition, history queries, export-job creation and file delivery.
- Related tables/functions: `leaderboard_entries`, `competition_events`, `competition_attempts`, `competition_registrations`, `export_jobs`, `notifications`.
- Edge cases: unpublished scheduled competition, open competition real-time results, regraded scores after disputes, large export sizes, tie-breaker changes after publish.
- Security concerns: unpublished results must stay hidden from participants; export downloads must be scoped to competition owners or admins.
- Performance concerns: leaderboard rendering and history queries need pagination and possibly virtualization; exports should run asynchronously if large.
- Accessibility/mobile: leaderboards and history tables need mobile fallbacks and row highlighting that does not rely only on color.

## Research Findings / Implementation Direction

- Treat `leaderboard_entries` as the read-optimized output and refresh it through trusted backend logic.
- Use publication state, not client heuristics, to decide whether scheduled competition results are visible.
- Separate participant history and organizer archive queries to avoid overfetching unrelated data.
- Use export jobs plus storage delivery if exports can become long-running.

## Requirements

- live or published leaderboard page with correct visibility rules
- organizer-only publish leaderboard action for scheduled competitions
- mathlete history page with competition summaries and answer-key links
- organizer history page with archive metrics and export actions
- trusted export generation for CSV and XLSX

## Atomic Steps

1. Build the leaderboard page using `leaderboard_entries`.
2. Add organizer leaderboard publication controls and event logging.
3. Build the mathlete history page with score, rank, and status summaries.
4. Build the organizer history page with participant counts, dispute counts, and export entry points.
5. Implement export jobs and file delivery.
6. Add tests for visibility rules, publication flow, and history-query helpers.

## Key Files

- `app/competition/[id]/leaderboard/page.tsx` or equivalent
- `app/mathlete/history/page.tsx`
- `app/organizer/history/page.tsx`
- `components/leaderboard/*`
- `components/history/*`
- `lib/leaderboard/*`
- `lib/exports/*`
- `tests/leaderboard/*`

## Verification

- Manual QA: view open competition leaderboard, keep scheduled leaderboard hidden until publish, publish results, view history as mathlete and organizer, export results.
- Automated: visibility and publication helper tests, export-job tests where practical.
- Accessibility: sortable or paginated tables remain keyboard-safe and understandable on mobile.
- Performance: leaderboard and history pages use pagination and do not overfetch.
- Edge cases: recalculated scores after disputes, large export requests, tied ranks.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(leaderboard): add leaderboard page and visibility rules`
  - `feat(history): add mathlete and organizer archive pages`
  - `feat(exports): implement competition result export jobs`
  - `test(leaderboard): cover publication and history helpers`
- PR title template: `UR15-UR16: leaderboard publication, history, and exports`
- PR description template:
  - Summary: leaderboard page, publication flow, archive pages, export jobs
  - Testing: lint, leaderboard tests, manual publish and history checks
  - Docs: DB doc updated for leaderboard and export behavior

## Definition of Done

- result visibility follows competition publication rules
- participants and organizers can inspect trustworthy history surfaces
- organizers can export results without bypassing ownership boundaries
