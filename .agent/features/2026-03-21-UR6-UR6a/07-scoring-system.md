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
- Store scoring snapshots on the competition or attempt where needed so historical results remain consistent even if global defaults change later.
- Treat multi-attempt grading policy as a competition-level contract and reflect it in both UI copy and leaderboard refresh logic.
- Prefer database functions or trusted server actions for grading to keep the source of truth server-side.

## Requirements

- automatic scoring: easy=1, average=2, difficult=3 baseline
- custom scoring per selected problem
- optional penalty deduction for wrong answers
- tie-breaker selection with clear supported rules
- multiple-attempt grading modes for open competitions
- answer normalization per problem type
- recalculation support when answer keys change after a dispute is accepted

## Atomic Steps

1. Define enums and schema fields for scoring, penalties, tie-breakers, and attempt grading modes.
2. Build organizer-facing scoring rule controls and validation helpers.
3. Implement answer normalization functions for MCQ, TF, numeric, and identification answers.
4. Implement a trusted grading RPC for a single attempt.
5. Implement leaderboard refresh logic based on the competition's tie-breaker and multi-attempt policy.
6. Implement a recalculation RPC for accepted dispute or answer-key corrections.
7. Add tests covering normalization, penalties, tie-breaker ordering, and multiple-attempt rule behavior.
8. Surface scoring summaries in the wizard and submission review so the participant understands how the competition is graded.

## Key Files

- `lib/scoring/*`
- `supabase/migrations/*`
- `supabase/functions/*` or SQL RPC definitions
- organizer scoring form components
- `tests/scoring/*`

## Verification

- Manual QA: create scoring rules in the UI, verify preview copy, grade sample attempts, and rerun recalculation after changing an answer key in a controlled scenario.
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
- grading and recalculation can power later submission and leaderboard work without redesign
