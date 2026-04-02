# Process Flow

This file restates the operational process flow for Mathwiz Arena inside the repository so implementation agents do not need any external local files. It is the product-flow source of truth for role behavior, feature sequencing expectations, and cross-feature edge cases.

## Requirement Index

| User Requirement Step | Functional Requirement ID | Functional Name | Requirement Summary |
| --- | --- | --- | --- |
| UR1 | FR1.0 | Account Registration | Mathletes create an account using Google OAuth. |
| UR2 | FR2.0 | Organizer Eligibility | Organizers apply for eligibility before gaining organizer access. |
| UR3 | FR3.0 | User Login | Mathletes, organizers, and admins log in securely, with strict single-session enforcement. |
| UR4 | FR4.0 | User Management | Admins manage users, approvals, updates, suspension, and removals. |
| UR5 | FR5.0 | Admin Resource Access | Admins can access organizer resources for review, moderation, and operational support. |
| UR6 | FR6.0 | Problem Bank Management | Organizers manage reusable problem banks and problem items. |
| UR6a | FR6.1 | Scoring Rules | Organizers configure scoring, penalties, and tie-breakers. |
| UR7 | FR7.0 | Competition Management | Organizers create and manage scheduled competitions. |
| UR7a | FR7.1 | Team Competition Support | The system supports team-based competitions. |
| UR7b | FR7.2 | Open Competition Support | The system supports open competitions with multiple attempts. |
| UR8 | FR8.0 | Tab Switching Logs | Organizers can inspect tab-switching logs and anti-cheat events. |
| UR9 | FR9.0 | Team Creation | Mathletes create and manage teams. |
| UR9a | FR9.1 | Member Invitation | Team leaders invite members. |
| UR9b | FR9.2 | Invitation Response | Invited members accept or decline. |
| UR9c | FR9.3 | Team Member Management | Leaders remove members, members leave teams, and leadership auto-transfers when needed. |
| UR10 | FR10.0 | Competition Search | Mathletes search available competitions. |
| UR11 | FR11.0 | Competition Participation | Mathletes register for scheduled, open, individual, and team competitions. |
| UR11a | FR11.1 | Competition Descriptions | Mathletes view competition descriptions. |
| UR11b | FR11.2 | System Notifications | Mathletes receive schedule, result, and announcement notifications. |
| UR11c | FR11.3 | Registration Withdrawal | Mathletes can withdraw from competitions before they start. |
| UR12 | FR12.0 | Calendar Display | Mathletes see competition schedules in a timezone-localized calendar. |
| UR13 | FR13.0 | Participant Monitoring | Organizers view registered and active participants. |
| UR14 | FR14.0 | Competition Arena Entry | Mathletes enter the arena when the competition starts. |
| UR14a | FR14.1 | Arena Timer | Mathletes see an active competition timer in the arena. |
| UR14b | FR14.2 | Problem Status Flagging | Mathletes flag problems as solved or reset, with server-sided timing for resumption. |
| UR14c | FR14.3 | Mathematical Input | Mathletes enter mathematical notation in answers. |
| UR14d | FR14.4 | Answer Review | Mathletes review answer summaries before final submission. |
| UR14e | FR14.5 | Answer Key Display | Mathletes can view the answer key after the competition ends. |
| UR15 | FR15.0 | Leaderboard Display | Mathletes and organizers can view competition leaderboards. |
| UR16 | FR16.0 | History Archive | Mathletes and organizers can view past competitions and results. |

## Admin Process Flow

### Sidebar Navigation

- Home
- Dashboard
- Problem Bank
- Competitions
- Notifications
- History
- User Management
- Content Moderation
- System Logs
- Settings
- Log-Out

### Flow

1. Admins authenticate through the trusted admin login path and land in the admin workspace.
2. Admins review organizer-eligibility submissions and approve or reject them with explicit reasons.
3. On approval, the system promotes the organizer account and sends the appropriate organizer onboarding communication.
4. Admins can update, suspend, or remove organizer and mathlete accounts.
5. Admins have global read access to organizer-created problem banks and competitions.
6. Admins can moderate inappropriate content, force-pause broken competitions, inspect live competition state, and support operational incidents.
7. Admins manage the default shared problem bank using the same authoring flows organizers use.

### Admin Implementation Rules

- Organizer approval must be a trusted backend mutation with audit logging.
- Rejection must preserve a reason and surface clear status to the applicant.
- Admin self-destructive actions must be blocked in both UI and backend logic.
- Admin read access to organizer resources must not bypass ownership semantics for organizer-facing views.
- Operational moderation actions such as delete, pause, or live support must be logged.

## Organizer Process Flow

### Sidebar Navigation

- Home
- Dashboard
- Problem Bank
- Competitions
- Notifications
- History
- Settings
- Log-Out

### Flow

1. Organizers apply for eligibility by submitting personal and organizational data, optional logo, and legal consent.
2. After approval, organizers receive access credentials and complete their initial profile verification.
3. Organizers create problem banks with a name and optional description.
4. Organizers create problem items manually or through bulk import.
5. Problem items support math notation, optional image uploads, and these types:
   - Multiple Choice with unique choices
   - True/False
   - Numeric
   - Identification
6. Numeric and identification problems can accept multiple correct answers when edge cases require it.
7. Organizers classify each problem by difficulty and tags.
8. Deleting a problem bank or problem removes it from draft competition work, but published competition content must remain protected through immutable snapshots.
9. Organizers create competitions through a multi-step wizard:
   - Overview
   - Schedule
   - Format
   - Problems and anti-cheat
   - Summary and publish
10. Scheduled competitions require registration windows, competition date, start time, and duration. They allow exactly one attempt.
11. Open competitions require duration and may allow between one and three attempts without a global schedule window.
12. Individual competitions define participant caps.
13. Team competitions define participants per team and team-count caps, and apply only to scheduled competitions.
14. Organizers select 10 to 100 problems from owned or shared banks.
15. Organizers configure scoring using automatic difficulty-based scoring or custom points, optional penalties, tie-breakers, and open-competition multiple-attempt grading policy.
16. Organizers configure anti-cheat behavior including question shuffling, option shuffling, tab-switch logging, and offense-tier penalties.
17. Publish remains unavailable until the full wizard validates successfully.
18. Organizers can pause open competitions, monitor live scheduled competitions, broadcast announcements, and reset attempts for legitimate disconnect cases.
19. After competition completion, organizers review disputes, recalculate scores if answer keys were wrong, publish leaderboards when appropriate, and export result data.

### Organizer Implementation Rules

- Organizer username must remain immutable after approval; password recovery is allowed.
- Problem bank descriptions are capped at 200 words.
- Competition descriptions are capped at 500 words.
- Competition names must be unique enough to prevent duplicate published competitions by the same organizer.
- Open competitions cannot be deleted while active attempts are still running.
- Published competitions must preserve immutable problem and scoring snapshots.
- Recalculation must be an explicit trusted action after accepted disputes or corrected answer keys.

## Mathlete Process Flow

### Sidebar Navigation

- Home
- Dashboard
- My Teams
- Competitions
- Notifications
- Settings
- Log-Out

### Flow

1. Mathletes register and authenticate with Google OAuth.
2. On first login, mathletes must complete their profile with display name, school, and grade level before joining competitions.
3. Strict single-session enforcement terminates older sessions when the same account logs in somewhere else.
4. Mathletes browse upcoming and live competitions through search and calendar views.
5. All competition schedules must display in the user’s local timezone.
6. Mathletes can create teams, become team leaders, invite members, and manage roster changes.
7. Team names must be unique across the platform.
8. Team invitations can be accepted or declined, and acceptance must be blocked if the user is already committed to an incompatible event roster.
9. Team rosters lock once successfully registered for a scheduled team competition, except for defensive handling around account deletion or invalidated eligibility.
10. If a leader leaves or loses the account, leadership transfers to the next longest-tenured active member.
11. Mathletes or team leaders register for competitions, and the system validates limits and team-size requirements at registration time.
12. Invalidated registered teams become ineligible rather than being silently withdrawn.
13. Mathletes receive reminders and organizer communications through system notifications.
14. Withdrawals are allowed before competition start.
15. The arena entry button for scheduled competitions remains disabled until the exact server start time.
16. Before entering the arena, mathletes must accept the organizer rules and anti-cheat acknowledgement, including device-responsibility warnings.
17. During the arena, mathletes answer problems using supported math input, with autosave and live status updates for blank, filled, solved, or reset states.
18. Browser focus loss hides the questions, forces a warning acknowledgement overlay, logs the event, and applies the organizer-configured penalty.
19. Legitimate reconnects do not trigger tab-switch penalties automatically, but offline time must still reduce the remaining trusted time.
20. Mathletes review their answers before submission and confirm final submission explicitly.
21. On timer expiration, the system locks the UI and auto-submits the current state.
22. Open competitions with remaining attempts can present a re-attempt path and must warn clearly about the selected grading policy.
23. After competition end, mathletes can review the answer key, inspect published leaderboards, dispute questionable problems, and view historical results.
24. If recalculation changes a score, the system must notify the affected mathlete.

### Mathlete Implementation Rules

- Google OAuth is the required registration path in release one.
- Profile completion is mandatory before joining competitions.
- Calendar and schedule views must use device-localized timezone presentation.
- Arena timing is always server-authoritative.
- Anti-cheat warnings must make it explicit that any browser-focus loss can count as an offense.
- Reconnect handling must distinguish legitimate recovery from punishable focus-loss events.

## Cross-Feature Product Rules Captured From Flow

- Admins, organizers, and mathletes each have distinct sidebar shells and operational surfaces.
- Organizer and admin notifications are grouped and role-relevant rather than generic inbox spam.
- Team ineligibility, leaderboard publication, answer-key visibility, and score recalculation are all explicit product flows, not optional polish.
- Competition deletion, pause/resume, and publication all require defensive rules to prevent unsafe state transitions.
- Exports are part of the organizer history workflow, not a separate optional add-on.
