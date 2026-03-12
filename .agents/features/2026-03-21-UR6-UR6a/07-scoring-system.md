# 07 – Scoring System & Rules

## Mission

Define and implement a flexible scoring system for competitions.
Support automatic scoring based on problem difficulty and custom
scoring where organizers assign specific point values.  Provide
options for penalties on wrong answers, tie‑breaking rules and
grading of multiple attempts for open competitions.

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/scoring-system`
* **Requirements:** 06‑problem-bank (problems exist)
* **Assigned to:** Mabansag, Vj

## Requirements

* Competitions table has fields `scoring_mode`, `custom_points`,
  `penalty_mode`, `deduction_value` and `tie_breaker`.
* Problem banks and problems exist.

## Atomic Steps
0. **Research scoring models.**  Study scoring systems used in
   established math and programming competitions to understand how
   automatic and custom scoring, penalties and tie‑breakers are
   handled.  Look for open‑source implementations of grading
   functions or leaderboards to inspire a robust `grade_attempt`
   function.  Use insights from this research to design fair and
   transparent scoring rules.

1. **Scoring configuration UI.**  Within the competition creation
   wizard (to be built in branch 07), create a `Scoring` step or
   section.  Provide the following controls:
   * Radio group for `scoring_mode`: **Automatic** or **Custom**.
   * If **Automatic** is selected, display the default mapping
     Easy = 1, Average = 2, Difficult = 3.
   * If **Custom** is selected, allow the organizer to assign a point
     value per difficulty level or per problem.  Store this in
     `custom_points` as JSON.
   * Toggle for `penalty_mode`: None or Deduction.  If deduction is
     selected, allow setting `deduction_value` (points subtracted for
     wrong answers).
   * Select for `tie_breaker`: earliest_submission, latest_submission
     or average_time.
   * Select for attempt grading mode (Open competitions only): highest
     score, latest score or average score.
2. **Database migrations.**  Ensure that the competitions table
   includes the fields mentioned above.  Create migrations if not
   already present.
3. **Server‑side scoring functions.**  Write a Postgres function
   `grade_attempt(attempt_id uuid)` that joins the attempt’s answers
   with the correct solutions (from `competition_problems` snapshot or
   `problems`), applies the selected scoring mode and penalties, and
   updates the attempt’s `score` and `status`.  For multiple attempts,
   compute the overall score based on the chosen grading mode.
4. **Tie‑breaker logic.**  Ensure the function records tie‑breaker
   metadata (e.g. earliest submission time or average time) to be used
   by the leaderboard view (Feature 13).
5. **UI integration.**  After a competition is created, display the
   selected scoring configuration on the competition details page and
   in the arena footer.  Show how scores will be calculated to
   participants.
6. **Testing.**  Write unit tests for `grade_attempt` covering both
   automatic and custom scoring, penalties, tie‑breakers and multiple
   attempts.  Test edge cases such as no correct answers or negative
   scores.

## Key Files

* `pages/organizer/competitions/create/[step]/scoring.tsx` (UI step)
* `database/migrations/*_update_competitions_scoring.sql`
* `database/functions/grade_attempt.sql`
* `lib/supabase/scoring.ts` (RPC wrapper for grading)

## Verification

1. Create competitions with automatic and custom scoring.  Verify that
   the UI reflects the chosen configuration and that scores compute
   correctly after submission.
2. Submit attempts with wrong answers and confirm that penalties are
   applied if enabled.
3. For open competitions with multiple attempts, submit multiple
   attempts and check that overall scoring respects the selected
   grading mode.
4. Inspect the database to ensure that `custom_points` JSON is
   stored correctly and that the tie‑breaker values are recorded.

## Git Branching

Recommended commit titles:

- `feat: add scoring configuration step to competition wizard`
- `chore: migrate competitions table to support custom scoring`
- `feat: implement grade_attempt SQL function with tie‑breakers`
- `feat: display scoring configuration in competition details`
- `test: add unit tests for grade_attempt function`

## Definition of Done

* Organizers can configure scoring modes, penalties and tie‑breakers.
* The database supports custom scoring via migrations.
* Attempts are graded server‑side using `grade_attempt` and reflect the
  selected rules.
* Tests ensure correctness across edge cases and multiple attempts.
* Checklist item `07-scoring-system` can be marked complete after
  merge.
