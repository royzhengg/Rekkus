# Lessons: Search

## Geographic reference data belongs in the database, not in TypeScript

We initially planned a hardcoded `SUBURB_ALIASES` TS map for suburb resolution. This fails because: (1) adding a new suburb requires a code deploy, (2) the list is always incomplete, (3) there is no fuzzy matching for typos. The right approach is a DB table seeded from an authoritative source (`schappim/australian-postcodes`, ~16k rows) with a pg_trgm index for fuzzy matching, plus a small curated `suburb_aliases` table for colloquialisms ("CBD", "darlo"). The client caches the small alias table on startup for zero-latency common lookups; the comprehensive table is queried via an indexed DB function (`resolve_suburb_query`).

**Apply when:** adding any geographic filter, location suggestion, or address matching feature.

---

## Cache-first, API-last — build the data flywheel from day one

Every external API call (Google Places, geocoding) should store its result in our DB so the next request from any user never hits the API again. The `restaurant_provider_cache` table already does this for restaurant details (30-day TTL per Google ToS). The missing piece before search enrichment: suburb geocoding results were not fed back into `suburb_lookups`. Now they are — `cacheResolvedSuburb()` in `lib/utils/locationResolver.ts` inserts any Google-resolved suburb so future searches find it in the DB for free.

**Rule:** before calling any paid API, check the DB first. After calling it, store the result with an appropriate TTL. This compounds — the more users use the app, the less we pay and the faster search becomes.

**Apply when:** adding any new external API integration.

---

## Location permission is initiated by intent, not screen entry

Search previously requested foreground GPS as soon as the screen rendered, even though its manual area path works without that permission and the product policy promised contextual prompts. Keep `useUserLocation` explicit-only: a location-powered control may request GPS; mounting a search, map, or discovery surface may not.

**Guardrail:** `check:risk-guardrails` rejects the implicit `autoRequest` pattern and the hook unit test asserts that mount does not call the Expo permission API.

**Apply when:** changing search, nearby discovery, map, or saved-place location flows.

---

## Await DB resolution before paid provider fallback

DB-first search is not just an ordering preference; the fallback decision must wait for the DB lookup that can satisfy it. A floating `resolveSuburbQuery(...).then(...)` lets the same search request race ahead into Google while the local DB answer is still pending.

**Rule:** paid fallback eligibility is decided only after alias cache + DB resolution finish.

**Guardrail:** `npm run check:risk-guardrails` blocks floating suburb-resolution promises in search.

---

## Local trend partitioning should use DB-derived city, not reverse geocoding

Location-aware discovery can usually resolve a coarse city from existing restaurant rows near already-known coordinates. This avoids a new provider call, avoids storing precise coordinates in analytics, and preserves the explicit-only location-permission contract.

**Apply when:** partitioning search, trend, or discovery surfaces by city/region.
