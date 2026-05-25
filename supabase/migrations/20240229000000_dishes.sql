-- Dishes: canonical dish entities for the dish graph (B-281)
-- name_normalized: stored generated column — enables case-insensitive
--   unique constraint and fast equality lookups without functional index limits
-- search_tsv: stored generated column — enables FTS for B-284 without a later migration

CREATE TABLE public.dishes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  name_normalized text        GENERATED ALWAYS AS (lower(trim(name))) STORED,
  restaurant_id   uuid        REFERENCES public.restaurants(id) ON DELETE SET NULL,
  cuisine_type    text,
  created_by      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  search_tsv      tsvector    GENERATED ALWAYS AS (
                                to_tsvector('english', coalesce(name, ''))
                              ) STORED,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dishes"
  ON public.dishes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert dishes"
  ON public.dishes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Unique per restaurant on normalized name (NULLs for restaurant_id don't conflict — intentional)
CREATE UNIQUE INDEX dishes_name_restaurant_uniq
  ON public.dishes (name_normalized, restaurant_id);

-- Fuzzy name search (same pattern as posts_best_dish_trgm_idx)
CREATE INDEX dishes_name_trgm_idx
  ON public.dishes USING gin (name extensions.gin_trgm_ops);

-- Full-text search for B-284
CREATE INDEX dishes_search_tsv_idx
  ON public.dishes USING gin (search_tsv);

-- Restaurant dish listing (B-287 signature dishes, B-285 trending)
CREATE INDEX dishes_restaurant_id_idx
  ON public.dishes (restaurant_id);


-- Audit log for dish graph events (same pattern as post_edit_events).
-- Records who created a dish, from which post, and when.
-- Feeds any future platform-wide unified audit view without schema changes.

CREATE TABLE public.dish_audit_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id     uuid        NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type  text        NOT NULL,  -- 'created' | 'merged' | 'updated'
  context     jsonb,                 -- e.g. {"post_id": "...", "source": "post_creation"}
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dish_audit_events ENABLE ROW LEVEL SECURITY;

-- Admin-read only from client; writes happen exclusively via SECURITY DEFINER RPCs
CREATE POLICY "No direct client access to dish audit events"
  ON public.dish_audit_events FOR ALL USING (false);

CREATE INDEX dish_audit_events_dish_id_idx    ON public.dish_audit_events (dish_id);
CREATE INDEX dish_audit_events_user_id_idx    ON public.dish_audit_events (user_id);
CREATE INDEX dish_audit_events_created_at_idx ON public.dish_audit_events (created_at DESC);
