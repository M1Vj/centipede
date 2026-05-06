# Leaderboard History Incident Readiness

## Mispublication

Detection: unexpected `leaderboard_published = true` or `leaderboard_published` event in `competition_events`.

Immediate response:

1. Confirm actor, request token, and event payload hash in `competition_events`.
2. Disable participant access by setting affected scheduled competition `leaderboard_published = false` through trusted admin remediation.
3. Preserve event rows and export job rows for audit.
4. Notify affected organizer and admins through branch-15 notification delivery when available.

## Recalculation Anomaly

Detection: accepted dispute changes score/rank unexpectedly or duplicate retry changes outcome.

Immediate response:

1. Compare `problem_disputes`, `competition_problem_corrections`, `competition_events`, and `leaderboard_entries` for same idempotency token.
2. Re-run trusted recalculation with a new incident token only after correction artifact is validated.
3. Do not mutate immutable competition snapshot fields.

## Export Exposure

Detection: export job visible to unrelated actor or raw storage path exposed.

Immediate response:

1. Revoke/rotate affected storage object access.
2. Confirm `export_jobs.requested_by`, competition owner, and route access logs.
3. Disable job delivery by moving job to `failed` with redacted `error_message`.
4. Preserve original storage object for forensic review under admin-only access.

## Evidence

- Export delivery route signs completed files for 300 seconds and omits raw `storage_path`.
- Export route tests verify owner access and participant denial.
- SQL contract tests verify event-producing RPCs are service-role only.
