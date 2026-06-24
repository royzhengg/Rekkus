# Social Decision Records

## `social_events` is a ledger, not relationship truth

Alerts need one user-facing activity source, but relationship state must remain strongly consistent. `follows` and `follow_requests` are authoritative; `social_events` can be rebuilt.

## Delivery state is separate

Push retry state lives in `notification_deliveries` so the activity ledger does not become an operational queue.

## Follow request approvals are transactional

Approving a request creates the follow row, event, delivery, and audit record in one transaction. Partial approval state is not allowed.

