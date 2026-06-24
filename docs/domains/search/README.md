# Search Domain

Search is a domain subsystem, not only a screen. Its operating model is:

```text
Craving -> Discovery -> Decision
```

Rekkus is food-first and discovery-first. Dishes, places, collections, posts, and people are first-class food discovery entities. Result relevance depends on intent, context, and server ranking.

## Owner Docs

- [capabilities.md](capabilities.md) — supported capabilities and non-goals
- [contracts.md](contracts.md) — shared TypeScript contracts and query flow
- [discovery.md](discovery.md) — zero-query and module behavior
- [ranking.md](ranking.md) — ranking ownership and result relevance rules
- [analytics.md](analytics.md) — events, health metrics, and privacy limits
- [invariants.md](invariants.md) — product, ownership, taxonomy, and data invariants
- [taxonomy-assignment.md](taxonomy-assignment.md) — accepted taxonomy assignment pipeline
- [decision-log.md](decision-log.md) — durable Search Domain decisions

## Ownership

| Concern | Owner |
| --- | --- |
| Filtering | Server |
| Ranking | Server |
| Collection ordering | Server |
| Suggestion base ranking | Server |
| Suggestion recency/saved boosts | Client, bounded |
| Discovery module ordering | Product |
| Persistence | Client |
| Analytics | Analytics layer |

## Feature Flags

Search flags must include owner, creation date, and review/removal date. Avoid names that imply Search may read `taxonomy_suggestions`.

| Flag | Purpose | Owner | Created | Review/remove |
| --- | --- | --- | --- | --- |
| `rekkusPicks` | Enables occasion/Rekkus Picks filter surfaces | Product/Search | 2026-06-25 | 2026-09-25 |
| `savedSearches` | Enables saved-search create/use surfaces | Product/Search | 2026-06-25 | 2026-09-25 |
| `collectionsInSearch` | Enables collection results and suggestions | Product/Search | 2026-06-25 | 2026-09-25 |
| `taxonomyAutocomplete` | Enables taxonomy-backed typeahead UX | Product/Search | 2026-06-25 | 2026-09-25 |
| `searchRankingV2` | Enables next ranking model rollout | Product/Search | 2026-06-25 | 2026-09-25 |

## Implementation Contracts

- Runtime contracts live in `lib/search/filterContracts.ts`.
- Shared literal options live in `lib/search/searchConstants.ts`.
- Executable ownership constants live in `lib/search/searchOwnership.ts`.
- Client state may persist filters, radius, sort, intent, and location source summary.
- Client state must not persist precise GPS, provider payloads, or transient active query text.
