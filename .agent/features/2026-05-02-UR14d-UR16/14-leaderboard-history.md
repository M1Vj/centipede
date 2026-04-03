# 14 - Leaderboard History

- Feature branch: `feature/leaderboard-history`
- Requirement mapping: UR15, UR16 — leaderboard publication visibility, dispute-resolution follow-through, recalculation semantics, participant and organizer history, immutable result views, and exports
- Priority: 14
- **Assigned to:** Abenoja, Jaaseia Gian R. and Mabansag, Vj

## Mission

Build competition leaderboards, leaderboard publication controls, organizer dispute-resolution and recalculation follow-through, participant and organizer history archives, immutable result views, and export workflows for completed competitions.

This branch exists because post-competition surfaces are not just read-only lists. They depend on explicit visibility contracts, ranking logic, immutable snapshots, dispute resolution, recalculation follow-through, and exportable results for organizers.

All contracts in this document are intentionally explicit so a blank-slate implementer can execute branch 14 without relying on unstated assumptions.

Depends on: `10-competition-search`, `13-review-submission`.

Unblocks: notifications, operational monitoring, release readiness.

## Dependency Gate (Explicit)

- Branch `07-scoring-system` must already provide trusted RPCs and immutable scoring snapshot behavior: `recalculate_competition_scores(competition_id, request_idempotency_token)` and `refresh_leaderboard_entries(competition_id)`.
- Branch `10-competition-search` route/entity naming is canonical for competition detail paths and downstream route params.
- Branch `13-review-submission` owns answer-key visibility and dispute submission. Branch 14 owns organizer dispute resolution, recalculation, and history/export surfaces.
- Answer-key visibility remains independent of leaderboard publication. Do not merge or proxy one rule through the other.

## Full Context

- Business context: results and history are a core trust signal for both participants and organizers.
- User roles: mathletes view personal history and published leaderboards; organizers view competition history and export results; admins review if needed.
- UI flow: mathlete leaderboard view, organizer leaderboard management/publish action, organizer dispute review, mathlete history, organizer history, export trigger.
- Backend flow: leaderboard refresh, publication state transition, organizer dispute resolution, recalculation follow-through, history queries, export-job creation, and file delivery.
- Related tables/functions: `leaderboard_entries`, `competition_events`, `competition_attempts`, `competition_registrations`, `problem_disputes`, `export_jobs`.
- Edge cases: unpublished scheduled competition, open competition real-time results, regraded scores after disputes, large export sizes, tie-breaker changes after publish, and accepted disputes after publication.
- Security concerns: unpublished results must stay hidden from participants; export downloads must be scoped to competition owners or admins.
- Performance concerns: leaderboard rendering and history queries need pagination and possibly virtualization; exports should run asynchronously if large.
- Accessibility/mobile: leaderboards and history tables need mobile fallbacks and row highlighting that does not rely only on color.

## Domain Terms (No Hidden Assumptions)

- Scheduled competition: `competitions.type = 'scheduled'`.
- Open competition: `competitions.type = 'open'`.
- Leaderboard published state: `competitions.leaderboard_published = true`, transitioned by trusted `publish_leaderboard(competition_id, request_idempotency_token)`.
- Recalculation: trusted rerun of competition grading and ranking after accepted disputes or answer-key corrections.
- Immutable result view: any leaderboard/history/export surface that must use frozen competition snapshots and read-optimized leaderboard output instead of mutable authoring data.

## Research Findings / Implementation Direction

- Treat `leaderboard_entries` as the read-optimized output and refresh it through trusted backend logic.
- Use publication state, not client heuristics, to decide whether scheduled competition results are visible.
- Separate participant history and organizer archive queries to avoid overfetching unrelated data.
- Use export jobs plus storage delivery for long-running exports.

## Publication Visibility Contract (Explicit)

- Organizers and admins can view leaderboard entries for owned or moderated competitions regardless of publication state.
- Mathletes and participants follow competition-type visibility:
  - Scheduled competitions: leaderboard remains hidden until organizer runs `publish_leaderboard(competition_id, request_idempotency_token)`.
  - Open competitions: leaderboard is fully visible to participant-context readers for every non-draft open state (`published`, `live`, `paused`, `ended`, `archived`); no organizer publish gate exists for open competitions.
- Scheduled publication must be a trusted state transition with `competition_events` logging.
- `answer_key_visibility` is a separate rule from leaderboard publication and must not be inferred from `leaderboard_published`.

### Participant Leaderboard and History Visibility Matrix (Leak-Prevention)

- Scheduled competition with `leaderboard_published = false`:
  - `/mathlete/competition/[competitionId]/leaderboard` must deny/hide entries.
  - `/mathlete/history` may show competition presence and the participant's own attempt state (`competition_attempts.status`, `submitted_at`) but must not expose `rank`, `score`, `total_time_seconds`, `offense_count`, or peer aggregates.
- Scheduled competition with `leaderboard_published = true`:
  - Mathlete leaderboard and history may expose final rank/score fields from trusted `leaderboard_entries`.
- Open competition:
  - Mathlete leaderboard and history may expose full `leaderboard_entries` without organizer publish action whenever the competition is not in `draft`, still scoped to trusted participant visibility rules.
- Organizer/admin leaderboard and history views remain visible for owned or moderated competitions.

## Dispute-Resolution Follow-Through Contract

- Dispute state machine is explicit and closed:
  1. `open -> reviewing`
  2. `reviewing -> accepted`
  3. `reviewing -> rejected`
  4. `reviewing -> resolved`
- `accepted`, `rejected`, and `resolved` are terminal; no further transitions are allowed.
- Terminal meaning is explicit:
  - `accepted`: dispute is validated and may require trusted correction artifacts plus recalculation.
  - `rejected`: dispute is denied and must not create correction artifacts or run recalculation.
  - `resolved`: dispute is administratively closed without classifying it as accepted or rejected for scoring change; no correction artifacts and no recalculation.
- Any transition out of `reviewing` requires non-empty `resolution_note`, `resolved_by`, and `resolved_at`.
- Accepted disputes that affect scoring must reference an explicit trusted correction artifact record (`answer_key_override` and/or `points_override`) linked to the disputed `competition_problem_id`; immutable publish snapshots remain unchanged.
- Notification ownership boundary is strict: branch 14 emits domain events/hooks (`dispute_resolved`, `leaderboard_published`, `score_recalculated`) and branch 15 owns inbox/email fan-out and channel-preference delivery.
- Accepted-dispute follow-through sequence (trusted backend only):
  1. Resolve dispute status and persist note (`resolve_problem_dispute(..., request_idempotency_token)`).
  2. Persist/activate the trusted correction artifact record for the affected `competition_problem_id` (no mutation of immutable snapshot columns).
  3. Execute `recalculate_competition_scores(competition_id, request_idempotency_token)`.
  4. Execute `refresh_leaderboard_entries(competition_id)`.
  5. Write deterministic `competition_events` rows for `dispute_resolved` and, when applicable, `score_recalculated`, including `request_idempotency_token`, `dispute_id`, `competition_problem_id`, and `correction_artifact_ids` (array, one or more ids) for audit visibility.
  6. Emit deterministic notification hooks/domain events for branch 15 fan-out by calling the stable shared `lib/notifications/dispatch.ts` interface contract (branch 14 does not write `notifications` rows or send emails directly).
- Rejected or resolved outcomes must still log events but must not run recalculation RPCs.
- Terminal disputes must be idempotent in trusted handlers so retrying requests cannot trigger duplicate recalculation runs.

## Recalculation Semantics Contract

- Recalculation and leaderboard refresh must run only on trusted backend paths.
- Recalculation call signature is strict: `recalculate_competition_scores(competition_id, request_idempotency_token)`.
- Repeated recalculation requests with the same idempotency token must return the same trusted outcome without duplicate side effects.
- Recalculation reads immutable publish artifacts only:
  - `competitions.scoring_snapshot_json`
  - `competition_problems` snapshot fields
  - canonical persisted answers (`attempt_answers.answer_latex`)
- Accepted-dispute recalculation inputs must come from active trusted correction artifact records linked to `dispute_id` and `competition_problem_id`, not ad hoc payloads and not direct mutation of immutable snapshot columns.
- Effective per-problem points precedence during recompute is strict: active trusted `points_override` artifact value when present; otherwise `competition_problems.points`.
- Do not read mutable authoring tables (`problems`, mutable draft scoring forms) for historical recompute logic.
- If a scheduled leaderboard is already published and recalculation changes rank/score, keep publication active and update entries plus event history; do not silently unpublish.

## Immutable Result View Contract

- Leaderboard, history, dispute evidence, and export payloads must derive from immutable competition snapshots and refreshed leaderboard output.
- Use `leaderboard_entries` as read output, not as grading source of truth.
- Preserve historical integrity even when user accounts are anonymized or profile data changes after competition end.
- Tie-break ordering must follow the competition's frozen scoring/tie-breaker contract at publish time.

## Export Contract (CSV/XLSX)

- Export formats in scope: `csv`, `xlsx`.
- Export request path must enqueue work with trusted `queue_export_job(competition_id, format)`; direct client-side bulk export queries are out of scope.
- Export authorization scope is explicit and non-contradictory:
  - queue/create job: competition owner organizer or admin only
  - read status/download file: competition owner organizer, admin, or the original authorized requester for that competition
  - participants and unrelated organizers are always denied, even with a known `exportJobId`
- Export job lifecycle must support `queued`, `processing`, `completed`, and `failed`, with `error_message` retained for failure diagnostics.
- Export data source must match immutable history surfaces at generation time and include leaderboard core fields (`rank`, `display_name`, `score`, `total_time_seconds`, `offense_count`, `computed_at`) plus participant/team context from immutable registration snapshots (`school`, `grade_level`, `team_name`, and roster snapshot where applicable).
- File delivery must use trusted storage access and must not expose unscoped storage paths.

## Math Rendering Policy (Consistency Lock)

- Static math rendering in leaderboard-linked views, dispute details, and history pages must use KaTeX from stored LaTeX snapshots.
- KaTeX output is display-only and must never be treated as grading input or canonical export payload data.
- MathLive is the editable input layer from earlier branches; this branch does not introduce alternate math input or render stacks.

## Route and Entity Naming Contract (Explicit)

- Canonical routes for this branch:
  - `/mathlete/competition/[competitionId]/leaderboard`
  - `/organizer/competition/[competitionId]/leaderboard`
  - `/mathlete/history`
  - `/organizer/history`
- Canonical identifier names in APIs, loaders, and helpers:
  - `competitionId`
  - `registrationId`
  - `attemptId`
  - `disputeId`
  - `exportJobId`
- Do not use generic `[id]` naming in new branch-14 route contracts.

## Requirements

- leaderboard and participant-history surfaces implement the explicit publication-visibility matrix for scheduled vs open competitions without unpublished scheduled-result leakage
- organizer-only publish leaderboard action for scheduled competitions with event logging
- organizer dispute-review queue with explicit `open -> reviewing -> accepted | rejected | resolved` transitions, required resolution notes, and trusted follow-through behavior
- accepted disputes trigger recalculation and leaderboard refresh through trusted RPC orchestration
- branch 14 notification ownership is event/hook emission only for publication/dispute/recalculation outcomes; branch 15 handles inbox/email fan-out
- mathlete history page with competition summaries, score/rank outcome, and answer-key links governed by separate answer-key rules
- organizer history page with archive metrics, dispute/recalculation status, and export actions
- trusted export generation for CSV and XLSX through export-job orchestration with owner/admin-scoped authorization and scoped file access
- all branch-14 math displays render via KaTeX from stored LaTeX snapshots
- route/entity naming uses explicit `competitionId` and related identifiers without generic route placeholders

## Atomic Steps

1. Build leaderboard reads from `leaderboard_entries` using the explicit visibility contract.
2. Add organizer publication control for scheduled competitions via trusted publish action and event logging.
3. Build organizer dispute-resolution surface with explicit state-machine transitions and required resolution notes.
4. Implement accepted-dispute follow-through orchestration: resolve -> recalculate (idempotent token) -> refresh leaderboard -> domain events/hooks for branch 15 notification fan-out.
5. Build mathlete history view with score/rank/status and links that respect answer-key visibility independence.
6. Build organizer history view with participant/dispute/recalculation/export status visibility.
7. Implement export-job queueing, status polling, and scoped file delivery for CSV/XLSX.
8. Add tests for visibility matrix, publication flow, dispute follow-through, recalculation semantics, history queries, and export access boundaries.

## Key Files

- `app/mathlete/competition/[competitionId]/leaderboard/page.tsx`
- `app/organizer/competition/[competitionId]/leaderboard/page.tsx`
- `app/mathlete/history/page.tsx`
- `app/organizer/history/page.tsx`
- `components/disputes/*`
- `components/leaderboard/*`
- `components/history/*`
- `lib/disputes/*`
- `lib/leaderboard/*`
- `lib/exports/*`
- `app/organizer/competition/[competitionId]/exports/route.ts`
- `tests/leaderboard/*` (planned suite; create before enforcing suite-specific verification)

## Verification

- Manual QA: verify open-competition leaderboard visibility, keep scheduled leaderboard hidden until publish, verify scheduled unpublished competitions do not leak rank/score in mathlete history, resolve accepted and rejected disputes, confirm recalc follow-through updates, confirm scheduled publication remains active after post-publish recalculation, verify answer-key gating remains independent, and export results.
- Automated: visibility matrix tests, publication helper tests, dispute-resolution/recalculation orchestration tests, history-query tests, and export-job/access tests; if a specific export regression test cannot be added, document a waiver in QA evidence with `defect_id`, `reason`, `owner`, and `approved_by` before merge.
- Accessibility: sortable or paginated tables remain keyboard-safe and understandable on mobile.
- Performance: leaderboard and history pages use pagination and do not overfetch.
- Edge cases: accepted disputes after publish, recalculated tied ranks, repeated dispute action retries, large export requests, and export failure recovery.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(leaderboard): add leaderboard page and visibility rules`
  - `feat(disputes): add organizer dispute review and recalculation flow`
  - `feat(history): add mathlete and organizer archive pages`
  - `feat(exports): implement competition result export jobs`
  - `test(leaderboard): cover publication, dispute, and history helpers`
- PR title template: `UR15-UR16: leaderboard publication, dispute resolution, history, and exports`
- PR description template:
  - Summary: visibility contract, publication flow, dispute resolution follow-through, immutable history views, export jobs
  - Testing: lint, leaderboard tests, manual publish/dispute/recalculation/history/export checks
  - Docs: DB doc and flow docs aligned for leaderboard, dispute, recalculation, and export behavior

## Definition of Done

- result visibility follows explicit scheduled/open publication rules
- dispute-resolution outcomes enforce required follow-through and audit/event visibility
- recalculation semantics are trusted, immutable-snapshot-based, and consistent after publication
- participants and organizers can inspect trustworthy immutable history surfaces
- organizers and admins can export results through scoped trusted export contracts
