# Schema Architecture

Single-page reference for contributors and AI agents working on the Rekkus database schema.

## Why split schema

`supabase/schema.sql` is generated — never edited by hand. The authoritative source is the domain files in `supabase/schema/<domain>/`. Splitting by domain enables:

- **Targeted review:** PRs only touch files relevant to the change.
- **AI edit routing:** `docs/database/schema-index.json` maps every table to its owning file in O(1) — no SQL parsing required.
- **Build determinism:** `check:build-determinism` catches non-deterministic ordering.
- **Completeness enforcement:** `check:schema-completeness` fails when DB and manifest diverge.

## Directory ownership map

| Domain dir | Owner | Tables |
|---|---|---|
| `core/users/` | Platform | users, user_stats |
| `core/places/` | Places | places, place_contact, place_features, place_hours, place_sources, place_aliases, place_traits, place_stats, place_provider_metadata, place_owners |
| `core/dishes/` | Places | dishes |
| `core/posts/` | Content | posts, post_photos, post_hashtags, post_reactions, post_edits, comments |
| `social/` | Social | follows, user_topic_follows, collections, interactions, conversations, conversation_participants, messages, message_reactions, message_deliveries, conversation_pinned_messages |
| `search/` | Search / Discovery | cuisine_aliases, search_synonyms, place_popularity_cache, search_index, search_events, saved_searches, suburb_data, trending |
| `analytics/` | Growth | analytics_events |
| `provider/` | Platform | provider cache, imports, observations, merges |
| `moderation/` | Trust & Safety | moderation tables |
| `audit/` | Platform / Compliance | auth_audit_events, content_lifecycle_events, dish_audit_events, user_profile_audit_events, collection_audit_events, feature_flag_audit_events, data_repair_events, place_ownership_events |
| `governance/` | Platform | governance tables |

Machine-readable version: [`docs/database/schema-index.json`](schema-index.json) — use the `owners` map for instant table → file lookup.

## How to add a table

1. Find the right domain file using `schema-index.json` `domains` map, or create a new file in the correct subdirectory.
2. Add the `CREATE TABLE` + indexes to the domain file.
3. Update (or add) the ownership header `-- Owned tables:` line — must be a **single line**, comma-separated.
4. If it's a new file, add an `emit "domain/file.sql"` line in `scripts/build-schema.sh` in load order.
5. Run: `./scripts/build-schema.sh > supabase/schema.sql` — this also regenerates `schema-index.json`.
6. Generate the migration: `supabase db diff --use-migra -f <name>`, review, apply locally.
7. Add a DATA_DICTIONARY entry in `supabase/schema/DATA_DICTIONARY.md`.
8. Run `npm run check:schema` — all four sub-checks must pass.

## How to modify a table

1. Edit the domain file (locate via `schema-index.json` if unsure).
2. Write and apply the migration (`ALTER TABLE …`).
3. Rebuild: `./scripts/build-schema.sh > supabase/schema.sql`
4. Run `npm run check:schema` and `npm run check:supabase-types`.

## Ownership header format

Every domain file must have this header (machine-read by `generate-schema-index.js`):

```sql
-- ============================================================================
-- Domain:       Search
-- Owner:        Search / Discovery
-- Canonical:    Yes
-- Lifecycle:    Core
-- Owned tables: table_a, table_b, table_c
-- Dependencies: core/users/users.sql
-- Included by:  scripts/build-schema.sh
-- ============================================================================
```

**Critical:** `Owned tables:` must be a single line. The parser reads exactly one line per key.

`Canonical: No` marks derived/cache tables that can be truncated and rebuilt.

## Common mistakes

| ❌ Wrong | ✅ Right |
|---|---|
| Edit `supabase/schema.sql` directly | Edit the domain file, then rebuild |
| Write a migration with `CREATE TABLE` but no domain file update | Domain file + rebuild manifest in same PR |
| Add a new domain file but forget `emit` in `build-schema.sh` | `check:schema-completeness` catches this |
| Put `-- Owned tables:` on multiple lines | Single line, comma-separated |
| Skip adding FK index | `check:fk-indexes` catches it, outputs `CREATE INDEX … IF NOT EXISTS` fix |
| Two indexes with identical leading column set | `check:fk-indexes` fails on duplicates |
| Add migration, forget to rebuild `schema-index.json` | `check:schema-completeness` freshness check fails |

## PR review checklist

- [ ] Domain file modified (not `schema.sql`)
- [ ] Migration exists for every DDL change
- [ ] `emit()` added to `build-schema.sh` for any new file
- [ ] Ownership header `Owned tables:` updated (single line)
- [ ] `./scripts/build-schema.sh > supabase/schema.sql` run and committed
- [ ] `docs/database/schema-index.json` regenerated (happens automatically from build)
- [ ] DATA_DICTIONARY entry added for new tables
- [ ] `npm run check:schema` passes
- [ ] `npm run check:supabase-types` passes

## Troubleshooting

| Failing check | Cause | Fix |
|---|---|---|
| `check:schema-drift` | `schema.sql` differs from domain files | Rebuild: `./scripts/build-schema.sh > supabase/schema.sql` |
| `check:schema-completeness` (stale) | `schema-index.json` not rebuilt after domain file edit | Same rebuild command |
| `check:schema-completeness` (table in DB not in manifest) | Migration applied without domain file update | Add table to domain file, rebuild |
| `check:schema-completeness` (table in manifest not in DB) | Domain file added but migration not applied | `supabase migration up --include-all` |
| `check:build-determinism` | `build-schema.sh` output differs between two runs | Check for unsorted `find`, `NOW()` calls, or env-dependent output in build script |
| `check:fk-indexes` (missing index) | FK column has no leading-column index | Use the `suggested_fix` output; or add to `check-fk-indexes.ignore.json` with reason |
| `check:fk-indexes` (duplicate index) | Two indexes share the same leading column | Drop the redundant one: `DROP INDEX CONCURRENTLY IF EXISTS …` |

## Lifecycle diagram

```
supabase/schema/<domain>/*.sql   (edit here)
        │
        ▼
scripts/build-schema.sh
        ├──► supabase/schema.sql          (generated; commit)
        └──► docs/database/schema-index.json  (generated; commit)
                        │
                        ▼
              supabase migration up
                        │
                        ▼
              Supabase DB (local + prod)
                        │
                        ▼
              supabase gen types typescript
                        │
                        ▼
              types/database.ts  →  app
```
