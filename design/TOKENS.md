# Tokens

Tokens own shared color, spacing, typography, and radius decisions for Rekkus.

## Sources

| Token Area | Source |
| --- | --- |
| Colors | [../constants/Colors.ts](../constants/Colors.ts) |
| Spacing | [../constants/Spacing.ts](../constants/Spacing.ts) |
| Radius | [../constants/Radius.ts](../constants/Radius.ts) |
| Typography | [../constants/Typography.ts](../constants/Typography.ts) |

## Rules

- Do not hardcode product colors in screens when a token exists.
- Use semantic theme colors from `useThemeColors()` for themed UI.
- Add tokens only when a pattern repeats across screens or primitives.
- Keep touch targets and spacing mobile-first.
- Avoid new one-off palettes for individual features.
- Modal/action surfaces should use shared theme colors plus bounded accent colours from existing semantic roles. Avoid dull grey-only fields; use subtle warm surfaces, thin borders, and focus accents that hold up in dark mode.
- Use `spacing`, `radius`, and semantic typography presets in new screen styles; raw values are legacy debt only.
- Exact-value aliases in `spacing`, `radius`, and `fontSize` preserve existing shipped UI during mechanical sweeps. Prefer semantic scale tokens for new work.

## Review Triggers

Update this doc when:

- A token is added, renamed, or removed.
- A color meaning changes.
- Typography scale or radius rules change.
- A new component pattern requires reusable spacing or sizing.

## Semantic Typography

Import semantic presets for common screen text:

```ts
import { bodyBase, bodySmall, bodyLarge, caption, label, heading } from '@/constants/Typography'
```

Use `bodyBase` for default body copy, `bodySmall` for supporting copy, `caption` for dense metadata, `label` for chips/buttons, and `heading` for compact section titles.

## Border Radius

Import from `constants/Radius.ts`.

```ts
import { radius } from '@/constants/Radius'
```

| Token         | Value | Usage                         |
| ------------- | ----- | ----------------------------- |
| `radius.xs`   | 4     | Tiny badges, media indicators |
| `radius.sm`   | 6     | Small controls                |
| `radius.md`   | 10    | Cards, chips                  |
| `radius.lg`   | 14    | Inputs, panels                |
| `radius.xl`   | 18    | Larger chips                  |
| `radius.pill` | 20    | Primary buttons               |
| `radius.full` | 999   | Avatars, round badges         |
