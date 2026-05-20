# Social Proof

Social proof owns how Rekkus shows trusted food evidence without drifting into popularity contests or generic review-platform mechanics.

## Scope

- Friends who have been to a restaurant or saved/reviewed a dish.
- Taste compatibility between followed reviewers and the current user.
- Contributor reputation signals that help users identify useful local food evidence.

Out of scope: follower-count ranking, influencer badges, vanity leaderboards, and broad social proof when the graph is too sparse to be honest.

## Planned Signals

| Signal | Owner | First Useful Step | Guardrail |
| --- | --- | --- | --- |
| Friends who've been here | Taste graph + saved-location graph | Count followed users with `been_here` saves or posts for a restaurant. | Show only aggregate labels until privacy rules for named disclosure are explicit. |
| Follower/following taste scores | Taste graph | Compare overlap in saves, cuisines, dish tags, and high food ratings. | Keep scores explainable; never imply private activity. |
| Taste compatibility labels | Taste graph + profile surfaces | Use coarse labels such as "similar spicy picks" or "often saves ramen" after enough shared signals exist. | Hide when confidence is low. |
| Contributor reputation | Contribution systems | Weight dish specificity, helpful saves, moderation history, and freshness. | Reward usefulness, not follower count. |

## Rollout

1. Use aggregate, deterministic labels only.
2. Add analytics for impressions and follow/save conversion before ranking impact.
3. Keep every social-proof surface removable by feature flag or local component rollback.
4. Update [TASTE_GRAPH.md](TASTE_GRAPH.md), [DISCOVERY_FAIRNESS.md](DISCOVERY_FAIRNESS.md), and [../docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md) when a signal begins affecting ranking or notification behavior.

