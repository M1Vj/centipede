# Leaderboard History Performance Matrix

| Surface | Risk | Mitigation | Evidence |
| --- | --- | --- | --- |
| Mathlete leaderboard | Large result sets can overflow narrow screens | Horizontal table overflow and server-side read helper from `leaderboard_entries` | Build and UI route availability verified |
| Organizer leaderboard management | Disputes, standings, and exports share one screen | Server-side page loads entries/disputes/jobs in parallel; client updates only changed rows | Build and route tests passing |
| Mathlete history | History overfetch can slow dashboards | Query scoped to current profile/team registrations and leaderboard rows by registration id | Full test suite passing |
| Organizer history | Aggregate counts can grow with competitions | Counts scoped to organizer competition ids | Full test suite passing |
| Export jobs | Large exports should not block UI | Queue-only POST; status/download route returns signed URL for completed jobs | Export route tests passing |

## Decision

Current branch is acceptable for release-one scale. Future hardening: add pagination/limit params before large public competitions exceed table-size comfort.
