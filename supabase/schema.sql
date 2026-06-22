-- =============================================================================
-- Rekkus canonical schema
-- Source of truth for the current DB state. Read this file to understand the
-- schema — do NOT read individual migration files for this purpose.
--
-- To make a schema change:
--   1. Edit this file
--   2. supabase db diff --use-migra -f <migration_name>
--   3. Review the generated migration before pushing
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists postgis with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

create type public.verification_level as enum (
  'user_created',       -- user typed a new place; not yet confirmed
  'osm_only',           -- OSM import; no further verification
  'osm_google',         -- OSM + Google cache enrichment applied
  'community_verified', -- ≥3 unique users, ≥7 days apart
  'owner_verified'      -- owner claimed + verified
);

create type public.place_status as enum (
  'active',
  'temporarily_closed',
  'permanently_closed',
  'unverified'
);

create type public.place_trait_slug as enum (
  'date_night', 'cheap_eats', 'study_spot', 'group_dining',
  'late_night', 'hidden_gem', 'family_friendly', 'romantic',
  'outdoor', 'fast_casual', 'special_occasion'
);

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- users (extends auth.users)
create table if not exists public.users (
  id              uuid        references auth.users on delete cascade primary key,
  username        text        not null unique,
  full_name       text,
  avatar_url      text,
  bio             text,
  website         text,
  suburb          text,
  city            text,
  country         text,
  follower_count  integer     not null default 0,
  post_count      integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- places
create table if not exists public.places (
  id                          uuid          default gen_random_uuid() primary key,
  name                        text          not null,
  address                     text,
  city                        text,
  country                     text,
  suburb                      text,
  latitude                    double precision,
  longitude                   double precision,
  place_geog                  extensions.geography(Point, 4326)
                              generated always as (
                                case
                                  when latitude is null or longitude is null then null
                                  else extensions.ST_SetSRID(
                                    extensions.ST_MakePoint(longitude, latitude), 4326
                                  )::extensions.geography
                                end
                              ) stored,
  google_place_id             text,
  cuisine_type                text,
  price_range                 integer,
  google_rating               numeric(2,1),
  google_review_count         integer,
  google_photo_refs           text[],
  open_now                    boolean,
  open_now_checked_at         timestamptz,
  canonical_source            text          not null default 'rekkus',
  metadata_confidence         numeric(3,2)  not null default 0.50,
  verification_status         text          not null default 'unverified',
  community_verification_score integer      not null default 0,
  community_verified_at       timestamptz,
  owner_content_status        text          not null default 'none',
  metadata_source_priority    text          not null default 'rekkus_first',
  primary_photo_source        text          not null default 'rekkus_post',
  created_by                  uuid          references public.users(id) on delete set null,
  embedding                   extensions.vector(384),
  embedding_hash              text,
  created_at                  timestamptz   not null default now(),
  updated_at                  timestamptz   not null default now(),
  -- Lifecycle + identity additions (OSM schema)
  verification_level          public.verification_level not null default 'osm_only',
  place_status                public.place_status not null default 'active',
  created_source              text,
  deleted_at                  timestamptz,
  merged_into_place_id        uuid,
  osm_id                      text unique,
  slug                        text unique,
  cuisine_slug                text
);

-- posts
create table if not exists public.posts (
  id              uuid        default gen_random_uuid() primary key,
  user_id         uuid        references public.users on delete cascade not null,
  place_id        uuid        references public.places on delete set null,
  caption         text,
  rating          integer     check (rating between 1 and 5),
  food_rating     integer     check (food_rating between 1 and 5),
  vibe_rating     integer     check (vibe_rating between 1 and 5),
  cost_rating     integer     check (cost_rating between 1 and 4),
  cuisine_type    text,
  must_order      text,
  dish_tags       jsonb,
  dish_id         uuid        references public.dishes(id) on delete set null,
  taste_verdict   text        check (taste_verdict is null or taste_verdict in (
                                'not_for_me', 'good', 'craveable', 'must_order', 'worth_a_trip')),
  value_verdict   text        check (value_verdict is null or value_verdict in (
                                'not_worth_it', 'fair', 'great_value', 'worth_the_splurge')),
  occasion_tags   text[]      not null default '{}',
  deleted_at      timestamptz,
  deleted_reason  text,
  last_edited_at  timestamptz,
  edit_count      integer     not null default 0,
  search_tsv      tsvector    generated always as (
    setweight(to_tsvector('simple', coalesce(must_order, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(dish_tags::text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(cuisine_type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(caption, '')), 'C')
  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- post_embeddings
create table if not exists public.post_embeddings (
  post_id         uuid        primary key references public.posts(id) on delete cascade,
  embedding       extensions.vector(384) not null,
  embedding_hash  text
);

-- post_photos
create table if not exists public.post_photos (
  id                uuid        default gen_random_uuid() primary key,
  post_id           uuid        references public.posts on delete cascade not null,
  url               text        not null,
  order_index       integer     not null default 0,
  media_type        text        not null default 'image',
  original_url      text,
  processed_url     text,
  thumbnail_url     text,
  mime_type         text,
  size_bytes        bigint,
  duration_ms       integer,
  width             integer,
  height            integer,
  processing_status text        not null default 'ready',
  processing_error  text,
  is_cover          boolean     not null default false,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now()
);

-- hashtags
create table if not exists public.hashtags (
  id         uuid        default gen_random_uuid() primary key,
  name       text        not null unique,
  created_at timestamptz not null default now()
);

-- post_hashtags
create table if not exists public.post_hashtags (
  post_id    uuid references public.posts on delete cascade,
  hashtag_id uuid references public.hashtags on delete cascade,
  primary key (post_id, hashtag_id)
);

-- likes
create table if not exists public.likes (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references public.users on delete cascade not null,
  post_id    uuid        references public.posts on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

-- saves
create table if not exists public.saves (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references public.users on delete cascade not null,
  post_id    uuid        references public.posts on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

-- follows
create table if not exists public.follows (
  id           uuid        default gen_random_uuid() primary key,
  follower_id  uuid        references public.users on delete cascade not null,
  following_id uuid        references public.users on delete cascade not null,
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id)
);

-- comments
create table if not exists public.comments (
  id               uuid        default gen_random_uuid() primary key,
  user_id          uuid        references public.users on delete cascade not null,
  post_id          uuid        references public.posts on delete cascade not null,
  parent_id        uuid        references public.comments(id) on delete cascade,
  content          text        not null,
  deleted_at       timestamptz,
  deleted_reason   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- user_settings
create table if not exists public.user_settings (
  id                   uuid    references auth.users on delete cascade primary key,
  notif_likes          boolean not null default true,
  notif_comments       boolean not null default true,
  notif_followers      boolean not null default true,
  notif_mentions       boolean not null default true,
  notif_messages       boolean not null default true,
  private_account      boolean not null default false,
  allow_comments       boolean not null default true,
  allow_tags           boolean not null default true,
  dark_mode            boolean not null default false,
  theme_mode           text    default 'system' check (theme_mode in ('light', 'dark', 'system')),
  show_activity_status boolean not null default true,
  autoplay_videos      boolean not null default true,
  updated_at           timestamptz not null default now()
);

-- saved_places
create table if not exists public.saved_places (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references public.users on delete cascade not null,
  place_id      uuid        references public.places on delete cascade not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, place_id)
);

-- push_tokens
create table if not exists public.push_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  token      text        not null,
  platform   text        not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

-- analytics_events
create table if not exists public.analytics_events (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references public.users(id) on delete set null,
  event_type    text        not null,
  entity_type   text,
  entity_id     uuid,
  metadata      jsonb,
  event_version integer     not null default 1,
  created_at    timestamptz default now()
);

-- search_events: structured search analytics for post-launch analysis of failing queries
create table if not exists public.search_events (
  id                  uuid        default gen_random_uuid() primary key,
  query               text        not null,
  results_count       int         not null,
  clicked_entity_id   uuid,
  clicked_entity_kind text        check (clicked_entity_kind in ('place', 'dish', 'post')),
  user_id             uuid        references public.users(id) on delete set null,
  created_at          timestamptz default now()
);

create index if not exists idx_search_events_query on public.search_events (query, created_at desc);
create index if not exists idx_search_events_zero on public.search_events (created_at desc) where results_count = 0;

-- post_reactions
create table if not exists public.post_reactions (
  id            uuid        default gen_random_uuid() primary key,
  post_id       uuid        not null references public.posts(id) on delete cascade,
  user_id       uuid        not null references public.users(id) on delete cascade,
  reaction_type text        not null check (reaction_type in ('helpful', 'love', 'thanks', 'oh_no')),
  created_at    timestamptz default now(),
  unique (post_id, user_id, reaction_type)
);

-- collections
create table if not exists public.collections (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references public.users on delete cascade not null,
  name        text        not null check (char_length(name) between 1 and 80),
  description text,
  visibility  text        not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  share_slug  text        unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- collection_items
create table if not exists public.collection_items (
  id            uuid        default gen_random_uuid() primary key,
  collection_id uuid        references public.collections on delete cascade not null,
  target_type   text        not null check (target_type in ('place', 'post', 'dish')),
  target_id     uuid        not null,
  created_at    timestamptz not null default now(),
  unique (collection_id, target_type, target_id)
);

-- conversations
create table if not exists public.conversations (
  id                uuid        default gen_random_uuid() primary key,
  conversation_type text        not null default 'direct' check (conversation_type in ('direct')),
  status            text        not null default 'active',
  name              text,
  avatar_url        text,
  created_by        uuid        references public.users on delete set null,
  direct_user_low   uuid        references public.users on delete cascade,
  direct_user_high  uuid        references public.users on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- conversation_participants
create table if not exists public.conversation_participants (
  id                  uuid        default gen_random_uuid() primary key,
  conversation_id     uuid        references public.conversations on delete cascade not null,
  user_id             uuid        references public.users on delete cascade not null,
  last_read_message_id uuid,
  last_read_at        timestamptz,
  pinned_message_id   uuid,
  muted_until         timestamptz,
  pinned_at           timestamptz,
  archived_at         timestamptz,
  is_admin            boolean     not null default false,
  last_seen_at        timestamptz,
  request_status      text        not null default 'active',
  requested_by        uuid        references public.users(id) on delete set null,
  requested_at        timestamptz,
  request_decided_at  timestamptz,
  created_at          timestamptz not null default now(),
  unique (conversation_id, user_id)
);

-- messages
create table if not exists public.messages (
  id                 uuid        default gen_random_uuid() primary key,
  conversation_id    uuid        references public.conversations on delete cascade not null,
  sender_id          uuid        references public.users on delete cascade not null,
  body               text        not null check (char_length(body) between 1 and 2000),
  message_type       text        not null default 'text',
  attachment_url     text,
  attachment_metadata jsonb,
  reply_to_message_id uuid       references public.messages(id) on delete set null,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now()
);

-- post_drafts
create table if not exists public.post_drafts (
  id              uuid        default gen_random_uuid() primary key,
  user_id         uuid        references public.users on delete cascade not null,
  title           text        not null default '',
  body            text        not null default '',
  selected_place  jsonb,
  place_id        uuid        references public.places on delete set null,
  dish_tags       jsonb       not null default '[]'::jsonb,
  food_rating     integer     not null default 0 check (food_rating between 0 and 5),
  vibe_rating     integer     not null default 0 check (vibe_rating between 0 and 5),
  cost_rating     integer     not null default 0 check (cost_rating between 0 and 4),
  taste_verdict   text        check (taste_verdict is null or taste_verdict in (
                                'not_for_me', 'good', 'craveable', 'must_order', 'worth_a_trip')),
  value_verdict   text        check (value_verdict is null or value_verdict in (
                                'not_worth_it', 'fair', 'great_value', 'worth_the_splurge')),
  occasion_tags   text[]      not null default '{}',
  must_order      text        not null default '',
  cuisine_type    text        not null default '',
  hashtags        text[]      not null default '{}',
  hashtag_input   text        not null default '',
  status          text        not null default 'autosave' check (status in (
                                'autosave', 'saved', 'discarded', 'published')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_saved_at   timestamptz
);

-- post_draft_media
create table if not exists public.post_draft_media (
  id                uuid        default gen_random_uuid() primary key,
  draft_id          uuid        references public.post_drafts on delete cascade not null,
  user_id           uuid        references public.users on delete cascade not null,
  local_id          text        not null,
  media_type        text        not null check (media_type in ('image', 'video')),
  storage_path      text        not null,
  public_preview_url text,
  thumbnail_url     text,
  mime_type         text,
  size_bytes        bigint,
  duration_ms       integer,
  width             integer,
  height            integer,
  processing_status text        not null default 'ready' check (processing_status in (
                                  'local_ready', 'queued', 'uploading', 'uploaded',
                                  'processing', 'ready', 'failed')),
  processing_error  text,
  order_index       integer     not null default 0,
  is_cover          boolean     not null default false,
  created_at        timestamptz not null default now()
);

-- post_edit_events
create table if not exists public.post_edit_events (
  id                  uuid    primary key default gen_random_uuid(),
  post_id             uuid    not null references public.posts(id) on delete cascade,
  user_id             uuid    not null references public.users(id) on delete cascade,
  event_type          text    not null check (event_type in (
                                'edit_started', 'edit_saved', 'edit_discarded',
                                'edit_conflict', 'media_replaced')),
  changed_fields      text[]  not null default '{}',
  changed_field_count integer not null default 0,
  created_at          timestamptz not null default now()
);

-- dishes
create table if not exists public.dishes (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  name_normalized text        generated always as (lower(trim(name))) stored,
  place_id        uuid        references public.places(id) on delete set null,
  cuisine_type    text,
  created_by      uuid        references public.users(id) on delete set null,
  search_tsv      tsvector    generated always as (
                                to_tsvector('english', coalesce(name, ''))
                              ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- saved_dishes
create table if not exists public.saved_dishes (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references public.users(id) on delete cascade not null,
  dish_id    uuid        references public.dishes(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dish_id)
);

-- suburb_aliases
create table if not exists public.suburb_aliases (
  id             serial primary key,
  alias          text   not null unique,
  canonical_name text   not null,
  lat            double precision,
  lng            double precision
);

-- suburb_lookups
create table if not exists public.suburb_lookups (
  id       serial primary key,
  name     text   not null,
  state    text,
  postcode text,
  lat      double precision,
  lng      double precision
);

-- trending_searches
create table if not exists public.trending_searches (
  id           serial      primary key,
  query        text        not null unique,
  search_count integer     not null default 0,
  score        real        not null default 0,
  updated_at   timestamptz not null default now()
);

-- saved_searches
create table if not exists public.saved_searches (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null default auth.uid() references public.users(id) on delete cascade,
  query            text        not null constraint saved_searches_query_not_blank check (length(trim(query)) > 1),
  normalized_query text        not null constraint saved_searches_normalized_query_not_blank check (length(trim(normalized_query)) > 1),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint saved_searches_user_normalized_unique unique (user_id, normalized_query)
);

-- user_top_spots
create table if not exists public.user_top_spots (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  position      smallint    not null check (position between 1 and 3),
  place_id      uuid        not null references public.places(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, position),
  unique (user_id, place_id)
);

-- place_stubs (Google autocomplete cache, TTL 30 days)
create table if not exists public.place_stubs (
  place_id   text        primary key,
  name       text        not null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

-- feature_flag_overrides
create table if not exists public.feature_flag_overrides (
  flag_name  text        primary key,
  enabled    boolean     not null,
  reason     text        not null,
  updated_by uuid        references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

-- user_blocks
create table if not exists public.user_blocks (
  id         uuid        default gen_random_uuid() primary key,
  blocker_id uuid        references public.users on delete cascade not null,
  blocked_id uuid        references public.users on delete cascade not null,
  reason     text,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- content_reports
create table if not exists public.content_reports (
  id             uuid        default gen_random_uuid() primary key,
  reporter_id    uuid        references public.users on delete set null,
  target_type    text        not null check (target_type in ('post', 'comment', 'user', 'place')),
  target_id      uuid        not null,
  report_type    text        not null default 'content_report' check (report_type in (
                               'content_report', 'fake_review', 'incentive_disclosure', 'dispute', 'takedown')),
  reason         text        not null check (char_length(reason) between 3 and 80),
  details        text,
  source_surface text        not null default 'app',
  status         text        not null default 'open' check (status in (
                               'open', 'triaged', 'actioned', 'dismissed', 'appealed', 'closed')),
  priority       text        not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  shadow_mode    boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- moderation_actions
create table if not exists public.moderation_actions (
  id          uuid        default gen_random_uuid() primary key,
  report_id   uuid        references public.content_reports on delete set null,
  actor_id    uuid        references public.users on delete set null,
  actor_type  text        not null default 'system' check (actor_type in ('user', 'admin', 'system', 'service')),
  action_type text        not null check (action_type in (
                            'triage', 'hide_content', 'restore_content', 'warn_user',
                            'restrict_user', 'dismiss_report', 'escalate', 'note')),
  target_type text        not null check (target_type in ('post', 'comment', 'user', 'place')),
  target_id   uuid        not null,
  reason      text        not null,
  reversible  boolean     not null default true,
  shadow_mode boolean     not null default false,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- moderation_appeals
create table if not exists public.moderation_appeals (
  id           uuid        default gen_random_uuid() primary key,
  report_id    uuid        references public.content_reports on delete set null,
  action_id    uuid        references public.moderation_actions on delete set null,
  appellant_id uuid        references public.users on delete set null,
  reason       text        not null,
  status       text        not null default 'open' check (status in (
                             'open', 'reviewing', 'upheld', 'reversed', 'closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- user_trust_profiles
create table if not exists public.user_trust_profiles (
  user_id        uuid    references public.users on delete cascade primary key,
  trust_level    text    not null default 'new' check (trust_level in ('new', 'standard', 'trusted', 'restricted')),
  score          integer not null default 0 check (score between -100 and 100),
  reason_summary text,
  last_reviewed_at timestamptz,
  updated_at     timestamptz not null default now()
);

-- restaurant_sources
create table if not exists public.restaurant_sources (
  id                    uuid          default gen_random_uuid() primary key,
  restaurant_id         uuid          not null references public.places(id) on delete cascade,
  source_type           text          not null check (source_type in (
                          'rekkus', 'google_places', 'osm', 'owner_submitted',
                          'user_created', 'admin_created', 'future_provider')),
  source_id             text,
  source_payload        jsonb,
  source_rights         text          not null default 'first_party',
  attribution_required  boolean       not null default false,
  cacheability          text          not null default 'permanent_identifier',
  retention_policy      text          not null default 'retain_until_unlinked_or_restaurant_deleted',
  confidence            numeric(3,2)  not null default 0.50,
  created_by            uuid          references public.users(id) on delete set null,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

-- restaurant_provider_cache
create table if not exists public.restaurant_provider_cache (
  id                   uuid          default gen_random_uuid() primary key,
  restaurant_id        uuid          references public.places(id) on delete cascade,
  source_type          text          not null,
  source_id            text          not null,
  field_mask           text[],
  normalized_payload   jsonb         not null default '{}'::jsonb,
  raw_payload          jsonb,
  attribution_required boolean       not null default false,
  attribution_text     text,
  cacheability         text          not null,
  retention_policy     text          not null,
  freshness_state      text          not null default 'fresh' check (
                         freshness_state in ('fresh', 'stale', 'expired', 'restricted')),
  fetched_at           timestamptz   not null default now(),
  stale_at             timestamptz,
  expires_at           timestamptz
);

-- restaurant_observations
create table if not exists public.restaurant_observations (
  id                  uuid          default gen_random_uuid() primary key,
  restaurant_id       uuid          references public.places(id) on delete cascade,
  user_id             uuid          references public.users(id) on delete set null,
  observation_type    text          not null,
  observed_value      jsonb         not null,
  source_type         text          not null default 'first_party_user',
  source_entity_type  text,
  source_entity_id    uuid,
  confidence          numeric(3,2)  not null default 0.50,
  status              text          not null default 'pending' check (
                        status in ('pending', 'trusted', 'rejected', 'superseded')),
  retention_policy    text          not null default 'retain_until_user_deletion_or_superseded',
  created_at          timestamptz   not null default now(),
  reviewed_at         timestamptz,
  reviewed_by         uuid          references public.users(id) on delete set null
);

-- restaurant_aliases
create table if not exists public.restaurant_aliases (
  id            uuid          default gen_random_uuid() primary key,
  restaurant_id uuid          not null references public.places(id) on delete cascade,
  provider      text,
  provider_place_id text,
  alias_name    text,
  alias_address text,
  reason        text          not null,
  confidence    numeric(3,2)  not null default 0.50,
  status        text          not null default 'active' check (status in ('active', 'superseded', 'rejected')),
  created_by    uuid          references public.users(id) on delete set null,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

-- restaurant_audit_events
create table if not exists public.restaurant_audit_events (
  id                  uuid        default gen_random_uuid() primary key,
  actor_type          text        not null default 'system',
  actor_id            uuid,
  action              text        not null,
  entity_type         text        not null,
  entity_id           uuid,
  restaurant_id       uuid        references public.places(id) on delete set null,
  source_type         text,
  reason              text,
  before_summary      jsonb,
  after_summary       jsonb,
  request_id          text,
  job_id              text,
  compliance_category text,
  rollback_reference  text,
  created_at          timestamptz not null default now()
);

-- restaurant_ownership_events
create table if not exists public.restaurant_ownership_events (
  id                uuid        default gen_random_uuid() primary key,
  restaurant_id     uuid        not null references public.places(id) on delete cascade,
  event_type        text        not null check (event_type in (
                      'claim_submitted', 'claim_approved', 'claim_rejected',
                      'ownership_transferred', 'ownership_removed')),
  actor_id          uuid        references public.users(id) on delete set null,
  previous_owner_id uuid        references public.users(id) on delete set null,
  new_owner_id      uuid        references public.users(id) on delete set null,
  source_type       text        not null default 'owner_submitted',
  reason            text,
  evidence_summary  jsonb       not null default '{}'::jsonb,
  status            text        not null default 'pending' check (
                      status in ('pending', 'approved', 'rejected', 'superseded')),
  audit_event_id    uuid        references public.restaurant_audit_events(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- privacy_requests
create table if not exists public.privacy_requests (
  id              uuid        default gen_random_uuid() primary key,
  user_id         uuid        not null references public.users(id) on delete cascade,
  request_type    text        not null check (request_type in ('export', 'deletion', 'correction', 'access')),
  status          text        not null default 'submitted' check (
                    status in ('submitted', 'in_review', 'completed', 'rejected', 'cancelled')),
  request_payload jsonb       not null default '{}'::jsonb,
  due_at          timestamptz,
  completed_at    timestamptz,
  audit_reference text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- auth_audit_events (ISO A.12.4.1)
create table if not exists public.auth_audit_events (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references public.users(id) on delete set null,
  event_type text        not null check (event_type in (
               'login_email_success', 'login_oauth_success', 'logout',
               'password_changed', 'account_deleted')),
  context    jsonb,
  created_at timestamptz not null default now()
);

-- content_lifecycle_events (append-only; entity_id has no FK intentionally)
create table if not exists public.content_lifecycle_events (
  id          uuid        primary key default gen_random_uuid(),
  entity_type text        not null check (entity_type in ('post', 'comment')),
  entity_id   uuid        not null,
  user_id     uuid        references public.users(id) on delete set null,
  event_type  text        not null check (event_type in ('created', 'deleted', 'restored')),
  context     jsonb,
  created_at  timestamptz not null default now()
);

-- dish_audit_events
create table if not exists public.dish_audit_events (
  id         uuid        primary key default gen_random_uuid(),
  dish_id    uuid        not null references public.dishes(id) on delete cascade,
  user_id    uuid        references public.users(id) on delete set null,
  event_type text        not null,
  context    jsonb,
  created_at timestamptz not null default now()
);

-- user_profile_audit_events
create table if not exists public.user_profile_audit_events (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references public.users(id) on delete set null,
  event_type text        not null check (event_type in ('profile_updated', 'avatar_changed')),
  context    jsonb,
  created_at timestamptz not null default now()
);

-- collection_audit_events (collection_id has no FK intentionally)
create table if not exists public.collection_audit_events (
  id            uuid        primary key default gen_random_uuid(),
  collection_id uuid        not null,
  user_id       uuid        references public.users(id) on delete set null,
  event_type    text        not null check (event_type in (
                  'created', 'renamed', 'deleted', 'visibility_changed', 'item_added', 'item_removed')),
  context       jsonb,
  created_at    timestamptz not null default now()
);

-- feature_flag_audit_events
create table if not exists public.feature_flag_audit_events (
  id         uuid        primary key default gen_random_uuid(),
  flag_name  text        not null,
  user_id    uuid        references public.users(id) on delete set null,
  event_type text        not null check (event_type in (
               'override_created', 'override_updated', 'override_removed')),
  context    jsonb       not null,
  created_at timestamptz not null default now()
);

-- saved_search_audit_events (saved_search_id has no FK intentionally)
create table if not exists public.saved_search_audit_events (
  id              uuid        primary key default gen_random_uuid(),
  saved_search_id uuid        not null,
  user_id         uuid        references public.users(id) on delete set null,
  event_type      text        not null check (event_type in (
                    'saved_search_created', 'saved_search_updated', 'saved_search_removed')),
  context         jsonb       not null,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- OSM IMPORT RUNS
-- ---------------------------------------------------------------------------

create table if not exists public.osm_import_runs (
  id           uuid        primary key default gen_random_uuid(),
  state        text        not null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  imported     integer     not null default 0,
  updated      integer     not null default 0,
  skipped      integer     not null default 0,
  report       jsonb
);

-- ---------------------------------------------------------------------------
-- PLACE DOMAIN TABLES
-- ---------------------------------------------------------------------------

-- place_contact: owned by contact enrichment features
create table if not exists public.place_contact (
  place_id                 uuid        primary key references public.places(id) on delete cascade,
  phone                    text,
  website                  text,
  instagram_url            text,
  facebook_url             text,
  tiktok_url               text,
  last_verified_at         timestamptz,
  last_owner_update_at     timestamptz,
  last_community_update_at timestamptz,
  updated_at               timestamptz not null default now()
);

-- place_features: aggregation table for venue characteristics
-- (accessibility, dietary, payments grouped for convenience; may split in a future migration)
create table if not exists public.place_features (
  place_id        uuid        primary key references public.places(id) on delete cascade,
  wheelchair      text,
  outdoor_seating boolean,
  takeaway        boolean,
  delivery        boolean,
  dietary_flags   text[],
  payment_methods text[],
  smoking         text,
  internet_access text,
  capacity        integer,
  updated_at      timestamptz not null default now()
);

-- place_provider_metadata: owned by import/enrichment pipelines only
create table if not exists public.place_provider_metadata (
  place_id            uuid        primary key references public.places(id) on delete cascade,
  amenity_type        text,
  brand               text,
  brand_wikidata      text,
  operator            text,
  price_level         integer,
  floor_level         text,
  start_date          text,
  wikidata_id         text,
  wikipedia_url       text,
  image_url           text,
  description         text,
  alt_names           jsonb,
  state               text,
  postcode            text,
  osm_import_run_id   uuid        references public.osm_import_runs(id),
  osm_imported_at     timestamptz,
  osm_check_date      date,
  last_osm_sync_at    timestamptz,
  last_google_sync_at timestamptz,
  raw_osm_tags        jsonb,      -- archive only; never use in WHERE/ORDER BY of search queries
  updated_at          timestamptz not null default now()
);

-- place_stats: derived cache; events (posts, saves, etc.) are truth
create table if not exists public.place_stats (
  place_id         uuid          primary key references public.places(id) on delete cascade,
  post_count       integer       not null default 0,
  save_count       integer       not null default 0,
  collection_count integer       not null default 0,
  visit_count      integer       not null default 0,
  trending_score   numeric(6,3)  not null default 0,
  last_activity_at timestamptz,
  updated_at       timestamptz   not null default now()
);

-- place_aliases: highest ROI for search quality; expand without code changes
create table if not exists public.place_aliases (
  id         uuid        primary key default gen_random_uuid(),
  place_id   uuid        not null references public.places(id) on delete cascade,
  alias      text        not null,
  source     text        not null check (source in ('osm', 'community', 'admin', 'cuisine_taxonomy')),
  created_at timestamptz not null default now()
);

-- place_traits: community-inferred vibes; controlled enum vocabulary
create table if not exists public.place_traits (
  id         uuid                    primary key default gen_random_uuid(),
  place_id   uuid                    not null references public.places(id) on delete cascade,
  trait_slug public.place_trait_slug not null,
  confidence numeric(3,2)            not null default 0.50,
  source     text                    not null check (source in ('community', 'admin', 'ai')),
  created_at timestamptz             not null default now()
);

-- place_merge_log: safe deduplication history
create table if not exists public.place_merge_log (
  id             uuid        primary key default gen_random_uuid(),
  old_place_id   uuid        not null,   -- intentionally not a FK; old place is soft-deleted
  new_place_id   uuid        not null references public.places(id) on delete cascade,
  merged_by      uuid        references public.users(id) on delete set null,
  reason         text,
  created_at     timestamptz not null default now()
);

-- place_sources: raw provider payloads (selective retention)
create table if not exists public.place_sources (
  id         uuid        primary key default gen_random_uuid(),
  place_id   uuid        not null references public.places(id) on delete cascade,
  source     text        not null check (source in ('osm', 'google', 'owner', 'user', 'admin')),
  payload    jsonb       not null,
  fetched_at timestamptz not null default now()
);

-- place_opening_hours: source priority owner > community > google > osm
create table if not exists public.place_opening_hours (
  id         uuid        primary key default gen_random_uuid(),
  place_id   uuid        not null references public.places(id) on delete cascade,
  source     text        not null check (source in ('osm', 'google', 'owner', 'community')),
  hours_text text,
  hours_json jsonb,
  is_current boolean     not null default true,
  confidence numeric(3,2) default 0.50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- search_analytics: what users actually search for; feeds product roadmap
create table if not exists public.search_analytics (
  id               uuid             primary key default gen_random_uuid(),
  user_id          uuid             references public.users(id) on delete set null,
  query            text             not null,
  results_count    integer          not null default 0,
  clicked_place_id uuid             references public.places(id) on delete set null,
  filters          jsonb,
  session_id       text,
  search_lat       double precision,
  search_lng       double precision,
  search_region    text,
  created_at       timestamptz      not null default now()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- posts
create index if not exists posts_not_deleted_idx on public.posts (created_at desc) where deleted_at is null;
create index if not exists posts_must_order_trgm_idx on public.posts using gin (must_order extensions.gin_trgm_ops);
create index if not exists posts_search_tsv_gin on public.posts using gin (search_tsv);
create index if not exists post_embeddings_hnsw on public.post_embeddings using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists posts_taste_verdict_idx on public.posts (taste_verdict);
create index if not exists posts_dish_id_idx on public.posts (dish_id) where dish_id is not null;

-- post_photos
create index if not exists post_photos_processing_status_idx on public.post_photos (processing_status);

-- comments
create index if not exists comments_not_deleted_idx on public.comments (post_id, created_at) where deleted_at is null;
create index if not exists comments_parent_id_idx on public.comments (parent_id);

-- places
create index if not exists idx_places_google_place_id on public.places (google_place_id);
create index if not exists idx_places_lower_name on public.places (lower(name));
create index if not exists idx_places_city on public.places (city);
create index if not exists idx_places_cuisine_type on public.places (cuisine_type);
create index if not exists places_geog_idx on public.places using gist (place_geog)
  where place_geog is not null;
create index if not exists places_search_tsv_idx on public.places using gin (
  to_tsvector('simple',
    coalesce(name, '') || ' ' ||
    coalesce(cuisine_type, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(address, '')
  )
);
create index if not exists places_embedding_idx on public.places using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;
-- OSM schema indexes on places
create index if not exists idx_places_osm_id on public.places (osm_id) where osm_id is not null;
create index if not exists idx_places_verification_level on public.places (verification_level);
create index if not exists idx_places_status on public.places (place_status);
create index if not exists idx_places_deleted_at on public.places (deleted_at) where deleted_at is not null;
create index if not exists idx_places_cuisine_slug on public.places (cuisine_slug) where cuisine_slug is not null;
create index if not exists idx_places_slug on public.places (slug) where slug is not null;
create index if not exists idx_places_active on public.places (id) where place_status = 'active' and deleted_at is null;
-- place_contact
create index if not exists idx_place_contact_website on public.place_contact (lower(website)) where website is not null;
-- place_features
create index if not exists idx_place_features_wheelchair on public.place_features (wheelchair) where wheelchair is not null;
create index if not exists idx_place_features_dietary on public.place_features using gin (dietary_flags) where dietary_flags is not null;
create index if not exists idx_place_features_payment on public.place_features using gin (payment_methods) where payment_methods is not null;
-- place_provider_metadata
create index if not exists idx_ppm_amenity_type on public.place_provider_metadata (amenity_type) where amenity_type is not null;
create index if not exists idx_ppm_wikidata_id on public.place_provider_metadata (wikidata_id) where wikidata_id is not null;
create index if not exists idx_ppm_brand on public.place_provider_metadata (lower(brand)) where brand is not null;
create index if not exists idx_ppm_state on public.place_provider_metadata (state) where state is not null;
create index if not exists idx_ppm_alt_names on public.place_provider_metadata using gin (alt_names) where alt_names is not null;
-- place_stats
create index if not exists idx_place_stats_trending on public.place_stats (trending_score desc);
create index if not exists idx_place_stats_post_count on public.place_stats (post_count desc);
-- place_aliases
create unique index if not exists place_aliases_uniq on public.place_aliases (place_id, lower(alias));
create index if not exists idx_place_aliases_alias on public.place_aliases using gin (to_tsvector('simple', alias));
-- place_traits
create unique index if not exists place_traits_uniq on public.place_traits (place_id, trait_slug);
create index if not exists idx_place_traits_slug on public.place_traits (trait_slug);
-- place_sources
create index if not exists idx_place_sources_place_id on public.place_sources (place_id);
create index if not exists idx_place_sources_source on public.place_sources (source);
-- place_opening_hours
create unique index if not exists place_opening_hours_current_uniq on public.place_opening_hours (place_id, source) where is_current = true;
-- search_analytics
create index if not exists idx_search_analytics_query on public.search_analytics (lower(query));
create index if not exists idx_search_analytics_created_at on public.search_analytics (created_at);

-- analytics_events
create index if not exists idx_analytics_entity on public.analytics_events (entity_type, entity_id, created_at desc);
create index if not exists idx_analytics_type_created on public.analytics_events (event_type, created_at desc);
create index if not exists idx_analytics_retention on public.analytics_events (created_at desc);

-- collections
create index if not exists collections_user_visibility_idx on public.collections (user_id, visibility, updated_at desc);
create index if not exists collection_items_target_idx on public.collection_items (target_type, target_id);

-- conversations / messages
create index if not exists conversations_updated_at_idx on public.conversations (updated_at desc);
create index if not exists conversation_participants_user_idx on public.conversation_participants (user_id, conversation_id);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at desc);

-- post_drafts
create index if not exists post_drafts_user_status_updated_idx on public.post_drafts (user_id, status, updated_at desc);
create index if not exists post_draft_media_draft_order_idx on public.post_draft_media (draft_id, order_index);

-- post_edit_events
create index if not exists post_edit_events_post_created_idx on public.post_edit_events (post_id, created_at desc);
create index if not exists post_edit_events_user_created_idx on public.post_edit_events (user_id, created_at desc);

-- dishes
create unique index if not exists dishes_name_place_uniq on public.dishes (name_normalized, place_id);
create index if not exists dishes_name_trgm_idx on public.dishes using gin (name extensions.gin_trgm_ops);
create index if not exists dishes_search_tsv_idx on public.dishes using gin (search_tsv);
create index if not exists dishes_place_id_idx on public.dishes (place_id);

-- saved_dishes
create index if not exists saved_dishes_user_created_idx on public.saved_dishes (user_id, created_at desc);
create index if not exists saved_dishes_dish_idx on public.saved_dishes (dish_id);

-- suburb_lookups
create unique index if not exists suburb_lookups_name_state_uidx on public.suburb_lookups (lower(name), coalesce(state, ''));
create index if not exists suburb_lookups_name_trgm_idx on public.suburb_lookups using gin (name extensions.gin_trgm_ops);
create index if not exists suburb_lookups_lower_name_idx on public.suburb_lookups (lower(name));

-- trending_searches
create index if not exists trending_searches_score_idx on public.trending_searches (score desc);

-- saved_searches
create index if not exists saved_searches_user_created_idx on public.saved_searches (user_id, created_at desc);

-- user_top_spots
create index if not exists user_top_spots_user_position on public.user_top_spots (user_id, position asc);

-- place_stubs
create index if not exists place_stubs_expires_at_idx on public.place_stubs (expires_at);

-- restaurant_sources
create unique index if not exists idx_restaurant_sources_unique_source on public.restaurant_sources (source_type, source_id)
  where source_id is not null;
create index if not exists idx_restaurant_sources_restaurant on public.restaurant_sources (restaurant_id);

-- restaurant_audit_events
create index if not exists idx_restaurant_audit_events_restaurant on public.restaurant_audit_events (restaurant_id, created_at desc);

-- restaurant_ownership_events
create index if not exists idx_restaurant_ownership_events_restaurant on public.restaurant_ownership_events (restaurant_id, created_at desc);
create index if not exists idx_restaurant_ownership_events_actor on public.restaurant_ownership_events (actor_id, created_at desc);

-- restaurant_aliases
create unique index if not exists idx_restaurant_aliases_provider_place on public.restaurant_aliases (provider, provider_place_id)
  where provider is not null and provider_place_id is not null;

-- content_reports
create index if not exists content_reports_status_created_idx on public.content_reports (status, created_at desc);
create index if not exists content_reports_target_idx on public.content_reports (target_type, target_id);

-- feature_flag overrides
create index if not exists idx_feature_flag_overrides_active on public.feature_flag_overrides (flag_name)
  where expires_at is null or expires_at > now();

-- audit event tables
create index if not exists auth_audit_events_user_id_idx on public.auth_audit_events (user_id);
create index if not exists auth_audit_events_created_at_idx on public.auth_audit_events (created_at desc);
create index if not exists auth_audit_events_event_type_idx on public.auth_audit_events (event_type, created_at desc);

create index if not exists content_lifecycle_events_entity_idx on public.content_lifecycle_events (entity_type, entity_id);
create index if not exists content_lifecycle_events_user_id_idx on public.content_lifecycle_events (user_id);
create index if not exists content_lifecycle_events_created_at_idx on public.content_lifecycle_events (created_at desc);

create index if not exists dish_audit_events_dish_id_idx on public.dish_audit_events (dish_id);
create index if not exists dish_audit_events_user_id_idx on public.dish_audit_events (user_id);
create index if not exists dish_audit_events_created_at_idx on public.dish_audit_events (created_at desc);

create index if not exists user_profile_audit_events_user_id_idx on public.user_profile_audit_events (user_id);
create index if not exists user_profile_audit_events_created_at_idx on public.user_profile_audit_events (created_at desc);
create index if not exists user_profile_audit_events_event_type_idx on public.user_profile_audit_events (event_type, created_at desc);

create index if not exists collection_audit_events_collection_id_idx on public.collection_audit_events (collection_id);
create index if not exists collection_audit_events_user_id_idx on public.collection_audit_events (user_id);
create index if not exists collection_audit_events_created_at_idx on public.collection_audit_events (created_at desc);

create index if not exists feature_flag_audit_events_flag_name_idx on public.feature_flag_audit_events (flag_name, created_at desc);
create index if not exists feature_flag_audit_events_user_id_idx on public.feature_flag_audit_events (user_id);
create index if not exists feature_flag_audit_events_created_at_idx on public.feature_flag_audit_events (created_at desc);

create index if not exists saved_search_audit_events_saved_search_idx on public.saved_search_audit_events (saved_search_id, created_at desc);
create index if not exists saved_search_audit_events_user_id_idx on public.saved_search_audit_events (user_id);
create index if not exists saved_search_audit_events_created_at_idx on public.saved_search_audit_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Additional tables (restaurant compliance graph)
-- ---------------------------------------------------------------------------

create table if not exists public.restaurant_merge_events (
  id                      uuid          default gen_random_uuid() primary key,
  canonical_restaurant_id uuid          not null references public.places(id) on delete cascade,
  merged_restaurant_id    uuid          references public.places(id) on delete set null,
  actor_id                uuid          references public.users(id) on delete set null,
  reason                  text          not null,
  confidence              numeric(3,2)  not null default 0.50,
  before_summary          jsonb         not null default '{}'::jsonb,
  after_summary           jsonb         not null default '{}'::jsonb,
  rollback_reference      text,
  audit_event_id          uuid          references public.restaurant_audit_events(id) on delete set null,
  created_at              timestamptz   not null default now()
);

create index if not exists idx_restaurant_merge_events_canonical
  on public.restaurant_merge_events (canonical_restaurant_id, created_at desc);


-- ---------------------------------------------------------------------------
-- FUNCTIONS
-- ---------------------------------------------------------------------------

-- accept_message_request
create or replace function public.accept_message_request(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.conversation_participants
  set
    request_status = 'active',
    request_decided_at = now(),
    archived_at = null
  where conversation_id = p_conversation_id
    and user_id = actor_id
    and request_status = 'request';

  if not found then
    raise exception 'not_request';
  end if;

  update public.conversations c
  set status = 'active'
  where c.id = p_conversation_id
    and c.status = 'request'
    and not exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = c.id
        and cp.request_status = 'request'
    );
end;
$$;

-- add_saved_target_to_collection
create or replace function public.add_saved_target_to_collection(
  p_collection_id uuid,
  p_target_type text,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1 from public.collections c
    where c.id = p_collection_id and c.user_id = current_user_id
  ) then
    raise exception 'collection_not_owned';
  end if;

  if p_target_type = 'dish' then
    if not exists (select 1 from public.dishes d where d.id = p_target_id) then
      raise exception 'dish_not_found';
    end if;
    insert into public.saved_dishes (user_id, dish_id)
    values (current_user_id, p_target_id)
    on conflict (user_id, dish_id) do nothing;
  elsif p_target_type = 'post' then
    if not exists (select 1 from public.posts p where p.id = p_target_id and p.deleted_at is null) then
      raise exception 'post_not_found';
    end if;
    insert into public.saves (user_id, post_id)
    values (current_user_id, p_target_id)
    on conflict (user_id, post_id) do nothing;
  elsif p_target_type = 'place' then
    if not exists (select 1 from public.places p where p.id = p_target_id) then
      raise exception 'place_not_found';
    end if;
    insert into public.saved_places (user_id, place_id)
    values (current_user_id, p_target_id)
    on conflict (user_id, place_id) do nothing;
  else
    raise exception 'invalid_target_type';
  end if;

  insert into public.collection_items (collection_id, target_type, target_id)
  values (p_collection_id, p_target_type, p_target_id)
  on conflict (collection_id, target_type, target_id) do nothing;
end;
$$;

-- auth_audit_log_trigger
CREATE OR REPLACE FUNCTION public.auth_audit_log_trigger()
RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_provider  text;
  v_event     text;
  v_user_id   uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- BEFORE DELETE: capture account_deleted before cascade removes public.users row.
    -- ON DELETE SET NULL on auth_audit_events.user_id will NULL it out post-cascade — correct per ADR 0011.
    BEGIN
      PERFORM public.record_auth_audit_event_server(OLD.id, 'account_deleted', NULL);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE path
  v_user_id := NEW.id;
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at) THEN
    v_event := CASE WHEN v_provider = 'email' THEN 'login_email_success' ELSE 'login_oauth_success' END;
    BEGIN
      PERFORM public.record_auth_audit_event_server(
        v_user_id, v_event, jsonb_build_object('provider', v_provider, 'source', 'server')
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    BEGIN
      PERFORM public.record_auth_audit_event_server(
        v_user_id, 'password_changed', jsonb_build_object('source', 'server')
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- create_group_conversation
create or replace function public.create_group_conversation(
  p_name text,
  p_member_ids uuid[],
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  creator_id uuid := auth.uid();
  v_conversation_id uuid;
  v_member_id uuid;
  v_clean_name text := btrim(coalesce(p_name, ''));
  member_follows_creator boolean;
  member_request_status text;
begin
  if creator_id is null then
    raise exception 'not_authenticated';
  end if;

  if char_length(v_clean_name) < 1 or char_length(v_clean_name) > 100 then
    raise exception 'invalid_group_name';
  end if;

  if array_length(p_member_ids, 1) is null or array_length(p_member_ids, 1) < 2 then
    raise exception 'insufficient_members';
  end if;

  insert into public.conversations (created_by, conversation_type, name, avatar_url, status)
  values (creator_id, 'group', v_clean_name, p_avatar_url, 'active')
  returning id into v_conversation_id;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    is_admin,
    last_read_at,
    request_status
  )
  values (v_conversation_id, creator_id, true, now(), 'active');

  foreach v_member_id in array p_member_ids loop
    if v_member_id <> creator_id then
      select exists (
        select 1
        from public.follows
        where follower_id = v_member_id
          and following_id = creator_id
      ) into member_follows_creator;

      member_request_status := case when member_follows_creator then 'active' else 'request' end;

      insert into public.conversation_participants (
        conversation_id,
        user_id,
        is_admin,
        request_status,
        requested_by,
        requested_at
      )
      values (
        v_conversation_id,
        v_member_id,
        false,
        member_request_status,
        case when member_request_status = 'request' then creator_id else null end,
        case when member_request_status = 'request' then now() else null end
      )
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end loop;

  insert into public.messages (conversation_id, sender_id, message_type, attachment_metadata)
  values (
    v_conversation_id,
    creator_id,
    'system',
    jsonb_build_object('event', 'group_created', 'actor', creator_id, 'name', v_clean_name)
  );

  return v_conversation_id;
end;
$$;

-- create_user_place
create or replace function public.create_user_place(
  p_name text,
  p_address text default null,
  p_city text default null,
  p_country text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_cuisine_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_place_id uuid;
begin
  if v_user_id is null then
    raise exception 'authenticated user required';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'place name is required';
  end if;

  insert into public.places (
    name,
    address,
    city,
    country,
    latitude,
    longitude,
    cuisine_type,
    created_by,
    canonical_source,
    metadata_confidence,
    verification_status,
    metadata_source_priority,
    primary_photo_source
  )
  values (
    trim(p_name),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_country, '')), ''),
    p_latitude,
    p_longitude,
    nullif(trim(coalesce(p_cuisine_type, '')), ''),
    v_user_id,
    'user_created',
    0.55,
    'community_pending',
    'rekkus_first',
    'rekkus_post'
  )
  returning id into v_place_id;

  insert into public.restaurant_sources (
    restaurant_id,
    source_type,
    source_id,
    source_payload,
    source_rights,
    attribution_required,
    cacheability,
    retention_policy,
    confidence,
    created_by
  )
  values (
    v_place_id,
    'user_created',
    v_place_id::text,
    jsonb_build_object('name', trim(p_name), 'city', nullif(trim(coalesce(p_city, '')), '')),
    'first_party_user_submission',
    false,
    'first_party',
    'retain_until_unlinked_or_restaurant_deleted',
    0.55,
    v_user_id
  );

  insert into public.restaurant_audit_events (
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    restaurant_id,
    source_type,
    reason,
    after_summary,
    compliance_category
  )
  values (
    'user',
    v_user_id,
    'place_created',
    'place',
    v_place_id,
    v_place_id,
    'user_created',
    'first_party_restaurant_submission',
    jsonb_build_object('name', trim(p_name), 'verification_status', 'community_pending'),
    'place_data_independence'
  );

  return v_place_id;
end;
$$;

-- current_user_in_conversation
create or replace function public.current_user_in_conversation(p_conversation_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
      and request_status <> 'declined'
  );
$$;

-- decline_message_request
create or replace function public.decline_message_request(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  conv_type text;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select conversation_type into conv_type
  from public.conversations
  where id = p_conversation_id;

  update public.conversation_participants
  set
    request_status = 'declined',
    request_decided_at = now(),
    archived_at = now()
  where conversation_id = p_conversation_id
    and user_id = actor_id
    and request_status = 'request';

  if not found then
    raise exception 'not_request';
  end if;

  if conv_type = 'direct' then
    update public.conversations
    set status = 'blocked'
    where id = p_conversation_id;
  end if;
end;
$$;

-- delete_comment
create or replace function public.delete_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;
  update public.comments
    set deleted_at = now(), deleted_reason = 'user_deleted'
    where id = p_comment_id and user_id = actor_id and deleted_at is null;
end; $$;

-- delete_message
create or replace function public.delete_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.messages
  set
    deleted_at = now(),
    body = null,
    attachment_url = null,
    attachment_metadata = null
  where id = p_message_id
    and sender_id = actor_id
    and deleted_at is null;
end;
$$;

-- delete_own_account
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Bulk-insert lifecycle events for all live posts before cascade removes them.
  -- content_lifecycle_events.user_id is ON DELETE SET NULL — capture it now.
  -- Soft-deleted posts (deleted_at IS NOT NULL) already have a lifecycle event — skip.
  INSERT INTO public.content_lifecycle_events (entity_type, entity_id, user_id, event_type, context)
  SELECT 'post', id, v_user_id, 'deleted',
         jsonb_build_object('reason', 'account_deleted')
  FROM public.posts
  WHERE user_id = v_user_id
    AND deleted_at IS NULL;

  -- Delete the auth row. Fires:
  --   1. auth_audit_delete_trigger (BEFORE DELETE) → writes account_deleted to auth_audit_events
  --   2. CASCADE: auth.users → public.users → public.posts (and all ON DELETE CASCADE children)
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- delete_post
create or replace function public.delete_post(p_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;
  -- Wrong post_id or not owner = silent no-op (no information leak)
  update public.posts
    set deleted_at = now(), deleted_reason = 'user_deleted'
    where id = p_post_id and user_id = actor_id and deleted_at is null;
  -- Cascade to photos — post owner owns all photos on the post
  update public.post_photos
    set deleted_at = now()
    where post_id = p_post_id and deleted_at is null;
end; $$;

-- expand_search_cuisines
CREATE OR REPLACE FUNCTION public.expand_search_cuisines(
  query_text text,
  max_cuisines integer DEFAULT 3
)
RETURNS TABLE (
  cuisine_type text,
  match_count integer
)
LANGUAGE sql
STABLE
AS $$
WITH normalized AS (
  SELECT lower(trim(regexp_replace(coalesce(query_text, ''), '[^[:alnum:][:space:]-]', ' ', 'g'))) AS q
),
terms AS (
  SELECT DISTINCT term
  FROM normalized,
  LATERAL regexp_split_to_table(q, '[[:space:]]+') AS term
  WHERE length(term) >= 2
    AND term NOT IN (
      'food', 'restaurant', 'restaurants', 'place', 'places', 'spot', 'spots',
      'the', 'a', 'an', 'in', 'at', 'for', 'and', 'or', 'near', 'with',
      'best', 'good', 'great', 'nice'
    )
),
post_matches AS (
  SELECT DISTINCT p.id, lower(p.cuisine_type) AS cuisine_type
  FROM public.posts p
  LEFT JOIN public.places pl ON pl.id = p.place_id
  LEFT JOIN public.post_hashtags ph ON ph.post_id = p.id
  LEFT JOIN public.hashtags h ON h.id = ph.hashtag_id
  CROSS JOIN normalized n
  WHERE p.cuisine_type IS NOT NULL
    AND trim(p.cuisine_type) <> ''
    AND n.q <> ''
    AND (
      lower(coalesce(p.caption, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(p.must_order, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(p.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.name, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.city, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.address, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(h.name, '')) LIKE '%' || n.q || '%'
      OR EXISTS (
        SELECT 1
        FROM terms t
        WHERE lower(coalesce(p.caption, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(p.must_order, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.name, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.city, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.address, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(h.name, '')) LIKE '%' || t.term || '%'
      )
    )
),
place_matches AS (
  SELECT DISTINCT pl.id, lower(pl.cuisine_type) AS cuisine_type
  FROM public.places pl
  CROSS JOIN normalized n
  WHERE pl.cuisine_type IS NOT NULL
    AND trim(pl.cuisine_type) <> ''
    AND n.q <> ''
    AND (
      lower(coalesce(pl.name, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.city, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.address, '')) LIKE '%' || n.q || '%'
      OR EXISTS (
        SELECT 1
        FROM terms t
        WHERE lower(coalesce(pl.name, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.city, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.address, '')) LIKE '%' || t.term || '%'
      )
    )
),
signals AS (
  SELECT cuisine_type, 2 AS weight FROM post_matches
  UNION ALL
  SELECT cuisine_type, 1 AS weight FROM place_matches
)
SELECT
  initcap(cuisine_type) AS cuisine_type,
  sum(weight)::integer AS match_count
FROM signals
GROUP BY cuisine_type
ORDER BY match_count DESC, cuisine_type ASC
LIMIT greatest(1, least(coalesce(max_cuisines, 3), 10));
$$;

-- feature_flag_audit_trigger
CREATE OR REPLACE FUNCTION public.feature_flag_audit_trigger()
RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'override_created';
    INSERT INTO public.feature_flag_audit_events (flag_name, user_id, event_type, context)
    VALUES (
      NEW.flag_name,
      NEW.updated_by,
      v_event_type,
      jsonb_strip_nulls(jsonb_build_object(
        'operation', TG_OP,
        'source', 'database_trigger',
        'new_enabled', NEW.enabled,
        'new_reason', NEW.reason,
        'new_expires_at', NEW.expires_at
      ))
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_event_type := 'override_updated';
    INSERT INTO public.feature_flag_audit_events (flag_name, user_id, event_type, context)
    VALUES (
      NEW.flag_name,
      NEW.updated_by,
      v_event_type,
      jsonb_strip_nulls(jsonb_build_object(
        'operation', TG_OP,
        'source', 'database_trigger',
        'old_enabled', OLD.enabled,
        'new_enabled', NEW.enabled,
        'old_reason', OLD.reason,
        'new_reason', NEW.reason,
        'old_expires_at', OLD.expires_at,
        'new_expires_at', NEW.expires_at
      ))
    );
    RETURN NEW;
  END IF;

  v_event_type := 'override_removed';
  INSERT INTO public.feature_flag_audit_events (flag_name, user_id, event_type, context)
  VALUES (
    OLD.flag_name,
    NULL,
    v_event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'operation', TG_OP,
      'source', 'database_trigger',
      'old_enabled', OLD.enabled,
      'old_reason', OLD.reason,
      'old_expires_at', OLD.expires_at,
      'previous_updated_by', OLD.updated_by
    ))
  );
  RETURN OLD;
END;
$$;

-- fetch_trending_dishes
create or replace function public.fetch_trending_dishes(
  limit_count int default 10,
  lookback_days int default 7
)
returns table (
  id uuid,
  name text,
  cuisine_type text,
  top_photo_url text,
  save_count bigint,
  post_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with recent_saves as (
    select dish_id, count(*) as recent_save_count
    from saved_dishes
    where created_at >= now() - (lookback_days || ' days')::interval
    group by dish_id
  ),
  recent_posts as (
    select dish_id, count(*) as recent_post_count
    from posts
    where dish_id is not null
      and deleted_at is null
      and created_at >= now() - (lookback_days || ' days')::interval
    group by dish_id
  ),
  trending as (
    select
      coalesce(rs.dish_id, rp.dish_id) as dish_id,
      coalesce(rs.recent_save_count, 0) as recent_save_count,
      coalesce(rp.recent_post_count, 0) as recent_post_count
    from recent_saves rs
    full join recent_posts rp on rp.dish_id = rs.dish_id
  )
  select
    d.id,
    d.name,
    d.cuisine_type,
    (
      select coalesce(pp.processed_url, pp.thumbnail_url)
      from posts p
      join post_photos pp on pp.post_id = p.id and pp.deleted_at is null
      where p.dish_id = d.id
        and p.deleted_at is null
        and pp.media_type = 'image'
      order by p.created_at desc
      limit 1
    ) as top_photo_url,
    (select count(*) from saved_dishes sd where sd.dish_id = d.id) as save_count,
    (select count(*) from posts p where p.dish_id = d.id and p.deleted_at is null) as post_count
  from dishes d
  join trending t on t.dish_id = d.id
  order by (t.recent_save_count * 3 + t.recent_post_count) desc
  limit limit_count
$$;

-- find_or_create_dish
create or replace function public.find_or_create_dish(
  p_name          text,
  p_place_id      uuid,
  p_cuisine_type  text    DEFAULT NULL,
  p_created_by    uuid    DEFAULT NULL,
  p_context       jsonb   DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id         uuid;
  v_normalized text    := lower(trim(p_name));
  v_is_new     boolean := false;
BEGIN
  -- Fast path: dish already exists
  SELECT id INTO v_id
  FROM public.dishes
  WHERE name_normalized = v_normalized
    AND place_id = p_place_id
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Insert, ignoring conflict from concurrent callers
  INSERT INTO public.dishes (name, place_id, cuisine_type, created_by)
  VALUES (p_name, p_place_id, p_cuisine_type, p_created_by)
  ON CONFLICT (name_normalized, place_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    v_is_new := true;
  ELSE
    -- A concurrent insert won the race — fetch its id
    SELECT id INTO v_id
    FROM public.dishes
    WHERE name_normalized = v_normalized
      AND place_id = p_place_id
    LIMIT 1;
  END IF;

  -- Audit only genuinely new dishes
  IF v_is_new THEN
    INSERT INTO public.dish_audit_events (dish_id, user_id, event_type, context)
    VALUES (v_id, p_created_by, 'created', p_context);
  END IF;

  RETURN v_id;
END;
$$;

-- get_or_create_direct_conversation
create or replace function public.get_or_create_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  low_user_id uuid;
  high_user_id uuid;
  existing_conversation_id uuid;
  recipient_follows_sender boolean;
  target_request_status text;
  initial_status text;
begin
  if requester_id is null then
    raise exception 'not_authenticated';
  end if;

  if target_user_id is null or target_user_id = requester_id then
    raise exception 'invalid_target';
  end if;

  if not exists (select 1 from public.users where id = target_user_id) then
    raise exception 'target_not_found';
  end if;

  if exists (
    select 1
    from public.user_blocks
    where (blocker_id = requester_id and blocked_id = target_user_id)
       or (blocker_id = target_user_id and blocked_id = requester_id)
  ) then
    raise exception 'messaging_blocked';
  end if;

  select exists (
    select 1
    from public.follows
    where follower_id = target_user_id
      and following_id = requester_id
  ) into recipient_follows_sender;

  target_request_status := case when recipient_follows_sender then 'active' else 'request' end;
  initial_status := case when target_request_status = 'active' then 'active' else 'request' end;

  if requester_id::text < target_user_id::text then
    low_user_id := requester_id;
    high_user_id := target_user_id;
  else
    low_user_id := target_user_id;
    high_user_id := requester_id;
  end if;

  select id
    into existing_conversation_id
  from public.conversations
  where conversation_type = 'direct'
    and direct_user_low = low_user_id
    and direct_user_high = high_user_id
  limit 1;

  if existing_conversation_id is null then
    insert into public.conversations (
      created_by,
      conversation_type,
      direct_user_low,
      direct_user_high,
      status
    )
    values (
      requester_id,
      'direct',
      low_user_id,
      high_user_id,
      initial_status
    )
    on conflict (direct_user_low, direct_user_high)
      where conversation_type = 'direct'
        and direct_user_low is not null
        and direct_user_high is not null
      do update set updated_at = public.conversations.updated_at
    returning id into existing_conversation_id;
  end if;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    last_read_at,
    request_status
  )
  values (existing_conversation_id, requester_id, now(), 'active')
  on conflict (conversation_id, user_id) do update
    set request_status = case
      when conversation_participants.request_status = 'declined' then 'declined'
      else conversation_participants.request_status
    end;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    request_status,
    requested_by,
    requested_at
  )
  values (
    existing_conversation_id,
    target_user_id,
    target_request_status,
    case when target_request_status = 'request' then requester_id else null end,
    case when target_request_status = 'request' then now() else null end
  )
  on conflict (conversation_id, user_id) do update
    set
      request_status = case
        when conversation_participants.request_status in ('active', 'declined')
          then conversation_participants.request_status
        else excluded.request_status
      end,
      requested_by = case
        when conversation_participants.request_status = 'request' then excluded.requested_by
        else conversation_participants.requested_by
      end,
      requested_at = case
        when conversation_participants.request_status = 'request' then excluded.requested_at
        else conversation_participants.requested_at
      end;

  return existing_conversation_id;
end;
$$;

-- get_personalized_suggestions
create or replace function public.get_personalized_suggestions(
  p_user_id uuid,
  p_failed_query text,
  p_limit integer default 3
)
returns table (
  query text,
  score numeric,
  source text
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      p_user_id as user_id,
      lower(trim(regexp_replace(coalesce(p_failed_query, ''), '\s+', ' ', 'g'))) as failed_query,
      greatest(1, least(coalesce(p_limit, 3), 10)) as result_limit
  ),
  search_history as (
    select
      lower(trim(metadata->>'query')) as query,
      count(*)::numeric * 1.0 as score,
      'search_history'::text as source
    from public.analytics_events, params
    where auth.uid() = params.user_id
      and analytics_events.user_id = params.user_id
      and event_type = 'search_query'
      and created_at >= now() - interval '90 days'
      and metadata ? 'query'
    group by lower(trim(metadata->>'query'))
  ),
  engagement_cuisines as (
    select
      lower(trim(metadata->>'cuisine_type')) as query,
      sum(case event_type when 'post_save' then 3 when 'place_save' then 3 else 1 end)::numeric as score,
      'engagement_cuisine'::text as source
    from public.analytics_events, params
    where auth.uid() = params.user_id
      and analytics_events.user_id = params.user_id
      and event_type in ('post_view', 'post_save', 'place_view', 'place_save')
      and created_at >= now() - interval '90 days'
      and metadata ? 'cuisine_type'
    group by lower(trim(metadata->>'cuisine_type'))
  ),
  saved_post_cuisines as (
    select
      lower(trim(p.cuisine_type)) as query,
      count(*)::numeric * 3.0 as score,
      'saved_post'::text as source
    from public.saves s
    join public.posts p on p.id = s.post_id
    join params on true
    where auth.uid() = params.user_id
      and s.user_id = params.user_id
      and p.cuisine_type is not null
    group by lower(trim(p.cuisine_type))
  ),
  saved_place_cuisines as (
    select
      lower(trim(pl.cuisine_type)) as query,
      count(*)::numeric * 3.0 as score,
      'saved_place'::text as source
    from public.saved_places sl
    join public.places pl on pl.id = sl.place_id
    join params on true
    where auth.uid() = params.user_id
      and sl.user_id = params.user_id
      and pl.cuisine_type is not null
    group by lower(trim(pl.cuisine_type))
  ),
  saved_dish_cuisines as (
    select
      lower(trim(d.cuisine_type)) as query,
      count(*)::numeric * 4.0 as score,
      'saved_dish'::text as source
    from public.saved_dishes sd
    join public.dishes d on d.id = sd.dish_id
    join params on true
    where auth.uid() = params.user_id
      and sd.user_id = params.user_id
      and d.cuisine_type is not null
    group by lower(trim(d.cuisine_type))
  ),
  topic_follows as (
    select
      lower(trim(topic)) as query,
      count(*)::numeric * 2.0 as score,
      'topic_follow'::text as source
    from public.user_topic_follows utf
    join params on true
    where auth.uid() = params.user_id
      and utf.user_id = params.user_id
    group by lower(trim(topic))
  ),
  user_cuisine_terms as (
    select query from engagement_cuisines
    union
    select query from saved_post_cuisines
    union
    select query from saved_place_cuisines
    union
    select query from saved_dish_cuisines
    union
    select query from topic_follows
  ),
  taste_adjacent_trending as (
    select
      lower(trim(ts.query)) as query,
      max(ts.score)::numeric * 0.25 as score,
      'taste_trending'::text as source
    from public.trending_searches ts
    join user_cuisine_terms uct
      on lower(ts.query) like '%' || uct.query || '%'
      or uct.query like '%' || lower(ts.query) || '%'
    where ts.near_city = 'global'
      and ts.user_count >= 2
      and ts.updated_at >= now() - interval '7 days'
    group by lower(trim(ts.query))
  ),
  global_trending as (
    select
      lower(trim(query)) as query,
      max(score)::numeric * 0.05 as score,
      'global_trending'::text as source
    from public.trending_searches
    where near_city = 'global'
      and user_count >= 2
      and updated_at >= now() - interval '7 days'
    group by lower(trim(query))
  ),
  candidates as (
    select * from search_history
    union all select * from engagement_cuisines
    union all select * from saved_post_cuisines
    union all select * from saved_place_cuisines
    union all select * from saved_dish_cuisines
    union all select * from topic_follows
    union all select * from taste_adjacent_trending
    union all select * from global_trending
  ),
  filtered as (
    select
      trim(regexp_replace(query, '\s+', ' ', 'g')) as normalized_query,
      score,
      source
    from candidates, params
    where query is not null
      and length(trim(query)) > 1
      and lower(trim(regexp_replace(query, '\s+', ' ', 'g'))) <> params.failed_query
  ),
  aggregated as (
    select
      normalized_query as query,
      sum(score) as score
    from filtered
    group by normalized_query
  ),
  best_source as (
    select distinct on (normalized_query)
      normalized_query,
      source
    from filtered
    order by normalized_query, score desc, source asc
  )
  select
    aggregated.query,
    aggregated.score,
    best_source.source
  from aggregated
  join best_source on best_source.normalized_query = aggregated.query
  order by aggregated.score desc, aggregated.query asc
  limit (select result_limit from params);
$$;

-- get_recent_search_history
create or replace function public.get_recent_search_history(
  max_results integer default 10,
  lookback_days integer default 30
)
returns table (
  query text,
  last_searched_at timestamptz,
  search_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      trim(metadata->>'query') as query,
      created_at
    from public.analytics_events
    where auth.uid() is not null
      and user_id = auth.uid()
      and event_type = 'search_query'
      and created_at >= now() - make_interval(days => greatest(1, least(coalesce(lookback_days, 30), 365)))
      and metadata ? 'query'
  )
  select
    query,
    max(created_at) as last_searched_at,
    count(*)::integer as search_count
  from normalized
  where query is not null
    and length(query) > 1
  group by lower(query), query
  order by last_searched_at desc, search_count desc
  limit greatest(1, least(coalesce(max_results, 10), 50));
$$;

-- get_search_quality_metrics
create or replace function public.get_search_quality_metrics(
  lookback_days integer default 30
)
returns table (
  day date,
  result_type text,
  result_position integer,
  search_sessions integer,
  query_count integer,
  click_count integer,
  attributed_view_count integer,
  attributed_save_count integer,
  attributed_review_count integer,
  zero_result_count integer,
  reformulation_count integer,
  success_count integer,
  success_rate numeric,
  ctr numeric,
  zero_result_rate numeric,
  reformulation_rate numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select greatest(1, least(coalesce(lookback_days, 30), 90))::integer as days
  ),
  events as (
    select
      ae.created_at,
      ae.event_type,
      ae.metadata,
      ae.metadata->>'search_session_id' as search_session_id,
      ae.metadata->>'result_type' as result_type,
      case
        when (ae.metadata->>'result_position') ~ '^[0-9]+$'
          then (ae.metadata->>'result_position')::integer
        else null::integer
      end as result_position
    from public.analytics_events ae, params
    where ae.created_at >= now() - make_interval(days => params.days)
      and ae.event_type in (
        'search_query',
        'search_result_click',
        'search_session_end',
        'post_view',
        'post_save',
        'place_view',
        'place_save',
        'dish_view',
        'dish_save',
        'post_published'
      )
  ),
  day_keys as (
    select distinct date_trunc('day', created_at)::date as day
    from events
  ),
  dimensions as (
    select day, null::text as result_type, null::integer as result_position
    from day_keys
    union
    select
      date_trunc('day', created_at)::date as day,
      result_type,
      result_position
    from events
    where event_type = 'search_result_click'
      and result_type is not null
      and result_position is not null
  ),
  session_ends as (
    select
      date_trunc('day', created_at)::date as day,
      search_session_id,
      coalesce((metadata->>'had_results')::boolean, false) as had_results,
      coalesce((metadata->>'result_clicked')::boolean, false) as result_clicked
    from events
    where event_type = 'search_session_end'
      and search_session_id is not null
  ),
  attributed_events as (
    select
      date_trunc('day', created_at)::date as day,
      search_session_id,
      result_type,
      result_position,
      event_type
    from events
    where search_session_id is not null
      and event_type in (
        'post_view',
        'post_save',
        'place_view',
        'place_save',
        'dish_view',
        'dish_save',
        'post_published'
      )
  ),
  daily_queries as (
    select
      d.day,
      count(*) filter (where e.event_type = 'search_query')::integer as query_count,
      count(*) filter (
        where e.event_type = 'search_query'
          and e.metadata->>'previous_query' is not null
          and lower(trim(e.metadata->>'previous_query')) <> lower(trim(coalesce(e.metadata->>'query', '')))
      )::integer as reformulation_count
    from day_keys d
    left join events e on date_trunc('day', e.created_at)::date = d.day
    group by d.day
  ),
  daily_sessions as (
    select
      d.day,
      count(distinct se.search_session_id)::integer as search_sessions,
      count(distinct se.search_session_id) filter (where not se.had_results)::integer as zero_result_count,
      count(distinct se.search_session_id) filter (
        where se.result_clicked
          or exists (
            select 1
            from attributed_events attr
            where attr.search_session_id = se.search_session_id
          )
      )::integer as success_count
    from day_keys d
    left join session_ends se on se.day = d.day
    group by d.day
  ),
  daily as (
    select
      q.day,
      q.query_count,
      s.search_sessions,
      s.zero_result_count,
      q.reformulation_count,
      s.success_count
    from daily_queries q
    join daily_sessions s on s.day = q.day
  ),
  dimension_counts as (
    select
      dim.day,
      dim.result_type,
      dim.result_position,
      count(*) filter (
        where e.event_type = 'search_result_click'
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as click_count,
      count(*) filter (
        where e.event_type in ('post_view', 'place_view', 'dish_view')
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as attributed_view_count,
      count(*) filter (
        where e.event_type in ('post_save', 'place_save', 'dish_save')
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as attributed_save_count,
      count(*) filter (
        where e.event_type = 'post_published'
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as attributed_review_count
    from dimensions dim
    left join events e on date_trunc('day', e.created_at)::date = dim.day
    group by dim.day, dim.result_type, dim.result_position
  )
  select
    d.day,
    dc.result_type,
    dc.result_position,
    d.search_sessions,
    d.query_count,
    dc.click_count,
    dc.attributed_view_count,
    dc.attributed_save_count,
    dc.attributed_review_count,
    d.zero_result_count,
    d.reformulation_count,
    d.success_count,
    round(d.success_count * 100.0 / nullif(d.search_sessions, 0), 2) as success_rate,
    round(dc.click_count * 100.0 / nullif(d.query_count, 0), 2) as ctr,
    round(d.zero_result_count * 100.0 / nullif(d.search_sessions, 0), 2) as zero_result_rate,
    round(d.reformulation_count * 100.0 / nullif(d.query_count, 0), 2) as reformulation_rate
  from daily d
  join dimension_counts dc on dc.day = d.day
  order by d.day desc, dc.result_type nulls first, dc.result_position nulls first;
$$;

-- handle_new_auth_user
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username)
  values (new.id, 'u_' || left(replace(new.id::text, '-', ''), 8))
  on conflict (id) do nothing;

  insert into public.user_settings (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- leave_group
create or replace function public.leave_group(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  conv_type text;
  admin_count int;
  member_count int;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select conversation_type into conv_type
  from public.conversations
  where id = p_conversation_id;

  if conv_type <> 'group' then
    raise exception 'not_a_group';
  end if;

  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = actor_id
  ) then
    raise exception 'not_participant';
  end if;

  -- Remove the leaving member
  delete from public.conversation_participants
  where conversation_id = p_conversation_id and user_id = actor_id;

  -- Count remaining members
  select count(*) into member_count
  from public.conversation_participants
  where conversation_id = p_conversation_id;

  if member_count = 0 then
    -- Last member left — archive the conversation
    update public.conversations
    set status = 'archived'
    where id = p_conversation_id;
    return;
  end if;

  -- If no admins remain, auto-promote the longest-standing member
  select count(*) into admin_count
  from public.conversation_participants
  where conversation_id = p_conversation_id and is_admin = true;

  if admin_count = 0 then
    update public.conversation_participants
    set is_admin = true
    where conversation_id = p_conversation_id
      and user_id = (
        select user_id from public.conversation_participants
        where conversation_id = p_conversation_id
        order by created_at asc
        limit 1
      );
  end if;

  -- Post system message
  insert into public.messages (conversation_id, sender_id, message_type, attachment_metadata)
  values (
    p_conversation_id,
    actor_id,
    'system',
    jsonb_build_object('event', 'member_left', 'actor', actor_id)
  );
end;
$$;

-- match_embeddings
create or replace function public.match_embeddings(
  query_embedding extensions.vector(384),
  match_type text,
  match_count integer default 10,
  similarity_threshold real default 0.65
)
returns table (id uuid, similarity real)
language plpgsql stable as $$
begin
  if match_type = 'post' then
    return query
      select p.id, (1 - (pe.embedding <=> query_embedding))::real as similarity
      from public.posts p
      join public.post_embeddings pe on pe.post_id = p.id
      where p.deleted_at is null
        and (1 - (pe.embedding <=> query_embedding)) > similarity_threshold
      order by similarity desc
      limit match_count;
  elsif match_type = 'place' then
    return query
      select p.id, (1 - (p.embedding <=> query_embedding))::real as similarity
      from public.places p
      where p.embedding is not null
        and (1 - (p.embedding <=> query_embedding)) > similarity_threshold
      order by similarity desc
      limit match_count;
  end if;
end;
$$;

-- pin_message
create or replace function public.pin_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  v_conversation_id uuid;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select conversation_id into v_conversation_id
  from public.messages
  where id = p_message_id and deleted_at is null;

  if v_conversation_id is null then
    raise exception 'message_not_found';
  end if;

  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = v_conversation_id and user_id = actor_id
  ) then
    raise exception 'not_participant';
  end if;

  insert into public.conversation_pinned_messages (conversation_id, message_id, pinned_by)
  values (v_conversation_id, p_message_id, actor_id)
  on conflict (conversation_id, message_id) do nothing;
end;
$$;

-- purge_soft_deleted_content
create or replace function public.purge_soft_deleted_content(batch_size int default 1000)
returns int language plpgsql security definer set search_path = public as $$
declare
  total_purged int := 0;
  rows_deleted  int;
begin
  -- Photos first — FK child of posts
  loop
    delete from public.post_photos
      where id in (
        select id from public.post_photos
        where deleted_at is not null
          and deleted_at < now() - interval '30 days'
        limit batch_size
      );
    get diagnostics rows_deleted = row_count;
    total_purged := total_purged + rows_deleted;
    exit when rows_deleted < batch_size;
    perform pg_sleep(0.1);
  end loop;

  loop
    delete from public.comments
      where id in (
        select id from public.comments
        where deleted_at is not null
          and deleted_at < now() - interval '30 days'
        limit batch_size
      );
    get diagnostics rows_deleted = row_count;
    total_purged := total_purged + rows_deleted;
    exit when rows_deleted < batch_size;
    perform pg_sleep(0.1);
  end loop;

  loop
    delete from public.posts
      where id in (
        select id from public.posts
        where deleted_at is not null
          and deleted_at < now() - interval '30 days'
        limit batch_size
      );
    get diagnostics rows_deleted = row_count;
    total_purged := total_purged + rows_deleted;
    exit when rows_deleted < batch_size;
    perform pg_sleep(0.1);
  end loop;

  return total_purged;
end; $$;

-- record_auth_audit_event
CREATE OR REPLACE FUNCTION public.record_auth_audit_event(
  p_event_type text,
  p_context    jsonb DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auth_audit_events (user_id, event_type, context)
  VALUES (auth.uid(), p_event_type, p_context);
END;
$$;

-- record_auth_audit_event_server
CREATE OR REPLACE FUNCTION public.record_auth_audit_event_server(
  p_user_id   uuid,
  p_event_type text,
  p_context    jsonb DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF p_event_type NOT IN (
    'login_email_success', 'login_oauth_success', 'logout', 'password_changed', 'account_deleted'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.auth_audit_events (user_id, event_type, context)
  VALUES (
    -- Resolve via subquery: returns NULL if public profile not yet created (e.g. mid-registration),
    -- avoiding FK violation while still recording the event.
    (SELECT id FROM public.users WHERE id = p_user_id),
    p_event_type,
    p_context
  );
END;
$$;

-- record_collection_audit_event
CREATE OR REPLACE FUNCTION public.record_collection_audit_event(
  p_collection_id uuid,
  p_event_type    text,
  p_context       jsonb DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.collection_audit_events (collection_id, user_id, event_type, context)
  VALUES (p_collection_id, auth.uid(), p_event_type, p_context);
END;
$$;

-- record_content_lifecycle_event
CREATE OR REPLACE FUNCTION public.record_content_lifecycle_event(
  p_entity_type text,
  p_entity_id   uuid,
  p_event_type  text,
  p_context     jsonb DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.content_lifecycle_events (entity_type, entity_id, user_id, event_type, context)
  VALUES (p_entity_type, p_entity_id, auth.uid(), p_event_type, p_context);
END;
$$;

-- record_profile_audit_event
CREATE OR REPLACE FUNCTION public.record_profile_audit_event(
  p_event_type text,
  p_context    jsonb DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profile_audit_events (user_id, event_type, context)
  VALUES (auth.uid(), p_event_type, p_context);
END;
$$;

-- record_restaurant_provider_snapshot
create or replace function public.record_restaurant_provider_snapshot(
  p_restaurant_id uuid,
  p_source_type text,
  p_source_id text,
  p_field_mask text[],
  p_normalized_payload jsonb,
  p_attribution_required boolean,
  p_attribution_text text,
  p_cacheability text,
  p_retention_policy text,
  p_stale_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'authenticated role required';
  end if;

  if p_restaurant_id is null or p_source_type is null or p_source_id is null then
    raise exception 'restaurant_id, source_type, and source_id are required';
  end if;

  insert into public.restaurant_sources (
    restaurant_id,
    source_type,
    source_id,
    source_rights,
    attribution_required,
    cacheability,
    retention_policy,
    confidence,
    created_by,
    updated_at
  )
  values (
    p_restaurant_id,
    p_source_type,
    p_source_id,
    case when p_source_type = 'google_places' then 'provider_google' else 'source_terms_defined' end,
    p_attribution_required,
    p_cacheability,
    p_retention_policy,
    0.70,
    auth.uid(),
    now()
  )
  on conflict (source_type, source_id)
  do update set
    restaurant_id = excluded.restaurant_id,
    attribution_required = excluded.attribution_required,
    cacheability = excluded.cacheability,
    retention_policy = excluded.retention_policy,
    updated_at = now();

  insert into public.restaurant_provider_cache (
    restaurant_id,
    source_type,
    source_id,
    field_mask,
    normalized_payload,
    attribution_required,
    attribution_text,
    cacheability,
    retention_policy,
    freshness_state,
    fetched_at,
    stale_at,
    updated_at
  )
  values (
    p_restaurant_id,
    p_source_type,
    p_source_id,
    p_field_mask,
    coalesce(p_normalized_payload, '{}'::jsonb),
    p_attribution_required,
    p_attribution_text,
    p_cacheability,
    p_retention_policy,
    'fresh',
    now(),
    p_stale_at,
    now()
  )
  on conflict (source_type, source_id)
  do update set
    restaurant_id = excluded.restaurant_id,
    field_mask = excluded.field_mask,
    normalized_payload = excluded.normalized_payload,
    attribution_required = excluded.attribution_required,
    attribution_text = excluded.attribution_text,
    cacheability = excluded.cacheability,
    retention_policy = excluded.retention_policy,
    freshness_state = 'fresh',
    fetched_at = now(),
    stale_at = excluded.stale_at,
    updated_at = now();

  insert into public.restaurant_audit_events (
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    restaurant_id,
    source_type,
    reason,
    after_summary,
    compliance_category
  )
  values (
    'user',
    auth.uid(),
    'provider_snapshot_recorded',
    'restaurant_provider_cache',
    p_restaurant_id,
    p_restaurant_id,
    p_source_type,
    'provider_fallback_or_location_selection',
    jsonb_build_object('source_id', p_source_id, 'field_mask', p_field_mask),
    'provider_data'
  );
end;
$$;

-- refresh_place_popularity_cache
create or replace function public.refresh_place_popularity_cache()
returns void language sql security definer set search_path = public as $$
  insert into public.place_popularity_cache (
    place_id, post_count, interaction_count_30d,
    avg_food_rating, food_rating_count, updated_at
  )
  select
    p.id,
    count(distinct pt.id)::integer,
    count(ae.id) filter (
      where ae.event_type in ('place_click','place_view')
        and ae.created_at >= now() - interval '30 days'
    )::integer,
    avg(pt.food_rating) filter (where pt.food_rating is not null),
    count(pt.id) filter (where pt.food_rating is not null)::integer,
    now()
  from public.places p
  left join public.posts pt on pt.place_id = p.id and pt.deleted_at is null
  left join public.analytics_events ae on ae.entity_id = p.id
  group by p.id
  on conflict (place_id) do update set
    post_count = excluded.post_count,
    interaction_count_30d = excluded.interaction_count_30d,
    avg_food_rating = excluded.avg_food_rating,
    food_rating_count = excluded.food_rating_count,
    updated_at = now();
$$;

-- refresh_trending_queries
create or replace function public.refresh_trending_queries()
returns void language sql security definer set search_path = public as $$
  with recent_searches as (
    select
      trim(metadata->>'query') as query,
      coalesce(nullif(trim(metadata->>'near_city'), ''), 'global') as near_city,
      user_id,
      created_at
    from public.analytics_events
    where event_type = 'search_query'
      and created_at >= now() - interval '24 hours'
      and metadata->>'query' is not null
      and length(trim(metadata->>'query')) >= 2
  ),
  partitioned as (
    select query, 'global'::text as near_city, user_id, created_at
    from recent_searches
    union all
    select query, near_city, user_id, created_at
    from recent_searches
    where lower(near_city) <> 'global'
  )
  insert into public.trending_searches (query, near_city, search_count, user_count, score, updated_at)
  select
    query,
    near_city,
    count(*)::integer as search_count,
    count(distinct user_id)::integer as user_count,
    sum(case when created_at >= now() - interval '6 hours' then 2.0 else 1.0 end)::real as score,
    now()
  from partitioned
  group by query, near_city
  on conflict (query, near_city) do update set
    search_count = excluded.search_count,
    user_count   = excluded.user_count,
    score        = excluded.score,
    updated_at   = now();
$$;

-- resolve_suburb_query
create or replace function public.resolve_suburb_query(input_text text)
returns table (canonical_suburb text, confidence real, lat double precision, lng double precision)
language sql stable as $$
  select canonical_name::text, 1.0::real, sa.lat, sa.lng
  from public.suburb_aliases sa
  where sa.alias = lower(trim(input_text))

  union all

  select sl.name::text,
    extensions.similarity(lower(sl.name), lower(trim(input_text)))::real,
    sl.lat, sl.lng
  from public.suburb_lookups sl
  where extensions.similarity(lower(sl.name), lower(trim(input_text))) > 0.45

  union all

  select distinct p.suburb::text,
    extensions.similarity(lower(p.suburb), lower(trim(input_text)))::real,
    null::double precision, null::double precision
  from public.places p
  where p.suburb is not null
    and extensions.similarity(lower(p.suburb), lower(trim(input_text))) > 0.45

  order by 2 desc
  limit 5;
$$;

-- places_in_bounding_box
create or replace function public.places_in_bounding_box(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  max_results integer default 50
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  cuisine_type text,
  google_place_id text,
  latitude double precision,
  longitude double precision,
  google_rating double precision,
  google_review_count integer,
  open_now boolean
)
language sql
stable
as $$
select
  p.id,
  p.name,
  p.address,
  p.city,
  p.cuisine_type,
  p.google_place_id,
  p.latitude,
  p.longitude,
  p.google_rating::double precision,
  p.google_review_count,
  p.open_now
from public.places p
where p.latitude between least(min_lat, max_lat) and greatest(min_lat, max_lat)
  and p.longitude between least(min_lng, max_lng) and greatest(min_lng, max_lng)
  and (
    p.place_geog is null
    or extensions.ST_Intersects(
      p.place_geog::extensions.geometry,
      extensions.ST_MakeEnvelope(
        least(min_lng, max_lng),
        least(min_lat, max_lat),
        greatest(min_lng, max_lng),
        greatest(min_lat, max_lat),
        4326
      )
    )
  )
order by p.name asc
limit greatest(1, least(coalesce(max_results, 50), 100));
$$;

-- places_within_radius — true circle search using PostGIS ST_DWithin
-- Replaces bounding-box queries for nearby place fetching.
-- distance_km is returned as the true great-circle distance.
create or replace function public.places_within_radius(
  p_lat double precision,
  p_lng double precision,
  p_radius_metres double precision default 2000,
  p_max_results integer default 8
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  cuisine_type text,
  google_place_id text,
  latitude double precision,
  longitude double precision,
  google_rating double precision,
  google_review_count integer,
  open_now boolean,
  distance_km double precision
)
language sql
stable
as $$
select
  p.id,
  p.name,
  p.address,
  p.city,
  p.cuisine_type,
  p.google_place_id,
  p.latitude,
  p.longitude,
  p.google_rating::double precision,
  p.google_review_count,
  p.open_now,
  (extensions.ST_Distance(
    p.place_geog,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography
  ) / 1000.0) as distance_km
from public.places p
where p.place_geog is not null
  and extensions.ST_DWithin(
    p.place_geog,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
    p_radius_metres
  )
order by distance_km asc
limit greatest(1, least(coalesce(p_max_results, 8), 50));
$$;

-- restore_comment
create or replace function public.restore_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.comments
    set deleted_at = null, deleted_reason = null
    where id = p_comment_id;
end; $$;

-- restore_post
create or replace function public.restore_post(p_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.posts
    set deleted_at = null, deleted_reason = null
    where id = p_post_id;
  update public.post_photos
    set deleted_at = null
    where post_id = p_post_id;
end; $$;

-- saved_search_audit_trigger
CREATE OR REPLACE FUNCTION public.saved_search_audit_trigger()
RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'saved_search_created';
    INSERT INTO public.saved_search_audit_events (saved_search_id, user_id, event_type, context)
    VALUES (
      NEW.id,
      NEW.user_id,
      v_event_type,
      jsonb_build_object('operation', TG_OP, 'source', 'database_trigger')
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_event_type := 'saved_search_updated';
    INSERT INTO public.saved_search_audit_events (saved_search_id, user_id, event_type, context)
    VALUES (
      NEW.id,
      NEW.user_id,
      v_event_type,
      jsonb_build_object(
        'operation', TG_OP,
        'source', 'database_trigger',
        'query_changed', OLD.normalized_query IS DISTINCT FROM NEW.normalized_query
      )
    );
    RETURN NEW;
  END IF;

  v_event_type := 'saved_search_removed';
  INSERT INTO public.saved_search_audit_events (saved_search_id, user_id, event_type, context)
  VALUES (
    OLD.id,
    OLD.user_id,
    v_event_type,
    jsonb_build_object('operation', TG_OP, 'source', 'database_trigger')
  );
  RETURN OLD;
END;
$$;

-- search_dishes_full_text
create or replace function public.search_dishes_full_text(
  query text,
  near_lat double precision default null,
  near_lng double precision default null,
  max_results integer default 10
)
returns table (
  id uuid,
  name text,
  cuisine_type text,
  top_photo_url text,
  save_count bigint,
  post_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.name,
    d.cuisine_type,
    (
      select coalesce(pp.processed_url, pp.thumbnail_url)
      from posts p
      join post_photos pp on pp.post_id = p.id and pp.deleted_at is null
      where p.dish_id = d.id
        and p.deleted_at is null
        and pp.media_type = 'image'
      order by p.created_at desc
      limit 1
    ) as top_photo_url,
    (
      select count(*)
      from saved_dishes sd
      where sd.dish_id = d.id
    ) as save_count,
    (
      select count(*)
      from posts p
      where p.dish_id = d.id
        and p.deleted_at is null
    ) as post_count
  from dishes d
  where
    d.search_tsv @@ websearch_to_tsquery('english', search_dishes_full_text.query)
    or extensions.similarity(d.name_normalized, lower(search_dishes_full_text.query)) > 0.3
  order by
    ts_rank(d.search_tsv, websearch_to_tsquery('english', search_dishes_full_text.query)) desc,
    save_count desc
  limit search_dishes_full_text.max_results
$$;

-- search_posts_by_dish
create or replace function public.search_posts_by_dish(
  dish_query text,
  near_lat double precision default null,
  near_lng double precision default null,
  max_results integer default 20
)
returns table (id uuid, rank real, match_source text)
language sql stable as $$
with normalized as (
  select
    trim(coalesce(dish_query, '')) as raw_query,
    websearch_to_tsquery('simple', coalesce(dish_query, '')) as query,
    case
      when near_lat is not null and near_lng is not null
      then extensions.ST_SetSRID(
        extensions.ST_MakePoint(near_lng, near_lat), 4326
      )::extensions.geography
      else null
    end as ref_point
),
dish_tag_text as (
  select p.id,
    coalesce(
      string_agg(elem->>'name', ' ')
        filter (where elem->>'name' is not null),
      ''
    ) as tag_names
  from public.posts p,
    jsonb_array_elements(coalesce(p.dish_tags, '[]'::jsonb)) as elem
  where p.deleted_at is null
  group by p.id
),
fts_results as (
  select
    p.id,
    ts_rank_cd(
      setweight(to_tsvector('simple', coalesce(p.must_order,'') || ' ' || coalesce(dt.tag_names,'')), 'A'),
      normalized.query
    ) * case
      when normalized.ref_point is null or pl.place_geog is null then 1.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 500  then 2.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 1000 then 1.5
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 2000 then 1.25
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 5000 then 1.1
      else 1.0
    end as rank,
    'fts'::text as match_source
  from public.posts p
  cross join normalized
  left join dish_tag_text dt on dt.id = p.id
  left join public.places pl on pl.id = p.place_id
  where normalized.raw_query <> ''
    and p.deleted_at is null
    and p.search_tsv @@ normalized.query
),
trgm_results as (
  select
    p.id,
    extensions.similarity(lower(coalesce(p.must_order,'')), lower(normalized.raw_query)) * case
      when normalized.ref_point is null or pl.place_geog is null then 1.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 500  then 2.0
      else 1.0
    end as rank,
    'trgm'::text as match_source
  from public.posts p
  cross join normalized
  left join public.places pl on pl.id = p.place_id
  where normalized.raw_query <> ''
    and p.deleted_at is null
    and p.must_order is not null
    and extensions.similarity(lower(p.must_order), lower(normalized.raw_query)) > 0.25
    and not exists (select 1 from fts_results f where f.id = p.id)
)
select id, rank, match_source from fts_results
union all
select id, rank, match_source from trgm_results
order by rank desc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

-- search_posts_full_text
create or replace function public.search_posts_full_text(
  query_text text,
  max_results integer default 20,
  offset_val integer default 0,
  near_lat double precision default null,
  near_lng double precision default null
)
returns table (id uuid, rank real)
language sql stable as $$
with normalized as (
  select
    trim(coalesce(query_text, '')) as raw_query,
    websearch_to_tsquery('simple', coalesce(query_text, '')) as query,
    case
      when trim(regexp_replace(
            regexp_replace(lower(coalesce(query_text, '')), '[^a-z0-9\s]', '', 'g'),
            '\s+', ' ', 'g')) = ''
      then null::tsquery
      else to_tsquery('simple',
        replace(
          trim(regexp_replace(
            regexp_replace(lower(coalesce(query_text, '')), '[^a-z0-9\s]', '', 'g'),
            '\s+', ' ', 'g'
          )),
          ' ', ':* & '
        ) || ':*'
      )
    end as prefix_query,
    case
      when near_lat is not null and near_lng is not null
      then extensions.ST_SetSRID(
        extensions.ST_MakePoint(near_lng, near_lat), 4326
      )::extensions.geography
      else null
    end as ref_point
),
hashtag_text as (
  select ph.post_id as id, string_agg(h.name, ' ') as ht_names
  from public.post_hashtags ph
  join public.hashtags h on h.id = ph.hashtag_id
  group by ph.post_id
),
weighted as (
  -- Start from the stored search_tsv (GIN-indexed) and add hashtag enrichment.
  -- Hashtag names live in a joined table so can't be in the generated column;
  -- we add them here at weight B for ranking after the index-filtered set.
  select p.id,
    p.search_tsv ||
    setweight(to_tsvector('simple', coalesce(ht.ht_names,'')), 'B') as tsv,
    p.search_tsv
  from public.posts p
  left join hashtag_text ht on ht.id = p.id
  where p.deleted_at is null
),
-- Phase 1: FTS + prefix path (unchanged from 20260531000000_rename_best_dish_to_must_order.sql)
fts_results as (
  select
    w.id,
    greatest(
      ts_rank_cd(w.tsv, normalized.query),
      case
        when normalized.prefix_query is not null
        then ts_rank_cd(w.tsv, normalized.prefix_query) * 0.8
        else 0.0
      end
    ) * case
      when normalized.ref_point is null or pl.place_geog is null then 1.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 500  then 2.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 1000 then 1.5
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 2000 then 1.25
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 5000 then 1.1
      else 1.0
    end as rank
  from weighted w
  cross join normalized
  left join public.posts p on p.id = w.id
  left join public.places pl on pl.id = p.place_id
  where normalized.raw_query <> ''
    and (
      w.search_tsv @@ normalized.query
      or (normalized.prefix_query is not null and w.search_tsv @@ normalized.prefix_query)
    )
),
-- Phase 2: trigram fallback on must_order — activates ONLY when FTS returned zero rows.
-- Uses posts_must_order_trgm_idx (GIN, gin_trgm_ops).
-- similarity() is symmetric; threshold 0.30 mirrors search_posts_by_dish's trgm_results CTE.
trgm_results as (
  select
    p.id,
    extensions.similarity(lower(coalesce(p.must_order,'')), lower(normalized.raw_query)) * case
      when normalized.ref_point is null or pl.place_geog is null then 1.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 500  then 2.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 1000 then 1.5
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 2000 then 1.25
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 5000 then 1.1
      else 1.0
    end as rank
  from public.posts p
  cross join normalized
  left join public.places pl on pl.id = p.place_id
  where normalized.raw_query <> ''
    and p.deleted_at is null
    and p.must_order is not null
    and not exists (select 1 from fts_results)
    and extensions.similarity(lower(p.must_order), lower(normalized.raw_query)) > 0.30
)
select id, rank from fts_results
union all
select id, rank from trgm_results
order by rank desc, id asc
limit greatest(1, least(coalesce(max_results, 20), 50))
offset greatest(0, coalesce(offset_val, 0));
$$;

-- search_places_full_text
create or replace function public.search_places_full_text(
  query_text text,
  max_results integer default 20,
  near_lat double precision default null,
  near_lng double precision default null,
  suburb_filter text default null
)
returns table (
  id uuid, name text, address text, city text, suburb text,
  cuisine_type text, google_place_id text,
  latitude double precision, longitude double precision,
  google_rating double precision, google_review_count integer,
  open_now boolean, occasion_tags text[], rank real
)
language sql stable as $$
with normalized as (
  select
    trim(coalesce(query_text, '')) as raw_query,
    websearch_to_tsquery('simple', coalesce(query_text, '')) as query,
    -- Prefix query: each sanitised word gets :* so "Tonkat" matches "Tonkatsu".
    -- Same pattern used by suggest_searches autocomplete.
    case
      when trim(regexp_replace(
            regexp_replace(lower(coalesce(query_text, '')), '[^a-z0-9\s]', '', 'g'),
            '\s+', ' ', 'g')) = ''
      then null::tsquery
      else to_tsquery('simple',
        replace(
          trim(regexp_replace(
            regexp_replace(lower(coalesce(query_text, '')), '[^a-z0-9\s]', '', 'g'),
            '\s+', ' ', 'g'
          )),
          ' ', ':* & '
        ) || ':*'
      )
    end as prefix_query,
    case
      when near_lat is not null and near_lng is not null
      then extensions.ST_SetSRID(
        extensions.ST_MakePoint(near_lng, near_lat), 4326
      )::extensions.geography
      else null
    end as ref_point
),
alias_matches as (
  select distinct cuisine_type
  from public.cuisine_aliases, normalized
  where alias <> '' and to_tsvector('simple', alias) @@ normalized.query
),
ranked as (
  select p.*,
    greatest(
      ts_rank(
        to_tsvector('simple',
          coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
          coalesce(p.suburb,'') || ' ' || coalesce(p.city,'') || ' ' || coalesce(p.address,'')
        ),
        normalized.query
      ),
      case
        when normalized.prefix_query is not null
        then ts_rank(
          to_tsvector('simple',
            coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
            coalesce(p.suburb,'') || ' ' || coalesce(p.city,'') || ' ' || coalesce(p.address,'')
          ),
          normalized.prefix_query
        ) * 0.8
        else 0.0
      end
    ) * case
      when normalized.ref_point is null or p.place_geog is null then 1.0
      when extensions.ST_Distance(p.place_geog, normalized.ref_point) < 500  then 2.0
      when extensions.ST_Distance(p.place_geog, normalized.ref_point) < 1000 then 1.5
      when extensions.ST_Distance(p.place_geog, normalized.ref_point) < 2000 then 1.25
      when extensions.ST_Distance(p.place_geog, normalized.ref_point) < 5000 then 1.1
      else 1.0
    end as rank
  from public.places p cross join normalized
  where normalized.raw_query <> ''
    and (suburb_filter is null or lower(p.suburb) = lower(suburb_filter))
    and (
      to_tsvector('simple',
        coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
        coalesce(p.suburb,'') || ' ' || coalesce(p.city,'') || ' ' || coalesce(p.address,'')
      ) @@ normalized.query
      or (
        normalized.prefix_query is not null
        and to_tsvector('simple',
          coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
          coalesce(p.suburb,'') || ' ' || coalesce(p.city,'') || ' ' || coalesce(p.address,'')
        ) @@ normalized.prefix_query
      )
      or lower(coalesce(p.cuisine_type,'')) in (select cuisine_type from alias_matches)
    )
)
select ranked.id, ranked.name, ranked.address, ranked.city, ranked.suburb,
  ranked.cuisine_type, ranked.google_place_id, ranked.latitude, ranked.longitude,
  ranked.google_rating::double precision, ranked.google_review_count,
  ranked.open_now, ranked.occasion_tags, ranked.rank
from ranked
order by rank desc, name asc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

-- send_direct_message
create or replace function public.send_direct_message(
  p_conversation_id uuid,
  p_body text default null,
  p_message_type text default 'text',
  p_attachment_url text default null,
  p_attachment_metadata jsonb default null,
  p_reply_to_message_id uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_id uuid := auth.uid();
  recipient_id uuid;
  clean_body text := btrim(coalesce(p_body, ''));
  inserted_message public.messages;
  conv_status text;
  conv_type text;
begin
  if sender_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_message_type not in ('text', 'image', 'video', 'audio', 'gif', 'sticker', 'file', 'location', 'post_share', 'place_share') then
    raise exception 'invalid_message_type';
  end if;

  if p_message_type = 'text' and (char_length(clean_body) < 1 or char_length(clean_body) > 2000) then
    raise exception 'invalid_message';
  end if;

  if not exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = sender_id
      and request_status = 'active'
  ) then
    raise exception 'not_participant';
  end if;

  select status, conversation_type into conv_status, conv_type
  from public.conversations
  where id = p_conversation_id;

  if conv_status = 'blocked' then
    raise exception 'messaging_blocked';
  end if;

  select user_id
    into recipient_id
  from public.conversation_participants
  where conversation_id = p_conversation_id
    and user_id <> sender_id
  limit 1;

  if recipient_id is not null and exists (
    select 1
    from public.user_blocks
    where (blocker_id = sender_id and blocked_id = recipient_id)
       or (blocker_id = recipient_id and blocked_id = sender_id)
  ) then
    raise exception 'messaging_blocked';
  end if;

  if conv_type = 'direct' and exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id <> sender_id
      and request_status = 'declined'
  ) then
    raise exception 'messaging_blocked';
  end if;

  insert into public.messages (
    conversation_id,
    sender_id,
    body,
    message_type,
    attachment_url,
    attachment_metadata,
    reply_to_message_id
  )
  values (
    p_conversation_id,
    sender_id,
    nullif(clean_body, ''),
    p_message_type,
    p_attachment_url,
    p_attachment_metadata,
    p_reply_to_message_id
  )
  returning * into inserted_message;

  update public.conversations
  set updated_at = inserted_message.created_at
  where id = p_conversation_id;

  return inserted_message;
end;
$$;

-- suggest_searches
create or replace function public.suggest_searches(
  prefix_query text,
  near_lat double precision default null,
  near_lng double precision default null,
  limit_per_type integer default 3
)
returns table (
  suggestion_type text,
  display_text text,
  secondary_text text,
  entity_id uuid,
  score real
)
language sql stable as $$
with prefix as (
  select
    trim(coalesce(prefix_query, '')) as raw,
    case
      when near_lat is not null and near_lng is not null
      then extensions.ST_SetSRID(
        extensions.ST_MakePoint(near_lng, near_lat), 4326
      )::extensions.geography
      else null
    end as ref_point
),
place_matches as (
  select
    'place'::text as suggestion_type,
    p.name as display_text,
    coalesce(p.cuisine_type, p.city, '') as secondary_text,
    p.id as entity_id,
    ts_rank(
      to_tsvector('simple',
        coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
        coalesce(p.suburb,'') || ' ' || coalesce(p.city,'')
      ),
      to_tsquery('simple', replace(trim(prefix.raw),' ',' & ') || ':*')
    ) * case
      when prefix.ref_point is null or p.place_geog is null then 1.0
      when extensions.ST_Distance(p.place_geog, prefix.ref_point) < 1000 then 2.0
      when extensions.ST_Distance(p.place_geog, prefix.ref_point) < 5000 then 1.5
      else 1.0
    end as score
  from public.places p, prefix
  where prefix.raw <> ''
    and to_tsvector('simple',
      coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
      coalesce(p.suburb,'') || ' ' || coalesce(p.city,'')
    ) @@ to_tsquery('simple', replace(trim(prefix.raw),' ',' & ') || ':*')
  order by score desc
  limit limit_per_type
),
dish_matches as (
  select
    'dish'::text as suggestion_type,
    p.must_order as display_text,
    '' as secondary_text,
    null::uuid as entity_id,
    count(*)::real as score
  from public.posts p, prefix
  where prefix.raw <> ''
    and p.must_order is not null
    and p.deleted_at is null
    and to_tsvector('simple', p.must_order)
        @@ to_tsquery('simple', replace(trim(prefix.raw),' ',' & ') || ':*')
  group by p.must_order
  order by score desc
  limit limit_per_type
),
hashtag_matches as (
  select
    'hashtag'::text as suggestion_type,
    h.name as display_text,
    '' as secondary_text,
    null::uuid as entity_id,
    count(ph.post_id)::real as score
  from public.hashtags h
  cross join prefix
  left join public.post_hashtags ph on ph.hashtag_id = h.id
  where prefix.raw <> ''
    and to_tsvector('simple', h.name)
        @@ to_tsquery('simple', replace(trim(prefix.raw),' ',' & ') || ':*')
  group by h.name
  order by score desc
  limit limit_per_type
)
select * from place_matches
union all
select * from dish_matches
union all
select * from hashtag_matches
order by score desc;
$$;

-- trg_users_follower_count
create or replace function public.trg_users_follower_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.users set follower_count = follower_count + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update public.users set follower_count = greatest(0, follower_count - 1) where id = old.following_id;
  end if;
  return null;
end;
$$;

-- trg_users_post_count
create or replace function public.trg_users_post_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' and new.deleted_at is null then
    update public.users set post_count = post_count + 1 where id = new.user_id;
  elsif tg_op = 'DELETE' and old.deleted_at is null then
    update public.users set post_count = greatest(0, post_count - 1) where id = old.user_id;
  elsif tg_op = 'UPDATE' then
    -- soft-delete: deleted_at went from null → non-null
    if old.deleted_at is null and new.deleted_at is not null then
      update public.users set post_count = greatest(0, post_count - 1) where id = new.user_id;
    -- un-delete: deleted_at went from non-null → null
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.users set post_count = post_count + 1 where id = new.user_id;
    end if;
  end if;
  return null;
end;
$$;

-- unpin_message
create or replace function public.unpin_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  v_conversation_id uuid;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select conversation_id into v_conversation_id
  from public.messages
  where id = p_message_id;

  if v_conversation_id is null then
    raise exception 'message_not_found';
  end if;

  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = v_conversation_id and user_id = actor_id
  ) then
    raise exception 'not_participant';
  end if;

  delete from public.conversation_pinned_messages
  where conversation_id = v_conversation_id
    and message_id = p_message_id;
end;
$$;

-- unsave_target
create or replace function public.unsave_target(
  p_target_type text,
  p_target_id uuid,
  p_remove_collection_memberships boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  has_memberships boolean;
begin
  if current_user_id is null then
    raise exception 'authentication_required';
  end if;

  select exists (
    select 1
    from public.collection_items ci
    join public.collections c on c.id = ci.collection_id
    where c.user_id = current_user_id
      and ci.target_type = p_target_type
      and ci.target_id = p_target_id
  ) into has_memberships;

  if has_memberships and not p_remove_collection_memberships then
    raise exception 'target_in_collections';
  end if;

  if p_remove_collection_memberships then
    delete from public.collection_items ci
    using public.collections c
    where ci.collection_id = c.id
      and c.user_id = current_user_id
      and ci.target_type = p_target_type
      and ci.target_id = p_target_id;
  end if;

  if p_target_type = 'dish' then
    delete from public.saved_dishes
    where user_id = current_user_id and dish_id = p_target_id;
  elsif p_target_type = 'post' then
    delete from public.saves
    where user_id = current_user_id and post_id = p_target_id;
  elsif p_target_type = 'place' then
    delete from public.saved_places
    where user_id = current_user_id and place_id = p_target_id;
  else
    raise exception 'invalid_target_type';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------------

drop trigger if exists auth_audit_delete_trigger on public.auth;
CREATE TRIGGER auth_audit_delete_trigger
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auth_audit_log_trigger();

drop trigger if exists auth_audit_login_trigger on public.auth;
CREATE TRIGGER auth_audit_login_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auth_audit_log_trigger();

drop trigger if exists feature_flag_override_audit_trigger on public.feature_flag_overrides;
CREATE TRIGGER feature_flag_override_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.feature_flag_overrides
  FOR EACH ROW EXECUTE FUNCTION public.feature_flag_audit_trigger();

drop trigger if exists trg_follows_update_follower_count on public.follows;
create trigger trg_follows_update_follower_count
  after insert or delete on public.follows
  for each row execute function public.trg_users_follower_count();

drop trigger if exists trg_posts_update_post_count on public.posts;
create trigger trg_posts_update_post_count
  after insert or delete or update of deleted_at on public.posts
  for each row execute function public.trg_users_post_count();

drop trigger if exists saved_searches_audit_trigger on public.saved_searches;
CREATE TRIGGER saved_searches_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.saved_search_audit_trigger();


-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.places enable row level security;
alter table public.posts enable row level security;
alter table public.post_embeddings enable row level security;
alter table public.post_photos enable row level security;
alter table public.hashtags enable row level security;
alter table public.post_hashtags enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.follows enable row level security;
alter table public.comments enable row level security;
alter table public.user_settings enable row level security;
alter table public.saved_places enable row level security;
alter table public.push_tokens enable row level security;
alter table public.analytics_events enable row level security;
alter table public.post_reactions enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.post_drafts enable row level security;
alter table public.post_draft_media enable row level security;
alter table public.post_edit_events enable row level security;
alter table public.dishes enable row level security;
alter table public.saved_dishes enable row level security;
alter table public.suburb_aliases enable row level security;
alter table public.suburb_lookups enable row level security;
alter table public.trending_searches enable row level security;
alter table public.saved_searches enable row level security;
alter table public.user_top_spots enable row level security;
alter table public.place_stubs enable row level security;
alter table public.feature_flag_overrides enable row level security;
alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.moderation_appeals enable row level security;
alter table public.user_trust_profiles enable row level security;
alter table public.restaurant_sources enable row level security;
alter table public.restaurant_provider_cache enable row level security;
alter table public.restaurant_observations enable row level security;
alter table public.restaurant_aliases enable row level security;
alter table public.restaurant_audit_events enable row level security;
alter table public.restaurant_ownership_events enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.auth_audit_events enable row level security;
alter table public.content_lifecycle_events enable row level security;
alter table public.dish_audit_events enable row level security;
alter table public.user_profile_audit_events enable row level security;
alter table public.collection_audit_events enable row level security;
alter table public.feature_flag_audit_events enable row level security;
alter table public.saved_search_audit_events enable row level security;
alter table public.osm_import_runs enable row level security;
alter table public.place_contact enable row level security;
alter table public.place_features enable row level security;
alter table public.place_provider_metadata enable row level security;
alter table public.place_stats enable row level security;
alter table public.place_aliases enable row level security;
alter table public.place_traits enable row level security;
alter table public.place_merge_log enable row level security;
alter table public.place_sources enable row level security;
alter table public.place_opening_hours enable row level security;
alter table public.search_analytics enable row level security;


-- analytics_events
drop policy if exists "aggregate reads public" on analytics_events;
CREATE POLICY "Aggregate reads public" ON analytics_events
  FOR SELECT USING (true);

drop policy if exists "users insert own events" on analytics_events;
CREATE POLICY "Users insert own events" ON analytics_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);


-- public.auth_audit_events
drop policy if exists "no direct client access to auth audit events" on public.auth_audit_events;
CREATE POLICY "No direct client access to auth audit events"
  ON public.auth_audit_events FOR ALL USING (false);


-- public.collection_audit_events
drop policy if exists "no direct client access to collection audit events" on public.collection_audit_events;
CREATE POLICY "No direct client access to collection audit events"
  ON public.collection_audit_events FOR ALL USING (false);


-- public.collection_items
drop policy if exists "users can view own or shareable collection items" on public.collection_items;
create policy "Users can view own or shareable collection items"
  on public.collection_items for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
      and (c.user_id = auth.uid() or c.visibility in ('unlisted', 'public'))
    )
  );

drop policy if exists "users manage own collection items" on public.collection_items;
create policy "Users manage own collection items"
  on public.collection_items for all
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
      and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
      and c.user_id = auth.uid()
    )
  );


-- public.collections
drop policy if exists "users can view own collections" on public.collections;
create policy "Users can view own collections"
  on public.collections for select
  using (auth.uid() = user_id or visibility in ('unlisted', 'public'));

drop policy if exists "users manage own collections" on public.collections;
create policy "Users manage own collections"
  on public.collections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- public.comments
drop policy if exists "anyone can view comments" on public.comments;
create policy "Anyone can view comments" on public.comments for select
  using (deleted_at is null);

drop policy if exists "users can create comments" on public.comments;
create policy "Users can create comments" on public.comments for insert
  with check (user_id = auth.uid());

drop policy if exists "users can manage their own comments" on public.comments;
create policy "Users can manage their own comments" on public.comments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users can update own comments" on public.comments;
create policy "Users can update own comments" on public.comments for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- public.content_lifecycle_events
drop policy if exists "no direct client access to content lifecycle events" on public.content_lifecycle_events;
CREATE POLICY "No direct client access to content lifecycle events"
  ON public.content_lifecycle_events FOR ALL USING (false);


-- public.content_reports
drop policy if exists "authenticated users can create reports" on public.content_reports;
create policy "Authenticated users can create reports" on public.content_reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "users can view their own reports" on public.content_reports;
create policy "Users can view their own reports" on public.content_reports
  for select using (auth.uid() = reporter_id);


-- public.conversation_participants
drop policy if exists "participants can view participants" on public.conversation_participants;
create policy "Participants can view participants"
  on public.conversation_participants for select
  using (current_user_in_conversation(conversation_id));

drop policy if exists "users can join conversations created for them" on public.conversation_participants;
create policy "Users can join conversations created for them"
  on public.conversation_participants for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_participants.conversation_id
      and c.created_by = auth.uid()
    )
  );

drop policy if exists "users can update own read state" on public.conversation_participants;
create policy "Users can update own read state"
  on public.conversation_participants for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- public.conversation_pinned_messages
drop policy if exists "participants can pin messages" on public.conversation_pinned_messages;
create policy "Participants can pin messages"
  on public.conversation_pinned_messages for insert
  with check (
    pinned_by = auth.uid()
    and current_user_in_conversation(conversation_id)
  );

drop policy if exists "participants can unpin messages" on public.conversation_pinned_messages;
create policy "Participants can unpin messages"
  on public.conversation_pinned_messages for delete
  using (current_user_in_conversation(conversation_id));

drop policy if exists "participants can view pinned messages" on public.conversation_pinned_messages;
create policy "Participants can view pinned messages"
  on public.conversation_pinned_messages for select
  using (current_user_in_conversation(conversation_id));


-- public.conversations
drop policy if exists "participants can update conversations" on public.conversations;
create policy "Participants can update conversations"
  on public.conversations for update
  using (current_user_in_conversation(id))
  with check (current_user_in_conversation(id));

drop policy if exists "participants can view conversations" on public.conversations;
create policy "Participants can view conversations"
  on public.conversations for select
  using (current_user_in_conversation(id));

drop policy if exists "users can create conversations" on public.conversations;
create policy "Users can create conversations"
  on public.conversations for insert
  with check (created_by = auth.uid());


-- public.cuisine_aliases
drop policy if exists "anyone can view cuisine aliases" on public.cuisine_aliases;
create policy "Anyone can view cuisine aliases"
    on public.cuisine_aliases for select
    using (true);


-- public.data_repair_events
drop policy if exists "users can submit own repair reports" on public.data_repair_events;
create policy "Users can submit own repair reports"
  on public.data_repair_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and source_type = 'user_report'
    and status = 'reported'
  );

drop policy if exists "users can view own repair reports" on public.data_repair_events;
create policy "Users can view own repair reports"
  on public.data_repair_events for select
  to authenticated
  using (actor_id = auth.uid());


-- public.dish_audit_events
drop policy if exists "no direct client access to dish audit events" on public.dish_audit_events;
CREATE POLICY "No direct client access to dish audit events"
  ON public.dish_audit_events FOR ALL USING (false);


-- public.dishes
drop policy if exists "anyone can view dishes" on public.dishes;
CREATE POLICY "Anyone can view dishes"
  ON public.dishes FOR SELECT USING (true);

drop policy if exists "authenticated users can insert dishes" on public.dishes;
CREATE POLICY "Authenticated users can insert dishes"
  ON public.dishes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- public.feature_flag_audit_events
drop policy if exists "no direct client access to feature flag audit events" on public.feature_flag_audit_events;
CREATE POLICY "No direct client access to feature flag audit events"
  ON public.feature_flag_audit_events FOR ALL USING (false);


-- public.feature_flag_overrides
drop policy if exists "no client feature flag override access" on public.feature_flag_overrides;
CREATE POLICY "No client feature flag override access" ON public.feature_flag_overrides
  FOR ALL
  USING (false)
  WITH CHECK (false);


-- public.follows
drop policy if exists "anyone can view follows" on public.follows;
create policy "Anyone can view follows" on public.follows for select using (true);

drop policy if exists "users can manage their own follows" on public.follows;
create policy "Users can manage their own follows" on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);


-- public.hashtags
drop policy if exists "anyone can view hashtags" on public.hashtags;
create policy "Anyone can view hashtags" on public.hashtags for select using (true);

drop policy if exists "authenticated users can insert hashtags" on public.hashtags;
create policy "Authenticated users can insert hashtags" on public.hashtags for insert with check (auth.role() = 'authenticated');


-- public.likes
drop policy if exists "anyone can view likes" on public.likes;
create policy "Anyone can view likes" on public.likes for select using (true);

drop policy if exists "users can manage their own likes" on public.likes;
create policy "Users can manage their own likes" on public.likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- public.message_deliveries
drop policy if exists "participants can view deliveries" on public.message_deliveries;
create policy "Participants can view deliveries"
  on public.message_deliveries for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_deliveries.message_id
      and current_user_in_conversation(m.conversation_id)
    )
  );

drop policy if exists "users can update own delivery record" on public.message_deliveries;
create policy "Users can update own delivery record"
  on public.message_deliveries for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users can upsert own delivery record" on public.message_deliveries;
create policy "Users can upsert own delivery record"
  on public.message_deliveries for insert
  with check (user_id = auth.uid());


-- public.message_reactions
drop policy if exists "participants can react" on public.message_reactions;
create policy "Participants can react"
  on public.message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
      and current_user_in_conversation(m.conversation_id)
    )
  );

drop policy if exists "participants can view reactions" on public.message_reactions;
create policy "Participants can view reactions"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
      and current_user_in_conversation(m.conversation_id)
    )
  );

drop policy if exists "users can remove own reactions" on public.message_reactions;
create policy "Users can remove own reactions"
  on public.message_reactions for delete
  using (user_id = auth.uid());


-- public.messages
drop policy if exists "participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
        and cp.request_status = 'active'
    )
  );

drop policy if exists "participants can view messages" on public.messages;
create policy "Participants can view messages"
  on public.messages for select
  using (current_user_in_conversation(conversation_id));


-- public.moderation_actions
drop policy if exists "authenticated users can view moderation actions they reported" on public.moderation_actions;
create policy "Authenticated users can view moderation actions they reported" on public.moderation_actions
  for select using (
    exists (
      select 1 from public.content_reports r
      where r.id = report_id and r.reporter_id = auth.uid()
    )
  );


-- public.moderation_appeals
drop policy if exists "users can create moderation appeals" on public.moderation_appeals;
create policy "Users can create moderation appeals" on public.moderation_appeals
  for insert with check (auth.uid() = appellant_id);

drop policy if exists "users can view their own moderation appeals" on public.moderation_appeals;
create policy "Users can view their own moderation appeals" on public.moderation_appeals
  for select using (auth.uid() = appellant_id);


-- public.post_draft_media
drop policy if exists "users can manage their own post draft media" on public.post_draft_media;
create policy "Users can manage their own post draft media" on public.post_draft_media
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- public.post_drafts
drop policy if exists "users can manage their own post drafts" on public.post_drafts;
create policy "Users can manage their own post drafts" on public.post_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- public.post_edit_events
drop policy if exists "users can create their own post edit events" on public.post_edit_events;
create policy "Users can create their own post edit events"
  on public.post_edit_events
  for insert
  with check (
    auth.uid() = user_id
    and auth.uid() = (
      select p.user_id
      from public.posts p
      where p.id = post_id
    )
  );

drop policy if exists "users can view their own post edit events" on public.post_edit_events;
create policy "Users can view their own post edit events"
  on public.post_edit_events
  for select
  using (auth.uid() = user_id);


-- public.post_hashtags
drop policy if exists "anyone can view post hashtags" on public.post_hashtags;
create policy "Anyone can view post hashtags" on public.post_hashtags for select using (true);

drop policy if exists "users can manage hashtags for their posts" on public.post_hashtags;
create policy "Users can manage hashtags for their posts" on public.post_hashtags for all
  using (auth.uid() = (select user_id from public.posts where id = post_id))
  with check (auth.uid() = (select user_id from public.posts where id = post_id));


-- public.post_photos
drop policy if exists "anyone can view post photos" on public.post_photos;
create policy "Anyone can view post photos" on public.post_photos for select
  using (deleted_at is null);

drop policy if exists "users can create post photos" on public.post_photos;
create policy "Users can create post photos" on public.post_photos for insert
  with check (auth.uid() = (select user_id from public.posts where id = post_id));

drop policy if exists "users can manage photos for their posts" on public.post_photos;
create policy "Users can manage photos for their posts" on public.post_photos for all
  using (auth.uid() = (select user_id from public.posts where id = post_id))
  with check (auth.uid() = (select user_id from public.posts where id = post_id));

drop policy if exists "users can update own post photos" on public.post_photos;
create policy "Users can update own post photos" on public.post_photos for update
  using (auth.uid() = (select user_id from public.posts where id = post_id))
  with check (auth.uid() = (select user_id from public.posts where id = post_id));


-- public.post_reactions
drop policy if exists "anyone can view reactions" on public.post_reactions;
CREATE POLICY "Anyone can view reactions" ON public.post_reactions
  FOR SELECT USING (true);

drop policy if exists "users can delete own reactions" on public.post_reactions;
CREATE POLICY "Users can delete own reactions" ON public.post_reactions
  FOR DELETE USING (auth.uid() = user_id);

drop policy if exists "users can insert own reactions" on public.post_reactions;
CREATE POLICY "Users can insert own reactions" ON public.post_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- public.posts
drop policy if exists "anyone can view posts" on public.posts;
create policy "Anyone can view posts" on public.posts for select
  using (deleted_at is null);

drop policy if exists "users can create posts" on public.posts;
create policy "Users can create posts" on public.posts for insert
  with check (user_id = auth.uid());

drop policy if exists "users can manage their own posts" on public.posts;
create policy "Users can manage their own posts" on public.posts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users can update own posts" on public.posts;
create policy "Users can update own posts" on public.posts for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- public.post_embeddings
drop policy if exists "anyone authenticated can view post embeddings" on public.post_embeddings;
create policy "anyone authenticated can view post embeddings"
  on public.post_embeddings for select
  using (auth.role() = 'authenticated');


-- public.privacy_requests
drop policy if exists "users can submit own privacy requests" on public.privacy_requests;
create policy "Users can submit own privacy requests"
  on public.privacy_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can view own privacy requests" on public.privacy_requests;
create policy "Users can view own privacy requests"
  on public.privacy_requests for select
  using (auth.uid() = user_id);


-- public.restaurant_aliases
drop policy if exists "anyone can view restaurant aliases" on public.restaurant_aliases;
create policy "Anyone can view restaurant aliases"
  on public.restaurant_aliases for select
  using (true);

drop policy if exists "users can submit restaurant alias suggestions" on public.restaurant_aliases;
create policy "Users can submit restaurant alias suggestions"
  on public.restaurant_aliases for insert
  to authenticated
  with check (created_by = auth.uid() and status = 'active');


-- public.restaurant_audit_events
drop policy if exists "authenticated users can view restaurant audit events" on public.restaurant_audit_events;
create policy "Authenticated users can view restaurant audit events"
  on public.restaurant_audit_events for select
  to authenticated
  using (true);


-- public.restaurant_merge_events
drop policy if exists "authenticated users can view restaurant merge events" on public.restaurant_merge_events;
create policy "Authenticated users can view restaurant merge events"
  on public.restaurant_merge_events for select
  to authenticated
  using (true);

drop policy if exists "users can submit duplicate restaurant evidence" on public.restaurant_merge_events;
create policy "Users can submit duplicate restaurant evidence"
  on public.restaurant_merge_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and merged_restaurant_id is null
    and rollback_reference = 'no_merge_performed'
  );


-- public.restaurant_observations
drop policy if exists "anyone can view trusted restaurant observations" on public.restaurant_observations;
create policy "Anyone can view trusted restaurant observations"
  on public.restaurant_observations for select
  using (status = 'trusted' or user_id = auth.uid());

drop policy if exists "users can create own restaurant observations" on public.restaurant_observations;
create policy "Users can create own restaurant observations"
  on public.restaurant_observations for insert
  to authenticated
  with check (user_id = auth.uid());


-- public.restaurant_ownership_events
drop policy if exists "authenticated users can view restaurant ownership events" on public.restaurant_ownership_events;
create policy "Authenticated users can view restaurant ownership events"
  on public.restaurant_ownership_events for select
  to authenticated
  using (true);

drop policy if exists "users can submit own restaurant claims" on public.restaurant_ownership_events;
create policy "Users can submit own restaurant claims"
  on public.restaurant_ownership_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and event_type = 'claim_submitted'
    and status = 'pending'
  );


-- public.place_popularity_cache
drop policy if exists "anyone can view place popularity cache" on public.place_popularity_cache;
create policy "Anyone can view place popularity cache"
  on public.place_popularity_cache for select using (true);


-- public.restaurant_provider_cache
drop policy if exists "anyone can view restaurant provider cache" on public.restaurant_provider_cache;
create policy "Anyone can view restaurant provider cache"
  on public.restaurant_provider_cache for select
  using (true);


-- public.restaurant_sources
drop policy if exists "anyone can view restaurant sources" on public.restaurant_sources;
create policy "Anyone can view restaurant sources"
  on public.restaurant_sources for select
  using (true);

drop policy if exists "authenticated users can propose restaurant sources" on public.restaurant_sources;
create policy "Authenticated users can propose restaurant sources"
  on public.restaurant_sources for insert
  to authenticated
  with check (created_by = auth.uid() and source_type in ('user_created', 'owner_submitted'));


-- public.places
drop policy if exists "anyone can view places" on public.places;
create policy "Anyone can view places" on public.places for select using (true);

drop policy if exists "authenticated users can insert places" on public.places;
create policy "Authenticated users can insert places" on public.places for insert with check (auth.role() = 'authenticated');

drop policy if exists "authenticated users can update places" on public.places;
create policy "Authenticated users can update places"
  on public.places for update
  using (auth.role() = 'authenticated');

drop policy if exists "users can view own created place provenance" on public.places;
create policy "Users can view own created place provenance"
  on public.places for select
  to authenticated
  using (created_by = auth.uid());


-- public.place_contact
drop policy if exists "Public read place_contact" on public.place_contact;
create policy "Public read place_contact" on public.place_contact for select using (true);
drop policy if exists "Service role manages place_contact" on public.place_contact;
create policy "Service role manages place_contact" on public.place_contact for all using (auth.role() = 'service_role');

-- public.place_features
drop policy if exists "Public read place_features" on public.place_features;
create policy "Public read place_features" on public.place_features for select using (true);
drop policy if exists "Service role manages place_features" on public.place_features;
create policy "Service role manages place_features" on public.place_features for all using (auth.role() = 'service_role');

-- public.place_provider_metadata
drop policy if exists "Public read place_provider_metadata" on public.place_provider_metadata;
create policy "Public read place_provider_metadata" on public.place_provider_metadata for select using (true);
drop policy if exists "Service role manages place_provider_metadata" on public.place_provider_metadata;
create policy "Service role manages place_provider_metadata" on public.place_provider_metadata for all using (auth.role() = 'service_role');

-- public.place_stats
drop policy if exists "Public read place_stats" on public.place_stats;
create policy "Public read place_stats" on public.place_stats for select using (true);
drop policy if exists "Service role manages place_stats" on public.place_stats;
create policy "Service role manages place_stats" on public.place_stats for all using (auth.role() = 'service_role');

-- public.place_aliases
drop policy if exists "Public read place_aliases" on public.place_aliases;
create policy "Public read place_aliases" on public.place_aliases for select using (true);
drop policy if exists "Service role manages place_aliases" on public.place_aliases;
create policy "Service role manages place_aliases" on public.place_aliases for all using (auth.role() = 'service_role');

-- public.place_traits
drop policy if exists "Public read place_traits" on public.place_traits;
create policy "Public read place_traits" on public.place_traits for select using (true);
drop policy if exists "Service role manages place_traits" on public.place_traits;
create policy "Service role manages place_traits" on public.place_traits for all using (auth.role() = 'service_role');

-- public.place_merge_log
drop policy if exists "Service role manages place_merge_log" on public.place_merge_log;
create policy "Service role manages place_merge_log" on public.place_merge_log for all using (auth.role() = 'service_role');

-- public.place_sources
drop policy if exists "Service role manages place_sources" on public.place_sources;
create policy "Service role manages place_sources" on public.place_sources for all using (auth.role() = 'service_role');

-- public.place_opening_hours
drop policy if exists "Public read place_opening_hours" on public.place_opening_hours;
create policy "Public read place_opening_hours" on public.place_opening_hours for select using (true);
drop policy if exists "Service role manages place_opening_hours" on public.place_opening_hours;
create policy "Service role manages place_opening_hours" on public.place_opening_hours for all using (auth.role() = 'service_role');

-- public.search_analytics
drop policy if exists "Users read own search_analytics" on public.search_analytics;
create policy "Users read own search_analytics" on public.search_analytics for select using (auth.uid() = user_id);
drop policy if exists "Service role manages search_analytics" on public.search_analytics;
create policy "Service role manages search_analytics" on public.search_analytics for all using (auth.role() = 'service_role');
drop policy if exists "Insert search_analytics" on public.search_analytics;
create policy "Insert search_analytics" on public.search_analytics for insert with check (true);

-- public.saved_dishes
drop policy if exists "users manage own saved dishes" on public.saved_dishes;
create policy "Users manage own saved dishes"
  on public.saved_dishes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- public.saved_places
drop policy if exists "users manage own saved places" on public.saved_places;
create policy "Users manage own saved places"
  on public.saved_places for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- public.saved_search_audit_events
drop policy if exists "no direct client access to saved search audit events" on public.saved_search_audit_events;
CREATE POLICY "No direct client access to saved search audit events"
  ON public.saved_search_audit_events FOR ALL USING (false);


-- public.saved_searches
drop policy if exists "users manage own saved searches" on public.saved_searches;
CREATE POLICY "Users manage own saved searches"
  ON public.saved_searches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- public.saves
drop policy if exists "users can manage their own saves" on public.saves;
create policy "Users can manage their own saves" on public.saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users can view their own saves" on public.saves;
create policy "Users can view their own saves" on public.saves for select using (auth.uid() = user_id);


-- public.search_synonyms
drop policy if exists "anyone can read search synonyms" on public.search_synonyms;
create policy "Anyone can read search synonyms"
    on public.search_synonyms for select
    using (true);


-- public.suburb_aliases
drop policy if exists "anyone can read suburb_aliases" on public.suburb_aliases;
create policy "Anyone can read suburb_aliases"
  on public.suburb_aliases for select using (true);


-- public.suburb_lookups
drop policy if exists "anyone can read suburb_lookups" on public.suburb_lookups;
create policy "Anyone can read suburb_lookups"
  on public.suburb_lookups for select using (true);


-- public.trending_searches
drop policy if exists "anyone can read trending_searches" on public.trending_searches;
create policy "Anyone can read trending_searches"
  on public.trending_searches for select using (true);


-- public.user_blocks
drop policy if exists "users can manage their own blocks" on public.user_blocks;
create policy "Users can manage their own blocks" on public.user_blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

drop policy if exists "users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks" on public.user_blocks
  for select using (auth.uid() = blocker_id);


-- public.user_profile_audit_events
drop policy if exists "no direct client access to user profile audit events" on public.user_profile_audit_events;
CREATE POLICY "No direct client access to user profile audit events"
  ON public.user_profile_audit_events FOR ALL USING (false);


-- public.user_settings
drop policy if exists "users can manage their own settings" on public.user_settings;
create policy "Users can manage their own settings" on public.user_settings for all
  using (auth.uid() = id) with check (auth.uid() = id);


-- public.user_top_spots
drop policy if exists "public_select_top_spots" on public.user_top_spots;
CREATE POLICY "public_select_top_spots"
  ON public.user_top_spots FOR SELECT USING (true);

drop policy if exists "users_delete_top_spots" on public.user_top_spots;
CREATE POLICY "users_delete_top_spots"
  ON public.user_top_spots FOR DELETE USING (auth.uid() = user_id);

drop policy if exists "users_insert_top_spots" on public.user_top_spots;
CREATE POLICY "users_insert_top_spots"
  ON public.user_top_spots FOR INSERT WITH CHECK (auth.uid() = user_id);

drop policy if exists "users_update_top_spots" on public.user_top_spots;
CREATE POLICY "users_update_top_spots"
  ON public.user_top_spots FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- public.user_topic_follows
drop policy if exists "users can view own topic follows" on public.user_topic_follows;
create policy "Users can view own topic follows"
  on public.user_topic_follows for select
  using (auth.uid() = user_id);

drop policy if exists "users manage own topic follows" on public.user_topic_follows;
create policy "Users manage own topic follows"
  on public.user_topic_follows for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- public.user_trust_profiles
drop policy if exists "users can view their own trust profile" on public.user_trust_profiles;
create policy "Users can view their own trust profile" on public.user_trust_profiles
  for select using (auth.uid() = user_id);


-- public.users
drop policy if exists "users can manage their own profile" on public.users;
create policy "Users can manage their own profile" on public.users for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "users can view all profiles" on public.users;
create policy "Users can view all profiles" on public.users for select using (true);


-- push_tokens
drop policy if exists "users manage own tokens" on push_tokens;
create policy "Users manage own tokens"
  on push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- place_stubs
drop policy if exists "place_stubs_select" on place_stubs;
create policy "place_stubs_select"
  on place_stubs for select
  using (expires_at > now());


-- storage.objects
drop policy if exists "anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "public post media read" on storage.objects;
create policy "Public post media read"
  on storage.objects for select to public
  using (bucket_id = 'post-media');

drop policy if exists "users can delete own post media" on storage.objects;
create policy "Users can delete own post media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars" on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "users can delete their own post draft objects" on storage.objects;
create policy "Users can delete their own post draft objects" on storage.objects
  for delete using (
    bucket_id = 'post-drafts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users can read their own post draft objects" on storage.objects;
create policy "Users can read their own post draft objects" on storage.objects
  for select using (
    bucket_id = 'post-drafts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "users can update their own post draft objects" on storage.objects;
create policy "Users can update their own post draft objects" on storage.objects
  for update using (
    bucket_id = 'post-drafts'
    and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'post-drafts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users can upload post media" on storage.objects;
create policy "Users can upload post media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can upload their own post draft objects" on storage.objects;
create policy "Users can upload their own post draft objects" on storage.objects
  for insert with check (
    bucket_id = 'post-drafts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ---------------------------------------------------------------------------
-- VIEWS
-- ---------------------------------------------------------------------------

-- platform_audit_events_view: unified compliance read surface.
-- To extend: add a UNION ALL arm from the new *_audit_events table in the same
-- migration as the new table. Maps to (id, source_table, entity_type, entity_id,
-- user_id, event_type, context, created_at).
create or replace view public.platform_audit_events_view as

  select id, 'auth_audit_events'::text as source_table,
    'auth'::text as entity_type, null::uuid as entity_id,
    user_id, event_type, context, created_at
  from public.auth_audit_events

  union all

  select id, 'content_lifecycle_events'::text as source_table,
    entity_type, entity_id, user_id, event_type, context, created_at
  from public.content_lifecycle_events

  union all

  select id, 'dish_audit_events'::text as source_table,
    'dish'::text as entity_type, dish_id as entity_id,
    user_id, event_type, context, created_at
  from public.dish_audit_events

  union all

  select id, 'moderation_actions'::text as source_table,
    target_type as entity_type, target_id as entity_id,
    actor_id as user_id, action_type as event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'actor_type', actor_type, 'reason', reason,
      'reversible', reversible, 'shadow_mode', shadow_mode, 'report_id', report_id
    )) || coalesce(metadata, '{}'::jsonb) as context,
    created_at
  from public.moderation_actions

  union all

  select id, 'post_edit_events'::text as source_table,
    'post'::text as entity_type, post_id as entity_id,
    user_id, event_type,
    jsonb_build_object('changed_fields', changed_fields, 'changed_field_count', changed_field_count) as context,
    created_at
  from public.post_edit_events

  union all

  select id, 'restaurant_audit_events'::text as source_table,
    coalesce(entity_type, 'restaurant')::text as entity_type,
    coalesce(entity_id, restaurant_id) as entity_id,
    actor_id as user_id, action as event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'actor_type', actor_type, 'source_type', source_type, 'reason', reason,
      'before_summary', before_summary, 'after_summary', after_summary,
      'compliance_category', compliance_category, 'restaurant_id', restaurant_id,
      'request_id', request_id, 'job_id', job_id, 'rollback_reference', rollback_reference
    )) as context,
    created_at
  from public.restaurant_audit_events

  union all

  select id, 'user_profile_audit_events'::text as source_table,
    'user_profile'::text as entity_type, user_id as entity_id,
    user_id, event_type, context, created_at
  from public.user_profile_audit_events

  union all

  select id, 'collection_audit_events'::text as source_table,
    'collection'::text as entity_type, collection_id as entity_id,
    user_id, event_type, context, created_at
  from public.collection_audit_events

  union all

  select id, 'feature_flag_audit_events'::text as source_table,
    'feature_flag'::text as entity_type, null::uuid as entity_id,
    user_id, event_type, context, created_at
  from public.feature_flag_audit_events

  union all

  select id, 'saved_search_audit_events'::text as source_table,
    'saved_search'::text as entity_type, saved_search_id as entity_id,
    user_id, event_type, context, created_at
  from public.saved_search_audit_events;

-- ---------------------------------------------------------------------------
-- STORAGE BUCKETS
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('post-drafts', 'post-drafts', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true) on conflict do nothing;

-- avatars
drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars" on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- post-drafts (private)
drop policy if exists "Users can read their own post draft objects" on storage.objects;
create policy "Users can read their own post draft objects" on storage.objects
  for select using (bucket_id = 'post-drafts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can upload their own post draft objects" on storage.objects;
create policy "Users can upload their own post draft objects" on storage.objects
  for insert with check (bucket_id = 'post-drafts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their own post draft objects" on storage.objects;
create policy "Users can update their own post draft objects" on storage.objects
  for update using (bucket_id = 'post-drafts' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'post-drafts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own post draft objects" on storage.objects;
create policy "Users can delete their own post draft objects" on storage.objects
  for delete using (bucket_id = 'post-drafts' and auth.uid()::text = (storage.foldername(name))[1]);

-- post-media (public)
drop policy if exists "Public post media read" on storage.objects;
create policy "Public post media read" on storage.objects for select to public
  using (bucket_id = 'post-media');

drop policy if exists "Users can upload post media" on storage.objects;
create policy "Users can upload post media" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own post media" on storage.objects;
create policy "Users can delete own post media" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------

revoke all on function public.delete_post(uuid) from public, anon;
grant execute on function public.delete_post(uuid) to authenticated;

revoke all on function public.delete_comment(uuid) from public, anon;
grant execute on function public.delete_comment(uuid) to authenticated;

revoke all on function public.purge_soft_deleted_content(int) from public, anon, authenticated;

revoke all on function public.restore_post(uuid) from public, anon, authenticated;
revoke all on function public.restore_comment(uuid) from public, anon, authenticated;

revoke all on function public.record_auth_audit_event from public;
grant execute on function public.record_auth_audit_event(text, jsonb) to authenticated;

revoke all on function public.record_content_lifecycle_event from public;
grant execute on function public.record_content_lifecycle_event(text, uuid, text, jsonb) to authenticated;

revoke all on function public.record_profile_audit_event from public;
grant execute on function public.record_profile_audit_event(text, jsonb) to authenticated;

revoke all on function public.record_collection_audit_event from public;
grant execute on function public.record_collection_audit_event(uuid, text, jsonb) to authenticated;

revoke all on function public.add_saved_target_to_collection(uuid, text, uuid) from public;
grant execute on function public.add_saved_target_to_collection(uuid, text, uuid) to authenticated;

revoke all on function public.unsave_target(text, uuid, boolean) from public;
grant execute on function public.unsave_target(text, uuid, boolean) to authenticated;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

grant execute on function public.fetch_trending_dishes(int, int) to authenticated, anon;

revoke execute on function public.feature_flag_audit_trigger from public;
revoke execute on function public.saved_search_audit_trigger from public;

-- cron: purge soft-deleted content daily at 3am UTC
-- Enable pg_cron in Supabase dashboard → Database → Extensions, then run:
-- select cron.schedule('purge-soft-deleted-content', '0 3 * * *', 'select public.purge_soft_deleted_content()');
