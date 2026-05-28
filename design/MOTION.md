# Motion

Motion owns animation principles for Rekkus across Expo and React Native.

## Principles

- Motion should clarify state, hierarchy, or transition.
- Avoid decorative motion that competes with food photos or list scanning.
- Keep animation optional from a product standpoint; core flows must work without it.
- Respect OS Reduce Motion through `useReducedMotion()`.

## Allowed Uses

| Use | Guidance |
| --- | --- |
| Screen transitions | Use platform/router defaults unless a product need exists. |
| Press feedback | Lightweight scale/opacity feedback is acceptable. |
| Loading state | Prefer skeleton/placeholder stability over flashy loaders. |
| Map/list reveal | Keep transitions short and avoid layout jumps. |
| Form steps | Motion may orient users, but validation clarity matters more. |
| Post video | Public feed/detail autoplay is muted, visible-only, preference-controlled, and disabled by Reduce Motion. Manual controls remain available. |

## Reduced Motion Contract

- Automatic entrances, springs, modal slide/fade transitions, map camera animation, typing/loading loops, and autoplay must consult `useReducedMotion()`.
- Direct manipulation remains responsive: drag, swipe, scroll, tap, and manual video play are functional with Reduce Motion enabled.
- Use `usePostVideoPlayback()` for post playback ownership. UI components pass eligibility; they do not call `player.play()` directly.
- Create/review previews and message attachments remain tap-to-play or static attachments.
- Approved haptics are semantic confirmation only: light for like/save changes and medium after a successful post publication.

## Guardrails

- Avoid long looping animations in dense utility screens.
- `check:risk-guardrails` rejects unguarded motion/modal sites, raw React Native `Animated`, direct haptic imports outside the boundary, generic haptics, and unowned video autoplay.
- Test on mobile hardware or simulator when motion touches lists, maps, images, or startup.
- Update [../docs/architecture/PERFORMANCE.md](../docs/architecture/PERFORMANCE.md) if a motion change affects performance budgets.
