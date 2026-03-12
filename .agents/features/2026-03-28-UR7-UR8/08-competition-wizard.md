# 08 – Competition Creation Wizard

## Mission

Develop a five‑page wizard that guides organizers through creating a
competition.  The wizard should collect basic details, scheduling
information, format settings (individual or team), problem selection and
anti‑cheat options.  It should validate inputs on each page and allow
organizers to review and publish the competition.

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/competition-wizard`
* **Requirements:** 06‑problem-bank, 07‑scoring-system
* **Assigned to:** Mabansag, Vj

## Requirements

* Competitions, competition_problems and scoring fields exist.
* Organizer dashboards and problem banks are operational.

## Atomic Steps
0. **Research wizard UI patterns.**  Before implementing, search
   for open‑source multi‑step wizard components and study how they
   handle state management, validation and navigation.  Evaluate
   libraries such as `radix‑ui/stepper`, `react‑step‑wizard` or
   custom implementations to determine the most suitable approach for
   a responsive, mobile‑friendly wizard.  Ensure the chosen pattern
   aligns with the design system and performance goals.

1. **Wizard routing structure.**  Create a nested route
   `app/organizer/competitions/create/[step]/page.tsx` where
   `[step]` can be `overview`, `schedule`, `format`, `problems` and
   `summary`.  Use `useRouter()` to control navigation between steps
   and persist state in context or a store (e.g. Zustand).
2. **Page 1 – Overview.**  Collect the competition’s `name`,
   `description` (max 500 words) and `instructions`.  Validate that
   names are unique per organizer.
3. **Page 2 – Schedule.**  For scheduled competitions, input
   `registration_start`, `registration_end`, `start_time` and
   `duration_minutes`.  Calculate `registration_end` and `start_time`
   validations.  For open competitions, only set `duration_minutes` and
   allowed attempts (1–3).  Use a date picker localised to the user’s
   timezone.
4. **Page 3 – Format.**  Choose `format` (Individual/Team) and, if
   team, set `participants_per_team` (min 2, max 5) and `max_teams`.
   Display warnings that team mode is only available for scheduled
   competitions.  If open competition is selected, hide team options.
5. **Page 4 – Problems & Anti‑Cheat.**  Allow selecting problems from
   the organizer’s banks.  Provide filters by topic/difficulty and a
   count (10–100 problems).  Let organizers choose scoring mode
   (Automatic/Custom), specify penalties and tie‑breakers (using
   inputs from Feature 06).  Add toggles for `shuffle_questions`,
   `shuffle_options` and `log_tab_switch`.  Provide controls for
   offense penalties (warning, deduction, disqualification).
6. **Page 5 – Summary & Publish.**  Display a summary of all inputs.
   Validate that all required fields are filled.  Provide buttons
   “Publish” (inserts into `competitions` and `competition_problems`)
   and “Save Draft” (inserts with `published=false`).  Prevent
   publishing two competitions with the same name.  After publishing,
   redirect to the competition details page.
7. **Validation & Error Handling.**  On each step, validate inputs
   synchronously and display inline errors.  Prevent navigation to
   the next page until the current page is valid.  Handle server
   errors gracefully when inserting competitions.
8. **Testing.**  Go through the wizard end‑to‑end as an organizer.
   Create competitions with various configurations (scheduled vs open,
   individual vs team).  Verify that competitions are saved in the
   database and appear in the dashboard.  Attempt to publish with
   duplicate names and confirm it fails.

## Key Files

* `pages/organizer/competitions/create/[step]/page.tsx`
* `components/CompetitionWizardContext.tsx` (state management)
* `components/ProblemPicker.tsx`
* `components/ScoringConfig.tsx`
* `components/AntiCheatConfig.tsx`

## Verification

1. Creating a competition via the wizard inserts rows into
   `competitions` and `competition_problems` with the correct data.
2. All validations enforce required fields and correct ranges (e.g.
   duration > 0, at least 10 problems selected).
3. The publish button is disabled until the summary page has no
   errors.  Draft competitions can be saved and resumed later.
4. Competition names must be unique per organizer; attempting to
   create a duplicate shows an error.

## Git Branching

Recommended commit titles:

- `feat: scaffold competition creation wizard routing and context`
- `feat: implement overview and schedule steps`
- `feat: implement format step with team settings`
- `feat: add problem selection and anti‑cheat configuration`
- `feat: implement summary page and publish logic`
- `test: competition wizard end‑to‑end tests`

## Definition of Done

* Organizers can create competitions through a guided wizard.
* All required fields and configurations are validated.
* Competitions are persisted in the database and visible in the
  dashboard.
* Checklist item `08-competition-wizard` can be marked complete after
  merge.
