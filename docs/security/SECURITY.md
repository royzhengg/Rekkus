# Security

This document tracks Rekkus security controls, risks, and ISO 27001-readiness. It does not claim ISO certification.

## Principles

- Supabase RLS is the primary authorization layer.
- Client checks are UX only; never trust the client for authorization.
- Service-role secrets may only exist in Supabase Edge Functions.
- Public buckets are public-readable and must not store private media.
- External API calls must be bounded with debounce, dedupe, caching, quotas, or provider-side limits.
- Compliance, privacy rights, provider terms, audit evidence, and ISO inspection readiness live in [COMPLIANCE.md](COMPLIANCE.md).

## Data Classification

| Data | Classification | Notes |
| --- | --- | --- |
| Public posts, place metadata, public profiles | Public app data | Publicly readable by design |
| Saves (`saves`, `saved_places`, `saved_dishes`), collections, topic follows, settings, push tokens, auth identities | User-private/shareable | RLS scoped to owner; collection rows may be unlisted/public-readable only when visibility allows |
| Analytics events | Internal telemetry | Avoid sensitive content in metadata |
| Place observations, sources, aliases, provider cache | Source-attributed data | Must preserve provenance, retention, attribution, and audit rules. Note: underlying tables retain historical `restaurant_` prefix. |
| Place audit events and privacy requests | Compliance evidence | Minimized, access-controlled, and retained by policy. Note: `restaurant_audit_events` retains historical naming. |
| `auth_audit_events` | Compliance evidence (ISO A.12.4.1) | Permanent retention; service-role only; written via `record_auth_audit_event` SECURITY DEFINER RPC |
| `content_lifecycle_events` | Compliance evidence | Post/comment creation/deletion; no FK on entity_id — survives cascade delete; service-role only |
| `feature_flag_audit_events` | Compliance evidence | Runtime flag override mutations; fail-closed database trigger; service-role only |
| `platform_audit_events_view` | Unified compliance read surface | UNION ALL over all domain audit tables; query via service-role for incident investigation and compliance evidence |
| Direct message body and attachments | User-private | Accessible only to conversation participants via RLS; body nulled on user delete |
| Device-local pending intents (`rekkus:pending-mutations:v1`) | User-private/transient | Phase 1 scope: save/like/follow/setting. Contains only user IDs, entity IDs, target states, and timestamps. No authored text, media URLs, captions, message bodies, or report details. Entries expire after 7 days (TTL) or 5 retry failures. Cleared on sign-out via `clearDeferredMutationsForUser`. Queue is capped at 50 entries. |
| Message audit rows (deleted_at, sender_id, conversation_id) | Compliance evidence | Retained after body is nulled; participant-only RLS |
| Supabase service role, SMTP/Resend secrets | Secret | Backend/Supabase only |
| Google Maps/Places client keys | Public client keys | Must be provider-restricted |

## Security Checklist

- RLS enabled for every app table.
- Users can only mutate their own rows unless a specific policy says otherwise.
- Edge Functions derive actor identity from JWT, not request body.
- Edge Functions validate payloads before service-role reads/writes.
- Malformed privileged Edge Function requests are rejected before service-role access; invalid-boundary signals never include raw request or provider content.
- Uploads validate type, size, and user-scoped path.
- Media pipeline rules live in [MEDIA_PIPELINE.md](MEDIA_PIPELINE.md).
- Auth/email actions have cooldowns or provider rate limits.
- Analytics and notification events are deduped/throttled where practical.
- No raw tokens, reset links, passwords, or service errors are logged.
- Canonical place changes, provider refreshes, moderation/admin actions, privacy requests, and async jobs must produce audit evidence.
- Authentication events (login, logout, OAuth) must be recorded in `auth_audit_events` via SECURITY DEFINER RPC — not only in `analytics_events` (90-day retention is insufficient for ISO compliance).
- `auth_audit_events.context` must include device metadata (`device_os`, `device_version`) on login events. Client-side calls pass these from `Platform.OS`/`Platform.Version`. Server-side sessions capture `ip_hash` (SHA-256 of client IP, pseudonymised) and `device_os` (from user-agent) via the `auth-audit-hook` Edge Function (B-520). Raw IP is never stored.
- `check:risk-guardrails` enforces that every `recordAuthAuditEvent` login call includes a context argument — bare login audit calls fail CI. Login, password-change, and account-deletion events are additionally captured server-side by a PostgreSQL trigger on `auth.users` (B-519) — atomic with the auth transaction and immune to client crashes. `logout` is client-only (intentional: session invalidation does not update `auth.users` rows). Duplicate records from both paths are acceptable.
- Self-serve account deletion is wired via `delete_own_account()` SECURITY DEFINER RPC (B-522): atomically bulk-inserts `content_lifecycle_events` for all live owned posts (with `reason: 'account_deleted'`), then `DELETE FROM auth.users` fires `auth_audit_delete_trigger` to write the `account_deleted` event. Called via `deleteAccount()` in `lib/services/auth.ts`; `AuthContext.deleteAccount` also sends a client-side belt-and-suspenders audit call. `check:audit` enforces the RPC cannot be silently removed.
- Content creation and deletion events must be recorded in `content_lifecycle_events` via SECURITY DEFINER RPC — entity_id carries no FK so records survive cascade deletes.
- Runtime feature flag overrides must be recorded in `feature_flag_audit_events` by the fail-closed trigger on `feature_flag_overrides`; operational control changes must not depend on a UI write path for audit coverage.
- All domain audit tables are unified under `platform_audit_events_view` (ADR 0011). The `check:audit` guardrail enforces that every `*_audit_events` table is present in the view.
- New data/provider features must pass the compliance, data inventory, RLS, audit, provider, privacy, and ISO checks before release.
- Saved-library writes use owner-scoped rows. Collection adds atomically establish the target save; confirmed unsave removes owned memberships and the save together so private intent does not drift.
- Offline write recovery persists only strictly validated reversible desired-state intents in `AsyncStorage`. Authored posts/comments/messages, safety reports/blocks, profile/auth/account writes, collection creation/sharing/deletion, and publishing require explicit retry while online.
- Public beta requires a monitored vulnerability disclosure path with scope, expected response time, and escalation to incident handling.

## Auth And Email Cooldowns

Auth and email-like actions must use provider rate limits plus app-side cooldowns where practical:

- Login attempts: 10s per-email cooldown after each failed attempt (client-side UX guard; GoTrue is the primary backend control).
- Signup attempts use a 30-second local cooldown per normalized email.
- Password reset uses a 60-second local cooldown per normalized email.
- Onboarding anomalies are tracked through privacy-safe analytics events without storing email, password, token, or reset-link payloads.
- Resend/Supabase email volume remains part of release and cost review before public beta.
- **Roy action — verify before beta:** Check Supabase dashboard → Auth → Rate Limits. Confirm per-IP and per-email login attempt limits are configured (GoTrue default: ~5 failed attempts per 15 minutes per email). Enable CAPTCHA (HCaptcha) in Auth → Settings if brute-force risk is elevated at scale.
- **Roy action — activate IP capture (B-520):** Supabase Dashboard → Database → Webhooks → New webhook. Schema: `auth`, Table: `sessions`, Event: `INSERT`, URL: `https://<project-ref>.supabase.co/functions/v1/auth-audit-hook`. Generate a random secret and set it as `AUTH_HOOK_SECRET` in the Edge Function's environment variables. Once configured, every login session will record `ip_hash` + `device_os` in `auth_audit_events`.

## Moderation And Abuse Foundation

- Posts, comments, profiles, and places route reports through `content_reports`.
- User blocks are stored in `user_blocks` and remain owner-scoped by RLS.
- `moderation_actions`, `moderation_appeals`, `user_trust_profiles`, and soft-delete columns provide the first queue, appeal, trust, and reversible action model before an admin dashboard exists.
- Soft delete is enforced end-to-end: RLS SELECT policies filter `deleted_at is null` on `posts`, `comments`, and `post_photos`; hard-delete is blocked at the RLS layer; all deletes go through `delete_post()` / `delete_comment()` SECURITY DEFINER RPCs (owner-only). Content is physically purged after 30 days via `purge_soft_deleted_content()` (batched, pg_cron scheduled). Restore is possible within the 30-day window via `restore_post()` / `restore_comment()` (service role only — required for `moderation_appeals` flow). See ADR 0003.
- Abuse analytics use the sanitized `abuse_signal` event; do not include raw private content, exact location, secrets, or free-form private notes.
- Post editing is owner-only through existing post RLS plus `post_edit_events`. The audit table records event type and changed field names/count only; captions, media URLs, place names, addresses, and before/after values are forbidden.
- AI moderation remains disabled for user content until it is a first-pass flagger with human review, appeal, provider boundary, and audit evidence.

## Server-Side Rate Limit Strategy

Supabase Auth/provider limits remain the backend control for signup, login, email, password reset, and OAuth flows. App-side cooldowns are UX and cost controls only.

For highest-risk writes, prefer these backend controls before public beta scale:

| Surface | Current backend control | Next server-side control |
| --- | --- | --- |
| Auth/email | Supabase/Resend provider limits plus app cooldowns | Review provider dashboard limits before external beta |
| Comments/replies | Authenticated insert, owner/public RLS, moderation report path | Add RPC or Edge Function throttle if abuse appears |
| Saves/collections/likes/reactions/follows | Authenticated RLS plus unique constraints/upserts | Keep idempotent writes; add RPC throttle only if spam appears |
| Uploads | Picker validation, on-device media preparation/compression, storage ownership/path rules, processing-status metadata, media release gates | Move full normalization/validation into trusted server worker before broad public media scale |
| Analytics | Allowlisted metadata, 15-second client dedupe, RLS insert ownership | Add server aggregation or Edge Function intake if event volume becomes abusive |
| Provider APIs | Centralized services, minimum query length, dedupe, cache, field masks | Provider quota alerts and kill switch before production |

Do not add custom rate-limit infrastructure until a write surface needs server mediation; when it does, use a small Supabase RPC or Edge Function with actor ID, action key, window, max attempts, audit signal, and generic error response.

## Risk Register

| Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- |
| Forged notification actor | High | `send-push` derives actor from JWT | In progress |
| API quota exhaustion | High | Centralized services, cache/dedupe, provider quota alerts | In progress |
| Mock data leaking to beta/prod | Medium | `EXPO_PUBLIC_DATA_MODE=live`, hygiene checks | In progress |
| Public key misuse | Medium | Provider restrictions documented before beta/prod | Open |
| Upload abuse | Medium | Type/size/path validation required | Open |
| RLS drift | High | Release RLS audit checklist | Open |

## Edge Function Rules

- Keep `SUPABASE_SERVICE_ROLE_KEY` only in `supabase/functions`.
- Authenticate every request with the user JWT when user context is required.
- Validate event type, entity IDs, and ownership before acting.
- Return generic errors; do not leak raw exception details.

## ISO 27001 Readiness Map

| Area | Rekkus control |
| --- | --- |
| Access control | Supabase Auth, RLS, owner-scoped policies |
| Secure development | `CONTRIBUTING.md`, guardrail scripts, code review checklists |
| Secrets management | No service-role secrets in client; public env documented |
| Supplier/cloud services | Supabase, Google, Expo, Resend quota/key review |
| Logging/monitoring | Analytics plus future error reporting without secrets |
| Incident management | See runbook below |
| Backup/recovery | [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md), Supabase backup/PITR review before production |
| Vulnerability management | Dependency audit before beta/prod |
| Compliance evidence | [COMPLIANCE.md](COMPLIANCE.md), [../../operations/ISO_EVIDENCE.md](../../operations/ISO_EVIDENCE.md), automated ops checks |

## Incident Runbook

1. Contain: disable affected feature, rotate exposed keys, revoke sessions/tokens if needed.
2. Assess: identify data, users, services, and time window affected.
3. Decide notification: assess whether the incident may trigger OAIC Notifiable Data Breaches, app-store, provider, or user notification obligations.
4. Patch: fix policy/code/config and add regression guardrail.
5. Communicate: prepare user/vendor/store/regulator communication if required.
6. Review: document root cause and update this file/backlog.

NDB/OAIC assessment must identify affected data categories, likely serious harm, containment status, decision owner, notification deadline, and affected-user message. Do not store raw private exports, secrets, or unnecessary PII in incident notes.

## Private Messaging

Direct messaging is live (`directMessages: enabled: true`). Security controls:

- Conversation read gated by `conversation_participants.user_id = auth.uid()` RLS, excluding declined request participants
- Message insert gated by active participant state + block check (in `send_direct_message` RPC)
- Direct and group message requests are based on whether the recipient follows the sender; pending recipients cannot send until they accept
- Push notifications for messages target active participants only, so pending requests do not alert like accepted chats
- Message delete restricted to sender only via `delete_message` RPC (true erasure: body + attachment nulled)
- Group mutations (add/remove member, promote admin) via security-definer RPCs only — never direct table inserts
- Media uploads validated for MIME type and size before storage write; CSAM hash check runs before message record is created
- Spam rate limits enforced server-side in `moderate-content` Edge Function
- Private-message bodies must not appear in analytics events, operational summaries, push notification payloads, or server logs
- Thread UI exposes report/block actions; message writes blocked after either account blocks the other
- Message push notifications use generic copy and respect `notif_messages` and per-conversation `muted_until`

## Vulnerability Disclosure

Before public beta, publish or document:

- monitored `security@` contact or equivalent intake path
- in-scope systems and out-of-scope testing
- expected first-response SLA
- escalation from credible vulnerability reports to the incident runbook
- future `.well-known/security.txt` path when a public web property exists

Backup, restore, and migration recovery rules live in [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md).
Media upload, variant, cleanup, and storage-cost rules live in [MEDIA_PIPELINE.md](MEDIA_PIPELINE.md).

## Create Draft Privacy

Account-synced create drafts use `post_drafts` and `post_draft_media` with owner-only RLS. Draft media lives in the private `post-drafts` bucket under `{user_id}/{draft_id}/...`; storage policies allow only the authenticated owner to read, write, update, or delete those objects. Explicitly saved drafts appear in `/create/drafts`; autosaves remain recovery-only and should not be treated as public or profile-visible content.
