# Tokens

Tokens own shared color, spacing, typography, and radius decisions for Rekkus.

## Sources

| Token Area | Source |
| --- | --- |
| Colors | [../constants/Colors.ts](../constants/Colors.ts) |
| Spacing | [../constants/Spacing.ts](../constants/Spacing.ts) |
| Radius | [../constants/Radius.ts](../constants/Radius.ts) |
| Typography | [../constants/Typography.ts](../constants/Typography.ts) |
| Elevation | [../constants/Elevation.ts](../constants/Elevation.ts) |

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

## Semantic Color Tokens

All tokens live in `constants/Colors.ts` and are accessed via `useThemeColors()`.

### Text

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `text` | `#1A1A18` | `#F0F0EC` | Primary text |
| `text2` | `#5F5F5A` | `#A8A8A2` | Secondary text |
| `text3` | `#686862` | `#94948E` | Placeholder and tertiary text |

### Error / Validation

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `errorBg` | `#FEF0F0` | `#3D1A1A` | Error box background |
| `errorText` | `#B91C1C` | `#F87171` | Error message text |
| `liked` | `#E24B4A` | `#E24B4A` | Error border, liked/heart icon |

### Action (swipe buttons, destructive labels)

Added by DS-001 / ARCH-009. Use for swipe-action backgrounds and destructive row labels.

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `actionInfo` | `#3B82F6` | `#5B93E8` | Pin / info action |
| `actionMute` | `#6B7280` | `#9CA3AF` | Mute action |
| `actionDelete` | `#EF4444` | `#F87171` | Delete / destructive action |
| `actionSuccess` | `#22C55E` | `#34D399` | Mark-read / success action |

### Rating badge

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `ratingBg` | `#FAEEDA` | `#2A2015` | Rating badge background |
| `ratingText` | `#854F0B` | `#D4A030` | Rating badge text |

### Interaction, Chip, And Elevation Tokens

- Use `pressed`, `focused`, `disabledBg`, and `disabledText` for control states instead of opacity-only hacks.
- Use `chipDefault*`, `chipActive*`, `chipStrong*`, and `chipCategory*` tokens through `components/ui/Chip.tsx`; do not create screen-local pill palettes.
- Use `elevation.none/xs/sm/md/lg` from `constants/Elevation.ts` for all shadow/elevation styles. `check:design` blocks raw shadow props in `features/` and `components/`.
- `check:a11y` enforces 4.5:1 contrast for normal text tokens on their intended theme surfaces; disabled tokens are excluded so disabled controls can remain visibly disabled.
