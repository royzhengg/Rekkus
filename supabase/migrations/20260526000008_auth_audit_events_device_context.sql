-- B-520: Extend auth_audit_events.context to include SHA-256-hashed IP and device metadata.
--
-- Context schema (jsonb) after this migration:
--   client-side:  { provider, device_os, device_version }
--   server-side:  { provider, device_os, ip_hash, source }   (from auth-audit-hook Edge Function)
--   trigger-side: { provider, source }                        (from auth_audit_log_trigger, 000006)
--
-- ip_hash: SHA-256(ip::text) — one-way pseudonymisation. Not reversible. GDPR-safe for correlation.
-- device_os: 'ios' | 'android' | 'web' | 'unknown' — inferred from user-agent server-side,
--            from Platform.OS client-side.
-- device_version: Platform.Version string — client-side only.
--
-- No column changes required — context is already jsonb.
-- GDPR / COMPLIANCE.md: hashed IP is pseudonymised data, not personal data under recital 26.
-- Privacy rationale: SHA-256 is computationally infeasible to reverse without the original value;
--   used solely for same-IP correlation in security investigations.

-- Roy action (required to activate Edge Function IP capture):
--   Supabase Dashboard → Database → Webhooks → New webhook
--   Schema: auth | Table: sessions | Event: INSERT
--   URL: https://<project-ref>.supabase.co/functions/v1/auth-audit-hook
--   Secret: generate random string → store as AUTH_HOOK_SECRET in Edge Function env vars

COMMENT ON TABLE public.auth_audit_events IS
  'ISO A.12.4.1 auth audit trail. Append-only. '
  'Server-side guarantee: triggers on auth.users INSERT/UPDATE/DELETE (B-519, 20260526000006). '
  'IP + device capture: auth-audit-hook Edge Function on auth.sessions INSERT (B-520, 20260526000008). '
  'Client-side calls in AuthContext are belt-and-suspenders; duplicate records are acceptable. '
  'logout is client-only (session invalidation does not update auth.users rows). '
  'Context schema: { provider, device_os, device_version?, ip_hash?, source? }. '
  'ip_hash is SHA-256(ip::text) — pseudonymised, not reversible, GDPR-safe. '
  'Never stores raw IP, email, credentials, or tokens.';
