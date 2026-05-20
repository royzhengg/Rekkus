# Cold Start

Cold start owns how Rekkus becomes useful before the local graph has enough posts, saves, dish tags, and contributors.

## Strategy

Use founder-curated and deterministic systems first. Do not rely on AI or provider popularity to fake a taste graph.

## Inputs

| Input | Role | Risk |
| --- | --- | --- |
| Seed restaurants | Give local search and places usable coverage | Can become directory-like if dish signals are absent. |
| Founder reviews/photos | Create initial content density | Needs quality and authenticity standards. |
| Curated collections | Package useful local intent | Must be specific, not generic lists. |
| Onboarding topic follows | Seed Discover before a user has saves or follows | Must remain user-controlled and export/delete scoped. |
| Provider metadata | Fill address/hours/context gaps | Must remain enrichment, not canonical truth. |
| Early user saves | Strongest taste graph starter | Needs privacy-safe analytics and clear settings. |

## Rules

- Seed by neighborhood and cuisine/dish intent, not city-wide completeness.
- Prefer fewer useful places with dish context over many bare restaurant rows.
- Track whether a surface is powered by Rekkus content, provider enrichment, or fallback copy.
- Do not hide low-density reality behind artificial social proof.
- Promote first contribution loops where the app lacks content.

## Minimum Useful Density

Before expanding a neighborhood, aim for:

- Enough saved/reviewed restaurants to make search and Places feel alive.
- Several dish-specific posts per priority cuisine or local intent.
- A small set of curated collections that answer real decisions.
- Clear empty states for missing cuisines, dishes, or neighborhoods.

## Shipped Foundations

- Staff-pick collection rows are public/unlisted `collections` with `is_staff_pick`, `curator_note`, and `display_order`.
- Profile setup captures 3+ user topic follows in `user_topic_follows` and Discover uses them as an additive ranking boost.
- Empty Following points users toward suggested reviewers and Discover instead of showing a dead end.

## Seeded Density Roadmap

| Backlog | Smallest Reversible Step | Guardrail |
| --- | --- | --- |
| B-316 Cold-start seeded restaurants | Seed one neighborhood/cuisine cluster with provider-enriched restaurant rows. | Every seeded place needs a path to dish evidence. |
| B-317 Cold-start seeded dishes | Add dish tags or best-dish notes to founder/staff content. | Avoid invented menu claims. |
| B-318 Cold-start seeded contributors | Curate suggested reviewers from real useful content. | No fake users or synthetic social proof. |
| B-319 Founder-generated starter content | Founder/staff posts disclose authentic experience and source. | Follow moderation and media rules. |
| B-320 Curated starter collections | Staff-pick collections answer specific local decisions. | Prefer narrow utility over broad lists. |

## Owners

- Product direction: [../PRODUCT.md](../PRODUCT.md)
- Discovery surfaces: [DISCOVERY.md](DISCOVERY.md)
- Quality: [QUALITY.md](QUALITY.md)
- Growth loops: [GROWTH_LOOPS.md](GROWTH_LOOPS.md)
