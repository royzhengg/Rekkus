# Data Strategy

Canonical decisions for how Rekkus acquires, stores, and trusts place data.

## Source hierarchy

| Rank | Source | Trust | Notes |
|------|--------|-------|-------|
| 1 | Owner-submitted | Highest | Owner claimed + verified |
| 2 | Community-verified | High | ≥3 unique users, ≥7 days apart |
| 3 | Google enrichment | Medium | User-tap-triggered only — never bulk |
| 4 | OSM import | Seed | Freely overwritable by any higher source |

OSM is the seed. Rekkus community is truth over time.

## Identity model

Five canonical identities everything else references:

```
place_id   — survives provider changes, merges, renames
user_id    — never recycled
dish_id    — scoped to a place
post_id    — immutable after publish
collection_id
```

Provider IDs (`osm_id`, `google_place_id`) are cross-reference columns — not primary keys.

## `verification_level` (single confidence source)

Never store a raw `data_confidence_score`. Derive it at query time:

```sql
case verification_level
  when 'user_created'       then 0.20
  when 'osm_only'           then 0.30
  when 'osm_google'         then 0.55
  when 'community_verified' then 0.75
  when 'owner_verified'     then 1.00
end
```

This eliminates confidence/level drift. `verification_level` is the single source of truth.

## Verification-boosted search ranking

```sql
ORDER BY
  ts_rank(search_tsv, query) *
  (1 + case verification_level
         when 'user_created'       then 0.20
         when 'osm_only'           then 0.30
         when 'osm_google'         then 0.55
         when 'community_verified' then 0.75
         when 'owner_verified'     then 1.00
       end * 0.2) DESC
```

Effect: a perfect-match `osm_only` place (1.0 × 1.06 = 1.06) outranks a weak-match `owner_verified` place (0.7 × 1.20 = 0.84). Relevance wins; verification breaks ties within the same band.

## OSM update rules

Future delta refresh runs MUST read `verification_level` before writing:

| Level | OSM may overwrite? |
|-------|--------------------|
| `osm_only` | Yes |
| `osm_google` | Yes (OSM fields only) |
| `community_verified` | **No** — log delta only |
| `owner_verified` | **No** — log delta only |

## Photo source priority

`primary_photo_source` column on `places`:
- Default: `rekkus_post`
- Promoted to `rekkus_post` automatically when ≥3 user post photos exist for the place
- Google photos fetched only when `primary_photo_source != 'rekkus_post'`
- Never fetch Google photos in bulk — only on user-tap enrichment events

## Opening hours source priority

`is_current = true` rows per source. Priority when displaying:

```
owner > community > google > osm
```

Numeric confidence is secondary — source rank always wins.

## JSONB rule

`raw_osm_tags`, `alt_names`, `payload` are archive fields. They MUST NOT appear in WHERE or ORDER BY clauses of production search queries. Extract values into typed columns at import time.

## Event-source principle

`posts`, `saves`, `collections`, `visits` are truth. `place_stats` is a derived cache. If stats drift, rebuild from events. Never treat a denormalised counter as authoritative.

## Cascade delete policy

- Core entities (`places`, `posts`, `collections`): soft delete via `deleted_at`
- Child aggregation rows (`place_stats`, `place_traits`, `place_aliases`, `place_features`, `place_contact`, `place_opening_hours`): `ON DELETE CASCADE` (can be rebuilt)
- `place_merge_log.old_place_id`: intentionally NOT a FK — the merged place is soft-deleted

## `cuisine_type` vs `cuisine_slug`

- `cuisine_type`: immutable raw provider value (e.g. `"ramen;japanese"`). Never overwritten once set.
- `cuisine_slug`: derived search value (e.g. `"japanese"`). Recomputable from `cuisine_type`. Used in search grouping and filtering only.

## Google exit criteria

Stop fetching Google data per signal when Rekkus coverage exceeds:

| Signal | Exit threshold |
|--------|---------------|
| Photos | ≥3 user post photos per place |
| Phone | Community-verified phone on ≥70% of active places |
| Website | Owner-verified website on ≥50% of active places |
| Hours | Owner hours on ≥60% of active places |

Monitor via `search_analytics` zero-result queries and `place_stats` fill rates.

## Attribution

OSM data: "© OpenStreetMap contributors" (ODbL licence). Display in map and address contexts. See `docs/security/COMPLIANCE.md`.

## Near-term priorities

1. **`place_search_index` materialised table** — eliminates 7+ joins per search query. Refresh async on place/stats update. Columns: `place_id`, `search_name` (generated: `lower(unaccent(name))`), `search_tsv`, `cuisine_slug`, `verification_score`, `lat`, `lng`.
2. **Community verification triggers** — auto-promote to `community_verified` at threshold.
3. **Search analytics dashboard** — what queries return 0 results? Feeds cuisine taxonomy and venue expansion decisions.
