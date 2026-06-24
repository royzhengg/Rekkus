-- Phase 3a: Soft-delete consistency
-- Posts and comments already have deleted_at. Add to collections and dishes.

ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS deleted_reason text;
CREATE INDEX IF NOT EXISTS collections_not_deleted_idx
  ON public.collections (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.dishes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS dishes_not_deleted_idx
  ON public.dishes (place_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Phase 3b: place_owners — canonical current ownership state
-- Many-to-many: a place can have multiple owners with different roles.
-- Canonical state only — ownership history lives in audit/place_ownership_events.

CREATE TABLE IF NOT EXISTS public.place_owners (
  place_id    uuid        NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  owner_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'owner'
                          CHECK (role IN ('owner', 'manager', 'agent')),
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'suspended')),
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, owner_id)
);

-- At most one approved 'owner' per place; multiple managers/agents allowed.
CREATE UNIQUE INDEX IF NOT EXISTS one_primary_owner_per_place
  ON public.place_owners (place_id)
  WHERE role = 'owner' AND status = 'approved';

CREATE INDEX IF NOT EXISTS place_owners_owner_idx
  ON public.place_owners (owner_id, status);

ALTER TABLE public.place_owners ENABLE ROW LEVEL SECURITY;

-- Owners can see their own claims.
CREATE POLICY "Owners can view their own place claims"
  ON public.place_owners FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Users can submit new claims (pending only).
CREATE POLICY "Users can submit place claims"
  ON public.place_owners FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND status = 'pending');
