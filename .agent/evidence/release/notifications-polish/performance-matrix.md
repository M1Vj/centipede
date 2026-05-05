# Notifications Polish Performance Matrix

| Surface | Budget | Evidence |
| --- | --- | --- |
| Inbox list load | Recipient-scoped query, latest 50 rows, indexed by `(recipient_id, created_at desc)` | `notifications_recipient_created_idx` |
| Unread count | Recipient-scoped head count filtered by unread state | `notifications_recipient_unread_created_idx` |
| Mark one read | Single notification id plus `auth.uid()` ownership predicate | `mark_notification_read` SQL contract |
| Mark all read | Recipient-scoped update filtered by `read_at is null` | `mark_all_notifications_read` SQL contract |
| Dispatch retry | Unique `(recipient_id, event_identity_key)` conflict handling | `notifications_recipient_event_identity_uq` |
| Preferences save | Single owner-scoped upsert through trusted RPC | `update_notification_preferences` |

Decision: notification hot paths are scoped by recipient and indexed. No broad inbox scans are introduced.
