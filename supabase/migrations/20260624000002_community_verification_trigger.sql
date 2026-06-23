-- B-599: Community verification triggers
-- Auto-promote places to community_verified when ≥3 unique users have posted
-- about the same place with first-to-last tag spread ≥7 days.
-- Fires AFTER INSERT on posts; logs every promotion to restaurant_audit_events.

CREATE OR REPLACE FUNCTION public.maybe_promote_to_community_verified()
RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_current_level public.verification_level;
  v_distinct_users integer;
  v_first_tag     timestamptz;
  v_last_tag      timestamptz;
BEGIN
  IF NEW.place_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT verification_level INTO v_current_level
  FROM public.places
  WHERE id = NEW.place_id;

  -- Already at or above community_verified — nothing to do.
  IF v_current_level IN ('community_verified', 'owner_verified') THEN
    RETURN NEW;
  END IF;

  SELECT
    count(DISTINCT user_id),
    min(created_at),
    max(created_at)
  INTO v_distinct_users, v_first_tag, v_last_tag
  FROM public.posts
  WHERE place_id = NEW.place_id
    AND deleted_at IS NULL;

  IF v_distinct_users >= 3 AND (v_last_tag - v_first_tag) >= interval '7 days' THEN
    -- Double-guard against concurrent inserts reaching this branch simultaneously.
    UPDATE public.places
    SET verification_level = 'community_verified'
    WHERE id = NEW.place_id
      AND verification_level NOT IN ('community_verified', 'owner_verified');

    -- Log only when this session won the race (FOUND = true).
    IF FOUND THEN
      INSERT INTO public.restaurant_audit_events (
        actor_type,
        action,
        entity_type,
        entity_id,
        source_type,
        reason,
        before_summary,
        after_summary
      ) VALUES (
        'system',
        'verification_level_promoted',
        'place',
        NEW.place_id,
        'database_trigger',
        'community_verified: ≥3 unique users, ≥7 days spread',
        jsonb_build_object('verification_level', v_current_level),
        jsonb_build_object(
          'verification_level', 'community_verified',
          'distinct_users',     v_distinct_users,
          'first_tag',          v_first_tag,
          'last_tag',           v_last_tag
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_promote_to_community_verified() FROM PUBLIC;

CREATE TRIGGER community_verification_trigger
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.maybe_promote_to_community_verified();
