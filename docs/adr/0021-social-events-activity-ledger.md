# ADR 0021: Social Events Activity Ledger

Status: Accepted

Date: 2026-06-24

## Context

Alerts were assembled from likes, comments, replies, and follows directly. Follow requests add actionable activity, approval history, read state, notification delivery, and privacy constraints. A source-table union would drift quickly.

## Decision

`social_events` is the canonical user-facing activity ledger for Alerts. It is append-only except `read_at`, idempotent by `(source_type, source_id, event_type)`, and rebuildable from source-of-truth tables.

`social_events` is not relationship truth. Follow state remains authoritative in `follows` and `follow_requests`.

Push delivery status lives in `notification_deliveries`, not in the ledger.

## Consequences

- Alerts can read one cursor-paginated source.
- Relationship state remains strongly consistent if event creation is delayed.
- Future agents must not derive followers or request state from `social_events`.

