# ADR-0019: Remove numeric food/vibe/cost ratings in favour of qualitative Rekkus Picks

**Date**: 2026-06-15  
**Status**: Accepted

## Context

Posts previously stored three 0–5 numeric ratings: `food_rating`, `vibe_rating`, `cost_rating`. These were mapped from qualitative Rekkus Pick selections via `tasteToLegacyFood` and `valueToLegacyCost` bridge functions. The vibe rating was driven by whether any occasion tags were selected.

Problems with this model:
1. Numeric ratings are easily gameable — they incentivise systematic cheating rather than authentic expression.
2. Every other review platform uses the same 1–5 star model. Rekkus's differentiation is its qualitative vocabulary ("Craveable", "Worth a trip", "Great value").
3. The bridge functions created a redundant write path: qualitative data was being discarded in favour of a numeric summary.
4. No consumers of the numeric fields used them for ranking or display in a way that couldn't be served by the qualitative fields.

## Decision

Remove `foodRating`, `vibeRating`, `costRating` from all create/edit surfaces and from the `CreatePostDraft` type. Make `food`, `vibe`, `cost` optional on the `Post` domain type (NULL for new posts; legacy posts retain their values for read-only display in older screens until those screens are updated). Remove the bridge functions from the post creation path entirely.

Add two new boolean post fields:
- `cashDiscount`: this place offers a discount for cash payment
- `googleReviewFreebie`: this place gives freebies to customers who show a Google review

These capture community-intelligence signals that no other app surfaces, and booleans avoid the gaming problem entirely.

## Alternatives considered

**Keep numeric ratings as a secondary signal**: Rejected. Maintaining a write path that nobody trusts produces noise, not signal. Two write paths for the same concept also creates a testing and maintenance burden.

**Replace with a single aggregate 1–5 star**: Rejected. This is exactly what every other app does. Rekkus's value is specificity — "Worth a trip" tells you more than "4.2 stars".

**Remove numeric columns from the DB now**: Partially deferred. The `food_rating`, `vibe_rating`, `cost_rating` columns remain in the DB and `Post` domain type (as optional) to avoid a migration risk on a live branch. A follow-up migration will drop them once the legacy display components are updated.

## Consequences

- New posts have NULL food/vibe/cost in the DB; this is safe for all current ranking queries (they already null-check).
- Legacy posts display their old numeric ratings in `PlaceDetailContent`, `ProfileReviewCards`, and `SearchResultsTab` until those screens are updated.
- `tasteToLegacyFood` and `valueToLegacyCost` are no longer called anywhere in the create path; they remain in `lib/dataSources/rekkusPicks.ts` for now but should be deleted in the cleanup pass.
- `cashDiscount` and `googleReviewFreebie` require DB columns on `posts` and `post_drafts` and RLS policies granting creator write / public read.
