# Social Architecture Principles

- Relationship state comes from `follows` and `follow_requests`.
- `social_events` is presentation/activity history, not business truth.
- `notification_deliveries` is operational delivery state, not user state.
- Notification preferences come from `user_settings`.
- Business invariants belong in the database where possible.
- Events are append-only except explicit read-state updates.
- Derived ledgers must be rebuildable from source-of-truth tables.
- Relationship state is strongly consistent; Alerts are eventually consistent.

