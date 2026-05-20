# Taste Graph

Owner: Product

The taste graph is Rekkus's model of what people, dishes, cuisines, places, and reviewers are meaningfully connected by food intent.

## Entities

- Users and reviewer profiles.
- Posts/reviews.
- Restaurants/places.
- Dishes and dish tags.
- Cuisines.
- Saves, follows, likes, reactions, comments, and visits.

## Current Inputs

- Saved posts and saved locations.
- Liked posts and reactions.
- Follow graph.
- Cuisine type, Rekkus Picks (`taste_verdict`, `value_verdict`, `occasion_tags`), and legacy food/vibe/cost ratings.
- Dish tags and best-dish mentions.
- Mixed media metadata, with dish tags scoped to photo media through `mediaLocalId`/`mediaId` references.
- Search and place interaction analytics.

## Future Uses

- Better local recommendations.
- Taste-profile summaries.
- Dish-first discovery and collections.
- Rekkus Picks-based search filters such as Worth a trip, Great value, and Date night.
- Similar reviewer/place/dish suggestions.
- Aggregate social proof such as friends who've been here, follower/following taste overlap, and coarse taste compatibility labels.

## Social-Proof Rules

- Start with aggregate counts and deterministic overlap; do not expose named private saves or visits without explicit product rules.
- Compatibility labels need enough shared saves, cuisines, dish tags, or high-rated posts to be useful.
- Any label shown on discovery, restaurant, or profile surfaces must explain the food signal, not imply generic popularity.
- See [SOCIAL_PROOF.md](SOCIAL_PROOF.md) for rollout ownership.

## Guardrails

- Saves over likes for intent.
- Deterministic signals before AI inference.
- Privacy-safe analytics metadata only.
- Do not expose private user taste signals without explicit product rules.
