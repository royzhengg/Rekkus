# Accessibility

Accessibility owns practical mobile checks for Rekkus before beta and release.

## Required Checks

| Area | Requirement |
| --- | --- |
| Screen reader | Primary actions, icon buttons, form inputs, tabs, and cards have useful accessible labels. |
| Touch targets | Interactive controls should be easy to tap on mobile. |
| Contrast | Text, icons, and controls must remain readable in light and dark themes. |
| Text scaling | Core flows should tolerate larger text without hiding actions. |
| Error states | Forms and service failures need clear recovery copy. |
| Motion | Avoid motion that is required to understand or complete a task. |

## Contrast Audit

`npm run check:a11y` enforces WCAG AA `4.5:1` contrast for normal token-backed text. Disabled text is excluded because disabled controls need a visibly inactive state.

| Theme | Token | Audited backgrounds | Lowest ratio |
| --- | --- | --- | --- |
| Light | `text` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `14.19:1` |
| Light | `text2` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `5.23:1` |
| Light | `text3` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `4.56:1` |
| Light | `chipDefaultText` | `chipDefaultBg` | `4.78:1` |
| Light | `chipActiveText` | `chipActiveBg` over `bg`, `surface`, `surface2` | `4.91:1` |
| Light | `ratingText` | `ratingBg` | `5.87:1` |
| Light | `errorText` | `errorBg` | `5.83:1` |
| Dark | `text` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `12.59:1` |
| Dark | `text2` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `6.02:1` |
| Dark | `text3` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `4.72:1` |
| Dark | `chipDefaultText` | `chipDefaultBg` | `6.99:1` |
| Dark | `chipActiveText` | `chipActiveBg` over `bg`, `surface`, `surface2` | `6.40:1` |
| Dark | `ratingText` | `ratingBg` | `6.74:1` |
| Dark | `errorText` | `errorBg` | `5.58:1` |

## Priority Flows

- Auth and password reset.
- Search and Places.
- Restaurant detail and save actions.
- Create review.
- Settings, privacy, and account controls.

## Ownership

- Product behavior: [../product/UX.md](../product/UX.md)
- Release checks: [../operations/RELEASE.md](../operations/RELEASE.md)
- Component inventory: [UI_LIBRARY.md](UI_LIBRARY.md)
