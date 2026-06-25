# Discovery Component Guide

This is the implementation contract for Taste Ledger discovery UI. Taste Ledger is not a catalogue. It is a personal food journal that helps people decide what to eat through trusted people, local signals, and memorable discoveries.

## Ownership

`components/discovery/` is presentation only:

- No hooks
- No provider access
- No navigation decisions
- No analytics
- No data fetching
- No ranking
- No feature flags

`features/feed/` owns feed composition. `features/search/` owns discovery composition. Services and hooks own data, state, and side effects.

## Product Principles

- Every surface helps answer: "What should I eat?"
- Food is more visually prominent than venues.
- Provenance is visible and human: "Saved nearby", "Trending this week", "From people you follow".
- Discovery feels calm, curious, editorial, warm, and human.
- No surprise interruptions: no popups, forced onboarding, promotional overlays, autoplay, or banners.
- Surfaces encourage saving before reviewing.
- Empty space communicates opportunity, not absence.

## Visual Weight

Highest:
- Food imagery
- Food name

High:
- Save CTA

Medium:
- Restaurant or place name

Low:
- Metadata
- Distance or locality
- Provenance

Lowest:
- Decorative elements

## Taste Rail

- Use `TasteRail` only on top-level discovery modules and ledger prompts.
- Never render it inside feed posts or cards.
- Width comes from `discoveryTokens.railWidth`.
- It is decorative and hidden from accessibility.
- It may fade in; no bounce, scale, or layout-heavy motion.
- It is RTL-ready if localisation later moves the rail to the trailing edge.

Semantic mapping:

| Provenance | Rail treatment |
| --- | --- |
| `LOCAL` | Sage token |
| `FOLLOWING` | Blue token |
| `STAFF` | Clay/accent token |
| `TRENDING`, `NEW` | Accent token |
| `POPULAR` | Neutral token |
| `YOU_SAVED`, `RECENT` | Strong text token |

## Card Anatomy

```text
Image
Food
Restaurant / place
Provenance or social proof
Metadata
CTA
```

Rules:

- Image priority: dish image -> food collage -> restaurant hero -> restaurant logo -> placeholder.
- Missing image metadata uses the approved placeholder, not ad hoc crop logic.
- Max: one image, one provenance chip, two metadata rows, one supporting sentence, two actions.
- Long food/place names wrap to the approved line limit, then truncate.
- Key CTAs must remain visible.
- No nested touch targets inside one card action area.

## Module Contract

Every discovery module must:

- Use `DiscoveryModule`.
- Use `DiscoverySectionHeader`.
- Declare one provenance type.
- Expose loading, skeleton, loaded, empty, offline, error, and refreshing states.
- Have one primary CTA.
- Preserve product-owned module ordering.
- Keep analytics requirements in the owning feature, not shared UI.
- Update `product/FEATURES.md` when a new module ships.

Module priority groups:

1. Personal memory
2. Recent intent
3. Community momentum
4. Local options
5. Editorial inspiration
6. Social graph expansion
7. Reserved: Seasonal, Occasion, Experimental

## Copy

Layout defines placement. Copy lives in configuration owned by the feature.

Use:

- Short
- Warm
- Specific
- Action-oriented
- Food-first

Avoid:

- Clickbait
- Generic "Top 10" language
- "Best ever"
- Excessive superlatives
- Restaurant-directory copy when food evidence exists

## Motion

- Use subtle opacity or small translateY only.
- Respect Reduce Motion.
- No bounce, marquee, autoplay, or decorative looping motion.
- Preserve 60fps by avoiding layout-heavy animations.

## Layout Stability

- Skeletons preserve hierarchy.
- Loading modules reserve approximately their final rendered height.
- Modules may fade in.
- Modules must not cause vertical page jumps after data resolves.

## Accessibility

- Dynamic Type uses `maxFontSizeMultiplier`.
- VoiceOver and TalkBack order follows visual hierarchy.
- Hidden modules expose no focusable elements.
- Decorative rails are accessibility-hidden.
- Text actions have explicit roles and labels.
- Light and dark mode preserve the same information hierarchy and visual weight.

## Scroll Rhythm

- Alternate dense and light modules.
- Avoid three visually heavy modules consecutively.
- Separate large editorial modules with lighter content.
- Discovery should feel paced rather than repetitive.

## Do Not

- Do not introduce hooks in `components/discovery/`.
- Do not move business logic into shared UI.
- Do not change service APIs, analytics names, payloads, routes, or deep links.
- Do not add providers, contexts, feature flags, ranking, or new external calls.
- Do not duplicate section headers, taste rails, skeletons, or empty states outside this system.
- Do not add gradients, glassmorphism, full-width hero banners, autoplaying discovery media, heavy shadows, or magic styling values.

Reserved interactions requiring separate design approval:

- Swipe
- Long press
- Multi-select
- Inline editing
- Drag and drop

## Design Review

Before merging Discovery UI:

- Supports "What should I eat?"
- Food is more visually prominent than venue.
- Uses `DiscoveryModule`.
- Uses `DiscoverySectionHeader`.
- Uses only approved tokens.
- Has loading, empty, error, and offline states.
- Supports Dynamic Type.
- Supports Reduced Motion.
- Passes dark mode.
- Preserves layout stability.
- No duplicate components introduced.
- No business logic inside presentation components.
- Existing analytics unchanged.

