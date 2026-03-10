# 08 – Team Management

## Mission

Enable mathletes to form and manage teams for team‑based competitions.
This includes creating a team, inviting members, handling
accept/decline responses, managing rosters and transferring leadership
when a leader leaves.  Team management is critical for UR9, UR9a,
UR9b and UR9c.

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/team-management`
* **Requirements:** 07‑competition‑wizard
* **Assigned to:** Mabansag, Vj

## Requirements

* The tables `teams`, `team_members`, and `team_invites` exist in the
  database along with corresponding RLS policies.
* Authentication and profiles are in place so that only logged‑in
  mathletes can create or join teams.

## Atomic Steps
0. **Research team management practices.**  Review open‑source
   examples of team management features in web applications (e.g.
   project management tools, collaborative platforms) to understand
   how invites, memberships and leadership transfers are handled.
   Assess UI patterns and components that make roster management
   intuitive on both desktop and mobile.  Use this research to
   design an efficient and accessible team management workflow.

1. **Teams dashboard.**  Add a new top‑level page at
   `app/mathlete/teams/page.tsx` displaying the user’s current team (if
   any) or a call‑to‑action to create one.  Fetch the user’s
   memberships via Supabase and show the team name and roster.
2. **Create team form.**  Implement a modal or separate page
   `app/mathlete/teams/create/page.tsx` with a form to input a unique
   team name.  On submit, call Supabase to insert a row into
   `teams` with `created_by = auth.uid()` and generate a random
   `team_code`.  Immediately insert a row into `team_members` with
   `role = 'leader'` for the creator.  Redirect back to the teams
   dashboard and display the new team.
3. **Invite members.**  Add an “Invite” button to the team roster
   view.  Launch a modal that allows the leader to search users by
   username or paste a generated team code.  On invite, insert into
   `team_invites` with `team_id`, `inviter_user_id` and
   `invitee_user_id`.  Display pending invites in the roster view and
   send an in‑app notification to the invitee.
4. **Accept/decline invites.**  Provide a section in
   `pages/notifications` or a dedicated “Invitations” page where
   mathletes see incoming team invites.  Each invite has Accept and
   Decline buttons.  On accept, insert a row into `team_members`
   (`team_id`, `user_id`, `role = 'member'`) and update
   `team_invites.status = 'accepted'`.  On decline, update the invite
   status only.  Ensure RLS policies restrict these actions to the
   invitee.
5. **Remove members & leave team.**  In the team roster view, allow
   the leader to remove a member and allow any member to leave.  For
   leader removal or self‑leave, update or delete the corresponding
   `team_members` row.  If the leader leaves, automatically transfer
   leadership to the next longest‑tenured member (`joined_at` order).
6. **Leadership transfer.**  Implement logic to determine the new
   leader: query all active members ordered by `joined_at` and update
   `teams.leader_user_id` when the current leader exits.  Notify the
   new leader via the notification system.
7. **RLS & validation.**  Validate team names are unique across
   `teams.name`.  Enforce RLS policies: only leaders can invite or
   remove members; only invitees can accept/decline invites; admins can
   view all teams for moderation.  Test failure cases (non‑leader
   cannot invite or remove members).
8. **UI/UX polish.**  Use Shadcn UI components for forms and tables.
   Ensure the roster displays member roles and join dates.  Provide
   tooltips or confirmations before destructive actions.
9. **Testing.**  As a mathlete, create a team, invite several
   accounts, accept an invite from a secondary account, decline from
   another.  Verify roster updates, notifications trigger, and RLS
   prevents unauthorized actions.  Test leadership transfer by having
   the leader leave and ensuring another member becomes leader.

## Key Files

* `pages/mathlete/teams/page.tsx`
* `pages/mathlete/teams/create/page.tsx`
* `components/TeamList.tsx`
* `components/TeamForm.tsx`
* `components/InviteModal.tsx`
* `components/RosterTable.tsx`

## Verification

1. Mathletes can create a team and become the leader.
2. Leaders can invite other mathletes, and invitees receive
   notifications.
3. Invites can be accepted or declined, creating or ignoring
   `team_members` entries accordingly.
4. Leaders can remove members; members can leave.  Leadership
   transfers automatically when the leader exits.
5. RLS policies enforce that only authorized users can modify team
   membership data.

## Git Branching

Recommended commit titles:

- `feat: scaffold my teams page and team creation form`
- `feat: implement team invites and accept/decline flow`
- `feat: add roster management and leadership transfer logic`
- `fix: apply RLS checks and validation for team actions`
- `test: end‑to‑end tests for team management`

## Definition of Done

* Mathletes can fully manage teams, including creation, invitations,
  acceptance/decline, roster edits and leadership transfer.
* Notifications fire appropriately on invites and leadership changes.
* RLS policies restrict team operations to authorized users.
* Checklist item `08-team-management` can be marked complete after
  merge.