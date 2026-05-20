# KPIs

KPIs own the small set of metrics Rekkus should optimize before adding heavier analytics.

## North Star

High-quality saved food intent: people discovering, saving, revisiting, and reviewing places and dishes they genuinely want.

## Core Metrics

| KPI | Why It Matters | Source |
| --- | --- | --- |
| Save rate | Best lightweight intent signal | Saves, saved locations |
| Review creation rate | Content density growth | Posts |
| Dish-tag coverage | Dish graph maturity | Posts/dish tags |
| Search success | Discovery usefulness | Search events and result clicks |
| Revisit/return usage | Retention utility | Saved content and alerts |

## Social Coordination KPIs

| KPI | Target | Source |
| --- | --- | --- |
| Messages sent per DAU | >0.5 after 30 days of messaging release | `message_sent` events |
| Group chats created per week | Growing week-on-week | `group_created` events |
| Post/place shares via DM per week | Growing week-on-week (measures messaging-driven food discovery) | `post_shared_via_dm`, `place_shared_via_dm` events |
| Message request acceptance rate | >60% (measures quality of non-follower outreach) | `message_request_accepted` / total requests |

## Guardrails

- Do not optimize for raw likes, follower count, notification opens, or generic session length.
- Pair growth metrics with quality and trust checks.
- Keep KPI definitions stable across beta cycles unless a product decision changes.

## Related Docs

- [../../PRODUCT.md](../../PRODUCT.md)
- [../../product/RETENTION.md](../../product/RETENTION.md)
- [../../product/QUALITY.md](../../product/QUALITY.md)
- [ANALYTICS.md](ANALYTICS.md)

