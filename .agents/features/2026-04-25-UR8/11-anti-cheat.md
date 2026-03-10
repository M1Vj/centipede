# 11 – Anti‑Cheat & Monitoring

## Mission

Implement robust anti‑cheat measures to detect and penalise tab or
window switching during competitions and provide organizers with tools
to monitor live attempts.  This covers UR8 (tab switching logs) and
extends the arena by enforcing configurable penalties and exposing
logs to organizers.

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/anti-cheat`
* **Requirements:** 10‑arena
* **Assigned to:** Mabansag, Vj

## Requirements

* The `tab_switch_logs` table exists to record focus‑loss events.  The
  `competition_attempts` table contains fields for `anti_cheat_deduction` and
  `status` changes.  A JSON field or separate table (e.g.
  `competition_focus_penalties`) defines offense penalties.
* Organizers need a live monitoring view to track participant status
  and offences in real time.

## Atomic Steps
0. **Research anti‑cheat solutions.**  Investigate existing
   open‑source anti‑cheat or proctoring tools used in online exams
   and competitions.  Focus on reliable browser focus detection,
   tamper‑resistant timers and user feedback.  Learn from these
   implementations to design a solution that works across browsers
   and devices without sacrificing performance.

1. **Penalty configuration.**  Ensure competitions store penalty rules
   in a JSON field (`offense_penalties`) or a dedicated table with
   rows per offense number.  Penalties can be `'warning'`, a numeric
   point deduction, `'auto_submit'` or `'disqualify'`.  Add a UI
   component in the competition wizard (Feature 07) to edit these
   settings if not already implemented.
2. **Focus listener integration.**  In the arena (Feature 10), extend
   the focus detection logic to compute the next offense number by
   counting existing `tab_switch_logs` rows for the current attempt.
   Insert a new log row with `offense_no` and a reason (e.g.
   `'browser_focus_lost'`).  Retrieve the configured penalty for this
   offense and perform the corresponding action:
   * **Warning:** Display a modal notifying the mathlete of the
     penalty tiers.  Do not alter the score.
   * **Point deduction:** Update `competition_attempts.anti_cheat_deduction`
     by subtracting the configured amount.  Show a toast
     indicating points deducted.
   * **Auto submit:** Immediately call the grade RPC to submit the
     attempt.  Set `status = 'completed'` and apply existing
     deductions.
   * **Disqualify:** Update `competition_attempts.status = 'disqualified'` and
     redirect the user to a disqualification page explaining the
     reason.
3. **Live monitoring page.**  Create
   `app/organizer/competitions/[id]/monitor/page.tsx` displaying a
   table of active attempts with columns for participant name (or
   team), current question number, remaining time, number of tab
   offences and current score (updated via Realtime on the
   `leaderboard_entries` view).  Use Supabase Realtime to subscribe to
   `tab_switch_logs` and `leaderboard_entries` for the competition.
4. **Logs modal.**  Provide an action on each row to open a modal
   showing the detailed tab switch log for that participant: offense
   number, timestamp and penalty applied.  Allow organizers to reset
   an attempt (inserting a new interval and clearing existing
   `tab_switch_logs`) if there was a legitimate connectivity issue.
5. **Pause/resume control.**  In the monitor page, add buttons for
   pausing or resuming an open competition.  On pause, insert a row
   into `competition_events` with `event_type = 'paused'`.  Set
   `competitions.status = 'paused'`.  This should prevent new attempts
   from starting (enforced in the registration logic) but allow
   existing participants to finish.  On resume, insert a row with
   `event_type = 'resumed'` and update status accordingly.  Display
   banners in the arena when competitions are paused.
6. **Testing.**  Start a competition and join as multiple mathletes.
   Trigger tab switches and verify logs are recorded and penalties
   applied according to the configured rules.  Open the monitor page
   as the organizer and confirm that offences and scores update in
   real time.  Pause and resume the competition and observe that
   participants are notified and new attempts cannot be created.

## Key Files

* `components/FocusListener.tsx` (extends logic from Feature 10)
* `pages/organizer/competitions/[id]/monitor/page.tsx`
* `components/ParticipantMonitoringTable.tsx`
* `components/TabSwitchLogModal.tsx`
* `components/PauseResumeControls.tsx`

## Verification

1. Tab switching triggers log entries with sequential offense numbers.
2. Penalties (warnings, deductions, auto‑submission, disqualification)
   are enforced as configured and reflected in the attempt record.
3. Organizers can view live attempt status, offences and scores in
   real time.  Logs can be viewed per participant.
4. Pausing a competition prevents new attempts from starting and
   records an event, while resuming allows new attempts.  Participants
   already in the arena can finish uninterrupted.

## Git Branching

Recommended commit titles:

- `feat: add competition focus penalty configuration`
- `feat: integrate anti-cheat logs and penalty enforcement`
- `feat: implement organizer monitoring dashboard`
- `feat: add pause/resume controls and competition events`
- `fix: handle resets and legitimate reconnects`
- `test: anti-cheat and monitoring end-to-end tests`

## Definition of Done

* Anti‑cheat logging and penalty logic operate seamlessly within the
  arena.
* Organizers have a live monitoring interface with the ability to
  pause/resume competitions and review logs.
* Checklist item `11-anti-cheat` can be marked complete after merge.