# Design System

This doc owns the design-system contract for Rekkus. Implementation details live in [UI_LIBRARY.md](UI_LIBRARY.md), and token source files live in [../constants](../constants).

## Direction

Rekkus should feel visual, food-first, local, and efficient. Design choices should make saved intent, dishes, photos, and local context easy to scan.

## System Rules

- Use themed colors through `useThemeColors()` and memoized styles.
- Use constants from [../constants/Colors.ts](../constants/Colors.ts), [../constants/Spacing.ts](../constants/Spacing.ts), and [../constants/Typography.ts](../constants/Typography.ts).
- Keep route wrappers thin; screens own layout in `features/`.
- Reuse `components/ui/` primitives before adding new components.
- Put reusable icons in [../components/icons.tsx](../components/icons.tsx).
- Use `RekkusActionSheet` for action lists.

## Surface Patterns

| Surface | Pattern |
| --- | --- |
| Feed and grids | Visual first, stable item sizing, fast scanning. |
| Search | Dense results, clear empty states, no decorative clutter. |
| Restaurant detail | Food context before provider metadata. |
| Forms | Progressive steps, clear validation, minimal required fields. |
| Settings | Plain operational controls and explicit privacy language. |

## Change Rule

New visual patterns should update this doc, [UI_LIBRARY.md](UI_LIBRARY.md), or [DESIGN_SPEC.md](DESIGN_SPEC.md) before the backlog row is marked shipped.

