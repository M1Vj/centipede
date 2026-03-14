# 10 – Competition Search, Registration & Calendar

## Mission

Develop the discovery and registration experience for mathletes.  Users
should be able to search for published competitions, view detailed
descriptions, register as individuals or teams, withdraw if needed,
receive notifications and view upcoming events on a calendar.  This
feature covers UR10 (competition search), UR11 (participation), UR11a
(descriptions), UR11b (notifications), UR11c (withdrawal) and UR12
(calendar display).

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/competition-search`
* **Requirements:** 08‑competition‑wizard, 09‑team‑management
* **Assigned to:** Mabansag, Vj and Abenoja, Jaaseia Gian R.

## Requirements

* Competitions can be in one of several states: draft (not visible),
  published (visible for registration), live, paused, completed or
  cancelled.  Only published competitions should appear in search
  results.
* Registration rules depend on competition type (individual vs team,
  scheduled vs open).  The backend enforces capacity limits and
  roster validations via triggers and RLS.
* Notifications are stored in the `notifications` table; mathletes
  should see confirmation messages for registration and withdrawal.

## Atomic Steps
0. **Research search and filtering techniques.**  Before building
   the list, investigate best practices for implementing fast,
   client‑side search and filtering in large data sets.  Look at
   open‑source projects or articles discussing debounced search
   inputs, infinite scrolling, virtualised lists (e.g. using
   `react‑window`) and full‑text search integration with Supabase.
   Optimise for quick results with minimal network latency and
   provide a smooth user experience on mobile.

1. **Competition list page.**  Create
   `app/mathlete/competitions/page.tsx` with a search bar and filters
   (by name, organizer, type, tags and date).  Fetch published
   competitions from Supabase via `supabase.from("competitions").select()`
   where `status = 'published'`.  Display results as cards using
   Shadcn components showing name, type (scheduled/open), format
   (individual/team), registration period, and remaining capacity.
2. **Competition detail page.**  Add a route
   `app/mathlete/competitions/[slug]/page.tsx`.  On click from the list
   page, navigate to this route, load full competition data (name,
   description, instructions, schedule, scoring rules, team size
   limits) and display them with proper typography.  Include a
   "Register" button that adapts to the user’s context (shows “Join
   Team” if team comp, disabled if full or registration closed).
3. **Registration logic.**  When mathletes click Register:
   * For individual competitions, call Supabase to insert into
     `registrations` with `profile_id = auth.uid()` and
     `competition_id`.  Handle server errors (e.g. duplicate
     registration, capacity exceeded) and display feedback.
   * For team competitions, prompt the user to select from their
     existing teams (list those from `team_members` where `role =
     'leader'`).  Insert into `registrations` with `team_id` and
     ensure the team meets min/max size requirements.  Lock the roster
     upon registration (can be implemented via trigger).
   * Send notifications to the mathlete (recipient) and to the
     competition organizer (e.g. type `competition_registration`).
4. **Withdrawal logic.**  Provide a “Withdraw” button if the user
   registered and the competition has not started.  On click, update
   `registrations.status = 'withdrawn'` via Supabase.  Only allow the
   registrant (individual or team leader) to perform this action.  Send
   a notification of the withdrawal.
5. **Competition descriptions.**  Ensure descriptions support rich
   text and mathematical formatting (Markdown/KaTeX) for rules and
   instructions.  Display caution notes for open competitions with
   multiple attempts and penalty rules.
6. **Notifications panel.**  Integrate a small bell icon in the
   header (if not already present) that opens a dropdown listing
   unread notifications.  Use Supabase Realtime to subscribe to the
   `notifications` channel so new messages appear instantly.  Each
   notification links back to the relevant competition or team page.
7. **Calendar view.**  Build a calendar component on a separate tab
   or page (`app/mathlete/calendar/page.tsx`).  Use a library like
   `react-calendar` or `FullCalendar` and feed it events representing
   registration periods and competition start/end times.  Convert
   timestamps to the user’s timezone.  Clicking on a date with
   competitions should display a popover listing competitions that
   start or end on that day with links to their detail pages.
8. **Time localization.**  Use `Intl.DateTimeFormat` or a library like
   `dayjs`/`date-fns` to display all dates in the mathlete’s
   timezone (Asia/Manila) with proper locale formatting.  Ensure the
   backend stores UTC timestamps and the frontend converts them.
9. **Testing.**  Populate sample competitions in Supabase (scheduled
   and open).  Verify search filters return the correct subset.  Test
   registration for individual and team comps, withdrawal, full
   capacity, and error cases (e.g. duplicate registration).  Test the
   calendar display and ensure notifications show up in real time.

## Key Files

* `pages/mathlete/competitions/page.tsx`
* `pages/mathlete/competitions/[slug]/page.tsx`
* `components/CompetitionCard.tsx`
* `components/CompetitionSearchBar.tsx`
* `components/RegistrationButton.tsx`
* `pages/mathlete/calendar/page.tsx`
* `components/CalendarView.tsx`
* `components/NotificationBell.tsx`

## Verification

1. Published competitions appear in search results with accurate
   filters and sorting.  Draft or cancelled competitions are hidden.
2. Mathletes can register individually or as teams, and the database
   reflects new `registrations` entries.  Capacity limits and roster
   validations are enforced.
3. Mathletes can withdraw before the competition starts.
4. Notifications are sent on registration and withdrawal and appear in
   the notification panel.  Real‑time subscriptions deliver new
   notifications instantly.
5. The calendar shows upcoming competitions localized to the user’s
   timezone.  Clicking events navigates to detail pages.

## Git Branching

Recommended commit titles:

- `feat: implement competition discovery list and filters`
- `feat: add competition detail page with registration logic`
- `feat: integrate notifications and real-time subscriptions`
- `feat: build calendar view for upcoming competitions`
- `fix: handle registration withdrawal and capacity limits`
- `test: e2e tests for competition search and registration`

## Definition of Done

* Mathletes can search, view and register for competitions, and
  withdraw if needed.
* Notifications and calendar entries reflect these actions in real
  time.
* All user interfaces adapt to individual vs team and scheduled vs
  open competitions.
* Checklist item `10-competition-search` can be marked complete after
  merge.
