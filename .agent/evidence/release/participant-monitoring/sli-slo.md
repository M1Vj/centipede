# Participant Monitoring SLI/SLO

branch: feature/participant-monitoring
commit: pending-final-verification

SLI definition:
- Successful monitoring request ratio for participant-monitoring reads and control POSTs.
- Successful request means authenticated and authorized requests return expected 2xx or deterministic 4xx machine-code outcomes without 5xx server errors.

SLO target:
- `>= 99.5%` successful-request ratio over rolling 28 days.

measurement window:
- Rolling 28 days after release.

error budget:
- `<= 0.5%` failed monitoring requests in rolling 28 days.

release decision:
- pass for branch merge readiness based on local verification: tests, lint, build, and Supabase reset passed.

sli_slo_results:
- Unit and SQL contract tests cover deterministic control outcomes, idempotency, announcement dispatch, and route authorization.
- Runtime telemetry integration remains release-operations work after deployment.
