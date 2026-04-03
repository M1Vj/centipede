# Database, ERD, and RLS Design

This document is the backend source of truth for the rebuild. It describes the full target schema, the relationship model, row-level access rules, critical RPCs and triggers, realtime usage, and migration order. All schema intent required for implementation is stated directly here; no external local specification is assumed.

## Section A - Data Model Overview

### Competition Constants & Rules
- Scheduled competitions allow exactly 1 attempt.
- Open competitions allow 1 to 3 attempts.
- Individual competitions enforce participant caps between 3 and 100.
- Scheduled team competitions enforce participants_per_team between 2 and 5, and max_teams between 3 and 50.
- Team format is valid only for scheduled competitions; open competitions must use individual format.
- Problem bank descriptions are capped at 200 words, and competition descriptions are capped at 500 words.
- The default tie-breaker is earliest final submission unless explicitly overridden.
- All limits are enforced through DB constraints and trusted RPC logic.

### Core Entity Groups

- identity and roles: `profiles`, `organizer_applications`, `notification_preferences`
- authoring and content: `problem_banks`, `problems`
- team system: `teams`, `team_memberships`, `team_invitations`
- competitions: `competitions`, `competition_problems`, `competition_registrations`, `competition_announcements`, `competition_events`
- live sessions and grading: `competition_attempts`, `attempt_intervals`, `attempt_answers`, `tab_switch_logs`, `problem_disputes`, `competition_problem_corrections`
- post-competition outputs: `leaderboard_entries`, `notifications`, `export_jobs`
- governance and operations: `admin_audit_logs`, `system_settings`

### Relationship Summary

- one approved organizer `profile` can link back to one historical `organizer_application`, but applications may exist before a profile is provisioned
- one organizer owns many `problem_banks` and `competitions`
- one `problem_bank` owns many `problems`
- one `competition` references many `competition_problems`
- one `competition` has many `competition_registrations`, `competition_attempts`, `competition_events`, and `competition_announcements`
- one `competition_attempt` owns many `attempt_intervals`, `attempt_answers`, and `tab_switch_logs`
- one `competition_problem` can receive many `problem_disputes` and many `competition_problem_corrections`
- one user owns many `notifications` and one row of `notification_preferences`

## Section B - Full Schema Design

### `profiles`

Purpose: canonical user record linked to `auth.users`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | equals `auth.users.id` |
| `email` | text unique | always lowercased and serves as the credential login identifier where email/password auth is used |
| `full_name` | text | required after profile completion |
| `role` | enum `profile_role` | `mathlete`, `organizer`, `admin` |
| `school` | text | nullable before completion |
| `grade_level` | text | nullable before completion |
| `organization` | text | organizer-facing profile data |
| `avatar_url` | text | optional |
| `approved_at` | timestamptz | set when organizer approved |
| `session_version` | integer | default 1; increments on accepted login to invalidate older sessions |
| `is_active` | boolean | suspended users are false |
| `created_at` | timestamptz | default utc now |
| `updated_at` | timestamptz | maintained by trigger |

Indexes: `profiles_role_idx`, `profiles_is_active_idx`.

Constraints: non-admin users cannot escalate their own role or activation state; organizer activation (`profiles.role = 'organizer'` and `profiles.approved_at`) is set only through the trusted organizer activation or provisioning path after approved application review; `session_version` changes only through trusted auth flows; organizer self-service settings must not mutate `email` (login identifier), and identifier changes are allowed only through trusted admin/auth credential flows.

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
| `logo_path` | text | storage key path only; canonical format `organizer-applications/{application_id}/logo.{ext}` |
| `legal_consent_at` | timestamptz | required before submission and represents explicit Data Privacy Act of 2012 plus Terms & Conditions consent |
| `status_lookup_token_hash` | text | supports secure status lookup without organizer login |
| `status` | enum `organizer_application_status` |
| `rejection_reason` | text | sanitized safe-public message only for rejected outcomes |
| `submitted_at` | timestamptz |
| `reviewed_at` | timestamptz |

Indexes: `organizer_applications_status_idx`, `organizer_applications_profile_idx`, `organizer_applications_contact_email_idx`.

Constraints: `profile_id` may remain null until approval; only one active pending application should exist per `contact_email`; status transitions are `pending -> approved` or `pending -> rejected` only through trusted decision functions; once approved or rejected, decision fields (`status`, `reviewed_at`, `rejection_reason`) are immutable; repeated identical decisions must be idempotent no-ops; status lookup tokens are stored hashed rather than in raw form; `rejection_reason` must be persisted as safe-public sanitized text (plain text only, no HTML, links, emails, or phone numbers, bounded length) and is required only when `status = 'rejected'`.

Organizer decision vs activation ownership contract (canonical): branch `04-admin-user-management` decision flows write only organizer-application terminal decision fields (`status`, `reviewed_at`, `rejection_reason`) and never mutate `profiles.role` or `profiles.approved_at`; branch `05-organizer-registration` trusted activation or provisioning path owns organizer-role activation. For approved rows where `profile_id is null`, the activation path provisions or links the profile first, then sets organizer role and `approved_at`.

### `problem_banks`

Purpose: organizer-owned and admin-managed collections of reusable problems.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `organizer_id` | uuid fk -> profiles.id |
| `name` | text |
| `description` | text | max 200 words |
| `is_default_bank` | boolean | true only for admin-shared bank |
| `is_visible_to_organizers` | boolean | default bank discoverability |
| `is_deleted` | boolean | soft delete |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Indexes: `(organizer_id, is_deleted)`, `(is_default_bank, is_visible_to_organizers)`.

Constraints: `description` must not exceed 200 words; active published competitions may still reference problems from soft-deleted banks because competition snapshots are immutable.

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
| `description` | text | max 500 words |
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
| `scoring_mode` | enum `scoring_mode` | `difficulty`, `custom` |
| `custom_points_json` | jsonb |
| `penalty_mode` | enum `penalty_mode` | `none`, `fixed_deduction` |
| `deduction_value` | integer |
| `tie_breaker` | enum `tie_breaker` | `earliest_final_submission`, `lowest_total_time` |
| `answer_key_visibility` | enum `answer_key_visibility` | `after_end`, `hidden` |
| `shuffle_questions` | boolean |
| `shuffle_options` | boolean |
| `log_tab_switch` | boolean |
| `offense_penalties_json` | jsonb |
| `scoring_snapshot_json` | jsonb | immutable publish-time scoring and anti-cheat contract |
| `leaderboard_published` | boolean |
| `published_at` | timestamptz nullable |
| `is_deleted` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Indexes: `(organizer_id, status)`, `(published_at)`, `(type, status)`.

Constraints: name uniqueness is scoped per organizer by predicate `is_deleted = false AND status IN ('draft','published','live','paused','ended')`; `archived` rows are excluded from the uniqueness predicate; scheduled competitions allow exactly one attempt; open competitions allow 1 to 3 attempts; team format is valid only when `type = 'scheduled'` and open competitions must enforce `format = 'individual'`; individual competitions allow 3 to 100 participants; scheduled team competitions allow 2 to 5 participants per team and 3 to 50 teams; `description` must not exceed 500 words; the default tie-breaker is earliest final submission timestamp unless explicitly overridden; answer-key visibility must be enforced separately from leaderboard publication via `answer_key_visibility`; published competitions freeze `scoring_snapshot_json` and may not mutate the effective scoring contract afterward.

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

### Registration RPC Contract (Canonical)

`register_for_competition(competition_id uuid, team_id uuid default null)` is the only trusted write path for creating new `competition_registrations` rows.

- Individual registration path (`team_id is null`):
	- writes `profile_id = auth.uid()` and `team_id = null`
	- allowed only when `competitions.format = 'individual'`
- Team registration path (`team_id is not null`):
	- writes `team_id = team_id` and `profile_id = null`
	- allowed only when `competitions.format = 'team'` and `competitions.type = 'scheduled'`
	- caller must be an active leader of the selected team
- Shared checks for both paths:
	- participant is active and profile-complete
	- competition is visible, not deleted, and inside allowed registration window (for scheduled)
	- capacity and duplicate-registration guards pass, except trusted ineligible re-entry for the same `(competition_id, team_id)` when roster repair conditions are satisfied and registration timing still allows entry
	- responses return deterministic machine-readable error codes for UI mapping

`withdraw_registration(registration_id uuid)` is the only trusted write path for withdrawal state transitions.

- Participant-initiated withdrawal timing:
	- scheduled competitions: allowed only while `now() < competitions.start_time` and only when zero attempt rows exist for the registration
	- open competitions: allowed only when zero attempt rows exist for the registration
	- if any attempt row exists for the registration, participant withdrawal is blocked
- Organizer or admin cancellation is a separate trusted control path and should use `status = 'cancelled'`, not participant withdrawal.
- Withdrawal and cancellation must preserve auditable reason context via `status_reason` or related event payloads.

### Team Roster Lock State Derivation (Canonical)

Roster lock is derived state, not a standalone table.

- Lock key: `(team_id, competition_id)`
- `is_locked = true` when all are true:
	- registration exists with `competition_registrations.status = 'registered'`
	- competition has `format = 'team'` and `type = 'scheduled'`
	- competition status is not terminal (`ended`, `archived`)
- Lock release occurs when either:
	- registration status transitions to `withdrawn`, `cancelled`, or `ineligible`, or
	- competition status transitions to `ended` or `archived`
- Re-entry rule:
	- a row in `ineligible` state may re-enter `registered` only through trusted `register_for_competition` re-validation after roster repair and while registration timing constraints still pass
- While locked, trusted write paths must block invite creation/acceptance, member add/remove, member leave, manual leadership transfer, and team archival from mathlete-facing flows.
- Defensive moderation exception: trusted admin or organizer moderation may deactivate membership for suspended/deleted users, but must mark related registration `ineligible` with `status_reason` and preserve audit traces.

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
| `payload_json` | jsonb | control actions include `request_idempotency_token`; pause, resume, extend, and reset payloads include a required reason |
| `happened_at` | timestamptz |

Idempotency contract: control-action RPCs (`publish_competition`, `publish_leaderboard`, `pause_competition`, `resume_competition`, `extend_competition`, `reset_attempt_for_disconnect`, `recalculate_competition_scores`) must require `request_idempotency_token`. `pause_competition`, `resume_competition`, `extend_competition`, and `reset_attempt_for_disconnect` must also require a non-empty reason. Duplicate `(competition_id, event_type, actor_user_id, request_idempotency_token)` requests return the existing event and must not re-apply side effects.

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

Canonical timing contract: `attempt_intervals` are audit and lifecycle records only; they do not pause consumed competition time. Remaining time is always derived from trusted server time against canonical deadlines, so offline/disconnect gaps continue consuming remaining time until submit, auto-submit, or competition end.

Canonical timer deadline naming and derivation:

- `attempt_base_deadline_at = competition_attempts.started_at + make_interval(mins => competitions.duration_minutes)`
- `scheduled_competition_end_cap_at = coalesce(competitions.end_time, competitions.start_time + make_interval(mins => competitions.duration_minutes))`
- `effective_attempt_deadline_at = least(attempt_base_deadline_at, scheduled_competition_end_cap_at)` for scheduled competitions
- `effective_attempt_deadline_at = attempt_base_deadline_at` for open competitions

### `attempt_answers`

Purpose: autosaved and submitted answers for each problem in an attempt.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `attempt_id` | uuid fk -> competition_attempts.id |
| `competition_problem_id` | uuid fk -> competition_problems.id |
| `answer_latex` | text |
| `answer_text_normalized` | text |
| `status_flag` | enum `answer_status_flag` | `blank`, `filled`, `solved`, `reset` |
| `is_correct` | boolean nullable |
| `points_awarded` | numeric nullable |
| `last_saved_at` | timestamptz |

Unique key: `(attempt_id, competition_problem_id)`.

Canonical untouched-question contract: `start_competition_attempt` pre-seeds one `attempt_answers` row per `competition_problem` with `status_flag = 'blank'` and empty answer payload fields. Review, submission, grading, and navigator counts must derive from persisted `status_flag` rows only. If a legacy attempt misses pre-seeded rows, trusted query helpers must deterministically infer missing rows as `blank` through left-join projection before counting.

### `tab_switch_logs`

Purpose: anti-cheat offense logs.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `attempt_id` | uuid fk -> competition_attempts.id |
| `offense_number` | integer |
| `penalty_applied` | text |
| `client_timestamp` | timestamptz nullable | normalized mirror of `metadata_json.client_timestamp` when provided and parseable |
| `logged_at` | timestamptz |
| `metadata_json` | jsonb | required keys: `event_source`, `visibility_state`, `route_path`, `user_agent`, `client_timestamp` (value may be null) |

Canonical anti-cheat metadata contract: client-provided time lives at `metadata_json.client_timestamp` as the canonical location and may be null when unavailable. Trusted `log_tab_switch_offense` must reject malformed metadata (missing required keys or invalid key types), and when `metadata_json.client_timestamp` is present and parseable it should be mirrored into `tab_switch_logs.client_timestamp` for indexed analytics.

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

Dispute-create guard: insert is allowed only after competition end (`competitions.status IN ('ended','archived')`) and only when the reporter owns the referenced attempt/registration for the same competition problem.

### `competition_problem_corrections`

Purpose: post-publish correction artifacts for accepted disputes and organizer-approved answer-key fixes without mutating immutable publish snapshots.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `competition_id` | uuid fk -> competitions.id |
| `competition_problem_id` | uuid fk -> competition_problems.id |
| `dispute_id` | uuid fk -> problem_disputes.id nullable | nullable only for trusted manual correction paths |
| `correction_type` | enum `problem_correction_type` | `answer_key_override`, `points_override` |
| `corrected_answer_key_json` | jsonb nullable |
| `corrected_points` | integer nullable |
| `reason` | text |
| `created_by` | uuid fk -> profiles.id |
| `created_at` | timestamptz |
| `superseded_at` | timestamptz nullable |

Indexes: `competition_problem_corrections_competition_idx`, `competition_problem_corrections_problem_idx`, partial unique active correction on `(competition_problem_id, correction_type)` where `superseded_at is null`.

Constraints: immutable publish snapshots remain unchanged; correction rows are append-only and superseded by setting `superseded_at`; `answer_key_override` requires `corrected_answer_key_json`; `points_override` requires `corrected_points`; accepted-dispute recalculation must read active correction artifacts deterministically. Effective points precedence is canonical: `effective_points = active points_override.corrected_points` when an active `points_override` exists for the competition problem, else `effective_points = competition_problems.points`.

### `leaderboard_entries`

Purpose: read-optimized ranking output for competition pages and history.

Implementation: refreshable table maintained by trusted RPC.

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

Idempotency contract: trusted notification writes must include deterministic `event_identity_key` in `metadata_json`, with uniqueness on `(recipient_id, event_identity_key)` so retried deliveries are no-op.

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
| `requested_by` | uuid fk -> profiles.id | must be competition owner organizer or admin |
| `format` | enum `export_format` | `csv`, `xlsx` |
| `status` | enum `export_status` | `queued`, `processing`, `completed`, `failed` |
| `storage_path` | text nullable |
| `error_message` | text nullable |
| `created_at` | timestamptz |
| `completed_at` | timestamptz nullable |

Constraints: export requests and export file retrieval are allowed only for competition owner organizers and admins; participants cannot queue or download exports.

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

### Storage buckets

Purpose: storage is part of the backend contract, not an implementation afterthought.

- `organizer-assets`: organizer-application logos only, persisted by canonical key `organizer-applications/{application_id}/logo.{ext}`. `organizer_applications.logo_path` stores this path only (never a public URL). Uploads use trusted signed flows and raw objects are not broadly public.
- `problem-assets`: organizer and admin problem images referenced by authored problems and immutable competition snapshots.
- `exports`: generated CSV or XLSX files; objects are private and only retrievable by the requester, competition owner, or admin through trusted handlers.

## Section C - ERD Explanation

- `profiles` is the root actor table for every user-owned record.
- `organizer_applications` represents the organizer-eligibility workflow before and after account provisioning. A row may exist before any `profiles` row is created, and approved rows link to the eventual organizer profile.
- `problem_banks` and `problems` are mutable authoring tables; `competition_problems` is the immutable publish snapshot.
- `teams`, `team_memberships`, and `team_invitations` model group ownership and roster history.
- `competition_registrations` represents who is allowed into a competition. `competition_attempts` represents what actually happened in the arena.
- `attempt_answers` always point at `competition_problems`, not `problems`, so grading is immune to later edits in the bank; untouched-question counting remains deterministic through pre-seeded blank rows with trusted blank inference fallback for legacy attempts.
- `leaderboard_entries` is derived from attempts and registrations and should be treated as read-optimized output, not the grading source of truth.
- `competition_problem_corrections` stores accepted-dispute and manual correction artifacts that recalculation reads as overlays on immutable snapshots.
- `problem_disputes`, `competition_events`, and `admin_audit_logs` provide operational traceability.
- `profiles.session_version` is the auth-side coordination field used to invalidate stale sessions after a later login is accepted.

## Section D - RLS and Authorization Model

### Global Rules

- enable RLS on every table in `public`
- keep service-role access server-only
- all security-definer functions must set an explicit `search_path`
- prefer ownership checks over role checks where possible

### Table Access Summary

- `profiles`: self read/update for profile fields; admin can read/update all; no self role escalation; self-service updates cannot mutate login identifier/email
- `organizer_applications`: public applicants submit through a trusted route or RPC; applicant status is exposed only through secure lookup tokens or trusted handlers; admins can review pending rows and write terminal decisions through trusted decision paths. Normal flows preserve reviewed-row immutability (`approved`/`rejected` rows are not mutable or deletable). Hard delete is allowed only through an explicit trusted spam or fraud moderation path with mandatory `admin_audit_logs` write (actor, reason, `application_id`, evidence metadata) before deletion.
- `problem_banks` and `problems`: owner organizer or admin-managed default-bank owner can mutate; other organizers cannot read private banks; admins can read all and mutate only the default bank or explicitly moderated records through trusted server paths
- `teams`, `team_memberships`, `team_invitations`: members can read their own team data; leaders can invite/remove within policy; admins can read all for moderation
- `competitions`: organizers can fully manage their own (including pause/resume/extend controls, where pausing lets active attempts finish but blocks new starts); admins can read all and can force-pause or moderate-delete only through approved server actions; mathletes read only published competitions they are eligible to see
- `competition_problems`: organizers and admins for their competitions; participants only after the competition starts, and only through joins scoped to an owned registration or attempt. `answer_key_snapshot_json` and explanation fields must additionally enforce `answer_key_visibility` (`after_end`: competition ended and viewer has owned registration/attempt context, `hidden`: never visible to participants)
- `competition_registrations`: writes are allowed only through trusted validation RPCs (`register_for_competition`, `withdraw_registration`); team-path registration additionally requires active team-leader ownership checks
- `competition_announcements`: organizers and admins can insert for owned competitions through trusted handlers; only active or relevant participants and operators in that competition can read the resulting records
- `competition_events`: organizers and admins can read the full competition timeline for owned competitions; control-action writes require trusted idempotency tokens and required reasons for pause/resume/extend/reset; admin live support may force-pause, while resume/extend/reset controls remain organizer-only; participant-facing event visibility must use trusted filtered projections rather than raw table access
- `competition_attempts`, `attempt_intervals`, `attempt_answers`, `tab_switch_logs`: only the owning registration and the competition owner or admin can read; participants can insert/update only through guarded RPCs while the attempt is active
- `problem_disputes`: reporter can insert/select own disputes only after competition end and only for owned attempt/registration context; organizer and admin can read and resolve disputes for owned competitions
- `competition_problem_corrections`: organizers and admins can read for owned competitions; writes are allowed only through trusted dispute-resolution or correction handlers; participants consume correction effects through derived views and never mutate raw correction rows
- `leaderboard_entries`: organizer and admin readers can always read for owned or moderated competitions; participant-context readers require owned registration or attempt context. Scheduled leaderboards require `leaderboard_published = true`. Open leaderboards are self-row only while status is `live` or `paused`, and full leaderboard when status is `ended` or `archived`.
- `notifications` and `notification_preferences`: owner only for reads and preference writes, plus admin via support tooling if explicitly needed; notification creation and read-state mutation stay on trusted paths
- `export_jobs`: requester plus competition owner and admin, with request creation constrained to competition owner organizers and admins only
- `admin_audit_logs`: admin only
- `system_settings`: admin only

### Leaderboard and Export Visibility Matrix (Canonical)

- Leaderboard visibility:
	- organizer/admin for owned or moderated competitions: always visible
	- participant-context access predicate: viewer must own a registration or attempt in the competition
	- participant-context viewer:
		- scheduled competitions: full leaderboard visible only when `leaderboard_published = true`
		- open competitions while `status IN ('live','paused')`: self row only
		- open competitions while `status IN ('ended','archived')`: full leaderboard visible
		- open competitions while `status IN ('draft','published')`: hidden
	- viewers without participant context: denied unless a future trusted projection explicitly grants access
- Export visibility and access:
	- queue/export-job create: competition owner organizer or admin only
	- export-job row reads: requester, competition owner, or admin only
	- export file delivery from storage: requester, competition owner, or admin only
	- participants and non-owner mathletes: no queue, no export-job read, no file download access

## Section E - DB Functions, Triggers, and RPCs

Required trusted functions:

- `insert_profile_for_new_user()` trigger on `auth.users`
- `handle_profile_changes()` trigger for protected `profiles` updates
- `create_default_notification_preferences()` trigger on profile insert
- `rotate_session_version(profile_id)` or equivalent trusted auth-session invalidation helper
- `lookup_organizer_application_status(status_lookup_token)`: accepts raw opaque token from applicant, hashes token for comparison against `status_lookup_token_hash`, and returns only safe fields (status, rejection_reason, masked_contact_email). `rejection_reason` must be safe-public sanitized content only. Negative paths (invalid token, unknown token, expired token) must return a single non-disclosing response shape and code so lookup cannot be used as an enumeration oracle. Must never return raw PII. Requires 1-second rate limit to prevent brute force.
- `approve_organizer_application(application_id)`: allows only `pending -> approved`, stamps `reviewed_at`, is idempotent for repeated approve requests on already-approved rows, and writes organizer-application decision fields only (must not mutate `profiles.role` or `profiles.approved_at`)
- `reject_organizer_application(application_id, rejection_reason)`: allows only `pending -> rejected`, stamps `reviewed_at`, is idempotent for repeated reject requests on already-rejected rows, and writes organizer-application decision fields only (must not mutate `profiles.role` or `profiles.approved_at`)
- `provision_organizer_account(application_id)` or equivalent trusted organizer-activation helper: owns organizer-role activation and `approved_at` stamping after approved decisions; if `organizer_applications.profile_id` is null, it must provision or link profile identity first, then set organizer activation fields
- `snapshot_competition_problems(competition_id)`
- `publish_competition(competition_id, request_idempotency_token)`
- `register_for_competition(competition_id, team_id default null)`
- `withdraw_registration(registration_id)`
- `validate_team_registration(team_id, competition_id)`
- `start_competition_attempt(registration_id)` pre-seeds `attempt_answers` blank rows for all `competition_problems`
- `resume_competition_attempt(attempt_id)`
- `close_active_attempt_interval(attempt_id)`
- `save_attempt_answer(attempt_id, competition_problem_id, answer_payload, status_flag)` where `answer_payload` is canonical LaTeX or normalized text derived from MathLive input
- `create_problem_dispute(competition_problem_id, attempt_id, reason)` enforces post-end timing and ownership scope (branch `13-review-submission` ownership contract)
- `can_view_answer_key(competition_id, viewer_profile_id)` enforces `answer_key_visibility` (`after_end` requires ended competition plus owned registration/attempt context; `hidden` always denies participant access)
- `log_tab_switch_offense(attempt_id, metadata_json)` validates required anti-cheat metadata keys and mirrors parseable `metadata_json.client_timestamp` into `tab_switch_logs.client_timestamp`
- `grade_attempt(attempt_id)` (branch `07-scoring-system` scoring RPC contract ownership)
- `recalculate_competition_scores(competition_id, request_idempotency_token)` computes effective grading inputs as immutable snapshots plus active `competition_problem_corrections` overlays, with canonical points precedence (`active points_override.corrected_points` else `competition_problems.points`) (branch `07-scoring-system` scoring RPC contract ownership)
- `refresh_leaderboard_entries(competition_id)` (branch `07-scoring-system` scoring RPC contract ownership)
- `publish_leaderboard(competition_id, request_idempotency_token)`
- `broadcast_competition_announcement(competition_id, audience, message)`
- `pause_competition(competition_id, reason, request_idempotency_token)` organizer control action with admin force-pause support
- `resume_competition(competition_id, reason, request_idempotency_token)` organizer-only control action
- `extend_competition(competition_id, additional_minutes, reason, request_idempotency_token)` organizer-only control action
- `reset_attempt_for_disconnect(attempt_id, reason, request_idempotency_token)` organizer-only control action
- `resolve_problem_dispute(dispute_id, resolution_status, resolution_note)` (branch `14-leaderboard-history` dispute-resolution ownership contract)
- `record_competition_problem_correction(competition_problem_id, dispute_id, correction_type, corrected_payload, reason)` (branch `14-leaderboard-history` correction ownership contract)
- `queue_export_job(competition_id, format)` owner organizer or admin only
- `enqueue_notification(recipient_id, type, title, body, link_path, event_identity_key, metadata_json)` de-duplicates by `(recipient_id, event_identity_key)`
- `mark_notification_read(notification_id)`
- `mark_all_notifications_read()`
- `transfer_team_leadership(team_id)`

### Policy Consistency Contracts

- Status lookup token policy: raw lookup tokens are transient input only; persisted storage is hash-only (`status_lookup_token_hash`) and lookup responses are restricted safe fields.
- Status lookup negative-path policy: unknown, invalid, or expired lookup tokens must return one generic non-disclosing response and deterministic machine code, with no token-validity leak.
- Organizer login-identifier immutability policy: organizer self-service settings cannot change `profiles.email`; only trusted admin/auth credential flows can mutate login identifier.
- Organizer decision-transition policy: organizer application decisions allow only `pending -> approved` or `pending -> rejected`; direct terminal-to-terminal flips are forbidden.
- Organizer decision-field immutability policy: after first terminal decision, `status`, `reviewed_at`, and `rejection_reason` are immutable.
- Organizer activation ownership policy: decision functions (`approve_organizer_application`, `reject_organizer_application`) never mutate organizer role activation fields; trusted activation or provisioning (`provision_organizer_account` or equivalent) alone may set `profiles.role = 'organizer'` and `profiles.approved_at`, including approved rows that start with `profile_id is null`.
- Organizer rejection reason policy: `organizer_applications.rejection_reason` is sanitized safe-public text only and is present only for rejected outcomes.
- Organizer logo-path policy: `organizer_applications.logo_path` stores only canonical storage paths in the format `organizer-applications/{application_id}/logo.{ext}`.
- Competition format invariant policy: `competitions.format = 'team'` is legal only when `competitions.type = 'scheduled'`; open competitions are always individual format.
- Competition name-uniqueness policy: uniqueness predicate is `is_deleted = false AND status IN ('draft','published','live','paused','ended')` scoped by organizer; `archived` rows are excluded.
- Description cap policy: `problem_banks.description` is capped at 200 words and `competitions.description` is capped at 500 words through DB checks and trusted write validation.
- Registration withdrawal policy: scheduled withdrawals require `now() < competitions.start_time` and zero attempt rows; open withdrawals require zero attempt rows; any attempt row blocks participant withdrawal.
- Ineligible re-entry policy: `competition_registrations.status = 'ineligible'` may transition back to `registered` only through trusted re-validation while registration timing still allows entry.
- Dispute-create timing policy: dispute creation is allowed only after competition end (`ended` or `archived`) and only for owned attempt/registration context.
- Answer-key visibility policy: answer-key access is controlled by `answer_key_visibility` and post-competition checks; it must never be derived from `leaderboard_published`.
- Open-leaderboard visibility policy: participant-context access requires owned registration or attempt; open competitions expose self row only while `live` or `paused`, and full leaderboard only once `ended` or `archived`.
- Timer and interval policy: `attempt_intervals` support reconnect auditability only and never pause consumed time; offline gaps consume remaining trusted competition time.
- Anti-cheat metadata policy: canonical client time field is `metadata_json.client_timestamp` (nullable value required key); `tab_switch_logs.client_timestamp` is a normalized mirror for query/index use.
- Answer-status counting policy: untouched-question counts come from pre-seeded `attempt_answers.status_flag = 'blank'`, with deterministic blank inference fallback only for legacy rows.
- Correction artifact policy: accepted disputes or manual answer-key fixes must write `competition_problem_corrections`; recalculation reads immutable snapshots plus active corrections without mutating original snapshot columns.
- Effective points precedence policy: effective points for grading or recalculation are deterministic per competition problem: active trusted `points_override` wins; if none is active, fallback is `competition_problems.points`.
- Leaderboard/export access policy: scheduled visibility depends on organizer publish gate, open visibility follows explicit self-row/full-row timing rules, and export queue/download access is strictly owner organizer or admin only.
- Notification idempotency policy: retries must de-duplicate by `(recipient_id, event_identity_key)`.
- Competition-control permission policy: admin live support may force-pause and follows a separate moderation delete path; resume, extend, and disconnect-reset controls are organizer-only.
- Competition-control reason policy: pause, resume, extend, and disconnect-reset control actions require a non-empty reason.
- Competition-control idempotency policy: control-action requests de-duplicate by `(competition_id, event_type, actor_user_id, request_idempotency_token)` and return existing results on replay.
- Account-removal policy: non-spam/fake account removals are anonymization-only; hard-delete is reserved for explicit spam/fake abuse paths with admin audit trace.
- Formula stack policy: editable math input uses MathLive, static rendering uses KaTeX, and persisted canonical math values remain LaTeX.
- Timer naming policy: trusted timing logic must use canonical names and derivations `attempt_base_deadline_at`, `scheduled_competition_end_cap_at`, and `effective_attempt_deadline_at`; scheduled attempts are capped by the scheduled competition end cap.

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
7. disputes, correction artifacts, notifications, export jobs, leaderboard output
8. supporting RPCs, triggers, and performance indexes

Audit baseline contract: missing future-branch routes or tables in current app or migrations are expected before the owning branch executes; treat these as planned sequencing gaps, not contradictions.

Risky migrations and backfills:

- moving from mutable problem references to immutable competition snapshots
- adding leaderboard publication rules after attempts already exist
- recalculating scores if answer normalization changes
- backfilling notification preferences for existing users
- converting legacy timer math to interval-audited lifecycle handling while preserving the non-pausing consumed-time rule
- migrating legacy boolean lifecycle columns to canonical enum status contracts (`draft`, `published`, `live`, `paused`, `ended`, `archived`) without breaking branch-order rollout

### Reference-Integrity Migration Contracts (Canonical)

#### Legacy Admin Route Params (`[id]` -> `[competitionId]` / `[bankId]`)

1. Compatibility introduce: keep existing legacy admin routes and add canonical route variants using `[competitionId]` and `[bankId]`.
2. Producer cutover: update all trusted route producers (`link_path`, server redirects, admin navigation, notifications metadata) to emit canonical params only; until this cutover lands, legacy `[id]` producers may still exist as compatibility artifacts.
3. Post-cutover compatibility verification: after step 2 is merged, block new legacy producers by lint or grep gate in branch `17-testing-bug-fixes`; ensure zero new `/admin/**/[id]` writers.
4. Legacy removal: remove legacy route handlers or files after producer cutover is complete; optional redirects may remain only as read-only compatibility.

#### Competition Lifecycle Status Migration (`legacy booleans` -> enum `competition_status`)

1. Compatibility add: add enum `competition_status` and nullable `competitions.status` while legacy booleans remain writable.
2. Deterministic backfill: run one-shot backfill with precedence `archived > ended > paused > live > published > draft` into `competitions.status`.
3. Dual-write compatibility: add temporary trusted trigger or write-path shim so updates keep legacy booleans and enum status synchronized during rollout.
4. Cutover and enforce: move RPCs, RLS, and read paths to enum status only; set `competitions.status not null`, enforce enum-only checks, and add final indexes or constraints.
5. Drop legacy fields: remove deprecated boolean lifecycle columns and compatibility sync trigger only after cutover verification passes.

### Per-Branch Schema and Function Ownership Matrix (Canonical)

| Branch | Schema ownership introduced in branch | Trusted function or trigger ownership introduced in branch |
| --- | --- | --- |
| `01-foundation` | foundational enums, `profiles`, `organizer_applications`, `notification_preferences` | `insert_profile_for_new_user`, `handle_profile_changes`, `create_default_notification_preferences` |
| `02-authentication` | no new domain table; auth-session coordination on `profiles.session_version` | `rotate_session_version` or equivalent trusted session invalidation helper |
| `04-admin-user-management` | `admin_audit_logs`, `system_settings` | `approve_organizer_application`, `reject_organizer_application` |
| `05b-deferred-foundation-and-auth` | compatibility hardening only; no new canonical domain table | trusted anonymization or compatibility helpers if required by rollout |
| `05-organizer-registration` | organizer onboarding storage-path contract; profile link activation contract for approved applications | `lookup_organizer_application_status`, `provision_organizer_account` |
| `06-problem-bank` | `problem_banks`, `problems` | trusted bank or problem mutation helpers as needed |
| `07-scoring-system` | scoring enums and scoring snapshot contract fields used by competitions | `grade_attempt`, `recalculate_competition_scores`, `refresh_leaderboard_entries` |
| `08-competition-wizard` | `competitions`, `competition_problems` | `snapshot_competition_problems`, `publish_competition` |
| `09-team-management` | `teams`, `team_memberships`, `team_invitations` | `transfer_team_leadership` |
| `10-competition-search` | `competition_registrations` | `register_for_competition`, `withdraw_registration`, `validate_team_registration` |
| `11-arena` | `competition_attempts`, `attempt_intervals`, `attempt_answers` | `start_competition_attempt`, `resume_competition_attempt`, `close_active_attempt_interval`, `save_attempt_answer` |
| `12-anti-cheat` | `tab_switch_logs` | `log_tab_switch_offense` |
| `13-review-submission` | `problem_disputes` (participant dispute-create ownership); submission contracts on existing attempt tables | `create_problem_dispute`, `can_view_answer_key` |
| `14-leaderboard-history` | `competition_problem_corrections`, `leaderboard_entries` (leaderboard/history surfaces), `export_jobs`; dispute-resolution contracts on existing `problem_disputes` rows | `resolve_problem_dispute`, `record_competition_problem_correction`, `publish_leaderboard`, `queue_export_job` |
| `15-notifications-polish` | `notifications` | `enqueue_notification`, `mark_notification_read`, `mark_all_notifications_read` |
| `16-participant-monitoring` | `competition_announcements`, `competition_events` | `broadcast_competition_announcement`, `pause_competition` (organizer path plus admin force-pause support), `resume_competition`, `extend_competition`, `reset_attempt_for_disconnect` (resume/extend/reset are organizer-only control actions) |
| `17-testing-bug-fixes` | no new domain table by default; cleanup or compatibility removals only | migration cleanup gates only (no new primary business-domain RPCs) |

## Section H - Change Log

- 2026-04-03: Rebuilt the database, ERD, and RLS plan for the full greenfield Mathwiz Arena implementation. Added missing tables for team invites, attempt intervals, disputes, notifications, exports, system settings, competition snapshots, and realtime-aware operational flows.
- 2026-04-03: Clarified the trusted session invalidation contract, storage-bucket ownership rules, explicit announcement and event access rules, and the missing live-control plus dispute-resolution RPC surface.
- 2026-04-03: Made source-of-truth contracts deterministic for status lookup sanitization/negative paths, team-format invariants, description caps, registration withdrawal timing, non-pausing interval timing, anti-cheat metadata keys, untouched-answer counting, accepted-dispute correction artifacts, and leaderboard/export visibility boundaries.
- 2026-04-03: Resolved remaining core-contract gaps for open leaderboard timing/predicate, organizer identifier immutability, organizer decision idempotency, dispute-create timing guard, canonical organizer logo paths, control-action and notification idempotency keys, explicit competition-name uniqueness statuses, and account-removal semantics.
- 2026-04-03: Added explicit branch `04` decision-only versus branch `05` activation-only organizer ownership, deterministic points precedence fallback, canonical timer-deadline naming, concrete route and lifecycle migration sequences, and a per-branch schema/function ownership matrix.


### User Deletion Privacy Rule
- Non-spam/fake account-removal path is anonymization-only: scrub PII in `profiles`, retain historical submissions/scores, and keep leaderboard integrity via anonymized references.
- Hard-delete is reserved only for explicit spam/fake abuse actions and must be executed through trusted admin moderation with immutable audit logs.
