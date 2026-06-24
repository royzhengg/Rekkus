-- Domain: Search
-- Owner: Search / Discovery
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

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

-- Indexes
create index if not exists saved_searches_user_created_idx on public.saved_searches (user_id, created_at desc);

create index if not exists saved_search_audit_events_saved_search_idx on public.saved_search_audit_events (saved_search_id, created_at desc);
create index if not exists saved_search_audit_events_user_id_idx on public.saved_search_audit_events (user_id);
create index if not exists saved_search_audit_events_created_at_idx on public.saved_search_audit_events (created_at desc);
