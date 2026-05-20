# Dashboards

Dashboards own the minimum operational views needed before beta and scale.

## Dashboard Set

| Dashboard | Purpose | Inputs |
| --- | --- | --- |
| Product health | Saves, reviews, dish-tag coverage, search success | App tables and analytics events |
| Discovery quality | Top searches, result clicks, zero-result searches, provider fallback use | Search and provider events |
| Retention | Saved content returns, alerts activity, revisit prompts | Saves, alerts, notification events |
| Trust and safety | Reports, blocks, moderation states, abuse spikes, message reports, CSAM detections, spam rate-limit triggers, message block rate | `content_reports`, `moderation_actions`, `user_blocks`, `user_trust_profiles`, messaging events |
| Cost and providers | Google fallback, cache hits/misses, provider failures | Provider events and dashboards |
| Admin operations | Support, moderation, restaurant repair, feature flags, and release-control health | [../../operations/ADMIN_PLATFORM.md](../../operations/ADMIN_PLATFORM.md), `npm run ops:summary` |
| Messaging health | Message send volume (daily/weekly), media message share (% of sends), group chat creation rate, message request acceptance rate, avg messages per active conversation, unread-to-read conversion rate | `message_sent`, `group_created`, `message_request_accepted` events; `message_deliveries` table |

## Rules

- Start with simple queryable dashboards before adding BI complexity.
- Keep raw private data out of dashboards.
- Any dashboard that informs release gates must be linked from [../../operations/RELEASE.md](../../operations/RELEASE.md).
- Cost dashboards must align with [../../operations/COSTS.md](../../operations/COSTS.md).
