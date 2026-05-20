# Reversibility And Burden Review

Owner: Engineering / operations

Use this review when work can change data, release behavior, provider cost, user trust, or operational workload.

## Review Fields

| Field | Question |
| --- | --- |
| Reversibility | Can this be disabled, rolled back, or rolled forward safely? |
| Blast radius | Which users, tables, services, routes, or providers can be affected? |
| Operational burden | Is the ongoing burden Low, Medium, or High? |
| Observability | What signal proves the change is healthy? |
| Human override | Who can stop or override the system? |
| Docs/backlog | Which owner docs and backlog rows must change? |

## Rules

- Prefer flags, additive migrations, compatibility windows, and rollback notes for risky changes.
- Mark high-burden ideas as backlog debt or experiments before building permanent systems.
- Release, migration, abuse, billing, provider-cost, and destructive data decisions stay human-owned.
- If rollback is impossible, document the roll-forward path before promotion.
- Keep this review short; it should prevent hidden cost, not become ceremony.

