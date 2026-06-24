-- Domain: Core
-- Owner: Content
-- Classification: Audit
-- Lifecycle: Core
-- Source of Truth: Yes

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

-- Indexes
create index if not exists post_drafts_user_status_updated_idx on public.post_drafts (user_id, status, updated_at desc);
create index if not exists post_draft_media_draft_order_idx on public.post_draft_media (draft_id, order_index);

create index if not exists post_edit_events_post_created_idx on public.post_edit_events (post_id, created_at desc);
create index if not exists post_edit_events_user_created_idx on public.post_edit_events (user_id, created_at desc);
