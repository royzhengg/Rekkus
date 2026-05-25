# Lessons: Design System

## Magic numbers in styles accumulate into inconsistency

When font sizes, spacing, and border radii are hardcoded per screen, they drift. After 10 screens the padding on a card is 16 in one place and 18 in another. Fix: import from `constants/Typography`, `constants/Spacing`, `constants/Colors` — one value, used everywhere.

---

## `ScreenHeader` replaces the repeated 56px topBar pattern

The `topBar` style block (height 56, paddingH 16, borderBottom) was copy-pasted into 9 screens. Now use `components/ui/ScreenHeader`:

```tsx
<ScreenHeader title="@username" left={<BackBtn />} right={<SettingsIcon />} />
```

---

## `ThumbGrid` replaces duplicated 3-col photo grids

The thumbnail grid was copy-pasted between `profile.tsx` and `user/[username].tsx`. It now lives in `components/ThumbGrid.tsx` and is imported by both.

---

## Shadow styles are design tokens too

Raw `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, and `elevation` values drift just like spacing and radius values. Use `constants/Elevation.ts` presets so cards, sheets, labels, and floating controls share the same depth language.

Prevention: `check:design` blocks raw shadow/elevation styles in `features/` and `components/`.

**Apply when:** adding any raised surface or floating control.

---

## Contrast tokens need executable audits

Secondary and tertiary text tokens can look acceptable in one theme while failing WCAG AA on adjacent surfaces. Fix token contrast at the source, then enforce it with `check:a11y` so future palette changes recalculate ratios instead of relying on a one-time manual review.

**Apply when:** changing text, surface, chip, rating, or error colour tokens.

---

## Routine failures need one owned surface

Inline text errors, failure alerts, and dismiss-only failure sheets drift in copy, placement, accessibility, and styling. `ErrorMessage` now owns routine load and mutation failure feedback; `RekkusActionSheet` remains appropriate when a failed workflow gives the user a real recovery action such as retry or review.

Prevention: `check:design` rejects custom error boxes, routine failure alerts, and dismiss-only failure notices, with scanner fixtures covering allowed validation, permission, success, and recovery flows.

---

## Canonical patterns require recorded decisions

A canonical table without rationale still invites a future agent to add a plausible competing pattern. Every active Canonical Patterns row in `AGENTS.md` must link to an accepted ADR, and `check:docs` rejects missing or non-accepted decisions.

Loading is intentionally contextual: use a spinner for compact action or pagination waits, skeletons for predictable content surfaces, and `<EmptyState loading>` only when a blocking full-screen transition has no meaningful content shape.

Prevention: `check:docs` validates active ADR linkage; `check:design` rejects bare centred content spinners while permitting the three documented loading cases.
