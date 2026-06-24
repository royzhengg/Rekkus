# Data Governance

Data governance owns canonical entity identity, source-of-truth boundaries, audit history, repair workflows, and privacy-safe metadata.

## Canonical Identity

Canonical entity IDs are immutable UUIDs. A real-world entity can gain aliases, source mappings, ownership history, or merge records, but its canonical UUID should not be reused for a different entity.

| Entity | Canonical ID |
| --- | --- |
| User | `user_id` |
| Place | `place_id` |
| Dish | `dish_id`; unlinked dish-tag/free-text display remains non-canonical |
| Post | `post_id` |
| Collection | `collection_id` when collections ship |

## Source-Of-Truth Map

| Area | Source Of Truth | Notes |
| --- | --- | --- |
| Place identity | `places` | Rekkus canonical identity. |
| User-created places | `places.created_by`, `create_user_place`, `place_provenance` | First-party place creation with provenance and audit evidence. |
| Provider IDs | `place_provenance` | Google/OSM/provider mappings, data rights, attribution, and provenance. |
| Provider snapshots | `place_provider_cache` | TTL, attribution, retention, and cacheability metadata. |
| Google-selected places | `places`, `place_provenance`, `place_provider_cache`, `place_audit_events` | Selection promotes the place into the local graph with provider provenance; autocomplete suggestions that are merely displayed are not durable canonical data. |
| User/system observations | `place_observations` | Candidate facts awaiting trust or promotion. |
| Provider ID / name mappings | `place_provider_links` | External provider ID mappings, alternate names, and address variants from providers. Distinct from `place_aliases` (search text aliases). |
| Place ownership (current) | `place_owners` | Canonical current ownership state. Many-to-many; at most one approved `owner` per place. |
| Place audit | `place_audit_events` | Append-only place graph change evidence. |
| Ownership history | `place_ownership_events` | Claim, approval, rejection, transfer, and removal history. |
| Merge history | `place_merge_events` | Canonical/merged ID evidence and rollback references. |
| Repair history | `data_repair_events` | Malformed place, post, dish, and user repair reports. |
| Analytics | `analytics_events` | Privacy-safe event log only. |
| Post edit audit | `post_edit_events` | Privacy-minimized owner edit evidence; field names/count only. |
| Saved dish intent | `saved_dishes` | Owner-private save state for a canonical dish. |
| Saved organisation | `collection_items` | Membership only; collection-add atomically ensures the corresponding base save exists. |

## Taxonomy Confidence and Audit Pattern (B-625)

Taxonomy tag assignment follows a suggestions/assignments split that separates intake from authoritative state:

- All incoming signals (OSM, AI, admin, user) land in `taxonomy_suggestions` with a `confidence_score` and `source` enum.
- A moderation gate (or OSM/admin direct path) promotes accepted suggestions into `place_taxonomies` (authoritative truth).
- Search reads only `place_taxonomies_accepted` — a view enforcing `confidence_score >= 0.50 AND removed_at IS NULL`.
- Every lifecycle event (promotion, rejection, removal, restoration) writes an append-only row to `taxonomy_assignment_events`.
- Assignment removal is always a soft-delete (`removed_at`); hard-delete is forbidden so AI retraining and audit trails remain intact.
- Source authority hierarchy (admin > osm > ai > user) is enforced by a BEFORE UPDATE trigger — admin assignments are never overwritten.
- Confidence is an acceptance gate only; it is never used as a search ranking signal.

| Table / View | Role |
| --- | --- |
| `taxonomy_suggestions` | Intake — all sources, all states (pending / promoted / rejected) |
| `place_taxonomies` | Authoritative assignments only — truth table |
| `place_taxonomies_accepted` | View consumed by all search functions |
| `taxonomy_assignment_events` | Append-only audit log; RLS `FOR ALL USING (false)` |

See [ADR-0031](../adr/ADR-0031-taxonomy-assignment-pipeline.md) and [taxonomy-assignment.md](../domains/search/taxonomy-assignment.md).

## Audit And History Rules

- Critical admin, security, moderation, provider refresh, merge, alias, and ownership actions should be append-only.
- User-created places must record source and audit evidence before they are treated as durable first-party supply.
- Selected provider places must record source, provider cache, and audit evidence before future searches rely on them as local supply.
- Community metadata corrections and verification are observations until reviewed or promoted; they must not silently overwrite canonical place fields.
- Place claims and transfers need ownership history before place owner workflows scale.
- Duplicate cleanup must preserve alias and merge history so old links and references remain explainable.
- Repair workflows should record actor, reason, affected entity, before/after categories, and rollback path.
- B-283 canonicalisation backfills only posts with a canonical place and non-empty `best_dish`, and records bounded `dish_audit_events` context; UI never guesses links from display text.
- Admin platform place actions must use `place_merge_events`, `place_ownership_events`, `place_audit_events`, and `data_repair_events` as the operational evidence path before any custom dashboard writes directly to canonical data.
- `scripts/ops/check-audit.js` validates audit/history table coverage, service helper evidence, and the absence of broad update/delete policies on append-only history tables.

## Display Precedence

- Place photos should use Rekkus post or owner-submitted photos first, then provider photos only as fallback.
- Place ranking should use Rekkus post count and food ratings before provider rating/review-count boosts.
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

Post edit audit rows follow the same minimization principle. `post_edit_events` may record post id, owner id, event type, changed field names, changed field count, and timestamp. It must not record raw captions, comments, media URLs, place names, full addresses, provider payloads, or before/after values.

## Owners

- Architecture overview: [ARCHITECTURE.md](ARCHITECTURE.md)
- Analytics metadata: [../analytics/EVENTS.md](../analytics/EVENTS.md)
- Security and compliance: [../security/SECURITY.md](../security/SECURITY.md), [../security/COMPLIANCE.md](../security/COMPLIANCE.md)
- Place graph ADR: [../adr/0002-provider-independent-restaurant-graph.md](../adr/0002-provider-independent-restaurant-graph.md)
