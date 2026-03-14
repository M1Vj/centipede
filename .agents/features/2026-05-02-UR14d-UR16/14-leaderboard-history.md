# 14 – Leaderboard & History Archive

## Mission

Provide real‑time and published leaderboards for competitions and
create a history archive where mathletes and organizers can review
past participation, scores and export results.  This feature covers
UR15 (leaderboard display) and UR16 (history archive).

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/leaderboard-history`
* **Requirements:** 13‑review‑submission, 12‑anti‑cheat
* **Assigned to:** Abenoja, Jaaseia Gian R.

## Requirements

* A materialised view or function (`competition_leaderboard`) exists
  that computes rankings based on `competition_attempts.final_score`,
  `anti_cheat_deduction` and tie‑breakers.  The view must refresh
  whenever scores are recalculated.
* The `leaderboard_published` flag on `competitions` controls when
  scheduled competition results become visible to participants.
* `registrations` and `competition_attempts` have appropriate RLS to
  permit participants and organizers to view their own records.

## Atomic Steps
0. **Research leaderboard rendering and ranking.**  Study examples of
   real‑time leaderboards from competitive programming platforms,
   focusing on how they compute ranks, handle large data sets and
   update the UI efficiently.  Explore open‑source table
   virtualisation libraries (e.g. `react‑virtualized`) to improve
   performance when displaying many rows.  Use this research to
   design a leaderboard that updates smoothly in real time.

1. **Leaderboard component.**  Create a component
   `components/LeaderboardTable.tsx` that accepts competition ID and
   fetches ranking data from Supabase.  For scheduled competitions, if
   `leaderboard_published = false` and the viewer is not the
   organizer, display a message that results are not yet available.
   For open competitions or when published, display a table with
   columns: rank, name (or team name), score (with deductions shown),
   total time and offences.  Highlight the current user’s row.
2. **Competition leaderboard page.**  Create
   `app/competition/[id]/leaderboard/page.tsx`.  Use the leaderboard
   component and subscribe to Supabase Realtime on the
   `leaderboard_entries` table or view.  For open competitions,
   updates should appear instantly.  For scheduled competitions,
   updates appear only after publish.
3. **Publish leaderboard button.**  In the organizer’s competition
   dashboard, add a “Publish Leaderboard” button that is enabled when
   all attempts are graded and the competition has ended.  On click,
   set `competitions.leaderboard_published = true` and insert a row
   into `competition_events` with `event_type = 'published'`.  Send
   notifications to all participants.  Once published, the leaderboard
   page becomes available to mathletes.
4. **History listings (mathlete).**  Create a page at
   `app/mathlete/history/page.tsx` showing a list of competitions the
   mathlete has participated in.  Each entry displays the
   competition name, date, final rank (if available), score and a
   link to the answer key and dispute page.  Group entries by year or
   month for easier navigation.  Use infinite scrolling or
   pagination.
5. **History listings (organizer).**  Create a page at
   `app/organizer/history/page.tsx` listing competitions created by
   the organizer.  For each, display basic statistics (number of
   participants, average score, number of disputes) and actions to
   export results to CSV/Excel.  Use Supabase storage or serverless
   functions to generate and download exports.
6. **Export results.**  Implement a serverless function or Supabase
   edge function (if available) that queries all `leaderboard_entries`
   and associated profile/team data for a competition and returns a
   CSV/Excel blob.  Trigger this when the organizer clicks “Export
   Results” in the history page.  Limit access to the competition
   organizer and admins.
7. **Testing.**  Create sample competitions and attempts, publish
   leaderboards, and verify that mathletes see results only after
   publication.  Test real‑time updates for open competitions.  Verify
   history pages show correct data and that exports download properly.

## Key Files

* `pages/competition/[id]/leaderboard/page.tsx`
* `pages/mathlete/history/page.tsx`
* `pages/organizer/history/page.tsx`
* `components/LeaderboardTable.tsx`
* `components/HistoryItem.tsx`
* Serverless function file for result export

## Verification

1. Leaderboards show correct rankings and refresh automatically for
   open competitions.  Scheduled competitions remain hidden until
   published.
2. The publish button works only for the organizer and sends
   notifications to participants.
3. Mathletes see their competition history with scores and ranks.
4. Organizers see a summary of their competitions and can export
   detailed results.

## Git Branching

Recommended commit titles:

- `feat: implement leaderboard component and page`
- `feat: add publish leaderboard action and events`
- `feat: build history pages for mathletes and organizers`
- `feat: implement result export function`
- `test: leaderboard and history integration tests`

## Definition of Done

* Leaderboards and history archives are accessible and accurate.
* Publishing results triggers notifications and updates the UI.
* Export functionality works for organizers.
* Checklist item `14-leaderboard-history` can be marked complete after
  merge.
