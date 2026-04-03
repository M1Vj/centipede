# 07 - Scoring System

- Feature branch: `feature/scoring-system`
- Requirement mapping: UR6a — scoring presets, answer normalization, penalties, tie-breakers, multiple-attempt grading, and recalculation
- Priority: 7
- **Assigned to:** Mabansag, Vj

## Mission

Design and implement the scoring engine that competitions rely on. This includes scoring presets, custom points, penalties, tie-breakers, multiple-attempt grading policy, answer normalization, and trusted grading or recalculation RPCs.

This branch exists because scoring is not just a wizard toggle. It is a backend contract that affects answer storage, leaderboard rules, dispute handling, and post-competition recalculation.

Depends on: `06-problem-bank`.

Unblocks: competition wizard, arena grading, leaderboards, disputes, and result publishing.

## Sequencing Gate (Explicit)

- Branch `07-scoring-system` owns canonical scoring contracts, trusted RPC signatures, and deterministic compute semantics.
- Branch `07` lands contract-first scoring artifacts (signatures, deterministic semantics, and contract guards), while executable SQL activation that depends on owner schemas is deferred.
- Executable rollout is activated only when owner schemas exist: attempts/answers from `11-arena`, submission/dispute ownership from `13-review-submission`, and leaderboard/history ownership from `14-leaderboard-history`.
- `score_recalculated` domain-event production remains owned by branch `14` orchestration after recompute and refresh complete.
- Until that gate is satisfied, branch `07` remains contract-first and downstream owner branches activate the executable wiring.

## Full Context

- Business context: incorrect grading undermines trust in the entire platform.
- User roles: organizers configure rules; mathletes are graded; admins may audit or trigger intervention.
- UI flow: scoring preset forms, rule previews, tie-breaker explanations, multiple-attempt policy messaging.
- Backend flow: normalization helpers, grade calculation RPCs, leaderboard refresh, recalculation after accepted disputes.
- Related tables/functions: `competitions`, `competition_problems`, `competition_attempts`, `attempt_answers`, `leaderboard_entries`, `problem_disputes`.
- Edge cases: numeric formatting differences, multiple accepted answers, latest-score overwrite warnings, negative penalties, tie outcomes.
- Security concerns: grading logic must run on trusted backend paths; clients can submit answers but cannot award themselves points.
- Performance concerns: grading must be fast enough for submission and recalculation for whole competitions must be batch-safe.
- Accessibility/mobile: scoring explanations in the wizard and review flow must be understandable, not hidden behind dense jargon.

## Research Findings / Implementation Direction

- Separate answer normalization from answer persistence so grading logic stays deterministic and testable.
- Store immutable publish-time scoring snapshots on the competition so historical results remain consistent even if later draft rules or defaults change.
- Treat multi-attempt grading policy as a competition-level contract and reflect it in both UI copy and leaderboard refresh logic.
- Use trusted SQL RPCs for grading and recalculation (`grade_attempt`, `recalculate_competition_scores`) and explicit leaderboard refresh (`refresh_leaderboard_entries`); recalculation in this branch is compute-only and must require `request_idempotency_token`, while branch 14 orchestration owns `score_recalculated` domain-event production after recompute and refresh.

### Trusted Scoring RPC Contract (Must Match DB Contract)

- Required SQL RPCs: `grade_attempt(attempt_id)`, `recalculate_competition_scores(competition_id, request_idempotency_token)`, and `refresh_leaderboard_entries(competition_id)`.
- These RPCs are defined in SQL migrations and executed as trusted backend functions (`SECURITY DEFINER`).
- Browser clients must never call grading RPCs directly. Invocation is allowed only through trusted server actions or backend jobs.
- Branch `07` owns the RPC signatures and deterministic scoring contract; executable SQL bodies that depend on owner schemas activate only after branch `11` attempt/answer schemas, branch `13` submission/dispute schemas, and branch `14` leaderboard/history schemas are present.
- Idempotency scope is explicit: `recalculate_competition_scores` must dedupe side effects by `request_idempotency_token`; `grade_attempt` and `refresh_leaderboard_entries` stay deterministic compute RPCs orchestrated by already-idempotent trusted handlers.
- RPC bodies in branch 07 stay compute-only and must not emit domain events directly; branch `14` orchestration owns `score_recalculated` event production.
- Required orchestration:
  1. Final submission path calls `grade_attempt(attempt_id)`.
  2. Successful grading path calls `refresh_leaderboard_entries(competition_id)`.
  3. Accepted dispute path first writes a trusted correction artifact, then calls `recalculate_competition_scores(competition_id, request_idempotency_token)`, then `refresh_leaderboard_entries(competition_id)`.
- Grading and recalculation must read immutable publish artifacts only:
  - `competitions.scoring_snapshot_json` for scoring and anti-cheat policy.
  - `competition_problems` snapshot fields (`content_snapshot_latex`, `options_snapshot_json`, `answer_key_snapshot_json`, `explanation_snapshot_latex`, `difficulty_snapshot`, `tags_snapshot`, `image_snapshot_path`) for problem and answer-key data.
  - `competition_problems.points` as the canonical per-problem base points source of truth.
  - Effective per-problem points precedence for grading and recalculation is strict: use an active trusted `points_override` correction artifact for the `competition_problem_id` when present; otherwise use `competition_problems.points`.
- Grading inputs are canonical LaTeX (`attempt_answers.answer_latex` and snapshot answer payloads). KaTeX output and cached HTML are display-only and must never be used as grading inputs.
- Any MathLive client output must be normalized to LaTeX before persistence; scoring logic must not parse editor-specific payload formats.
- Do not read mutable `problems` rows during grading or recalculation.

### Penalty Floor and Multi-Attempt Rounding Contract (Deterministic)

- Per-attempt penalty application is deterministic and non-negative: `final_score = max(0, raw_score - penalty_total)`.
- `penalty_total` must be clamped at zero minimum before subtraction and includes all trusted deductions (wrong-answer and offense deductions).
- Open-competition `average_score` mode computes arithmetic mean over graded attempt `final_score` values selected by policy.
- `average_score` rounding happens exactly once at final aggregation with SQL numeric rounding `round(value, 2)` (half away from zero).
- Tie-break ordering is evaluated after deterministic rounding, using the frozen publish-time tie-breaker contract.

### Accepted-Dispute Correction Artifact Contract (Immutable Base + Trusted Override)

- Immutable publish snapshots remain unchanged forever: `competitions.scoring_snapshot_json` and all `competition_problems` snapshot columns are never updated in-place after publish.
- Accepted disputes and organizer-approved answer-key corrections must be represented canonically as trusted `competition_problem_corrections` records linked to `competition_id`, `competition_problem_id`, and `dispute_id` (`problem_disputes.id`).
- Canonical `competition_problem_corrections` artifact fields are: `id`, `competition_id`, `competition_problem_id`, `dispute_id`, `correction_type` (`answer_key_override` or `points_override`), `corrected_payload_json`, `reason`, `actor_user_id`, `created_at`, and `is_active`.
- `recalculate_competition_scores(competition_id, request_idempotency_token)` must compute effective grading inputs as immutable publish snapshot + ordered active `competition_problem_corrections` artifacts.
- Points-override precedence for recompute is deterministic: active trusted `competition_problem_corrections` artifact where `correction_type = 'points_override'` value first, else `competition_problems.points`.
- `competition_problem_corrections` artifacts are the only legal override path; direct mutation of immutable snapshot columns is prohibited.

### Scoring Snapshot Contract (Immutable)

- `competitions.scoring_snapshot_json` contract is defined in branch 07 and consumed by grading/recalculation; publish-time write execution is owned by branch `08-competition-wizard`, after which it is immutable once status leaves `draft`.
- Snapshot payload must include the effective scoring and anti-cheat rule keys used by grading and leaderboard ordering: scoring mode, penalty mode, deduction value, tie-breaker, multi-attempt grading mode, shuffle settings, and offense penalties.
- Per-problem base points used by grading are frozen in `competition_problems.points` at publish time.
- Effective points during grading and recalculation follow strict precedence: active trusted `points_override` artifact value when present, otherwise `competition_problems.points`.
- Post-publish organizer edits may update draft forms for future competitions only; they must not retroactively change the scoring contract for already-published competitions.

## Requirements

- automatic scoring: easy=1, average=2, difficult=3 baseline
- custom scoring per selected problem
- optional penalty deduction for wrong answers
- deterministic penalty floor: penalties apply, but per-attempt `final_score` is clamped to zero minimum
- tie-breaker selection with clear supported rules and an explicit default of earliest final submission timestamp when organizers do not override it
- multiple-attempt grading modes for open competitions using the explicit enum values `highest_score`, `latest_score`, and `average_score`
- deterministic `average_score` aggregation for open competitions: arithmetic mean of graded attempt final scores rounded once with `round(value, 2)`
- answer normalization per problem type
- recalculation support when answer keys change after a dispute is accepted
- immutable scoring snapshot contract used by grading, leaderboard refresh, and later recalculation, with publish-time write execution owned by branch `08-competition-wizard`

## Atomic Steps

1. Define enums and schema fields for scoring, penalties, tie-breakers, attempt grading modes, and immutable publish-time scoring snapshots.
2. Build organizer-facing scoring rule controls and validation helpers.
3. Implement answer normalization functions for MCQ, TF, numeric, and identification answers.
4. Define and validate `grade_attempt(attempt_id)` as the trusted grading RPC contract for a single attempt, including deterministic penalty-floor math; executable SQL activation occurs when owner attempt/answer schemas are available.
5. Define and lock the publish-time `scoring_snapshot_json` contract in branch 07, and make grading plus `refresh_leaderboard_entries(competition_id)` consume the frozen tie-breaker, multi-attempt policy, and points precedence contract (active trusted `points_override` when present, else `competition_problems.points`); branch `08-competition-wizard` owns executing snapshot writes during publish.
6. Define and validate `recalculate_competition_scores(competition_id, request_idempotency_token)` plus `refresh_leaderboard_entries(competition_id)` recompute contracts for accepted disputes using canonical `competition_problem_corrections` artifacts (without mutating immutable snapshots); executable SQL activation and `score_recalculated` event production wiring happen in owner branches, with event production owned by branch `14`.
7. Add tests covering normalization, penalty floor at zero, tie-breaker ordering, multiple-attempt rule behavior (including deterministic `average_score` rounding), and snapshot immutability expectations.
8. Surface scoring summaries in the wizard and submission review so the participant understands how the competition is graded.

## Key Files

- `lib/scoring/*`
- `supabase/migrations/*` (branch `07` contract/signature artifacts for `grade_attempt`, `recalculate_competition_scores`, and `refresh_leaderboard_entries`; executable activation migrations land with owner-schema branches `11`, `13`, and `14`)
- organizer scoring form components
- `tests/scoring/*`

## Verification

- Manual QA: create scoring rules in the UI, verify preview copy, grade sample attempts, confirm the publish-time scoring snapshot is frozen, and rerun recalculation after changing an answer key in a controlled scenario.
- Automated: normalization, grade calculation, tie-breaker, and multiple-attempt tests.
- Accessibility: scoring options and warnings are understandable and screen-reader friendly.
- Performance: grading a single attempt is low-latency; recalculating a competition is batch-safe and traceable.
- Edge cases: equivalent numeric expressions, multiple accepted answers, zero-score attempts, penalty-floor enforcement at zero, and `average_score` half-step rounding boundaries.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(scoring): add schema and organizer scoring controls`
  - `feat(scoring): add answer normalization helpers`
  - `feat(scoring): implement grading and leaderboard refresh rpc`
  - `test(scoring): cover penalties tie-breakers and attempt policies`
- PR title template: `UR6a: scoring engine, normalization, and grading rules`
- PR description template:
  - Summary: scoring model, normalization, grading RPCs, recalculation support
  - Testing: lint, scoring tests, manual grading verification
  - Docs: DB doc updated for grading and leaderboard rules

## Definition of Done

- scoring rules are configurable and trusted
- answer normalization is deterministic and tested
- published competitions keep an immutable scoring contract
- grading and recalculation can power later submission and leaderboard work without redesign
