# Motion

Motion owns animation principles for Rekkus across Expo and React Native.

## Principles

- Motion should clarify state, hierarchy, or transition.
- Avoid decorative motion that competes with food photos or list scanning.
- Keep animation optional from a product standpoint; core flows must work without it.
- Respect platform performance and reduced-motion expectations where supported.

## Allowed Uses

| Use | Guidance |
| --- | --- |
| Screen transitions | Use platform/router defaults unless a product need exists. |
| Press feedback | Lightweight scale/opacity feedback is acceptable. |
| Loading state | Prefer skeleton/placeholder stability over flashy loaders. |
| Map/list reveal | Keep transitions short and avoid layout jumps. |
| Form steps | Motion may orient users, but validation clarity matters more. |

## Guardrails

- Avoid long looping animations in dense utility screens.
- Test on mobile hardware or simulator when motion touches lists, maps, images, or startup.
- Update [../docs/architecture/PERFORMANCE.md](../docs/architecture/PERFORMANCE.md) if a motion change affects performance budgets.

