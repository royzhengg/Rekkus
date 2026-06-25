# ADR-0032: Mention Notification Pipeline

**Status**: Accepted
**Date**: 2026-06-25
**Owner**: Social

See also: [docs/social/mentions.md](../social/mentions.md), [docs/social/notifications.md](../social/notifications.md)

## Context

The `notif_mentions` toggle exists in the UI and database schema but does nothing — no mention events are created, no pushes sent. We need to close this gap and wire the full pipeline.

## Decision

**The database is the single source of truth for mention notification creation, recipient resolution, and delivery eligibility.**

The pipeline is:

```
posts/comments INSERT or UPDATE
  → DB trigger extracts @mentions
  → resolve user IDs (batch, with block + allow_tags guards)
  → create_social_event() per recipient
  → enqueue_social_event_delivery() checks notif_mentions
  → pg_net queues HTTP to send-push Edge Function
  → Expo Push API delivers to device
```

No client code resolves @usernames. No client code calls `notify()` for mentions.

## Rejected alternative: client-side mention notifications

This was rejected because:

- **Not authoritative**: client code does not have access to moderation state (`has_user_block_between`), `allow_tags`, or block relationships at notification time.
- **Duplicates DB logic**: username resolution would need to be implemented and maintained in two places.
- **Harder to guarantee idempotency**: client retries or double-submits could create duplicate notifications.
- **Bypasses guards**: the DB trigger enforces block relationships, `allow_tags`, self-mention suppression, and the 20-mention cap atomically within the same transaction.

## Uniqueness constraint

The existing unique constraint on `social_events (source_type, source_id, event_type)` is insufficient for mentions because all mentions on a single entity share the same `source_id` (the post or comment ID), meaning only one recipient could ever receive a notification.

We add a partial unique index instead:

```sql
CREATE UNIQUE INDEX social_events_mention_unique_idx
  ON public.social_events (actor_id, target_user_id, entity_type, entity_id)
  WHERE event_type = 'mention';
```

This allows multiple recipients per entity while preventing duplicate notifications to the same recipient.

## Regex divergence

PostgreSQL uses POSIX ERE, which does not support negative lookbehind (`(?<!...)`). TypeScript (ES2018+) does. The two regex patterns are behaviourally equivalent:

- SQL: `'(?:^|[^[:alnum:]])@([[:alnum:]_]+)'` — capture group 2
- TypeScript: `/(?<![A-Za-z0-9])@([A-Za-z0-9_]+)/g`

This divergence is intentional and documented in `docs/social/mentions.md`. Do not attempt to unify them.

## Mention immutability

Mention notifications are not retracted when a @mention is removed by editing. This matches the behaviour of major social platforms (Instagram, Threads). The trigger fires only on newly-added usernames (set difference between old and new), so editing does not re-notify existing mentions. Removing a mention after delivery has no effect on the notification already sent.

## Feature flag precedence

```
app_config.mention_notifications_enabled = 'true'  ← global kill switch
         ↓
user_settings.notif_mentions                        ← per-user preference
         ↓
Delivery
```

`lib/featureFlags.ts` (`mention_notifications`) controls client UI exposure only and does not gate DB trigger or push delivery.

## Consequences

- Mention notifications are reliable: they fire within the same DB transaction as the post/comment insert.
- All privacy, moderation, and preference checks are enforced server-side.
- The client TS parser (`lib/social/mentions.ts`) is intentionally non-authoritative and exists solely for future editor features (autocomplete, highlighting).
- If `mention_notifications_enabled` is removed from `app_config`, mentions still create social events — only push delivery is suppressed.
