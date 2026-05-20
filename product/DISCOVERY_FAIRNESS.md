# Discovery Fairness

Discovery fairness owns how ranking avoids popularity traps, stale results, and pay-to-win outcomes while Rekkus is still building density.

## Fairness Goals

- Surface genuinely useful food intent, not just globally popular restaurants.
- Give newer, smaller, and hidden-gem places a path to visibility when first-party signals support them.
- Keep ranking explainable enough for operators to debug.
- Avoid business pressure that undermines trust in organic discovery.

## Ranking Guardrails

| Risk                          | Guardrail                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider popularity dominates | Keep Google ratings/review volume as bounded boosts only.                                                                                                 |
| Rich-get-richer ranking       | Popularity boosts only apply after a text, expansion, or around-me base score exists; nearby high-quality low-volume places get a small exploration path. |
| Low-quality spam wins         | Use quality, trust, report, and moderation signals before broad amplification.                                                                            |
| Paid placement confusion      | Keep sponsored or owner content visually distinct when introduced.                                                                                        |
| Stale graph                   | Prefer recent high-quality signals over old generic activity.                                                                                             |

## Required Evidence For New Signals

Any new discovery or ranking signal must document:

- Source of truth.
- Privacy impact.
- Expected user benefit.
- Abuse risk.
- Rollback path.
- Analytics event or metric used for validation.

Update [docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md), [SEARCH.md](SEARCH.md), and [DISCOVERY.md](DISCOVERY.md) when a signal ships.

## Current Shipped Signals

| Signal                         | Source                                                            | Rollback                                                               |
| ------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Saved-place personalization    | `saved_locations` for the signed-in user                          | Remove the bounded boost in `useSearch`.                               |
| Around-me and radius filtering | Session GPS/manual coordinates plus `restaurants_in_bounding_box` | Disable around-me mode or ignore `radiusKm`.                           |
| Open/closed labels             | Cached `restaurants.open_now` from Google Place Details           | Stop selecting/displaying the field; ranking does not depend on it.    |
| Time-of-day hints              | Client clock and deterministic cuisine/name heuristics            | Remove row hint display.                                               |
| Explore vs popular balance     | Bounded boost weights in `useSearch`                              | Restore prior weights from tuning log if diagnostics show regressions. |

## Fairness Roadmap

| Backlog | Smallest Reversible Step | Validation |
| --- | --- | --- |
| B-308 Hidden gem surfacing | Give low-volume places with strong dish/save quality a bounded exploration path. | Track saves/clicks without burying stronger direct matches. |
| B-312 Freshness decay | Decay stale generic interactions before recent high-quality dish signals. | Compare search and Discover result quality before/after. |
| B-314 Anti-sludge systems | Downrank vague, duplicate, reported, or engagement-bait content before amplification. | Audit moderation and content-quality false positives. |
| B-315 Discovery fairness | Keep a ranking-diagnostics note for every new signal. | Document source, privacy impact, abuse risk, and rollback path. |
