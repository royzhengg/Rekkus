# Search — Design Reference

How search works in Rekkus. Update this file whenever scoring weights, pipeline logic, or ranking strategy changes.

Event tracking, trending data, and the `analytics_events` table are documented in [../docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md).

---

## Search Index Governance

Search is local-first. Supabase and Google should enrich discovery, not become an opaque ranking system.

Search should optimize for helping users discover food, not merely helping users find database records.
It is content-first, not place-first: dishes, posts, and places are equal search citizens, and
food intent should resolve through dish -> posts -> places rather than defaulting to place names.
Every searchable object should eventually be retrievable through one query. Manual area intent beats GPS
because explicit user intent wins over physical location. Search and Discovery can share entities and
signals, but Search is intent-led retrieval while Discovery is inspiration-led exploration.

| Area            | Rule                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Owner           | Product search rules live here; shared pipeline context/candidates live in `lib/search/`, hook lifecycle lives in `lib/hooks/useSearch.ts`, and provider calls stay in `lib/services/`. |
| Index source    | Prefer Rekkus tables and deterministic fields before external providers.                                                     |
| Query expansion | Use deterministic synonyms or Supabase evidence before AI, embeddings, or broad cached guesses.                              |
| Freshness       | Ranking changes that use recency, trending, or interaction windows must document the window and fallback.                    |
| Fairness        | Avoid ranking changes that permanently bury new or low-volume places without a discovery reason.                        |
| Observability   | Search changes should expose enough signal to debug zero results, provider fallback, and surprising top results. Ranking debates should use B-575 `get_search_quality_metrics` aggregates before tuning. |
| Zero-results UX | Zero-results state must never be a blank screen. `NoResultsCard` renders "No results for X" + 3 alternative chips from local taste signals with static fallbacks. Any change to the `totalResults === 0` branch in `SearchScreen.tsx` must preserve this invariant (enforced by `tests/unit/NoResultsCard.test.tsx`). |
| Transparency    | Public/help copy may explain main ranking factors, sources, and paid-placement status without exposing exact weights.        |
| Pipeline        | SearchContext is the pipeline input and SearchCandidate is the retrieval boundary. Future search features must flow through the same search pipeline; do not add separate ranking, intent, locality, analytics, or fallback logic in screens/hooks. |
| Experiments     | Meaningful ranking changes require a named metric, rollback path, owner, review date, tuning-log entry, and test coverage before shipping. |

Update this section whenever search adds a new indexed field, external provider dependency, ranking signal, cache, or fairness rule.
Any ranking or scoring change must keep a timestamped tuning-log entry so place/user disputes can be investigated later.

### Searchable Field Contract

Search has a live deterministic index, not a separate materialized index. The contract below defines which fields are searchable today and who owns changes before B-572+ adds graph-backed retrieval or B-578 adds a separate autocomplete path.

| Entity | Current searchable fields | Index/RPC owner |
| --- | --- | --- |
| Places | `places.name`, `cuisine_type`, `suburb`, `city`, `address`, geo distance, top dish names from linked posts, cuisine aliases, provider fallback rows with source attribution | `restaurants_search_tsv_idx`, `search_places_full_text`, `places_in_bounding_box`, `lib/services/places.ts`, `lib/services/googlePlaces.ts` |
| Dishes | `dishes.name`, `name_normalized`, save/post counts, top photo | `dishes.search_tsv`, `dishes_search_tsv_idx`, `search_dishes_full_text`, `search_posts_by_dish` |
| Posts | `posts.must_order`, `dish_tags.name`, `cuisine_type`, linked `hashtags.name`, `caption`, `occasion_tags`, linked place evidence | `posts_search_tsv_idx`, `search_posts_full_text`, `search_posts_by_dish`, `PostsContext` |
| People / users | `users.username`, `full_name`, follower/post counts for tie-breaking only | `users_search_tsv_idx`, user service reads, people scoring in search ranking utilities |
| Hashtags / tags | `hashtags.name`, `post_hashtags`, `posts.dish_tags`, dietary/occasion tag routing | `suggest_searches`, `search_posts_full_text`, `search_posts_by_dish` |
| Areas / suburbs | `suburb_aliases.alias`, `suburb_lookups`, `places.suburb`, manual area filter, around-me bounds | `resolve_suburb_query`, alias cache in `lib/search/context.ts`, `places_in_bounding_box` |

Owner process:

- Tokenization: full search uses Postgres FTS with `simple` config for places/posts/users and `english` config for canonical dishes. New token rules require a migration/RPC update, this table update, and a `check:search` guardrail update.
- Prefix handling: main post/place RPCs and `suggest_searches` use the `word:*` prefix pattern. Autocomplete remains a compact suggestion surface, not a separate ranking system until B-578.
- Hashtag handling: hashtags are searchable through `post_hashtags -> hashtags.name`; user-entered hash text must be normalized at write/service boundaries before it becomes searchable.
- Dish tag handling: post `dish_tags` and canonical `dishes` are first-party food evidence. Dish matches can increase recall, but place metadata remains the primary place FTS branch unless B-573 changes ranking.
- Alias ownership: cuisine/search aliases live in `CUISINE_SYNONYMS`, `CUISINE_ALIASES`, `cuisine_aliases`, `search_synonyms`, and `expand_search_cuisines`; area aliases live in `suburb_aliases` and `resolve_suburb_query`. Add aliases only when backed by product need or Rekkus evidence.
- Re-indexing: expression indexes and stored/generated `search_tsv` columns refresh through normal Postgres writes. Any future materialized index must document owner, source tables, retry policy, max staleness, rebuild command, rollback path, and operational monitor before shipping.
- Provider fallback: Google remains enrichment/fallback only after local evidence and the shared intent/locality gate. Ambiguous food or dish queries without GPS/manual locality must not call unbounded Google fallback. Create-post place tagging may top up thin local result sets, but selected Google rows must be promoted through the place graph flywheel instead of becoming a parallel provider-only result system.

---

## Search Index Operations

The place search path is backed by `place_search_index` (B-596, shipped 2026-06-23): a materialised table with pre-computed `search_name` (lower+unaccent), `search_tsv`, `cuisine_slug`, `suburb`, `verification_score`, `lat/lng`, `post_count`, `save_count`, and `trending_score`. Async triggers on `places` and `place_stats` keep it current. `search_text_fallback` drives its place branch from this table; `search_semantic` includes its signals in place `display_data`. See `docs/architecture/DATA_STRATEGY.md §Derived search cache` for column definitions and refresh policy.

`verification_score` reflects the place's current `verification_level` tier (0.30 for `osm_only` → 0.75 for `community_verified` → 1.00 for `owner_verified`). When the B-599 community verification trigger promotes a place to `community_verified`, the existing `trg_places_search_index` trigger on `places` fires automatically, raising its `verification_score` in the index without any manual refresh.

`npm run check:search` is the report-only guardrail for the operating contract below.

| Target | Current implementation | Operating rule |
| ------ | ---------------------- | -------------- |
| Search indexing job | `place_search_index` maintained by row-level triggers; no batch crawler. `useSearch` reads live Rekkus data; `expand_search_cuisines` provides deterministic expansion. | Do not add a crawler or embedding job without a documented latency/scale limit justification. |
| Refresh cadence | `place_search_index` updates synchronously via triggers on `places`/`place_stats`. 30-day analytics signals refresh on query execution. | Any new persisted index must document owner, source tables, retry policy, max staleness, rebuild command, rollback path, and operational monitor. |
| Stale handling | Missing or stale local/provider data falls back to local text evidence, then Google enrichment with source attribution. | Stale provider data must degrade ranking gently and must not block local Rekkus results. |
| Ranking recalculation | Scoring recalculates per query from deterministic weights; `verification_score`, `post_count`, `trending_score` are pre-materialised from `place_search_index`. | Any weight or signal change updates the tuning log and keeps exact lexical matches primary. |
| Search cache rules | Google Places cache/dedupe lives in `lib/services/googlePlaces.ts`; search itself does not persist arbitrary query caches. Selected Google places upsert canonical rows and provider snapshots. | Cache only provider responses with TTL/source/attribution; do not cache unbounded user query payloads or raw autocomplete prediction payloads. |
| Precomputed search signals | `place_search_index` provides pre-computed place signals. 30-day analytics aggregate from `analytics_events`. Saved-place personalisation stays per-user and bounded. | New precomputed signals must be privacy-safe, explainable, and derived from Rekkus-owned activity first. |
| Cuisine taxonomy governance | `CUISINE_SYNONYMS`, `CUISINE_ALIASES`, `cuisine_aliases`, and `expand_search_cuisines` own taxonomy expansion. | Add cuisine/dish mappings only when backed by product need or Rekkus evidence; avoid one-off long-tail synonym sprawl. |
| Nearby bounding | Around-me reads use `places_in_bounding_box` before client-side radius filtering and distance ranking. | Nearby search must not store precise user coordinates in analytics. |

---

## Search Health Operations

`lib/search/health.ts` is the B-581 operations report surface over `fetchSearchQualityMetrics()` / `get_search_quality_metrics(lookback_days)`. It summarizes aggregate rows only: success rate, zero-result rate, CTR, reformulation rate, and attributed downstream actions. It exposes no user IDs, per-session rows, precise coordinates, or raw provider payloads.

Threshold bands:

| Metric | Healthy | Watch | Incident |
| --- | ---: | ---: | ---: |
| Search success rate | >=45% | <45% | <25% |
| Zero-result rate | <15% | >=15% | >=30% |
| CTR | >=10% | <10% | <5% |
| Reformulation rate | <35% | >=35% | >=50% |

Provider fallback/cache/error spikes are investigated through existing analytics/provider events until those rates are promoted into the aggregate RPC. Search health review belongs in the weekly operational cadence and before/after meaningful ranking changes.

---

## What we search

| Type | Data sources | Searchable fields (FTS weight) |
| --- | --- | --- |
| **Posts** | `PostsContext` + Supabase FTS (`search_posts_full_text`) + dish RPC | must_order + dish_tags.name (A), cuisine_type + hashtags (B), caption (C), occasion_tags (D) |
| **People** | Demo users + Supabase `users` table | username, full_name |
| **Places** | Demo places + Supabase `places` + Google Places fallback | name (FTS), cuisine_type, suburb (FTS + B-tree filter), city, address, linked top dish names |

### Autocomplete

Autocomplete V2 builds a shared `SearchContext`, fires at 100ms debounce, and routes through a separate prefix path instead of full-search ranking. It returns compact suggestions typed as `place`, `dish`, `post`, `area`, or `tag` (legacy `hashtag` rows normalize to `tag`). Prefix responses use a bounded in-memory cache: 60s TTL, 50 entries, normalized query + coarse location key. The Search screen renders these as compact one-line chips mixed with recent/cuisine suggestions; suggestions must never reserve card-like vertical space or obscure the live results list.

### Semantic search (pgvector)

B-595 (shipped 2026-06-22) replaced the FTS pipeline with Supabase `gte-small` HNSW vector search as the primary retrieval path. `useSearch.ts` now calls `embedQuery` + `searchSemantic`; blended score is `0.7 × semantic_similarity + 0.3 × taste_similarity`. Posts and places carry an `embedding extensions.vector(384)` column populated by the `embed-content` Edge Function. `match_embeddings()` is the underlying DB function; `search_semantic` is the primary RPC surface.

---

## Search screen UX

Search has two clear states:

- **Discovery state** before typing: the input stays primary, the trailing filter button opens the full search filter sheet, Quick starts provides a short row of time-aware common actions and can include recent-search cuisine affinity, Trending now uses compact suggestion chips, Trending dishes shows a horizontal row of the top 10 dishes ranked by 7-day saves and posts (dish-first signal visible before any typing), Popular places is the main utility section, and creator suggestions sit lower on the page.
- **Results state** after typing or using Nearby: Top / Dishes / People / Places tabs organize the same ranked result sets. Top is a presentation layer that shows the best available places, dish posts, and people without changing the underlying ranking math. Results update from the controlled search text as the user types; network/provider calls remain debounced, but the UI should never require pressing return to refresh.

Place result rows show useful context in a stable order: cuisine when known, then suburb/city/short address, then distance when available. Provider fallback rows that do not have Rekkus cuisine still show their short location/address so the row does not look empty.

Nearby controls stay quiet until the user asks for them. Tapping the Nearby quick start switches search into around-me mode, shows a single area/radius token, and opens a filter sheet for current location, manual suburb/postcode, and 2 km / 5 km / 10 km / 25 km radius choices. Search still never requests GPS on mount.

The same sheet also owns scalable result filters: cuisine, occasion, value, media type, open now, and sort. Active filters render as compact tokens under the input only when set. Cuisine choices come from `lib/dataSources/cuisines.ts`, remain alphabetical/searchable, and exclude place types such as cafe, bakery, bar, food truck, and fine dining.

---

## Query pipeline

### Layer 1 — Query Understanding (`lib/utils/queryParser.ts`)

`parseSearchQuery()` classifies every query before any DB call fires. Intent types: `cuisine`, `dish`, `place`, `location`, `occasion`, `dietary`, `mixed`, `general`. Phrase detection runs bigrams/trigrams against known terms (e.g. "pad thai", "date night") before word-level splitting. Returns `ParsedQuery` with classified term lists, cleaned `searchWords` (noise-free FTS text), `isPrefix` flag for autocomplete routing, and `resolvedSuburb` from the sync alias cache.

### Layer 2 — Query Context (`lib/search/context.ts`)

`buildSearchContext()` normalizes the query once and carries the request contract through the rest of search: raw/normalized query, words, parsed intent, deterministic `SearchIntent`, locality source, user location, radius, optional suburb filter, around-me bounds, and dish/place query strings. It is the only boundary that should decide how locality, intent, and mode are represented for full search.

### Layer 3 — Candidate Retrieval (`lib/search/pipeline.ts`)

`runSearchPipeline()` is the single full-search retrieval entry point. It composes service-layer reads for users, places, post FTS IDs, dish-post matches, dish entities, cuisine expansion, dish graph evidence, personalization signals, trending entity signals, and Google provider fallback. The output includes ranked typed `SearchCandidate` rows for `post`, `dish`, `place`, and `person`, plus legacy arrays while the current tab UI migrates incrementally.

Cross-entity candidate ranking now lives in `lib/search/ranking.ts`. Existing tab presentation still consumes `useSearchResults` arrays until the Top tab migrates to the ranked candidate stream.

### Layer 4 — Query Routing (`lib/hooks/useSearch.ts`)

Intent drives which RPCs fire in parallel:

1. Always: `search_places_full_text` (places RPC; with optional `suburb_filter` for location queries)
2. `dish` or `mixed` intent: also fires `search_posts_by_dish` AND `search_dishes_full_text` in parallel
3. `dietary` intent: also queries `hashtags` for dietary tag IDs
4. `occasion` intent: auto-applies occasion filter without touching user-visible filter state
5. Autocomplete (100ms debounce): SearchContext-aware autocomplete V2 service around `suggest_searches` — separate from 300ms full search

### Layer 5 — Database functions

| RPC | Purpose |
| --- | --- |
| `search_places_full_text` | Places full-text search: weighted FTS + geo multiplier. Includes `suburb` in FTS vector + optional `suburb_filter`. Supports prefix matching (`tonkat:*` matches "tonkatsu") and lower-priority tagged dish-name matches through `posts.dish_id -> dishes.name`; returns place/post freshness metadata for bounded cold-start exposure. |
| `search_posts_full_text` | Weighted FTS (A=dish/tags, B=cuisine/hashtags, C=caption, D=occasion). `ts_rank_cd` for phrase queries. Also supports prefix matching for as-you-type results. |
| `search_posts_by_dish` | Targets `must_order` + `dish_tags.name` at weight A. Falls back to pg_trgm when FTS returns 0 (returns `match_source`) |
| `search_dishes_full_text` | FTS on `dishes.search_tsv` (`to_tsvector('english', name)`) + trigram fallback. Returns canonical `Dish` rows with `save_count`, `post_count`, `top_photo_url`, `first_posted_at`, and `latest_posted_at`. `security definer` to aggregate `saved_dishes` counts without exposing individual savers. |
| `suggest_searches` | Prefix FTS across place names, dish names, hashtags; app wrapper normalizes compact autocomplete types and area suggestions. Returns in < 50ms where feasible |
| `match_embeddings` | pgvector cosine similarity. Called when FTS returns < 5 results |
| `resolve_suburb_query` | 3-tier: exact alias → pg_trgm on `suburb_lookups` → pg_trgm on `places.suburb` |
| `refresh_place_popularity_cache` | Pre-aggregates place post counts, interaction counts, avg food rating. Replaces per-search analytics fetch. |
| `refresh_trending_queries` | Aggregates `analytics_events` from last 24h with 6h recency weighting |

### Layer 5b — Typo Tolerance (trigram fallback)

All three main search RPCs use a two-phase retrieval pattern: FTS primary, trigram fallback on zero results only.

| RPC | Trigram field | Function | Threshold | Rationale |
| --- | --- | --- | --- | --- |
| `search_places_full_text` | `places.name` | `extensions.word_similarity(query, name)` | > 0.35 | Asymmetric — handles short query ("rmen") against longer name ("Ramen Bar"); higher threshold reduces false positives from common English words |
| `search_posts_full_text` | `posts.must_order` | `extensions.similarity(must_order, query)` | > 0.30 | Symmetric, mirrors `search_posts_by_dish` existing threshold |
| `search_dishes_full_text` | `dishes.name_normalized` | `extensions.similarity(name_normalized, query)` | > 0.30 | Pre-existing since B-544 |
| `search_posts_by_dish` | `posts.must_order` | `extensions.similarity(must_order, query)` | > 0.25 | Pre-existing since dish-intent search shipping |

Design rules:

- Trigram fallback is gated by `not exists (select 1 from <fts_cte>)` — never adds rows to FTS matches, preserving FTS precision for normal queries
- All distance multiplier tiers (×2.0 / ×1.5 / ×1.25 / ×1.1 / ×0.7 / ×0.15) are applied identically in both FTS and trigram branches so geo-ranking is preserved under typo recovery
- No new indexes needed: `restaurants_name_trgm_idx` and `posts_must_order_trgm_idx` (GIN, `gin_trgm_ops`) already exist from `20240223000000_search_enrichment.sql`
- Multilingual aliases (`char siu`, `叉烧`) remain a separate later concern (B-577b)

Shipped: migration `20260602000001_search_typo_tolerance.sql` (B-577). Multilingual aliases (`char siu`, `叉烧`) remain separate future work, not part of typo tolerance V1.

### Layer 6 — Cross-Entity Fusion

SearchCandidate fusion is deterministic and additive: each candidate keeps its source rank, receives an intent-specific entity weight, then receives a bounded source-trust adjustment. Food/dish and mixed queries favor dish → post → place, place-name and location queries favor places, and people stay low unless source rank is strong. Broad food queries apply a diversity prelude so the first available dish, post, and place can appear before the normal ranked remainder.

Current B-573 weights:

| Intent | Dish | Post | Place | Person |
| --- | ---: | ---: | ---: | ---: |
| `food_dish` | +8 | +7 | +5 | +0.5 |
| `mixed` | +7 | +6 | +6 | +0.5 |
| `place_name` | +4 | +4 | +8 | +1 |
| `location` | +3 | +4 | +8 | +0.5 |
| `general` | +4 | +5 | +5 | +2 |

Source trust adjustments: local place +1.5, expanded place +0.5, provider place -1.5, post FTS +0.75, dish-post match +1, dish FTS +1, user +0. Rollback path: return raw `buildSearchCandidates()` output without calling `rankSearchCandidates()`.

Trust and abuse controls are deterministic and bounded:

| Control | Rule | User-facing metadata |
| --- | --- | --- |
| Exact match | First-party/local candidates whose display text exactly matches the normalized query receive a small boost. Provider rows do not receive this trust badge. | `Exact match` |
| Nearby signal | Local place candidates within 2 km of an explicitly supplied location receive a small boost. Precise coordinates are not written to analytics. | `Near you` |
| Popular nearby | Nearby local places with at least 3 Rekkus posts receive a bounded additive boost. | `Popular nearby` |
| Trending | De-identified aggregate trend scores add at most +0.8. | `Trending` |
| Keyword stuffing | Candidates repeating query tokens more than 3 times receive a penalty instead of an explanation badge. | none |
| Duplicate suppression | Place candidates sharing a provider identity collapse deterministically, preferring local Rekkus evidence over provider fallback. | none |

Graph, personalization, and trending V1 metadata are additive and bounded:

| Signal | Source | Max impact | Rule |
| --- | --- | ---: | --- |
| Dish graph evidence | Existing `posts.dish_id -> posts.place_id` links | metadata only | Dish candidates expose serving place IDs/count and up to 5 supporting post IDs; place candidates expose top-dish presence metadata from existing result rows |
| Personalization | Recent search terms/areas/cuisines, saved posts, saved dishes, saved places | +1.2 | Adds transparent `personalizationReasons`; anonymous users receive no boost |
| Trending entities | 7-day de-identified post/place/dish aggregates | +0.8 | Uses existing aggregate/trending readers and falls back from sparse city data to global where available |

Search performance cache: autocomplete results are cached in memory for 60s/50 entries; full pipeline results are cached in memory for 30s/50 entries using normalized query, mode, radius, coarse location, suburb filter, and current post count. No cache is persisted to AsyncStorage and no raw provider payloads are cached beyond existing provider-specific TTL rules.

Freshness V1 adds bounded cold-start exposure to the same candidate score:

| Signal | Window | Max impact | Rule |
| --- | --- | ---: | --- |
| Freshness boost | Decays over 30 days; zero after 90 days | +0.9 | Uses post `createdAt`, dish `latestPostedAt`, and place `latestPostedAt`/`createdAt`; provider rows get no boost |
| Cold-start exposure | Same 30/90-day window | +0.6 | Applies only to low-volume candidates: post source rank ≤ 1, dishes with `post_count <= 2`, places with `post_count <= 1` |
| Popularity decay | When no recent activity remains | -0.6 | Applies only to stale high-volume dishes/places so old volume does not dominate forever; 30-day interaction signals stay separate |

Abuse review: freshness is bounded below exact/source rank and intent/entity weights, so repeated low-quality creation cannot outrank strong local text matches. If freshness causes surprising top results, tune the max boosts before widening the window.

Legacy per-tab result arrays still use the existing scoring helpers below.

### Ranking Change Governance

Every meaningful search ranking change must record:

- Metric: the aggregate metric used to judge the change, usually from `get_search_quality_metrics`.
- Rollback: config, feature flag, or code path to restore prior ranking.
- Owner and review date: who watches the change and when it is revisited.
- Test coverage: ordering, parser, guardrail, or UI tests that fail if the intended principle regresses.
- Tuning log entry: timestamped summary in this document.

Do not add a new experiment framework until the existing feature flag and aggregate metric workflow is insufficient. A/B comparison can be manual at this stage: capture the metric baseline, ship the bounded change, compare the same lookback window, and roll back if health thresholds move to watch/incident without a product-accepted reason.

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
2. **DB pg_trgm** (fast, indexed) — `resolve_suburb_query()` against `suburb_lookups` (16k AU suburbs) and `places.suburb`
3. **Google Places geocoding** — only when flag `locationGeocodeFallback` is on (off by default). Result is fed back into `suburb_lookups` for future free lookups (data flywheel).

The rest of the pipeline remains unchanged:

1. All non-stop words must match at least one field (OR across fields) — posts/places that fail this are excluded (score = 0)
2. If strict post/place matching returns no local evidence, Supabase RPC `expand_search_cuisines` infers likely cuisines from existing Rekkus content and place metadata
3. Expanded cuisine results are used only as a fallback; direct lexical matches always win
4. Supabase/local place data is queried first
5. Google Autocomplete is fallback/enrichment only after local miss, explicit outside-Rekkus behavior, or create-post identification need. Ambiguous food/dish queries without GPS or manual locality suppress unbounded Google fallback; strong place-name or explicit-location queries may use fallback with analytics. Create-post tagging asks the DB for 12 candidates, tops up eligible lists with fewer than 6 local rows, and renders at most 10 merged rows.
6. Google Autocomplete uses the centralized Places service for minimum query length, session-token-aware calls, request dedupe, stale-safe caching, and consistent key handling
7. Provider results merge into the scored pool only with source attribution, deduplicated by source ID and name
8. Search analytics attach a session id, query sequence, previous query, result count, selected radius, mode, and clicked result position so query chains can be reviewed without storing private payloads beyond the sanitized query string.
9. Recent-search personalization reads through `get_recent_search_history`, a per-user aggregate RPC over privacy-safe search events, so the app does not scan raw analytics history during normal search/discovery rendering.
10. Around-me mode can run without a text query after the user chooses current/manual location; it uses the Nearby filter sheet radius, bounding-box Supabase RPC, and final haversine filtering.
11. Filters run after broad candidate retrieval: cuisine, Rekkus Picks occasion/value, media type, and open-now narrow the ranked set without requiring a separate index.
12. Sort modes are presentation-level: Best match keeps deterministic score order; Nearby uses distance; Newest uses post creation time; Most saved uses the existing post save/like display signal; Highest Picks prioritizes posts/places with stronger Rekkus-owned quality evidence.

Create-post place tagging uses the same local-first principle: every typed change updates the candidate list through a debounced DB-first search, local Rekkus matches rank ahead of provider fallback, and the UI stays one unified place list rather than visible "relevant/popular/closest" sections. Thin local lists are topped up only when the intent/locality gate allows it; selected Google rows immediately create/update `places`, `restaurant_sources`, `restaurant_provider_cache`, and `restaurant_audit_events`, so future searches can resolve from Supabase first. Note: `restaurant_sources`, `restaurant_provider_cache`, and `restaurant_audit_events` retain historical naming.

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

The tiered token scoring prevents "indian" from matching "Indianapolis" at full strength — "indianapolis" is only 50% covered by "indian" (< 80%), so it scores at 33% weight. The place still appears, just ranked below actual Indian places.

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

Measured by number of Rekkus posts linked to that place (`post.placeId`).

| Post count | Boost |
| ---------- | ----- |
| ≥ 5 posts  | +1.5  |
| ≥ 2 posts  | +0.75 |
| ≥ 1 post   | +0.25 |

### Rekkus avg food rating boost (places)

Average `food_rating` across all linked posts for this place.

| Avg food rating | Boost |
| --------------- | ----- |
| ≥ 4.5           | +2.0  |
| ≥ 4.0           | +1.0  |
| ≥ 3.5           | +0.5  |

### Google rating boost (places)

Cached from Google Places Details API when a user first views a place detail page and local/cache data is missing or stale. Provider snapshots belong in `restaurant_provider_cache` (historical name retained); canonical place ranking prefers Rekkus-owned signals first. Existing `places.google_rating` and `places.google_review_count` remain compatibility fields until the provider-independent cache fully owns this path.

Google rating only contributes when the place has no linked Rekkus food-rating evidence. It is a provider fallback, not a primary ranking signal.

Google Place IDs are durable provider identifiers and can be retained in `restaurant_sources` (historical name retained); broader Google content stays field-mask limited, source-attributed, and governed by provider-cache freshness/retention. Raw autocomplete prediction payloads must not be persisted as a search index.

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

Saved places get a bounded +1.25 boost for the signed-in user. Places sharing a cuisine with saved places get a small +0.4 boost. This is intentionally weaker than exact text, distance, and first-party quality signals.

### In-app interaction boost (places)

30-day count of `place_click` + `place_view` events from `analytics_events`. See [../docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md) for the full event schema.

| 30-day interactions | Boost |
| ------------------- | ----- |
| ≥ 50                | +1.5  |
| ≥ 20                | +0.8  |
| ≥ 5                 | +0.4  |
| ≥ 1                 | +0.2  |

### Google Autocomplete food-type boost

Google Autocomplete returns a `types` array per prediction. Food establishments (`restaurant`, `food`, `cafe`, `meal_takeaway`, `bakery`, `bar`) get +2.0. Non-food places (churches, laundries, consulates) get no boost and naturally rank below food places.

### Distance boost (posts + places)

Requires an explicit user action in `lib/hooks/useUserLocation.ts`: either "Use current location" for GPS permission or a manual suburb/postcode fallback geocoded for the active search session. Search and Places must not request foreground location on mount, and precise coordinates must not be written to analytics. `B-524` removed the former mount-time request path and `check:risk-guardrails` prevents it from returning.

| Distance | Boost |
| -------- | ----- |
| < 500 m  | +5    |
| < 2 km   | +3    |
| < 5 km   | +1.5  |
| < 15 km  | +0.5  |
| ≥ 15 km  | 0     |

Google Autocomplete receives `location={lat},{lng}&radius=50000&strictbounds=true` when user coordinates are available. `strictbounds=true` hard-restricts results to the 50 km metro area; the earlier `radius=10000` with no strictbounds was a soft bias that Google routinely overrode with globally-popular text matches. For create-post place tagging, `searchRestaurantsByText` also passes `near_lat`/`near_lng` to the DB RPC so the PostgreSQL distance multipliers activate.

Create-post place tagging uses a tag-specific intent layer before provider fallback. Strong place names can use the existing fallback path, venue categories such as cafe, bakery, brunch, bar, and coffee require local DB matches or user locality before Google, and dish/menu terms such as omelette stay place-first so the user can tag dishes after selecting a venue. The empty state must expose the correct next action instead of presenting every broad query as “no results.”

### Radius, near-you, open/closed, and time-of-day hints

Search exposes 2 km, 5 km, 10 km, and 25 km radius choices inside the Nearby filter sheet when location search is active. Results inside 5 km show a "Near you" label. Restaurants with cached `open_now` from Google Place Details show open/closed state. Result rows also show lightweight deterministic time-of-day hints such as breakfast, lunch, afternoon, or dinner fit.

### Explore vs popular balance

Popularity and interaction boosts are bounded and only apply after a text, expansion, or around-me base score exists. This prevents popular places from appearing on unrelated text queries and leaves room for nearby high-quality low-volume places.

---

## Search synonym store

Canonical cuisine options live in `lib/dataSources/cuisines.ts`. Operator-managed `search_synonyms` rows map common, high-signal dish/ingredient, occasion, and dietary queries to canonical search concepts. The app loads enabled rows on boot with a 24h AsyncStorage cache and keeps `lib/utils/cuisineSynonyms.ts` constants as the offline/default fallback.

When a search word has no direct text match, we check if the word maps to a cuisine and score against `cuisine_type`.

Cuisine is not place type. Values such as cafe, bakery, bar, food truck, and fine dining belong to a future place-type filter, not the cuisine picker.

Examples:

- `ramen` → `['japanese']` — a Japanese place scores +2 even if "ramen" isn't in its name
- `curry` → `['indian']`
- `dumpling` → `['chinese', 'asian']`
- `taco` → `['mexican']`

Synonym expansion only applies when no direct match was found for that word (i.e., it's a fallback, not an addition to a direct match score).

The store should stay intentionally small. Long-tail dishes such as "tiramisu" should not be added one-by-one unless they become product-critical exceptions.

## Data-driven cuisine expansion

When strict matching returns zero posts or zero local/Supabase places, the app calls Supabase RPC `expand_search_cuisines(query_text, max_cuisines)`.

The function searches existing Rekkus evidence:

- `posts.caption`
- `posts.must_order`
- `posts.cuisine_type`
- linked `hashtags.name`
- linked place `name`, `cuisine_type`, `city`, and `address`

It returns up to 3 cuisine candidates with weighted match counts. Post evidence counts more than place metadata because a post saying "tiramisu" on an Italian post is stronger than a broad place text match.

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

## Observability

Search quality is measured via `search_session_end` events (fired on `SearchScreen` focus loss/unmount). Full SQL queries: [`docs/analytics/ANALYTICS.md` — Search observability queries](../docs/analytics/ANALYTICS.md).

| Metric | Event | Key field |
| --- | --- | --- |
| Zero-result rate | `search_session_end` | `had_results: false` |
| Top failing queries | `search_session_end` | `had_results: false`, `query` |
| Session duration (P50/P95) | `search_session_end` | `session_duration_ms` |
| Abandonment rate | `search_session_end` | `result_clicked: false`, `had_results: true` |

`search_abandon` (B-539) fires as a dedicated signal when a session ends with a non-empty query and no click — useful for simple abandonment queries without joins.

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
| 2026-05-08 | Rekkus avg food rating boost per place                                                                                                                                                                                                | Community-rated places surface above unrated ones                                                                                                                                    |
| 2026-05-08 | Google rating + review count boost (cached lazily)                                                                                                                                                                                    | Industry-standard quality signal; populates on first location detail view                                                                                                            |
| 2026-05-08 | 30-day in-app interaction boost (place_click + place_view)                                                                                                                                                                            | Trending and popular places rank higher — data from analytics_events                                                                                                                 |
| 2026-05-08 | Google Autocomplete food-type boost (+2.0)                                                                                                                                                                                            | Churches, laundries, consulates rank below food establishments without hard-excluding them                                                                                           |
| 2026-05-08 | Google results merged into scored pool (not appended)                                                                                                                                                                                 | All results sorted together by final score; non-food places still visible, just lower                                                                                                |
| 2026-05-08 | Added Indonesian, Korean, Mediterranean cuisines to CUISINE_SYNONYMS                                                                                                                                                                  | rendang/nasi → indonesian; bibimbap/kimchi → korean; mezze/tzatziki → mediterranean                                                                                                  |
| 2026-05-11 | Added backend data-driven cuisine expansion                                                                                                                                                                                           | Zero-result post/place buckets can infer likely cuisines from existing Rekkus content without an LLM, embeddings, large synonym map, or query cache                                  |
| 2026-05-12 | Search session chains and result-position click tracking shipped                                                                                                                                                                      | Supports diagnostics for ranking quality, query reformulation, and surprising result positions                                                                                       |
| 2026-05-12 | Around-me mode, radius filtering, near-you labels, cached open-now signal, time-of-day hints, saved-place personalization, bounded popularity boosts, full-text indexes, cuisine aliases, and PostGIS-backed bounding-box RPC shipped | Completes the V1 local discovery utility pass while keeping ranking explainable                                                                                                      |
| 2026-05-18 | Search screen redesigned around discovery/results states, compact filters, result tabs, and a Nearby filter sheet                                                                                                                     | Reduces visual clutter while preserving deterministic ranking, provider fallback, and opt-in location behavior                                                                       |
| 2026-05-31 | Search session observability shipped: `search_session_end` + `search_abandon` events, zero-result / abandonment / P95 SQL queries documented (B-538, B-539)                                                                           | Enables data-driven search quality monitoring; zero-result rate and abandonment now measurable                                                                                           |
| 2026-05-31 | Added `top_dishes` pill row to place search cards (B-545): `search_restaurants_full_text` and `restaurants_in_bounding_box` now return the 3 most-posted dish names per place                                                          | Post-aggregated dish names are the highest-value missing signal when evaluating places for a dish-specific query (e.g. "ramen") — surfaces without any new user input                  |
| 2026-06-01 | People results ranking: added log-scaled follower-count tie-breaker in `scorePerson()` — `Math.log1p(followerCount) * 0.1` (B-546). `follower_count` and `post_count` cached on `users` table via triggers; DB extras now scored and sorted. | Two accounts with identical text-match scores were ordered by DB insertion time; active creators now surface above zero-activity accounts without overriding any text-match tier. |
| 2026-06-01 | Location-aware trending shipped (B-550): `trending_searches` stores `near_city`, search analytics records DB-resolved city from existing coordinates, and discovery trending/popular places read city rows before global fallback. | Melbourne and Sydney users no longer share one global trending surface; sparse city data still falls back to global after fewer than 4 local rows. |
| 2026-05-31 | Regression test coverage for search ranking (B-547): `scorePost`, `scorePlace`, `scorePerson`, `scoreExpandedPost/Place`, dish-intent boost, distance ordering, and place expansion invariants added to `tests/unit/lib/utils/searchScoring.test.ts`. Coverage raised from 48% → 68%; ratchet locked in `jest.config.js`. | Scoring logic had zero tests — any weight or synonym change was a manual QA exercise. Invariants now fail loudly. |
| 2026-06-01 | DB-backed search synonym store shipped (B-551): `search_synonyms` owns cuisine, occasion, and dietary query vocabulary with a 24h app cache and local fallback constants. | Operators can add vocabulary like `boba` or `bbq` without an app deploy while search remains usable offline. |
| 2026-06-01 | Fixed create-post place search location bias (root cause fix): (1) Google Autocomplete upgraded from soft 10km bias to hard `strictbounds=true` with 50km radius — prevents globally-popular text matches (Beef & Boards USA, Beefbar Paris) from appearing for Sydney users; (2) `searchRestaurantsByText` now passes `near_lat`/`near_lng` to the `search_restaurants_full_text` RPC so DB distance multipliers activate; (3) migration `20260601000006` adds distance penalty tiers (5–50km ×0.7, > 50km ×0.15) to the RPC so cross-continental results are structurally suppressed when user coordinates are provided; (4) haversine `distanceKm` computed and appended to Rekkus search result secondary text as a trust signal. | Sydney user searching "Beef" received USA/Paris/Bangkok results first because the DB search used no coordinates and the Google fallback had only a soft location bias. |
| 2026-06-01 | Dish-name matching added to place FTS (B-563): `search_restaurants_full_text` now matches places whose tagged posts point to canonical dishes containing the query, with dish matches ranked below direct place metadata matches and below exact metadata prefix tiers. | Dish-intent create-post searches like "Beef" can surface local Rekkus places serving Beef Tataki or Beef Brisket even when the place name/cuisine/address does not contain the dish term. |
| 2026-06-01 | Dish-first Top tab ordering shipped (B-558): dish or mixed query intent renders dish posts above places in the Top tab while non-dish intents keep the existing places-first order. | Dish-intent searches like "matcha" and "carbonara" now lead with the content unit Rekkus differentiates on: specific dishes people recommend. |
| 2026-06-01 | Engagement-derived no-results suggestions shipped (B-560): B-555 cuisine metadata from post/place views and saves now feeds `UserTasteContext` after search text affinities and before recent/trending fallbacks. | Users who browse or save cuisine-heavy content get relevant recovery chips even if they have sparse search history. |
| 2026-06-01 | Server-side personalized suggestions RPC shipped (B-557): `get_personalized_suggestions` combines own search, engagement, saves, topics, and trending signals; the client renders local chips immediately and swaps in server chips when available. | No-results recovery can use full account history without shipping broad interaction history to the device, while preserving a zero-latency fallback. |
| 2026-06-01 | Location permission nudge shipped in create-post place search (B-565): `useRestaurantSearch` now exposes `locationStatus` and `requestLocation`; `StepMedia` renders a dismissible accent-tinted nudge below the search field when `status` is `idle` or `denied`; tapping requests GPS and collapses the nudge on grant; dismiss closes without requesting; 4 regression tests added to `tests/unit/features/StepMedia.test.tsx`. | Users with GPS off received zero or globally-degraded results with no explanation; the nudge surfaces the problem and provides a one-tap fix without blocking search. |
| 2026-06-02 | Trigram typo tolerance added to `search_restaurants_full_text` and `search_posts_full_text` (B-577 partial): `trgm_ranked`/`trgm_results` CTE gated by `not exists` on FTS zero-result path. `word_similarity > 0.35` on `restaurants.name`; `similarity > 0.30` on `posts.must_order`. Distance multiplier tiers preserved in trigram branch. No new indexes. | "japaneze", "rmen", "brgr" returned zero results; trigram fallback provides typo recovery without degrading FTS precision for normal queries. |
| 2026-06-02 | Search quality test suite shipped (B-586): `tests/unit/lib/search/quality.test.ts` (ranking principle tests) and `tests/unit/lib/search/generated.test.ts` (deterministic generated scenarios) added to `check:search`. | Scoring weight changes were invisible regressions; ordering invariants now fail loudly. |
| 2026-06-02 | Cross-entity candidate ranking shipped (B-573): `rankSearchCandidates()` applies deterministic source rank, intent/entity weights, source-trust adjustments, and a food-query diversity prelude for top dish/top post/top place candidates. | Universal search can rank dishes, posts, places, and people in one candidate stream without turning Top into a place-heavy append-only list; rollback is bypassing `rankSearchCandidates()` and returning raw candidates. |
| 2026-06-02 | Search Freshness V1 shipped (B-574): unified search candidates receive bounded `freshness_boost` (+0.9 max), `cold_start_exposure` (+0.6 max), and stale `popularity_decay` (-0.6 max). Freshness decays over 30 days and is zero after 90 days; provider fallback rows receive no freshness. | Popular results should not dominate forever; new quality posts, dishes, and restaurants need measured exposure without beating strong text/source relevance. |
| 2026-06-03 | Safe B-560-B-580 search pass shipped: B-577 closed, autocomplete V2 uses SearchContext with 60s/50-entry in-memory cache, full search uses 30s/50-entry in-memory cache, dish candidates expose graph evidence, candidate ranking applies bounded personalization (+1.2 max) and trending (+0.8 max) metadata. | Search gets faster and more evidence-rich without a new index, AI system, persisted query cache, or raw provider payload storage. Rollback: clear/bypass `createSearchMemoryCache`, omit metadata from `buildSearchCandidates()`, or set personalization/trending max boosts to 0. |
| 2026-06-03 | Search governance pass shipped (B-581-B-584): `lib/search/health.ts` summarizes aggregate health thresholds; `rankSearchCandidates()` adds exact/nearby/popular/trending explanation badges, keyword-stuffing penalty, and provider-ID duplicate suppression; ranking governance now requires metric, rollback, owner, review date, tests, and tuning-log evidence. | Search ranking changes need operational visibility and trust controls without a new dashboard dependency, ML system, or parallel experiment framework. Rollback: bypass `buildSearchHealthReport()`, remove trust adjustments from `trustSignal()`, or return raw candidates before `rankSearchCandidates()`. |
| 2026-06-12 | Create-post place tagging now requests 12 DB rows, tops up eligible thin local lists with Google when fewer than 6 local rows exist, caps the merged list at 10, and records top-up fallback as `thin_local_results`. | Location tagging felt sparse when 1-2 local DB rows blocked provider fallback entirely. The fix gives users more options while keeping DB-first ranking, no-location food-query suppression, strictbounded locality, and selected-result provider-cache flywheel behavior. |
| 2026-06-22 | Entire FTS pipeline replaced with Supabase `gte-small` HNSW vector search as primary retrieval (B-595). `useSearch.ts` rewired to `embedQuery` + `searchSemantic`; blended score `0.7 × semantic_similarity + 0.3 × taste_similarity`. `search_semantic` RPC with `dish_embeddings` side table. Search screen redesigned: Instagram-style tab underline, hero card for first result, `DiscoveryPage` editorial card grid, `NoResultsCard` rewrite. | Semantic similarity outperforms FTS for dish-first discovery ("something creamy and rich" → relevant dishes) where keyword matching fails. FTS RPCs remain for text fallback but are no longer the primary path. |
| 2026-06-23 | `place_search_index` materialised (B-596): pre-computed `search_name` (lower+unaccent), `search_tsv`, `cuisine_slug`, `suburb`, `verification_score`, `lat/lng`, `post_count`, `save_count`, `trending_score`. Async triggers on `places`/`place_stats` keep it current. `search_text_fallback` place branch and `search_semantic` display_data both read from this table. | Every search query was joining 7+ tables live; the index eliminates those joins and pre-materialises `verification_score` so community trust tier affects ranking without per-query computation. |

---

## Feature flag governance

### Graduated flags (code removed, permanently on)

| Flag | Graduated | Rationale |
| ---- | --------- | --------- |
| `searchEnrichmentV1` | 2026-05-31 | Stable in production. Covers query intent parsing, dish search RPC, suburb filter, popularity cache, and contextual boosts. All call sites inlined unconditional (B-543). |
| `searchAutocomplete` | 2026-05-31 | Stable in production. `suggest_searches` RPC returns in <50ms; no instability observed since 2026-05-19 rollout (B-543). |
| `searchPersonalisation` | 2026-05-31 | Activated alongside `searchEnrichmentV1` graduation — the popularity cache it depended on for verification is now permanently on. Taste-profile cuisine affinities are additive boosts only; no regressions expected (B-543). |

### Active flags

| Flag | Owner | Review date | Purpose |
| ---- | ----- | ----------- | ------- |
| `locationGeocodeFallback` | Search | 2026-08-19 | Google Places geocoding last-resort resolver. Off by default — costs money. Enable only if DB suburb tiers produce too many misses. |

### Rules for new search flags

- Every flag must declare `owner`, `createdAt`, and `reviewAt` in `featureFlags.ts` — `check:stale-flags` enforces this.
- Document graduation criteria in the flag's `description` at creation time so the decision is self-contained.
- Activate a flag by inlining its guarded paths and deleting its definition — never leave an `enabled: true` flag with dead wrapper code.
- Add a row to this table and a tuning log entry when a flag is graduated or removed.

---

## Search Quality Test Framework

Search quality is validated at two levels (B-586):

**Ranking principle tests** (`tests/unit/lib/search/quality.test.ts`) — ordering invariants using `scorePost`, `scorePlace`, `popularityBoost`, `rekkusPickBoost`, `computePostResults`, `computePlaceResults`. No DB calls. Assertions:

- Beef post ranks above chicken post for "beef" query (text relevance)
- Nearby place (<500m) ranks above far place (Melbourne) at equal quality (distance)
- Place with 5 Rekkus posts ranks above 0-post place at equal text score (popularity)
- Rekkus pick post (`worth_a_trip`) ranks above standard post at same FTS rank (quality signal)
- Cuisine keyword routes through `cuisine_type` only, not name (entity intent routing)
- Dish-matched post with `dishPostIds` entry ranks above same-FTS-rank post without one

**Generated scenario tests** (`tests/unit/lib/search/generated.test.ts`) — deterministic `parseSearchQuery()` coverage over fixed vocabulary (9 foods, 6 cuisines, 5 vibes, 5 locations). Uses `.slice()` samples, no `Math.random()`. Covers bare food, food + "near me", "best {food}", cuisine + "near me", vibe + "restaurant", food + "in {location}", and 3 typo variants per food word. 500ms ceiling for the full batch.

Run: `npm run test:search:quality`
Governance: `check:search` fails if either file is absent.

---

## Known limitations

- Posts only get distance boost when `lat`/`lng` are set — untagged posts don't benefit
- Google Autocomplete bias radius is fixed at 10 km even when the local radius control is wider or narrower
- Data-driven expansion only works when Rekkus already has content evidence for the query
- People results have no quality or distance signal (no location data on users)
- Popularity boost uses `post.placeId` linkage — posts without a linked place don't contribute

---

→ See [../BACKLOG.md](../BACKLOG.md) for all outstanding work.
