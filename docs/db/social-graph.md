# Social Graph

## Source Tables

- `follows` stores approved follower/following relationships.
- `follow_requests` stores request lifecycle state.
- `user_settings.private_account` stores current account visibility.

## Derived Ledgers

- `social_events` stores user-facing activity history.
- `notification_deliveries` stores delivery attempts for social events.

Derived ledgers must be rebuildable from source tables. Source tables must not depend on derived ledgers for reconstruction.

## Scale Notes

Use cursor pagination on `(created_at, id)`. Consider partitioning `social_events` when it exceeds 5M rows or 10GB.

