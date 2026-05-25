# Lessons: Utilities / Config

## Never duplicate utility functions — centralise at first reuse

`parseLikes`, `todayHoursIndex`, `avatarPalette` were each defined in 3–4 files before being extracted. The rule: as soon as a function appears in a second file, move it to `lib/utils/` and import it everywhere.

---

## Never use `process.env` directly in screens or hooks

Always read env vars from `lib/config.ts`:

```ts
// lib/config.ts
export const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? ''

// screens/hooks
import { GOOGLE_PLACES_KEY } from '@/lib/config'
```

`process.env` was scattered across 4 files before centralisation. Finding and updating keys became a search problem.

Public observability config follows the same rule. Read `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_SENTRY_ENABLED` from `lib/config.ts`; keep `SENTRY_AUTH_TOKEN` build-only in EAS secrets for source-map upload.

The Sentry Expo plugin also needs `SENTRY_ORG` and `SENTRY_PROJECT` build metadata. Pass them as plugin options from EAS environment variables; a bare plugin registration creates noisy local warnings and leaves release source-map setup incomplete.

Disabling Sentry capture is a runtime-policy change, not a reason to remove the Expo plugin. Keep plugin wiring intact, gate both initialisation and `Sentry.wrap` behind explicit enablement plus a DSN, and continue to keep auth tokens EAS-only.

---

## Parse unknown input at the boundary

Storage, route params, provider JSON, and message metadata are not trusted app types. Parse JSON as `unknown`, then use a focused guard before returning typed data.

**Pattern:** `parseJsonWithGuard(raw, isStringArray)`; route params go through `routeParamString` / `routeParamNumber`.

**Why:** A single unsafe cache/provider value can poison shared hooks and downstream inference.

**Guardrail:** Add or update `test:type-safety` fixtures whenever a shared parser or narrowing helper changes.
