# Lessons: Analytics

## All analytics calls go through `lib/analytics.ts`

Never call `supabase.from('analytics_events')` directly in screens. The abstraction:

- makes event schema changes a single-file update
- lets analytics be swapped out without touching every screen
- prevents analytics from crashing the app (errors are caught internally)

## Version and sample events at the analytics boundary

`event_version` belongs on every `analytics_events` row so historical queries can distinguish old and new payload shapes. `sampleRate` belongs only in `lib/analytics.ts`; callers choose a rate for high-volume diagnostics, while the shared boundary clamps it and drops sampled-out events before insert.

## Raw analytics retention is 90 days

User-linked raw analytics are operational evidence, not permanent product data. Delete raw `analytics_events` after 90 days and keep longer-lived trend/search data only as aggregate or de-identified surfaces.

## Provider telemetry uses the analytics boundary

Provider services must not write directly to `analytics_events`, even for cost telemetry. Route provider hits, misses, blocks, dedupes, and errors through `analytics.providerUsage(...)` so metadata keys are sanitized, anonymous events can be sampled, and event names stay consistent.

**Guardrail:** `check:observability` and `check:risk-guardrails` allow direct writes only in `lib/analytics.ts`.
