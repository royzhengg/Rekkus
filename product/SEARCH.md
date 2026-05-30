# Search — Design Reference

How search works in Rekkus. Update this file whenever scoring weights, pipeline logic, or ranking strategy changes.

Event tracking, trending data, and the `analytics_events` table are documented in [../docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md).

---

## Search Index Governance

Search is local-first. Supabase and Google should enrich discovery, not become an opaque ranking system.

| Area            | Rule                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Owner           | Product search rules live here; service implementation lives in `lib/hooks/useSearch.ts` and `lib/services/googlePlaces.ts`. |
| Index source    | Prefer Rekkus tables and deterministic fields before external providers.                                                     |
| Query expansion | Use deterministic synonyms or Supabase evidence before AI, embeddings, or broad cached guesses.                              |
| Freshness       | Ranking changes that use recency, trending, or interaction windows must document the window and fallback.                    |
| Fairness        | Avoid ranking changes that permanently bury new or low-volume restaurants without a discovery reason.                        |
| Observability   | Search changes should expose enough signal to debug zero results, provider fallback, and surprising top results.             |
| Zero-results UX | Zero-results state must never be a blank screen. `NoResultsCard` renders "No results for X" + 3 alternative chips. Any change to the `totalResults === 0` branch in `SearchScreen.tsx` must preserve this invariant (enforced by `tests/unit/NoResultsCard.test.tsx`). |
| Transparency    | Public/help copy may explain main ranking factors, sources, and paid-placement status without exposing exact weights.        |

Update this section whenever search adds a new indexed field, external provider dependency, ranking signal, cache, or fairness rule.
Any ranking or scoring change must keep a timestamped tuning-log entry so restaurant/user disputes can be investigated later.

---

## Search Index Operations

There is no heavy materialized search index yet. The current implementation is a deterministic live index assembled from app state, Supabase tables, analytics events, cuisine expansion, and Google fallback only when local evidence is weak. `npm run check:search` is the report-only guardrail for this operating contract.

| Target                      | Current implementation                                                                                                                                                                     | Operating rule                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Search indexing job         | No destructive background job yet; `useSearch` reads live Rekkus data, Postgres full-text indexes support core text fields, and `expand_search_cuisines` provides deterministic expansion. | Do not add a crawler, embedding job, or materialized index until a real latency or scale limit exists.                                |
| Refresh cadence             | Local app state refreshes with screen/query lifecycle; Supabase reads and 30-day analytics signals refresh on query execution.                                                             | If a persisted index ships later, document owner, source tables, retry policy, max staleness, and rollback before marking it shipped. |
| Stale handling              | Missing or stale local/provider data falls back to local text evidence, then Google enrichment with source attribution.                                                                    | Stale provider data must degrade ranking gently and must not block local Rekkus results.                                              |
| Ranking recalculation       | Scoring recalculates per query from deterministic weights and current 30-day interaction counts.                                                                                           | Any weight or signal change updates the tuning log and keeps exact lexical matches primary.                                           |
| Search cache rules          | Google Places cache/dedupe lives in `lib/services/googlePlaces.ts`; search itself does not persist arbitrary query caches.                                                                 | Cache only provider responses with TTL/source/attribution; do not cache unbounded user query payloads.                                |
| Precomputed search signals  | Current precomputed-like signal is the 30-day analytics aggregate read from `analytics_events`. Saved-place personalization is read per user and stays bounded.                            | New precomputed signals must be privacy-safe, explainable, and derived from Rekkus-owned activity first.                              |
| Cuisine taxonomy governance | `CUISINE_SYNONYMS`, `CUISINE_ALIASES`, `cuisine_aliases`, and `expand_search_cuisines` own taxonomy expansion.                                                                             | Add cuisine/dish mappings only when backed by product need or Rekkus evidence; avoid one-off long-tail synonym sprawl.                |
| Nearby bounding             | Around-me reads use `restaurants_in_bounding_box` before client-side radius filtering and distance ranking.                                                                                | Nearby search must not store precise user coordinates in analytics.                                                                   |

---

## What we search

| Type | Data sources | Searchable fields (FTS weight) |
| --- | --- | --- |
| **Posts** | `PostsContext` + Supabase FTS (`search_posts_full_text`) + dish RPC | best_dish + dish_tags.name (A), cuisine_type + hashtags (B), caption (C), occasion_tags (D) |
| **People** | Demo users + Supabase `users` table | username, full_name |
| **Places** | Demo restaurants + Supabase `restaurants` + Google Places fallback | name (FTS), cuisine_type, suburb (FTS + B-tree filter), city, address |

### Autocomplete

Separate `suggest_searches` RPC fires at 100ms debounce, returning up to 3 suggestions each of type `restaurant`, `dish`, and `hashtag`. Uses prefix FTS (`word:*`), geo-weighted for restaurants. Returns in < 50ms. The Search screen renders these as compact one-line chips mixed with recent/cuisine suggestions; suggestions must never reserve card-like vertical space or obscure the live results list.

### Semantic search (pgvector)

Posts and restaurants each have an `embedding extensions.vector(384)` column populated by the `embed-content` Edge Function using Supabase's built-in free `gte-small` model. Called as a fallback when FTS returns < 5 results via `match_embeddings()` DB function.

---

## Search screen UX

Search has two clear states:

- **Discovery state** before typing: the input stays primary, the trailing filter button opens the full search filter sheet, Quick starts provides a short row of common actions, Trending now uses compact suggestion chips, Popular places is the main utility section, and creator suggestions sit lower on the page.
- **Results state** after typing or using Nearby: Top / Dishes / People / Places tabs organize the same ranked result sets. Top is a presentation layer that shows the best available places, dish posts, and people without changing the underlying ranking math. Results update from the controlled search text as the user types; network/provider calls remain debounced, but the UI should never require pressing return to refresh.

Place result rows show useful context in a stable order: cuisine when known, then suburb/city/short address, then distance when available. Provider fallback rows that do not have Rekkus cuisine still show their short location/address so the row does not look empty.

Nearby controls stay quiet until the user asks for them. Tapping the Nearby quick start switches search into around-me mode, shows a single area/radius token, and opens a filter sheet for current location, manual suburb/postcode, and 2 km / 5 km / 10 km / 25 km radius choices. Search still never requests GPS on mount.

The same sheet also owns scalable result filters: cuisine, occasion, value, media type, open now, and sort. Active filters render as compact tokens under the input only when set. Cuisine choices come from `lib/dataSources/cuisines.ts`, remain alphabetical/searchable, and exclude restaurant types such as cafe, bakery, bar, food truck, and fine dining.

---

## Query pipeline

### Layer 1 — Query Understanding (`lib/utils/queryParser.ts`)

`parseSearchQuery()` classifies every query before any DB call fires. Intent types: `cuisine`, `dish`, `restaurant`, `location`, `occasion`, `dietary`, `mixed`, `general`. Phrase detection runs bigrams/trigrams against known terms (e.g. "pad thai", "date night") before word-level splitting. Returns `ParsedQuery` with classified term lists, cleaned `searchWords` (noise-free FTS text), `isPrefix` flag for autocomplete routing, and `resolvedSuburb` from the sync alias cache.

### Layer 2 — Query Routing (`lib/hooks/useSearch.ts`)

Intent drives which RPCs fire in parallel:

1. Always: `search_restaurants_full_text` (with optional `suburb_filter` for location queries)
2. `dish` or `mixed` intent: also fires `search_posts_by_dish` in parallel
3. `dietary` intent: also queries `hashtags` for dietary tag IDs
4. `occasion` intent: auto-applies occasion filter without touching user-visible filter state
5. Autocomplete (100ms debounce): `suggest_searches` RPC — separate from 300ms full search

### Layer 3 — Database functions

| RPC | Purpose |
| --- | --- |
| `search_restaurants_full_text` | Weighted FTS + geo multiplier. Includes `suburb` in FTS vector + optional `suburb_filter`. Supports prefix matching (`tonkat:*` matches "tonkatsu") so results populate as the user types. |
| `search_posts_full_text` | Weighted FTS (A=dish/tags, B=cuisine/hashtags, C=caption, D=occasion). `ts_rank_cd` for phrase queries. Also supports prefix matching for as-you-type results. |
| `search_posts_by_dish` | Targets `best_dish` + `dish_tags.name` at weight A. Falls back to pg_trgm when FTS returns 0 (returns `match_source`) |
| `suggest_searches` | Prefix FTS across restaurant names, dish names, hashtags. Returns in < 50ms |
| `match_embeddings` | pgvector cosine similarity. Called when FTS returns < 5 results |
| `resolve_suburb_query` | 3-tier: exact alias → pg_trgm on `suburb_lookups` → pg_trgm on `restaurants.suburb` |
| `refresh_restaurant_popularity_cache` | Pre-aggregates post counts, interaction counts, avg food rating. Replaces per-search analytics fetch |
| `refresh_trending_queries` | Aggregates `analytics_events` from last 24h with 6h recency weighting |

### Layer 4 — Result Fusion (scoring `useMemo`)

All signals are **additive** — text score is primary, everything else is a boost.

Additional scoring added in this enrichment pass:

| Signal | Where applied | Boost |
| --- | --- | --- |
| Dish search RPC rank | Posts with a dish FTS/trgm match | `rank × 15` |
| Contextual time-of-day | Posts with matching cuisine/occasion (cafe 6–11h, date_night 18–22h) | +0.4 to +0.8 |
| Taste profile (saved posts) | Place cuisine affinity from saved/liked history | `affinity × 1.2` |
| Popularity cache (places) | Pre-aggregated post count + 30d interaction count | replaces live analytics fetch |

### Location resolution

When a query contains location terms (words after `near`, `in`, `around`, `at`):

1. **Sync alias cache** (0ms) — resolves `cbd`, `darlo`, `parra`, `surry`, etc. from `suburb_aliases` table loaded on app start
2. **DB pg_trgm** (fast, indexed) — `resolve_suburb_query()` against `suburb_lookups` (16k AU suburbs) and `restaurants.suburb`
3. **Google Places geocoding** — only when flag `locationGeocodeFallback` is on (off by default). Result is fed back into `suburb_lookups` for future free lookups (data flywheel).

The rest of the pipeline remains unchanged:

1. All non-stop words must match at least one field (OR across fields) — posts/places that fail this are excluded (score = 0)
2. If strict post/place matching returns no local evidence, Supabase RPC `expand_search_cuisines` infers likely cuisines from existing Rekkus content and restaurant metadata
3. Expanded cuisine results are used only as a fallback; direct lexical matches always win
4. Supabase/local restaurant data is queried first
5. Google Autocomplete is fallback/enrichment only after local miss, explicit outside-Rekkus behavior, or create-post identification need
6. Google Autocomplete uses the centralized Places service for minimum query length, session-token-aware calls, request dedupe, stale-safe caching, and consistent key handling
7. Provider results merge into the scored pool only with source attribution, deduplicated by source ID and name
8. Search analytics attach a session id, query sequence, previous query, result count, selected radius, mode, and clicked result position so query chains can be reviewed without storing private payloads beyond the sanitized query string.
9. Recent-search personalization reads through `get_recent_search_history`, a per-user aggregate RPC over privacy-safe search events, so the app does not scan raw analytics history during normal search/discovery rendering.
10. Around-me mode can run without a text query after the user chooses current/manual location; it uses the Nearby filter sheet radius, bounding-box Supabase RPC, and final haversine filtering.
11. Filters run after broad candidate retrieval: cuisine, Rekkus Picks occasion/value, media type, and open-now narrow the ranked set without requiring a separate index.
12. Sort modes are presentation-level: Best match keeps deterministic score order; Nearby uses distance; Newest uses post creation time; Most saved uses the existing post save/like display signal; Highest Picks prioritizes posts/places with stronger Rekkus-owned quality evidence.

Create-post restaurant tagging uses the same local-first principle: every typed change updates the candidate list through a debounced DB + provider search, local Rekkus matches rank ahead of provider fallback, and the UI stays one unified restaurant list rather than visible "relevant/popular/closest" sections.

---

## Scoring signals

All signals are **additive** — text score is primary, everything else is a boost on top. An exact name match always wins; boosts only differentiate equally-scored results.

### Text scoring

#### Posts

| Field                      | Score per word |
| -------------------------- | -------------- |
| title                      | +3             |
| cuisine_type (direct)      | +3             |
| cuisine_type (via synonym) | +2             |
| tags                       | +2             |
| location                   | +2             |
| creator                    | +1.5           |
| body                       | +1             |

#### People

| Match type                        | Score |
| --------------------------------- | ----- |
| Exact username or name word match | +4    |
| Username starts with word         | +3    |
| Username or name contains word    | +2    |

#### Places

| Field                      | Match type                         | Score per word |
| -------------------------- | ---------------------------------- | -------------- |
| name                       | Strong (word covers ≥80% of token) | +3             |
| name                       | Weak (word covers 40–79% of token) | +1             |
| cuisine_type (direct)      | substring                          | +2             |
| cuisine_type (via synonym) | via `CUISINE_SYNONYMS` map         | +2             |
| city                       | Strong token match                 | +1             |
| city                       | Weak token match                   | +0.33          |
| address                    | Strong token match                 | +1             |
| address                    | Weak token match                   | +0.33          |

The tiered token scoring prevents "indian" from matching "Indianapolis" at full strength — "indianapolis" is only 50% covered by "indian" (< 80%), so it scores at 33% weight. The restaurant still appears, just ranked below actual Indian restaurants.

### Rekkus Picks boost (posts)

New posts can carry `taste_verdict`, `value_verdict`, and `occasion_tags`. Search treats these as first-party quality and intent signals ahead of legacy numeric ratings.

| Signal | Boost |
| --- | --- |
| Taste = Worth a trip | +2.25 |
| Taste = Must order | +1.75 |
| Taste = Craveable | +1.0 |
| Value = Great value | +0.6 |
| Value = Worth the splurge | +0.45 |

Legacy `food_rating` remains a fallback quality signal for older posts.

### Quality boost (legacy posts)

| Food rating | Boost |
| ----------- | ----- |
| ≥ 4.5       | +0.8  |
| ≥ 4.0       | +0.35 |

### Popularity boost (places)

Measured by number of Rekkus posts linked to that restaurant (`post.restaurantId`).

| Post count | Boost |
| ---------- | ----- |
| ≥ 5 posts  | +1.5  |
| ≥ 2 posts  | +0.75 |
| ≥ 1 post   | +0.25 |

### Rekkus avg food rating boost (places)

Average `food_rating` across all linked posts for this restaurant.

| Avg food rating | Boost |
| --------------- | ----- |
| ≥ 4.5           | +2.0  |
| ≥ 4.0           | +1.0  |
| ≥ 3.5           | +0.5  |

### Google rating boost (places)

Cached from Google Places Details API when a user first views a location detail page and local/cache data is missing or stale. Provider snapshots belong in `restaurant_provider_cache`; canonical restaurant ranking prefers Rekkus-owned signals first. Existing `restaurants.google_rating` and `restaurants.google_review_count` remain compatibility fields until the provider-independent cache fully owns this path.

Google rating only contributes when the restaurant has no linked Rekkus food-rating evidence. It is a provider fallback, not a primary ranking signal.

| Google star rating | Boost |
| ------------------ | ----- |
| ≥ 4.5              | +0.75 |
| ≥ 4.0              | +0.35 |

| Review count | Boost |
| ------------ | ----- |
| ≥ 500        | +0.4  |
| ≥ 100        | +0.2  |
| ≥ 20         | +0.1  |

### Personalisation boost (places)

Saved restaurants get a bounded +1.25 boost for the signed-in user. Restaurants sharing a cuisine with saved places get a small +0.4 boost. This is intentionally weaker than exact text, distance, and first-party quality signals.

### In-app interaction boost (places)

30-day count of `place_click` + `place_view` events from `analytics_events`. See [../docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md) for the full event schema.

| 30-day interactions | Boost |
| ------------------- | ----- |
| ≥ 50                | +1.5  |
| ≥ 20                | +0.8  |
| ≥ 5                 | +0.4  |
| ≥ 1                 | +0.2  |

### Google Autocomplete food-type boost

Google Autocomplete returns a `types` array per prediction. Food establishments (`restaurant`, `food`, `cafe`, `meal_takeaway`, `bakery`, `bar`) get +2.0. Non-food places (churches, laundries, consulates) get no boost and naturally rank below restaurants.

### Distance boost (posts + places)

Requires an explicit user action in `lib/hooks/useUserLocation.ts`: either "Use current location" for GPS permission or a manual suburb/postcode fallback geocoded for the active search session. Search and Places must not request foreground location on mount, and precise coordinates must not be written to analytics. `B-524` removed the former mount-time request path and `check:risk-guardrails` prevents it from returning.

| Distance | Boost |
| -------- | ----- |
| < 500 m  | +5    |
| < 2 km   | +3    |
| < 5 km   | +1.5  |
| < 15 km  | +0.5  |
| ≥ 15 km  | 0     |

Google Autocomplete also receives `location={lat},{lng}&radius=10000` when an active GPS or manual-area coordinate is available.

### Radius, near-you, open/closed, and time-of-day hints

Search exposes 2 km, 5 km, 10 km, and 25 km radius choices inside the Nearby filter sheet when location search is active. Results inside 5 km show a "Near you" label. Restaurants with cached `open_now` from Google Place Details show open/closed state. Result rows also show lightweight deterministic time-of-day hints such as breakfast, lunch, afternoon, or dinner fit.

### Explore vs popular balance

Popularity and interaction boosts are bounded and only apply after a text, expansion, or around-me base score exists. This prevents popular places from appearing on unrelated text queries and leaves room for nearby high-quality low-volume places.

---

## Cuisine synonym map

Canonical cuisine options live in `lib/dataSources/cuisines.ts`. `CUISINE_SYNONYMS` in `lib/utils/cuisineSynonyms.ts` maps common, high-signal dish/ingredient queries to cuisine types. When a search word has no direct text match, we check if the word maps to a cuisine and score against `cuisine_type`.

Cuisine is not restaurant type. Values such as cafe, bakery, bar, food truck, and fine dining belong to a future restaurant-type filter, not the cuisine picker.

Examples:

- `ramen` → `['japanese']` — a Japanese restaurant scores +2 even if "ramen" isn't in its name
- `curry` → `['indian']`
- `dumpling` → `['chinese', 'asian']`
- `taco` → `['mexican']`

Synonym expansion only applies when no direct match was found for that word (i.e., it's a fallback, not an addition to a direct match score).

The map is intentionally small. Long-tail dishes such as "tiramisu" should not be added one-by-one unless they become product-critical exceptions.

## Data-driven cuisine expansion

When strict matching returns zero posts or zero local/Supabase places, the app calls Supabase RPC `expand_search_cuisines(query_text, max_cuisines)`.

The function searches existing Rekkus evidence:

- `posts.caption`
- `posts.best_dish`
- `posts.cuisine_type`
- linked `hashtags.name`
- linked restaurant `name`, `cuisine_type`, `city`, and `address`

It returns up to 3 cuisine candidates with weighted match counts. Post evidence counts more than restaurant metadata because a review saying "tiramisu" on an Italian post is stronger than a broad restaurant text match.

Client behavior:

- Posts use expanded cuisines only when strict post results are empty.
- Places use expanded cuisines only when strict local/Supabase place results are empty.
- Google Autocomplete still runs normally and remains a separate long-tail place source.
- If the backend has no evidence, no cuisine meaning is invented and the app shows the normal empty state / Google results.

This avoids an LLM, embeddings, and an unbounded query cache. It can only infer what exists in Rekkus data, which keeps the system predictable and cheap.

---

## Industry research

How Yelp, Uber Eats, Google Maps, Zomato, and DoorDash handle search ranking:

| Signal                         | Yelp           | Uber Eats         | Google Maps  | Zomato  | Rekkus                         |
| ------------------------------ | -------------- | ----------------- | ------------ | ------- | ------------------------------ |
| Text relevance                 | ✓ TF-IDF + LTR | ✓                 | ✓            | ✓ LTR   | ✓ tiered scoring               |
| Proximity                      | ✓              | ✓                 | ✓            | ✓       | ✓ haversine boost              |
| Ratings / quality              | ✓              | ✓                 | ✓            | ✓       | ✓ food rating boost            |
| Popularity (post volume)       | ✓              | ✓                 | ✓ prominence | ✓       | ✓ post count boost             |
| Cuisine synonym expansion      | ✓              | ✓ knowledge graph | partial      | partial | ✓ synonym + alias map          |
| Open/closed signal             | partial        | ✓                 | ✓            | ✓       | ✓ cached provider signal       |
| Personalisation                | ✓              | ✓                 | ✓            | ✓       | ✓ saved-place boost            |
| Time-of-day signals            | partial        | ✓                 | ✓            | ✓       | ✓ deterministic hints          |
| Query expansion (zero results) | ✓              | ✓ query2vec       | ✓            | ✓       | ✓ data-driven cuisine fallback |

### Key findings

**Uber Eats** (most publicly detailed engineering): Uses a knowledge graph to model cuisines and dishes as entities, plus `query2vec` — a learned embedding that maps queries to ordering behavior. "tan tan noodles" expands to "Szechuan" when the dish isn't available. Our `CUISINE_SYNONYMS` map is the practical equivalent at our scale.

**Yelp**: Combines Elasticsearch BM25 scores as features into an ML learning-to-rank model. Business name, location text, geographic distance, phone matching, and review signals are all features. At our scale, hand-tuned additive scoring achieves a similar ordering.

**Google Maps**: Ranks on three pillars — Relevance (text + categories), Distance, and Prominence (popularity, review count, links). We now match all three.

**Zomato**: Tracks `search_id` chains to understand how queries evolve in a session. Also uses regional popularity patterns — dishes trending in a suburb rank higher for users in that suburb.

**DoorDash**: Uses Upper Confidence Bound (UCB) to give new restaurants visibility alongside established ones. Prevents popular restaurants from monopolising results.

---

## Tuning log

| Date       | Change                                                                                                                                                                                                                                | Reason                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-08 | Initial text scoring weights                                                                                                                                                                                                          | Baseline                                                                                                                                                                             |
| 2026-05-08 | Added distance boost + Google location bias                                                                                                                                                                                           | Nearby results should rank above distant ones for generic queries                                                                                                                    |
| 2026-05-08 | Tiered token scoring for place name/city/address fields                                                                                                                                                                               | "indian" was ranking equal to "Indianapolis" — now: strong match (≥80% coverage) = full score, weak (40–79%) = 33%. Irrelevant places still show up, just ranked below relevant ones |
| 2026-05-08 | Cuisine synonym map (`CUISINE_SYNONYMS`)                                                                                                                                                                                              | "ramen" now surfaces Japanese restaurants even without "ramen" in the name — mirrors Uber Eats knowledge graph approach at our scale                                                 |
| 2026-05-08 | Quality boost for posts (food rating)                                                                                                                                                                                                 | Higher-rated posts float above equal-scored ones — mirrors Yelp/Google quality signal                                                                                                |
| 2026-05-08 | Popularity boost for places (Rekkus post count)                                                                                                                                                                                       | Places with more community activity rank higher — mirrors Google prominence signal                                                                                                   |
| 2026-05-08 | Rekkus avg food rating boost per restaurant                                                                                                                                                                                           | Community-rated places surface above unrated ones                                                                                                                                    |
| 2026-05-08 | Google rating + review count boost (cached lazily)                                                                                                                                                                                    | Industry-standard quality signal; populates on first location detail view                                                                                                            |
| 2026-05-08 | 30-day in-app interaction boost (place_click + place_view)                                                                                                                                                                            | Trending and popular places rank higher — data from analytics_events                                                                                                                 |
| 2026-05-08 | Google Autocomplete food-type boost (+2.0)                                                                                                                                                                                            | Churches, laundries, consulates rank below food establishments without hard-excluding them                                                                                           |
| 2026-05-08 | Google results merged into scored pool (not appended)                                                                                                                                                                                 | All results sorted together by final score; non-food places still visible, just lower                                                                                                |
| 2026-05-08 | Added Indonesian, Korean, Mediterranean cuisines to CUISINE_SYNONYMS                                                                                                                                                                  | rendang/nasi → indonesian; bibimbap/kimchi → korean; mezze/tzatziki → mediterranean                                                                                                  |
| 2026-05-11 | Added backend data-driven cuisine expansion                                                                                                                                                                                           | Zero-result post/place buckets can infer likely cuisines from existing Rekkus content without an LLM, embeddings, large synonym map, or query cache                                  |
| 2026-05-12 | Search session chains and result-position click tracking shipped                                                                                                                                                                      | Supports diagnostics for ranking quality, query reformulation, and surprising result positions                                                                                       |
| 2026-05-12 | Around-me mode, radius filtering, near-you labels, cached open-now signal, time-of-day hints, saved-place personalization, bounded popularity boosts, full-text indexes, cuisine aliases, and PostGIS-backed bounding-box RPC shipped | Completes the V1 local discovery utility pass while keeping ranking explainable                                                                                                      |
| 2026-05-18 | Search screen redesigned around discovery/results states, compact filters, result tabs, and a Nearby filter sheet                                                                                                                     | Reduces visual clutter while preserving deterministic ranking, provider fallback, and opt-in location behavior                                                                       |

---

## Known limitations

- Posts only get distance boost when `lat`/`lng` are set — untagged posts don't benefit
- Google Autocomplete bias radius is fixed at 10 km even when the local radius control is wider or narrower
- Data-driven expansion only works when Rekkus already has content evidence for the query
- People results have no quality or distance signal (no location data on users)
- Popularity boost uses `post.restaurantId` linkage — posts without a linked restaurant don't contribute

---

→ See [../BACKLOG.md](../BACKLOG.md) for all outstanding work.
