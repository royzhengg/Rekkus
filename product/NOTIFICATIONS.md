# Notifications

Notifications own utility-first prompts that help users return to saved food intent, contribution loops, and trusted social activity.

## Principles

- Notifications must help users make or remember food decisions.
- Saves, revisits, comments, useful follows, and account/security updates outrank growth nudges.
- Default toward fewer notifications with clearer value.
- Do not use notifications for generic engagement farming, vanity loops, or restaurant advertising without explicit product review.

## Current Behavior

| Area | Current State | Owner |
| --- | --- | --- |
| Push token registration | Expo push token is registered on login | [../lib/services/notifications.ts](../lib/services/notifications.ts) |
| Send path | Supabase Edge Function sends push notifications | [../supabase/functions/send-push/index.ts](../supabase/functions/send-push/index.ts) |
| User settings | Notification preferences live in `user_settings` | [FEATURES.md](FEATURES.md) |
| Activity ledger | `social_events` is the source of truth for user-visible Alerts activity | [../docs/domains/social/ownership.md](../docs/domains/social/ownership.md) |
| Delivery state | `notification_deliveries` tracks push delivery/retry state only | [../docs/domains/social/ownership.md](../docs/domains/social/ownership.md) |
| Alerts tab | In-app social activity and follow-request surface | [RETENTION.md](RETENTION.md) |
| Message notifications | Direct and group message pushes use generic copy and `notif_messages` | [MESSAGING.md](MESSAGING.md) |
| Per-conversation mute | `muted_until` on `conversation_participants` suppresses push for that conversation | [MESSAGING.md](MESSAGING.md) |
| Group message notifications | Same `send-push` Edge Function; recipient determined from `conversation_participants` excluding sender | [MESSAGING.md](MESSAGING.md) |

## Allowed Notification Classes

| Class | Examples | Rules |
| --- | --- | --- |
| Account and security | Email/password/account state | Always utility-first; no marketing copy. |
| Social replies | Comments and direct interaction on user content | Rate-limit noisy threads. |
| Follow requests | Private-account request sent / approved | Request sent notifies the owner; approval notifies the requester; decline sends no notification. |
| Saved intent | Revisit reminders, saved place changes | Requires clear opt-in or settings control. |
| Contribution prompts | Review after visit, complete dish tags | Use cooldowns and avoid nag loops. |
| Local discovery | Nearby saved/trending dish prompts | Future only after relevance and opt-out controls exist. |
| Messages | Direct message and group message activity | Allowed only through the messaging RPC path; use generic copy ("You have a new message"); respect `notif_messages` and per-conversation `muted_until`; never include message body in notification payload. |

## Guardrails

- Do not send push notifications for generic likes until notification volume controls are clear.
- Do not derive notification preferences from `notification_deliveries`; preferences live in `user_settings`.
- Do not derive relationship state from `social_events`; relationships live in `follows` and `follow_requests`.
- Notification eligibility for user content must derive from `can_view_user_content()`; private posts, captions, places, tags, and media must never fan out to unauthorized users.
- Follow-request delivery records must have a source `social_events` row and respect notification settings.
- Track delivery/failure counts without storing raw push payloads in analytics.
- Keep provider credentials in Edge Functions only.
- Update [docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md) before adding notification events.
- Update [operations/RELEASE.md](../operations/RELEASE.md) when notification behavior affects beta review or app-store disclosures.
- Message notifications must never include sensitive private content in analytics or server logs.
