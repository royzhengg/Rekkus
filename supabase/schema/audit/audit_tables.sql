-- Domain: Audit
-- Owner: Platform / Compliance
-- Classification: Audit
-- Lifecycle: Core
-- Source of Truth: Yes

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

-- Indexes
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
