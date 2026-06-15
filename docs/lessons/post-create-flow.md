# Lessons: Post Creation Flow Overhaul (June 2026)

## Field hierarchy through order, not labels

We considered labelling fields "Optional" or using accordion collapse to communicate which fields matter. Both patterns failed in review:

- Labelling every optional field with "(optional)" creates visual clutter that makes *all* fields feel lower priority.
- Accordion/collapse is frequently missed — users who don't tap a collapsed section never discover its contents.

**The chosen approach**: mandatory fields first (body, taste verdict, cuisine), optional fields below with a section label change ("More details"), no other differentiation. Order communicates priority without adding noise. This matches how Airbnb and Apple handle optional form sections.

## canAdvance per step, not one global computed value

The form state initially had a single `canAdvance` computed value tied to step 1 (title + media). For step 2 (body + tasteVerdict + cuisineType required) we added `canAdvanceStep2` rather than parameterising `canAdvance`. The screen then computes `canAdvanceCurrentStep = step === 2 ? form.canAdvanceStep2 : form.canAdvance`.

The alternative (passing `step` into the hook) would have coupled form state to screen navigation state. Keeping them separate makes the form state independently testable.

## Dish tagging UX: coordinate model kept, discoverability redesigned

The existing coordinate-based dish tag model (pin a point on a photo, attach a dish name) was kept because it provides spatial context that a pure list cannot. The problem was discoverability — the "Tag dishes" button was buried in a small text link inside a photoActions row.

Solution: a prominent outline pill button with `TagIcon` + label, positioned directly below the media strip after photos are added. First-time users see a one-time hint banner (stored in `AsyncStorage` via `rekkus:dish-tag-onboarding:v1`). The chip list below the strip shows de-duped names across all tagged photos.

## Recent photos strip removed, not deprecated

The recent photos auto-strip was removed entirely rather than moved or feature-flagged. Reasons:
1. It was redundant with the native photo picker (which already shows recent photos by default on iOS).
2. It required `MediaLibrary` permission which is a separate permission from the photo picker. Asking for it implicitly felt intrusive.
3. The `resolveRecentPhotoAsset` path that fetched full metadata from `MediaLibrary.getAssetInfoAsync` was a fragile code path (extensionless URIs on iOS, missing localUri on some devices) that caused disproportionate bug surface for a feature nobody relied on.

## Numeric ratings removal: optional fields on Post, not hard delete

`food_rating`, `vibe_rating`, `cost_rating` remain optional (not removed) on the `Post` domain type to preserve legacy read paths in `PlaceDetailContent`, `SearchResultsTab`, and `ProfileReviewCards`. The create/edit path no longer writes these fields (they are NULL for new posts).

The bridge functions (`tasteToLegacyFood`, `valueToLegacyCost`) are dead code — they remain in `rekkusPicks.ts` but are no longer called. Delete them when the legacy display screens are updated.

## cashDiscount and googleReviewFreebie as post-level boolean toggles

These community-intelligence fields are post-level (not place-level) because:
1. Policies change — a restaurant that offered cash discounts last year may not today.
2. Crowd-sourced accuracy: multiple recent posts signalling `cashDiscount: true` is more credible than a single place-level flag.
3. New posts drive signal freshness automatically.

Booleans were chosen over numeric ratings or enum options to avoid the gaming problem (you can't fake a boolean in a useful way) and to keep the toggle UI dead-simple.
