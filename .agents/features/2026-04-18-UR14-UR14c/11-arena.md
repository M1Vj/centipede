# 11 – Competition Arena

## Mission

Implement the live competition arena where mathletes solve problems.
The arena should handle entry at the scheduled start time, enforce
rules and agreements, display a server‑synchronised timer, render
problems with math notation, save answers in real time, support
status flags and maintain session integrity across disconnects.  This
feature covers UR14 (arena entry), UR14a (timer), UR14b (problem
status flagging) and UR14c (mathematical input).

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/arena`
* **Requirements:** 10‑competition‑search
* **Assigned to:** Mabansag, Vj

## Requirements

* Competitions and registrations must exist and be published.
* The database tables `competition_attempts`, `competition_problems`,
  `attempt_answers`, `attempt_active_intervals` and `tab_switch_logs`
  are available with appropriate RLS.
* Math formula rendering is provided via KaTeX or a similar library.

## Atomic Steps

0. **Research math input editors and performance.**  Start by
   searching for open‑source libraries that provide a WYSIWYG
   mathematical input field suitable for numeric and identification
   answers.  Evaluate options like MathQuill, MathLive or
   equation‑editor‑react.  Choose a library that offers a toolbar of
   common symbols, real‑time LaTeX preview and accessibility support.
   Additionally, research performance optimisation techniques for
   interactive pages (e.g. React concurrent mode, code splitting) to
   ensure the arena loads quickly and works smoothly on mobile
   devices.

1. **Arena route and attempt creation.**  When a mathlete clicks
   “Enter Arena” on a competition page, call a Supabase RPC or REST
   endpoint that inserts a new row in `competition_attempts` with
   `competition_id`, `registration_id` (if any), `attempt_no` and
   `started_by_user_id`.  Return the new `attemptId`.  Redirect the
   user to `app/mathlete/arena/[attemptId]/page.tsx`.  Use dynamic
   routing to handle different attempts.
2. **Pre‑entry agreement.**  On the arena page, before showing
   questions, display a modal requiring the mathlete to acknowledge
   anti‑cheat rules (e.g. Do Not Disturb, screen lock, penalties for
   focus loss).  Persist this agreement in local state and prevent
   further actions until accepted.
3. **Start interval tracking.**  After agreement, insert a row into
   `attempt_active_intervals` with `attempt_id` and `start_time = now()`.  When
   the component unmounts or the browser tab unloads (use
   `beforeunload` and `visibilitychange` listeners), update the most
   recent interval’s `end_time = now()`.  When the user resumes, create
   a new interval.  A helper function on the backend can aggregate
   these intervals into `total_time_seconds` for leaderboard ranking.
4. **Timer component.**  Fetch the attempt’s start and competition
   duration and compute the end timestamp.  Implement a countdown
   (`components/ArenaTimer.tsx`) that recalculates remaining time on
   every tick using `Date.now()`.  If the attempt is paused (e.g.
   competition paused), stop the timer.  When the timer reaches zero,
   auto‑submit the attempt via RPC.
5. **Problem retrieval.**  Query `competition_problems` for the
   competition and join any existing `attempt_answers` for this
   attempt.  Shuffle questions/options as dictated by competition
   settings.  Store the problem list in local state or context.
6. **Problem rendering.**  Create `components/ProblemRenderer.tsx`
   that takes a problem snapshot and renders it.  Use KaTeX to
   display mathematical notation.  For multiple choice and true/false
   questions, render radio buttons with labels.  For numeric and
   identification questions, integrate the math editor selected
   during research (e.g. MathQuill) rather than a plain text box.
   Provide a symbol palette so users can insert fractions,
   exponents, integrals and other common symbols without memorising
   LaTeX.  Display a real‑time preview of the expression below or
   beside the input.  Ensure the component is responsive and
   supports both keyboard and touch input.  Show images if provided.
7. **Answer saving.**  On change of any input, call Supabase
   `upsert` on `attempt_answers` with `attempt_id`,
   `competition_problem_id`, `answer_text` and set `state` to
   `'filled'`.  Provide UI controls to mark a question as
   “Solved” or “Reset,” updating `state` to `'solved'` or `'reset'`.
   Display a navigation grid (`components/NavigationGrid.tsx`) showing
   question numbers with colour codes (e.g. blank, filled, solved).
8. **Focus and anti‑cheat detection.**  Listen for `visibilitychange`
   and `blur` events.  If the document loses focus, immediately hide
   the questions and show a fullscreen overlay instructing the user to
   return.  Call Supabase RPC or insert into `tab_switch_logs` with
   `attempt_id`, offense number (`offense_no` is row count + 1) and
   calculate the penalty action based on `competition.offense_penalties`.
   If the penalty is a point deduction or disqualification, update
   `competition_attempts.anti_cheat_deduction` or set `status =
   'disqualified'`.  Display a warning modal with details.
9. **Responsive design.**  Ensure the arena layout works on both
   desktop and mobile.  Use a sidebar or top navigation for the
   navigation grid and keep the timer visible at all times.  Allow
   scrolling within the problem area without affecting the timer or
   navigation.
10. **Testing.**  Simulate a full attempt: entering the arena,
   working on problems, losing focus, resuming, marking problems as
   solved or reset, and letting the timer expire.  Verify that
   intervals are logged correctly, answers are saved, penalties are
   applied and the attempt auto‑submits when time runs out.

## Key Files

* `pages/mathlete/arena/[attemptId]/page.tsx`
* `components/ArenaAgreementModal.tsx`
* `components/ArenaTimer.tsx`
* `components/ProblemRenderer.tsx`
* `components/NavigationGrid.tsx`
* `components/AnswerInput.tsx`

## Verification

1. Mathletes cannot enter the arena before the official start time.
2. Accepting the agreement starts the attempt and logs an active
   interval.  Leaving and returning creates new intervals.
3. The timer counts down accurately and auto‑submits at zero.
4. Problems render correctly with math notation and images.  Answers
   are saved automatically and status flags update the navigation
   grid.
5. Focus loss triggers anti‑cheat penalties, logs offenses and
   displays warnings.  Penalty rules (warning, deduction, auto submit
   or disqualify) behave as configured.

## Git Branching

Recommended commit titles:

- `feat: create arena route and attempt creation endpoint`
- `feat: implement agreement modal and interval tracking`
- `feat: build timer, problem renderer and navigation grid`
- `feat: integrate answer saving and status flags`
- `feat: add focus detection and anti-cheat penalty handling`
- `fix: responsive layout and session resume logic`
- `test: arena end-to-end tests`

## Definition of Done

* The competition arena is fully functional for both scheduled and
  open competitions.
* Attempts persist across disconnects and enforce penalties for focus
  loss.
* Mathletes can solve problems, mark statuses and see remaining time.
* Checklist item `11-arena` can be marked complete after merge.
