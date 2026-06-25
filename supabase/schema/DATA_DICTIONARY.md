# Data Dictionary

Canonical reference for all tables in the Rekkus schema. Every table must have an entry here.
Update this file whenever a table is added, renamed, or reclassified.

**Lifecycle classifications:**
- **Core** — source of truth; never regeneratable from other tables
- **Derived** — can be rebuilt from source tables; includes source tables and rebuild procedure
- **Provider-managed** — owned by import pipelines; TTL or expiry applies
- **Temporary** — staging or cache with an explicit cleanup path

---

## Core Domain

### places

Domain: Core | Owner: Discovery | Classification: Entity | Lifecycle: Core | Source of Truth: Yes

The canonical venue entity. Every place in the product has one row here.

Related tables (satellite data):
- `place_contact`, `place_features`, `place_stats`, `place_hours` — normalized attribute fragments
- `place_aliases` — search-quality alternative names (community / admin / taxonomy)
- `place_traits`, `place_sources`, `place_provider_metadata` — discovery metadata
- `place_owners` — current ownership state (canonical)
- `place_search_index` — derived search signals (Derived — rebuilable)

Does not contain:
- Analytics scores → `place_stats` (Derived)
- Search signals → `place_search_index` (Derived)
- Provider raw payloads → `place_provider_cache` (Provider-managed)
- Data provenance/rights → `place_provenance` (Audit)

### users

Domain: Core | Owner: Platform | Classification: Entity | Lifecycle: Core | Source of Truth: Yes

The canonical user entity. Includes profile, settings, and counters.

Related tables:
- `user_trust_profiles` — moderation trust level
- `follows` — social graph

### dishes

Domain: Core | Owner: Discovery | Classification: Entity | Lifecycle: Core | Source of Truth: Yes

Canonical dish entity. A dish belongs to a place and is soft-deletable via `deleted_at`.

Rebuild: Not applicable (user-generated content).

### posts

Domain: Core | Owner: Growth | Classification: Entity | Lifecycle: Core | Source of Truth: Yes

User-generated reviews/posts. Soft-deleted via `deleted_at`.

Related tables: `post_photos`, `post_hashtags`, `post_reactions`, `post_edits`, `comments`

### collections

Domain: Social | Owner: Growth | Classification: Entity | Lifecycle: Core | Source of Truth: Yes

User-created lists of places, posts, or dishes. Soft-deleted via `deleted_at` + `deleted_reason`.

---

## Search Domain

### place_search_index

Domain: Search | Owner: Discovery | Classification: Derived | Lifecycle: Derived | Source of Truth: No

**Source tables:** `places`, `place_aliases`, `place_traits`, `post_reactions`
**Rebuild function:** `repair_place_stats()` (partial); full rebuild pending (see BACKLOG)
**Rebuild cost:** Medium — full table scan across places and aliases

Do not query `places` for search; query `place_search_index` instead.

### taxonomy_nodes / taxonomy_aliases

Domain: Search | Owner: Discovery | Classification: Core | Lifecycle: Core | Source of Truth: Yes

Cuisine taxonomy tree. Powers cuisine filtering and search suggestion.

### trending_searches

Domain: Search | Owner: Discovery | Classification: Derived | Lifecycle: Derived | Source of Truth: No

**Source tables:** `search_analytics`, `search_events`
**Rebuild:** Truncate and re-aggregate from search_analytics. Low-risk.

---

## Provider Domain

### place_provider_cache

Domain: Provider | Owner: Data / Import Pipelines | Classification: Provider-managed | Lifecycle: Provider-managed | Source of Truth: No

Raw normalized payloads from external providers (Google, OSM). Expires via `stale_at`.
Never use this as a source of truth for place attributes — merge into `places` via the pipeline.

### place_observations

Domain: Provider | Owner: Data / Import Pipelines | Classification: Provider-managed | Lifecycle: Core | Source of Truth: No

User-submitted field corrections and community observations. Feed into the merge pipeline.

### place_merge_events

Domain: Provider | Owner: Data / Import Pipelines | Classification: Audit | Lifecycle: Core | Source of Truth: Yes

History of place deduplication/merge decisions.

---

## Audit Domain

### place_audit_events

Domain: Audit | Owner: Platform / Compliance | Classification: Audit | Lifecycle: Core | Source of Truth: Yes

Structured audit log for all place-related operations. Append-only.

### place_ownership_events

Domain: Audit | Owner: Platform / Compliance | Classification: Audit | Lifecycle: Core | Source of Truth: Yes

History of place ownership claim/transfer events. Canonical current state lives in `place_owners`.

### place_provenance

Domain: Audit | Owner: Platform / Compliance | Classification: Audit | Lifecycle: Core | Source of Truth: Yes

Tracks data rights, attribution requirements, and retention policies for each data source
contributing to a place. Required for compliance and licensing audits.

### place_provider_links

Domain: Audit | Owner: Platform / Compliance | Classification: Audit | Lifecycle: Core | Source of Truth: Yes

External provider ID mappings and provider-suggested name/address variants.
Distinct from `place_aliases` (search text aliases) — this table tracks provider identity.

---

## Governance Domain

### place_owners

Domain: Core | Owner: Discovery | Classification: Entity | Lifecycle: Core | Source of Truth: Yes

Canonical current ownership state. Many-to-many (place ↔ user) with role-based access.
At most one approved `owner` per place (enforced by partial unique index).
History of changes lives in `place_ownership_events` (Audit domain).

---

## Analytics Domain

### analytics_events

Domain: Analytics | Owner: Growth | Classification: Derived | Lifecycle: Derived | Source of Truth: No

Client-side event log. Raw signals; do not query directly for product metrics.
**Rebuild:** Events are immutable once written; table itself is not rebuildable.

---

## Search Domain (additional tables)

### cuisine_aliases

Domain: Search | Owner: Search / Discovery | Classification: Reference | Lifecycle: Core | Source of Truth: Yes

Alias mapping for cuisine types used in search faceting (e.g. "japanese" → "Japanese"). Populated by taxonomy migration.

---

### search_synonyms

Domain: Search | Owner: Search / Discovery | Classification: Reference | Lifecycle: Core | Source of Truth: Yes

Term-to-canonical synonym table for cuisine, occasion, and dietary search terms. Powers query expansion. `enabled` flag allows soft-disabling without deletion.
**Rebuild:** Re-run seed migration `20260601000003`.

---

### place_popularity_cache

Domain: Search | Owner: Search / Discovery | Classification: Derived | Lifecycle: Derived | Source of Truth: No

Materialised popularity signals per place: post count, 30-day interactions, avg food rating. Refreshed by scheduled Edge Function.
**Rebuild:** Truncate and re-run the popularity backfill Edge Function.

---

## Social Domain (additional tables)

### user_topic_follows

Domain: Social | Owner: Social / Follows | Classification: User data | Lifecycle: Core | Source of Truth: Yes

User-declared topic interest signals (cuisine types, occasions). Used for personalised feed ranking. Source: onboarding, profile settings, search.

---

### message_reactions

Domain: Social | Owner: Messaging | Classification: User data | Lifecycle: Core | Source of Truth: Yes

Per-message emoji reactions. One reaction per user per message (unique constraint). Cascade-deletes with message.

---

### message_deliveries

Domain: Social | Owner: Messaging | Classification: Derived | Lifecycle: Core | Source of Truth: No

Per-message delivery and read receipts. Upserted by recipient on delivery/read events. Composite PK (message_id, user_id).

---

### conversation_pinned_messages

Domain: Social | Owner: Messaging | Classification: User data | Lifecycle: Core | Source of Truth: Yes

Multiple pinned messages per conversation. Unique constraint on (conversation_id, message_id). `pinned_by` uses SET NULL on user deletion to preserve history.

---

## Audit Domain (additional tables)

### data_repair_events

Domain: Audit | Owner: Platform / Compliance | Classification: Audit | Lifecycle: Core | Source of Truth: Yes

Tracks manual and automated data corrections across entity types. `restaurant_id` FK references legacy `restaurants` table (pre-rename) — preserved to maintain history. Append-only; status transitions via controlled update only.

---

> No undocumented tables. Completeness enforced by `check:schema-completeness`. Every migration introducing `CREATE TABLE` must add a domain file entry, a DATA_DICTIONARY section, and rebuild `schema-index.json` in the same PR.
