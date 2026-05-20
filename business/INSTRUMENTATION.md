# Revenue And Moat Instrumentation

Owner: Business / product

Instrumentation should connect monetization and moat strategy to product utility without pulling Rekkus away from dish-first discovery.

## Principles

- Measure saved food intent before revenue optimization.
- Treat dish graph, taste graph, saves, collections, and local density as moat signals.
- Defer revenue instrumentation that encourages generic directory behavior or opaque paid ranking.
- Keep paid placement transparent and compatible with discovery fairness.

## Signal Map

| Strategy Area | Useful Signals | Owner Doc |
| --- | --- | --- |
| Dish graph | Tagged dishes, best dish mentions, dish saves, dish search demand | [../product/TASTE_GRAPH.md](../product/TASTE_GRAPH.md) |
| Taste graph | Saves, likes, follows, cuisine affinity, reviewer trust | [../product/TASTE_GRAPH.md](../product/TASTE_GRAPH.md) |
| Local density | Posts, restaurants, searches, saves by suburb/city | [../product/DISCOVERY.md](../product/DISCOVERY.md) |
| Retention | Revisits, saved-place prompts, collection usage, notifications | [../product/RETENTION.md](../product/RETENTION.md) |
| Restaurant value | Claimed profile interest, menu/dish demand, analytics views | [MONETIZATION.md](MONETIZATION.md) |

## Revenue Instrumentation

Revenue metrics should measure whether monetization helps restaurants and diners without degrading dish-first discovery.

| Metric | Before Runtime Exists | Runtime Signal Later |
| --- | --- | --- |
| Subscription conversion | Define target restaurant segment and value proposition. | Trial started, plan selected, subscription activated. |
| Restaurant conversion | Track claimed-profile interest and restaurant analytics demand. | Claim started, claim approved, paid feature enabled. |
| Retention by revenue cohort | Keep cohort definitions in analytics docs before using them in ranking. | Restaurant retained, diner retained, cohort activity. |
| Churn | Define exit reasons and support owner. | Subscription cancelled, downgrade, failed renewal. |
| Paid feature adoption | Name paid feature and fairness impact before launch. | Feature viewed, enabled, used, disabled. |

## Guardrails

- Analytics events must stay privacy-safe and documented in [../docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md).
- Revenue metrics should not outrank trust, quality, or discovery fairness.
- Add backlog work before building dashboards or monetization flows.
