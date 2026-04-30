# Manual Testing Notes & PR Feedback

Based on manual testing of this PR, here is a summary of verified behaviors, identified bugs, and features deferred to the next release.

### 🐛 Bugs & Issues Found

**Mathlete Dashboard & Flow:**
- **Upcoming Competitions State:** Competitions remain in the "Upcoming Competitions" section even when the countdown timer hits `00:00:00`.
- **Open Competition Flow:** Since open competitions have no registration, taking a quiz incorrectly flags as a registration. The competition card is placed in "My Registrations" instead of "Live". Clicking "Start" from there moves it to "Live", which is a bug in the flow.
- **Ended Competition Routing:** When a competition ends, it remains in "My Registrations". Clicking "View Details" incorrectly routes the user to the main competition arena (if it was started) or the details page, continuing to allow interaction with an ended competition.
- **Timer:** The competition does not transition to an "Ended" state when the remaining time hits `00:00:00`.

**Team Registrations:**
- **Leaving a Registered Team:** If a user registers for a team competition and subsequently leaves that team, the competition remains in their "My Registrations". Clicking the card removes the registration and allows them to register again. Users should be blocked from leaving a team with an active registration, or the UI should immediately reflect the change.
- **Duplicate Member Registrations:** After a team leader successfully registers a team (and it appears for all members), an individual member is not blocked from registering for the exact same competition with a *different* team.

**Organizer Dashboard:**
- **Starting Published Competitions:** After publishing a competition, the card transitions to the "Published" stage (the "Edit Draft" button is replaced by "Manage"). However, the ability to actually *Start* the competition is no longer available.

---

### ✅ Verified Working

**Mathlete Capabilities:**
- **Registration Logistics:** Registration timing verification and team registration are functioning correctly.
- **Withdrawals:** Mathletes can withdraw their registration, and this accurately reflects on the Organizer's end.
- **Dashboard Synchronization:** The dashboard successfully reflects registered competitions, automatically updates countdowns, and transitions competitions to "Live".
- **Arena Access:** Users can join the arena for scheduled and open competitions (review and submit functionality pending).
- **Team Roles:** 
  - Only the team leader can register their team for a team competition.
  - Team members and leaders can see the registered competition in their "My Registrations" section.
  - Verified that only the team leader can actually *take* the test, while members can still see the live competition on their dashboard.
- **UI:** The Mathlete UI has been updated to the finalized design (pending final review).

**Organizer Capabilities:**
- **Management:** Organizers can view registered participants (including team participants) and manage their published competitions.
- **Manual Ending:** Manually ending a competition works correctly and successfully removes the live competition from the Mathlete dashboard.

---

### 🚀 Missing / Deferred to Next Release

- **Competition Controls:** Ability to Pause, End (automatic), or Delete a competition.
- **Published Competition Management UI:** A fully dedicated management UI for published competitions to view and manage participants (partially working, needs completion).
- **Live Competition View:** Real-time tracking mechanism / Arena view for Organizers to monitor ongoing competitions.
- **Post-Competition Reporting:** Generation and viewing of reports and analytics for completed competitions.