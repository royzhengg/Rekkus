# Naming Governance

Owner: Engineering

Naming conventions keep routes, tables, events, files, and domain types predictable as the graph grows.

## Rules

| Area | Convention | Example |
| --- | --- | --- |
| Database tables and columns | `snake_case`, plural table names | `saved_locations`, `restaurant_id` |
| Supabase migrations | `YYYYMMDDHHMMSS_snake_case.sql` | `20240202000000_search_query_expansion.sql` |
| Analytics events | `lower_snake_case` event names | `post_view`, `place_click` |
| Analytics entity types | singular `lower_snake_case` | `post`, `restaurant`, `user` |
| TypeScript components | `PascalCase` | `RestaurantDetailScreen` |
| Hooks | `useCamelCase` | `useSavedPosts` |
| Services and utils | `camelCase` file names when exporting functions | `googlePlaces.ts`, `format.ts` |
| Routes | plural domain nouns for canonical paths | `/posts/[postId]`, `/restaurants/[restaurantId]` |
| Legacy routes | redirect wrappers only | `/post/[id]`, `/location/[placeId]` |

## Product Language

- Use `Places` in navigation when the user is browsing restaurants.
- Use `restaurant` in code when the entity is the canonical database object.
- Use `post` for a review/content unit and `dish` only for dish-level tags, names, or graph work.
- Do not introduce generic review-platform terms that blur the dish-first direction.

## Guardrails

- `docs/architecture/ARCHITECTURE.md` owns canonical route names.
- `docs/analytics/ANALYTICS.md` owns event taxonomy.
- `scripts/check-hygiene.js` blocks stale duplicate route files and direct mock imports.
- `scripts/ops/check-operations.js` verifies this naming contract stays linked and present.
