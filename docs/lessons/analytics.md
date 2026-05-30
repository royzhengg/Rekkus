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

## Multi-step flows must have funnel instrumentation

Any feature screen that manages step state (`useState<Step>`) must emit `analytics.createPostFunnel` (or a named equivalent) on each step entry (`'viewed'`), advance (`'completed'`), and abandonment (`'abandoned'`). Track `duration_ms` via a `useRef` timestamp reset on each step change; pass a `reason` string on abandonment.

The post-creation flow (`features/create-post/CreatePostScreen.tsx`) is the reference implementation: step-view `useEffect`, funnel events in `handleNext` / `handleBack` / `handlePost`, and discard callback.

**Rage-tap detection** is available as `useRageTapDetector` (`lib/hooks/useRageTapDetector.ts`). For screens where the handler is defined after an early-return guard, inline the logic with a `useRef<number[]>` timestamp accumulator instead of calling the hook.

**Dead-click detection** on disabled buttons: add a transparent `Pressable` overlay (`accessible={false}`, `position: absolute`) over the disabled button. This preserves the button's a11y `disabled` semantics while capturing taps for telemetry.

**Session-level timing:** per-step `duration_ms` (reset via `stepEnteredAt` ref on each step change) measures dwell per step. For total creation-session duration, keep a separate `sessionStartedAt` ref initialised at mount and never reset. Pass it as `session_duration_ms` alongside `duration_ms` on the final completion event. Both keys are in `SAFE_METADATA_KEYS`.

**Guardrail:** `check:ux-signals` scans `features/` for step-state screens without funnel calls and fails CI. Add new multi-step screens to the script's `funnelAllowlist` with a B-### ID if instrumentation must be deferred.
