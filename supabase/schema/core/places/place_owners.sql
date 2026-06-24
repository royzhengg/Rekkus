-- Domain: Core
-- Owner: Discovery
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes
-- Note: Canonical current ownership state only.
--       Ownership history lives in audit/place_ownership_events.sql.

-- place_owners: who currently owns/manages a place (many-to-many)
create table if not exists public.place_owners (
  place_id    uuid        not null references public.places(id) on delete cascade,
  owner_id    uuid        not null references public.users(id) on delete cascade,
  role        text        not null default 'owner'
                          check (role in ('owner', 'manager', 'agent')),
  status      text        not null default 'pending'
                          check (status in ('pending', 'approved', 'suspended')),
  claimed_at  timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid        references public.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (place_id, owner_id)
);

-- At most one approved 'owner' per place; multiple managers/agents allowed.
create unique index if not exists one_primary_owner_per_place
  on public.place_owners (place_id)
  where role = 'owner' and status = 'approved';

create index if not exists place_owners_owner_idx
  on public.place_owners (owner_id, status);
