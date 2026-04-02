# Database, EDR & RLS Design

This document describes the database schema, entity relationships and
row‑level security (RLS) rules used by Mathwiz Arena.  It serves as
both a reference for developers and a living specification that must
be updated whenever the backend evolves.  A change log is provided at
the end to track modifications over time.

## 1. Database Schema

The application uses **Supabase** (PostgreSQL) to store all data.  Each
table includes a `created_at` timestamp and a primary key `id` (UUID)
unless otherwise noted.  Foreign keys are indicated with an arrow
`→`.

### 1.1 Profiles

| Column            | Type     | Notes |
|-------------------|---------|-------|
| `id`              | UUID PK | Matches Supabase auth user ID |
| `email`           | Text    | Normalised email address |
| `full_name`       | Text    | Display name chosen by user |
| `role`            | Enum    | `'mathlete'`, `'organizer'`, `'admin'` |
| `school`          | Text    | Mathlete’s school (nullable) |
| `grade_level`     | Text    | Mathlete’s year level (nullable) |
| `organization`    | Text    | Organizer’s affiliation (nullable) |
| `approved_at`     | Timestamp | When an organizer was approved (nullable) |
| `is_active`       | Boolean | Soft‑delete flag |
| `created_at`      | Timestamp | Defaults to now() |
| `updated_at`      | Timestamp | Auto‑updated |

*Notes*: `role` determines access.  Organizers are initially inserted
with `approved_at` NULL; once an admin approves the application the
timestamp is set.

### 1.2 Organizer Applications

| Column         | Type     | Notes |
|---------------|---------|-------|
| `id`          | UUID PK | |
| `profile_id`  | UUID FK → profiles.id | Applicant |
| `statement`   | Text    | Description of credentials |
| `logo_url`    | Text    | URL of uploaded logo (nullable) |
| `status`      | Enum    | `'pending'`, `'approved'`, `'rejected'` |
| `rejection_reason` | Text | Optional admin note |
| `submitted_at`| Timestamp | Defaults to now() |
| `reviewed_at` | Timestamp | When admin acted (nullable) |

### 1.3 Teams and Memberships

**Teams**

| Column         | Type     | Notes |
|---------------|---------|-------|
| `id`          | UUID PK | |
| `name`        | Text    | Unique across platform |
| `created_by`  | UUID FK → profiles.id | Initial leader |
| `created_at`  | Timestamp | |

**Team Memberships**

| Column         | Type     | Notes |
|---------------|---------|-------|
| `id`          | UUID PK | |
| `team_id`     | UUID FK → teams.id | |
| `profile_id`  | UUID FK → profiles.id | |
| `role`        | Enum    | `'leader'`, `'member'` |
| `status`      | Enum    | `'pending'`, `'accepted'`, `'declined'` |
| `invited_by`  | UUID FK → profiles.id | Who sent invite |
| `invited_at`  | Timestamp | |
| `accepted_at` | Timestamp | Nullable |

Unique constraints ensure a user belongs to a team only once and that
only one leader exists per team.

**Team Invites**

| Column        | Type     | Notes |
|--------------|---------|-------|
| `id`         | UUID PK | |
| `team_id`    | UUID FK → teams.id | Team receiving the invitation |
| `inviter_id` | UUID FK → profiles.id | Who sent the invite (must be leader) |
| `invitee_id` | UUID FK → profiles.id | User being invited |
| `status`     | Enum    | `'pending'`, `'accepted'`, `'declined'` |
| `created_at` | Timestamp | Defaults to now() |
| `updated_at` | Timestamp | Auto‑updated |

This table tracks invitations independently from `team_memberships` so that
invited users can respond at their convenience.  On acceptance, a
corresponding row is inserted into `team_memberships`; on declination,
the invite is simply updated.  RLS policies restrict inserts to team
leaders and allow the invitee to update their own status.

### 1.4 Problem Banks and Problems

**Problem Banks**

| Column         | Type     | Notes |
|---------------|---------|-------|
| `id`          | UUID PK | |
| `organizer_id`| UUID FK → profiles.id | Owner |
| `name`        | Text    | |
| `description` | Text    | Optional |
| `created_at`  | Timestamp | |
| `is_deleted`  | Boolean | Soft‑delete flag |

**Problems**

| Column         | Type     | Notes |
|---------------|---------|-------|
| `id`          | UUID PK | |
| `bank_id`     | UUID FK → problem_banks.id | |
| `type`        | Enum    | `'mcq'`, `'tf'`, `'numeric'`, `'identification'` |
| `content`     | Text    | Markdown/LaTeX stem |
| `options`     | JSONB   | For MCQ/TF; array of choices |
| `answers`     | JSONB   | Accepted answers (string or number array) |
| `difficulty`  | Enum    | `'easy'`, `'average'`, `'difficult'` |
| `tags`        | Text[]  | Array of topics/keywords |
| `image_url`   | Text    | Optional image link |
| `created_at`  | Timestamp | |
| `is_deleted`  | Boolean | Soft‑delete; cannot delete if used in published competitions |

### 1.5 Competitions

| Column              | Type     | Notes |
|---------------------|---------|-------|
| `id`                | UUID PK | |
| `organizer_id`      | UUID FK → profiles.id | Creator |
| `name`              | Text    | Unique per organizer |
| `description`       | Text    | Up to 500 words |
| `instructions`      | Text    | Rules to display before start |
| `type`              | Enum    | `'scheduled'`, `'open'` |
| `format`            | Enum    | `'individual'`, `'team'` |
| `registration_start`| Timestamp | Nullable for open comps |
| `registration_end`  | Timestamp | Nullable for open comps |
| `start_time`        | Timestamp | For scheduled comps |
| `duration_minutes`  | Integer  | |
| `attempts_allowed`  | Integer  | 1 for scheduled; 1–3 for open |
| `max_participants`  | Integer  | Nullable for open comps |
| `participants_per_team` | Integer | Min/Max team size |
| `max_teams`         | Integer  | For team comps |
| `scoring_mode`      | Enum    | `'automatic'`, `'custom'` |
| `custom_points`     | JSONB   | Keyed by difficulty or problem ID |
| `penalty_mode`      | Enum    | `'none'`, `'deduction'` |
| `deduction_value`   | Integer  | Points deducted on wrong answer |
| `tie_breaker`       | Enum    | `'earliest_submission'`, `'latest_submission'`, `'average_time'` |
| `shuffle_questions` | Boolean | |
| `shuffle_options`   | Boolean | |
| `log_tab_switch`    | Boolean | Whether to enable anti‑cheat logging |
| `offense_penalties` | JSONB   | e.g. `{ "1": "warning", "2": "-1", "3": "disqualify" }` |
| `published`         | Boolean | True after final publish |
| `is_paused`         | Boolean | For open comps |
| `created_at`        | Timestamp | |

**Competition Problems**

| Column         | Type     | Notes |
|---------------|---------|-------|
| `id`          | UUID PK | |
| `competition_id`| UUID FK → competitions.id | |
| `problem_id`  | UUID FK → problems.id | |
| `points`      | Integer  | Point value if custom scoring |
| `order_index` | Integer  | Problem order (for scheduled comps; ignored if shuffled) |

### 1.6 Registrations and Attempts

**Registrations**

| Column         | Type     | Notes |
|---------------|---------|-------|
| `id`          | UUID PK | |
| `competition_id` | UUID FK → competitions.id | |
| `profile_id`  | UUID FK → profiles.id | Nullable if team comp |
| `team_id`     | UUID FK → teams.id | Nullable if individual comp |
| `status`      | Enum    | `'registered'`, `'withdrawn'`, `'ineligible'` |
| `registered_at`| Timestamp | |

**Attempts**

| Column         | Type     | Notes |
|---------------|---------|-------|
| `id`          | UUID PK | |
| `competition_id` | UUID FK → competitions.id | |
| `profile_id`  | UUID FK → profiles.id | Nullable if team comp |
| `team_id`     | UUID FK → teams.id | Nullable if individual comp |
| `attempt_no`  | Integer  | Attempt index starting at 1 |
| `start_time`  | Timestamp | |
| `end_time`    | Timestamp | Nullable until submission |
| `score`       | Integer  | Calculated when submitted |
| `status`      | Enum    | `'in_progress'`, `'completed'`, `'disqualified'` |
| `total_time_seconds` | Integer | Sum of all active intervals in seconds |
| `anti_cheat_deduction` | Numeric | Points deducted due to tab‑switch penalties |
| `created_at`  | Timestamp | |

**Attempt Active Intervals**

To calculate accurate competition durations when participants disconnect
and resume, the system records discrete active intervals for each
attempt.  This allows the leaderboard to sum only the time spent
actively in the arena rather than naïvely subtracting start and
end timestamps.

| Column      | Type     | Notes |
|------------|---------|-------|
| `id`       | UUID PK | |
| `attempt_id` | UUID FK → attempts.id | The attempt this interval belongs to |
| `start_time` | Timestamp | When the interval began (defaults to `now()`) |
| `end_time`   | Timestamp | When the interval ended (nullable until closed) |

Whenever a mathlete enters or resumes the arena, a new row is
inserted with `start_time = now()`.  When they leave (e.g. close the
tab, lose connection or finish the attempt), the current interval’s
`end_time` is set.  A helper function can be used to compute
`total_time_seconds` by summing the differences between `start_time`
and `end_time` for all intervals associated with the attempt.  RLS
policies permit insertion and updates only by the attempt owner or
organizer.

**Answers**

| Column         | Type     | Notes |
|---------------|---------|-------|
| `id`          | UUID PK | |
| `attempt_id`  | UUID FK → attempts.id | |
| `problem_id`  | UUID FK → problems.id | |
| `answer`      | Text    | Raw input (may include LaTeX) |
| `status`      | Enum    | `'filled'`, `'solved'`, `'reset'` |
| `points_awarded` | Integer | Calculated on submission |
| `created_at`  | Timestamp | |

### 1.7 Logs & Notifications

**Tab Switch Logs**

| Column         | Type     | Notes |
|---------------|---------|-------|
| `id`          | UUID PK | |
| `attempt_id`  | UUID FK → attempts.id | |
| `offense_no`  | Integer  | 1, 2, 3, ... |
| `timestamp`   | Timestamp | |
| `message`     | Text    | Description of penalty applied |

**Competition Events**

When competitions are paused, resumed or otherwise modified, a
single timestamp field is insufficient to track multiple pause/resume
cycles.  A separate event log records each state change and who
triggered it.  This log enables accurate deadline extensions and
auditing.

| Column           | Type     | Notes |
|-----------------|---------|-------|
| `id`            | UUID PK | |
| `competition_id`| UUID FK → competitions.id | |
| `event_type`    | Text    | One of `'published'`, `'paused'`, `'resumed'`, `'extended'` |
| `actor_user_id` | UUID FK → profiles.id | Organizer/admin who triggered the event |
| `happened_at`   | Timestamp | Defaults to `now()` |

Indexes on `(competition_id, happened_at)` allow efficient retrieval
of events for a competition.  Policies restrict inserts to the
competition owner or admin and allow all participants to read.

**Notifications**

| Column         | Type     | Notes |
|---------------|---------|-------|
| `id`          | UUID PK | |
| `recipient_id`| UUID FK → profiles.id | User who receives the message |
| `type`        | Text    | E.g. `"invitation"`, `"registration"`, `"score_update"` |
| `payload`     | JSONB   | Additional data (e.g. competition ID) |
| `created_at`  | Timestamp | |
| `read_at`     | Timestamp | Nullable |

**Notification Preferences**

| Column         | Type     | Notes |
|---------------|---------|-------|
| `user_id`     | UUID PK → profiles.id | User to whom the preferences belong |
| `preferences` | JSONB   | Key/value map of notification type → boolean |
| `created_at`  | Timestamp | |
| `updated_at`  | Timestamp | |

This table records per‑user notification settings.  Each key in
`preferences` corresponds to a notification `type` and a boolean
indicating whether the user wishes to receive it.  A missing key
defaults to true.  RLS policies restrict updates to the owner or admin.

**Problem Flags**

| Column          | Type     | Notes |
|-----------------|---------|-------|
| `id`            | UUID PK | |
| `competition_problem_id` | UUID FK → competition_problems.id | The problem being flagged |
| `profile_id`    | UUID FK → profiles.id | Who filed the flag |
| `reason`        | Text    | Description of the issue or dispute |
| `status`        | Enum    | `'open'`, `'resolved'`, `'rejected'` |
| `created_at`    | Timestamp | |
| `resolved_at`   | Timestamp | Nullable |
| `resolved_by`   | UUID FK → profiles.id | Organizer/admin who resolved the flag (nullable) |

This table stores disputes raised by participants regarding problem
statements or answer keys.  Organizers review flags, update the
`status` and optionally adjust scores.  Policies allow participants to
create flags for problems they attempted and allow organizers/admins to
update them.

### 1.8 Leaderboards (Views)

Leaderboards are not stored in persistent tables; instead, we expose
materialised views or SQL functions that aggregate attempts and
answers to compute participant or team scores.  A typical view looks
like:

```sql
CREATE MATERIALIZED VIEW competition_leaderboard AS
SELECT
  competition_id,
  COALESCE(profile_id, team_id) AS entity_id,
  SUM(score) AS total_score,
  MIN(end_time) AS earliest_submission,
  RANK() OVER (PARTITION BY competition_id ORDER BY SUM(score) DESC, MIN(end_time) ASC) AS rank
FROM attempts
WHERE status = 'completed'
GROUP BY competition_id, COALESCE(profile_id, team_id);
```

RLS policies on materialised views rely on the underlying tables.  Only
organizers of the competition, participants (mathletes or team
members) and admins may query leaderboard data.  The view can be
refreshed after recalculations to update ranks.

## 2. Entity Relationship Description

The relationships can be visualised as follows (arrows denote one‑to‑many
relationships and labels indicate cardinalities):

* **profiles** 1───◀── `organizer_applications.profile_id`
* **profiles** 1───◀── `problem_banks.organizer_id`
* **profiles** 1───◀── `competitions.organizer_id`
* **profiles** 1───◀── `teams.created_by`
* **profiles** 1───◀── `team_memberships.profile_id` (a user can belong to many teams)
* **teams** 1───◀── `team_memberships.team_id` (a team has many members)
* **problem_banks** 1───◀── `problems.bank_id`
* **competitions** 1───◀── `competition_problems.competition_id`
* **problems** 1───◀── `competition_problems.problem_id`
* **competitions** 1───◀── `registrations.competition_id`
* **profiles** 1───◀── `registrations.profile_id`
* **teams** 1───◀── `registrations.team_id`
* **competitions** 1───◀── `attempts.competition_id`
* **profiles** 1───◀── `attempts.profile_id`
* **teams** 1───◀── `attempts.team_id`
* **attempts** 1───◀── `answers.attempt_id`
* **problems** 1───◀── `answers.problem_id`
* **attempts** 1───◀── `tab_switch_logs.attempt_id`
* **profiles** 1───◀── `notifications.recipient_id`

This description can be used to generate an entity‑relationship diagram
with tools such as dbdiagram.io if a visual representation is needed.

## 3. Row‑Level Security (RLS)

Supabase enforces access control through RLS policies.  Each table
should have RLS enabled and only allow actions explicitly permitted.

### 3.1 General Patterns

* **Self‑service:**  Users can select, insert and update rows where
  `profile_id = auth.uid()`.  They cannot modify other users’ data.
* **Organizer ownership:**  Organizers can manage resources (problem banks,
  problems, competitions) where `organizer_id = auth.uid()`.  Other users
  have read access only if the resource is published or part of a
  competition they are participating in.
* **Admin override:**  Admins bypass most RLS policies via a claim
  inserted into the auth JWT (e.g. `role = 'admin'`).  Policies check
  for this claim and grant full access.

### 3.1.1 Soft Deletes

Many tables in the schema support soft deletion through a `deleted_at`
timestamp or an `is_deleted` boolean flag.  Instead of adding
`WHERE deleted_at IS NULL` clauses throughout the application, enable
RLS on these tables and create a default `SELECT` policy that hides
deleted rows from non‑admin users.  For example:

```sql
-- Hide soft‑deleted user records
CREATE POLICY "Hide deleted records" ON users
  FOR SELECT USING (deleted_at IS NULL);

-- Hide soft‑deleted problem banks
CREATE POLICY "Hide deleted records" ON problem_banks
  FOR SELECT USING (is_deleted = false);

-- Hide soft‑deleted problems
CREATE POLICY "Hide deleted records" ON problems
  FOR SELECT USING (is_deleted = false);
```

Administrators may bypass these policies to inspect or restore
soft‑deleted data by virtue of their elevated role.  Insert and
update policies remain unchanged and continue to permit writes as
defined below.

### 3.2 Policies per Table

The pseudocode below describes typical policies.  In production these
should be expressed as PostgreSQL `CREATE POLICY` statements.

#### profiles

* **Select**: Allow if `auth.uid() = id` or the requester has
  `role = 'admin'`.
* **Insert**: Only Supabase Auth should insert (handled by trigger).
* **Update**: Allow users to update their own `full_name`, `school`,
  `grade_level`, etc.  Organizers cannot change `role`.  Admin can
  update any field.
* **Delete**: Only admin may soft‑delete by setting `is_active = false`.

#### organizer_applications

* **Select**: Allow if `profile_id = auth.uid()` (the applicant) or
  `role = 'admin'`.
* **Insert**: Allow if `auth.uid() = profile_id` and the user’s
  `role = 'organizer'` but `approved_at` is NULL.
* **Update/Delete**: Only admin may update `status`, `rejection_reason` or
  delete applications.

#### admin_audit_logs

* **Select**: Admin only.
* **Insert**: Admin only (used for recording moderation actions).
* **Update/Delete**: Denied to preserve audit integrity.

#### teams & team_memberships

* **teams Select**: Members of a team and admins may view the team.
* **teams Insert**: Allow any mathlete to create a team (`role = 'mathlete'`).
* **teams Update/Delete**: Only the leader (`created_by = auth.uid()`)
  or admin may rename or delete a team.
* **team_memberships Select**: Members of the team and admins.
* **team_memberships Insert**: Allow if `invited_by = auth.uid()` and
  the inviter is the team leader.  The invited user must exist.
* **team_memberships Update**: Allow the invited user to accept/decline
  their invitation.  Leaders may promote/demote roles.  Admin can
  modify any record.
* **team_memberships Delete**: Allow the member or leader to leave or
  remove members; admin can delete any membership.

#### problem_banks & problems

* **Select**: Public read access only for published competitions; otherwise
  only the owner (`organizer_id = auth.uid()`) and admin.
* **Insert**: Owner may create; admin may insert into default bank.
* **Update/Delete**: Owner may update or soft‑delete before the bank is
  used in a published competition.  Admin may update the default bank.

#### competitions & competition_problems

* **Select**: Published competitions are readable by anyone.
  Draft competitions can be read by the owner and admin.  Participants
  who have registered for a scheduled competition may read summary
  details.
* **Insert**: Only the owner (organizer) may create competitions.
* **Update/Delete**: Owner may update competitions until they are
  published.  Deletion is only allowed if there are no active
  participants (enforced by triggers).  Admin may pause/resume or
  delete for moderation.

#### registrations

* **Select**: Registrants (mathletes or team members), the competition
  owner and admin may view.
* **Insert**: Users may register themselves or their teams if the
  competition is open for registration and capacity limits are
  satisfied.
* **Update/Delete**: Registrants may withdraw before the competition
  starts.  Organizers cannot modify registrations except to flag
  ineligible rosters.  Admin may delete in cases of misconduct.

#### attempts & answers

* **Select**: The participant (profile or team), organizer and admin.
* **Insert**: Server‑side logic inserts an attempt when a user enters
  the arena.  Answers are inserted/updated as the participant works.
* **Update**: Participants cannot modify answers after submission.
  Organizers may view but not alter attempts.  Admin can modify for
  recalc.
* **Delete**: Prohibited except by admin.

#### tab_switch_logs

* **Select**: Organizers of the associated competition and admin may
  read.  Participants cannot read their own logs during the event.
* **Insert**: Server‑side logic inserts logs when focus is lost.
* **Delete**: Admin only.

#### team_invites

* **Select**: Allow the inviter (leader), the invitee and admin to view.
* **Insert**: Only the team leader may insert invites (`inviter_id = auth.uid()`).
* **Update**: Allow the invitee to update `status` to `'accepted'` or `'declined'`.
  Leaders may update invites to cancel them.  Admin may update any record.
* **Delete**: Admin only.

#### notification_preferences

* **Select**: Only the owner (`user_id = auth.uid()`) and admin.
* **Insert**: On user profile creation a default preferences row is inserted.
* **Update**: Only the owner can update their preferences.  Admin may
  override for support.
* **Delete**: Admin only.

#### problem_flags

* **Select**: Allow the participant who created the flag, the
  competition organizer and admin.
* **Insert**: Participants may insert a flag if they have an `attempt_id`
  for the given competition problem.  The organizer cannot insert on
  behalf of a participant.
* **Update**: Organizers and admin may update `status`, `resolved_at`
  and `resolved_by`.  Participants cannot update after insertion.
* **Delete**: Admin only.

#### notifications

* **Select**: Only the recipient (`recipient_id = auth.uid()`) and
  admin.
* **Insert**: System or server functions create notifications.
* **Update**: Recipient may set `read_at` when reading.  Admin may
  clear notifications.
* **Delete**: Admin only.

### 3.3 Triggers and Functions

Beyond table policies, several database mechanisms underpin the
application’s business logic.  These should be created alongside the
schema and maintained in version control.

**User Sync Trigger** – To keep the custom `profiles` table in sync
with Supabase’s built‑in `auth.users` table, define a function and
trigger that copies new auth users into `profiles` immediately after
sign‑up:

```sql
CREATE OR REPLACE FUNCTION public.insert_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, '', 'mathlete', now(), now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.insert_profile_for_new_user();
```

This ensures every new auth user has a corresponding profile row.  The
trigger can be extended to set default roles or other metadata as
needed.

**Grade Attempt Function** – Scoring should occur inside the database
to avoid pulling large answer sets into the application server.  The
following illustrates a simplified `grade_attempt` RPC:

```sql
CREATE OR REPLACE FUNCTION public.grade_attempt(p_attempt_id uuid)
RETURNS void AS $$
DECLARE
  rec RECORD;
  total_points NUMERIC := 0;
BEGIN
  -- Loop through answers and compare to snapshot keys
  FOR rec IN
    SELECT aa.id AS answer_id,
           cp.snapshot_answer_keys,
           aa.answer
    FROM attempt_answers aa
    JOIN competition_problems cp ON cp.id = aa.competition_problem_id
    WHERE aa.attempt_id = p_attempt_id
  LOOP
    -- Determine correctness (simplified; supports multiple answers)
    IF rec.answer IS NOT NULL AND rec.answer = ANY (rec.snapshot_answer_keys) THEN
      -- award points based on snapshot difficulty or custom points
      UPDATE attempt_answers
      SET points_awarded = COALESCE(cp.custom_points, 
        CASE cp.snapshot_difficulty WHEN 'easy' THEN 1 WHEN 'average' THEN 2 WHEN 'difficult' THEN 3 END),
          is_correct = true
      WHERE id = rec.answer_id;
      total_points := total_points + COALESCE(cp.custom_points, 
        CASE cp.snapshot_difficulty WHEN 'easy' THEN 1 WHEN 'average' THEN 2 WHEN 'difficult' THEN 3 END);
    ELSE
      UPDATE attempt_answers
      SET points_awarded = 0, is_correct = false
      WHERE id = rec.answer_id;
    END IF;
  END LOOP;
  -- Update the attempt’s score and submission timestamp
  UPDATE competition_attempts
  SET final_score = total_points, submitted_at = now()
  WHERE id = p_attempt_id;
  -- Optionally refresh materialised leaderboard
  REFRESH MATERIALIZED VIEW CONCURRENTLY competition_leaderboard;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Applications should call `select grade_attempt(<attempt_id>)` via
Supabase RPC when a mathlete submits their attempt.  The function
computes per‑question scores, updates the attempt, and refreshes the
leaderboard.  Additional logic can handle penalties and tie‑breakers.

### 3.4 Supabase Realtime

To provide a responsive experience during competitions, enable
Supabase Realtime on tables that broadcast live updates:

* **leaderboard_entries** – Subscribers receive updates when their
  position or score changes.  This allows the live leaderboard to
  refresh without polling.
* **competition_announcements** – Mathletes see new organizer
  announcements instantly via WebSockets.
* **notifications** – In‑app notification panels update as new
  messages arrive.

Enable Realtime either through the Supabase dashboard or via SQL
(`ALTER` statements) and ensure RLS policies permit `realtime` role
subscriptions.  On the frontend, use Supabase’s client library to
subscribe to changes and update the UI accordingly.

#### attempt_active_intervals

* **Select**: Allow if the authenticated user is the owner of the
  associated attempt (`attempts.profile_id = auth.uid()` or the
  attempt’s team includes the user), the competition organizer or an
  admin.  Mathletes cannot view the intervals of other participants.
* **Insert**: When an attempt begins or resumes, the client inserts a
  new row with `start_time = now()`.  Only the owner of the attempt
  may perform this action.
* **Update**: Upon leaving or pausing, the owner updates the
  current interval to set `end_time`.  Organizers may also close
  intervals when resetting attempts.  No other updates are allowed.
* **Delete**: Denied.  Interval records are append‑only to preserve
  auditability.

#### competition_events

* **Select**: All participants in the competition (organizer,
  registered mathletes or team members) and admins may view the event
  history.  This supports accurate deadline calculations and
  transparency.
* **Insert**: Only the competition owner (organizer) or an admin may
  insert a new event.  The `actor_user_id` must equal `auth.uid()` to
  prevent forging events on behalf of another user.
* **Update/Delete**: Denied.  Events are immutable once recorded to
  ensure a reliable audit trail.

## 4. Change Log

| Date (UTC) | Change |
|-----------|-------|
| 2026‑03‑09 | Initial schema definitions and RLS policies drafted. |
| 2026‑03‑09 | Added `team_invites`, `notification_preferences` and
  `problem_flags` tables; documented leaderboard materialised view and
  associated RLS policies. |
| 2026‑03‑09 | Added `attempt_active_intervals` and `competition_events`
  tables to support accurate time tracking and competition pause/resume
  history.  Documented soft‑delete policies, Supabase Auth sync
  trigger, grading function and Realtime subscriptions. |
| 2026‑03‑11 | Added local Supabase CLI project scaffolding plus an
  initial migration for `profiles` and `organizer_applications`,
  including the auth sync trigger, helper functions and foundational
  RLS policies used by the authentication flow. |
| 2026‑04‑01 | Added `admin_audit_logs` table for centralized admin action auditing. |

Whenever the database schema is modified or RLS policies are updated,
append a new row detailing what changed and why.  Maintain this log to
help the team stay aligned and to facilitate migrations.
