# Data Governance

Data governance owns canonical entity identity, source-of-truth boundaries, audit history, repair workflows, and privacy-safe metadata.

## Canonical Identity

Canonical entity IDs are immutable UUIDs. A real-world entity can gain aliases, source mappings, ownership history, or merge records, but its canonical UUID should not be reused for a different entity.

| Entity | Canonical ID |
| --- | --- |
| User | `user_id` |
| Restaurant | `restaurant_id` |
| Dish | `dish_id`; unlinked dish-tag/free-text display remains non-canonical |
| Review/post | `review_id` or current `post_id` until review naming is migrated |
| Collection | `collection_id` when collections ship |

## Source-Of-Truth Map

| Area | Source Of Truth | Notes |
| --- | --- | --- |
| Restaurant identity | `restaurants` | Rekkus canonical identity. |
| User-created restaurants | `restaurants.created_by`, `create_user_restaurant`, `restaurant_sources` | First-party restaurant creation with provenance and audit evidence. |
| Provider IDs | `restaurant_sources` | Google/OSM/provider mappings and provenance. |
| Provider snapshots | `restaurant_provider_cache` | TTL, attribution, retention, and cacheability metadata. |
| User/system observations | `restaurant_observations` | Candidate facts awaiting trust or promotion. |
| Duplicate aliases | `restaurant_aliases` | Alternate names, old IDs, and duplicate hints. |
| Restaurant audit | `restaurant_audit_events` | Append-only restaurant graph change evidence. |
| Ownership history | `restaurant_ownership_events` | Claim, approval, rejection, transfer, and removal history. |
| Merge history | `restaurant_merge_events` | Canonical/merged ID evidence and rollback references. |
| Repair history | `data_repair_events` | Malformed restaurant, post, dish, and user repair reports. |
| Analytics | `analytics_events` | Privacy-safe event log only. |
| Post edit audit | `post_edit_events` | Privacy-minimized owner edit evidence; field names/count only. |
| Dish bookmark intent | `saved_dishes` | Owner-private save state for a canonical dish. |
| Saved organisation | `collection_items` | Membership only; collection-add atomically ensures the corresponding base save exists. |

## Audit And History Rules

- Critical admin, security, moderation, provider refresh, merge, alias, and ownership actions should be append-only.
- User-created restaurants must record source and audit evidence before they are treated as durable first-party supply.
- Community metadata corrections and verification are observations until reviewed or promoted; they must not silently overwrite canonical restaurant fields.
- Restaurant claims and transfers need ownership history before restaurant owner workflows scale.
- Duplicate cleanup must preserve alias and merge history so old links and references remain explainable.
- Repair workflows should record actor, reason, affected entity, before/after categories, and rollback path.
- B-283 canonicalisation backfills only posts with a canonical restaurant and non-empty `best_dish`, and records bounded `dish_audit_events` context; UI never guesses links from display text.
- Admin platform restaurant actions must use `restaurant_merge_events`, `restaurant_ownership_events`, `restaurant_audit_events`, and `data_repair_events` as the operational evidence path before any custom dashboard writes directly to canonical data.
- `scripts/ops/check-audit.js` validates audit/history table coverage, service helper evidence, and the absence of broad update/delete policies on append-only history tables.

## Display Precedence

- Restaurant photos should use Rekkus post or owner-submitted photos first, then provider photos only as fallback.
- Restaurant ranking should use Rekkus post count and food ratings before provider rating/review-count boosts.
- Owner-submitted content can become primary only after ownership evidence exists; until then it is stored as pending observation or repair evidence.

## Messaging Entities

| Entity | Canonical ID | Source of Truth | Notes |
| --- | --- | --- | --- |
| `conversation` | `conversations.id` (UUID) | Supabase | Immutable once created; `conversation_type` is either 'direct' or 'group' |
| `message` | `messages.id` (UUID) | Supabase | Soft-deleted via `deleted_at`; body + attachment nulled on user delete for true erasure; row retained for audit continuity |
| `conversation_participant` | composite: `(conversation_id, user_id)` | Supabase | `is_admin` is mutable (admin promotion); `muted_until`, `pinned_at`, `archived_at` are user-preference fields, not authoritative state |
| `message_reaction` | composite: `(message_id, user_id)` | Supabase | One reaction per user per message; INSERT/DELETE only (no UPDATE) |
| `conversation_pinned_messages` | composite: `(conversation_id, message_id)` | Supabase | Many pinned messages per conversation; any participant can pin/unpin |
| `message_deliveries` | composite: `(message_id, user_id)` | Supabase | Per-message delivery and read state; cleared on account delete |

> Group membership history is append-only in audit context. `conversation_participants` rows for removed members are deleted, so admins must log add/remove events in `moderation_actions` if an audit trail is needed.

## Privacy-Safe Metadata

Analytics and operational metadata must not store raw secrets, emails, phone numbers, private notes, raw provider payloads, exact private location trails, reset links, payment data, or unrestricted support correspondence.

Prefer bounded categories such as `feature`, `reason`, `source`, `status`, `surface`, and `provider`.

`lib/analytics.ts` sanitizes analytics metadata with an allowlist, string length cap, and obvious PII redaction before writing to `analytics_events`.

Post edit audit rows follow the same minimization principle. `post_edit_events` may record post id, owner id, event type, changed field names, changed field count, and timestamp. It must not record raw captions, comments, media URLs, restaurant/place names, full addresses, provider payloads, or before/after values.

## Owners

- Architecture overview: [ARCHITECTURE.md](ARCHITECTURE.md)
- Analytics metadata: [../analytics/EVENTS.md](../analytics/EVENTS.md)
- Security and compliance: [../security/SECURITY.md](../security/SECURITY.md), [../security/COMPLIANCE.md](../security/COMPLIANCE.md)
- Restaurant graph ADR: [../adr/0002-provider-independent-restaurant-graph.md](../adr/0002-provider-independent-restaurant-graph.md)
