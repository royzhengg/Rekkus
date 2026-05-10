# Analytics — Design Reference

How Rekkus tracks user behaviour, trends, and ranking signals. Update this file when events are added, scoring weights change, or new signals are introduced.

Feature areas that read from analytics: [Search](SEARCH.md) · [Feed](FEED.md)

---

## Why analytics

Analytics is the foundation for:

- **Search ranking**: places clicked and viewed more often rank higher
- **Trending now**: real search queries and place clicks power the discovery chips
- **Feed curation**: (future) top-performing posts surface in Discover
- **Personalisation**: (future) user's own interaction history seeds recommendations

Industry reference: Yelp, Google Maps, Xiaohongshu, and Zomato all use a two-tier approach — raw event log + aggregated queries. At Rekkus's scale we query the raw log directly with time-window filters (no pre-aggregated rollup tables yet).

---

## Event schema — `analytics_events`

| Column        | Type             | Description                          |
| ------------- | ---------------- | ------------------------------------ |
| `id`          | UUID             | Primary key                          |
| `user_id`     | UUID (nullable)  | Null for anonymous events            |
| `event_type`  | TEXT             | See event types below                |
| `entity_type` | TEXT (nullable)  | `'restaurant'` / `'post'` / `'user'` |
| `entity_id`   | UUID (nullable)  | ID of the entity being acted on      |
| `metadata`    | JSONB (nullable) | Flexible extra data per event type   |
| `created_at`  | TIMESTAMPTZ      | Event timestamp                      |

### RLS policy

- Authenticated users can insert their own events (`auth.uid() = user_id`)
- All rows are publicly readable for aggregate trend queries

### Indexes

- `(entity_type, entity_id, created_at DESC)` — trending places queries
- `(event_type, created_at DESC)` — trending searches queries

---

## Event types

| event_type     | entity_type  | entity_id     | metadata            | Triggered by                                      |
| -------------- | ------------ | ------------- | ------------------- | ------------------------------------------------- |
| `search_query` | null         | null          | `{ query: string }` | User pauses typing (600ms debounce) in search tab |
| `place_click`  | `restaurant` | restaurant.id | `{ query: string }` | User taps a place in search results               |
| `place_view`   | `restaurant` | restaurant.id | null                | User opens a location detail page                 |
| `post_view`    | `post`       | post.id       | null                | (future) User opens a post detail page            |
| `post_like`    | `post`       | post.id       | null                | (future) User likes a post                        |
| `post_save`    | `post`       | post.id       | null                | (future) User saves a post                        |

Events are **fire-and-forget** — tracked with `.then(() => {})` and never block navigation or UI.

---

## Where events are tracked

| File                         | Event          | When                                       |
| ---------------------------- | -------------- | ------------------------------------------ |
| `app/(tabs)/search.tsx`      | `search_query` | Query debounces (600ms), user is logged in |
| `app/(tabs)/search.tsx`      | `place_click`  | User taps a PlaceRow result                |
| `app/location/[placeId].tsx` | `place_view`   | Location detail loads, user is logged in   |

---

## How analytics feeds search ranking

`useSearch` fetches 30-day `place_click` + `place_view` counts per restaurant alongside every search. These are added as a scoring boost:

| 30-day interactions | Score boost |
| ------------------- | ----------- |
| ≥ 50                | +2.0        |
| ≥ 20                | +1.0        |
| ≥ 5                 | +0.5        |
| ≥ 1                 | +0.25       |

A place that people actively click on ranks higher than an equally-named place nobody clicks on — mirrors Google Maps' "prominence" signal.

---

## How analytics feeds trending

`useTrendingData` hook (7-day window):

- Tallies `search_query` events → `trendingSearches: string[]` (top 6 queries)
- Tallies `place_click` events → `trendingPlaceIds: string[]` (top 10 restaurants)

`search.tsx` uses `trendingSearches` to power the "Trending now" chip row. Falls back to hardcoded chips when no real data exists (new app, no users yet).

Future: `trendingPlaceIds` will power a "Trending places" section in Discover.

---

## Cached signals on `restaurants` table

Two columns are populated lazily from Google Places Details API — cached on first location detail view:

| Column                | Source                             | Used for                |
| --------------------- | ---------------------------------- | ----------------------- |
| `google_rating`       | Google Places `rating`             | Search quality boost    |
| `google_review_count` | Google Places `user_ratings_total` | Search prominence boost |

| Google rating | Score boost |
| ------------- | ----------- |
| ≥ 4.5         | +1.5        |
| ≥ 4.0         | +0.75       |

| Review count | Score boost |
| ------------ | ----------- |
| ≥ 500        | +1.0        |
| ≥ 100        | +0.5        |
| ≥ 20         | +0.25       |

Places start with no cached rating. The rating populates after the first user visits the detail page — places with no views never have a rating cached. This is intentional: we avoid a cold-start API burst on every search.

---

## Full signal stack (search ranking)

For each place, `useSearch` computes a final additive score:

```
final_score = text_score           ← tiered token matching
            + distance_boost       ← haversine (< 500m = +5, < 2km = +3, < 5km = +1.5)
            + post_count_boost     ← Rekkus posts linked to this restaurant
            + rekkus_avg_rating   ← avg food_rating from linked posts
            + google_rating        ← cached from Place Details
            + google_review_volume ← cached from Place Details
            + trending_30d_boost   ← place_click + place_view events last 30 days
            + food_type_boost      ← +2.0 if Google Autocomplete types = food/restaurant
```

Higher score = appears earlier in results. Nothing is hard-excluded.

---

## Tuning log

| Date       | Change                                                                                                            | Reason                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 2026-05-08 | Analytics infrastructure created (`analytics_events` table, `google_rating`/`google_review_count` on restaurants) | Foundation for data-driven ranking                     |
| 2026-05-08 | `search_query` tracking added                                                                                     | Powers trending chips                                  |
| 2026-05-08 | `place_click` + `place_view` tracking added                                                                       | Powers 30-day interaction boost in search              |
| 2026-05-08 | Google rating + review count boost added to search scoring                                                        | Higher-rated places surface above equal-scored ones    |
| 2026-05-08 | Rekkus avg food rating boost added per restaurant                                                                 | Community ratings influence discovery                  |
| 2026-05-08 | Google Autocomplete food-type boost (+2.0)                                                                        | Churches, laundries, consulates rank below restaurants |

---

## Improvement backlog

### High impact

- [ ] **`post_view` tracking**: log when users open a post detail — enables trending posts for Discover feed
- [ ] **`post_save` / `post_like` tracking**: add to existing save/like handlers — strongest engagement signals per XHS research
- [ ] **Feed trending**: use `post_save` + `post_like` events last 7 days to compute top posts for Discover tab

### Medium impact

- [x] **Personalisation**: `useSearchHistory` reads per-user `search_query` events (last 30 days), maps queries to cuisine types via `CUISINE_SYNONYMS`, returns normalised affinity weights used as +1.5 score boost in `useDiscover`
- [ ] **Trending place UI**: surface `trendingPlaceIds` as a "Trending near you" section in search discovery
- [ ] **7-day rollup table**: pre-aggregate (entity_id, day, event_count) for faster trend queries as event volume grows
- [ ] **Personalisation**: use per-user `place_view` history to boost places the user has shown interest in

### Low impact / future

- [ ] **Dwell time**: track time spent on post detail / location detail (strongest signal per TikTok research)
- [ ] **Session search chains**: link consecutive `search_query` events into a session (Zomato pattern) to understand query reformulation
- [ ] **A/B infrastructure**: tag events with experiment ID to measure ranking changes
- [ ] **Search position tracking**: add `position` to `place_click` metadata to measure click-through rate by rank
- [ ] **Admin analytics view**: Supabase dashboard query presets for "top searches this week", "trending restaurants", "engagement by cuisine"
