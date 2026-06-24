# Social Ownership

| Table | Authoritative for | Not authoritative for |
| --- | --- | --- |
| `follows` | Approved follower/following relationship state | Request history, alerts, delivery |
| `follow_requests` | Follow request lifecycle state | Approved relationship state after follow row exists |
| `social_events` | User-facing activity history and Alerts feed | Relationship state, request state, push delivery truth |
| `notification_deliveries` | Push delivery status and retry state | User-facing activity, social graph state, notification preferences |
| `privacy_audit_events` | Privacy transition audit trail | Current privacy setting |
| `user_settings` | Current privacy, notification, and settings values | Audit history, delivery state |

Never determine followers from `social_events`; use `follows`.

