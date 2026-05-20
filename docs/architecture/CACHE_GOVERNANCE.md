# Cache Governance

Owner: Engineering

Cache governance prevents stale-data confusion while keeping provider usage under control.

## Current Caches

| Cache | Owner | TTL | Invalidation |
| --- | --- | --- | --- |
| Google Places responses | `lib/services/googlePlaces.ts` | 5 minutes | Time-based expiry |
| In-flight Google Places requests | `lib/services/googlePlaces.ts` | Request lifetime | Removed on resolve or failure |
| Restaurant provider cache | `restaurant_provider_cache` | Source/terms-specific TTL | Stale-while-revalidate, explicit expiry, or provider terms |
| Restaurant observations | `restaurant_observations` | Account lifetime or superseded | User deletion, moderation, or confidence promotion |
| Saved posts first page | `lib/hooks/useSavedPosts.ts` + `lib/services/offlineCache.ts` | Best-effort device cache | Overwritten on successful refresh; server remains source of truth |
| Saved places first page | `lib/hooks/useSavedLocations.ts` + `lib/services/offlineCache.ts` | Best-effort device cache | Overwritten on successful refresh; server remains source of truth |

## Rules

- Every cache must document owner, key shape, TTL, and invalidation behavior.
- Caches for user-owned data must prefer local DB truth and invalidate on writes.
- Provider fallback caches must not hide canonical Supabase data.
- Search and discovery caches must record whether freshness affects ranking or fairness.
- Stale results should degrade visibly through product-owned states when freshness matters.
- Device caches may hydrate UI before network data arrives, but writes and deletes must still go through Supabase/RLS.
- Offline saved collections should reuse `lib/services/offlineCache.ts` only after a collections table and ownership model exist.
- Nearby discovery cache may store only minimized result snapshots and area-level freshness metadata; precise GPS history must not be retained.

## Guardrails

- `npm run check:ops` validates this governance doc and known Google Places cache controls.
- `npm run check:providers` validates provider cache guardrails, Google service boundaries, field masks, session token support, and provider usage telemetry.
- Provider cache must preserve source, cacheability, retention, attribution, freshness state, and audit path; provider-derived fields cannot become canonical restaurant truth without a documented promotion rule.
- New high-volume provider integrations should ship with cache or dedupe evidence.
- Cache policy changes that affect ranking, search, feed, or saves must update product owner docs.
