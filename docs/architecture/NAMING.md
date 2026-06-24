# Naming Governance

Owner: Engineering

Naming conventions keep routes, tables, events, files, and domain types predictable as the graph grows.

## Rules

| Area | Convention | Example |
| --- | --- | --- |
| Database tables and columns | `snake_case`, plural table names | `saved_places`, `place_id` |
| Supabase migrations | `YYYYMMDDHHMMSS_snake_case.sql` | `20240202000000_search_query_expansion.sql` |
| Analytics events | `lower_snake_case` event names | `post_view`, `place_click` |
| Analytics entity types | singular `lower_snake_case` | `post`, `place`, `user` |
| TypeScript components | `PascalCase` | `PlaceDetailScreen` |
| Hooks | `useCamelCase` | `useSavedPosts` |
| Services and utils | `camelCase` file names when exporting functions | `googlePlaces.ts`, `format.ts` |
| Routes | plural domain nouns for canonical paths | `/posts/[postId]`, `/places/[placeId]` |
| Legacy routes | redirect wrappers only | `/post/[id]`, `/location/[placeId]` |

## Product Language

- Use `Places` in navigation and user-facing copy when referring to food establishments.
- Use `place` / `place_id` in code and schema when the entity is the canonical database object.
- Use `post` for a user-generated content unit and `dish` only for dish-level tags, names, or graph work.
- Use `save` / `saved` (not "bookmark") for the action of saving a place, dish, or post.
- Use `Collections` (not "Lists") for user-organised groups of saved content.
- Do not introduce generic review-platform terms that blur the food-first, discovery-first direction.

## Historical Infrastructure Exception

The following compliance, audit, and provenance tables retain their historical `restaurant_` prefix and must **not** be renamed. References to them in docs should note this exception:

- `restaurant_audit_events`
- `restaurant_sources`
- `restaurant_provider_cache`
- `restaurant_aliases`
- `restaurant_merge_events`
- `restaurant_observations`
- `restaurant_ownership_events`

These are immutable append-only audit tables. Renaming them would break audit trails, rollback references, and migration history.

## Guardrails

- `docs/architecture/ARCHITECTURE.md` owns canonical route names.
- `docs/analytics/ANALYTICS.md` owns event taxonomy.
- `scripts/check-hygiene.js` blocks stale duplicate route files and direct mock imports.
- `scripts/ops/check-operations.js` verifies this naming contract stays linked and present.
- Domain term definitions, eliminated synonyms, and infra exceptions: `docs/GLOSSARY.md`
