# Moderation Operations

Moderation operations own the first operational rules for reports, blocks, disputes, review trust, and future moderation queues.

## Principles

- Human review remains final for trust-affecting moderation.
- Reports and actions need audit history.
- Moderation should be reversible where legally and safely possible.
- Keep raw private data out of analytics and dashboards.
- Restaurant disputes must not become a path to selectively remove negative but legitimate reviews.

## Minimum Workflow

| Step | Rule |
| --- | --- |
| Intake | Reports identify target, reason, reporter, timestamp, and source surface. |
| Triage | Prioritize safety, spam, legal, privacy, and impersonation risks. |
| Action | Record action, actor, reason, and affected entity. |
| Notice | Notify users only when policy and privacy allow. |
| Appeal/review | Preserve evidence and allow correction for mistakes. |

## Moderation Queue

The v1 queue is data-backed, not an admin dashboard. Reports land in `content_reports`, human/system decisions are recorded in `moderation_actions`, appeals land in `moderation_appeals`, and user blocks land in `user_blocks`.

Queue rules:

- Reports must include reporter, target type, target ID, reason, source surface, status, priority, and timestamp.
- Moderation actions must include actor type, action, reason, target, reversibility, and whether the action was shadow moderation.
- Admin-only dashboards remain future UI work; the schema, service path, and [../../operations/ADMIN_PLATFORM.md](../../operations/ADMIN_PLATFORM.md) control matrix are the first release-critical foundation.

## Admin Actions

Ban/suspend users through `user_trust_profiles` and `moderation_actions`; do not add a separate suspension store unless a real limitation appears. Hide/remove posts and comments through `deleted_at`/`deleted_reason` soft-delete fields plus a reversible moderation action. Restores must record a matching `restore_content` action so appeals and support reviews can reconstruct what happened.

## Report And Block Flow

The app exposes the first in-app report/block surfaces on post detail and user profile screens.

- Posts, comments, and profiles can be reported through `lib/services/moderation.ts`.
- Profiles and creators can be blocked through `user_blocks`.
- Reports and blocks emit privacy-safe `abuse_signal` analytics metadata only.
- Store-release checks should treat broken report/block flow as a blocker for public UGC.

## Disputes And Takedowns

Use `content_reports.report_type` to distinguish normal reports from `fake_review`, `incentive_disclosure`, `dispute`, and `takedown` cases.

- Restaurant and user disputes need an owner, status, and SLA before public launch.
- Takedown requests must be routed through support/privacy/security contact paths when legal risk is possible.
- Negative but legitimate reviews must not be removed for commercial pressure.

## Progressive Permissions

Progressive permissions use `user_trust_profiles` as the future review surface. Until runtime restrictions ship, new and restricted accounts should be handled by product rules, auth gates, cooldowns, and moderation history.

## Trust Scoring

Trust scoring is private and explainable. Scores must not be publicly displayed or used to punish users without a human-review path. Inputs may include report outcomes, account age, verified contribution quality, and abuse history.

## Shadow Moderation

Shadow moderation is allowed only as a reversible, auditable action recorded in `moderation_actions.shadow_mode`. It must not replace a user-visible appeal or takedown path.

## Moderation Appeals

Appeals land in `moderation_appeals` and must preserve the linked report/action, appellant, reason, status, and timestamps. Human review remains final for trust-affecting outcomes.

## Soft Delete

`deleted_at` and `deleted_reason` fields on posts/comments/post photos allow content to be hidden immediately while preserving audit and appeal evidence. Storage cleanup remains a controlled job after the data record is safely hidden.

## Messaging Moderation

### CSAM Detection Flow

1. User selects image/video to send in a DM
2. Client computes SHA256 hash of first 64 KB via `expo-crypto`; sends hash + file type to `moderate-content` Edge Function
3. Edge Function checks hash against `csam_hash_blocklist` DB table
4. If matched: file is not uploaded; message is not created; incident logged to `content_reports` (type=csam_detected); NCMEC CyberTipline report filed automatically via API; user account suspended via `auth.admin.updateUserById`
5. If clean: file uploaded to `message-attachments` bucket; message record created
6. All CSAM incidents reviewed by a human moderator within 24h; account remains suspended pending review

### NCMEC Reporting

- Rekkus files CyberTipline reports programmatically for every CSAM detection
- Reports include: user_id, timestamp, hashed file identifier, conversation_id (redacted for privacy), device metadata
- Retain NCMEC confirmation receipt in `content_reports.audit_reference`

### Spam Rate Limits

- Max 10 messages/min per user per conversation; max 50/hr globally
- New accounts (<7 days): 5 messages/min, 20/hr
- Violations logged in `user_trust_profiles`; 3 violations in 24h triggers temporary send block

### Text Content Moderation

- Keyword blocklist checked in `moderate-content` Edge Function on every text send
- Matched messages blocked; sender sees a generic "message could not be sent" error
- False positive appeal: user can report via Settings → Help

### Message Deletion Audit

- Deleted messages retain their row with `deleted_at`, `sender_id`, and `conversation_id` for moderation continuity
- Body, `attachment_url`, and `attachment_metadata` are nulled for user privacy
- Moderation admin-forced deletions recorded in `moderation_actions` with `reversible=false` for CSAM, `reversible=true` for policy violations

## Owners

- Product trust: [../../product/TRUST.md](../../product/TRUST.md)
- Security/compliance: [../security/SECURITY.md](../security/SECURITY.md), [../security/COMPLIANCE.md](../security/COMPLIANCE.md)
- Incident response: [../../operations/INCIDENTS.md](../../operations/INCIDENTS.md)
