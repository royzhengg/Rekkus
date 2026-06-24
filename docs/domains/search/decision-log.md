# Search Decision Log

## 2026-06-25 — Dish-first to food-first

Decision: Rekkus is food-first and discovery-first, not dish-first.

Why: Dish-led discovery is a differentiator, but forcing every search and discovery path through dishes creates the wrong product model. Places, collections, posts, and people are also valid food discovery entities.

Implication: Avoid new platform-language that says Rekkus is dish-first. Use food-first/discovery-first unless a specific dish graph feature is being discussed.

## 2026-06-25 — Default Dishes to default All

Decision: Search defaults to `All`.

Why: Food-first means result relevance depends on the query. `ramen` may bias dishes, `Gumshara` should bias places, `best ramen Sydney` should bias collections, and `date night` may need mixed discovery.

Implication: Query classification and server ranking determine result prominence. The client must not hardcode dishes as the default winner.

## 2026-06-25 — Collections become first-class

Decision: Collections are first-class search and discovery entities.

Why: Collections help users decide, not just look up. They can answer intent like `best ramen Sydney`, `date night`, or `late-night eats` better than a flat place list.

Implication: Collection searchability requires eligibility rules. Collection ordering remains server-owned.

## 2026-06-25 — Terminology audit

Reviewed terms:

- `dish-first`
- `dish first`
- `dish centric`
- `dish-centric`
- `dishes are primary`
- `dishes are the primary entity`
- `default to dishes`

Updated canonical product/search/design wording to food-first/discovery-first.

Intentionally left unchanged:

- Historical `COMPLETED_ITEMS.md` shipped descriptions.
- Dish Graph backlog rows where the task is specifically about dish graph infrastructure.
- Feature-specific privacy copy where "dish-first discovery" describes existing food-review data use, not the platform identity.

Conflicting principle found:

- `PRODUCT.md` previously stated dish-first discovery as a product principle. It now states food-first discovery with result relevance determined by intent, context, and ranking.
