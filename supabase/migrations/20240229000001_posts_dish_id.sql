-- B-282: link posts to canonical dish entities

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS dish_id uuid REFERENCES public.dishes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS posts_dish_id_idx
  ON public.posts (dish_id)
  WHERE dish_id IS NOT NULL;


-- Atomic find-or-create for dish entities with full audit trail.
-- ON CONFLICT DO NOTHING + double-read handles concurrent inserts safely.
-- Writes a dish_audit_events row only on genuinely new dishes (never on existing ones).

CREATE OR REPLACE FUNCTION public.find_or_create_dish(
  p_name          text,
  p_restaurant_id uuid,
  p_cuisine_type  text    DEFAULT NULL,
  p_created_by    uuid    DEFAULT NULL,
  p_context       jsonb   DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id         uuid;
  v_normalized text    := lower(trim(p_name));
  v_is_new     boolean := false;
BEGIN
  -- Fast path: dish already exists
  SELECT id INTO v_id
  FROM public.dishes
  WHERE name_normalized = v_normalized
    AND restaurant_id = p_restaurant_id
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Insert, ignoring conflict from concurrent callers
  INSERT INTO public.dishes (name, restaurant_id, cuisine_type, created_by)
  VALUES (p_name, p_restaurant_id, p_cuisine_type, p_created_by)
  ON CONFLICT (name_normalized, restaurant_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    v_is_new := true;
  ELSE
    -- A concurrent insert won the race — fetch its id
    SELECT id INTO v_id
    FROM public.dishes
    WHERE name_normalized = v_normalized
      AND restaurant_id = p_restaurant_id
    LIMIT 1;
  END IF;

  -- Audit only genuinely new dishes
  IF v_is_new THEN
    INSERT INTO public.dish_audit_events (dish_id, user_id, event_type, context)
    VALUES (v_id, p_created_by, 'created', p_context);
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_dish FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_or_create_dish TO authenticated;
