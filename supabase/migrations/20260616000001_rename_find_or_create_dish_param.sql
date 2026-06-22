-- Rename p_restaurant_id → p_place_id in find_or_create_dish to match canonical domain term.
-- CREATE OR REPLACE cannot rename parameters in PostgreSQL — must DROP and recreate.
-- record_restaurant_provider_snapshot retains p_restaurant_id (infra exception).

DROP FUNCTION IF EXISTS public.find_or_create_dish(text, uuid, text, uuid, jsonb);

CREATE FUNCTION public.find_or_create_dish(
  p_name          text,
  p_place_id      uuid,
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
    AND place_id = p_place_id
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Insert, ignoring conflict from concurrent callers
  INSERT INTO public.dishes (name, place_id, cuisine_type, created_by)
  VALUES (p_name, p_place_id, p_cuisine_type, p_created_by)
  ON CONFLICT (name_normalized, place_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    v_is_new := true;
  ELSE
    -- A concurrent insert won the race — fetch its id
    SELECT id INTO v_id
    FROM public.dishes
    WHERE name_normalized = v_normalized
      AND place_id = p_place_id
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
