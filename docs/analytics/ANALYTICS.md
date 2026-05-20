# Analytics — Design Reference

How Rekkus tracks user behaviour, trends, and ranking signals. Update this file when events are added, scoring weights change, or new signals are introduced.

Feature areas that read from analytics: [Search](../../product/SEARCH.md) · [Feed](../../product/FEED.md)

---

## Why analytics

Analytics is the foundation for:

- **Search ranking**: places clicked and viewed more often rank higher
- **Trending now**: real search queries and place clicks power the discovery chips
- **Feed curation**: (future) top-performing posts surface in Discover
- **Personalisation**: (future) user's own interaction history seeds recommendations

Industry reference: Yelp, Google Maps, Xiaohongshu, and Zomato all use a two-tier approach: raw event log plus aggregate read surfaces. Rekkus keeps `analytics_events` as the write log and uses bounded RPCs such as `get_recent_search_history` for app reads that would otherwise scan raw event history.

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
- Events must stay privacy-safe: do not store raw secrets, reset links, passwords, emails, phone numbers, private notes, raw provider payloads, or precise location unless a Compliance Impact explicitly approves it.
- App code must route event writes through `lib/analytics.ts`. Provider/cache infrastructure may write from approved service boundaries only. `npm run check:observability` flags direct screen/hook writes to `analytics_events`.

### Indexes

- `(entity_type, entity_id, created_at DESC)` — trending places queries
- `(event_type, created_at DESC)` — trending searches queries

### Aggregate read surfaces

- `get_recent_search_history(max_results, lookback_days)` returns the signed-in user's deduped recent search queries with count/last-searched metadata. `useSearchHistory` uses this RPC first and falls back to the raw log only while local/dev schemas catch up.

---

## Event types

| event_type                         | entity_type                    | entity_id     | metadata                                                                                             | Triggered by                                             |
| ---------------------------------- | ------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `search_query`                     | null                           | null          | `{ query, result_count, search_session_id, query_position, previous_query, radius_km, search_mode }` | User pauses typing (600ms debounce) in search tab        |
| `search_result_click`              | `post` / `restaurant` / `user` | entity id     | `{ query, result_type, result_position, search_session_id }`                                         | User taps a ranked search result                         |
| `place_click`                      | `restaurant`                   | restaurant.id | `{ query: string }`                                                                                  | User taps a place in search results                      |
| `place_view`                       | `restaurant`                   | restaurant.id | null                                                                                                 | User opens a location detail page                        |
| `post_view`                        | `post`                         | post.id       | null                                                                                                 | User opens a post detail page                            |
| `post_like`                        | `post`                         | post.id       | null                                                                                                 | User likes a post                                        |
| `post_save`                        | `post`                         | post.id       | null                                                                                                 | User saves a post                                        |
| `post_dwell`                       | `post`                         | post.id       | `{ duration_ms }`                                                                                    | User stays on a post detail page for 3s+                 |
| `post_comment`                     | `post`                         | post.id       | null                                                                                                 | User comments or replies on a post                       |
| `restaurant_revisit`               | `restaurant`                   | restaurant.id | `{ source }`                                                                                         | User opens a restaurant from saved/post context          |
| `collection_interaction`           | `collection`                   | collection.id | `{ action, filter_type, filter_id }`                                                                 | User selects collection/staff-pick/saved-intent controls |
| `feed_diagnostic`                  | null                           | null          | `{ action, feed_tab, visible_count, result_count }`                                                  | Feed view/refresh diagnostic signal                      |
| `provider_cache_hit`               | `restaurant`                   | restaurant.id | `{ provider, feature }`                                                                              | Provider cache serves a restaurant/place request         |
| `provider_cache_miss`              | `restaurant`                   | restaurant.id | `{ provider, feature }`                                                                              | Local/provider cache cannot serve a request              |
| `google_fallback_used`             | `restaurant`                   | restaurant.id | `{ feature, reason }`                                                                                | Paid Google fallback is used after local miss            |
| `provider_refresh_failed`          | `restaurant`                   | restaurant.id | `{ provider, reason }`                                                                               | Provider refresh fails or is blocked                     |
| `restaurant_observation_submitted` | `restaurant`                   | restaurant.id | `{ observation_type }`                                                                               | User/system submits a first-party restaurant fact        |
| `onboarding_step`                  | null                           | null          | `{ step, outcome, reason? }`                                                                         | Auth/onboarding flow succeeds or reaches a known state   |
| `onboarding_anomaly`               | null                           | null          | `{ step, reason }`                                                                                   | Login, signup, OAuth, or password reset fails/cools down |
| `upload_failure`                   | null                           | null          | `{ surface, reason, rejected_count? }`                                                               | Media picker validation or avatar upload fails           |
| `abuse_signal`                     | null                           | null          | `{ action, target_type, reason }`                                                                    | Report/block or moderation-adjacent user safety event    |
| `message_sent`                     | null                           | null          | `{ conversation_id, message_type, has_attachment, is_reply, is_group }` — never log body or recipient identity | User sends a message |
| `message_deleted`                  | null                           | null          | `{ conversation_id, message_type }`                                                                  | User deletes a message (true erasure)                    |
| `message_reacted`                  | null                           | null          | `{ conversation_id, emoji }`                                                                         | User reacts to a message                                 |
| `message_reaction_removed`         | null                           | null          | `{ conversation_id }`                                                                                | User removes their reaction                              |
| `message_forwarded`                | null                           | null          | `{ source_conversation_id, target_conversation_id, message_type }`                                  | User forwards a message                                  |
| `conversation_started`             | null                           | null          | `{ conversation_type }` — 'direct' or 'group'                                                       | User starts a new conversation                           |
| `group_created`                    | null                           | null          | `{ member_count }`                                                                                   | User creates a group chat                                |
| `group_member_added`               | null                           | null          | `{ conversation_id }`                                                                                | Admin adds a member to a group                           |
| `group_member_removed`             | null                           | null          | `{ conversation_id }`                                                                                | Admin removes a member from a group                      |
| `message_request_accepted`         | null                           | null          | `{ conversation_id }`                                                                                | User accepts a message request                           |
| `message_request_declined`         | null                           | null          | `{ conversation_id }`                                                                                | User declines a message request                          |
| `conversation_muted`               | null                           | null          | `{ conversation_id }`                                                                                | User mutes a conversation                                |
| `conversation_archived`            | null                           | null          | `{ conversation_id }`                                                                                | User archives a conversation                             |
| `conversation_pinned`              | null                           | null          | `{ conversation_id }`                                                                                | User pins a conversation to top of inbox                 |
| `message_pinned`                   | null                           | null          | `{ conversation_id }`                                                                                | User pins a message within a conversation                |
| `media_upload_completed`           | null                           | null          | `{ message_type, size_kb }` — never log URL or content                                              | Media attachment upload succeeds                         |
| `media_upload_failed`              | null                           | null          | `{ message_type, reason }`                                                                           | Media attachment upload fails                            |
| `csam_blocked`                     | null                           | null          | `{ message_type }` — no user-identifying fields                                                     | CSAM hash match blocks a message send                    |
| `post_shared_via_dm`               | `post`                         | post.id       | `{ conversation_id }`                                                                                | User shares a post via DM                                |
| `place_shared_via_dm`              | `restaurant`                   | restaurant.id | `{ conversation_id }`                                                                                | User shares a place via DM                               |
| `media_selected`                   | null                           | null          | `{ surface, media_type, media_count }`                                                               | User selects post media                                  |
| `media_prepare_started`            | null                           | null          | `{ surface, media_type, media_count }`                                                               | Client begins post media preparation                     |
| `media_prepare_completed`          | null                           | null          | `{ surface, media_type, media_count }`                                                               | Client finishes post media preparation                   |
| `media_prepare_failed`             | null                           | null          | `{ surface, media_type }`                                                                            | Client media preparation fails                           |
| `post_upload_started`              | null                           | null          | `{ surface, media_count }`                                                                           | Create-post publish queue starts                         |
| `post_upload_progress`             | null                           | null          | `{ surface, progress }`                                                                              | Publish progress changes                                 |
| `post_upload_failed`               | null                           | null          | `{ surface, reason }`                                                                                | Publish queue fails                                      |
| `post_published`                   | `post`                         | post.id       | `{ media_count }`                                                                                    | Post publish succeeds                                    |
| `draft_created`                    | null                           | null          | `{ surface }`                                                                                        | Create draft is saved                                    |
| `draft_resumed`                    | null                           | null          | `{ surface }`                                                                                        | User resumes a draft                                     |
| `draft_deleted`                    | null                           | null          | `{ surface }`                                                                                        | User deletes a draft                                     |
| `search_filter_applied`            | null                           | null          | `{ filter_type, filter_id }`                                                                         | Search filter is applied                                 |
| `search_filter_removed`            | null                           | null          | `{ filter_type, filter_id }`                                                                         | Search filter is removed                                 |
| `rekkus_pick_selected`             | null                           | null          | `{ filter_type, filter_id }`                                                                         | User selects a Taste, Value, or Occasion pick            |
| `dish_tag_added`                   | null                           | null          | `{ surface }`                                                                                        | User adds a photo dish tag                               |
| `create_launcher`                  | null                           | null          | `{ action }`                                                                                         | User opens or chooses from the global Create launcher    |
| `post_edit`                        | `post`                         | post.id       | `{ action, changed_field_count }`                                                                    | User starts/saves/discards post edits                    |
| `post_share`                       | `post`                         | post.id       | `{ share_target }`                                                                                   | User shares a post through an in-app surface             |
| `modal_action`                     | null                           | null          | `{ modal_id, option_id }`                                                                            | User chooses a non-sensitive modal action                |
| `action_error`                     | null                           | null          | `{ action, error_class }`                                                                            | Recoverable app action fails                             |

Events are **fire-and-forget** — tracked with `.then(() => {})` and never block navigation or UI.

> **Messaging privacy rule**: Message body, sender identity, and recipient identity must never appear in analytics event payloads. Use `conversation_id` as the only linking key.
> **Comment privacy rule**: Comment text must not appear in analytics, push notifications, or alert summaries. UI alerts say that someone commented or replied, then route users to the post/comment context.

---

## Where events are tracked

| File                                            | Event                                                                                     | When                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `features/search/SearchScreen.tsx`              | `search_query`, `search_result_click`, `place_click`, `collection_interaction`            | Query debounces, user taps search results, or opens staff picks |
| `features/feed/FeedScreen.tsx`                  | `feed_diagnostic`                                                                         | Feed tab view and refresh diagnostics                           |
| `features/posts/PostDetailScreen.tsx`           | `post_view`, `post_like`, `post_save`, `post_dwell`, `post_comment`, `restaurant_revisit` | Post detail engagement and restaurant revisit signals           |
| `features/posts/PostDetailScreen.tsx`           | `post_edit`, `post_share`                                                                    | Owner edit entry and privacy-safe sharing target                |
| `lib/contexts/CreateLauncherContext.tsx`        | `create_launcher`                                                                            | Global create launcher open and choice                          |
| `features/restaurants/RestaurantsTabScreen.tsx` | `collection_interaction`                                                                  | Places filter and saved-intent status changes                   |
| `app/restaurants/[restaurantId]/index.tsx`      | `place_view`                                                                              | Location detail loads, user is logged in                        |
| `features/auth/SignupProfileScreen.tsx`         | `onboarding_step`                                                                         | Interest onboarding completes                                   |
| `lib/contexts/AuthContext.tsx`                  | `onboarding_step`, `onboarding_anomaly`                                                   | Auth actions succeed, fail, or cool down                        |
| `components/post-create/StepMedia.tsx`          | `upload_failure`                                                                          | Post media picker rejects invalid assets                        |
| `lib/services/postMediaProcessing.ts`           | `media_prepare_started`, `media_prepare_completed`, `media_prepare_failed`                | Post media preparation and compression lifecycle                |
| `lib/contexts/PostUploadContext.tsx`            | `post_upload_started`, `post_upload_progress`, `post_upload_failed`, `post_published`     | Background post publish queue                                   |
| `features/settings/EditProfileScreen.tsx`       | `upload_failure`                                                                          | Avatar validation or storage upload fails                       |
| `lib/services/moderation.ts`                    | `abuse_signal`                                                                            | User reports, blocks, or unblocks a target                      |

---

## How analytics feeds search ranking

`useSearch` fetches 30-day `place_click` + `place_view` counts per restaurant alongside every search. These are added as a scoring boost:

| 30-day interactions | Score boost |
| ------------------- | ----------- |
| ≥ 50                | +1.5        |
| ≥ 20                | +0.8        |
| ≥ 5                 | +0.4        |
| ≥ 1                 | +0.2        |

A place that people actively click on ranks higher than an equally-named place nobody clicks on — mirrors Google Maps' "prominence" signal.

---

## How analytics feeds trending

`useTrendingData` hook:

- Reads `trending_searches` → `trendingSearches: string[]` (top 6 aggregate queries)
- Tallies 7-day `place_click` events → `trendingPlaceIds: string[]` (top 10 restaurants)
- Tallies 7-day `post_view`, `post_like`, `post_save`, and `post_dwell` events → `trendingPostIds: string[]`

`search.tsx` uses aggregate `trendingSearches` to power the "Trending now" chip row. Falls back to hardcoded chips when no real data exists (new app, no users yet).

Discover uses `trendingPostIds` as an additive deterministic boost. Future: `trendingPlaceIds` will power a "Trending places" section in Discover.

---

## Cached signals on `restaurants` table

Two legacy columns are populated lazily from Google Places Details API — cached on first location detail view. New provider snapshots should use `restaurant_provider_cache` with source, retention, attribution, and freshness metadata; Rekkus-owned signals should remain primary.

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
            + rekkus_avg_rating   ← avg Rekkus-owned rating from linked posts
            + saved_place_boost    ← signed-in user's saved restaurants / cuisines
            + google_rating        ← provider-derived legacy boost
            + google_review_volume ← provider-derived legacy boost
            + trending_30d_boost   ← place_click + place_view events last 30 days
            + food_type_boost      ← +2.0 if Google Autocomplete types = food/restaurant
```

Higher score = appears earlier in results. Nothing is hard-excluded.

---

## Tuning log

| Date       | Change                                                                                                                                                                   | Reason                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 2026-05-08 | Analytics infrastructure created (`analytics_events` table, `google_rating`/`google_review_count` on restaurants)                                                        | Foundation for data-driven ranking                           |
| 2026-05-08 | `search_query` tracking added                                                                                                                                            | Powers trending chips                                        |
| 2026-05-08 | `place_click` + `place_view` tracking added                                                                                                                              | Powers 30-day interaction boost in search                    |
| 2026-05-08 | Google rating + review count boost added to search scoring                                                                                                               | Higher-rated places surface above equal-scored ones          |
| 2026-05-08 | Rekkus avg food rating boost added per restaurant                                                                                                                        | Community ratings influence discovery                        |
| 2026-05-08 | Google Autocomplete food-type boost (+2.0)                                                                                                                               | Churches, laundries, consulates rank below restaurants       |
| 2026-05-12 | Post, dwell, search-position, collection, revisit, and feed diagnostic events shipped                                                                                    | Ranking and retention diagnostics for V1 feed work           |
| 2026-05-12 | Search query chains now include previous query, mode, and selected radius; search ranking adds bounded saved-place personalization and reduced interaction boost weights | Better diagnostics and less popularity-heavy local discovery |

---

→ See [../../BACKLOG.md](../../BACKLOG.md) for all outstanding work.
