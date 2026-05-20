# Local Discovery

Local discovery owns how Rekkus helps people decide what to eat nearby without becoming a generic map or restaurant directory.

## Scope

- Dish-first and save-first nearby discovery.
- Current Places, Search, restaurant detail, saved places, and future collection surfaces.
- Local relevance, density, freshness, and first-party contribution signals.

Out of scope: generic venue browsing, paid restaurant placement, influencer ranking, and map completeness as a goal by itself.

## Current Surfaces

| Surface            | Current Role                                                                      | Owner                        |
| ------------------ | --------------------------------------------------------------------------------- | ---------------------------- |
| Search             | Query-driven place and post discovery with local-first lookup and Google fallback | [SEARCH.md](SEARCH.md)       |
| Places tab         | Nearby restaurant exploration and map/list browsing                               | [FEATURES.md](FEATURES.md)   |
| Restaurant detail  | Restaurant context, saved state, posts, and provider-enriched details             | [DISCOVERY.md](DISCOVERY.md) |
| Saved places/posts | Repeat-use intent and taste graph inputs                                          | [RETENTION.md](RETENTION.md) |

## Discovery Rules

- Prioritize food intent over venue completeness.
- Prefer Rekkus-owned posts, saves, dish tags, food ratings, and observations before provider popularity.
- Keep Google Places as fallback and enrichment, not canonical ranking truth.
- Avoid ranking systems that reward follower count, generic likes, or vague content over useful dish/place signals.
- Show weak-network, low-density, and empty states clearly instead of pretending the graph is complete.
- Around-me discovery must be opt-in, radius-bound, and based on current/manual session location rather than stored precise location history.

## Signal Priority

| Signal                            | Purpose                              | Notes                                                                          |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| Dish tags and best dish           | Answers "what should I order?"       | Highest product leverage once density exists.                                  |
| Saves                             | Strong food intent                   | More important than likes.                                                     |
| Post/review quality               | Utility and trust                    | See [QUALITY.md](QUALITY.md).                                                  |
| Local proximity                   | Makes choices actionable             | Do not let proximity bury clearly better nearby intent.                        |
| Recent clicks/views               | Lightweight freshness                | Privacy-safe analytics only.                                                   |
| Saved-place personalization       | Uses intent the user already created | Keep bounded so search remains explainable.                                    |
| Open/closed and time-of-day hints | Helps decide now                     | Provider-derived open state is cached context, not canonical restaurant truth. |
| Provider metadata                 | Fallback context                     | Must respect provider cache and attribution rules.                             |

## Operating Boundaries

- New local-discovery behavior must update [DISCOVERY.md](DISCOVERY.md), [SEARCH.md](SEARCH.md), or this doc.
- New ranking signals must update [docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md) and [DISCOVERY_FAIRNESS.md](DISCOVERY_FAIRNESS.md).
- Dark maps should keep local context readable with colour. Rekkus uses a dark base with blue water, green parks, warm roads, readable labels, and contrast-safe markers rather than flattening maps into grayscale.
- New provider usage must update [docs/architecture/CACHE_GOVERNANCE.md](../docs/architecture/CACHE_GOVERNANCE.md) and [docs/security/COMPLIANCE.md](../docs/security/COMPLIANCE.md).
