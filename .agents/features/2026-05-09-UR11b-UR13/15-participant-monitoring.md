# 15 – Participant Monitoring

## Mission

Empower organizers to view and manage participants during active
competitions.  This includes viewing registration lists, monitoring
live attempts, sending announcements, pausing or resuming
competitions, and reviewing event logs.  It implements UR13
(participant monitoring) and extends the anti‑cheat and live
monitoring features.

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/participant-monitoring`
* **Requirements:** 11‑anti‑cheat, 07‑competition‑wizard, 08‑team‑management
* **Assigned to:** Mabansag, Vj

## Requirements

* Registrations and attempts exist and RLS permits organizers to
  access their competitions’ data.  The `competition_events` table
  records state changes.  Notifications and announcements are enabled.

## Atomic Steps
0. **Research live monitoring dashboards.**  Look into open‑source
   solutions for live participant monitoring (e.g. classroom or
   tournament dashboards) to see how they visualise real‑time data,
   handle large numbers of concurrent users and enable moderator
   actions.  Adapt ideas from these examples to design an intuitive
   participants tab with clear status indicators and controls.

1. **Participants tab.**  In the organizer dashboard, add a tab
   “Participants” for each competition.  Create
   `app/organizer/competitions/[id]/participants/page.tsx` that lists
   all registrations with columns: mathlete/team name, status
   (`registered`, `withdrawn`, `ineligible`), registration timestamp
   and actions.  Use filters for team vs individual view and search by
   name.
2. **Registration details & actions.**  For each participant entry,
   provide actions depending on status:
   * For `registered` entries, allow the organizer to send a direct
     message (notification) or mark the participant/team `ineligible` if
     rosters violate rules.
   * For `withdrawn` or `ineligible` entries, display reason and
     disable actions.
   * Provide a link to the participant’s attempt once started.
3. **Live monitoring panel.**  For competitions that are live,
   display a real‑time panel showing all active attempts (similar to
   Feature 11).  Include progress indicators (question number,
   remaining time), offense count, current score and connection
   status.  Colour‑code rows based on risk (e.g. many offences or
   near time expiry).  Subscribe to `leaderboard_entries` and
   `tab_switch_logs` via Supabase Realtime.
4. **Announcements broadcast.**  Implement a form at the top of the
   monitoring panel where organizers can type a short announcement and
   broadcast it to all registered participants.  On submit, insert
   into `competition_announcements` with `audience = 'all_active'` and
   use Realtime to push the message to participants’ clients.  Show a
   toast confirmation after sending.
5. **Pause/resume and extend.**  Provide controls to pause or resume
   competitions (leveraging Feature 11).  In addition, allow
   organizers to extend the competition duration by a set amount of
   minutes.  On extend, insert into `competition_events` with
   `event_type = 'extended'` and update the competition’s
   `ends_at`/duration.  Notify participants of the extension via
   announcements.
6. **Event log timeline.**  Add a sidebar or modal displaying the
   chronological event log from `competition_events`.  Each entry
   shows the event type, actor and timestamp.  This helps trace
   changes (published, paused, resumed, extended) and justify
   duration calculations.
7. **Testing.**  Create a mock competition, register several
   participants and simulate a live event.  Monitor the participants
   tab and verify that live statuses update correctly.  Send
   announcements, pause/resume the competition and extend its
   duration.  Review the event log and ensure all actions are
   recorded.  Verify notifications are delivered to participants.

## Key Files

* `pages/organizer/competitions/[id]/participants/page.tsx`
* `components/ParticipantsTable.tsx`
* `components/LiveMonitoringPanel.tsx`
* `components/AnnouncementForm.tsx`
* `components/CompetitionEventTimeline.tsx`

## Verification

1. Organizers can view all registrations for a competition and take
   appropriate actions (message, mark ineligible).
2. Live monitoring shows real‑time information about active attempts
   and offence counts.  Announcements are broadcast instantly.
3. Competitions can be paused, resumed or extended, and these
   actions are logged and reflected in the arena timers.
4. Event logs provide a clear timeline of state changes for each
   competition.

## Git Branching

Recommended commit titles:

- `feat: implement participants tab with registration actions`
- `feat: build live monitoring panel and real-time subscriptions`
- `feat: add announcements broadcast and pause/resume/extend controls`
- `feat: show competition event timeline`
- `test: participant monitoring end-to-end tests`

## Definition of Done

* Organizers have comprehensive tools to monitor and manage
  participants during competitions.
* Announcements, pause/resume and extension controls work smoothly and
  update all clients via Realtime.
* Event logs are persisted and display an accurate timeline.
* Checklist item `15-participant-monitoring` can be marked complete
  after merge.