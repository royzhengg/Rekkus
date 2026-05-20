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
| Animations | `react-native-reanimated`                  |
| Images     | `expo-image-picker`                        |
| Media prep | `react-native-compressor` + Supabase Edge Function orchestration |
| Local DB   | `expo-sqlite` (session persistence)        |

---

## Project structure

```
app/                  Expo Router screens — orchestration only
  (auth)/             Auth flow screens
  (tabs)/             Tab bar screens
  restaurants/        Restaurant detail + map routes
  posts/              Post detail routes
  settings/           Settings screens
  user/               Other user profiles

features/             Product-area screen implementations
  auth/               Auth screens
  create-post/        Create review flow
  feed/               Feed and alerts
  posts/              Post detail
  profile/            Own and public profile screens
  restaurants/        Places tab, restaurant detail, restaurant map
  search/             Search screens
  settings/           Settings screens

components/           Feature-level shared UI
  ui/                 Primitive design library (zero business logic)
  icons.tsx           All SVG icons (single source of truth)
  post-create/        Wizard step components (StepMedia, StepDetails, StepReview)

lib/                  App logic layer
  contexts/           React providers
  hooks/              Custom React hooks
  services/           Supabase API wrappers (posts.ts, users.ts, comments.ts, restaurants.ts)
  mocks/              Local/demo data only
  utils/              Pure helpers (format.ts, geo.ts)
  analytics.ts        Analytics abstraction (track / screen / identify)
  featureFlags.ts     Feature flag checks (isEnabled)
  config.ts           Env vars — single source of truth (never raw process.env in screens)
  supabase.ts         Typed Supabase client
  routes.ts           Route builders and canonical route names

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

Create drafts are account-synced through `post_drafts`, `post_draft_media`, and `lib/services/postDrafts.ts`. Explicit **Save** stores `status='saved'` rows and private media in the `post-drafts` bucket from any create step; saved draft editing can either update the current draft or branch via **Save as new draft**. The tab bar Create button opens the app-wide `CreateLauncherProvider` over the current screen; with saved drafts it offers **New post** or **Edit a draft** only, and draft rows stay inside `/create/drafts`. Background autosave stores `status='autosave'` rows for recovery and stays out of the visible Drafts list. AsyncStorage remains a migration/recovery cache for older local drafts. The app-wide `PostUploadProvider` tracks preparation/upload/publish progress so the feed can show non-blocking publish state.

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

- Create tab: `/(tabs)/create`
- Places tab implementation: `/(tabs)/restaurants` with visible label `Places`
- Post detail: `/posts/[postId]`
- Restaurant detail: `/restaurants/[restaurantId]`
- Restaurant map: `/restaurants/[restaurantId]/map`

Legacy `/post/[id]`, `/location/[placeId]`, `/(tabs)/post`, and `/(tabs)/places` routes are temporary redirect wrappers only.

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
| Supabase API call               | `lib/services/`    |
| Env variable                    | `lib/config.ts`    |
| Analytics call                  | `lib/analytics.ts` |
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

| Table                         | Purpose                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `users`                       | Profiles (username, bio, suburb, city, country)                                                |
| `posts`                       | Reviews (caption, ratings, cuisine_type, best_dish)                                            |
| `post_photos`                 | Photos linked to posts (url, order_index)                                                      |
| `restaurants`                 | Canonical Rekkus restaurant identity and public metadata                                       |
| `restaurant_sources`          | Source IDs and provenance for Google, OSM, owner/user/admin, and future providers              |
| `restaurant_provider_cache`   | Provider snapshots with TTL/freshness, attribution, cacheability, and retention                |
| `restaurant_observations`     | First-party user/system facts awaiting trust, moderation, or promotion                         |
| `restaurant_aliases`          | Duplicate, old ID, alternate name, and merge hints                                             |
| `cuisine_aliases`             | Deterministic cuisine/dish alias expansion for search                                          |
| `restaurant_audit_events`     | Audit trail for restaurant canonical changes, provider refreshes, aliases, merges, and reviews |
| `restaurant_ownership_events` | Claim, approval, rejection, transfer, and removal history for restaurant ownership             |
| `restaurant_merge_events`     | Merge history with before/after summaries and rollback references                              |
| `data_repair_events`          | Repair reports and review status for malformed restaurant, post, dish, and user data           |
| `privacy_requests`            | User privacy export/deletion/access/correction request tracking                                |
| `likes`                       | post_id + user_id junction                                                                     |
| `saves`                       | post_id + user_id junction                                                                     |
| `comments`                    | post_id + user_id + content                                                                    |
| `post_reactions`              | post_id + user_id + reaction_type (helpful/love/thanks/oh_no)                                  |
| `saved_locations`             | restaurant_id + user_id junction with saved intent status                                      |
| `collections`                 | User-owned named boards with private/unlisted/public/staff-pick visibility metadata            |
| `collection_items`            | Restaurant/post membership rows for collections                                                |
| `user_topic_follows`          | User-owned cuisine/interest follows for onboarding and discovery                               |
| `conversations`               | Private-message conversation containers                                                        |
| `conversation_participants`   | Participant membership and read state for private conversations                                |
| `messages`                    | Participant-only private message bodies                                                        |
| `user_settings`               | Per-user toggle preferences (notifications, privacy)                                           |
| `push_tokens`                 | Expo push tokens for notifications                                                             |
| `analytics_events`            | Raw event log (event_type, entity_type, entity_id)                                             |

All tables have RLS enabled. Policies follow the pattern: public SELECT, authenticated INSERT/UPDATE/DELETE on own rows.

### Migrations log

| File                                                 | Change                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `20240101000000_initial_schema.sql`                  | Full schema + RLS + storage buckets                                                                               |
| `20240102000000_seed_mock_data.sql`                  | Seed data                                                                                                         |
| `20240103000000_saved_locations.sql`                 | `saved_locations` table + RLS                                                                                     |
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

---

## Key hooks

| Hook                | File                             | Purpose                                                                                      |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `useSearch`         | `lib/hooks/useSearch.ts`         | BM25-style scoring; debounced Supabase + local merge; backend cuisine fallback               |
| `useDiscover`       | `lib/hooks/useDiscover.ts`       | Deterministic Discover ranking from quality, nearby, trending, topics, and diversity signals |
| `useSavedLocations` | `lib/hooks/useSavedLocations.ts` | Restaurant join; refreshes on tab focus                                                      |
| `useCollections`    | `lib/hooks/useCollections.ts`    | User collections plus restaurant collection membership for Places filters                    |
| `useTopicFollows`   | `lib/hooks/useTopicFollows.ts`   | User cuisine/interest follows for onboarding seeded discovery                                |
| `useSavedPosts`     | `lib/hooks/useSavedPosts.ts`     | Cursor-based Supabase pagination                                                             |
| `useLikedPosts`     | `lib/hooks/useLikedPosts.ts`     | Cursor-based Supabase pagination                                                             |
| `usePagedList`      | `lib/hooks/usePagedList.ts`      | Generic client-side slicer (`visible`, `hasMore`, `loadMore`)                                |
| `useAlerts`         | `lib/hooks/useAlerts.ts`         | Likes + comments in parallel; pull-to-refresh                                                |
| `useFollowingFeed`  | `lib/hooks/useFollowingFeed.ts`  | Follows-based post feed                                                                      |
| `useDiscover`       | `lib/hooks/useDiscover.ts`       | Discover feed (trending, popular places)                                                     |

---

## Third-party integrations

### Google Places (REST)

- **Autocomplete** — location picker in post create
- **Place Details** — name, hours, phone, website, photos, rating on location screen
- **Text Search** — geocode fallback for posts with no coordinates
- **Photos** — up to 6 photos on location screen, 1 on map bottom card
- Key stored in `.env` as `EXPO_PUBLIC_GOOGLE_PLACES_KEY`; accessed via `lib/config.ts`
- Google is fallback/enrichment, not canonical restaurant truth.
- Place Details calls must use field masks; autocomplete flows should preserve session-token-aware behavior when a selection follows.
- Provider-derived data should flow through restaurant source/cache/observation/audit tables before it affects canonical restaurant metadata.

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
| `constants/Spacing.ts`    | `spacing`, `radius`                      |

Always access colours via `useThemeColors()`. Never hardcode theme colours.

Use `components/ui/RekkusActionSheet` for in-app choice/action lists such as sort controls, cuisine pickers, and map app selection. Avoid `ActionSheetIOS` unless a future flow has a specific platform-native requirement and an Android equivalent.

---

→ See [../../product/FEATURES.md](../../product/FEATURES.md) for the full feature inventory.
→ See [../../BACKLOG.md](../../BACKLOG.md) for outstanding work.
