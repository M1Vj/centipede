# 12 – Review, Submission & Answer Key

## Mission

Allow mathletes to review their answers before submitting an attempt,
finalize submissions via a database function that grades answers,
support multiple attempts for open competitions, and expose answer
keys along with a dispute mechanism after the competition ends.  This
feature addresses UR14d (answer review) and UR14e (answer key display).

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/review-submission`
* **Requirements:** 10‑arena, 11‑anti‑cheat, 06‑scoring‑system
* **Assigned to:** Mabansag, Vj

## Requirements

* The database function `grade_attempt(attempt_id)` exists to grade
  answers and update scores (see DATABASE‑EDR‑RLS.md).  It should also
  refresh leaderboard materialized views.
* Answer snapshots (`competition_problems.snapshot_answer_keys`) are
  available for comparisons.
* The `problem_flags` table stores disputes and status updates.

## Atomic Steps
0. **Research review and grading patterns.**  Examine how other
   online assessment platforms implement review screens, submission
   flows and dispute handling.  Look for open‑source examples of
   grading functions, step summaries and user feedback.  Use this
   research to ensure that the review page is intuitive and that the
   `grade_attempt` function is robust and efficient.

1. **Review page.**  After a mathlete finishes answering all
   questions or clicks the “Review Answers” button in the arena,
   navigate to `app/mathlete/arena/[attemptId]/review.tsx`.  Fetch all
   `competition_problems` with the user’s current `attempt_answers` and
   display a table summarising status (`blank`, `filled`, `solved`),
   answer previews and an edit button to jump back to the question.
   Show the remaining time in the header.
2. **Submit attempt.**  Provide a “Submit Competition” button at the
   bottom of the review page.  When clicked, display a confirmation
   modal warning that submission is final for this attempt.  On
   confirmation, call `supabase.rpc('grade_attempt', { attempt_id })`.
   Disable the button and show a spinner while the function executes.
   After completion, redirect to a results page showing the score and
   ranking (if open competition) or a “Thank you” page indicating
   that results will be available after the organizer publishes the
   leaderboard (for scheduled competitions).
3. **Multiple attempts.**  If the competition allows multiple
   attempts (`attempts_allowed > attempt_no`), show an “Attempt
   Again” button on the results page.  Clicking this should create a
   new attempt (using the same logic as the arena entry) and redirect
   the mathlete back to the arena.  Warn the user if the grading mode
   is `latest_score` that the previous score will be overwritten.
4. **Answer key display.**  After a scheduled competition ends and the
   organizer publishes the leaderboard (i.e. `competitions.leaderboard_published = true`), allow mathletes to view the answer key.
   Implement `app/mathlete/history/[attemptId]/answer-key.tsx` that
   fetches `competition_problems.snapshot_answer_keys` and the
   mathlete’s own answers.  Display correct answers alongside
   indicators of correctness.  For multiple accepted answers, list
   alternatives.  For MCQ/TF, highlight the correct option.
5. **Dispute mechanism.**  On the answer key page, provide a
   “Report Issue” button for each problem.  Clicking opens a modal
   where the mathlete can explain why the answer key might be wrong or
   ambiguous.  On submit, insert into `problem_flags` with
   `competition_problem_id`, `profile_id`, `reason` and `status = 'open'`.
   Organizers will review these flags and update the status or adjust
   the answer key accordingly.  When resolved, the grading function
   should be rerun and scores recalculated, triggering new
   notifications.
6. **Testing.**  Run through a full attempt: answer questions,
   navigate to the review page, submit, view the results, start a
   second attempt if allowed, view the answer key once published and
   submit a dispute.  Verify that scores update and notifications
   reflect status changes.

## Key Files

* `pages/mathlete/arena/[attemptId]/review.tsx`
* `pages/mathlete/history/[attemptId]/answer-key.tsx`
* `components/ReviewTable.tsx`
* `components/GradeAttemptButton.tsx`
* `components/AnswerKeyTable.tsx`
* SQL function file for `grade_attempt` (e.g. `supabase/functions/grade_attempt.sql`)

## Verification

1. Mathletes can review answers before submitting and navigate back to
   specific questions for edits.
2. Submitting calls the grading function, updates scores and locks
   answers from further changes.
3. Multiple attempts work as configured and respect grading mode
   rules.
4. Answer keys display after the organizer publishes the results, and
   participants can file disputes that feed into the review flow.
5. The leaderboard refreshes automatically after grading or
   recalculation via Realtime.

## Git Branching

Recommended commit titles:

- `feat: add review page with answer summary and navigation`
- `feat: implement submission logic calling grade_attempt`
- `feat: support multiple attempts and results page`
- `feat: display answer keys and allow problem disputes`
- `test: end-to-end tests for review and submission flow`

## Definition of Done

* Review, submission and answer key flows are fully functional.
* Mathletes cannot modify answers after submission; scores update via
  the grading function.
* Disputes can be filed and trigger recalculations when resolved.
* Checklist item `12-review-submission` can be marked complete after
  merge.