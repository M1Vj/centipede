# 13 - Review Submission

- Feature branch: `feature/review-submission`
- Requirement mapping: UR14d, UR14e, supporting UR15 and UR16 — attempt review, final submission, grade execution, answer-key visibility rules, disputes, and multi-attempt result handling
- Priority: 13
- **Assigned to:** Mabansag, Vj

## Mission

Implement the end-of-attempt flow: answer review, final confirmation, trusted submission, grade execution, multi-attempt result handling, answer-key visibility rules, and dispute submission.

This branch exists because submission is where arena data becomes official competition history. It must lock answers, call the grading engine correctly, and create the pathways for answer keys and disputes without leaking unpublished results.

Depends on: `11-arena`, `12-anti-cheat`.

Unblocks: leaderboards, history, notifications, recalculation, organizer dispute review.

## Full Context

- Business context: participants need confidence that their submitted work is final, reviewable, and fairly graded.
- User roles: mathletes submit and dispute; organizers resolve disputes later; admins may oversee audits.
- UI flow: review screen, summary counts, jump back to question, final confirmation, result summary, answer key view, dispute dialog.
- Backend flow: final submission mutation, attempt lock, immediate grading RPC, contract-bound leaderboard refresh integration when branch 14 schema ownership is available, dispute insert.
- Related tables/functions: `competition_attempts`, `attempt_answers`, `problem_disputes`, `leaderboard_entries`, grading RPCs.
- Edge cases: time-expiry auto-submit, submission during network instability, latest-score overwrite warnings, answer key hidden before the allowed visibility point, duplicate submit clicks.
- Security concerns: final submission and grading are trusted mutations; answer keys must respect competition-end visibility rules and cannot piggyback on leaderboard publication heuristics.
- Performance concerns: review summaries should be computed cheaply; grading should not block the UI without clear status.
- Accessibility/mobile: review tables and jump links must stay usable on small screens; confirmation copy must be clear.

## Research Findings / Implementation Direction

- Treat submission as a trusted server transition that atomically closes intervals, locks answers, and kicks grading.
- Use the same review summary model for both manual submit and auto-submit to avoid divergent code paths.
- Keep answer-key visibility tied to the explicit post-competition rules rather than to scheduled leaderboard publication.
- Model disputes as first-class records against the snapshotted competition problem, not the mutable source problem.

## Submit and Visibility Contracts (Deterministic)

### Submit-Lock Contract

- Final submit must be idempotent: the first accepted submit locks the attempt, later duplicate requests must return the existing final state without re-grading.
- Submission transition must close the active interval once, set `submitted_at`, and move attempt status to `submitted` or `auto_submitted` through trusted server logic.
- Grading is immediate on submit via trusted `grade_attempt(attempt_id)`. Release-one equivalence is fixed to branch `07` normalization semantics (no optional CAS branch): MCQ and TF use deterministic token equality, identification uses case-folded trimmed equality over normalized LaTeX payloads, and numeric uses parsed numeric comparison with absolute tolerance `<= 1e-9`.
- Disqualified attempts are locked with `final_score = 0`.
- Leaderboard refresh integration is contract-bound to branch `07` (`refresh_leaderboard_entries(competition_id)`) and becomes executable when branch `14` leaderboard schema ownership is available.
- Branch `13` must not write `leaderboard_entries` directly.
- Attempt initialization must pre-seed one `attempt_answers` row per `competition_problem` with `status_flag = 'blank'` so untouched questions are persisted deterministically.
- Review summary counts must derive from persisted `attempt_answers.status_flag` values (`blank`, `filled`, `solved`, `reset`) with no client-only heuristics.
- Compatibility fallback rule until pre-seed backfill is complete: trusted summary helpers infer additional `blank` count as `total_snapshot_problems - distinct_answer_rows` when older attempts have missing rows.

### Answer-Key Visibility Contract

- Visibility must be enforced by `competitions.answer_key_visibility` and trusted end-state checks, independent from leaderboard publication.
- `after_end`: participants with a valid competition registration can view answer-key snapshots after competition end.
- `hidden`: participants cannot view answer-key snapshots.
- Answer-key and explanation content must come only from `competition_problems` snapshot fields.

### Dispute Contract and Handoff

- Dispute creation writes to `problem_disputes` using `competition_problem_id`, `attempt_id`, and `reporter_id` from the participant context.
- New disputes start as `status = 'open'` and remain participant-readable through trusted dispute access rules.
- Branch `13` handoff state-machine contract is explicit: `open -> reviewing -> accepted | rejected | resolved`, with no direct `open -> accepted/rejected/resolved` shortcut in participant paths.
- State meaning is explicit for branch `14` resolution ownership:
  - `accepted`: organizer validated the dispute and scoring correction may be required.
  - `rejected`: organizer denied the dispute with no scoring correction.
  - `resolved`: organizer closed the dispute administratively without classifying it as accepted or rejected for scoring changes.
- Organizer resolution and any recalculation follow-through are owned by branch `14`, but branch `13` must create complete dispute records for that handoff.

## Requirements

- review page with answer counts and problem jump links
- final submission confirmation and double-submit protection
- trusted immediate grading execution after submission, with contract-bound leaderboard refresh integration when branch `14` schemas are available
- no direct `leaderboard_entries` writes in branch `13`; use trusted RPC contracts only
- support open-competition additional attempts under the configured policy, with explicit `Attempt Again` result handling and the grading modes `highest_score`, `latest_score`, and `average_score`
- review summary counts must use persisted `attempt_answers.status_flag` values with deterministic untouched-question handling (`blank` pre-seed rows, with trusted compatibility inference only for older attempts missing rows)
- answer-key access only when the explicit post-competition visibility rules allow it
- answer-key and explanation rendering must use KaTeX from snapshotted LaTeX data (no alternate renderer)
- dispute submission with explicit handoff state-machine semantics from `open` into organizer-owned `reviewing -> accepted | rejected | resolved` resolution in branch `14`

## Figma UI Provenance

- Source file URL: https://www.figma.com/design/cBQPJi1UVMFzrHlfsNPbsx/Mathwiz?node-id=1-125&t=wi7iD40k8rPMSyLH-1
- Baseline nodes for migration effort: `1:125`, `45:2`, `62:5`, `164:2488`, `167:3350`.
- Use baseline nodes as starting anchors; map branch-specific frames/components before implementation.
- When implementing UI changes in this branch, verify frame coverage first; if no frame exists for page/state, document gap and use current design system tokens without inventing unsupported Figma details.

## Atomic Steps

1. Build the review page and summary components using deterministic persisted-status counting, including untouched-question blank handling from the submit-lock contract.
2. Implement final submit with trusted attempt-state transition, interval closure, and idempotent duplicate-submit handling.
3. Trigger immediate trusted grading after submission using `grade_attempt(attempt_id)`, and integrate `refresh_leaderboard_entries(competition_id)` through the branch `07` contract when branch `14` leaderboard schema ownership is available, with no direct `leaderboard_entries` writes in branch `13`.
4. Implement result summaries for scheduled and open competitions, including an `Attempt Again` path when attempts remain and deterministic copy for `highest_score`, `latest_score`, and `average_score`.
5. Add answer-key pages that enforce `answer_key_visibility` rules, stay separate from scheduled leaderboard publication, and use competition problem snapshots.
6. Add dispute submission UI and persistence with deterministic `problem_disputes` inserts for organizer handoff, preserving the explicit `open -> reviewing -> accepted | rejected | resolved` state-machine contract.
7. Add tests for submit locking, duplicate-submit prevention, answer-key visibility enforcement, and dispute helpers.

## Key Files

- `app/mathlete/competition/[competitionId]/review/page.tsx`
- `app/mathlete/competition/[competitionId]/answer-key/page.tsx`
- `components/review/*`
- `components/answer-key/*`
- `lib/submission/*`
- `supabase/migrations/*`
- `tests/submission/*` (planned suite; create before enforcing suite-specific verification)

## Verification

- Manual QA: review answers, submit manually, let time expire, open additional attempts where allowed, confirm answer-key visibility at the allowed point without waiting for scheduled leaderboard publication, and file a dispute.
- Automated: submission-state tests, duplicate-submit protection, dispute helper coverage.
- Accessibility: summary table semantics, jump links, confirmation dialog clarity.
- Performance: grading feedback is clear and non-blocking; review page loads from existing answer data efficiently.
- Edge cases: auto-submit, network retry, answer key still hidden, latest-score overwrite warning for open competitions.

## Security and Reliability Addendum (2026-04)

- enforce submit-path anti-replay and anti-spam behavior while preserving idempotent duplicate-submit outcomes
- enforce dispute anti-spam constraints with deterministic limits per participant/attempt/problem scope
- enforce privacy-safe submission/dispute logging by default (no raw answer payload dumps in standard logs)
- enforce grading-degraded handling contract: locked attempt state, deterministic user status messaging, and retry-safe backend orchestration
- enforce participant response minimization so organizer-only resolution internals are never exposed before allowed visibility states

### Additional Verification Gates

- security QA: duplicate submit and dispute spam attempts do not create duplicate terminal side effects
- reliability QA: grading outage/degradation paths preserve locked attempt semantics and deterministic recovery behavior
- privacy QA: submission/dispute logs and user-facing errors remain non-disclosing

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(submission): add answer review and confirmation flow`
  - `feat(submission): implement trusted submit and grade execution`
  - `feat(submission): add answer key and dispute flows`
  - `test(submission): cover locking and dispute helpers`
- PR title template: `UR14d-UR14e: review, submission, answer key, and disputes`
- PR description template:
  - Summary: review screen, trusted submit, grading, answer keys, disputes
  - Testing: lint, submission tests, manual submit and answer-key checks
  - Docs: DB doc updated for dispute and submission rules

## Definition of Done

- final submission is trusted and non-duplicative
- answer keys and disputes follow the explicit visibility rules correctly
- the attempt lifecycle is ready for leaderboard and history surfaces
