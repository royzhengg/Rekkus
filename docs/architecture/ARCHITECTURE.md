# Rekkus — Architecture Reference

How the codebase is structured, what each layer does, and where things live. Update when a new layer, integration, or migration is added.

Source-of-truth ownership and engineering constraints live in [ENGINEERING_GOVERNANCE.md](ENGINEERING_GOVERNANCE.md). Canonical entity and audit rules live in [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md). Naming rules live in [NAMING.md](NAMING.md), and mobile performance rules live in [PERFORMANCE.md](PERFORMANCE.md).

---

## Stack

| Layer      | Technology                                 |
| ---------- | ------------------------------------------ |
| Framework  | React Native + Expo (SDK 54)               |
| Platforms  | iOS + Android first-class; web best-effort |
| Router     | Expo Router (file-based)                   |
| Language   | TypeScript (strict)                        |
| Backend    | Supabase (Postgres + Auth + Storage + RLS) |
| Email      | Resend (production SMTP only)              |
| Maps       | Google Maps (`react-native-maps` 1.27.2)   |
| Places API | Google Places REST (no library)            |
| Analytics  | Supabase `analytics_events` with event versioning, sampling, and 90-day raw retention |
| Crash/error reporting | Sentry React Native for Expo/EAS source maps |
| Feature flags | Code defaults in `lib/featureFlags.ts` plus Supabase emergency overrides |
| Animations | `react-native-reanimated`                  |
| Images     | `expo-image-picker`                        |
| Media library | `expo-media-library` (recent photo strip for create-post Step 1) |
| Media prep | `react-native-compressor` + Supabase Edge Function orchestration |
| Local DB   | `expo-sqlite` (session persistence)        |
| Connectivity | `expo-network` + device-local pending-intent replay |

---

## Project structure

```
app/                  Expo Router screens — orchestration only
  (auth)/             Auth flow screens
  (tabs)/             Tab bar screens
  create/             Create-post modal route group (root modal; index + drafts)
  places/             Place detail + map routes
  posts/              Post detail routes
  settings/           Settings screens
  user/               Other user profiles

features/             Product-area screen implementations
  auth/               Auth screens
  create-post/        Create post flow
  feed/               Feed and alerts
  posts/              Post detail
  profile/            Own and public profile screens
  places/             Places tab, place detail, place map
  search/             Search screens
  settings/           Settings screens

components/           Feature-level shared UI
  ui/                 Primitive design library (zero business logic)
  icons.tsx           All SVG icons (single source of truth)
  post-create/        Wizard step components (StepMedia, StepDetails, StepReview)

lib/                  App logic layer
  contexts/           React providers
  hooks/              Custom React hooks
  search/             Neutral search context, candidates, and retrieval pipeline
  services/           Supabase API wrappers (posts.ts, users.ts, comments.ts, places.ts)
    places/           Sub-modules: google.ts (API wrappers), cache.ts (provider cache), analytics.ts (ratings/popularity), governance.ts (audit/edit)
    messaging/        Sub-modules: conversations, messages, participants, guards, types, activity
    posts/            Sub-modules: queries, mutations, social, guards, types
  mocks/              Local/demo data only
  utils/              Pure helpers (format.ts, geo.ts)
  analytics.ts        Analytics abstraction (versioning, sampling, privacy-safe writes)
  featureFlags.ts     Feature flag checks (isEnabled) + override refresh
  config.ts           Env vars — single source of truth (never raw process.env in screens)
  supabase.ts         Typed Supabase client
  routes/             Typed route builder functions (postDetail, placeDetail, userProfile, conversation, search, createPost, etc.)

constants/
  Colors.ts           Colour tokens (lightColors, darkColors, imgColors)
  Typography.ts       Font scale (fontSize, fontWeight, lineHeight)
  Spacing.ts          Spacing + radius scale

types/
  domain.ts           App-facing domain types
  database.ts         Supabase-generated types (all tables)

supabase/
  migrations/         Ordered SQL migrations (applied via `supabase db push`)
  functions/          Edge functions (e.g. send-push)
```

## Post Media Pipeline

Post media is modeled as ordered mixed media while keeping the physical `post_photos` table name for compatibility. `post_photos` stores photo/video type, original/processed/thumbnail URLs, MIME, dimensions, duration, size, and processing status. `posts` stores Rekkus Picks fields: `taste_verdict`, `value_verdict`, and `occasion_tags`.

Client selection flows through `lib/services/media.ts` for validation and `lib/services/postMediaProcessing.ts` for on-device compression/metadata preparation. Server fallback starts at `supabase/functions/process-post-media`; the function is intentionally an orchestrator so a dedicated media worker can replace the implementation without changing app-facing types. Rollout flags live in `lib/featureFlags.ts`: `mixedMediaPosts`, `hybridMediaProcessing`, `rekkusPicks`, `searchFiltersV2`, and `draftList`.

Create drafts are account-synced through `post_drafts`, `post_draft_media`, and `lib/services/postDrafts.ts`. Explicit **Save** stores `status='saved'` rows and private media in the `post-drafts` bucket from any create step; saved draft editing can either update the current draft or branch via **Save as new draft**. The floating Create action opens the app-wide `CreateLauncherProvider` over the current screen while the tab bar remains destination-only; with saved drafts it offers **New post** or **Edit a draft** only, and draft rows stay inside `/create/drafts`. Background autosave stores `status='autosave'` rows for recovery and stays out of the visible Drafts list. AsyncStorage remains a migration/recovery cache for older local drafts. The app-wide `PostUploadProvider` tracks preparation/upload/publish progress so the feed can show non-blocking publish state.

`ConnectivityProvider`, mounted below `AuthProvider`, owns connectivity status and the device-local pending-intent queue. Phase 1 scope (reversible latest-state intents): `post_save`, `dish_save`, `place_save`, `post_like`, `follow`, `setting`. Phase 2 mutations (message reactions, conversation prefs) are deferred to B-239b and fall back to a `requireOnline()` gate. Records are versioned, strictly validated, coalesced by user/domain/entity, and contain only user/entity identifiers, target state, and timestamps. Authored, destructive, safety, account, group membership, and publishing submissions never auto-replay; their screens keep user input available and show explicit reconnect guidance through `ErrorMessage` or an actionable sheet. `ConnectivityNotice` is the canonical app-wide pending/sync status surface.

**Queue state machine:** `idle → queued → replaying → synced | permanent_failure | retryable_kept`. Entries are pruned at read time if older than 7 days or have exceeded `MAX_RETRY_COUNT` (5) attempts. The queue is capped at 50 entries; new enqueues beyond that throw `offline_queue_full`. Coalescing is in-place (FIFO order preserved). On `writeDeferredMutations` failure (storage quota), an analytics event is emitted and the error is rethrown so callers can surface it.

**Connectivity states:** `checking` (initial / indeterminate) → `online` (device + internet reachable) → `offline` (no connectivity) → `degraded` (device online but 3+ consecutive retryable flush failures; resets on next network event). `requireOnline()` returns `true` for `checking`, `online`, and `degraded`; only `offline` blocks user-initiated writes that cannot queue.

**Flush guards:** flush exits early if: (a) no authenticated user, (b) state is not `online`, (c) `flushingRef` is already set (concurrent call prevention), or (d) `getSession()` returns null (session expired). Mutations whose `userId` differs from the current user are skipped within the loop (mid-flush sign-out protection).

**Optimistic state lifecycle:** `applied (optimistic) → { queued: true } → syncEpoch increment → hook re-fetch → server_confirmed | rolled_back`. When `runDeferredMutation` resolves with `{ queued: true }`, optimistic state is kept and reconciled on the next `syncEpoch` increment. When it throws (non-retryable), the caller must revert local state immediately. Rollback ownership: the component that applied optimistic state holds `previousState` and reverts on catch.

**Cache invalidation:** `syncEpoch` (integer, zero-based) increments after every flush (success or partial) when `pending.length > 0`. Data hooks (`useSavedPosts`, `useLikedPosts`) subscribe to `syncEpoch` from `useConnectivity()` and re-fetch when it changes, reconciling stale optimistic state with server truth.

**Failure classification:** retryable = transport-like errors matching `/network|fetch|offline|timeout|timed out|connection|socket/i`; permanent = all others (auth, validation, 4xx). Permanent failures remove the mutation from the queue immediately. Retryable failures increment `retryCount`; at `MAX_RETRY_COUNT` the mutation is also dropped and treated as permanent failure.

Owner-only post editing reuses the Create composer via `intent='edit'` and `postId`. Saves update the same `posts.id`, bump `posts.edit_count`, set `posts.last_edited_at`, and write a minimized `post_edit_events` row containing changed field names/count only. Edit audit rows must never store captions, media URLs, place names, full addresses, or before/after content.

## Platform support

`app.config.js` is the source of truth for native identity and platform config:

- App name: `Rekkus`
- Scheme: `rekkus`
- iOS bundle identifier: `com.anonymous.rekkus`
- Android package: `com.anonymous.rekkus`

Keep iOS and Android supported together. Before release or native config changes, run `npm run check:platform` and verify no duplicate Expo Router route files or stale native backup folders with names like `* 2*` / `* 3*` are present under `app/`, `android/`, or `ios/`.

## Route naming

Canonical routes use plural domain names:

- Create composer route (root modal, not a destination tab): `/create`
- Saved tab implementation: `/(tabs)/saved`, with `section=places` hosting the existing places list/map surface
- Post detail: `/posts/[postId]`
- Dish detail: `/dishes/[dishId]`
- Collection detail: `/collections/[collectionId]`
- Place detail: `/places/[placeId]`
- Place map: `/places/[placeId]/map`

Legacy `/post/[id]`, `/location/[placeId]`, `/restaurants/[restaurantId]`, `/(tabs)/post`, `/(tabs)/places`, and `/(tabs)/restaurants` routes are redirect wrappers only.

All dynamic route construction must go through typed helpers in `lib/routes/`. Never construct routes as raw strings or inline `{ pathname, params }` objects in `features/` or `components/` — a rename or param change silently breaks navigation otherwise. See B-504.

## Data modes

`EXPO_PUBLIC_DATA_MODE` controls runtime data:

- `mock`: demo data only
- `mixed`: demo + live data for local development
- `live`: Supabase + Google only

Beta and production must use `live`. Mock data lives in `lib/mocks` and must not be imported directly from `app/` or `features/`.

## Direct Messaging

Direct messaging is live (`directMessages: enabled: true`), supporting 1:1 and group conversations with rich media, reactions, typing indicators, message requests, and conversation management.

### Message type system

All messages carry a `message_type` column. Current types: `text`, `image`, `video`, `audio`, `gif`, `location`, `post_share`, `place_share`, `sticker`, `file`, `system`. Rich content stored in `attachment_url` (Supabase Storage) and `attachment_metadata` (jsonb). Adding a new type requires only: a new enum value in the DB check constraint, a new render branch in ConversationScreen, and (if file-based) CSAM scanning in the Edge Function.

### Tables

`conversations`, `conversation_participants`, `messages`, `message_reactions`, `message_deliveries`, `conversation_pinned_messages`.

### Storage

Bucket: `message-attachments` (private). Path: `{conversation_id}/{sender_id}/{timestamp}_{filename}`. RLS: participants read; sender uploads to own prefix. Files purged on message delete and on account delete.

### Realtime

- Message delivery: `postgres_changes` INSERT on `messages` filtered by `conversation_id`
- Reactions: `postgres_changes` INSERT/DELETE on `message_reactions` filtered by `conversation_id`
- Typing indicators: Supabase Realtime Presence on `conversation:{id}` channel
- Unread badge: `postgres_changes` on `messages` and `conversation_participants` — aggregated in `useUnreadMessageCount` hook

### Content moderation

All media passes through the `moderate-content` Edge Function before the message record is created. Text is checked inline. See [../moderation/MODERATION_OPERATIONS.md](../moderation/MODERATION_OPERATIONS.md) for the full flow.

### Message requests

Requests are participant-scoped. If the recipient does not follow the sender, that recipient's `conversation_participants.request_status` is `request`; active participants keep `request_status='active'`.

- Direct conversations still keep `conversations.status='request'` for compatibility until accepted, but inbox membership is determined by the current participant row.
- Group conversations can be active for trusted members while non-following invitees see the same group in Message Requests.
- Accepting promotes only the current participant to active. Declining marks only the current participant declined; direct declines also block the 1:1 conversation.
- The main Messages inbox reads active, non-archived participant rows. Requests are listed by `/messages/requests`; archives by `/messages/archived`.

### Group conversations

`conversation_type='group'` with `name`, `avatar_url`, `is_admin`, and per-member `request_status` on `conversation_participants`. All group mutations (create, add/remove member, promote admin) go through security-definer RPCs — never direct table inserts.

### Service boundary

- Service layer: `lib/services/messaging.ts`, `lib/services/messageAttachments.ts`
- Screens: `features/messages/` (ConversationScreen, MessagesListScreen, MessageRequestsScreen, ConversationInfoScreen, CreateGroupScreen)
- Routes: `app/messages/[conversationId].tsx`, `app/messages/index.tsx`, `app/messages/requests.tsx`, `app/messages/archived.tsx`, `app/messages/new-group.tsx`, `app/messages/info.tsx`
- Product owner: [../../product/MESSAGING.md](../../product/MESSAGING.md)
- Screens must not query messaging tables directly; all reads/writes go through service helpers

## Security and release

Security controls live in [../security/SECURITY.md](../security/SECURITY.md). Environment promotion and release gates live in [../../operations/RELEASE.md](../../operations/RELEASE.md). Day-to-day workspace hygiene lives in [../../CONTRIBUTING.md](../../CONTRIBUTING.md).

### Placement rules

| What                            | Where              |
| ------------------------------- | ------------------ |
| Generic UI, zero business logic | `components/ui/`   |
| Feature-level shared component  | `components/`      |
| Custom hook                     | `lib/hooks/`       |
| Pure function                   | `lib/utils/`       |
| Search context/candidate pipeline | `lib/search/`      |
| Supabase API call               | `lib/services/`    |
| Env variable                    | `lib/config.ts`    |
| Analytics call                  | `lib/analytics.ts` |

Contexts and hooks own React lifecycle/state orchestration only. Supabase reads, writes, auth subscriptions, and provider-owned types are exposed through typed `lib/services/` contracts.
| Colour / font / spacing token   | `constants/`       |

---

## Contexts (provider stack order)

Mounted in `app/_layout.tsx` from outermost to innermost:

1. `ThemeProvider` — resolves colour scheme
2. `AuthProvider` — Supabase session + user
3. `AuthGateProvider` — soft gate modal
4. `PostsProvider` — in-memory post feed
5. `SettingsProvider` — user settings

---

## Data layer

### Supabase tables

The canonical food-establishment entity is `places` (renamed from `restaurants` in migration `20260614000001`). All `restaurant_*` prefixed infra tables (`restaurant_sources`, `restaurant_provider_cache`, `restaurant_observations`, `restaurant_aliases`, `restaurant_audit_events`, `restaurant_ownership_events`, `restaurant_merge_events`) retain their original names — they are immutable audit/compliance tables whose `restaurant_` prefix reflects historical naming.

| Table                         | Purpose                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `users`                       | Profiles (username, bio, suburb, city, country)                                                |
| `posts`                       | Posts (caption, ratings, cuisine_type, must_order)                                             |
| `post_photos`                 | Photos linked to posts (url, order_index)                                                      |
| `places`                      | Canonical Rekkus place identity and public metadata                                            |
| `restaurant_sources`          | Source IDs and provenance for Google, OSM, owner/user/admin, and future providers              |
| `restaurant_provider_cache`   | Provider snapshots with TTL/freshness, attribution, cacheability, and retention                |
| `restaurant_observations`     | First-party user/system facts awaiting trust, moderation, or promotion                         |
| `restaurant_aliases`          | Duplicate, old ID, alternate name, and merge hints                                             |
| `cuisine_aliases`             | Deterministic cuisine/dish alias expansion for search                                          |
| `restaurant_audit_events`     | Audit trail for place canonical changes, provider refreshes, aliases, merges, and posts        |
| `restaurant_ownership_events` | Claim, approval, rejection, transfer, and removal history for place ownership                  |
| `restaurant_merge_events`     | Merge history with before/after summaries and rollback references                              |
| `data_repair_events`          | Repair reports and review status for malformed place, post, dish, and user data                |
| `privacy_requests`            | User privacy export/deletion/access/correction request tracking                                |
| `likes`                       | post_id + user_id junction                                                                     |
| `saves`                       | post_id + user_id junction                                                                     |
| `comments`                    | post_id + user_id + content                                                                    |
| `post_reactions`              | post_id + user_id + reaction_type (helpful/love/thanks/oh_no)                                  |
| `saved_places`                | place_id + user_id junction (renamed from `saved_locations`)                                   |
| `saved_dishes`                | dish_id + user_id private canonical-dish save junction                                         |
| `collections`                 | User-owned named boards with private/unlisted/public/staff-pick visibility metadata            |
| `collection_items`            | Place/post/dish membership rows for collections; RPC add ensures base save                     |
| `user_topic_follows`          | User-owned cuisine/interest follows for onboarding and discovery                               |
| `conversations`               | Private-message conversation containers                                                        |
| `conversation_participants`   | Participant membership and read state for private conversations                                |
| `messages`                    | Participant-only private message bodies                                                        |
| `user_settings`               | Per-user toggle preferences (notifications, privacy, theme, media autoplay)                    |
| `push_tokens`                 | Expo push tokens for notifications                                                             |
| `analytics_events`            | Raw event log (event_type, event_version, entity_type, entity_id) with 90-day retention        |
| `feature_flag_overrides`      | Service-role emergency overrides for code-defined feature flags                                |
| `feature_flag_audit_events`   | Append-only, fail-closed audit evidence for runtime feature flag override mutations             |

All tables have RLS enabled. Policies follow the pattern: public SELECT, authenticated INSERT/UPDATE/DELETE on own rows.

### Migrations log

| File                                                 | Change                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `20240101000000_initial_schema.sql`                  | Full schema + RLS + storage buckets                                                                               |
| `20240102000000_seed_mock_data.sql`                  | Seed data                                                                                                         |
| `20240103000000_saved_locations.sql`                 | `saved_locations` table + RLS (renamed to `saved_places` in `20260614000001`)                                     |
| `20240110000000_post_ratings.sql`                    | `food_rating`, `vibe_rating`, `cost_rating` on posts                                                              |
| `20240115000000_user_location.sql`                   | `suburb`, `city`, `country` on users                                                                              |
| `20240116000000_post_cuisine_type.sql`               | `cuisine_type` on posts                                                                                           |
| `20240117000000_dish_tags.sql`                       | `dish_tags` array on posts                                                                                        |
| `20240120000000_analytics.sql`                       | `analytics_events` table                                                                                          |
| `20240125000000_post_reactions.sql`                  | `post_reactions` table + RLS                                                                                      |
| `20240126000000_best_dish.sql`                       | `best_dish` column on posts                                                                                       |
| `20240130000000_push_tokens.sql`                     | `push_tokens` table for Expo notifications                                                                        |
| `20240201000000_comment_threads.sql`                 | `parent_id` on comments for replies                                                                               |
| `20240202000000_search_query_expansion.sql`          | `expand_search_cuisines` RPC for zero-result search fallback                                                      |
| `20240203000000_restaurant_compliance_graph.sql`     | Provider-independent restaurant cache, observations, aliases, audit events, and privacy requests                  |
| `20240204000000_restaurant_history_and_repairs.sql`  | Restaurant ownership, merge, and repair history tables                                                            |
| `20240205000000_moderation_security_foundations.sql` | Report/block, moderation action, appeal, trust profile, and soft-delete foundations                               |
| `20240206000000_collections_and_save_intent.sql`     | Collections, collection items, share slugs, and saved-place intent                                                |
| `20240207000000_v1_feed_analytics_foundations.sql`   | Staff-pick collection metadata and user topic follows                                                             |
| `20240208000000_search_discovery_foundations.sql`    | Full-text search indexes, cuisine aliases, cached open-now fields, and PostGIS-backed restaurant bounding-box RPC |
| `20240209000000_private_messaging_foundation.sql`    | Private messaging conversations, participants, messages, read state, and RLS                                      |
| `20240210000000_direct_messaging_rollout.sql`        | Idempotent direct conversation RPC, block-aware message send RPC, unread indexes, and `notif_messages`           |
| `20240211000000_message_rich_content.sql`            | Rich message types, reactions, group conversations, message requests, and conversation management                 |
| `20240212000000_multiple_pinned_messages.sql`        | Multiple pinned messages per conversation and `leave_group` RPC                                                  |
| `20240213000000_restaurant_data_independence.sql`    | First-party restaurant provenance, sources, observations, duplicate evidence, and audit events                    |
| `20240214000000_fix_rls_infinite_recursion.sql`      | Security-definer conversation membership helper and messaging RLS recursion fix                                  |
| `20240215000000_schema_hardening.sql`                | Conversation update policy, orphan column cleanup, and high-traffic FK indexes                                   |
| `20240216000000_message_request_participant_state.sql` | Participant-scoped direct and group message request state                                                       |
| `20240217000000_soft_delete_enforcement.sql`         | Soft-delete enforcement for posts, comments, and post media                                                      |
| `20240218000000_mixed_media_rekkus_picks.sql`        | Mixed post media metadata and Rekkus Picks fields on posts                                                       |
| `20240219000000_account_synced_post_drafts.sql`      | Account-synced create drafts, draft media metadata, RLS, and private `post-drafts` storage bucket                |
| `20240220000000_add_theme_mode.sql`                  | Light, dark, and system theme mode preference for user settings                                                  |
| `20240221000000_search_improvements.sql`             | Search/filter refinements and supporting indexes                                                                 |
| `20240222000000_post_edit_events.sql`                | Post edit timestamps/count and privacy-minimized edit audit events                                                |
| `20240223000000_search_enrichment.sql`               | Suburb aliases/lookups, restaurant popularity cache, weighted search RPCs, and autocomplete                       |
| `20240223000001_suburb_lookups_seed.sql`             | Operational seed instructions for comprehensive suburb lookups                                                    |
| `20240224000000_trending_searches.sql`               | Trending search aggregation and discovery support                                                                 |
| `20240225000000_pgvector_semantic.sql`               | Semantic-search foundation using pgvector-compatible storage                                                      |
| `20240226000000_search_history_aggregate.sql`        | Per-user recent search-history aggregate RPC for scalable discovery personalization                               |
| `20240227000000_auth_user_trigger.sql`               | Auth user trigger and backfill for public user skeleton rows                                                      |
| `20240228000000_ops_hardening.sql`                   | Feature flag overrides, analytics event versioning, and retention index                                           |
| `20240229000000_dishes.sql`                          | Canonical dishes, dish audit evidence, RLS, and dish-graph indexes                                                |
| `20240229000001_posts_dish_id.sql`                   | Canonical post-to-dish link and audited find-or-create RPC                                                        |
| `20260526000000_auth_audit_events.sql`               | Append-only authentication audit trail and authenticated write RPC                                                |
| `20260526000001_content_lifecycle_events.sql`        | Append-only post/comment lifecycle audit trail                                                                    |
| `20260526000002_platform_audit_events_view.sql`      | Unified compliance view over domain audit evidence                                                                |
| `20260526000003_dish_details_saved_library.sql`      | Private saved dishes, mixed collection targets/RPCs, and deterministic canonical dish post backfill              |
| `20260526000004_user_profile_audit_events.sql`       | Append-only user profile change audit events and unified-view extension                                           |
| `20260526000005_collection_audit_events.sql`         | Append-only collection lifecycle audit events and unified-view extension                                          |
| `20260526000006_auth_audit_server_trigger.sql`       | Server-side auth audit trigger guarantee for auditable auth-user mutations                                        |
| `20260526000007_remove_legacy_restaurant_search_overloads.sql` | Remove stale search RPC overloads so generated types resolve the suburb-aware restaurant contract              |
| `20260526000008_auth_audit_events_device_context.sql` | Document pseudonymised IP/device context contract for authentication audit evidence                              |
| `20260526000009_feature_flag_audit_events.sql`       | Fail-closed runtime feature flag override audit events and unified-view extension                                |
| `20260526000010_delete_own_account.sql`              | Self-service account deletion RPC with pre-deletion content lifecycle audit for owned posts (B-522)              |
| `20260527000000_video_autoplay_setting.sql`           | Persisted autoplay preference for visible muted post video playback with Reduce Motion override (B-529)         |
| `20260526000011_search_prefix_matching.sql`          | Prefix-matching support for `search_restaurants_full_text` and `search_posts_full_text` RPCs (as-you-type results) |
| `20260531000000_rename_best_dish_to_must_order.sql`  | Rename `best_dish` → `must_order` on posts and post_drafts; recreate all dependent stored functions              |
| `20260531000001_top_dishes_on_search_results.sql`    | Adds `top_dishes` column to restaurant search results for richer place cards                                     |
| `20260601000000_search_dishes_full_text.sql`         | `search_dishes_full_text` RPC: FTS on `dishes.search_tsv` + trigram fallback; returns canonical Dish rows with `save_count`, `post_count`, `top_photo_url` (B-544) |
| `20260601000001_user_follower_post_counts.sql`       | Cached `follower_count` and `post_count` on users for O(1) people-search ranking (B-546) |
| `20260601000002_location_aware_trending.sql`         | `near_city` column on `trending_searches` for city-partitioned trending with global fallback (B-550) |
| `20260601000003_search_synonyms.sql`                 | Public-read `search_synonyms` reference table for operator-managed cuisine, occasion, and dietary query vocabulary (B-551) |
| `20260601000004_embedding_hash.sql`                  | `embedding_hash` on posts and restaurants to skip re-embedding on unchanged content |
| `20260601000005_trending_user_count.sql`             | `user_count` on `trending_searches` to prevent single-user queries surfacing as trending (B-550 follow-up) |
| `20260601000006_search_location_ranking.sql`         | Strengthen distance scoring in `search_restaurants_full_text` — penalise results >50 km instead of boost-only |
| `20260601000007_personalized_suggestions.sql`        | `get_personalized_suggestions` RPC combines own search, engagement cuisine, save, topic, and trending signals for no-results recovery (B-557) |
| `20260601000008_dish_fts_restaurant_search.sql`      | Dish-name FTS in `search_restaurants_full_text` via correlated `posts.dish_id → dishes.name` EXISTS clause (B-563) |
| `20260601000009_fetch_trending_dishes.sql`           | `fetch_trending_dishes` RPC: ranks dishes by 7-day `saved_dishes` + `posts.dish_id` activity (saves ×3 weight); powers "Trending dishes" row on DiscoveryPage (B-549) |
| `20260602000000_saved_searches.sql`                  | Owner-RLS `saved_searches` plus fail-closed `saved_search_audit_events`; powers persistent Discovery saved searches (B-553) |
| `20260602000001_search_typo_tolerance.sql`           | Trigram fallback CTEs in `search_restaurants_full_text` and `search_posts_full_text`; word_similarity > 0.35 on place names, similarity > 0.30 on must_order (B-577)   |
| `20260602000002_search_freshness_v1.sql`             | `search_freshness_scores` materialized view and `get_search_freshness` RPC; powers freshness signal in candidate ranking (B-574) |
| `20260602000003_search_quality_metrics.sql`          | `search_quality_events` table and `log_search_quality_event` RPC; audit trail for quality governance and automated ratchets (B-585) |
| `20260622000000_seed_mock_post_covers.sql`           | Backfills cover `post_photos` rows for fixed local seed posts so DB-hydrated seed content has thumbnails |

---

## Key hooks

| Hook | File | Purpose |
| --- | --- | --- |
| `useSearch` | `lib/hooks/useSearch.ts` | BM25-style scoring; debounced Supabase + local merge; backend cuisine fallback |
| `useDiscover` | `lib/hooks/useDiscover.ts` | Deterministic Discover ranking from quality, nearby, trending, topics, and diversity signals |
| `useSavedPlaces` | `lib/hooks/useSavedPlaces.ts` | Saved places join; refreshes on tab focus |
| `useCollections` | `lib/hooks/useCollections.ts` | User collections plus place membership for Places filters |
| `useTopicFollows` | `lib/hooks/useTopicFollows.ts` | User cuisine/interest follows for onboarding seeded discovery |
| `useSavedPosts` | `lib/hooks/useSavedPosts.ts` | Cursor-based Supabase pagination |
| `useSavedDishes` | `lib/hooks/useSavedDishes.ts` | Private saved canonical dishes |
| `useDishDetail` | `lib/hooks/useDishDetail.ts` | Dish entity, save/membership state, and cursor-paginated evidence posts |
| `useCollectionPicker` | `lib/hooks/useCollectionPicker.ts` | Private collection create/add orchestration |
| `useLikedPosts` | `lib/hooks/useLikedPosts.ts` | Cursor-based Supabase pagination |
| `usePagedList` | `lib/hooks/usePagedList.ts` | Generic client-side slicer (`visible`, `hasMore`, `loadMore`) |
| `useAlerts` | `lib/hooks/useAlerts.ts` | Likes + comments in parallel; pull-to-refresh |
| `usePlaceSearch` | `lib/hooks/usePlaceSearch.ts` | Debounced DB+Google autocomplete, nearby fetch, place details + upsert; extracted from StepMedia (B-506) |
| `useFollowingFeed` | `lib/hooks/useFollowingFeed.ts` | Follows-based post feed |
| `useDiscover` | `lib/hooks/useDiscover.ts` | Discover feed (trending, popular places) |

---

## Third-party integrations

### Google Places (REST)

- **Autocomplete** — location picker in post create
- **Place Details** — name, hours, phone, website, photos, rating on location screen
- **Text Search** — geocode fallback for posts with no coordinates
- **Photos** — up to 6 photos on location screen, 1 on map bottom card
- Key stored in `.env` as `EXPO_PUBLIC_GOOGLE_PLACES_KEY`; accessed via `lib/config.ts`
- Google is fallback/enrichment, not canonical place truth.
- Place Details calls must use field masks; autocomplete flows should preserve session-token-aware behavior when a selection follows.
- Provider-derived data should flow through place source/cache/observation/audit tables before it affects canonical place metadata.

### Google Maps

- `react-native-maps` 1.27.2, `PROVIDER_GOOGLE`
- Used on Places tab (map view) and Restaurant map screen
- Requires native build (`expo prebuild` or EAS Build)

### Supabase Storage

- Bucket: `avatars` — user profile photos (uploaded via `expo-image-picker`)
- Bucket: `post-photos` — post images

### Push notifications

- `notifications.ts` + `supabase/functions/send-push/` edge function
- `registerPushToken()` called on login
- `notify()` called on like / comment / follow actions

### Resend

- Production SMTP only — never used in local dev
- Local dev: `supabase start` → Inbucket at `http://localhost:54324`

---

## Design system

Documented in full in [../../design/DESIGN_SPEC.md](../../design/DESIGN_SPEC.md). Quick reference:

| Token file                | Exports                                  |
| ------------------------- | ---------------------------------------- |
| `constants/Colors.ts`     | `lightColors`, `darkColors`, `imgColors` |
| `constants/Typography.ts` | `fontSize`, `fontWeight`, `lineHeight`   |
| `constants/Elevation.ts`  | shadow/elevation presets                 |
| `constants/Spacing.ts`    | `spacing`, `radius`                      |

Always access colours via `useThemeColors()`. Never hardcode theme colours.

`scripts/check-architecture.sh` enforces the 600 LOC hard limit for `features/` and `lib/hooks/`, reports soft LOC budgets for `features/`, `lib/hooks/`, `components/`, and `lib/services/`, and blocks direct Supabase/provider imports in `app/`, `features/`, `lib/hooks/`, and `lib/contexts/`. Any temporary exception must remain backlog-linked and is rejected once its forbidden import disappears.

Use `components/ui/RekkusActionSheet` for in-app choice/action lists such as sort controls, cuisine pickers, and map app selection. Avoid `ActionSheetIOS` unless a future flow has a specific platform-native requirement and an Android equivalent.

---

→ See [../../product/FEATURES.md](../../product/FEATURES.md) for the full feature inventory.
→ See [../../BACKLOG.md](../../BACKLOG.md) for outstanding work.
