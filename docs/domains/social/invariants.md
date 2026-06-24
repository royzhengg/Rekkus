# Social Invariants

Business invariants belong in the database where possible.

- Only one pending follow request may exist per requester-target pair.
- A user cannot follow themself.
- A user cannot request to follow themself.
- Pending, declined, and cancelled requests must not have an equivalent approved follow row.
- Approved follow requests create a follow row, social event, notification delivery, and audit event.
- Declined and cancelled requests never appear in Alerts.
- Blocked users can never follow, request follow, appear in Requests, or be auto-approved.
- `social_events` rows are append-only except `read_at`.
- Every notification delivery must reference a source `social_event`.
