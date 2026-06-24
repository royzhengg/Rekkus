# Social Anti-Patterns

- Never derive follow state from `social_events`.
- Never create `social_events` directly from UI code.
- Never bypass the relationship RPC/source for profile follow state.
- Never insert `notification_deliveries` without a source `social_event`.
- Never update `social_events` except `read_at`.
- Never trust client ownership filtering for request approval or decline.
- Never create follow relationships from repair scripts without audit records.

