# Participant Monitoring Incident Readiness

branch: feature/participant-monitoring
commit: pending-final-verification

incident_rehearsal_results:
- Cheating spike: organizer uses participant tab risk/offense indicators, then timeline confirms durable event trail.
- Platform degradation: organizer uses announcement composer, pause/resume, extend, and disconnect-reset controls with required reasons and idempotency tokens.
- Admin support escalation: admin route exposes force-pause and moderation delete only; resume, extend, and disconnect reset remain organizer-only.
- Retry/reload scenario: control RPCs dedupe by competition, control action, actor, and request token.

owner/escalation:
- Organizer owns competition-scoped live controls.
- Admin owns incident force-pause and abuse/fraud non-draft moderation delete only.
- Engineering owns migration/RPC failures and notification dispatch failures.

communication:
- Organizer announcements write durable records before notification fan-out.
- Timeline records control decisions for post-incident reconstruction.

blockers:
- none for local branch completion.
