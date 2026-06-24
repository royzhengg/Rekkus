# ADR-0031: Taxonomy Assignment Pipeline

Status: Accepted
Date: 2026-06-24
Owner: Search Domain

## Context

B-609 shipped the full taxonomy node set (cuisine, food_category, venue_type, dietary). Places acquire those tags through four distinct sourcing pathways: OSM field mapping (automated), AI classification (batch), admin manual tagging, and user community tagging. Each pathway has different reliability characteristics that must be reflected in how tags are accepted and surfaced in search.

The BACKLOG item asked for `confidence_score` and `assigned_by` columns on `place_taxonomies`. The core design question was whether to add these directly to `place_taxonomies` or to introduce a formal suggestions/assignments split. Without the split, multiple competing signals for the same (place, node) pair overwrite each other and history is lost. A single-table design also makes it impossible to surface unreviewed suggestions to moderators without polluting the authoritative assignment table with pending state.

## Decision

Introduce a **suggestions / assignments split**:

- `taxonomy_suggestions` — intake table for all incoming signals from any source. All pending, promoted, and rejected suggestion history lives here. Never read by search code.
- `place_taxonomies` — authoritative assignment table. Contains only promoted/accepted rows. All search queries read from `place_taxonomies_accepted` (a view over this table). Never written directly by application code.

## Source Authority Hierarchy

**admin > osm > ai > user**

- Admin assignments are never overwritten by any other source.
- OSM assignments overwrite ai and user assignments (OSM is structured reference data).
- AI assignments may overwrite previous AI assignments only if new `confidence_score` is strictly higher.
- User suggestions never overwrite any existing assignment; they always go through moderation.

This hierarchy is enforced via a `BEFORE UPDATE` trigger (`taxonomy_immutability_fn`) on `place_taxonomies`.

## Acceptance Gate

`place_taxonomies_accepted` is a view:

```sql
WHERE confidence_score >= 0.50 AND removed_at IS NULL
```

Confidence gates acceptance only — it is never used as a search ranking signal. Once accepted, all tags score equally in search regardless of source.

When a moderator promotes a suggestion, `confidence_score` is floored to 0.50 (`GREATEST(suggestion.confidence_score, 0.50)`). This is intentional: **moderator approval is itself evidence of correctness**. A human reviewing and approving a low-confidence AI suggestion raises the tag to the acceptance threshold. Do not revert this behaviour thinking it is a bug.

## Invariants

These must not be violated by any future migration or application code:

1. `taxonomy_suggestions` is the only intake table for all external signals.
2. `place_taxonomies` contains authoritative truth only — no pending or rejected state.
3. Search code must never query `taxonomy_suggestions` or `place_taxonomies` directly.
4. Search code must only query `place_taxonomies_accepted`.
5. Admin assignments cannot be overwritten by non-admin sources.
6. User suggestions never write directly to `place_taxonomies`.
7. Every promotion, rejection, and removal generates an audit event in `taxonomy_assignment_events`.
8. Application code must never INSERT/UPDATE `place_taxonomies` directly — all writes must go through `promote_taxonomy_suggestion`, `assign_taxonomy_admin`, or the OSM sync trigger.
9. Assignment removal is always a soft-delete (`removed_at`) — hard-delete is forbidden.
10. Removing an assignment must not mutate suggestion history — `taxonomy_suggestions.status` reflects the moderation decision at promotion time and is immutable after that.

## Forbidden Operations

- Do not write directly to `place_taxonomies` from application code.
- Do not hard-delete assignment rows — use `remove_taxonomy_assignment`.
- Do not mutate `taxonomy_suggestions.status` after promotion.
- Do not query `taxonomy_suggestions` or `place_taxonomies` from search functions.
- Do not use `confidence_score` as a search ranking signal.

## Common Mistakes (for AI agents)

❌ Querying `taxonomy_suggestions` from search code
❌ Inserting directly into `place_taxonomies`
❌ Hard-deleting assignment rows
❌ Modifying suggestion `status` after promotion
❌ Using `confidence_score` for ranking

✅ Use `place_taxonomies_accepted` for all search reads
✅ Use RPCs (`promote_taxonomy_suggestion`, `assign_taxonomy_admin`) for writes
✅ Use `taxonomy_assignment_events` for audit history

## Confidence Values by Source

| Source | Default confidence | Review status | Auto-accepted? |
| ------ | ------------------ | ------------- | -------------- |
| OSM sync | 0.75 | n/a (direct) | Yes |
| Admin direct | ≥ 0.90 | n/a (direct) | Yes |
| AI classifier | caller-supplied | pending | If ≥ 0.50 after promotion |
| User suggestion | 0.40 | pending | No — queues for review |

## OSM Sync Exception

OSM hard-deletes its own rows when cuisine_slug changes remove a node from a place's set. This is an explicit exception to the soft-delete rule. OSM sync manages reference data (structured field mappings), not human or AI curation. Preserving historical OSM state does not provide useful signal for AI retraining or abuse investigation. The hard-delete is documented in the migration with a comment explaining the rationale.

## Duplicate Prevention

Partial unique indexes prevent duplicate pending suggestions:
- One pending suggestion per user per (place, node)
- One pending suggestion per AI classifier version per (place, node)

These prevent UI button spam from users and protect against re-running a classifier batch.

## Resurrection Behaviour

When a soft-deleted assignment is re-promoted (via `promote_taxonomy_suggestion`) or re-assigned (via OSM sync or `assign_taxonomy_admin`), the `removed_at` and `removed_by` fields are cleared. An `assignment_restored` audit event is emitted. This keeps the lifecycle unambiguous.

## Alternatives Considered

- **Single-table with status column**: Add `status`, `confidence_score`, `assigned_by` columns directly to `place_taxonomies`. Rejected: search queries would need to filter by status constantly; pending state pollutes the authority table; history of rejected suggestions is lost on status transitions.
- **Separate accepted boolean column**: Add `accepted boolean` to `place_taxonomies` and control acceptance via that flag. Rejected: redundant with confidence-based acceptance gate; adds another boolean to keep consistent.
- **Event-sourced projection**: Store all taxonomy events in an append-only log and derive `place_taxonomies` as a materialized projection. Rejected as over-engineered for current scale; deferred to the platform phase when place counts exceed ~500k.

## Out of Scope for B-625 (deferred to B-626+)

- Consensus engine: weighted vote across competing suggestions for the same (place, node)
- Confidence calibration: raw vs calibrated confidence columns
- AI quality scoring and classifier evaluation dashboard
- Auto-promotion without human review
- Knowledge graph expansion (occasion, vibe, audience taxonomy dimensions)
- Taxonomy candidate discovery from unmapped values in `taxonomy_unmapped`
- `classify-taxonomy` Edge Function: deferred until an AI provider is selected

## Rollback or Revisit Trigger

Revisit if:
- Place volume exceeds ~500k and the `place_taxonomies_accepted` view becomes a query bottleneck — at that point, materialize it as a materialized view with a refresh trigger.
- Moderator review volume exceeds ~1000 pending suggestions/day — at that point, implement the B-626 consensus engine to auto-promote high-confidence multi-source agreements.
- A jurisdiction requires taxonomy data to be purged on account deletion — add a `deleted_at` cascade from `users` to `taxonomy_suggestions.assigned_by_user_id`.
