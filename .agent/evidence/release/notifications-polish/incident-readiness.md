# Notifications Polish Incident Readiness

## Failure Modes

- Dispatch retry storms: contained by `(recipient_id, event_identity_key)` uniqueness.
- Invalid producer event types: rejected before RPC side effects.
- Invalid deep links: reduced to `null` link path while preserving inbox delivery.
- Preference RPC drift: page falls back to owner-scoped table write, and SQL contracts cover canonical RPC.
- Provider email outage: generic notification dispatch records email eligibility metadata without blocking inbox delivery.

## Containment

- Disable or pause producer jobs emitting malformed events.
- Replay producer events with same event identity keys after fix; inbox rows remain idempotent.
- Inspect `metadata_json.channelClass`, `metadata_json.preferenceKey`, and `metadata_json.email` for delivery policy evidence.

## Recovery

- Re-run failed producers with original event identity keys.
- Use recipient-scoped notification queries to verify affected accounts.
- Preserve privacy: do not log raw tokens, full provider payloads, or sensitive moderation details.
