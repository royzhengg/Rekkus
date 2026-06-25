-- MFA Recovery Codes — B-MFA
-- Recovery codes are custom-built (Supabase does not ship them natively).
-- All access is via security-definer RPCs; RLS denies all direct client operations.
-- SHA-256 is used for hashing (not bcrypt) because codes are ≥80-bit entropy random keys.
-- Decision rationale: ADR-0029.

-- ----------------------------------------------------------------
-- Ensure pgcrypto is available for digest() / sha256
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------
-- Recovery codes table
-- ----------------------------------------------------------------
CREATE TABLE public.user_mfa_recovery_codes (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_id   uuid         NOT NULL,  -- shared across all 8 codes in one batch
  code_hash       varchar(64)  NOT NULL,  -- SHA-256 hex is always exactly 64 chars
  used_at         timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.user_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- All access via security-definer RPCs. Explicit deny for all client operations.
-- INSERT/UPDATE/DELETE are only done through security-definer functions;
-- these policies document that intent and prevent any accidental direct access.
CREATE POLICY "deny_select" ON public.user_mfa_recovery_codes FOR SELECT USING (false);
CREATE POLICY "deny_insert" ON public.user_mfa_recovery_codes FOR INSERT WITH CHECK (false);
CREATE POLICY "deny_update" ON public.user_mfa_recovery_codes FOR UPDATE USING (false);
-- Delete also denied at RLS level. The generate_recovery_codes() security-definer
-- function handles deletion internally; no client-side delete path is intended.
CREATE POLICY "deny_delete" ON public.user_mfa_recovery_codes FOR DELETE USING (false);

-- Fast lookup for unused codes per user
CREATE INDEX idx_recovery_codes_user_unused
  ON public.user_mfa_recovery_codes(user_id) WHERE used_at IS NULL;

-- Prevent duplicate hashes within a generation batch
ALTER TABLE public.user_mfa_recovery_codes
  ADD CONSTRAINT uq_recovery_code_hash UNIQUE (user_id, generation_id, code_hash);

-- Ensure hash is always a valid SHA-256 hex string (64 chars)
ALTER TABLE public.user_mfa_recovery_codes
  ADD CONSTRAINT chk_hash_length CHECK (char_length(code_hash) = 64);

-- ----------------------------------------------------------------
-- GENERATE: user_id always derived from auth.uid() — never trust client.
-- Deletes old codes before inserting so concurrent calls leave exactly
-- one valid set (last writer wins, no duplicate rows).
--
-- Hashing: normalise → SHA-256. Same canonicalisation as verify_recovery_code()
-- ensures stored and compared hashes always match.
-- generation_id is shared across all 8 rows in one batch.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_recovery_codes(p_codes text[])
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_generation_id uuid := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF array_length(p_codes, 1) != 8 THEN
    RAISE EXCEPTION 'exactly 8 recovery codes required';
  END IF;
  -- Delete all existing codes for this user before inserting new batch.
  -- Concurrent regeneration: last writer wins; codes from earlier calls become invalid.
  DELETE FROM public.user_mfa_recovery_codes WHERE user_id = auth.uid();
  -- Normalise before hashing: uppercase, strip spaces and dashes.
  INSERT INTO public.user_mfa_recovery_codes(user_id, generation_id, code_hash)
  SELECT auth.uid(),
         v_generation_id,
         encode(digest(upper(regexp_replace(code, '[\s\-]', '', 'g')), 'sha256'), 'hex')
  FROM unnest(p_codes) AS code;
END;
$$;

-- ----------------------------------------------------------------
-- VERIFY: direct UPDATE...RETURNING — no subquery needed.
-- (user_id, generation_id, code_hash) is unique, and generate_recovery_codes()
-- deletes all old rows before inserting, so at most one unused row can match
-- per (user_id, code_hash) at any time. Direct update is atomic and simpler.
-- Normalise input before hashing (same as generation).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_recovery_code(p_code text)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_normalised text;
  v_matched_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  -- Normalise: uppercase, strip spaces and dashes (same canonicalisation as generation)
  v_normalised := upper(regexp_replace(p_code, '[\s\-]', '', 'g'));
  UPDATE public.user_mfa_recovery_codes
  SET used_at = now()
  WHERE user_id = auth.uid()
    AND used_at IS NULL
    AND code_hash = encode(digest(v_normalised, 'sha256'), 'hex')
  RETURNING id INTO v_matched_id;

  RETURN v_matched_id IS NOT NULL;
END;
$$;

-- ----------------------------------------------------------------
-- COUNT: remaining unused codes for the current user
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_remaining_recovery_codes()
  RETURNS int
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT count(*)::int FROM public.user_mfa_recovery_codes
  WHERE user_id = auth.uid() AND used_at IS NULL;
$$;

-- ----------------------------------------------------------------
-- Explicit execute permissions.
-- Revoke from public first (belt-and-suspenders; Supabase may already restrict).
-- Function ownership: security definer runs with the owner's privileges.
-- After migration, verify the owner is the postgres/service role.
-- ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.generate_recovery_codes(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_recovery_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_remaining_recovery_codes() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_recovery_codes(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_recovery_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_remaining_recovery_codes() TO authenticated;

-- ----------------------------------------------------------------
-- Extend auth_audit_events CHECK constraint to include MFA event types.
-- The existing constraint is inline on the column (auto-named by Postgres).
-- Drop and recreate as a named table-level constraint.
-- ----------------------------------------------------------------
ALTER TABLE public.auth_audit_events
  DROP CONSTRAINT IF EXISTS auth_audit_events_event_type_check;

ALTER TABLE public.auth_audit_events
  ADD CONSTRAINT auth_audit_events_event_type_check CHECK (event_type IN (
    'login_email_success',
    'login_oauth_success',
    'logout',
    'password_changed',
    'account_deleted',
    'mfa_enrolled',
    'mfa_enroll_failed',
    'mfa_unenrolled',
    'mfa_challenge_started',
    'mfa_verified',
    'mfa_challenge_failed',
    'mfa_recovery_code_used',
    'mfa_recovery_code_failed',
    'mfa_recovery_codes_regenerated',
    'mfa_disable_attempted',
    'mfa_disable_cancelled'
  ));
