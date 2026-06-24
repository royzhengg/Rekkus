-- Domain: Provider
-- Owner: Data / Import Pipelines
-- Classification: Provider-managed
-- Lifecycle: Core
-- Source of Truth: No

-- place_observations
create table if not exists public.place_observations (
  id                  uuid          default gen_random_uuid() primary key,
  place_id            uuid          references public.places(id) on delete cascade,
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
