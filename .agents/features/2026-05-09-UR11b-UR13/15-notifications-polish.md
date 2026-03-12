# 15 – Notifications & Polish

## Mission

Finalize the notification system, implement user preferences, deliver
email notifications and perform comprehensive UI/UX polishing and bug
fixing.  This feature primarily covers UR11b (system notifications)
and general application refinement prior to release.

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/notifications-polish`
* **Requirements:** 14‑leaderboard‑history
* **Assigned to:** Mabansag, Vj (with assistance from Abenoja, Jaaseia Gian R.)

## Requirements

* The `notifications` and `notification_preferences` tables exist and
  have appropriate RLS.  Realtime subscriptions are enabled on
  `notifications` and `leaderboard_entries`.
* Email delivery is configured through Supabase or a third‑party
  provider for critical notifications.
* All pages comply with the design system, support dark mode and are
  accessible.

## Atomic Steps
0. **Research notification frameworks.**  Search for open‑source
   notification systems and messaging frameworks that integrate with
   Next.js and Supabase.  Compare in‑app toast libraries,
   email services (e.g. SendGrid, Postmark) and Realtime patterns to
   ensure reliable delivery and good UX.  Use this research to
   implement a notification system that is scalable and responsive.

1. **Notification panel UI.**  Create a global notification bell
   component if not already implemented.  Clicking the bell opens a
   sidebar or dropdown listing unread notifications.  Each item
   displays a title, short body, timestamp and a link to the relevant
   resource.  Provide a “Mark all as read” option that updates
   `notifications.is_read` and `read_at` for all of the user’s
   notifications.
2. **Notification preferences page.**  Add a settings page
   `app/settings/notifications/page.tsx` where users can toggle
   receiving in‑app and email notifications for each `notification_type`.
   Bind these to the `notification_preferences` table.  Use a form
   library like `react-hook-form` to persist changes.  Ensure RLS
   restricts updates to the owner.
3. **Email notifications.**  Configure Supabase’s SMTP or integrate
   with a transactional email service (e.g. SendGrid).  Implement
   serverless functions to send emails for critical events: organizer
   application decisions, registration confirmations, leaderboard
   publications, dispute resolutions and score recalculations.  Use
   dynamic templates and respect user preferences.
4. **Score recalculation and announcements.**  When organizers edit
   answer keys and click “Recalculate Scores,” ensure the grading
   function reruns and sends notifications (`notification_type =
   'score_recalculated'`) to affected participants.  Broadcast
   announcements through `competition_announcements` and display them
   in real time via subscriptions.
5. **UI/UX polish.**  Conduct a comprehensive review of all pages:
   * Align components with the design system (colours, typography,
     spacing) and verify dark mode support.
   * Improve accessibility by adding ARIA labels, keyboard navigation,
     alt text for images and proper semantic markup.
   * Optimise performance by lazy loading heavy components and
     compressing images.
   * Uniform error handling and feedback messages across forms.
6. **Minor bug fixes.**  Address any outstanding bugs discovered
   during development or testing (see Feature 16).  Use end‑to‑end
   testing to ensure no regressions.
7. **Testing.**  Verify notifications deliver correctly in real time
   and via email.  Test preference toggles, score recalculations,
   announcements and UI accessibility.  Run Lighthouse or similar
   tools for performance and accessibility reports.

## Key Files

* `components/NotificationBell.tsx`
* `components/NotificationsPanel.tsx`
* `pages/settings/notifications/page.tsx`
* Serverless functions for email delivery and score recalculation
* CSS/utility files for design polish

## Verification

1. Users receive notifications in the app and by email according to
   their preferences.
2. Notifications list shows correct information and can be marked
   read.  Preferences persist and restrict delivery channels.
3. Score recalculation updates scores, sends notifications and
   refreshes the leaderboard.
4. The entire application meets design and accessibility standards.

## Git Branching

Recommended commit titles:

- `feat: implement notification preferences and panel`
- `feat: add email notification functions`
- `feat: integrate score recalculation and announcements`
- `chore: polish UI and improve accessibility`
- `fix: miscellaneous bugs discovered during polish`

## Definition of Done

* The notification system is complete, configurable and reliable.
* All pages are visually consistent, accessible and performant.
* Minor bugs identified during development are resolved.
* Checklist item `15-notifications-polish` can be marked complete
  after merge.
