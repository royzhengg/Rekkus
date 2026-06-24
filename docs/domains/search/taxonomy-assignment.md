# Taxonomy Assignment

Canonical reference for the taxonomy assignment pipeline (B-625). See also [ADR-0031](../../adr/ADR-0031-taxonomy-assignment-pipeline.md).

## Architecture

```text
taxonomy_suggestions       ← all incoming signals land here (user, AI, OSM, admin)
        │
        ▼
  promote / reject         ← admin RPC or future consensus engine (B-626)
        │
        ▼
place_taxonomies           ← authoritative assignments (truth table)
        │
        ▼
place_taxonomies_accepted  ← view consumed by ALL search functions
```

`place_taxonomies` never holds pending or rejected state. Moderation state lives entirely in `taxonomy_suggestions`.

## Assignment Sources

| Source | RPC / mechanism | Default confidence | Review path |
| ------ | --------------- | ------------------ | ----------- |
| OSM sync | `sync_place_taxonomies_fn` trigger | 0.75 | Auto-accepted (≥ 0.50) |
| Admin direct | `assign_taxonomy_admin` | 0.90 | Auto-accepted (explicit) |
| AI classifier | `submit_taxonomy_suggestion` (service role) | caller-supplied | Queued if < 0.50 |
| User community | `submit_taxonomy_suggestion` (authenticated) | 0.40 | Always queued for review |

## Source Authority Hierarchy

`admin > osm > ai > user`

Enforced by `taxonomy_immutability_fn` BEFORE UPDATE trigger on `place_taxonomies`. See [ADR-0031 Invariants](../../adr/ADR-0031-taxonomy-assignment-pipeline.md#invariants).

## Acceptance Gate

`place_taxonomies_accepted` view:

```sql
WHERE confidence_score >= 0.50 AND removed_at IS NULL
```

- Confidence is used for acceptance gating only — **never for search ranking**.
- Moderator promotion floors confidence to 0.50 (`GREATEST(suggestion_confidence, 0.50)`) because human approval is itself evidence of correctness.
- All accepted tags score equally in search regardless of source.

## Moderation Workflow

1. User or AI submits a suggestion → `taxonomy_suggestions.status = 'pending'`
2. Admin reviews via `get_taxonomy_review_queue()` (ordered: high confidence first, oldest breaks ties)
3. Admin promotes → `promote_taxonomy_suggestion()` → row upserted into `place_taxonomies`
4. Admin rejects → `reject_taxonomy_suggestion()` → suggestion marked `rejected`
5. Suggestion history is immutable after step 3 — removing an assignment later does not change `suggestions.status`

## Removal

Use `remove_taxonomy_assignment()` (admin only). This sets `removed_at = now()` — **hard-delete is forbidden**. The historical assignment row is preserved for AI retraining, abuse investigation, and audit trails.

When the same (place, node) pair is re-assigned after removal (e.g., via a new suggestion promotion or OSM re-sync), `removed_at` is cleared and an `assignment_restored` audit event is emitted.

## Duplicate Prevention

- One pending user suggestion per (place, node) per user — partial unique index enforced at DB layer.
- One pending AI suggestion per (place, node, classifier_name, classifier_version) — prevents re-running a batch from producing duplicates.

## Audit Trail

Every lifecycle event writes an append-only row to `taxonomy_assignment_events`. The table is RLS-locked (`FOR ALL USING (false)`) — readable only via service role.

Actor attribution rules (applied consistently in all RPCs):
- User or admin action → `actor_id = auth.uid()`
- AI classification or OSM sync → `actor_id = NULL`

## Queue Metrics

- `taxonomy_review_queue_stats` — pending count and oldest pending age in hours.
- `taxonomy_review_performance` — avg review time by source and outcome (for completed reviews only, where `reviewed_at IS NOT NULL`).

## Out of Scope (B-626+)

- Consensus engine (weighted vote across competing suggestions)
- Confidence calibration (raw vs calibrated)
- AI classifier quality metrics dashboard
- Auto-promotion without human review
- `classify-taxonomy` Edge Function (AI provider not yet selected)

## What AI Agents Must Not Do

- Query `taxonomy_suggestions` or `place_taxonomies` directly from search code
- Write to `place_taxonomies` directly — use the RPCs
- Hard-delete assignment rows
- Modify `taxonomy_suggestions.status` after promotion
- Use `confidence_score` as a ranking signal
