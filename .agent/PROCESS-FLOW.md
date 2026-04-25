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
| UR9c | FR9.3 | Team Member Management | Leaders remove members, members leave teams, and leadership auto-transfers to the next longest-tenured active member. |
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
| UR14e | FR14.5 | Answer Key Display | Mathletes can view the answer key only when explicit post-competition visibility rules allow it. |
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
2. Admins review organizer-eligibility submissions and approve or reject them; rejection reason is required, and approval rationale is not persisted or required in release one.
3. After admin review, branch `04-admin-user-management` trusted admin actions record organizer-application decision fields only (`status`, `reviewed_at`, `rejection_reason`).
4. If approved, branch `05-organizer-registration` trusted activation/provisioning path performs organizer-role activation (`profiles.role = 'organizer'`, `profiles.approved_at`) and sends one idempotent activation email with a password-set/reset link through the approved contact email.
5. If rejected, branch `05-organizer-registration` keeps organizer access blocked and sends one idempotent rejection email with the rejection reason.
6. Admins can update, suspend, or anonymize organizer and mathlete accounts through trusted, auditable flows. Hard-delete is reserved for explicit spam/fake abuse moderation.
7. Admins have global read access to organizer-created problem banks and competitions.
8. Admins can moderate inappropriate content and use only this live-support allow list: `force_pause` and `abuse_or_fraud_non_draft_delete`; both allowed actions require explicit reason plus `request_idempotency_token`, with mandatory audit evidence, and executable ownership belongs to branch `16` while branch `04` remains the decision/admin shell and must not over-claim implementation ownership. Admins are prohibited from `manual_end`, `resume`, `extend`, and `reset_attempt_for_disconnect`, and can inspect live competition state, monitor high-traffic scheduled events, and support operational incidents.
9. Admins manage the default shared problem bank using the same authoring flows organizers use.

### Admin Implementation Rules

- Organizer approval and rejection must be trusted backend mutations with audit logging.
- Admin approval or rejection writes organizer-application decision fields only and must never mutate organizer-role activation fields on `profiles`.
- Rejection must preserve a reason and surface clear status to the applicant.
- Admin self-destructive actions must be blocked in both UI and backend logic.
- Admin read access to organizer resources must not bypass ownership semantics for organizer-facing views.
- Admin live-support allow list is fixed to `force_pause` and `abuse_or_fraud_non_draft_delete`; both actions require explicit reason plus `request_idempotency_token`, must be fully audited, and are branch `16` executable implementations while branch `04` remains decision/admin shell only.
- Admin live-support deny list is fixed to `manual_end`, `resume`, `extend`, and `reset_attempt_for_disconnect`; these actions are prohibited for admin live support.
- Non-spam/fake account removal is anonymization-only and must preserve historical competition integrity; hard-delete is reserved for explicit spam/fake abuse paths and must be fully audited.

### Admin Live-Support Action Mapping (Canonical)

| action_name | rpc_name | allowed actor | required reason/token | denied actions |
| --- | --- | --- | --- | --- |
| `force_pause` | `pause_competition` | trusted admin live support (branch `16` executable boundary) | non-empty `reason` + caller `request_idempotency_token` | none |
| `abuse_or_fraud_non_draft_delete` | `moderate_delete_competition` | trusted admin live support (branch `16` executable boundary) | non-empty abuse or fraud `reason` + caller `request_idempotency_token` | none |
| `manual_end` | `end_competition` (`transition_source = 'trusted_manual_action'`) | denied for admin live support | n/a | denied for admin live support |
| `resume` | `resume_competition` | denied for admin live support | n/a | denied for admin live support |
| `extend` | `extend_competition` | denied for admin live support | n/a | denied for admin live support |
| `reset_attempt_for_disconnect` | `reset_attempt_for_disconnect` | denied for admin live support | n/a | denied for admin live support |

## Organizer Process Flow

### Sidebar Navigation

- Home
- Dashboard (Profile, Statistics, Data Insights)
- Problem Bank
- Competitions
- Notifications
- History
- Settings
- Log-Out

### Flow

1. Organizers apply for eligibility by submitting personal and organizational data, an optional logo, and explicit agreement to the Data Privacy Act of 2012 plus the platform Terms & Conditions.
2. After approval, organizers receive one idempotent activation email through the approved contact email. Branch `05-organizer-registration` trusted activation/provisioning links or provisions the organizer identity for approved rows only (including approved applications where `profile_id` is null), uses the approved contact email as the immutable login identifier, and sends a password-set/reset activation link rather than plaintext credentials. The same trusted path sets organizer role and approval timestamps, and the approved login identifier/email cannot be changed through organizer self-service settings. Identifier updates are allowed only through trusted admin/auth credential paths. Password recovery remains allowed.
3. The organizer dashboard home provides first-run profile summary plus statistics/data-insights shells so the promised workspace exists before later data-heavy branches expand it.
4. Organizers create problem banks with a name and optional description.
5. Organizers create problem items manually or through bulk import.
6. Problem items support math notation, optional image uploads, and these types:
   - Multiple Choice with unique choices
   - True/False
   - Numeric
   - Identification
7. Numeric and identification problems can accept multiple correct answers when edge cases require it.
8. Organizers classify each problem by difficulty and tags.
9. Deleting a problem bank or problem removes it from draft competition work, but published competition content must remain protected through immutable snapshots.
10. Organizers create competitions through a multi-step wizard:
   - Overview
   - Schedule
   - Format
   - Problems and anti-cheat
   - Summary and publish
11. The overview step requires a competition name, description, and a competition-authored Rules & Instructions box that mathletes must acknowledge before starting.
12. Scheduled competitions require competition start time and duration, with registration timing mode support: `default` keeps registration open until start, while `manual` uses explicit registration start/end windows. Scheduled competitions allow exactly one attempt and transition from `published` to `live` through a trusted server-side start action at the server-authoritative start boundary, including the cron-driven scheduled-start worker path. Lifecycle transition `live` or `paused` to `ended` is owned by trusted competition lifecycle handlers and is system-timer-owned only at the server-authoritative end boundary, with idempotent replay behavior. Organizer manual end is not allowed for scheduled competitions, and admin live-support controls do not include manual end.
13. Open competitions require duration and must configure attempts between one and three without a global schedule window. Open `live` or `paused` to `ended` manual end is organizer-only through a trusted action and requires explicit reason plus `request_idempotency_token`.
14. Individual competitions define participant caps with a minimum of 3 and a maximum of 100.
15. Team competitions define 2 to 5 participants per team and 3 to 50 teams, and apply only to scheduled competitions.
16. Organizers select 10 to 100 problems from owned or shared banks.
17. Organizers configure scoring using automatic difficulty-based scoring or custom points, optional penalties, tie-breakers, and open-competition multiple-attempt grading policy (`highest_score`, `latest_score`, or `average_score`). The default tie-breaker is earliest final submission timestamp unless the organizer explicitly overrides it.
18. Organizers configure anti-cheat behavior including question shuffling, option shuffling, tab-switch logging, and offense-tier penalties.
19. Publish remains unavailable until the full wizard validates successfully.
20. Organizers can pause only open competitions so active attempts may finish while new attempts cannot start, resume paused owned competitions (including admin force-paused states), monitor live scheduled competitions, broadcast announcements with canonical audience predicates, extend competitions through trusted controls only when the competition status is `live` or `paused`, and reset attempts only when disconnect-reset criteria pass in fixed order: required non-empty `reason` plus `request_idempotency_token`, valid evidence taxonomy with same-attempt evidence reference, `in_progress` attempt state, evidence observed within 120 seconds, and no approved reset for the same attempt where `happened_at > server_now_at_request - interval '10 minutes'` (first failing gate determines rejected outcome). Pause, resume, extend, and reset controls require explicit reasons. Open manual end requires explicit reason plus `request_idempotency_token`.
21. Open competitions can be retired only through a trusted archive path after active attempts have finished; hard delete is allowed only for `draft` competitions through trusted draft-delete controls. Non-draft hard delete is admin-only abuse or fraud moderation with mandatory audit evidence.
22. After competition completion, organizers review disputes, accept or reject them with resolution notes, recalculate scores if answer keys were wrong, publish scheduled leaderboards through an explicit organizer publish action, and export result data with participant/team context from immutable registration snapshots.

### Organizer Implementation Rules

- The approved organizer login identifier/email must remain immutable in organizer self-service settings after approval; only trusted admin/auth credential paths may mutate it. Password recovery is allowed.
- Organizer-role activation (`profiles.role = 'organizer'`, `profiles.approved_at`) is owned by trusted organizer activation/provisioning and not by admin decision-write paths.
- Applicant status lookup must use opaque tokens that are stored hash-only with explicit expiry and validated through trusted handlers or RPCs.
- Applicant status lookup responses are restricted to safe fields (`status`, `rejection_reason`, `masked_contact_email`) with deterministic throttling controls keyed by `(client_ip, token_fingerprint)` at one accepted request per rolling 1-second window; violations return `429` with `Retry-After: 1`, and expired token responses must be indistinguishable from unknown or invalid token responses.
- Problem bank descriptions are capped at 200 words.
- Competition descriptions are capped at 500 words.
- Competition names must be unique per organizer for competitions in `draft`, `published`, `live`, `paused`, or `ended` status.
- Hard delete is allowed only while competition status is `draft`; non-draft hard delete is admin-only abuse or fraud moderation with audit evidence.
- Organizer pause behavior applies only to open competitions and must let already-active attempts finish while blocking new starts; trusted admin incident force-pause may target any live competition type.
- Trusted lifecycle end transition (`live` or `paused` to `ended`) is split by competition type: scheduled end is system-timer-owned only (`transition_source = 'system_timer'`), while open manual end is organizer-only (`transition_source = 'trusted_manual_action'`) with required reason and `request_idempotency_token`; all end transitions must be idempotent, and admin live-support controls do not include manual end.
- Live control actions (`pause`, `resume`, `extend`, `reset`) require explicit reasons and trusted server-side enforcement.
- Announcement delivery must resolve recipients from canonical `announcement_audience` values only, with explicit withdrawn and ineligible handling.
- Published competitions must preserve immutable problem and scoring snapshots.
- Recalculation must be an explicit trusted action after accepted disputes or corrected answer keys.
- Open competitions remain fully leaderboard-visible to participant-context readers for any non-draft state; scheduled publication rules do not apply to open competitions.

### Competition End Transition Contract (Canonical)

- Owner boundary: branch `08-competition-wizard` trusted lifecycle handlers own status mutation `live` or `paused` to `ended`.
- Trigger-source mapping: scheduled competitions use `system_timer` only at the effective server boundary; open manual end uses `trusted_manual_action` by authorized organizer controls only.
- Idempotency contract: replay with the same request token must return the existing terminal result and must not duplicate side effects; open manual end requires explicit reason plus `request_idempotency_token`.
- Event contract: branch `08-competition-wizard` introduces baseline `competition_events` lifecycle writes and branch `16` expands consumers and live-control producers; every successful end transition emits `competition_ended` with canonical payload fields (`transition_source`, `reason_text`, `request_idempotency_token`) where `reason_text` is required non-empty for `trusted_manual_action` and null for `system_timer`.

## Mathlete Process Flow

### Sidebar Navigation

- Home
- Dashboard
- My Teams
- Competitions
- History
- Notifications
- Settings
- Log-Out

### Flow

1. Mathletes register and authenticate with Google OAuth.
2. On first login, mathletes must complete their profile with display name, school, and grade level before joining competitions. Later, they may update school and grade level through `/mathlete/settings`, but may not mutate role or organizer/admin-only identity fields there.
3. Strict single-session enforcement terminates older sessions when the same account logs in somewhere else.
4. Mathletes browse upcoming and live competitions through search and calendar views.
5. All competition schedules must display in the user’s local timezone.
6. Mathletes can create teams, become team leaders, invite members, and manage roster changes.
7. Team names must be unique across the platform.
8. Team invitations can be accepted or declined, and acceptance must be blocked if the user is already committed to an incompatible event roster.
9. Team rosters lock once successfully registered for a scheduled team competition, except for defensive handling around account deletion or invalidated eligibility.
10. If a leader leaves or loses the account, leadership transfers to the next longest-tenured active member.
11. Mathletes or team leaders register for competitions, and the system validates limits and team-size requirements at registration time.
12. Invalidated registered teams become ineligible rather than being silently withdrawn; when invalidation drops roster size below minimum constraints during an active attempt, trusted handlers must transition that `in_progress` attempt to `disqualified` with audit evidence.
13. Mathletes receive reminders and organizer communications through system notifications.
14. Participant withdrawals are allowed only through trusted paths with server-authoritative timing guards: scheduled competitions allow withdrawal only while `now() < competitions.start_time`; both scheduled and open withdrawals require zero `competition_attempts` rows for the registration. If any attempt row exists for the registration, participant withdrawal is blocked.
15. The arena entry button for scheduled competitions remains disabled until the exact server start time.
16. Before entering the arena, mathletes must accept the organizer rules and anti-cheat acknowledgement, including device-responsibility warnings.
17. During the arena, mathletes answer problems using MathLive editable fields with symbol-toolbox support, while static previews use KaTeX and autosave keeps blank, filled, solved, or reset states synchronized.
18. Browser focus loss hides the questions, forces a warning acknowledgement overlay, logs the event, and applies the organizer-configured penalty.
19. Reconnect resume does not trigger tab-switch penalties by itself; only explicit trusted focus-loss signals can create offenses, and offline time still reduces remaining trusted time.
20. Mathletes review their answers before submission and confirm final submission explicitly.
21. On timer expiration, the system locks the UI and auto-submits the current state.
22. Open competitions with remaining attempts can present a re-attempt path and must warn clearly about the selected grading policy.
23. After competition end, mathletes can dispute questionable problems and view historical results. Answer-key visibility follows explicit post-competition visibility rules. Scheduled leaderboards remain hidden until the organizer publishes them, and `/mathlete/history` must show only competition presence plus `competition_attempts.status`/submission state until `leaderboard_published = true`. Open leaderboards remain fully visible to participant-context readers for all non-draft open states.
24. If recalculation changes a score, the system must notify the affected mathlete.

### Registration RPC Contract (Individual vs Team)

- Trusted write path: registration and withdrawal run only through trusted backend mutations/RPCs (`register_for_competition`, `withdraw_registration`).
- Individual registration mode: registers the authenticated profile (`profile_id` populated, `team_id` null) and is valid only for `individual` competitions.
- Team registration mode: registers the selected team (`team_id` populated, `profile_id` null), requires active team-leader ownership, and is valid only for scheduled team competitions.
- Team attempt authority mode: for team registrations, only an active team leader may start, resume, or submit attempt lifecycle mutations; non-leader team members are read-only for lifecycle writes.
- Team attempt concurrency mode: trusted start, resume, and submit lifecycle writes must serialize by registration or attempt lock and return deterministic `attempt_lifecycle_conflict` on concurrent races.
- Both registration modes must enforce profile-completion checks, registration window rules, duplicate-registration guards, and capacity limits before writing.
- Withdrawal mode must enforce the same server-authoritative guards: scheduled requires `now() < competitions.start_time`; both scheduled and open require zero `competition_attempts` rows for the registration. If any attempt row exists for the registration, participant withdrawal is blocked.
- Eligibility failures must return deterministic machine-readable codes so UI copy stays consistent across branches.

### Announcement Audience Contract (Canonical)

- `registered_only`: recipients where `competition_registrations.status = 'registered'`; withdrawn, ineligible, and cancelled are excluded.
- `registered_and_ineligible`: recipients where `competition_registrations.status in ('registered','ineligible')`; withdrawn and cancelled are excluded.
- `all_non_cancelled`: recipients where `competition_registrations.status in ('registered','withdrawn','ineligible')`; cancelled is excluded.
- `operators_only`: recipients are competition owner organizer plus admins only; participant registration rows are not targeted.

### Leaderboard Visibility Contract (Canonical)

- Access predicate for participant-context reads: viewer must own a registration or attempt in the competition.
- Scheduled competitions: full leaderboard visible only when `leaderboard_published = true`.
- Open competitions: full leaderboard visible for participant-context readers when status is `published`, `live`, `paused`, `ended`, or `archived`; hidden only while `draft`.
- Organizer/admin readers for owned or moderated competitions are always allowed.

### Team Roster Lock State Machine (Canonical)

- `UNLOCKED`: no active lock for `(team_id, competition_id)`.
- `LOCKED_REGISTERED`: lock is active after team registration reaches `registered` for a scheduled team competition.
- `UNLOCKED_INELIGIBLE`: lock released because registration became `ineligible`; roster edits allowed for repair and re-registration.
- `UNLOCKED_TERMINAL`: lock released because registration became `withdrawn` or `cancelled`, or competition reached `ended` or `archived`.

Transitions:

1. `UNLOCKED` -> `LOCKED_REGISTERED`: registration status transitions to `registered` for a scheduled team competition.
2. `LOCKED_REGISTERED` -> `UNLOCKED_INELIGIBLE`: trusted flow marks registration `ineligible` with explicit `status_reason`; if the team falls below minimum roster constraints during an active attempt, that `in_progress` attempt transitions to `disqualified` with audit evidence.
3. `LOCKED_REGISTERED` -> `UNLOCKED_TERMINAL`: registration transitions to `withdrawn` or `cancelled`, or competition becomes `ended` or `archived`.
4. `UNLOCKED_INELIGIBLE` -> `LOCKED_REGISTERED`: repaired roster is re-registered while registration windows still allow entry.

While `LOCKED_REGISTERED`, mathlete-facing flows must block invite creation/acceptance, member removal, member leave, manual leadership transfer, and team archival.

### Mathlete Implementation Rules

- Google OAuth is the required registration path in release one.
- Profile completion is mandatory before joining competitions.
- Calendar and schedule views must use device-localized timezone presentation.
- Arena timing is always server-authoritative.
- Anti-cheat warnings must make it explicit that any browser-focus loss can count as an offense.
- Reconnect handling must distinguish legitimate recovery from punishable focus-loss events.
- Strict single-session invalidation must be enforced through trusted backend state rather than through client-only sign-out heuristics.

### Route Parameter Naming Policy (Canonical)

- Competition routes use `[competitionId]` as the dynamic segment name.
- Team routes use `[teamId]`; problem-bank routes use `[bankId]`; problem routes use `[problemId]`.
- Avoid introducing generic `[id]` for new competition-facing routes and docs.
- Existing workspace pages may still contain `[id]` segments in some admin routes; treat them as compatibility paths and do not copy that pattern into new work.
- If an older guide references `/competition/[id]`, treat it as a compatibility alias of `/competition/[competitionId]` and normalize to the canonical name in new work.

Admin route migration sequence (canonical):

1. Compatibility phase: keep existing admin `[id]` routes readable while introducing canonical `[competitionId]` and `[bankId]` routes.
2. Producer cutover phase: migrate all trusted route producers (navigation, redirects, notification links, server responses) to canonical params only.
3. Validation phase: enforce zero new `/admin/**/[id]` producers via branch `17-testing-bug-fixes` checks.
4. Removal phase: remove deprecated admin `[id]` route handlers after producer cutover is complete; optional redirects may remain as read-only compatibility.

## Blank-Slate Implementation Boundary Notes

- Current workspace may still contain existing `[id]` dynamic segments in admin pages.
- Current migrations may still include earlier boolean lifecycle fields while target enum lifecycle contracts are introduced in later branches.
- Boolean lifecycle migration must follow explicit compatibility -> deterministic backfill -> dual-write -> enum-only cutover -> deprecated-field drop sequencing from `.agent/DATABASE-EDR-RLS.md`.
- This document and `.agent/DATABASE-EDR-RLS.md` define target contracts; branch sequencing controls when target schema/routes become required in code.
- Migration execution protocol is mandatory from `.agent/DATABASE-EDR-RLS.md` Section G: apply migrations in ascending timestamp order, keep applied migrations append-only, and pass verification gates before branch completion.

## Cross-Feature Product Rules Captured From Flow

- Admins, organizers, and mathletes each have distinct sidebar shells and operational surfaces.
- Organizer and admin notifications are grouped and role-relevant rather than generic inbox spam.
- Team ineligibility, leaderboard publication, answer-key visibility, dispute resolution, and score recalculation are all explicit product flows, not optional polish.
- Competition deletion, pause/resume/extend/reset, end-transition, and publication all require defensive rules to prevent unsafe state transitions.
- Pause scope is explicit by competition type: organizer pause is open-only, and trusted admin incident force-pause may target any live competition type; resume/extend/reset remain organizer control actions and require explicit reasons.
- Competition control actions and emitted competition events must use request idempotency tokens so retried requests do not duplicate side effects.
- FR14.5 answer-key contract is default-on: new competitions initialize `answer_key_visibility = after_end`. Participant answer keys unlock only after trusted server end-time checks and participant-context ownership checks pass. `hidden` is explicit organizer override and remains independent from `leaderboard_published`.
- Open-leaderboard visibility is explicit: participant-context readers can see the full leaderboard for any non-draft open competition state, with no organizer publish toggle.
- Status lookup tokens are opaque, hash-persisted with explicit expiry, and never used as a replacement for organizer authentication beyond applicant-status checks.
- Announcement delivery audiences are explicit enum predicates with deterministic withdrawn and ineligible inclusion rules.
- Team-registration attempt lifecycle writes are leader-authorized with deterministic concurrency conflict responses.
- Notification delivery must de-duplicate by recipient plus deterministic event identity key to prevent duplicate inbox rows.
- Formula stack is fixed for release one: MathLive for editable inputs, KaTeX for static rendering, and LaTeX as canonical persisted math format.
- Exports are part of the organizer history workflow, not a separate optional add-on.

## Canonical Failure-Handling Contract

- Validation failure (`400` or `422`): return deterministic machine code plus field-level errors; write structured warning logs with `request_id` and actor context when available; do not write `admin_audit_logs`.
- Authorization failure (`401`, `403`, or security-scoped `404`): return generic deny response with no policy internals; write structured warning logs and an `admin_audit_logs` row with `action_type = 'access_denied_attempt'`, target metadata, and `request_id`.
- Idempotency replay while processing (`409`): return deterministic `idempotency_request_in_progress` with `Retry-After: 1`; clients retry no sooner than one second, cap at five attempts per request, and must not duplicate side effects.
- Idempotency payload mismatch (`422`): when an existing idempotency key is reused with a different payload fingerprint, return deterministic `idempotency_key_reused_with_different_payload` and do not execute mutation.
- Unexpected server failure (`5xx` or uncaught error): return generic failure response with `request_id` and no stack trace; write structured error logs with request context; for trusted mutations and admin or organizer control actions, also write `admin_audit_logs` with `action_type = 'server_failure'` and sanitized `error_class` metadata.

## Security and Resilience Control Pack (2026-04)

- Mutation-method policy: all state-changing paths use `POST`, `PUT`, `PATCH`, or `DELETE`; `GET` is read-only by contract.
- CSRF and same-origin policy: browser-callable state-changing routes enforce same-origin safeguards and deterministic rejection behavior.
- Safe-redirect policy: all `next` or return-target parameters must be parsed by one canonical helper that allows in-app relative paths only and rejects absolute or protocol-relative targets.
- Session-token policy: session identifiers must never be accepted from URL parameters for auth state, must be rotated on authentication boundaries, and must use secure cookie semantics (`Secure`, `HttpOnly`, `SameSite`) in production.
- Action-level authorization policy: privileged server actions and trusted route handlers enforce role/ownership checks inside mutation code, not only at route-entry shells.
- Sensitive-operation freshness policy: high-impact actions must enforce recent-auth/session-freshness gates where appropriate (for example destructive moderation and account-impacting changes).
- Abuse-control policy: endpoints and control actions with retry or brute-force risk must define deterministic throttling behavior and user-safe error mapping.
- Auth anti-automation policy: login, password reset, and account-recovery routes must define stricter per-account plus per-origin thresholds than baseline API limits and emit deterministic security telemetry on threshold breaches.
- Idempotency-key policy: documented key-protected mutation paths require `request_idempotency_token` or `Idempotency-Key`; missing keys fail with deterministic validation error and mismatched payload replay is rejected.
- Structured-audit policy: privileged allows and denies must be reconstructable with `request_id`, actor, action, target, outcome, and reason/machine code.
- Privacy-by-default policy: user-facing responses and logs must never expose raw tokens, secret keys, or internal error payloads.
- Accessibility-security joint policy: auth and high-risk forms remain keyboard-safe and screen-reader-safe, including failure states and confirmations.
- Performance-security joint policy: required security checks must not regress approved p95 route or action budgets without explicit blocker approval.

## Incident Readiness Contract

- Incident classes are fixed to `sev1`, `sev2`, `sev3`, and `sev4` with deterministic owner escalation rules.
- Every critical incident runbook must define `incident_commander`, `ops_lead`, `comms_lead`, escalation channel, containment steps, rollback-forward-fix decision rule, and recovery validation checklist.
- Rehearsal evidence is mandatory at release boundary: incident class exercised, scenario, start and end timestamps, participants, gaps found, and follow-up owners.

## Reliability SLI/SLO Contract

- Every branch that changes user-facing reliability behavior must declare SLI definitions, SLO targets, and measurement window in QA evidence.
- Route latency SLI uses p95 from branch performance matrix; reliability SLI uses successful-request ratio over rolling 28 days.
- Canonical release-one reliability target is successful-request ratio >= 99.5% over rolling 28 days (error budget <= 0.5%).
- Reliability evidence artifact path is fixed to `.agent/evidence/release/<branch>/sli-slo.md`; performance evidence artifact path is fixed to `.agent/evidence/release/<branch>/performance-matrix.md`.
- Error-budget enforcement gate: when rolling error budget is exhausted, release proceeds only for security fixes or approved `out_of_scope_blocker` entries in `CORE_PATCH_REQUESTS`.

## CORE_PATCH_REQUESTS Registry Contract

- Artifact location: this file at section `## CORE_PATCH_REQUESTS`.
- Required for: `browser_automation_exception` and `out_of_scope_blocker` requests.
- Entry format: one table row per request with required fields `request_id`, `created_at_utc`, `branch`, `request_type`, `reason`, `requested_scope`, `approval_source`, `approved_by`, `status`, `evidence_link`, `notes`.
- Allowed `status` values: `proposed`, `approved`, `rejected`, `completed`.
- Browser-automation gate: Playwright or other browser-automation tooling may run only after an entry with `request_type = browser_automation_exception` and `status = approved` exists.
- Branch-scoped approval rule: approved `CORE_PATCH_REQUESTS` entries are valid only for the exact `branch` value in that row; approvals cannot be reused by other branches.

## CORE_PATCH_REQUESTS

| request_id | created_at_utc | branch | request_type | reason | requested_scope | approval_source | approved_by | status | evidence_link | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CPR-YYYYMMDD-001` | `YYYY-MM-DDTHH:MM:SSZ` | `feature/<name>` | `browser_automation_exception` or `out_of_scope_blocker` | short deterministic reason | exact tool, route, and command scope | policy or stakeholder source | approver name or role | `proposed` | PR or QA note link | optional follow-up or closure note |
| `CPR-20260403-001` | `2026-04-03T15:12:00Z` | `feature/organizer-registration` | `browser_automation_exception` | user-requested full Playwright UI and workflow regression across breakpoints | Playwright MCP end-to-end UI traversal, form interaction, workflow validation, and responsive visual QA on desktop, tablet, and mobile for all reachable routes | direct user instruction in current chat turn | Mabansag, Vj (user) | `approved` | chat request 2026-04-03 organizer-registration full QA | execute browser automation immediately and mark completed after QA handoff |

## Notification Producer/Consumer Boundary Matrix

| Domain Event | Producer Boundary (Owner) | Consumers | Channel Ownership Boundary |
| --- | --- | --- | --- |
| `organizer_application_submitted` | Branch `05` trusted organizer-application submission flow | Applicant confirmation messaging, admin review intake | Branch `05` owns submission email and status-lookup UX. If a profile is later linked or provisioned for the same application, branch `15` may project exactly one account-linked inbox item using the original `application_id` as the stable event identity key; no pre-link inbox row exists before that linkage event |
| `organizer_application_approved` / `organizer_application_rejected` | Branch `04` trusted admin decision mutation | Branch `05` activation/rejection handoff and applicant transactional lifecycle messaging, branch `15` account-linked inbox/channel behavior | Branch `04` owns decision write only (`organizer_applications` decision fields); branch `05` owns organizer activation/provisioning (`profiles.role`, `profiles.approved_at`, including `profile_id` null cases) plus single applicant transactional lifecycle messaging; branch `15` owns account-linked preference-aware channel behavior only and must not duplicate applicant transactional decision email delivery |
| `team_invite_sent` / `team_invite_accepted` / `team_invite_declined` / `team_roster_invalidated` | Branch `09` team domain trusted flows | Team lifecycle UI in branches `09` and `10`, inbox/email delivery in branch `15` | Branch `09` emits events via shared dispatch helpers; branch `15` owns inbox UX, copy normalization, and email fan-out |
| `competition_registration_confirmed` / `competition_registration_withdrawn` | Branch `10` registration trusted flows | Branch `11` pre-entry context, branch `15` inbox/email delivery | Branch `10` emits registration-domain events only; branch `15` owns preference evaluation and delivery channels |
| `competition_schedule_changed` / `competition_cancelled` | Branch `08` lifecycle trusted flows | Branch `10` discovery and calendar read surfaces, branch `15` inbox/email delivery | Branch `08` owns producer writes for lifecycle schedule/cancel outcomes; branch `10` remains consumer-only for these event names; branch `15` owns preference-aware delivery |
| `competition_announcement_posted` | Branch `16` announcement trusted flow | Participant and organizer live surfaces in branch `16`, plus deterministic inbox delivery and channel-policy email handling via branch `15` shared notification helpers | Branch `16` owns durable announcement write, canonical audience resolution, realtime trigger, and announcement producer dispatch; for valid consumed producer events, branch `15` must provide deterministic minimum inbox delivery of exactly one row per `(recipient_id, event_identity_key)` for resolved recipients and apply email delivery per channel policy using shared notification preferences, templates, and infrastructure |
| `dispute_resolved` / `score_recalculated` | Branch `14` dispute-resolution and recalculation surfaces | Mathlete/organizer result surfaces, branch `15` notification delivery | Branch `14` owns dispute-resolution event truth and recalculation trigger from leaderboard/history workflows; branch `07` owns scoring RPC contracts (`recalculate_competition_scores`, `refresh_leaderboard_entries`); branch `15` owns inbox/email formatting and preferences |
| `leaderboard_published` | Branch `14` organizer publish action | Branch `14` leaderboard/history read paths, branch `15` participant notifications | Branch `14` owns publication state transition; branch `15` owns downstream message delivery behavior |

Boundary rule: only the producer boundary writes domain events for its row; consumer boundaries may read, transform, and deliver through shared helpers but must not duplicate producer writes.
Sequencing rule: branch `15` delivers shared notification infrastructure without requiring `competition_announcements` schema, and branch `16` consumes that infrastructure when announcement producers are introduced.
Consumer acceptance rule: valid consumed producer events are only those explicitly listed in this matrix; unknown event names must fail trusted dispatch validation.
This matrix defines domain-event ownership only. Branch execution ownership still comes from each feature guide's `Assigned to` field and the checklist.
