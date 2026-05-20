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

