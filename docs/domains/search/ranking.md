# Search Ranking

## Governance

| Ranking concern | Owner |
| --- | --- |
| Search ranking | Server |
| Collection ranking | Server |
| Suggestion base ranking | Server |
| Suggestion recency/saved boosts | Client, bounded |
| Discovery module ordering | Product |
| Client ranking | Prohibited |

The client may render server-ordered results. It must not reorder search results or collections.

## Result Relevance Rules

- Explicit intent wins.
- Strong place-name exact matches override ambiguous food defaults.
- Strong collection-name exact matches override ambiguous food defaults.
- Occasion searches favor mixed discovery.
- Food-category searches may bias dishes.
- Creator-name searches favor people.
- Zero-query discovery remains balanced.
- Default suggestion priority is a tie-breaker only; strong exact matches may override it.

## Ranking Version

Search responses include:

```ts
rankingVersion: 'search_v1'
```

Use `rankingVersion` in analytics and debugging. Ranking changes that materially affect ordering should introduce or document a version change.

## Ranking Reasons

Search results may include:

```ts
rankingReasons?: SearchRankingReason[]
```

UI may surface at most one lightweight reason per result. Extra reasons are for analytics/debugging only.

Examples:

- Popular nearby
- Saved by many
- Trending this week
- Matches Japanese cuisine

## Collections

Collections are searchable only when:

- Visible
- Not deleted
- Not hidden
- Not moderated out
- Not low-trust
- Contains at least one visible valid item

Collection ordering is server-owned.
