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
- Backend flow: final submission mutation, attempt lock, grading RPC, leaderboard refresh, dispute insert.
- Related tables/functions: `competition_attempts`, `attempt_answers`, `problem_disputes`, `leaderboard_entries`, grading RPCs.
- Edge cases: time-expiry auto-submit, submission during network instability, latest-score overwrite warnings, answer key hidden before publication, duplicate submit clicks.
- Security concerns: final submission and grading are trusted mutations; answer keys must respect publication rules.
- Performance concerns: review summaries should be computed cheaply; grading should not block the UI without clear status.
- Accessibility/mobile: review tables and jump links must stay usable on small screens; confirmation copy must be clear.

## Research Findings / Implementation Direction

- Treat submission as a trusted server transition that atomically closes intervals, locks answers, and kicks grading.
- Use the same review summary model for both manual submit and auto-submit to avoid divergent code paths.
- Keep answer-key visibility tied to competition and leaderboard publication rules instead of exposing it immediately after grading.
- Model disputes as first-class records against the snapshotted competition problem, not the mutable source problem.

## Requirements

- review page with answer counts and problem jump links
- final submission confirmation and double-submit protection
- trusted grading execution after submission
- support open-competition additional attempts under the configured policy
- answer-key access only when the competition allows it
- dispute submission with status tracking

## Atomic Steps

1. Build the review page and summary components.
2. Implement final submit with trusted attempt-state transition and interval closure.
3. Trigger grading and leaderboard refresh after submission.
4. Implement result summaries for scheduled and open competitions.
5. Add answer-key pages that respect publication rules and use competition problem snapshots.
6. Add dispute submission UI and persistence.
7. Add tests for submit locking, duplicate-submit prevention, and dispute helpers.

## Key Files

- `app/mathlete/competition/[id]/review/page.tsx`
- `components/review/*`
- `components/answer-key/*`
- `lib/submission/*`
- `supabase/migrations/*`
- `tests/submission/*`

## Verification

- Manual QA: review answers, submit manually, let time expire, open additional attempt where allowed, open answer key after publication, file a dispute.
- Automated: submission-state tests, duplicate-submit protection, dispute helper coverage.
- Accessibility: summary table semantics, jump links, confirmation dialog clarity.
- Performance: grading feedback is clear and non-blocking; review page loads from existing answer data efficiently.
- Edge cases: auto-submit, network retry, answer key still hidden, latest-score overwrite warning for open competitions.

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
- answer keys and disputes follow the publication rules correctly
- the attempt lifecycle is ready for leaderboard and history surfaces
