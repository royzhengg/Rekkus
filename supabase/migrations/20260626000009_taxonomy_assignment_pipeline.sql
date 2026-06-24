-- B-625: Taxonomy Assignment Pipeline
-- OWNER: Search Domain
-- ADR: ADR-0031-taxonomy-assignment-pipeline
--
-- INVARIANTS (do not violate):
--   taxonomy_suggestions  = intake only; never queried by search code
--   place_taxonomies      = authoritative truth only; no pending state
--   search reads only       place_taxonomies_accepted (view)
--   assignments are soft-deleted (removed_at), never hard-deleted
--   moderation history (suggestions.status) is immutable after promotion
--   OSM hard-deletes its own rows by design (reference data, not human moderation)
--   Application code must never INSERT/UPDATE place_taxonomies directly

-- =============================================================
-- 0a. updated_at trigger helper (not yet defined globally)
-- =============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================
-- 0b. Enum types (consolidate authority; prevent drift)
-- =============================================================

create type public.taxonomy_source as enum ('osm', 'user', 'admin', 'ai');
create type public.taxonomy_suggestion_status as enum ('pending', 'promoted', 'rejected');
create type public.taxonomy_review_reason as enum (
  'incorrect', 'duplicate', 'low_confidence', 'spam', 'other'
);

-- =============================================================
-- 1. taxonomy_suggestions — intake table for all external signals
-- =============================================================

create table public.taxonomy_suggestions (
  id                    uuid        primary key default gen_random_uuid(),
  place_id              uuid        not null references public.places(id) on delete cascade,
  node_id               uuid        not null references public.taxonomy_nodes(id) on delete cascade,
  source                public.taxonomy_source not null,
  confidence_score      numeric(3,2) not null check (confidence_score between 0.00 and 1.00),
  assigned_by_user_id   uuid        null references auth.users(id) on delete set null,
  classifier_name       text        null,
  classifier_version    text        null,
  classifier_run_id     uuid        null,
  review_reason         public.taxonomy_review_reason null,
  promoted_automatically boolean    not null default false,
  status                public.taxonomy_suggestion_status not null default 'pending',
  reviewed_by           uuid        null references auth.users(id) on delete set null,
  reviewed_at           timestamptz null,
  review_notes          text        null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Classifier metadata must only be set for ai-source suggestions
  constraint chk_classifier_on_ai_only check (
    source = 'ai'
    or (classifier_name is null and classifier_version is null and classifier_run_id is null)
  )
);

comment on table  public.taxonomy_suggestions is
  'Intake for all taxonomy assignment signals (user, ai, osm, admin). '
  'Never queried by search code. Moderation promotes rows into place_taxonomies.';
comment on column public.taxonomy_suggestions.confidence_score is
  'Calibrated confidence used for acceptance gating and future consensus scoring.';
comment on column public.taxonomy_suggestions.classifier_run_id is
  'Batch run identifier — trace or roll back all outputs from a single classifier invocation.';
comment on column public.taxonomy_suggestions.promoted_automatically is
  'True when promoted by consensus engine rather than human moderator. Reserved for B-626.';
comment on column public.taxonomy_suggestions.status is
  'pending = awaiting moderation; promoted = became authoritative assignment; '
  'rejected = moderator rejected. Immutable after promotion.';
comment on column public.taxonomy_suggestions.review_reason is
  'Structured rejection reason for analytics. Drives AI quality metrics in B-626.';

-- FK indexes (Postgres does not auto-index FKs)
create index on public.taxonomy_suggestions (place_id);
create index on public.taxonomy_suggestions (node_id);
create index on public.taxonomy_suggestions (assigned_by_user_id)
  where assigned_by_user_id is not null;

-- Moderation and status queries
create index on public.taxonomy_suggestions (place_id, node_id, status);
create index on public.taxonomy_suggestions (status, created_at)
  where status = 'pending';

-- Classifier run rollback
create index on public.taxonomy_suggestions (classifier_run_id)
  where classifier_run_id is not null;

-- One pending suggestion per user per place/node
create unique index on public.taxonomy_suggestions (place_id, node_id, assigned_by_user_id)
  where status = 'pending' and source = 'user';

-- One pending suggestion per AI classifier version per place/node
create unique index on public.taxonomy_suggestions (place_id, node_id, classifier_name, classifier_version)
  where status = 'pending' and source = 'ai';

-- updated_at trigger
create trigger taxonomy_suggestions_updated_at
  before update on public.taxonomy_suggestions
  for each row execute function public.set_updated_at();

-- RLS
alter table public.taxonomy_suggestions enable row level security;
create policy "suggestions_read_own" on public.taxonomy_suggestions
  for select using (auth.uid() = assigned_by_user_id);
create policy "suggestions_insert_authenticated" on public.taxonomy_suggestions
  for insert with check (auth.uid() is not null);

-- =============================================================
-- 2. Extend place_taxonomies with provenance + soft-delete columns
--    PRIMARY KEY (place_id, node_id) already enforces uniqueness.
--    One authoritative assignment per place/node pair.
-- =============================================================

-- Migrate existing source column from text+CHECK to the new enum type.
-- Must drop the default first; a text default cannot be cast automatically to the enum.
alter table public.place_taxonomies
  drop constraint if exists place_taxonomies_source_check;

alter table public.place_taxonomies
  alter column source drop default;

alter table public.place_taxonomies
  alter column source type public.taxonomy_source
  using source::public.taxonomy_source;

alter table public.place_taxonomies
  alter column source set default 'osm'::public.taxonomy_source;

-- Add new columns
alter table public.place_taxonomies
  add column confidence_score      numeric(3,2)  not null default 0.75
    check (confidence_score between 0.00 and 1.00),
  add column assigned_by_user_id   uuid          null
    references auth.users(id) on delete set null,
  add column classifier_version    text          null,
  add column source_suggestion_id  uuid          null
    references public.taxonomy_suggestions(id) on delete set null,
  add column removed_at            timestamptz   null,
  add column removed_by            uuid          null
    references auth.users(id) on delete set null,
  add column created_at            timestamptz   not null default now(),
  add column updated_at            timestamptz   not null default now();

comment on table  public.place_taxonomies is
  'Authoritative taxonomy assignments. '
  'Populated by promote_taxonomy_suggestion / assign_taxonomy_admin RPCs or OSM sync trigger. '
  'Application code must never write here directly. '
  'Soft-deleted rows (removed_at IS NOT NULL) are excluded from place_taxonomies_accepted.';
comment on column public.place_taxonomies.confidence_score is
  'Acceptance gate only — not search ranking. '
  'OSM = 0.75, admin >= 0.90, AI = caller-supplied (floored to 0.50 on promotion), user = 0.40.';
comment on column public.place_taxonomies.source_suggestion_id is
  'Link to originating taxonomy_suggestions row. NULL for OSM sync and admin-direct assignments.';

-- FK indexes
create index on public.place_taxonomies (source_suggestion_id)
  where source_suggestion_id is not null;

-- Partial index for the acceptance gate hot path
create index idx_place_taxonomies_active
  on public.place_taxonomies (place_id, node_id)
  where removed_at is null;

-- updated_at trigger
create trigger place_taxonomies_updated_at
  before update on public.place_taxonomies
  for each row execute function public.set_updated_at();

-- Backfill: all existing rows are OSM source with 0.75 confidence.
-- Verify assumption before this runs: SELECT DISTINCT source FROM place_taxonomies;
update public.place_taxonomies
set confidence_score = 0.75,
    source = 'osm'
where source = 'osm' or source is null;

-- =============================================================
-- 3. Source authority: BEFORE UPDATE trigger
--    Hierarchy: admin > osm > ai > user
-- =============================================================

create or replace function public.taxonomy_immutability_fn()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Admin assignments cannot be overwritten by any non-admin source
  if old.source = 'admin' and new.source != 'admin' then
    raise exception 'taxonomy: admin assignment cannot be overwritten by source %', new.source;
  end if;
  -- OSM assignments cannot be overwritten by ai or user
  if old.source = 'osm' and new.source in ('ai', 'user') then
    raise exception 'taxonomy: osm assignment cannot be overwritten by source %', new.source;
  end if;
  -- AI may only overwrite AI if new confidence is strictly higher
  if old.source = 'ai' and new.source = 'ai' and new.confidence_score <= old.confidence_score then
    -- Silently skip (return OLD to abort the update)
    return old;
  end if;
  return new;
end;
$$;

create trigger taxonomy_assignments_immutability
  before update on public.place_taxonomies
  for each row execute function public.taxonomy_immutability_fn();

-- =============================================================
-- 4. Update OSM sync trigger
--    Preserves provenance; hard-deletes only OSM-sourced rows no
--    longer in the cuisine_slug set (by design — reference data).
-- =============================================================

create or replace function public.sync_place_taxonomies_fn()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_resolved_node_ids uuid[];
begin
  if tg_op = 'INSERT' or old.cuisine_slug is distinct from new.cuisine_slug then

    -- Build set of node_ids resolved from the new cuisine_slug value
    select array_agg(n.id) into v_resolved_node_ids
    from regexp_split_to_table(coalesce(new.cuisine_slug, ''), '\s*;\s*') s(raw_slug)
    cross join lateral (
      select public.resolve_taxonomy_slug(trim(lower(s.raw_slug)), 'cuisine') as resolved
    ) r
    join public.taxonomy_nodes n on n.slug = r.resolved and n.taxonomy_type = 'cuisine'
    where trim(s.raw_slug) <> '';

    -- Hard-delete OSM rows no longer in the resolved set (OSM = reference data, not moderation)
    delete from public.place_taxonomies
    where place_id = new.id
      and source = 'osm'
      and (v_resolved_node_ids is null or node_id != all(v_resolved_node_ids));

    -- Upsert resolved nodes.
    -- OSM beats ai/user (hierarchy: admin > osm > ai > user).
    -- Admin assignments are never touched by OSM sync.
    if v_resolved_node_ids is not null then
      insert into public.place_taxonomies
        (place_id, node_id, source, confidence_score, source_suggestion_id,
         assigned_by_user_id, classifier_version, removed_at, removed_by)
      select new.id, n.id, 'osm', 0.75, null, null, null, null, null
      from regexp_split_to_table(coalesce(new.cuisine_slug, ''), '\s*;\s*') s(raw_slug)
      cross join lateral (
        select public.resolve_taxonomy_slug(trim(lower(s.raw_slug)), 'cuisine') as resolved
      ) r
      join public.taxonomy_nodes n on n.slug = r.resolved and n.taxonomy_type = 'cuisine'
      where trim(s.raw_slug) <> ''
      on conflict (place_id, node_id) do update
        set source              = 'osm',
            confidence_score    = 0.75,
            source_suggestion_id = null,
            assigned_by_user_id = null,
            classifier_version  = null,
            removed_at          = null,  -- resurrect if previously soft-deleted
            removed_by          = null,
            updated_at          = now()
        where place_taxonomies.source != 'admin';
    end if;

    -- Track unresolved values for future taxonomy scoping
    insert into public.taxonomy_unmapped (raw_value, occurrences, last_seen_at)
    select trim(lower(s.raw_slug)), 1, now()
    from regexp_split_to_table(coalesce(new.cuisine_slug, ''), '\s*;\s*') s(raw_slug)
    where trim(s.raw_slug) <> ''
      and public.resolve_taxonomy_slug(trim(lower(s.raw_slug)), 'cuisine') is null
    on conflict (raw_value) do update
      set occurrences  = taxonomy_unmapped.occurrences + 1,
          last_seen_at = now();

  end if;
  return new;
end;
$$;

-- =============================================================
-- 5. Acceptance gate view
-- =============================================================

create or replace view public.place_taxonomies_accepted as
select
  place_id,
  node_id,
  source,
  confidence_score,
  assigned_by_user_id,
  classifier_version,
  source_suggestion_id,
  created_at
from public.place_taxonomies
where confidence_score >= 0.50
  and removed_at is null;

comment on view public.place_taxonomies_accepted is
  'Authoritative accepted taxonomy assignments visible to search. '
  'Search functions must never query place_taxonomies directly — use this view.';

-- =============================================================
-- 6. taxonomy_assignment_events — append-only audit table
-- =============================================================

create table public.taxonomy_assignment_events (
  id                 uuid        primary key default gen_random_uuid(),
  place_id           uuid        not null references public.places(id) on delete cascade,
  node_id            uuid        not null references public.taxonomy_nodes(id) on delete cascade,
  event_type         text        not null check (event_type in (
    'suggestion_created',
    'suggestion_promoted',
    'suggestion_rejected',
    'assignment_created',
    'assignment_overwritten',
    'assignment_removed',
    'assignment_restored',
    'auto_accepted'
  )),
  source             text,
  old_confidence     numeric(3,2),
  new_confidence     numeric(3,2),
  actor_id           uuid        references auth.users(id) on delete set null,
  classifier_name    text,
  classifier_version text,
  classifier_run_id  uuid,
  notes              text,
  created_at         timestamptz not null default now()
);

comment on table public.taxonomy_assignment_events is
  'Append-only audit log for all taxonomy assignment lifecycle events. '
  'actor_id rules: user/admin actions set auth.uid(); AI and OSM sync leave actor_id NULL.';

create index on public.taxonomy_assignment_events (place_id, node_id);
create index on public.taxonomy_assignment_events (actor_id) where actor_id is not null;

-- RLS: append-only; no reads from app (admin reads via service role)
alter table public.taxonomy_assignment_events enable row level security;
create policy "taxonomy_events_append_only"
  on public.taxonomy_assignment_events for all using (false);

-- =============================================================
-- 7. Queue metrics views
-- =============================================================

create or replace view public.taxonomy_review_queue_stats as
select
  count(*)                                                    as pending_count,
  extract(epoch from (now() - min(created_at))) / 3600        as oldest_pending_hours
from public.taxonomy_suggestions
where status = 'pending';

comment on view public.taxonomy_review_queue_stats is
  'Current moderation queue depth. Used by admin dashboard to monitor backlog.';

create or replace view public.taxonomy_review_performance as
select
  source::text,
  status::text,
  count(*)                                                        as count,
  extract(epoch from avg(reviewed_at - created_at)) / 3600        as avg_review_hours
from public.taxonomy_suggestions
where status in ('promoted', 'rejected')
  and reviewed_at is not null
group by source, status;

comment on view public.taxonomy_review_performance is
  'Moderator performance stats across completed reviews. Used for AI classifier quality evaluation.';

-- =============================================================
-- 8. Assignment RPCs (SECURITY DEFINER)
--    Actor attribution rules:
--      user/admin actions -> actor_id = auth.uid()
--      AI / OSM sync      -> actor_id = NULL
-- =============================================================

-- 8a. submit_taxonomy_suggestion — intake for user and AI suggestions
create or replace function public.submit_taxonomy_suggestion(
  p_place_id          uuid,
  p_node_id           uuid,
  p_confidence        numeric,
  p_classifier_name   text    default null,
  p_classifier_version text   default null,
  p_classifier_run_id uuid    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_source   public.taxonomy_source;
  v_suggestion_id uuid;
begin
  v_actor_id := auth.uid();
  -- Derive source from auth context: service role = ai, authenticated user = user
  v_source := case when v_actor_id is null then 'ai' else 'user' end;

  insert into public.taxonomy_suggestions
    (place_id, node_id, source, confidence_score,
     assigned_by_user_id, classifier_name, classifier_version, classifier_run_id)
  values
    (p_place_id, p_node_id, v_source, p_confidence,
     v_actor_id, p_classifier_name, p_classifier_version, p_classifier_run_id)
  returning id into v_suggestion_id;

  -- Audit event (actor_id = user uid or NULL for AI)
  insert into public.taxonomy_assignment_events
    (place_id, node_id, event_type, source, new_confidence,
     actor_id, classifier_name, classifier_version, classifier_run_id)
  values
    (p_place_id, p_node_id, 'suggestion_created', v_source::text, p_confidence,
     v_actor_id, p_classifier_name, p_classifier_version, p_classifier_run_id);

  return v_suggestion_id;
end;
$$;

comment on function public.submit_taxonomy_suggestion(uuid, uuid, numeric, text, text, uuid) is
  'Required intake path for user and AI taxonomy suggestions. '
  'Do not insert into taxonomy_suggestions directly.';

grant execute on function public.submit_taxonomy_suggestion(uuid, uuid, numeric, text, text, uuid)
  to authenticated;


-- 8b. promote_taxonomy_suggestion — admin-only promotion to authoritative assignment
create or replace function public.promote_taxonomy_suggestion(
  p_suggestion_id uuid,
  p_notes         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id  uuid;
  v_sug       record;
  v_floored_confidence numeric(3,2);
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'authentication required';
  end if;
  -- TODO: verify admin role via profiles.is_admin or equivalent

  select * into v_sug from public.taxonomy_suggestions where id = p_suggestion_id;
  if not found then
    raise exception 'suggestion % not found', p_suggestion_id;
  end if;
  if v_sug.status != 'pending' then
    raise exception 'suggestion % is already %', p_suggestion_id, v_sug.status;
  end if;

  -- Moderator approval floors confidence to 0.50:
  -- The act of approval is itself evidence of correctness.
  v_floored_confidence := greatest(v_sug.confidence_score, 0.50);

  -- Update suggestion status
  update public.taxonomy_suggestions
  set status      = 'promoted',
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      review_notes = p_notes,
      updated_at  = now()
  where id = p_suggestion_id;

  -- Upsert authoritative assignment
  insert into public.place_taxonomies
    (place_id, node_id, source, confidence_score,
     assigned_by_user_id, source_suggestion_id,
     removed_at, removed_by)
  values
    (v_sug.place_id, v_sug.node_id, v_sug.source, v_floored_confidence,
     v_sug.assigned_by_user_id, p_suggestion_id,
     null, null)
  on conflict (place_id, node_id) do update
    set source               = v_sug.source,
        confidence_score     = v_floored_confidence,
        assigned_by_user_id  = v_sug.assigned_by_user_id,
        source_suggestion_id = p_suggestion_id,
        classifier_version   = v_sug.classifier_version,
        removed_at           = null,   -- resurrect if previously soft-deleted
        removed_by           = null,
        updated_at           = now()
    where place_taxonomies.source != 'admin';  -- never overwrite admin assignments

  -- Audit event
  insert into public.taxonomy_assignment_events
    (place_id, node_id, event_type, source, new_confidence, actor_id, notes)
  values
    (v_sug.place_id, v_sug.node_id, 'suggestion_promoted', v_sug.source::text,
     v_floored_confidence, v_actor_id, p_notes);
end;
$$;

comment on function public.promote_taxonomy_suggestion(uuid, text) is
  'Promotes a pending suggestion into an authoritative assignment. '
  'Admin only. Required write path — do not write to place_taxonomies directly.';


-- 8c. reject_taxonomy_suggestion — admin-only rejection
create or replace function public.reject_taxonomy_suggestion(
  p_suggestion_id uuid,
  p_reason        public.taxonomy_review_reason default null,
  p_notes         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_sug      record;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'authentication required';
  end if;
  -- TODO: verify admin role

  select * into v_sug from public.taxonomy_suggestions where id = p_suggestion_id;
  if not found then
    raise exception 'suggestion % not found', p_suggestion_id;
  end if;
  if v_sug.status != 'pending' then
    raise exception 'suggestion % is already %', p_suggestion_id, v_sug.status;
  end if;

  update public.taxonomy_suggestions
  set status       = 'rejected',
      reviewed_by  = v_actor_id,
      reviewed_at  = now(),
      review_reason = p_reason,
      review_notes = p_notes,
      updated_at   = now()
  where id = p_suggestion_id;

  insert into public.taxonomy_assignment_events
    (place_id, node_id, event_type, source, old_confidence, actor_id, notes)
  values
    (v_sug.place_id, v_sug.node_id, 'suggestion_rejected', v_sug.source::text,
     v_sug.confidence_score, v_actor_id, p_notes);
end;
$$;

comment on function public.reject_taxonomy_suggestion(uuid, public.taxonomy_review_reason, text) is
  'Rejects a pending taxonomy suggestion. Admin only.';


-- 8d. assign_taxonomy_admin — direct admin assignment bypassing suggestion intake
create or replace function public.assign_taxonomy_admin(
  p_place_id   uuid,
  p_node_id    uuid,
  p_confidence numeric default 0.90,
  p_notes      text    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'authentication required';
  end if;
  -- TODO: verify admin role

  insert into public.place_taxonomies
    (place_id, node_id, source, confidence_score,
     assigned_by_user_id, source_suggestion_id,
     removed_at, removed_by)
  values
    (p_place_id, p_node_id, 'admin', p_confidence,
     v_actor_id, null,
     null, null)
  on conflict (place_id, node_id) do update
    set source              = 'admin',
        confidence_score    = p_confidence,
        assigned_by_user_id = v_actor_id,
        source_suggestion_id = null,
        classifier_version  = null,
        removed_at          = null,  -- idempotent: resurrect if soft-deleted
        removed_by          = null,
        updated_at          = now();

  insert into public.taxonomy_assignment_events
    (place_id, node_id, event_type, source, new_confidence, actor_id, notes)
  values
    (p_place_id, p_node_id, 'assignment_created', 'admin', p_confidence, v_actor_id, p_notes);
end;
$$;

comment on function public.assign_taxonomy_admin(uuid, uuid, numeric, text) is
  'Direct admin taxonomy assignment, bypasses suggestion intake. '
  'Idempotent — repeated calls update confidence. '
  'Admin only. Required write path — do not write to place_taxonomies directly.';


-- 8e. remove_taxonomy_assignment — admin soft-delete
create or replace function public.remove_taxonomy_assignment(
  p_place_id uuid,
  p_node_id  uuid,
  p_reason   public.taxonomy_review_reason default null,
  p_notes    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_row      record;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'authentication required';
  end if;
  -- TODO: verify admin role

  select * into v_row
  from public.place_taxonomies
  where place_id = p_place_id and node_id = p_node_id;

  if not found then
    raise exception 'no assignment found for place % node %', p_place_id, p_node_id;
  end if;
  if v_row.removed_at is not null then
    raise exception 'assignment already removed';
  end if;

  -- Soft-delete: historical state preserved for AI retraining and audit
  -- Hard-delete is explicitly forbidden (see ADR-0031)
  update public.place_taxonomies
  set removed_at = now(),
      removed_by = v_actor_id,
      updated_at = now()
  where place_id = p_place_id and node_id = p_node_id;

  -- Do NOT mutate suggestion history — suggestions retain status='promoted'
  -- The originating suggestion's promotion remains historically true

  insert into public.taxonomy_assignment_events
    (place_id, node_id, event_type, source, old_confidence, actor_id, notes)
  values
    (p_place_id, p_node_id, 'assignment_removed', v_row.source::text,
     v_row.confidence_score, v_actor_id, p_notes);
end;
$$;

comment on function public.remove_taxonomy_assignment(uuid, uuid, public.taxonomy_review_reason, text) is
  'Soft-deletes a taxonomy assignment (sets removed_at). '
  'Hard-delete is forbidden — see ADR-0031. Admin only.';


-- 8f. get_taxonomy_review_queue — admin review queue
create or replace function public.get_taxonomy_review_queue(
  p_limit  int default 100,
  p_offset int default 0
)
returns table (
  suggestion_id       uuid,
  place_id            uuid,
  node_id             uuid,
  source              text,
  confidence_score    numeric,
  assigned_by_user_id uuid,
  classifier_name     text,
  classifier_version  text,
  node_slug           text,
  node_label          text,
  node_taxonomy_type  text,
  queue_age_hours     numeric,
  created_at          timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ts.id,
    ts.place_id,
    ts.node_id,
    ts.source::text,
    ts.confidence_score,
    ts.assigned_by_user_id,
    ts.classifier_name,
    ts.classifier_version,
    tn.slug,
    tn.name,
    tn.taxonomy_type,
    extract(epoch from (now() - ts.created_at)) / 3600,
    ts.created_at
  from public.taxonomy_suggestions ts
  join public.taxonomy_nodes tn on tn.id = ts.node_id
  where ts.status = 'pending'
  order by ts.confidence_score desc, ts.created_at asc  -- high confidence first; oldest breaks ties
  limit p_limit
  offset p_offset;
$$;

comment on function public.get_taxonomy_review_queue(int, int) is
  'Admin review queue. Returns pending suggestions ordered by confidence DESC, created_at ASC.';

-- =============================================================
-- 9. Update search_text_fallback to use place_taxonomies_accepted
--    All search reads must use the accepted view — not the base table.
-- =============================================================

create or replace function public.search_text_fallback(
  p_query    text,
  p_limit    integer          default 20,
  p_near_lat double precision default null,
  p_near_lng double precision default null
)
returns table (
  entity_type        text,
  entity_id          uuid,
  semantic_similarity real,
  final_score        real,
  display_data       jsonb
)
language sql stable security definer set search_path = public, extensions
as $$
  with
  resolved_cuisine as (
    select resolve_taxonomy_slug(lower(trim(p_query)), 'cuisine') as slug
  ),
  cuisine_family as (
    select array_agg(t) as slugs
    from resolved_cuisine rc
    cross join lateral get_taxonomy_family(rc.slug, 'cuisine') t
    where rc.slug is not null
  )
  select entity_type, entity_id, score::real, score::real, display_data
  from (
    (
      select
        'place'::text as entity_type,
        psi.place_id  as entity_id,
        (
          case
            when psi.search_name =    lower(p_query)               then 0.90
            when psi.search_name like lower(p_query) || '%'        then 0.80
            when psi.search_name like '%' || lower(p_query) || '%' then 0.70
            -- Tier 1: direct taxonomy match via accepted view (confidence-gated)
            when exists (
              select 1 from public.place_taxonomies_accepted pta
              join public.taxonomy_nodes n on n.id = pta.node_id
              where pta.place_id = psi.place_id
                and n.slug = lower(trim(p_query))
                and n.taxonomy_type = 'cuisine'
            ) then 0.70
            -- Tier 2: hierarchy / alias expansion via accepted view
            when exists (
              select 1 from public.place_taxonomies_accepted pta
              join public.taxonomy_nodes n on n.id = pta.node_id
              where pta.place_id = psi.place_id
                and n.slug = any(coalesce((select slugs from cuisine_family), '{}'))
                and n.taxonomy_type = 'cuisine'
            ) then 0.60
            when psi.suburb ilike '%' || p_query || '%' then 0.55
            when psi.cuisine_slug ilike '%' || p_query || '%' then 0.50
            else 0.50
          end
          *
          case
            when p_near_lat is not null and p_near_lng is not null
              and psi.lat is not null and psi.lng is not null
            then 1.0 / (1.0 + (
              ST_Distance(
                ST_SetSRID(ST_MakePoint(psi.lng, psi.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(p_near_lng, p_near_lat), 4326)::geography
              ) / 1000.0 / 20.0
            ))
            else 1.0
          end
        ) as score,
        jsonb_build_object(
          'name',               p.name,
          'address',            p.address,
          'city',               p.city,
          'suburb',             p.suburb,
          'cuisine_type',       p.cuisine_type,
          'google_place_id',    p.google_place_id,
          'latitude',           psi.lat,
          'longitude',          psi.lng,
          'google_rating',      p.google_rating,
          'google_review_count',p.google_review_count
        ) as display_data
      from public.place_search_index psi
      join public.places p on p.id = psi.place_id
      where
        psi.search_name  like '%' || lower(p_query) || '%'
        or psi.cuisine_slug ilike '%' || p_query || '%'
        or psi.suburb       ilike '%' || p_query || '%'
        or exists (
          select 1 from public.place_taxonomies_accepted pta
          join public.taxonomy_nodes n on n.id = pta.node_id
          where pta.place_id = psi.place_id
            and n.slug = any(coalesce((select slugs from cuisine_family), '{}'))
        )
      order by score desc
      limit p_limit
    )
    union all
    (
      select
        'dish'::text as entity_type,
        d.id         as entity_id,
        case
          when lower(d.name)         =    lower(p_query)               then 0.85
          when lower(d.name)         like lower(p_query) || '%'        then 0.75
          when lower(d.name)         like '%' || lower(p_query) || '%' then 0.65
          when lower(d.cuisine_type) ilike '%' || p_query || '%'       then 0.55
          else 0.50
        end as score,
        jsonb_build_object(
          'name',        d.name,
          'cuisine_type',d.cuisine_type,
          'save_count',  (select count(*) from public.saved_dishes sd where sd.dish_id = d.id),
          'post_count',  (select count(*) from public.posts po where po.dish_id = d.id and po.deleted_at is null)
        ) as display_data
      from public.dishes d
      where
        d.name         ilike '%' || p_query || '%'
        or d.cuisine_type ilike '%' || p_query || '%'
      order by score desc
      limit greatest(p_limit / 2, 5)
    )
  ) r(entity_type, entity_id, score, display_data)
  order by score desc
  limit p_limit;
$$;

grant execute on function public.search_text_fallback(text, integer, double precision, double precision)
  to authenticated, anon;
grant execute on function public.search_text_fallback(text, integer)
  to authenticated, anon;

-- =============================================================
-- 10. Final verification
-- =============================================================

do $$ begin
  -- taxonomy_suggestions table exists
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'taxonomy_suggestions'
  ) then
    raise exception 'B-625: taxonomy_suggestions table not created';
  end if;

  -- place_taxonomies has the new columns
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'place_taxonomies'
      and column_name = 'confidence_score'
  ) then
    raise exception 'B-625: place_taxonomies.confidence_score not added';
  end if;

  -- acceptance gate view exists
  if not exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'place_taxonomies_accepted'
  ) then
    raise exception 'B-625: place_taxonomies_accepted view not created';
  end if;

  -- search functions still compile
  perform * from public.search_text_fallback('japanese'::text, 5, null::double precision, null::double precision) limit 0;
  perform * from public.search_text_fallback('vegan'::text, 5, null::double precision, null::double precision) limit 0;

  raise notice 'B-625: taxonomy assignment pipeline migration complete';
end $$;
