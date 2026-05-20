# Component Patterns

Component patterns own how reusable UI should be chosen, composed, and extended.

## Ownership

| Component Type | Location | Rule |
| --- | --- | --- |
| Primitive UI | `components/ui/` | No business logic. |
| Shared app UI | `components/` | Cross-feature, reusable, themed. |
| Feature-local UI | `features/<area>/` | Specific to one product area. |
| Icons | `components/icons.tsx` | Reusable SVG source of truth. |

## Patterns

- Prefer existing primitives such as `PrimaryButton`, `FormInput`, `EmptyState`, and `ScreenHeader`.
- Keep cards for repeated items, modals, and genuinely framed tools.
- Do not nest card-style containers without a clear functional reason.
- Keep list rows stable in height when dynamic content loads.
- Action lists should use `RekkusActionSheet`.
- Icon-only controls need accessible labels and clear hit targets.

## When To Add A Component

Add or extract a component when:

- The pattern repeats across features.
- It reduces meaningful duplicated themed styling.
- It has a stable ownership boundary.

Keep feature-local components local until reuse is real.

