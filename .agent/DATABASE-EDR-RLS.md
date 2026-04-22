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
- The default tie-breaker is earliest final submission unless explicitly overridden. For multi-attempt modes (`highest_score`, `latest_score`), tie-breakers evaluate the attributes (`total_time_seconds` and `submitted_at`) of the specific attempt that provided the chosen score. For `average_score`, the tie-breaker uses the aggregate average time or the `submitted_at` of the latest valid attempt.
- All limits are enforced through DB constraints and trusted RPC logic.

### Core Entity Groups

- identity and roles: `profiles`, `organizer_applications`, `organizer_application_communications`, `organizer_status_lookup_throttle`, `notification_preferences`
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
| `status_lookup_token_expires_at` | timestamptz | explicit status-lookup token expiry boundary; lookups at or after this timestamp are expired |
| `status` | enum `organizer_application_status` |
| `rejection_reason` | text | sanitized safe-public message only for rejected outcomes |
| `submitted_at` | timestamptz |
| `reviewed_at` | timestamptz |

Indexes: `organizer_applications_status_idx`, `organizer_applications_profile_idx`, `organizer_applications_contact_email_idx`, `organizer_applications_pending_contact_email_uq` (unique partial index on `lower(contact_email)` where `status = 'pending'`).

Constraints: `profile_id` may remain null until approval; only one active pending application must exist per `contact_email`, enforced by `organizer_applications_pending_contact_email_uq`; status transitions are `pending -> approved` or `pending -> rejected` only through trusted decision functions; once approved or rejected, decision fields (`status`, `reviewed_at`, `rejection_reason`) are immutable; repeated identical decisions must be idempotent no-ops; status lookup tokens are stored hashed rather than in raw form and must include explicit expiry via `status_lookup_token_expires_at`; lookups at or after that boundary are expired; `rejection_reason` must be persisted as safe-public sanitized text (plain text only, no HTML, links, emails, or phone numbers, max 500 characters) and is required only when `status = 'rejected'`.

Organizer decision vs activation ownership contract (canonical): branch `04-admin-user-management` decision flows write only organizer-application terminal decision fields (`status`, `reviewed_at`, `rejection_reason`) and never mutate `profiles.role` or `profiles.approved_at`; branch `05-organizer-registration` trusted activation or provisioning path owns organizer-role activation. For approved rows where `profile_id is null`, the activation path provisions or links the profile first, then sets organizer role and `approved_at`.

### `organizer_application_communications`

Purpose: branch-05 transactional organizer communication ledger for deterministic idempotency across submission, approval, and rejection message delivery.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `application_id` | uuid fk -> organizer_applications.id |
| `message_type` | enum organizer_application_message_type | `submission`, `approved`, `rejected` |
| `recipient_email` | text | lowercased recipient |
| `payload_json` | jsonb | template context metadata |
| `send_attempts` | integer | retry counter |
| `last_attempt_at` | timestamptz nullable |
| `sent_at` | timestamptz nullable |
| `last_error` | text nullable |
| `provider_message_id` | text nullable |
| `created_at` | timestamptz |

Indexes: unique `(application_id, message_type)` and pending-send index on `created_at where sent_at is null`.

Constraints: one logical communication per `(application_id, message_type)`; retries mutate attempt metadata but must not create duplicate logical rows.

### `organizer_status_lookup_throttle`

Purpose: deterministic status-lookup throttle ledger keyed by client IP and token fingerprint.

| Column | Type | Notes |
| --- | --- | --- |
| `client_ip` | inet | request source IP (fallback `0.0.0.0`) |
| `token_fingerprint` | text | normalized token fingerprint; malformed tokens map to `malformed` bucket |
| `last_accepted_at` | timestamptz | latest accepted lookup for key |
| `created_at` | timestamptz | row creation timestamp |

Indexes: `organizer_status_lookup_throttle_last_accepted_idx` on `last_accepted_at`.

Constraints: primary key `(client_ip, token_fingerprint)`; service-role-only RLS access; throttle acceptance window is one request per key per rolling 1 second.

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

Constraints: active owner-scoped names are unique by `lower(name)` where `is_deleted = false`; `name` must be non-blank; `description` must not exceed 200 words; `is_default_bank`, `is_visible_to_organizers`, and `updated_at` are non-null; hard delete is blocked by trigger and all delete semantics are soft-delete only (`is_deleted = true`); problem create, update, and delete writes must touch parent bank `updated_at` via trigger to keep bank recency deterministic; active published competitions may still reference problems from soft-deleted banks because competition snapshots are immutable.

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

Constraints: `content_latex`, `answer_key_json`, and `updated_at` are non-null; `answer_key_json` must be a JSON object when present; `options_json` is required and must be an array for `mcq` and `tf`; canonical and legacy compatibility columns are synchronized by trigger; hard delete is blocked by trigger and all delete semantics are soft-delete only (`is_deleted = true`); multiple choice options must be unique and answer payload shape depends on `type`.

### `problem_import_jobs`

Purpose: deterministic import idempotency and row-level failure ledger for bulk problem ingestion.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `bank_id` | uuid fk -> problem_banks.id |
| `actor_id` | uuid fk -> profiles.id |
| `idempotency_token` | text | caller-provided replay key |
| `status` | text | `processing`, `completed`, `failed` |
| `total_rows` | integer |
| `inserted_rows` | integer |
| `failed_rows` | integer |
| `row_errors_json` | jsonb | canonical per-row import errors |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |
| `completed_at` | timestamptz nullable |

Indexes: unique `(bank_id, actor_id, idempotency_token)`, `(actor_id, created_at desc)`.

Constraints: `idempotency_token` must be non-blank; `status` is constrained to `processing|completed|failed`; row counters are non-negative; `row_errors_json` must be a JSON array; `updated_at` refreshes through trigger.

### `teams`

Purpose: mathlete-created teams for team competitions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `name` | text | unique by `lower(name)` |
| `team_code` | text | unique, stored uppercase |
| `created_by` | uuid fk -> profiles.id |
| `is_archived` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Indexes: unique `teams_name_lower_uq` on `lower(name)`, unique `teams_team_code_uq` on `team_code`.

Constraints: `team_code` must be uppercase with 10 alphanumeric characters; `updated_at` is maintained by trigger.

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

Indexes: unique active membership on `(team_id, profile_id)`, unique active leader on `(team_id)` where role = `leader`, `team_memberships_active_idx` for active rows.

Constraints: when `is_active = true`, `left_at` must be null.

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

Indexes: unique pending invite on `(team_id, invitee_id)` where status = `pending`.

Constraints: when status is not `pending`, `responded_at` is required.

### `team_action_idempotency`

Purpose: deterministic idempotency ledger for team invite send/respond actions and roster mutation retries.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `team_id` | uuid fk -> teams.id |
| `actor_id` | uuid fk -> profiles.id |
| `target_profile_id` | uuid fk -> profiles.id nullable |
| `action_type` | text | caller-defined action key |
| `idempotency_token` | text | caller-provided replay key |
| `resource_id` | uuid nullable | optional pointer to created invite or membership row |
| `created_at` | timestamptz |

Indexes: unique `(team_id, actor_id, action_type, idempotency_token)`.

Constraints: `action_type` and `idempotency_token` must be non-blank.

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
| `answer_key_visibility` | enum `answer_key_visibility` | `after_end`, `hidden`; default `after_end` for FR14.5 fidelity |
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

Constraints: name uniqueness is scoped per organizer by predicate `is_deleted = false AND status IN ('draft','published','live','paused','ended')`; `archived` rows are excluded from the uniqueness predicate; scheduled competitions allow exactly one attempt; open competitions allow 1 to 3 attempts; team format is valid only when `type = 'scheduled'` and open competitions must enforce `format = 'individual'`; individual competitions allow 3 to 100 participants; scheduled team competitions allow 2 to 5 participants per team and 3 to 50 teams; `description` must not exceed 500 words; the default tie-breaker is earliest final submission timestamp unless explicitly overridden; answer-key visibility defaults to `after_end` for FR14.5 fidelity and is enforced separately from leaderboard publication via `answer_key_visibility`; participant answer-key reveal requires trusted server end-time plus participant-context ownership checks; published competitions freeze `scoring_snapshot_json` and may not mutate the effective scoring contract afterward; hard delete is allowed only for `status = 'draft'` through a trusted draft-delete path; non-draft hard delete is forbidden except trusted admin abuse or fraud moderation delete with mandatory audit reason; organizer pause is valid only for open competitions and must allow active attempts to finish while blocking new starts; scheduled competitions may enter `paused` only through trusted admin force-pause moderation; lifecycle transition `live` or `paused` to `ended` is allowed only through trusted end-transition handlers with deterministic split policy: scheduled competitions end only through `transition_source = 'system_timer'` at the server boundary, while open competitions may end through organizer-only `transition_source = 'trusted_manual_action'` with required non-empty reason and `request_idempotency_token`; end transitions must be idempotent.

### `competition_problems`

Purpose: immutable problem snapshots attached to a competition.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `competition_id` | uuid fk -> competitions.id |
| `problem_id` | uuid fk -> problems.id |
| `order_index` | integer |
| `points` | integer |
| `problem_type_snapshot` | enum `problem_type` |
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
| `entry_snapshot_json` | jsonb | immutable registration-time snapshot of display names, school, grade level, team name, and team roster context used by history and exports |
| `registered_at` | timestamptz |
| `updated_at` | timestamptz |

Constraint: exactly one of `profile_id` or `team_id` must be populated. `entry_snapshot_json` is populated exactly once by `register_for_competition(...)` at registration time and must not be backfilled from later profile or roster edits.

### Registration RPC Contract (Canonical)

`register_for_competition(competition_id uuid, team_id uuid default null, request_idempotency_token text)` is the branch `10` trusted participant-facing write path for creating new `competition_registrations` rows, using `auth.uid()` for actor ownership.

`register_for_competition(competition_id uuid, actor_user_id uuid, team_id uuid default null)` is the branch `11` service-role arena entry write path for pre-entry registration repair, and must fail closed unless `auth.role() = 'service_role'`.

- Individual registration path (`team_id is null`):
	- writes `profile_id = actor_user_id` and `team_id = null`
	- allowed only when `competitions.format = 'individual'`
- Team registration path (`team_id is not null`):
	- writes `team_id = team_id` and `profile_id = null`
	- allowed only when `competitions.format = 'team'` and `competitions.type = 'scheduled'`
	- trusted server route must pass authenticated `actor_user_id`, and that actor must be an active leader of the selected team
- Shared checks for both paths:
	- function must fail closed when `auth.role() <> 'service_role'`; authenticated clients must enter through trusted server routes so callers cannot spoof `actor_user_id`
	- participant is active and profile-complete
	- competition is visible, not deleted, and inside allowed registration window (for scheduled)
	- persist immutable `entry_snapshot_json` from the accepted registration context before returning success; individual snapshots store a `display_name` JSON key sourced from canonical `profiles.full_name`, and later profile, school, grade-level, or roster edits must not mutate the stored snapshot for that registration row
	- capacity and duplicate-registration guards pass, except trusted re-entry for the same `(competition_id, team_id)` when the prior status is `ineligible` OR `withdrawn` and registration timing still allows entry. When repairing an `ineligible` or `withdrawn` registration back to `registered` via re-entry, `entry_snapshot_json` MUST be regenerated and overwritten to capture the new context.
	- responses return deterministic machine-readable error codes for UI mapping

`withdraw_registration(registration_id uuid, status_reason text, request_idempotency_token text)` is the only trusted write path for withdrawal state transitions.

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
- Defensive moderation exception: trusted admin or organizer moderation may deactivate membership for suspended/deleted users. If this causes the team to fall below the minimum `participants_per_team` mid-competition, they must mark the related registration `ineligible` with `status_reason`, instantly transition any `in_progress` attempt to `disqualified` so they are not allowed to finish, and preserve audit traces.

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

Canonical `announcement_audience` enum values and recipient predicates:

- `registered_only`: recipients where `competition_registrations.status = 'registered'`; withdrawn, ineligible, and cancelled rows are excluded
- `registered_and_ineligible`: recipients where `competition_registrations.status in ('registered','ineligible')`; withdrawn and cancelled rows are excluded
- `all_non_cancelled`: recipients where `competition_registrations.status in ('registered','withdrawn','ineligible')`; cancelled rows are excluded
- `operators_only`: recipients are competition owner organizer plus admins only; participant registration rows are not targeted

### `competition_events`

Purpose: durable event timeline for publish, start, end, pause, resume, extend, archive, leaderboard publication, dispute resolution, score recalculation, and intervention actions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk |
| `competition_id` | uuid fk -> competitions.id |
| `event_type` | text | reset-related canonical values include `attempt_heartbeat_timeout_detected`, `platform_connection_drop_detected`, `resume_handshake_reconnect_detected`, `attempt_disconnect_reset_applied`, and `attempt_disconnect_reset_rejected` |
| `actor_user_id` | uuid fk -> profiles.id nullable | null for system-timer transitions; set for trusted manual actions |
| `payload_json` | jsonb | publish/start/end/archive/recalculation events include `request_idempotency_token`; manual pause, resume, extend, reset, and manual open-end payloads include a required reason; reset payloads must also include `request_idempotency_token`, `attempt_id`, `disconnect_evidence_type`, `disconnect_evidence_observed_at`, `disconnect_evidence_ref`, and `decision_outcome`; `competition_ended` payloads include `transition_source` (`system_timer` or `trusted_manual_action`) plus `reason_text` (required non-empty only for `trusted_manual_action`, null for `system_timer`); dispute/publication events include referenced ids needed for audit and notification fan-out |
| `happened_at` | timestamptz |

Reset evidence payload contract (closed values): `disconnect_evidence_type` must be one of `attempt_heartbeat_timeout`, `platform_connection_drop`, or `resume_handshake_reconnect`. `decision_outcome` must be one of `approved`, `rejected_ineligible_attempt_state`, `rejected_stale_evidence`, `rejected_duplicate_window`, `rejected_missing_required_tuple`, or `rejected_invalid_evidence_taxonomy`.
Reset evidence provenance contract: `disconnect_evidence_ref` must reference an existing `competition_events.id` row with event type `attempt_heartbeat_timeout_detected`, `platform_connection_drop_detected`, or `resume_handshake_reconnect_detected` in the same competition scope and for the same `attempt_id` being reset. If multiple qualifying detection rows exist in the 120-second window, select the newest by `disconnect_evidence_observed_at` (tie-breaker: latest `happened_at`, then highest `competition_events.id`).
Reset decision event contract: approved resets must emit `event_type = 'attempt_disconnect_reset_applied'` with `decision_outcome = 'approved'`; denied resets must emit `event_type = 'attempt_disconnect_reset_rejected'` with one of the `rejected_*` decision outcomes.
Duplicate-window contract: deny reset when an approved reset event exists for the same `attempt_id` with `happened_at > server_now_at_request - interval '10 minutes'`; exactly 10 minutes old is eligible.
Rejection precedence contract (first failing gate wins): `rejected_missing_required_tuple` -> `rejected_invalid_evidence_taxonomy` -> `rejected_ineligible_attempt_state` -> `rejected_stale_evidence` -> `rejected_duplicate_window`.

Idempotency contract: event-producing RPCs (`publish_competition`, `start_competition`, `end_competition`, `archive_competition`, `moderate_delete_competition`, `publish_leaderboard`, `pause_competition`, `resume_competition`, `extend_competition`, `reset_attempt_for_disconnect`, `resolve_problem_dispute`) must require `request_idempotency_token`. Token-source rule is canonical: caller supplies the token for every event-producing RPC except scheduled `end_competition` transitions with `transition_source = 'system_timer'`, which must use deterministic server token `system_end:{competition_id}:{effective_end_boundary_iso}`. `pause_competition`, `resume_competition`, `extend_competition`, `reset_attempt_for_disconnect`, `moderate_delete_competition`, and manual open `end_competition` must also require a non-empty reason. `end_competition` must enforce `transition_source in ('system_timer','trusted_manual_action')` with deterministic mapping: scheduled competitions must use `system_timer` only, while organizer manual end for open competitions must use `trusted_manual_action` and is not an admin live-support control. Duplicate `(competition_id, control_action, actor_user_id, request_idempotency_token)` requests return the existing outcome and must not re-apply side effects. For disconnect resets, both `attempt_disconnect_reset_applied` and `attempt_disconnect_reset_rejected` outcomes map to `control_action = 'reset_attempt_for_disconnect'` for replay safety. For moderation delete, both accepted and rejected moderation decisions map to `control_action = 'moderate_delete_competition'` for replay safety and audit parity. SQL uniqueness for this dedupe key must coalesce nullable `actor_user_id` to the system-actor sentinel in the unique key (`coalesce(actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)`). Branch-14 dispute/publication orchestration events must write canonical payload fields (`dispute_id`, `competition_problem_id`, `correction_artifact_ids`, `leaderboard_published`, `request_idempotency_token`), and `competition_ended` events must write (`transition_source`, `reason_text`, `request_idempotency_token`) where `reason_text` is required non-empty for `trusted_manual_action` and null for `system_timer` so notification fan-out and audit reads do not infer state indirectly. `recalculate_competition_scores(competition_id, request_idempotency_token)` remains compute-only and is not an event-producing RPC; `score_recalculated` event emission belongs to branch `14` orchestration.

### `competition_attempts`

Purpose: one attempt row per `attempt_no` for a participant or team registration in a competition.

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
| `attempt_base_deadline_at` | timestamptz | fixed at start |
| `scheduled_competition_end_cap_at` | timestamptz | fixed scheduled cap snapshot |
| `effective_attempt_deadline_at` | timestamptz | immutable trusted runtime deadline |

Indexes: `(competition_id, status)`, `(registration_id, attempt_no)`.

Unique key: `(registration_id, attempt_no)`.

### Team Attempt Authority and Concurrency Contract (Canonical)

- Individual registration attempts: only the owning `competition_registrations.profile_id` actor may start, resume, save, or submit the attempt lifecycle.
- Team registration attempts: only an active team leader for the registration team may start, resume, save, submit, or close active attempt intervals; non-leader team members are read-only in arena state views.
- Trusted `start`, `resume`, and `submit` attempt mutations must serialize writes by registration or attempt lock (`select ... for update` or equivalent) and enforce at most one active `in_progress` attempt per registration at any moment.
- Concurrent lifecycle races must return deterministic machine code `attempt_lifecycle_conflict`; idempotent retries with the same request token must return existing state and must not duplicate lifecycle side effects.

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
| `client_updated_at` | timestamptz | monotonic client freshness marker for deterministic stale-write rejection |

Unique key: `(attempt_id, competition_problem_id)`.

Canonical untouched-question contract: `start_competition_attempt` pre-seeds one `attempt_answers` row per `competition_problem` with `status_flag = 'blank'` and empty answer payload fields. Review, submission, grading, and navigator counts must derive from persisted `status_flag` rows only. If an older compatibility attempt misses pre-seeded rows, trusted query helpers must deterministically infer missing rows as `blank` through left-join projection before counting.

Answer write-order contract: `save_attempt_answer(...)` must reject stale or replayed writes using `client_updated_at` monotonic ordering and return deterministic machine code `answer_write_conflict` without mutating the stored row.

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

Default contract: `in_app_enabled = true`, `email_enabled = false`, and all event-category toggles default to `true` so the inbox is guaranteed by default while email remains opt-in.

Deterministic channel-precedence contract:

- Mandatory inbox class events (`in_app_only`) must always write exactly one inbox row per `(recipient_id, event_identity_key)` regardless of `in_app_enabled`.
- `competition_announcement_posted` must always write exactly one inbox row per `(recipient_id, event_identity_key)` for resolved recipients; email remains preference-governed.
- `email_eligible` events outside mandatory inbox classes write inbox only when `in_app_enabled = true` and the mapped event-category toggle is enabled.
- Email delivery always requires `email_enabled = true` and the mapped event-category toggle enabled.

Deterministic event-to-toggle mapping:

- `team_invite_sent`, `team_invite_accepted`, `team_invite_declined`, `team_roster_invalidated` -> `team_invites`
- `competition_registration_confirmed`, `competition_registration_withdrawn` -> `registration_reminders`
- `competition_announcement_posted` -> `announcements`
- `leaderboard_published`, `dispute_resolved` -> `leaderboard_publication`
- `score_recalculated` -> `score_recalculation`
- `organizer_application_submitted`, `organizer_application_approved`, `organizer_application_rejected` -> `organizer_decisions`
- Dispatch validation contract: each emitted notification event must map to exactly one toggle; unmapped events are invalid and must fail trusted dispatch.

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

Constraints: export requests and export file retrieval are allowed only for competition owner organizers and admins; participants cannot queue or download exports. Generated CSV/XLSX payloads must include immutable result context plus participant or team context from registration snapshots (`display_name` and `school` for individuals; `team_name` and roster snapshot for teams) in addition to ranking fields.

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
- `problem-assets`: private organizer and admin problem images referenced by authored problems and immutable competition snapshots. Canonical key format is `{owner_uuid}/{bank_uuid}/{asset_uuid}.{ext}` where ext is `jpg|jpeg|png|webp`; max size is 5 MB; allowed MIME values are `image/jpeg`, `image/png`, `image/webp`.
- `exports`: generated CSV or XLSX files; objects are private and only retrievable by the requester, competition owner, or admin through trusted handlers.

## Section C - ERD Explanation

- `profiles` is the root actor table for every user-owned record.
- `organizer_applications` represents the organizer-eligibility workflow before and after account provisioning. A row may exist before any `profiles` row is created, and approved rows link to the eventual organizer profile.
- `problem_banks` and `problems` are mutable authoring tables; `competition_problems` is the immutable publish snapshot.
- `teams`, `team_memberships`, and `team_invitations` model group ownership and roster history; `team_action_idempotency` captures replay-safe team mutations.
- `competition_registrations` represents who is allowed into a competition. `competition_attempts` represents what actually happened in the arena.
- `attempt_answers` always point at `competition_problems`, not `problems`, so grading is immune to later edits in the bank; untouched-question counting remains deterministic through pre-seeded blank rows with trusted blank inference fallback for older compatibility attempts.
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
- `organizer_application_communications`: trusted service-role workflows only; no anon or authenticated direct access. Rows are idempotency artifacts for organizer lifecycle communication dispatch and retry metadata.
- `problem_banks` and `problems`: owner organizer or admin-managed default-bank owner can mutate; other organizers cannot read private banks; admins can read all and mutate only the default bank or explicitly moderated records through trusted server paths; organizer reads for shared defaults require `is_default_bank = true`, `is_visible_to_organizers = true`, and active organizer profile status
- `problem_import_jobs`: actors read and mutate only their own import jobs (`actor_id = auth.uid()`), and insert or update is additionally scoped to writable banks (owner non-default bank or admin-managed default bank)
- `teams`, `team_memberships`, `team_invitations`: members can read their own team data; leaders can invite/remove within policy; admins can read all for moderation
- `team_action_idempotency`: service-role-only ledger for invite and roster idempotency
- `competitions`: organizers can manage their own competitions, but hard delete is allowed only for `draft` through trusted draft-delete paths; organizer pause is allowed only for open competitions and must let active attempts finish while blocking new starts; scheduled competition pause is reserved for trusted admin force-pause moderation; admins can read all and may perform non-draft moderation delete only for abuse or fraud through approved server actions with explicit audit reason; mathletes read only published competitions they are eligible to see
- `competition_problems`: organizers and admins for their competitions; participants only after the competition starts, and only through joins scoped to an owned registration or attempt. `answer_key_snapshot_json` and explanation fields must additionally enforce `answer_key_visibility` (`after_end`: competition ended and viewer has owned registration/attempt context, `hidden`: never visible to participants)
- `competition_registrations`: writes are allowed only through trusted validation RPCs (`register_for_competition`, `withdraw_registration`); team-path registration additionally requires active team-leader ownership checks
- `competition_announcements`: organizers and admins can insert for owned competitions through trusted handlers; recipient targeting must follow canonical `announcement_audience` predicates, including explicit withdrawn and ineligible inclusion or exclusion per enum value; only targeted participants and operators in that competition can read resulting records
- `competition_events`: organizers and admins can read the full competition timeline for owned competitions; publish/start/archive/live-control/dispute/publication/recalculation writes require trusted handlers with canonical payloads; admin live support may force-pause, while resume/extend/reset controls remain organizer-only; participant-facing event visibility must use trusted filtered projections rather than raw table access
- `competition_attempts`, `attempt_intervals`, `attempt_answers`, `tab_switch_logs`: only active members of the owning registration's team (or the individual participant) and the competition owner or admin can read; active participants can insert/update only through guarded RPCs while the attempt is active; team-registration lifecycle writes (`start`, `resume`, `submit`) are leader-authorized only with serialized concurrency guards
- `problem_disputes`: reporter can insert/select own disputes only after competition end and only for owned attempt/registration context; organizer and admin can read and resolve disputes for owned competitions
- `competition_problem_corrections`: organizers and admins can read for owned competitions; writes are allowed only through trusted dispute-resolution or correction handlers; participants consume correction effects through derived views and never mutate raw correction rows
- `leaderboard_entries`: organizer and admin readers can always read for owned or moderated competitions; participant-context readers require owned registration or attempt context. Scheduled leaderboards require `leaderboard_published = true`. Open leaderboards are fully visible to participant-context readers for any non-draft open competition state (`published`, `live`, `paused`, `ended`, `archived`).
- `notifications` and `notification_preferences`: owner-only reads and owner preference writes; admin may read via audited support tooling only; admin may not mutate user notification preferences or notification read-state unless a named trusted function is explicitly added to the ownership matrix; notification creation and read-state mutation stay on trusted paths
- `export_jobs`: requester plus competition owner and admin, with request creation constrained to competition owner organizers and admins only
- `admin_audit_logs`: admin only
- `system_settings`: admin only; branch `04-admin-user-management` owns a read-only settings shell in release one and no mutable settings RPC is implied unless a later guide explicitly introduces it

### Leaderboard and Export Visibility Matrix (Canonical)

- Leaderboard visibility:
	- organizer/admin for owned or moderated competitions: always visible
	- participant-context access predicate: viewer must own a registration or attempt in the competition
		- participant-context viewer:
			- scheduled competitions: full leaderboard visible only when `leaderboard_published = true`
			- open competitions while `status IN ('published','live','paused','ended','archived')`: full leaderboard visible
			- open competitions while `status = 'draft'`: hidden
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
- `create_default_notification_preferences()` trigger on profile insert; must create `in_app_enabled = true`, `email_enabled = false`, and all event-category toggles enabled by default
- `rotate_session_version(profile_id)` trusted auth-session invalidation helper
- `update_mathlete_profile_settings(profile_id, school, grade_level)` trusted mathlete self-service settings helper (school and grade-level only)
- `anonymize_user_account(target_profile_id, reason, request_idempotency_token)` trusted non-spam anonymization helper
- `insert_organizer_application_intake(applicant_full_name, organization_name, contact_email, contact_phone, organization_type, statement, legal_consent_at, status_lookup_token_hash, status_lookup_token_expires_at, profile_id)` trusted organizer intake writer with deterministic pending-row idempotency by contact-email scope
- `lookup_organizer_application_status(status_lookup_token)`: accepts raw opaque token from applicant, hashes token for comparison against `status_lookup_token_hash`, validates `now() < status_lookup_token_expires_at`, and returns only safe fields (status, rejection_reason, masked_contact_email). `rejection_reason` must be safe-public sanitized content only. Negative paths (invalid token, unknown token, expired token) must return a single non-disclosing response shape and code so lookup cannot be used as an enumeration oracle. Must never return raw PII. Throttling is deterministic by key dimensions `(client_ip, token_fingerprint)` where `token_fingerprint` is derived from normalized raw token input and malformed token input uses a fixed malformed bucket; enforce one accepted request per key per 1-second rolling window. Rate-limit violations return `429` with machine code `throttled`, `Retry-After: 1`, and no applicant data.
- `approve_organizer_application(application_id)`: allows only `pending -> approved`, stamps `reviewed_at`, is idempotent for repeated approve requests on already-approved rows, writes organizer-application decision fields only (must not mutate `profiles.role` or `profiles.approved_at`), and must emit one deterministic admin audit record for first terminal decision write
- `reject_organizer_application(application_id, rejection_reason)`: allows only `pending -> rejected`, stamps `reviewed_at`, is idempotent for repeated reject requests on already-rejected rows, writes organizer-application decision fields only (must not mutate `profiles.role` or `profiles.approved_at`), and must emit one deterministic admin audit record for first terminal decision write
- `provision_organizer_account(application_id)` trusted organizer-activation helper: owns organizer-role activation and `approved_at` stamping after approved decisions; if `organizer_applications.profile_id` is null, it must provision or link profile identity first, then set organizer activation fields
- `claim_organizer_application_communication(application_id, message_type, recipient_email, payload_json)` reserves a single lifecycle communication attempt for deterministic `(application_id, message_type)` dispatch
- `mark_organizer_application_communication_sent(communication_id, provider_message_id)` marks lifecycle communication sent exactly once
- `mark_organizer_application_communication_failed(communication_id, error)` records deterministic failure metadata for retry visibility
- `problem_bank_set_updated_at()` trigger helper for `problem_banks` and `problems` `updated_at` maintenance
- `touch_problem_bank_updated_at_from_problem()` trigger helper that updates parent `problem_banks.updated_at` after `problems` insert, update, or delete writes
- `refresh_problem_import_jobs_updated_at()` trigger helper for `problem_import_jobs.updated_at` maintenance
- `sync_problem_legacy_and_canonical_columns()` trigger helper that keeps legacy problem columns aligned with canonical branch-06 columns (`content_latex`, `options_json`, `answer_key_json`, `image_path`)
- `prevent_problem_bank_hard_delete()` trigger helper that blocks hard deletes on `problem_banks` and `problems`
- `problem_assets_path_owner_id(name)`, `problem_assets_path_bank_id(name)`, and `problem_assets_path_is_valid(name)` storage-policy helpers for canonical object-key validation and ownership extraction
- `snapshot_competition_problems(competition_id)`
- `publish_competition(competition_id, request_idempotency_token)`
- `start_competition(competition_id, request_idempotency_token)` trusted scheduled-competition promotion from `published` to `live` with idempotent event logging at the server-authoritative start boundary
- `end_competition(competition_id, reason, request_idempotency_token, transition_source)` trusted lifecycle transition from `live` or `paused` to `ended`; `transition_source` must be `system_timer` or `trusted_manual_action` with split enforcement: scheduled competitions accept `system_timer` only and do not allow organizer manual end, while open manual end accepts organizer-only `trusted_manual_action` with required non-empty reason and `request_idempotency_token`; repeated requests are idempotent and return existing terminal state
- `archive_competition(competition_id, request_idempotency_token)` trusted retirement path for historically significant competitions and paused open competitions with no active attempts
- `delete_draft_competition(competition_id, request_idempotency_token)` trusted draft-delete path allowed only for `status = 'draft'` with deterministic idempotent replay semantics.
- `competition_lifecycle_guard()` trigger helper for canonical status transitions, legacy boolean sync (`published`/`is_paused`), scoring snapshot immutability after publish, and draft revision/version bumping
- `competition_active_name_guard()` trigger helper that blocks organizer duplicate active competition names in statuses `draft`, `published`, `live`, `paused`, and `ended` when `is_deleted = false`
- `competition_problem_snapshot_guard()` trigger helper that freezes publish-time snapshot columns in `competition_problems` once competition status is `published` or later
- `moderate_delete_competition(competition_id, reason, request_idempotency_token)` trusted admin-only abuse or fraud deletion path for non-draft competitions with mandatory audit trace
- `register_for_competition(competition_id, actor_user_id, team_id default null)`
- `withdraw_registration(registration_id)`
- `validate_team_registration(team_id, competition_id)`
- `start_competition_attempt(registration_id, actor_user_id, request_idempotency_token)` pre-seeds `attempt_answers` blank rows for all `competition_problems`, fixes immutable deadline snapshots on `competition_attempts`, and replays deterministically by token
- `resume_competition_attempt(attempt_id, actor_user_id, request_idempotency_token)` replays deterministically by token
- `close_active_attempt_interval(attempt_id, actor_user_id)` leader-authorized for team attempts so interval closure cannot skew trusted timing
- `save_attempt_answer(attempt_id, actor_user_id, competition_problem_id, answer_payload, status_flag, client_updated_at)` where `answer_payload` is canonical LaTeX or normalized text derived from MathLive input
- `submit_competition_attempt(attempt_id, actor_user_id, request_idempotency_token, submission_kind)` canonical final-submit mutation with deterministic authority and concurrency guards for individual and team registrations; `submission_kind = 'auto'` is the timer-expiry path
- `create_problem_dispute(competition_problem_id, attempt_id, reason)` enforces post-end timing and ownership scope (branch `13-review-submission` ownership contract)
- `can_view_answer_key(competition_id, viewer_profile_id)` enforces `answer_key_visibility` (`after_end` requires ended competition plus owned registration/attempt context; `hidden` always denies participant access)
- `log_tab_switch_offense(attempt_id, metadata_json)` validates required anti-cheat metadata keys and mirrors parseable `metadata_json.client_timestamp` into `tab_switch_logs.client_timestamp`
- `grade_attempt(attempt_id)` (branch `07-scoring-system` scoring RPC contract ownership)
- `recalculate_competition_scores(competition_id, request_idempotency_token)` computes effective grading inputs as immutable snapshots plus active `competition_problem_corrections` overlays, with canonical points precedence (`active points_override.corrected_points` else `competition_problems.points`) (branch `07-scoring-system` scoring RPC contract ownership)
- `refresh_leaderboard_entries(competition_id)` (branch `07-scoring-system` scoring RPC contract ownership)
- `publish_leaderboard(competition_id, request_idempotency_token)`
- `broadcast_competition_announcement(competition_id, audience, message)` resolves recipients strictly by canonical `announcement_audience` predicates, including explicit withdrawn and ineligible handling
- `pause_competition(competition_id, reason, request_idempotency_token)` organizer pause for open competitions only; trusted admin incident force-pause may target any live competition type through moderation support
- `resume_competition(competition_id, reason, request_idempotency_token)` organizer-owned control action for paused owned competitions, including admin-forced pauses
- `extend_competition(competition_id, additional_minutes, reason, request_idempotency_token)` organizer-only control action
- `reset_attempt_for_disconnect(attempt_id, reason, request_idempotency_token)` organizer-only control action
- `resolve_problem_dispute(dispute_id, resolution_status, resolution_note, request_idempotency_token)` (branch `14-leaderboard-history` dispute-resolution ownership contract)
- `record_competition_problem_correction(competition_problem_id, dispute_id, correction_type, corrected_answer_key_json, corrected_points, reason, request_idempotency_token)` (branch `14-leaderboard-history` correction ownership contract)
- `queue_export_job(competition_id, format, request_idempotency_token)` owner organizer or admin only with deterministic replay and per-competition-format active-job concurrency guard
- `enqueue_notification(recipient_id, type, title, body, link_path, event_identity_key, metadata_json)` de-duplicates by `(recipient_id, event_identity_key)`
- `mark_notification_read(notification_id)`
- `mark_all_notifications_read()`
- `team_set_updated_at()` trigger helper for `teams.updated_at`
- `team_bootstrap_leader_membership()` trigger helper for initial leader membership on team create
- `team_membership_handle_leader_departure()` trigger helper for auto leadership transfer
- `is_active_team_member(team_id, profile_id)` helper used by team RLS predicates
- `transfer_team_leadership(team_id)`

### Policy Consistency Contracts

- Status lookup token policy: raw lookup tokens are transient input only; persisted storage is hash-only (`status_lookup_token_hash`) plus explicit expiry (`status_lookup_token_expires_at`), and lookup responses are restricted safe fields.
- Status lookup expiry policy: every status lookup validates `now() < status_lookup_token_expires_at`; expired tokens are treated exactly like invalid or unknown tokens and never receive special response shapes.
- Status lookup negative-path policy: unknown, invalid, or expired lookup tokens must return one generic non-disclosing response and deterministic machine code, with no token-validity leak.
- Status lookup throttle policy: throttle key dimensions are `(client_ip, token_fingerprint)` with a fixed malformed-token bucket, enforcement window is 1 second, and violations must return `429` with machine code `throttled` plus `Retry-After: 1` and no applicant data.
- Organizer login-identifier immutability policy: organizer self-service settings cannot change `profiles.email`; only trusted admin/auth credential flows can mutate login identifier.
- Organizer decision-transition policy: organizer application decisions allow only `pending -> approved` or `pending -> rejected`; direct terminal-to-terminal flips are forbidden.
- Organizer decision-field immutability policy: after first terminal decision, `status`, `reviewed_at`, and `rejection_reason` are immutable.
- Organizer activation ownership policy: decision functions (`approve_organizer_application`, `reject_organizer_application`) never mutate organizer role activation fields; trusted activation or provisioning (`provision_organizer_account`) alone may set `profiles.role = 'organizer'` and `profiles.approved_at`, including approved rows that start with `profile_id is null`.
- Organizer activation known-drift note: if existing helpers still mutate activation fields directly, treat that as compatibility debt and correct it through active-branch bug-fix scope (documented in `05b`) rather than normalizing the drift in canonical ownership contracts.
- Organizer activation-delivery policy: approved organizer onboarding uses the approved contact email as the immutable login identifier and sends one idempotent activation message with a password-set/reset link; rejected applications never provision identity state.
- Organizer rejection reason policy: `organizer_applications.rejection_reason` is sanitized safe-public text only (max 500 characters) and is present only for rejected outcomes.
- Organizer logo-path policy: `organizer_applications.logo_path` stores only canonical storage paths in the format `organizer-applications/{application_id}/logo.{ext}`.
- Competition format invariant policy: `competitions.format = 'team'` is legal only when `competitions.type = 'scheduled'`; open competitions are always individual format.
- Competition name-uniqueness policy: uniqueness predicate is `is_deleted = false AND status IN ('draft','published','live','paused','ended')` scoped by organizer; `archived` rows are excluded.
- Competition delete policy: hard delete is allowed only for `status = 'draft'` through trusted draft-delete handlers; non-draft hard delete is admin-only abuse or fraud moderation with explicit audit reason and evidence metadata.
- Competition pause-scope policy: organizer pause applies only to open competitions and must allow active attempts to finish while blocking new starts; trusted admin incident force-pause may target any live competition type through moderation paths.
- Competition end-transition policy: `live` or `paused` to `ended` is owned by trusted lifecycle handlers with deterministic split rules: scheduled competitions end through `transition_source = 'system_timer'` only at the server boundary, while open competitions may end through organizer-only `transition_source = 'trusted_manual_action'`; admin live-support controls do not include manual end; end transitions are idempotent and must not duplicate state effects.
- Description cap policy: `problem_banks.description` is capped at 200 words and `competitions.description` is capped at 500 words through DB checks and trusted write validation.
- Problem-bank soft-delete policy: hard delete on `problem_banks` and `problems` is forbidden by trigger; delete semantics are implemented as deterministic `is_deleted = true` updates.
- Problem-assets path policy: `storage.objects.name` for bucket `problem-assets` must match canonical `{owner_uuid}/{bank_uuid}/{asset_uuid}.{ext}` format and is validated by helper functions before insert or delete policy checks.
- Problem-assets ownership policy: organizer writes are allowed only when `owner_uuid = auth.uid()` and bank ownership scope matches writable non-default bank access; admin writes are allowed only for default-bank objects whose owner segment matches `problem_banks.organizer_id`.
- Problem-import idempotency policy: `problem_import_jobs` deduplicates by unique key `(bank_id, actor_id, idempotency_token)`; replay requests must return the existing deterministic summary instead of inserting duplicate rows.
- Registration withdrawal policy: scheduled withdrawals require `now() < competitions.start_time` and zero attempt rows; open withdrawals require zero attempt rows; any attempt row blocks participant withdrawal.
- Ineligible re-entry policy: `competition_registrations.status = 'ineligible'` may transition back to `registered` only through trusted re-validation while registration timing still allows entry.
- Dispute-create timing policy: dispute creation is allowed only after competition end (`ended` or `archived`) and only for owned attempt/registration context.
- Answer-key visibility policy: default for new competitions is `answer_key_visibility = 'after_end'` (FR14.5 baseline). Participant visibility requires trusted server end-time plus owned registration or attempt context; `hidden` is explicit organizer override, and `leaderboard_published` must never grant answer-key access.
- Open-leaderboard visibility policy: participant-context access requires owned registration or attempt; open competitions expose the full leaderboard for all non-draft states (`published`, `live`, `paused`, `ended`, `archived`).
- Registration snapshot policy: `competition_registrations.entry_snapshot_json` is written at registration acceptance and remains immutable even if profile, school, grade-level, team name, or roster data later changes.
- Notification preference defaults policy: default rows must enable in-app delivery and all event categories while keeping email globally disabled until the user opts in.
- Timer and interval policy: `attempt_intervals` support reconnect auditability only and never pause consumed time; offline gaps consume remaining trusted competition time.
- Team-attempt authority policy: team-registration attempt lifecycle mutations (`start`, `resume`, `save`, `submit`) are leader-authorized only; non-leader team members are read-only for lifecycle writes.
- Team-attempt concurrency policy: attempt lifecycle mutations serialize by registration or attempt lock and return deterministic `attempt_lifecycle_conflict` on concurrent races.
- Anti-cheat metadata policy: canonical client time field is `metadata_json.client_timestamp` (nullable value required key); `tab_switch_logs.client_timestamp` is a normalized mirror for query/index use.
- Answer-status counting policy: untouched-question counts come from pre-seeded `attempt_answers.status_flag = 'blank'`, with deterministic blank inference fallback only for older compatibility rows.
- Correction artifact policy: accepted disputes or manual answer-key fixes must write `competition_problem_corrections`; recalculation reads immutable snapshots plus active corrections without mutating original snapshot columns.
- Effective points precedence policy: effective points for grading or recalculation are deterministic per competition problem: active trusted `points_override` wins; if none is active, fallback is `competition_problems.points`.
- Leaderboard/export access policy: scheduled visibility depends on organizer publish gate, open visibility follows explicit self-row/full-row timing rules, and export queue/download access is strictly owner organizer or admin only.
- Notification idempotency policy: retries must de-duplicate by `(recipient_id, event_identity_key)`.
- Organizer communication idempotency policy: submission, approval, and rejection lifecycle messaging deduplicates by `(application_id, message_type)` through a reserved-send ledger and explicit sent or failed transitions.
- Competition-control permission policy: admin live support may force-pause and follows a separate moderation delete path; resume, extend, and disconnect-reset controls are organizer-only.
- Competition-control reason policy: pause, resume, extend, and disconnect-reset control actions require a non-empty reason; organizer manual open end requires a non-empty reason as well.
- Competition-control idempotency policy: control-action requests (including `end_competition`) de-duplicate by `(competition_id, control_action, actor_user_id, request_idempotency_token)` and return existing results on replay; caller supplies `request_idempotency_token` for control-action RPCs except scheduled `end_competition` system-timer transitions, which must use deterministic server token `system_end:{competition_id}:{effective_end_boundary_iso}`; SQL uniqueness must coalesce nullable `actor_user_id` to the system-actor sentinel (`coalesce(actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)`) so system-timer dedupe cannot break.
- Account-removal policy: non-spam/fake account removals are anonymization-only; hard-delete is reserved for explicit spam/fake abuse paths with admin audit trace.
- Formula stack policy: editable math input uses MathLive, static rendering uses KaTeX, and persisted canonical math values remain LaTeX.
- Timer naming policy: trusted timing logic must use canonical names and derivations `attempt_base_deadline_at`, `scheduled_competition_end_cap_at`, and `effective_attempt_deadline_at`; scheduled attempts are capped by the scheduled competition end cap.

## Section F - Realtime and Subscriptions

Use Realtime only for scoped, high-value updates:

- `notifications`: current user inbox
- `competition_announcements`: active participants and organizers in one competition
- `competition_events`: live moderation panels and arena state changes
- `leaderboard_entries`: current competition only
- `competition_attempts`: organizer monitoring summaries and participant-scoped active-attempt lock signals for team arena flows; never broad unfiltered subscriptions
- `attempt_answers`: participant-scoped team-arena answer sync for the active attempt only
- `tab_switch_logs`: organizer monitoring for the owned competition only

Performance and Security rules:

- never subscribe to whole tables across the product
- prefer filters by `competition_id` or `recipient_id`
- if event fan-out becomes too expensive, move heavy live surfaces to broadcast channels fed by trusted triggers or server processes
- App Router Auth Risk: Client-side Realtime subscriptions connect directly to Postgres via WebSockets, bypassing Next.js Server Components. If `profiles.session_version` is used to invalidate stale sessions at the Next.js layer, a stale JWT could theoretically still subscribe to Realtime if RLS policies do not natively check `session_version` via custom claims. Code defensively.

## Section G - Migration Notes

Recommended migration order (branch-aligned canonical):

1. `01-foundation`: foundational enums, `profiles`, `organizer_applications`, `notification_preferences`
2. `02-authentication`: no new canonical domain table migrations
3. `03-interaction-feedback`: no new canonical domain table migrations
4. `04-admin-user-management`: `admin_audit_logs`, `system_settings`, organizer decision RPCs
5. `05b-deferred-foundation-and-auth`: trusted auth-session and anonymization hardening helpers, plus compatibility backfills for previously merged auth or organizer artifacts when evidence shows drift
6. `05-organizer-registration`: status lookup expiry contract and organizer activation-provisioning helpers
7. `06-problem-bank`: `problem_banks`, `problems`, `problem_import_jobs`, and `problem-assets` storage policy helpers
8. `07-scoring-system`: scoring enums and scoring RPC contracts
9. `08-competition-wizard`: `competitions`, `competition_problems`, initial `competition_events` schema for lifecycle or audit events, publish or start or end or archive lifecycle helpers, and trusted draft-delete path
10. `09-team-management`: `teams`, `team_memberships`, `team_invitations`, `team_action_idempotency`
11. `10-competition-search`: `competition_registrations` plus registration and withdrawal RPCs
12. `11-arena`: `competition_attempts`, `attempt_intervals`, `attempt_answers`, plus start or resume or submit attempt lifecycle helpers
13. `12-anti-cheat`: `tab_switch_logs` and offense logging RPC
14. `13-review-submission`: `problem_disputes` and participant dispute-create helpers
15. `14-leaderboard-history`: `competition_problem_corrections`, `leaderboard_entries`, `export_jobs`, and publication or correction helpers
16. `15-notifications-polish`: `notifications` table and shared notification delivery helpers
17. `16-participant-monitoring`: `competition_announcements`, announcement fan-out, pause or resume or extend or reset controls, and non-draft moderation delete path (consumes and expands existing `competition_events` producers)
18. `17-testing-bug-fixes`: compatibility cleanup migrations only

### Migration Execution Protocol (Timestamp Order, Append-Only, Verification Gates)

- Timestamp order rule: execute migration files strictly by ascending leading timestamp (`YYYYMMDDHHMMSS`).
- Append-only rule: once a migration is applied in any shared environment, do not edit, rename, reorder, or delete it.
- Correction rule: all fixes ship as new migration files with higher timestamps.
- Verification gates for every migration batch:
1. run `npm run supabase:status`
2. run `npm run supabase:db:reset`
3. run `npm run lint`
4. run `npm run test`
5. run `npm run build`
6. run doc-sync verification before checklist completion: enumerate changed schema objects, RPC signatures, and RLS policies from the new migration timestamps; update matching sections in this document (`Section B`, `Section D`, `Section E`, `Section G`) and record a migration-to-section mapping in branch QA notes
- Reference boundary: prior process and schema docs are intent guides only; migration SQL for the rebuild must follow current `.agent/` contracts, not direct copy-forward from external artifacts.

Audit baseline contract: missing future-branch routes or tables in current app or migrations are expected before the owning branch executes; treat these as planned sequencing gaps, not contradictions.

Current baseline caveat: existing bootstrap migration `20260314171000_admin_resource_core.sql` pre-seeds some problem and competition domain tables earlier than this canonical order. Treat that migration as compatibility baseline; branch ownership here remains the source of truth for behavioral contracts and hardening responsibilities.

Risky migrations and backfills:

- moving from mutable problem references to immutable competition snapshots
- adding leaderboard publication rules after attempts already exist
- recalculating scores if answer normalization changes
- backfilling notification preferences for existing users
- converting prior timer math to interval-audited lifecycle handling while preserving the non-pausing consumed-time rule
- migrating deprecated boolean lifecycle columns to canonical enum status contracts (`draft`, `published`, `live`, `paused`, `ended`, `archived`) without breaking branch-order rollout

### Reference-Integrity Migration Contracts (Canonical)

#### Admin Route Params (`[id]` -> `[competitionId]` / `[bankId]`)

1. Compatibility introduce: keep existing admin `[id]` routes and add canonical route variants using `[competitionId]` and `[bankId]`.
2. Producer cutover: update all trusted route producers (`link_path`, server redirects, admin navigation, notifications metadata) to emit canonical params only; until this cutover lands, existing `[id]` producers may still exist as compatibility artifacts.
3. Post-cutover compatibility verification: after step 2 is merged, block new `[id]` producers by lint or grep gate in branch `17-testing-bug-fixes`; ensure zero new `/admin/**/[id]` writers.
4. Deprecated-route removal: remove `[id]` route handlers or files after producer cutover is complete; optional redirects may remain only as read-only compatibility.

#### Competition Lifecycle Status Migration (`boolean fields` -> enum `competition_status`)

1. Compatibility add: add enum `competition_status` and nullable `competitions.status` while existing boolean fields remain writable.
2. Deterministic backfill: run one-shot backfill with precedence `archived > ended > paused > live > published > draft` into `competitions.status`.
3. Dual-write compatibility: add temporary trusted trigger or write-path shim so updates keep boolean fields and enum status synchronized during rollout.
4. Cutover and enforce: move RPCs, RLS, and read paths to enum status only; set `competitions.status not null`, enforce enum-only checks, and add final indexes or constraints.
5. Drop deprecated fields: remove deprecated boolean lifecycle columns and compatibility sync trigger only after cutover verification passes.

### Per-Branch Schema and Function Ownership Matrix (Canonical)

| Branch | Schema ownership introduced in branch | Trusted function or trigger ownership introduced in branch |
| --- | --- | --- |
| `01-foundation` | foundational enums, `profiles`, `organizer_applications`, `notification_preferences` | `insert_profile_for_new_user`, `handle_profile_changes`, `create_default_notification_preferences` |
| `02-authentication` | no new domain table; auth-session coordination on `profiles.session_version` is consumed but not completed | no new canonical trusted auth-session helper; branch prepares for later hardening |
| `04-admin-user-management` | `admin_audit_logs`, `system_settings` | `approve_organizer_application`, `reject_organizer_application` |
| `05b-deferred-foundation-and-auth` | compatibility hardening only; no new canonical domain table, with explicit corrective backfills allowed for pre-existing auth or organizer drift, including `profiles.session_version`, organizer-application contact/consent/status-lookup fields, and safe anonymization | `rotate_session_version`, `update_mathlete_profile_settings`, `anonymize_user_account` |
| `05-organizer-registration` | organizer onboarding storage-path contract; profile link activation contract for approved applications; status-lookup token expiry contract; `organizer_status_lookup_throttle` rate-limit ledger; `organizer_application_communications` lifecycle dispatch ledger | `insert_organizer_application_intake`, `lookup_organizer_application_status`, `provision_organizer_account`, `claim_organizer_application_communication`, `mark_organizer_application_communication_sent`, `mark_organizer_application_communication_failed` |
| `06-problem-bank` | `problem_banks`, `problems`, `problem_import_jobs` | `problem_bank_set_updated_at`, `touch_problem_bank_updated_at_from_problem`, `refresh_problem_import_jobs_updated_at`, `sync_problem_legacy_and_canonical_columns`, `prevent_problem_bank_hard_delete`, and `problem_assets_path_*` helper functions |
| `07-scoring-system` | scoring enums and scoring contract definitions only (no `competitions` table columns introduced in branch `07`) | `grade_attempt`, `recalculate_competition_scores`, `refresh_leaderboard_entries` |
| `08-competition-wizard` | `competitions`, `competition_problems`, initial `competition_events` (lifecycle or audit baseline) | `snapshot_competition_problems`, `publish_competition`, `start_competition`, `end_competition`, `archive_competition`, `delete_draft_competition` |
| `09-team-management` | `teams`, `team_memberships`, `team_invitations`, `team_action_idempotency` | `team_set_updated_at`, `team_bootstrap_leader_membership`, `team_membership_handle_leader_departure`, `is_active_team_member`, `transfer_team_leadership` |
| `10-competition-search` | `competition_registrations` | `register_for_competition`, `withdraw_registration`, `validate_team_registration` |
| `11-arena` | `competition_attempts`, `attempt_intervals`, `attempt_answers` | `start_competition_attempt`, `resume_competition_attempt`, `close_active_attempt_interval`, `save_attempt_answer`, `submit_competition_attempt` |
| `12-anti-cheat` | `tab_switch_logs` | `log_tab_switch_offense` |
| `13-review-submission` | `problem_disputes` (participant dispute-create ownership); submission contracts on existing attempt tables | `create_problem_dispute`, `can_view_answer_key` |
| `14-leaderboard-history` | `competition_problem_corrections`, `leaderboard_entries` (leaderboard/history surfaces), `export_jobs`; dispute-resolution contracts on existing `problem_disputes` rows | `resolve_problem_dispute`, `record_competition_problem_correction`, `publish_leaderboard`, `queue_export_job` |
| `15-notifications-polish` | `notifications` | `enqueue_notification`, `mark_notification_read`, `mark_all_notifications_read` (shared delivery infrastructure only; no `competition_announcements` producer ownership) |
| `16-participant-monitoring` | `competition_announcements` (consumes and expands existing `competition_events` producers introduced in branch `08`) | `broadcast_competition_announcement` (announcement producer ownership and audience resolution; consumes branch `15` delivery helpers), `pause_competition` (organizer open-competition path plus admin force-pause support), `resume_competition`, `extend_competition`, `reset_attempt_for_disconnect` (resume/extend/reset are organizer-only control actions), `moderate_delete_competition` |
| `17-testing-bug-fixes` | no new domain table by default; cleanup or compatibility removals only | migration cleanup gates only (no new primary business-domain RPCs) |

## Section H - Change Log

- 2026-04-14: Added team-management schema alignment, leadership transfer helpers, and team idempotency ledger support for invite and roster retries.
- 2026-04-15: Added branch-08 lifecycle core migration introducing canonical `competition_status` and `answer_key_visibility`, deterministic status backfill from legacy booleans, draft revision/version support, immutable scoring snapshot guard after publish, competition-problem frozen snapshot columns with guard trigger, hardened `competition_events` payload/metadata/idempotency fields, and trusted lifecycle RPCs (`snapshot_competition_problems`, `publish_competition`, `start_competition`, `end_competition`, `archive_competition`, `delete_draft_competition`) with deterministic replay semantics.
- 2026-04-22: Added branch-11 forward fixes for deployed arena/lifecycle drift: `register_for_competition` now sources the stored `display_name` snapshot from canonical `profiles.full_name` while retaining its service-role fail-closed guard, and `start_competition` qualifies event lookup/status return columns to avoid PL/pgSQL output-parameter ambiguity.
- 2026-04-09: Added branch-07 contract-first scoring RPC signature migration for `grade_attempt(uuid)`, `recalculate_competition_scores(uuid, text)`, and `refresh_leaderboard_entries(uuid)` as trusted service-role-only placeholders with deterministic deferred owner-schema machine codes until branches `11`, `13`, and `14` activate executable wiring.
- 2026-04-08: Added canonical trigger contract `touch_problem_bank_updated_at_from_problem()` so parent `problem_banks.updated_at` refreshes on `problems` insert, update, and delete writes, including bank reassignment updates.
- 2026-04-06: Synced branch `06-problem-bank` migration artifacts into canonical contracts: schema alignment constraints and triggers for `problem_banks` and `problems`, private `problem-assets` storage key and policy model, and `problem_import_jobs` idempotency-ledger schema with RLS scope.
- 2026-04-03: Rebuilt the database, ERD, and RLS plan for the full greenfield Mathwiz Arena implementation. Added missing tables for team invites, attempt intervals, disputes, notifications, exports, system settings, competition snapshots, and realtime-aware operational flows.
- 2026-04-03: Clarified the trusted session invalidation contract, storage-bucket ownership rules, explicit announcement and event access rules, and the missing live-control plus dispute-resolution RPC surface.
- 2026-04-03: Made source-of-truth contracts deterministic for status lookup sanitization/negative paths, team-format invariants, description caps, registration withdrawal timing, non-pausing interval timing, anti-cheat metadata keys, untouched-answer counting, accepted-dispute correction artifacts, and leaderboard/export visibility boundaries.
- 2026-04-03: Resolved remaining core-contract gaps for open leaderboard timing/predicate, organizer identifier immutability, organizer decision idempotency, dispute-create timing guard, canonical organizer logo paths, control-action and notification idempotency keys, explicit competition-name uniqueness statuses, and account-removal semantics.
- 2026-04-03: Added explicit branch `04` decision-only versus branch `05` activation-only organizer ownership, deterministic points precedence fallback, canonical timer-deadline naming, concrete route and lifecycle migration sequences, and a per-branch schema/function ownership matrix.
- 2026-04-03: Added explicit status-lookup token expiry contract, canonical `live/paused -> ended` ownership and idempotency semantics, team-attempt authority and concurrency guards, deterministic announcement audience predicates, explicit draft-delete versus non-draft moderation-delete policy, branch-aligned migration sequencing, and non-circular notification versus announcement ownership sequencing.
- 2026-04-03: Reconciled correction-RPC argument shape with `competition_problem_corrections` schema, documented bootstrap-sequencing caveat for pre-seeded competition/problem tables, and clarified branch `05b` compatibility-backfill scope for evidence-backed drift correction.
- 2026-04-03: Added branch-05 organizer communication ledger and helper RPC contracts (`claim_organizer_application_communication`, sent or failed markers), plus service-only access boundaries for deterministic organizer lifecycle messaging retries.
- 2026-04-05: Added a forward drift-correction migration to restore `public.profiles.avatar_url` when remote history showed branch `05b` as applied but the column was missing, because `anonymize_user_account(...)` depends on that field for deterministic non-spam account anonymization.

## Section I - Security Operations and Data Lifecycle Hardening

### Security-Definer and Privilege Boundary Contract

- every security-definer function must use explicit schema qualification and locked `search_path` behavior
- function execute grants must be least-privilege by role and never broad default grants
- service-role credentials remain server-only and must never be required by browser code paths

### Upload and Storage Integrity Contract

- trusted upload handlers must validate MIME and file-size server-side before persisting canonical storage paths
- signed upload/download URLs must be scoped and short-lived; expired URLs must fail deterministically
- canonical storage-path persistence remains mandatory (`logo_path`, problem assets, export paths); do not persist public URL variants as source of truth

### Retention and Purge Contract

- lifecycle and anti-cheat diagnostics retain raw detail only for the required forensic window; purge jobs must be idempotent and auditable
- export artifacts must have explicit TTL and secure deletion policy while job metadata remains available for audit and retry evidence
- retention jobs must emit evidence fields (window applied, rows scanned, rows deleted, actor/system source)

### Observability and Incident Forensics Contract

- privileged and high-risk mutation flows must emit traceable correlation fields (`request_id`, actor, action, target, outcome, reason/machine code)
- failure paths for trusted control actions must preserve deterministic error categories without leaking internal payloads
- event/audit data must support reconstruction of dispute, recalculation, publication, monitoring control, and moderation timelines

### Release Gate Contract for Database Changes

- migration batches touching RLS, trusted RPCs, or privileged tables must include explicit policy verification evidence and replay/idempotency checks
- release readiness requires zero unresolved high-severity access-control or data-exposure findings tied to database contracts


### User Deletion Privacy Rule
- Non-spam/fake account-removal path is anonymization-only: scrub PII in `profiles`, retain historical submissions/scores, and keep leaderboard integrity via anonymized references.
- Hard-delete is reserved only for explicit spam/fake abuse actions and must be executed through trusted admin moderation with immutable audit logs.
