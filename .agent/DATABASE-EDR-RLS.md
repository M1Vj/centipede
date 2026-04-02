# Database, ERD, and RLS Design

This document is the backend source of truth for the rebuild. It describes the full target schema, the relationship model, row-level access rules, critical RPCs and triggers, realtime usage, and migration order. All schema intent required for implementation is stated directly here; no external local specification is assumed.

## Section A - Data Model Overview

### Core Entity Groups

- identity and roles: `profiles`, `organizer_applications`, `notification_preferences`
- authoring and content: `problem_banks`, `problems`
- team system: `teams`, `team_memberships`, `team_invitations`
- competitions: `competitions`, `competition_problems`, `competition_registrations`, `competition_announcements`, `competition_events`
- live sessions and grading: `competition_attempts`, `attempt_intervals`, `attempt_answers`, `tab_switch_logs`, `problem_disputes`
- post-competition outputs: `leaderboard_entries`, `notifications`, `export_jobs`
- governance and operations: `admin_audit_logs`, `system_settings`

### Relationship Summary

- one approved organizer `profile` can link back to one historical `organizer_application`, but applications may exist before a profile is provisioned
- one organizer owns many `problem_banks` and `competitions`
- one `problem_bank` owns many `problems`
- one `competition` references many `competition_problems`
- one `competition` has many `competition_registrations`, `competition_attempts`, `competition_events`, and `competition_announcements`
- one `competition_attempt` owns many `attempt_intervals`, `attempt_answers`, and `tab_switch_logs`
- one `competition_problem` can receive many `problem_disputes`
- one user owns many `notifications` and one row of `notification_preferences`

## Section B - Full Schema Design

### `profiles`

Purpose: canonical user record linked to `auth.users`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | equals `auth.users.id` |
| `email` | text unique | always lowercased |
| `full_name` | text | required after profile completion |
| `role` | enum `profile_role` | `mathlete`, `organizer`, `admin` |
| `school` | text | nullable before completion |
| `grade_level` | text | nullable before completion |
| `organization` | text | organizer-facing profile data |
| `avatar_url` | text | optional |
| `approved_at` | timestamptz | set when organizer approved |
| `is_active` | boolean | suspended users are false |
| `created_at` | timestamptz | default utc now |
| `updated_at` | timestamptz | maintained by trigger |

Indexes: `profiles_role_idx`, `profiles_is_active_idx`.

Constraints: non-admin users cannot escalate their own role or activation state.

### `organizer_applications`

Purpose: organizer eligibility submissions and review decisions, including pre-account applicants who do not yet have organizer credentials.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `profile_id` | uuid fk -> profiles.id nullable | linked only after approval and account provisioning |
| `applicant_full_name` | text | public applicant identity data |
| `organization_name` | text |
| `contact_email` | text |
| `contact_phone` | text |
| `organization_type` | text |
| `statement` | text |
| `logo_path` | text | Supabase Storage path |
| `legal_consent_at` | timestamptz | required before submission |
| `status_lookup_token_hash` | text | supports secure status lookup without organizer login |
| `status` | enum `organizer_application_status` |
| `rejection_reason` | text |
| `submitted_at` | timestamptz |
| `reviewed_at` | timestamptz |

Indexes: `organizer_applications_status_idx`, `organizer_applications_profile_idx`, `organizer_applications_contact_email_idx`.

Constraints: `profile_id` may remain null until approval; only one active pending application should exist per `contact_email`; status lookup tokens are stored hashed rather than in raw form.

### `problem_banks`

Purpose: organizer-owned and admin-managed collections of reusable problems.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `organizer_id` | uuid fk -> profiles.id |
| `name` | text |
| `description` | text |
| `is_default_bank` | boolean | true only for admin-shared bank |
| `is_visible_to_organizers` | boolean | default bank discoverability |
| `is_deleted` | boolean | soft delete |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Indexes: `(organizer_id, is_deleted)`, `(is_default_bank, is_visible_to_organizers)`.

Constraints: active published competitions may still reference problems from soft-deleted banks because competition snapshots are immutable.

### `problems`

Purpose: authored problem records before they are snapshotted into competitions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `bank_id` | uuid fk -> problem_banks.id |
| `type` | enum `problem_type` |
| `content_latex` | text | canonical authored prompt |
| `content_html` | text | optional prerender cache |
| `options_json` | jsonb | MCQ and TF options |
| `answer_key_json` | jsonb | accepted raw answers |
| `explanation_latex` | text |
| `difficulty` | enum `difficulty` |
| `tags` | text[] |
| `image_path` | text |
| `authoring_notes` | text |
| `is_deleted` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Indexes: `problems_bank_idx`, gin on `tags`.

Constraints: multiple choice options must be unique; answer payload shape depends on `type`.

### `teams`

Purpose: mathlete-created teams for team competitions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `name` | text unique |
| `team_code` | text unique |
| `created_by` | uuid fk -> profiles.id |
| `is_archived` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `team_memberships`

Purpose: accepted team membership and leadership ordering.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `team_id` | uuid fk -> teams.id |
| `profile_id` | uuid fk -> profiles.id |
| `role` | enum `team_role` | `leader`, `member` |
| `joined_at` | timestamptz |
| `left_at` | timestamptz nullable |
| `is_active` | boolean |

Indexes: unique active membership on `(team_id, profile_id)`, `team_memberships_active_idx`.

### `team_invitations`

Purpose: pending invite workflow separate from accepted membership rows.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `team_id` | uuid fk -> teams.id |
| `inviter_id` | uuid fk -> profiles.id |
| `invitee_id` | uuid fk -> profiles.id |
| `status` | enum `invitation_status` | `pending`, `accepted`, `declined`, `revoked` |
| `created_at` | timestamptz |
| `responded_at` | timestamptz nullable |

### `competitions`

Purpose: competition draft, published, live, paused, and archived configuration.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `organizer_id` | uuid fk -> profiles.id |
| `name` | text |
| `slug` | text unique |
| `description` | text |
| `instructions` | text |
| `type` | enum `competition_type` | `scheduled`, `open` |
| `format` | enum `competition_format` | `individual`, `team` |
| `status` | enum `competition_status` | `draft`, `published`, `live`, `paused`, `ended`, `archived` |
| `registration_start` | timestamptz |
| `registration_end` | timestamptz |
| `start_time` | timestamptz |
| `end_time` | timestamptz |
| `duration_minutes` | integer |
| `attempts_allowed` | integer |
| `multi_attempt_grading_mode` | enum `attempt_grading_mode` | `highest_score`, `latest_score`, `average_score` |
| `max_participants` | integer nullable |
| `participants_per_team` | integer nullable |
| `max_teams` | integer nullable |
| `scoring_mode` | enum `scoring_mode` |
| `custom_points_json` | jsonb |
| `penalty_mode` | enum `penalty_mode` |
| `deduction_value` | integer |
| `tie_breaker` | enum `tie_breaker` |
| `shuffle_questions` | boolean |
| `shuffle_options` | boolean |
| `log_tab_switch` | boolean |
| `offense_penalties_json` | jsonb |
| `leaderboard_published` | boolean |
| `published_at` | timestamptz nullable |
| `is_deleted` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Indexes: `(organizer_id, status)`, `(published_at)`, `(type, status)`.

Constraints: name uniqueness must be scoped to organizer while draft and active competitions coexist safely.

### `competition_problems`

Purpose: immutable problem snapshots attached to a competition.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `competition_id` | uuid fk -> competitions.id |
| `problem_id` | uuid fk -> problems.id |
| `order_index` | integer |
| `points` | integer |
| `content_snapshot_latex` | text |
| `options_snapshot_json` | jsonb |
| `answer_key_snapshot_json` | jsonb |
| `explanation_snapshot_latex` | text |
| `difficulty_snapshot` | enum `difficulty` |
| `tags_snapshot` | text[] |
| `image_snapshot_path` | text |

Unique key: `(competition_id, order_index)`.

### `competition_registrations`

Purpose: participant or team registration state.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `competition_id` | uuid fk -> competitions.id |
| `profile_id` | uuid fk -> profiles.id nullable |
| `team_id` | uuid fk -> teams.id nullable |
| `status` | enum `registration_status` | `registered`, `withdrawn`, `ineligible`, `cancelled` |
| `status_reason` | text |
| `entry_snapshot_json` | jsonb | display names, school, team roster snapshot |
| `registered_at` | timestamptz |
| `updated_at` | timestamptz |

Constraint: exactly one of `profile_id` or `team_id` must be populated.

### `competition_announcements`

Purpose: organizer or admin broadcast messages tied to a competition.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `competition_id` | uuid fk -> competitions.id |
| `author_id` | uuid fk -> profiles.id |
| `audience` | enum `announcement_audience` |
| `message` | text |
| `created_at` | timestamptz |

### `competition_events`

Purpose: durable event timeline for publish, pause, resume, extend, delete, recalculate, and intervention actions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `competition_id` | uuid fk -> competitions.id |
| `event_type` | text |
| `actor_user_id` | uuid fk -> profiles.id |
| `payload_json` | jsonb |
| `happened_at` | timestamptz |

### `competition_attempts`

Purpose: one logical attempt per participant or team per competition.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `competition_id` | uuid fk -> competitions.id |
| `registration_id` | uuid fk -> competition_registrations.id |
| `attempt_no` | integer |
| `status` | enum `attempt_status` | `in_progress`, `submitted`, `auto_submitted`, `disqualified`, `graded` |
| `started_at` | timestamptz |
| `submitted_at` | timestamptz nullable |
| `graded_at` | timestamptz nullable |
| `raw_score` | numeric |
| `penalty_score` | numeric |
| `final_score` | numeric |
| `total_time_seconds` | integer |
| `offense_count` | integer |
| `is_latest_visible_result` | boolean |
| `grade_summary_json` | jsonb |

Indexes: `(competition_id, status)`, `(registration_id, attempt_no)`.

### `attempt_intervals`

Purpose: track active time windows for reconnect-safe timing.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `attempt_id` | uuid fk -> competition_attempts.id |
| `started_at` | timestamptz |
| `ended_at` | timestamptz nullable |

### `attempt_answers`

Purpose: autosaved and submitted answers for each problem in an attempt.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `attempt_id` | uuid fk -> competition_attempts.id |
| `competition_problem_id` | uuid fk -> competition_problems.id |
| `answer_latex` | text |
| `answer_text_normalized` | text |
| `status_flag` | enum `answer_status_flag` | `blank`, `filled`, `solved` |
| `is_correct` | boolean nullable |
| `points_awarded` | numeric nullable |
| `last_saved_at` | timestamptz |

Unique key: `(attempt_id, competition_problem_id)`.

### `tab_switch_logs`

Purpose: anti-cheat offense logs.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `attempt_id` | uuid fk -> competition_attempts.id |
| `offense_number` | integer |
| `penalty_applied` | text |
| `client_timestamp` | timestamptz nullable |
| `logged_at` | timestamptz |
| `metadata_json` | jsonb |

### `problem_disputes`

Purpose: mathlete-reported question disputes after the competition.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `competition_problem_id` | uuid fk -> competition_problems.id |
| `attempt_id` | uuid fk -> competition_attempts.id |
| `reporter_id` | uuid fk -> profiles.id |
| `reason` | text |
| `status` | enum `dispute_status` | `open`, `reviewing`, `accepted`, `rejected`, `resolved` |
| `resolution_note` | text |
| `resolved_by` | uuid fk -> profiles.id nullable |
| `created_at` | timestamptz |
| `resolved_at` | timestamptz nullable |

### `leaderboard_entries`

Purpose: read-optimized ranking output for competition pages and history.

Implementation: materialized view or refreshable table maintained by RPC.

Key columns:

- `competition_id`
- `registration_id`
- `attempt_id`
- `rank`
- `display_name`
- `score`
- `total_time_seconds`
- `offense_count`
- `published_visibility`
- `computed_at`

### `notifications`

Purpose: in-app user notifications.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `recipient_id` | uuid fk -> profiles.id |
| `type` | text |
| `title` | text |
| `body` | text |
| `link_path` | text |
| `metadata_json` | jsonb |
| `is_read` | boolean |
| `read_at` | timestamptz nullable |
| `created_at` | timestamptz |

Indexes: `(recipient_id, is_read, created_at desc)`.

### `notification_preferences`

Purpose: per-user channel and event preferences.

| Column | Type | Notes |
| --- | --- | --- |
| `profile_id` | uuid pk fk -> profiles.id |
| `email_enabled` | boolean |
| `in_app_enabled` | boolean |
| `registration_reminders` | boolean |
| `team_invites` | boolean |
| `announcements` | boolean |
| `leaderboard_publication` | boolean |
| `score_recalculation` | boolean |
| `organizer_decisions` | boolean |
| `updated_at` | timestamptz |

### `export_jobs`

Purpose: audit and retry support for CSV and XLSX exports.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `competition_id` | uuid fk -> competitions.id |
| `requested_by` | uuid fk -> profiles.id |
| `format` | enum `export_format` | `csv`, `xlsx` |
| `status` | enum `export_status` | `queued`, `processing`, `completed`, `failed` |
| `storage_path` | text nullable |
| `error_message` | text nullable |
| `created_at` | timestamptz |
| `completed_at` | timestamptz nullable |

### `admin_audit_logs`

Purpose: immutable admin action audit trail.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `actor_user_id` | uuid fk -> profiles.id |
| `action_type` | text |
| `target_table` | text |
| `target_id` | uuid nullable |
| `description` | text |
| `metadata_json` | jsonb |
| `happened_at` | timestamptz |

### `system_settings`

Purpose: platform-wide configuration owned by admins.

| Column | Type | Notes |
| --- | --- | --- |
| `key` | text pk |
| `value_json` | jsonb |
| `updated_by` | uuid fk -> profiles.id |
| `updated_at` | timestamptz |

## Section C - ERD Explanation

- `profiles` is the root actor table for every user-owned record.
- `organizer_applications` represents the organizer-eligibility workflow before and after account provisioning. A row may exist before any `profiles` row is created, and approved rows link to the eventual organizer profile.
- `problem_banks` and `problems` are mutable authoring tables; `competition_problems` is the immutable publish snapshot.
- `teams`, `team_memberships`, and `team_invitations` model group ownership and roster history.
- `competition_registrations` represents who is allowed into a competition. `competition_attempts` represents what actually happened in the arena.
- `attempt_answers` always point at `competition_problems`, not `problems`, so grading is immune to later edits in the bank.
- `leaderboard_entries` is derived from attempts and registrations and should be treated as read-optimized output, not the grading source of truth.
- `problem_disputes`, `competition_events`, and `admin_audit_logs` provide operational traceability.

## Section D - RLS and Authorization Model

### Global Rules

- enable RLS on every table in `public`
- keep service-role access server-only
- all security-definer functions must set an explicit `search_path`
- prefer ownership checks over role checks where possible

### Table Access Summary

- `profiles`: self read/update for profile fields; admin can read/update all; no self role escalation
- `organizer_applications`: public applicants submit through a trusted route or RPC, applicant status is exposed only through secure lookup tokens or trusted handlers, and admins can review/update/delete
- `problem_banks` and `problems`: owner organizer or admin-managed default-bank owner can mutate; other organizers cannot read private banks; admins can read all and mutate only the default bank or explicitly moderated records through trusted server paths
- `teams`, `team_memberships`, `team_invitations`: members can read their own team data; leaders can invite/remove within policy; admins can read all for moderation
- `competitions`: organizers can fully manage their own; admins can read all and pause/delete only through approved server actions; mathletes read only published competitions they are eligible to see
- `competition_problems`: organizers and admins for their competitions; participants only after the competition starts, and only through joins scoped to an owned registration or attempt
- `competition_registrations`: mathletes and team leaders create/manage their own registration rows under validation RPCs; organizers and admins can read registrations for owned competitions
- `competition_attempts`, `attempt_intervals`, `attempt_answers`, `tab_switch_logs`: only the owning registration and the competition owner or admin can read; participants can insert/update only through guarded RPCs while the attempt is active
- `problem_disputes`: reporter can insert/select own disputes; organizer and admin can read and resolve disputes for owned competitions
- `leaderboard_entries`: participants can read only if the competition is open or published; organizers and admins can read always
- `notifications` and `notification_preferences`: owner only, plus admin via support tooling if explicitly needed
- `export_jobs`: requester plus competition owner and admin
- `admin_audit_logs`: admin only
- `system_settings`: admin only

## Section E - DB Functions, Triggers, and RPCs

Required trusted functions:

- `insert_profile_for_new_user()` trigger on `auth.users`
- `handle_profile_changes()` trigger for protected `profiles` updates
- `create_default_notification_preferences()` trigger on profile insert
- `approve_organizer_application(application_id, rejection_reason?)`
- `provision_organizer_account(application_id)` or equivalent trusted organizer-credential issuance helper
- `snapshot_competition_problems(competition_id)`
- `publish_competition(competition_id)`
- `register_for_competition(competition_id, profile_id/team_id)`
- `withdraw_registration(registration_id)`
- `validate_team_registration(team_id, competition_id)`
- `start_competition_attempt(registration_id)`
- `resume_competition_attempt(attempt_id)`
- `close_active_attempt_interval(attempt_id)`
- `save_attempt_answer(attempt_id, competition_problem_id, answer_payload, status_flag)`
- `log_tab_switch_offense(attempt_id, metadata_json)`
- `grade_attempt(attempt_id)`
- `recalculate_competition_scores(competition_id)`
- `refresh_leaderboard_entries(competition_id)`
- `publish_leaderboard(competition_id)`
- `queue_export_job(competition_id, format)`
- `transfer_team_leadership(team_id)`

## Section F - Realtime and Subscriptions

Use Realtime only for scoped, high-value updates:

- `notifications`: current user inbox
- `competition_announcements`: active participants and organizers in one competition
- `competition_events`: live moderation panels and arena state changes
- `leaderboard_entries`: current competition only
- `competition_attempts`: organizer monitoring summaries only, not broad public pages
- `tab_switch_logs`: organizer monitoring for the owned competition only

Performance rules:

- never subscribe to whole tables across the product
- prefer filters by `competition_id` or `recipient_id`
- if event fan-out becomes too expensive, move heavy live surfaces to broadcast channels fed by trusted triggers or server processes

## Section G - Migration Notes

Recommended migration order:

1. foundational enums, `profiles`, organizer applications, notification preferences
2. admin settings and audit logs
3. problem banks and problems
4. teams and invitations
5. competitions and competition snapshots
6. registrations and live attempt tables
7. disputes, notifications, export jobs, leaderboard output
8. supporting RPCs, triggers, and performance indexes

Risky migrations and backfills:

- moving from mutable problem references to immutable competition snapshots
- adding leaderboard publication rules after attempts already exist
- recalculating scores if answer normalization changes
- backfilling notification preferences for existing users
- converting live open competitions from naive timer math to interval-based timing

## Section H - Change Log

- 2026-04-03: Rebuilt the database, ERD, and RLS plan for the full greenfield Mathwiz Arena implementation. Added missing tables for team invites, attempt intervals, disputes, notifications, exports, system settings, competition snapshots, and realtime-aware operational flows.
