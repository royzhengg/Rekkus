-- Domain: Core
-- Owner: Platform
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

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

-- user_trust_profiles
create table if not exists public.user_trust_profiles (
  user_id        uuid    references public.users on delete cascade primary key,
  trust_level    text    not null default 'new' check (trust_level in ('new', 'standard', 'trusted', 'restricted')),
  score          integer not null default 0 check (score between -100 and 100),
  reason_summary text,
  last_reviewed_at timestamptz,
  updated_at     timestamptz not null default now()
);
