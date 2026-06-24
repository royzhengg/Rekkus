# Duplicate Social Events

1. Check `social_events_source_idx` and the `(source_type, source_id, event_type)` unique constraint.
2. Verify the producer uses `create_social_event`.
3. Repair by deleting only duplicate derived rows, never source `follows` or `follow_requests`.
4. Rebuild missing deliveries from the remaining canonical event rows.

