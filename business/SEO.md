# SEO

Purpose: capture programmatic discovery and public web strategy.

## Current Direction

- Prioritize public restaurant, dish, cuisine, suburb, collection, and creator pages when content density supports them.
- Keep SEO pages useful and grounded in real Rekkus content.
- Avoid thin pages or duplicate content.

## Programmatic Page Roadmap

| Backlog | Page Type | First Useful Version | Guardrail |
| --- | --- | --- | --- |
| B-321 Local discovery pages | Local intent hubs | Suburb/cuisine/dish pages with real Rekkus posts and saves. | No city-wide directory pages without density. |
| B-322 SEO landing pages | Acquisition landing pages | One dish-first homepage and one local-discovery template. | Avoid generic review-platform copy. |
| B-323 Public restaurant pages | Restaurant pages | Canonical restaurant page with Rekkus posts, dishes, saves, and provider attribution. | Rekkus evidence must lead. |
| B-324 Public dish pages | Dish pages | Dish tag page by suburb/cuisine/restaurant context. | Do not make unsupported menu or availability claims. |
| B-325 Cuisine landing pages | Cuisine pages | Cuisine in a suburb with ranked dishes and saved places. | Thin pages stay noindex. |
| B-326 Suburb landing pages | Suburb pages | Local food intent summary with collections and posts. | No map-completeness goal. |
| B-327 Collection landing pages | Public collections | Shareable collection page using existing visibility/share slugs. | Respect private/unlisted visibility. |
| B-328 Trending pages | Trending local food | Time-windowed dish/place trends from first-party signals. | Explain freshness and avoid popularity traps. |
| B-329 Creator profile pages | Public creator pages | Useful reviewer profile with posts and taste summary. | No vanity-first ranking. |
| B-330 Public collections | Collection index/detail | Public/staff-pick collections with dish-first summaries. | Hide private saves and owner-only metadata. |
| B-331 Social sharing previews | Share cards/Open Graph | Dish, restaurant, collection, and profile preview metadata. | No private content in previews. |
| B-332 Next.js public frontend | Public web app | Separate public frontend only after route ownership and data contracts are clear. | Keep Expo app routes authoritative until ADR. |

## Dependencies

- Public pages require a canonical URL strategy, index/noindex rules, structured data review, and analytics that separates web acquisition from in-app discovery.
- A Next.js frontend is a durable architecture decision and needs an ADR before implementation.
