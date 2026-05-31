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
| `event_version` | INTEGER        | Schema version for this event shape  |
| `entity_type` | TEXT (nullable)  | `'restaurant'` / `'post'` / `'user'` / `'collection'` / `'dish'` |
| `entity_id`   | UUID (nullable)  | ID of the entity being acted on      |
| `metadata`    | JSONB (nullable) | Flexible extra data per event type   |
| `created_at`  | TIMESTAMPTZ      | Event timestamp                      |

### RLS policy

- Authenticated users can insert their own events (`auth.uid() = user_id`)
- All rows are publicly readable for aggregate trend queries
- Events must stay privacy-safe: do not store raw secrets, reset links, passwords, emails, phone numbers, private notes, raw provider payloads, or precise location unless a Compliance Impact explicitly approves it.
- App code must route event writes through `lib/analytics.ts`. Provider/cache infrastructure may write from approved service boundaries only. `npm run check:observability` flags direct screen/hook writes to `analytics_events`.
- `event_version` defaults to `1`. Increment it only when the meaning or metadata shape of an existing `event_type` changes in a way that historical queries must distinguish.
- `sampleRate` is allowed only at the `lib/analytics.ts` boundary. High-volume diagnostic events may sample below `1.0`; product-critical conversion, safety, auth, upload failure, and moderation events must not be sampled.
- Raw user-linked `analytics_events` rows are retained for 90 days, then deleted by the `analytics-retention` Edge Function. Longer-lived trend/search surfaces must use aggregate or de-identified rows, not raw event history.

### Indexes

- `(entity_type, entity_id, created_at DESC)` — trending places queries
- `(event_type, created_at DESC)` — trending searches queries

### Aggregate read surfaces

- `get_recent_search_history(max_results, lookback_days)` returns the signed-in user's deduped recent search queries with count/last-searched metadata. `useSearchHistory` uses this RPC first and falls back to the raw log only while local/dev schemas catch up; its local cuisine affinities also power contextual discovery quick starts without adding a new event.

---

## Event types

| event_type                         | entity_type                    | entity_id     | metadata                                                                                             | Triggered by                                             |
| ---------------------------------- | ------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `search_query`                     | null                           | null          | `{ query, result_count, search_session_id, query_position, previous_query, radius_km, search_mode, near_city? }` | User pauses typing (600ms debounce) in search tab        |
| `search_result_click`              | `post` / `restaurant` / `user` / `dish` | entity id     | `{ query, result_type, result_position, search_session_id }`                                         | User taps a ranked search result (dish = canonical Dish entity card) |
| `search_session_end`               | null                           | null          | `{ search_session_id, session_duration_ms, had_results, result_clicked, query? }`                    | SearchScreen loses focus or unmounts after a session     |
| `search_abandon`                   | null                           | null          | `{ query, result_count, session_duration_ms, search_session_id }`                                    | Session ends with non-empty query and no result click    |
| `no_results_shown`                 | null                           | null          | `{ query, suggestion_queries }`                                                                      | Search shows the no-results recovery surface             |
| `no_results_suggestion_click`      | null                           | null          | `{ query, selected_query, position }`                                                                | User taps a no-results suggestion chip                   |
| `place_click`                      | `restaurant`                   | restaurant.id | `{ query: string }`                                                                                  | User taps a place in search results                      |
| `place_view`                       | `restaurant`                   | restaurant.id | `{ cuisine_type? }`                                                                                  | User opens a location detail page                        |
| `place_save`                       | `restaurant`                   | restaurant.id | `{ cuisine_type? }`                                                                                  | User saves a location                                    |
| `post_view`                        | `post`                         | post.id       | `{ cuisine_type? }`                                                                                  | User opens a post detail page                            |
| `post_like`                        | `post`                         | post.id       | null                                                                                                 | User likes a post                                        |
| `post_save`                        | `post`                         | post.id       | `{ cuisine_type? }`                                                                                  | User saves a post                                        |
| `dish_view`                        | `dish`                         | dish.id       | null                                                                                                 | User opens a canonical dish detail page                  |
| `dish_save`                        | `dish`                         | dish.id       | null                                                                                                 | User bookmarks a canonical dish                          |
| `post_dwell`                       | `post`                         | post.id       | `{ duration_ms }`                                                                                    | User stays on a post detail page for 3s+                 |
| `post_comment`                     | `post`                         | post.id       | null                                                                                                 | User comments or replies on a post                       |
| `restaurant_revisit`               | `restaurant`                   | restaurant.id | `{ source }`                                                                                         | User opens a restaurant from saved/post context          |
| `collection_interaction`           | `collection`                   | collection.id | `{ action, target_type, filter_type, filter_id }`                                                    | User creates/changes collections or selects saved filters |
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
| `offline_mutation_sync`            | null                           | null          | `{ mutation_kind, outcome }`                                                                         | Reversible intent queued, synced, or failed after reconnect |
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
| `create_post_funnel`               | null                           | null          | `{ step (1–3), outcome ('viewed'\|'completed'\|'abandoned'), duration_ms?, session_duration_ms?, reason? }` — `session_duration_ms` present on step-3 completion only; measures total time from flow entry to publish | Step viewed, completed, or abandoned in the create-post flow |
| `interaction_rage_tap`             | null                           | null          | `{ surface, action, step, tap_count }` — sampled 0.5                                                | ≥3 rapid taps on same element within 1 s (rage proxy)   |
| `interaction_dead_click`           | null                           | null          | `{ surface, action, step }` — sampled 0.5                                                           | Tap on a disabled interactive element                    |

Events are **fire-and-forget** — tracked with `.then(() => {})` and never block navigation or UI.

`feed_diagnostic` is sampled at 10% because it can become high-volume at scale and is used for operational trend shape, not per-user product truth.

> **Messaging privacy rule**: Message body, sender identity, and recipient identity must never appear in analytics event payloads. Use `conversation_id` as the only linking key.
> **Comment privacy rule**: Comment text must not appear in analytics, push notifications, or alert summaries. UI alerts say that someone commented or replied, then route users to the post/comment context.

---

## Where events are tracked

| File                                            | Event                                                                                     | When                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `features/search/SearchScreen.tsx`              | `search_query`, `search_result_click`, `place_click`, `collection_interaction`, `no_results_shown`, `no_results_suggestion_click` | Query debounces, user taps search results/staff picks, or uses no-results recovery |
| `features/search/SearchScreen.tsx`              | `search_session_end`, `search_abandon`                                                    | Session ends on focus loss or unmount (B-538, B-539)            |
| `features/feed/FeedScreen.tsx`                  | `feed_diagnostic`                                                                         | Feed tab view and refresh diagnostics                           |
| `features/posts/PostDetailScreen.tsx`           | `post_view`, `post_like`, `post_save`, `post_dwell`, `post_comment`, `restaurant_revisit` | Post detail engagement and restaurant revisit signals           |
| `features/posts/PostDetailScreen.tsx`           | `post_edit`, `post_share`                                                                    | Owner edit entry and privacy-safe sharing target                |
| `lib/contexts/CreateLauncherContext.tsx`        | `create_launcher`                                                                            | Global create launcher open and choice                          |
| `features/restaurants/RestaurantsTabScreen.tsx` | `collection_interaction`                                                                  | Places filter and saved-intent status changes                   |
| `features/restaurants/RestaurantDetailScreen.tsx` | `place_view`, `place_save`                                                              | Location detail loads or user saves a location                  |
| `features/auth/SignupProfileScreen.tsx`         | `onboarding_step`                                                                         | Interest onboarding completes                                   |
| `lib/contexts/AuthContext.tsx`                  | `onboarding_step`, `onboarding_anomaly`                                                   | Auth actions succeed, fail, or cool down                        |
| `components/post-create/StepMedia.tsx`          | `upload_failure`                                                                          | Post media picker rejects invalid assets                        |
| `features/create-post/CreatePostScreen.tsx`     | `create_post_funnel`, `interaction_rage_tap`, `interaction_dead_click`                    | Step transitions, rage-tap on Next, dead-click on disabled Next |
| `lib/services/postMediaProcessing.ts`           | `media_prepare_started`, `media_prepare_completed`, `media_prepare_failed`                | Post media preparation and compression lifecycle                |
| `lib/contexts/PostUploadContext.tsx`            | `post_upload_started`, `post_upload_progress`, `post_upload_failed`, `post_published`     | Background post publish queue                                   |
| `features/settings/EditProfileScreen.tsx`       | `upload_failure`                                                                          | Avatar validation or storage upload fails                       |
| `lib/services/moderation.ts`                    | `abuse_signal`                                                                            | User reports, blocks, or unblocks a target                      |
| `lib/contexts/ConnectivityContext.tsx`          | `offline_mutation_sync`                                                                  | Reversible writes queue or replay without payload content       |

### Offline mutation telemetry ban list

`offline_mutation_sync` events must contain only: `userId` (anonymised per analytics config), `mutation_kind` (short enum string, e.g. `post_like`), and `outcome` (`queued` | `synced` | `sync_failed`). The following are explicitly banned from this event and from all offline-queue-related analytics:

- Message body or any text authored by a user
- Post captions, media URLs, or content metadata
- Profile values (username, bio, display name)
- Collection names
- Report or moderation content
- Any value longer than 100 characters

These restrictions are enforced by the `sanitizeAnalyticsMetadata` allowlist in `lib/analytics.ts`. The `offlineMutation` call site in `ConnectivityContext` passes only enum-bounded string arguments.

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

- Reads `trending_searches` by `near_city`, falling back to `global` below 4 local rows → `trendingSearches: string[]` (top 6 aggregate queries)
- Tallies 7-day `place_click` events by restaurant city, falling back to global below 4 local rows → `trendingPlaceIds: string[]` (top 10 restaurants)
- Tallies 7-day `post_view`, `post_like`, `post_save`, and `post_dwell` events → `trendingPostIds: string[]`

`SearchScreen.tsx` uses aggregate `trendingSearches` to power the "Trending now" chip row and live popular place rows for "Food spots people save." It falls back to hardcoded/demo discovery content when no real data exists (new app, no users yet).

Discover uses `trendingPostIds` as an additive deterministic boost.

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

## Analytics events vs. platform audit events

These two systems are **strictly separate** and serve different purposes:

| Dimension | `analytics_events` | Audit tables + `platform_audit_events_view` |
|---|---|---|
| Purpose | Behavioural signals for ranking, trending, product features | Compliance evidence, incident investigation, ISO readiness |
| Retention | 90 days (auto-deleted by `analytics-retention` Edge Function) | Permanent — no retention job touches audit tables |
| Access | Public read for aggregates; authenticated insert own rows | Service-role only (source-table RLS blocks client access) |
| Write path | Direct client INSERT via `analytics.track()` | `SECURITY DEFINER` RPC only (`record_auth_audit_event`, `record_content_lifecycle_event`, etc.) |
| Append-only | No (rows can be superseded via retention job) | Yes — no UPDATE/DELETE policies on any audit table |
| Example | `post_like`, `search_query`, `post_view` | `login_email_success`, `post_deleted`, `dish_created` |

**Never use `analytics_events` as a compliance source.** Auth events stored there have 90-day auto-deletion and are insufficient for ISO A.12.4.1.

### Audit tables unified in `platform_audit_events_view`

| Source table | Domain |
|---|---|
| `auth_audit_events` | Authentication lifecycle (ISO A.12.4.1) |
| `content_lifecycle_events` | Post/comment creation and deletion |
| `dish_audit_events` | Dish graph changes |
| `moderation_actions` | Content moderation (hide, ban, restore, warn) |
| `post_edit_events` | Post edit lifecycle (field names only, never content) |
| `restaurant_audit_events` | Restaurant compliance and data-quality events |

Query the view via service-role for cross-domain incident investigation. See [ADR 0011](../../docs/adr/0011-unified-audit-view.md).

---

## Search observability queries

Run these in the Supabase SQL editor (service-role) to answer the four key search quality questions. All queries require `search_session_end` events (B-538).

```sql
-- 1. Daily zero-result rate (last 30 days)
SELECT
  date_trunc('day', created_at) AS day,
  ROUND(COUNT(*) FILTER (WHERE NOT (metadata->>'had_results')::boolean) * 100.0 / COUNT(*), 1) AS zero_result_pct,
  COUNT(*) AS total_sessions
FROM analytics_events
WHERE event_type = 'search_session_end'
  AND created_at > now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;

-- 2. Top zero-result queries (last 30 days)
SELECT
  metadata->>'query' AS query,
  COUNT(*) AS zero_result_sessions
FROM analytics_events
WHERE event_type = 'search_session_end'
  AND (metadata->>'had_results')::boolean = false
  AND metadata->>'query' IS NOT NULL
  AND created_at > now() - interval '30 days'
GROUP BY 1
ORDER BY 2 DESC
LIMIT 20;

-- 3. P50 / P95 session duration (proxy for search latency, last 30 days)
SELECT
  date_trunc('day', created_at) AS day,
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY (metadata->>'session_duration_ms')::int) AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (metadata->>'session_duration_ms')::int) AS p95_ms
FROM analytics_events
WHERE event_type = 'search_session_end'
  AND created_at > now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;

-- 4. Search-to-click conversion and abandonment rate (last 30 days)
SELECT
  date_trunc('day', created_at) AS day,
  ROUND(COUNT(*) FILTER (WHERE (metadata->>'result_clicked')::boolean)
    * 100.0 / NULLIF(COUNT(*), 0), 1) AS click_rate_pct,
  ROUND(COUNT(*) FILTER (
      WHERE NOT (metadata->>'result_clicked')::boolean
        AND (metadata->>'had_results')::boolean)
    * 100.0 / NULLIF(COUNT(*), 0), 1) AS abandonment_pct
FROM analytics_events
WHERE event_type = 'search_session_end'
  AND metadata->>'query' IS NOT NULL
  AND created_at > now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

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
| 2026-05-30 | UX quality signals shipped: `interaction_rage_tap`, `interaction_dead_click`, `create_post_funnel` (B-241). Added `session_duration_ms` to step-3 completion for time-to-first-post signal | Enables data-driven UX regression detection for the create-post flow |
| 2026-05-31 | `search_session_end` and `search_abandon` events added (B-538, B-539)                                                                                                    | Unblocks zero-result rate, abandonment, and session duration observability |
| 2026-06-01 | `search_query.near_city` and city-partitioned trending reads added (B-550)                                                                                               | Keeps discovery trends local while preserving global fallback for sparse city data |
| 2026-06-01 | `no_results_shown` / `no_results_suggestion_click` added; post/place view/save events can include `cuisine_type` (B-555)                                                | Measures dead-end search recovery and seeds engagement-derived cuisine affinities |

---

→ See [../../BACKLOG.md](../../BACKLOG.md) for all outstanding work.
