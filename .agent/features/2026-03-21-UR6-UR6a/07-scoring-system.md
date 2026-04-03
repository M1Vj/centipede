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
- Use trusted SQL RPCs for grading and recalculation (`grade_attempt`, `recalculate_competition_scores`) and explicit leaderboard refresh (`refresh_leaderboard_entries`); server actions may orchestrate calls but must not replace the grading source of truth.

### Trusted Scoring RPC Contract (Must Match DB Contract)

- Required SQL RPCs: `grade_attempt(attempt_id)`, `recalculate_competition_scores(competition_id)`, and `refresh_leaderboard_entries(competition_id)`.
- These RPCs are defined in SQL migrations and executed as trusted backend functions (`SECURITY DEFINER`).
- Browser clients must never call grading RPCs directly. Invocation is allowed only through trusted server actions or backend jobs.
- Required orchestration:
  1. Final submission path calls `grade_attempt(attempt_id)`.
  2. Successful grading path calls `refresh_leaderboard_entries(competition_id)`.
  3. Accepted dispute path first writes a trusted correction artifact, then calls `recalculate_competition_scores(competition_id)`, then `refresh_leaderboard_entries(competition_id)`.
- Grading and recalculation must read immutable publish artifacts only:
  - `competitions.scoring_snapshot_json` for scoring and anti-cheat policy.
  - `competition_problems` snapshot fields (`content_snapshot_latex`, `options_snapshot_json`, `answer_key_snapshot_json`, `explanation_snapshot_latex`, `difficulty_snapshot`, `tags_snapshot`, `image_snapshot_path`) for problem and answer-key data.
  - `competition_problems.points` as the canonical per-problem base points source of truth.
  - Effective per-problem points precedence for grading and recalculation is strict: use an active trusted `points_override` correction artifact for the `competition_problem_id` when present; otherwise use `competition_problems.points`.
- Grading inputs are canonical LaTeX (`attempt_answers.answer_latex` and snapshot answer payloads). KaTeX output and cached HTML are display-only and must never be used as grading inputs.
- Any MathLive client output must be normalized to LaTeX before persistence; scoring logic must not parse editor-specific payload formats.
- Do not read mutable `problems` rows during grading or recalculation.

### Accepted-Dispute Correction Artifact Contract (Immutable Base + Trusted Override)

- Immutable publish snapshots remain unchanged forever: `competitions.scoring_snapshot_json` and all `competition_problems` snapshot columns are never updated in-place after publish.
- Accepted disputes and organizer-approved answer-key corrections must be represented as explicit trusted correction artifacts linked to `problem_disputes` and `competition_problems` (for example via dispute resolution payloads or equivalent trusted correction records).
- Correction artifacts must include at minimum: `competition_id`, `competition_problem_id`, correction type (`answer_key_override` or `points_override`), corrected payload, reason, actor, and timestamp.
- `recalculate_competition_scores(competition_id)` must compute effective grading inputs as: immutable publish snapshot + ordered trusted correction artifacts.
- Points-override precedence for recompute is deterministic: active trusted `points_override` artifact value first, else `competition_problems.points`.
- The correction artifacts are the only legal override path; direct mutation of immutable snapshot columns is prohibited.

### Scoring Snapshot Contract (Immutable)

- `competitions.scoring_snapshot_json` is written once during publish and becomes immutable after status leaves `draft`.
- Snapshot payload must include the effective scoring and anti-cheat rule keys used by grading and leaderboard ordering: scoring mode, penalty mode, deduction value, tie-breaker, multi-attempt grading mode, shuffle settings, and offense penalties.
- Per-problem base points used by grading are frozen in `competition_problems.points` at publish time.
- Effective points during grading and recalculation follow strict precedence: active trusted `points_override` artifact value when present, otherwise `competition_problems.points`.
- Post-publish organizer edits may update draft forms for future competitions only; they must not retroactively change the scoring contract for already-published competitions.

## Requirements

- automatic scoring: easy=1, average=2, difficult=3 baseline
- custom scoring per selected problem
- optional penalty deduction for wrong answers
- tie-breaker selection with clear supported rules and an explicit default of earliest final submission timestamp when organizers do not override it
- multiple-attempt grading modes for open competitions
- answer normalization per problem type
- recalculation support when answer keys change after a dispute is accepted
- immutable publish-time scoring snapshot used by grading, leaderboard refresh, and later recalculation

## Atomic Steps

1. Define enums and schema fields for scoring, penalties, tie-breakers, attempt grading modes, and immutable publish-time scoring snapshots.
2. Build organizer-facing scoring rule controls and validation helpers.
3. Implement answer normalization functions for MCQ, TF, numeric, and identification answers.
4. Implement `grade_attempt(attempt_id)` as the trusted grading RPC for a single attempt.
5. Implement publish-time `scoring_snapshot_json` writes and make grading plus `refresh_leaderboard_entries(competition_id)` consume the frozen tie-breaker, multi-attempt policy, and points precedence contract (active trusted `points_override` when present, else `competition_problems.points`).
6. Implement `recalculate_competition_scores(competition_id)` for accepted disputes using trusted correction artifacts (without mutating immutable snapshots), followed by `refresh_leaderboard_entries(competition_id)`.
7. Add tests covering normalization, penalties, tie-breaker ordering, multiple-attempt rule behavior, and snapshot immutability expectations.
8. Surface scoring summaries in the wizard and submission review so the participant understands how the competition is graded.

## Key Files

- `lib/scoring/*`
- `supabase/migrations/*` (including SQL RPC definitions for `grade_attempt`, `recalculate_competition_scores`, and `refresh_leaderboard_entries`)
- organizer scoring form components
- `tests/scoring/*`

## Verification

- Manual QA: create scoring rules in the UI, verify preview copy, grade sample attempts, confirm the publish-time scoring snapshot is frozen, and rerun recalculation after changing an answer key in a controlled scenario.
- Automated: normalization, grade calculation, tie-breaker, and multiple-attempt tests.
- Accessibility: scoring options and warnings are understandable and screen-reader friendly.
- Performance: grading a single attempt is low-latency; recalculating a competition is batch-safe and traceable.
- Edge cases: equivalent numeric expressions, multiple accepted answers, zero-score attempts, penalty pushing below zero if not clamped.

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
