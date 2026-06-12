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

---

## Treat filter state as session intent — persist it, don't reset it

Search filters (cuisine, occasion, sort, radius) are expressions of user intent that should survive app restarts. Resetting to defaults on every launch forces power users to re-apply the same filters repeatedly and discards a high-signal personalisation input.

**Pattern:** persist the last-applied filter set to AsyncStorage keyed by user ID, alongside radius. Restore on screen mount. Clear or overwrite whenever the user explicitly changes filters or logs out. This is identical to how `useSearchHistory` already persists recent queries — the same `parseJsonWithGuard` + type-guard pattern applies.

**Key:** `savedSearchState:<userId>` storing `{ filters: SearchFilters, radiusKm: number }`.

**Apply when:** adding, changing, or extending filter or radius state in search/discovery.

---

## Google Autocomplete `location`+`radius` is a soft bias, not a restriction — always use `strictbounds` for local-first contexts

`location` + `radius` in the Google Places Autocomplete API is documented as a preference, not a hard boundary. Google will override it with globally-popular text matches when they outrank local ones. For a query like "Beef" from Sydney, the global results (Paris, USA, Bangkok) have stronger global signals than any Sydney venue named "Beef".

**Fix:** add `strictbounds=true` alongside a city-scale radius (50km) when you need local-first results. This is the correct pattern for create-post restaurant tagging where the user is physically at a venue.

**When NOT to use strictbounds:** explicit outside-area searches can be broader, but broad food/dish queries must not silently fall through to global Google results. Main Search and create-post tagging both need an intent/locality gate before provider fallback.

**Radius choice:** 10km is too small for a metro area (misses suburbs, outer rings). 50km covers all of Greater Sydney, Greater Melbourne, etc. without extending to another city.

**Guardrail:** `tests/unit/lib/services/googlePlacesLocationBias.test.ts` asserts that the URL includes `strictbounds=true` and `radius=50000` whenever user coordinates are provided.

---

## Pass user coordinates through the full chain — a missing argument silences geo ranking

The `search_restaurants_full_text` RPC has `near_lat`/`near_lng` parameters that apply 1.1×–2.0× proximity multipliers. These are optional/nullable by design. If the calling service omits them (passes nothing), PostgreSQL uses `null`, the `CASE` expression returns ×1.0 for all results, and the distance ranking is silently disabled. A restaurant 16,000km away ranks identically to one 200m away.

**Root cause pattern:** service function has optional location param that defaults to `null`; call site never passes it. No type error. No runtime error. Silent degradation.

**Fix:** always trace the location argument from hook → service function → RPC call. Write a unit test that asserts the RPC is called with the coordinate args when location is available.

**Apply when:** adding any geo-ranked DB query that accepts optional location params.

---

## Provider fallback needs intent and locality, not just a DB miss

A local DB miss is not enough reason to call Google globally. For a Sydney user typing "pork", the intent is food discovery, not "find any place on Earth named Pork". If GPS/manual locality is missing, suppress provider fallback for ambiguous food/dish queries and show a location nudge instead. Strong restaurant-name queries ("Din Tai Fung", "Chat Thai") and explicit-location queries ("pork Parramatta") can use provider fallback because the user supplied stronger intent.

**Pattern:** classify query intent, derive locality source (`gps`, `manual`, `none`), then decide fallback. Manual area overrides GPS because explicit user intent wins over physical location.

**Regression guard:** `tests/unit/lib/hooks/useSearch.test.ts`, `tests/unit/lib/hooks/useRestaurantSearch.test.ts`, and `tests/unit/lib/services/googlePlacesLocationBias.test.ts` assert that ambiguous food queries without locality do not call global Google fallback, while Sydney-locality calls remain strictbounded.

**Apply when:** changing search, autocomplete, restaurant tagging, or any provider fallback path.

---

## Distance scoring should penalise far results, not just boost nearby ones

A multiplier-only approach (×1.0 for all results beyond the local boost tiers) means a distant restaurant with a high text rank will still outrank a local one with a moderate rank. The boost helps close matches; it does not prevent remote matches from winning.

**Fix:** add penalty multipliers for results beyond the local metro area (>50km → ×0.15) so that cross-continental restaurants are structurally suppressed when the user's coordinates are available. The penalty tiers should be tuned so a restaurant ~2km away outranks one ~16,000km away even when the distant one has a stronger text match.

**Apply when:** adding distance ranking to any geo-weighted DB query that searches a globally-distributed table.

---

## Dish-name restaurant matches are secondary to restaurant metadata

Restaurant search can use tagged canonical dishes as a recall signal, but dish matches should not outrank direct restaurant name/cuisine/location matches at the same text quality. Keep `search_restaurants_full_text` metadata FTS as the primary score, add dish-name matches through `posts.dish_id -> dishes.name` as a lower-weight branch, and apply the existing distance multiplier to the final combined rank.

**Apply when:** extending restaurant search for dish or ingredient discovery.

---

## Ruled-out signals are as valuable as positive engagement signals

`searchDismissals` already captures which queries users explicitly dismiss from their history. The same principle applies to discovery: content the user scrolls past without any interaction (no like, save, tap) is a weak negative signal; content they explicitly dismiss or mark "not interested" is a strong one. These signals should feed discovery scoring rather than being discarded.

**Pattern:** derive `dismissedCuisines` from dismissed search queries using the same cuisine synonym path as positive affinities. Keep the impact bounded: `useDiscover` applies a 0.5× multiplier to matching cuisine posts instead of creating a separate negative-signal system or permanent taste-graph state.

**Apply when:** extending discovery ranking or building taste graph models.

---

## Location status must be surfaced — never silently degrade

Any hook that internally calls `useUserLocation` must expose `locationStatus` in its return type so UI consumers can render appropriate feedback. When `status` is `'idle'` or `'denied'`, silently falling back to global or zero search results is a UX bug — the user has no signal to act on.

**Pattern:** derive `locationStatus: userLocation.status`, `locationConstrained: userLocation.coords !== null`, and `requestLocation: userLocation.requestLocation` from the hook's internal `useUserLocation` call and include all three in the return type. StepMedia uses `locationStatus` to gate an inline nudge and `requestLocation` to trigger the permission prompt on tap. Restaurant tagging also exposes tag-specific intent: restaurant names can use the existing fallback path, venue categories like `cafe` need locality for provider fallback, and dish terms like `omelette` should guide users to choose a restaurant before dish tagging.

**Regression guard:** `tests/unit/lib/hooks/useRestaurantSearch.test.ts` asserts `locationConstrained` is `true`/`false` based on coord availability and covers `cafe`/`omelette` intent fallback. `tests/unit/features/StepMedia.test.tsx` asserts the nudge appears/disappears based on `locationStatus` and shows dish guidance.

**Apply when:** adding any new hook that uses `useUserLocation` and drives a UI that degrades without location.

---

## Create-post restaurant results need distance context

Flat restaurant prediction lists hide whether a result is nearby, city-local, regional, national, or global. Since `Prediction.distanceKm` is already available for local/nearby DB rows, derive a `distanceGroup` at the restaurant service/hook boundary and render compact section headers in `StepMedia`.

**Current tiers:** `<=2km nearby`, `<=50km city`, `<=250km state`, `<=4000km country`, otherwise `worldwide`. Missing distance defaults to `worldwide` for provider rows and `nearby` for local Rekkus rows. Preserve existing ranking within each group.

**Apply when:** changing create-post restaurant search, Google fallback merge behavior, or location-bias result presentation.

---

## Trigram typo tolerance: zero-result gate, not supplemental

When adding trigram (`pg_trgm`) fallback to an FTS RPC, gate it with `not exists (select 1 from <fts_cte>)` — not a per-row exclusion. The dishes and `search_posts_by_dish` RPCs use per-row exclusion (each trgm row must not already appear in FTS), which means trgm adds *supplemental* matches even when FTS has results. For general-purpose RPCs (`search_restaurants_full_text`, `search_posts_full_text`) the goal is typo *recovery*, not supplemental results. A table-level gate keeps FTS precision intact and only activates trgm when the query has no matches at all.

**Threshold:** `word_similarity(query, name) > 0.35` for restaurants (asymmetric — handles short queries against longer names); `similarity(field, query) > 0.30` for posts (symmetric, mirrors `search_posts_by_dish`). 0.35 for restaurants reduces false positives from common English words appearing in long restaurant names.

**Indexes:** no new indexes needed when `restaurants_name_trgm_idx` and `posts_must_order_trgm_idx` (GIN, `gin_trgm_ops`) already exist. Always check before creating.

**Distance multipliers:** copy the distance CASE expression identically into the trgm branch — a typo recovery result at 300m must still rank above a typo recovery result at 60km.

**Apply when:** adding trigram fallback to any FTS RPC where the goal is zero-result recovery rather than recall improvement on existing FTS results.

---

## Search quality tests: assert ordering, not exact scores

Scoring function tests should assert *relative ordering* between two candidates, not exact numeric values. Exact values couple tests to tuning constants and break whenever weights are tweaked. Ordering invariants encode product principles ("beef post ranks above chicken post for 'beef' query") that should remain true regardless of weight changes.

**Pattern:** create two mocked entities with a deliberate difference (one has a beef title, one has a chicken title), call `scorePost(post, words)`, and assert `beefScore > chickenScore`. Use `makePost` / `makePlace` factories with explicit overrides so the difference is self-documenting. Reset synonym state with `resetSearchSynonymsForTest()` in `beforeEach` to prevent cross-test leakage.

**Generated tests:** use deterministic `.slice()` on fixed word lists — never `Math.random()`. The goal is to validate that `parseSearchQuery()` handles the full product vocabulary without crashing and produces reasonable intent, not to test every permutation. A 500ms ceiling for 200+ synchronous calls validates that parsing has no hidden async or expensive operations.

**Apply when:** adding new scoring signals, changing scoring weights, or adding new query patterns that the parser should handle.

---

## Search caches and personal signals must be bounded and transparent

Autocomplete/prefix traffic can be cached aggressively, but only in process memory with a small cap and short TTL. Do not persist arbitrary query-result caches to AsyncStorage or the database unless there is a separate retention/compliance review. Current pattern: autocomplete cache is 60s/50 entries; full-search pipeline cache is 30s/50 entries; keys use normalized query plus mode/radius/coarse location/suburb/post-count context.

Personalization and trending should attach explicit metadata (`personalizationReasons`, `trendingScore`) and bounded ranking reasons instead of hidden score branches. Saved/recent signals must remain deterministic and owner-scoped; trending signals must come from aggregate/de-identified readers.

**Apply when:** adding search caches, autocomplete retrieval paths, candidate ranking metadata, personalization, graph evidence, or trending-based search boosts.

---

## Search trust metadata must reach the rendered result path

`SearchCandidate` is the retrieval boundary, but the current tab UI still renders legacy result arrays such as `PlaceResult[]`. When adding explanation badges or abuse signals, attach them to candidates and bridge the relevant display metadata back to the legacy rows until Top fully consumes the candidate stream.

**Pattern:** calculate trust metadata in `lib/search/ranking.ts`, then copy place explanation badges in `runSearchPipeline()` before returning `places` / `expandedPlaces`. Keep provider fallback rows from receiving first-party badges.

**Apply when:** adding search result explanations, trust badges, duplicate suppression, spam penalties, or migrating tabs to candidate-based rendering.
