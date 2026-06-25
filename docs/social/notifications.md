# Notification Architecture

See also: [mentions.md](mentions.md), [ADR-0032](../adr/ADR-0032-mention-notification-pipeline.md)

## Authority

**The database is the single source of truth for mention notification creation, recipient resolution, and delivery eligibility.**

Client-side parsing (`lib/social/mentions.ts`) is presentational only and must never influence notification creation, recipient selection, or delivery.

## Feature flag precedence

```
app_config.mention_notifications_enabled = 'true'   ← global kill switch (ops team)
         ↓
user_settings.notif_mentions = true                 ← per-user preference
         ↓
Delivery proceeds
```

- `app_config` disables the feature globally without a code deploy.
- `notif_mentions` disables for one user only.
- `lib/featureFlags.ts` (`mention_notifications`) controls client UI exposure only.

## Notification types

| Type | Trigger | DB event | Push body |
| --- | --- | --- | --- |
| `like` | Client `notify()` after likePost | `like_post` | "X liked your post" |
| `comment` | Client `notify()` after addComment | `comment_post` | "X commented on your post" |
| `comment_reply` | Client `notify()` after addReply | `reply_comment` | "X replied to your comment" |
| `follow` | Client `notify()` after followUser | `follow` | "X started following you" |
| `follow_request` | Client `notify()` after followUser (private) | `follow_request_pending` | "X requested to follow you" |
| `follow_request_approved` | DB trigger only | `follow_request_approved` | "X approved your follow request" |
| `mention` | DB trigger only (pg_net) | `mention` | "X mentioned you in a post/comment" |

## Ownership layers

| Layer | Owns | Purity |
| --- | --- | --- |
| `lib/social/mentions.ts` | TS mention parsing — editor/UI only | pure, no I/O |
| `parse_mention_usernames(text)` | PL/pgSQL: extract @usernames from raw text | pure, no DB access |
| `resolve_mention_user_ids(...)` | Batch-lookup user IDs, apply allow_tags + block guards | reads only |
| `create_mention_events(...)` | Batch-insert social events for resolved recipients | writes only |
| `extract_post_mentions()` / `extract_comment_mentions()` | Trigger orchestrators | thin orchestration |
| `create_social_event()` | Deduplication, persistence | writes |
| `enqueue_social_event_delivery()` | Settings gate, notification_deliveries, pg_net | writes + queues HTTP |
| `send-push` Edge Function | Push payload, Expo delivery | HTTP only |
| `SettingsContext.updateSetting` | Client analytics on toggle | client-side |

## Mention delivery sequence

```
User inserts post (caption: "hey @alice @bob!")
 │
 ├─ AFTER INSERT trigger: extract_post_mentions()   ← synchronous, inside transaction
 │   ├─ parse_mention_usernames(caption)            → ['alice', 'bob']
 │   ├─ resolve_mention_user_ids(...)               → [alice_id, bob_id]
 │   └─ create_mention_events(actor, 'post', post_id, post_id, [alice_id, bob_id])
 │       ├─ create_social_event(actor, alice_id, 'mention', 'post', post_id, ...)
 │       │   └─ enqueue_social_event_delivery(event_id)
 │       │       ├─ check notif_mentions → allowed
 │       │       ├─ INSERT notification_deliveries
 │       │       └─ extensions.net.http_post() → queued (fires after commit)
 │       └─ create_social_event(actor, bob_id, ...)
 │           └─ enqueue_social_event_delivery(...)
 │               └─ extensions.net.http_post() → queued
 │
 ├─ Transaction commits
 │
 ├─ pg_net sends HTTP to send-push (async, after commit)
 │   ├─ Expo Push API → Alice's device
 │   └─ Expo Push API → Bob's device
 │
 └─ Post creation returns to client (not blocked)
```

## Invariants

- The database is the only notification authority.
- One recipient receives at most one mention notification per entity.
- Mention notifications are immutable after delivery (no retraction on edit).
- Mention parsing is deterministic and locale-independent.
- Mention creation never blocks post or comment creation.
- Delivery always respects `notif_mentions` before sending a push.
- `create_mention_events()` accepts only already-resolved IDs — it never resolves usernames, inspects captions, or queries `user_settings`.

## Do not

- Resolve @usernames to user IDs in React or any client code.
- Create mention notifications client-side via `notify()`.
- Bypass `create_social_event()` to write to `social_events` directly.
- Duplicate regex constants — `docs/social/mentions.md` is the single source of truth.
- Add new mention sources without updating this file, `mentions.md`, and the ADR.
- Call `posts.update` or `comments.update` from inside mention trigger functions (prevents recursion).

## Future observability

Metrics worth adding when scaling:

- `mentions_created` — total mention events per day
- `mentions_skipped_blocked` — suppressed by block relationship
- `mentions_skipped_allow_tags` — suppressed by allow_tags = false
- `mentions_unresolved` — usernames with no matching user
- `mention_limit_hit` — entities exceeding 20 mentions (currently logged via `RAISE LOG`)
