# Social Entities

- `follows`: approved relationship rows.
- `follow_requests`: pending and terminal request lifecycle rows.
- `social_events`: user-facing Alerts ledger.
- `notification_deliveries`: push delivery status and retries.
- `privacy_audit_events`: privacy transition audit trail.

Future optimisation: materialise relationship state only if profile loads require more than three joins or relationship checks become a hot-path bottleneck.

