CREATE TABLE IF NOT EXISTS public.user_top_spots (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position       smallint    NOT NULL CHECK (position BETWEEN 1 AND 3),
  restaurant_id  uuid        NOT NULL REFERENCES public.restaurants(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, position),
  UNIQUE (user_id, restaurant_id)
);

ALTER TABLE public.user_top_spots ENABLE ROW LEVEL SECURITY;

-- Public read so other users can see someone's manual top spots on their profile
CREATE POLICY "public_select_top_spots"
  ON public.user_top_spots FOR SELECT USING (true);

CREATE POLICY "users_insert_top_spots"
  ON public.user_top_spots FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_top_spots"
  ON public.user_top_spots FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_top_spots"
  ON public.user_top_spots FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_top_spots_user_position
  ON public.user_top_spots (user_id, position ASC);
