# ADR-0023: Schema-First Database Architecture

**Status:** Accepted
**Date:** 2026-06-24
**Authors:** Roy Zheng

---

## Context

The Rekkus database schema grew as a monolithic `supabase/schema.sql` file (~5,000 lines). By mid-2026 this file had become:

1. **Unmaintainable at review time** — no structure, every PR diff touching schema was a wall of SQL.
2. **Out of sync with migrations** — tables added via migrations (`place_search_index`, taxonomy tables, messaging extensions) were never backported to `schema.sql`, making it an unreliable source of truth.
3. **Naming-inconsistent** — the core entity was renamed from "restaurant" to "place" in product terminology but seven database tables still carried `restaurant_` prefixes.

An external architectural review confirmed these problems and recommended adopting a hybrid schema-first approach.

---

## Decision

**`supabase/schema/` is the source of truth. `supabase/schema.sql` is a generated artifact.**

### Rules

1. **Domain files are canonical.** Every table belongs to exactly one domain subdirectory under `supabase/schema/`. No root-level `.sql` files.

2. **`schema.sql` is generated, never manually edited.** Run `./scripts/build-schema.sh > supabase/schema.sql` to regenerate. It is committed so `git diff` shows readable diffs on every PR.

3. **Migrations are generated from schema diffs.** After editing domain files and regenerating `schema.sql`, run `supabase db diff --use-migra -f <name>` to produce a migration. Never hand-edit generated migrations (data migrations are the only exception).

4. **Load order is fixed.** The build script concatenates domains in this order:
   `extensions → enums → core → social → search → analytics → provider → moderation → audit → governance → functions → rls`
   Within a domain: tables → indexes → views → functions with colocated triggers → RLS.

5. **No global triggers file.** Triggers live in `functions/<domain>.sql` next to the functions they invoke.

6. **Schema drift is enforced in CI.** `npm run check:schema-drift` runs `./scripts/build-schema.sh | diff - supabase/schema.sql`. Fails if out of sync.

7. **Every table must have a DATA_DICTIONARY entry** at `supabase/schema/DATA_DICTIONARY.md` with domain, owner, classification, and lifecycle.

8. **No new root-level schema files.** `supabase/schema/new_feature.sql` is never allowed.

9. **Split domain subdirectories at ~200 lines.** `places` warrants `places/` from day one; create subdirectories proactively.

10. **Soft-delete all recoverable user-generated content** via `deleted_at`. Posts, comments, collections, dishes. Places use `place_status` + `deleted_at`.

### Domain Ownership

| Domain | Tables |
|---|---|
| `core/users/` | users, user_trust_profiles |
| `core/places/` | places, place_contact, place_features, place_hours, place_sources, place_aliases, place_traits, place_stats, place_provider_metadata, place_owners |
| `core/dishes/` | dishes, saved_dishes |
| `core/posts/` | posts, post_photos, post_hashtags, post_reactions, post_edits, comments |
| `social/` | follows, collections, collection_items, interactions, messaging |
| `search/` | taxonomy_nodes, taxonomy_aliases, place_search_index, search_events, saved_searches, suburb_data, trending_searches |
| `analytics/` | analytics_events, user_top_spots |
| `provider/` | place_provider_cache, osm_import_runs, place_observations, place_merge_events |
| `moderation/` | user_blocks, content_reports, moderation_actions, moderation_appeals |
| `audit/` | auth_audit_events, content_lifecycle_events, dish_audit_events, collection_audit_events, feature_flag_audit_events, place_audit_events, place_ownership_events, place_provenance, place_provider_links |
| `governance/` | feature_flag_overrides, privacy_requests |

### Naming convention

All tables use the canonical entity name. `place_*` not `restaurant_*`. The Phase 2 rename (migration 20260624000007) standardised all remaining `restaurant_*` tables.

---

## Consequences

**Positive:**
- Schema diffs in PRs are readable (domain files, not a 5,000-line monolith).
- CI catches drift before it reaches production.
- New tables have a defined home and documented owner from day one.
- `supabase db diff --use-migra` works reliably because `schema.sql` reflects actual desired state.

**Negative:**
- Requires discipline: every schema change must go through domain files → build → migrate (three steps instead of one).
- Existing drift (tables only in migrations) is documented in DATA_DICTIONARY.md but not yet backfilled into domain files. Future schema work should address this incrementally.

**Deferred:**
- PostgreSQL schema namespacing (`core.places` vs `public.places`) — high migration cost; deferred until genuinely needed.
- Consolidated `audit_events` — ADR-0011 chose domain-scoped tables; don't reverse without a new ADR.
- ERD generation on CI — see BACKLOG.

---

## Alternatives Considered

**Keep monolithic `schema.sql`:** Rejected. Already causing schema drift and unmaintainable review diffs.

**`schema.sql` as gitignored generated file:** Rejected. Committed schema.sql enables `git diff` to show readable schema diffs on every PR.

**PostgreSQL schema namespacing (`core.places`):** Deferred. High migration cost for an already-deployed Supabase app.
