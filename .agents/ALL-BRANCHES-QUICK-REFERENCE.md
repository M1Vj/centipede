# All Branches – Quick Reference

This cheat sheet lists every planned feature branch along with a one‑line
description of its scope.  Branch names omit dates and numbers; they
should follow the `feature/<slug>` pattern outlined in the atomic
structure document.  Refer to the corresponding `NN‑<slug>.md` files in
`features/` for detailed instructions.

| No. | Branch (example)          | Scope |
|----:|----------------------------|-------|
| 01 | `feature/foundation` | Initialize the Next.js + Supabase project, set up Tailwind and Shadcn UI, configure environment variables, and establish global layouts.
| 02 | `feature/authentication` | Implement Google OAuth and email/password authentication for mathletes, including sign‑up, login, single‑session enforcement and profile completion. |
| 03 | `feature/interaction-feedback` | Add shared UI responsiveness infrastructure: top loading bar, button pending states, loading/empty/error states, confirmation patterns, and route-level feedback used by all later branches. |
| 04 | `feature/admin-user-management` | Create admin dashboard for user management, organizer approval, and account moderation. Configure RLS policies for admin roles. |
| 05 | `feature/organizer-registration` | Build organizer application form and admin approval flow. |
| 06 | `feature/problem-bank` | Develop problem bank CRUD for organizers, including CSV import, problem types, metadata and image uploads. |
| 07 | `feature/scoring-system` | Add scoring rule configuration (automatic vs custom points, penalties, tie‑breakers) to be used later in competition wizard. |
| 08 | `feature/competition-wizard` | Implement the multi‑step competition creation wizard covering schedule, format, problem selection, anti‑cheat and publish workflow. |
| 09 | `feature/team-management` | Enable mathletes to create teams, invite members, manage rosters and transfer leadership. |
| 10 | `feature/competition-search` | Build search and discovery for competitions, registration and withdrawal logic, description display, notifications and calendar integration. |
| 11 | `feature/arena` | Create the competition arena with timer, problem rendering, auto‑saving answers, status flags and server‑synchronized sessions. |
| 12 | `feature/anti-cheat` | Implement tab‑switch logging and penalty enforcement with warning overlays and integration into live monitoring. |
| 13 | `feature/review-submission` | Provide answer review page, final submission, score computation, multiple attempts support and scoreboard logic. |
| 14 | `feature/leaderboard-history` | Implement leaderboard display for organizers and mathletes and build a history archive with export options. |
| 15 | `feature/notifications-polish` | Finalize the notification system, handle score recalculation, polish UI, fix bugs and prepare for release. |
| 16 | `feature/participant-monitoring` | Build organizer participant monitoring with live views, announcements and system logs. |
| 17 | `feature/testing-bug-fixes` | Conduct performance analysis, report and fix bugs, polish the UI and prepare the system for release. |
