# Mobile Performance Governance

Owner: Engineering

Performance governance keeps the app usable on real iOS and Android devices without prematurely building heavy infrastructure.

## Budgets

| Surface | Rule |
| --- | --- |
| Feed and grids | Paginate or slice before rendering large lists. |
| Search | Debounce input and dedupe provider requests. |
| Maps | Avoid rendering unbounded markers; cluster or window before scale. |
| Images | Prefer sized images, thumbnails, and stable aspect ratios. |
| Hooks | Memoize derived data when it can recalculate across list renders. |
| Startup | Keep providers lightweight and avoid blocking app mount on optional data. |

## Required Patterns

- Use `FlatList` or equivalent virtualized rendering for long lists.
- Keep expensive provider calls behind services with cache, debounce, or pagination.
- Keep route wrappers thin so screens can own loading and empty states.
- Treat weak-network states as product states, not unhandled errors.
- Add performance notes to backlog rows when work can increase storage, network, map, image, or list cost.

## Review Triggers

Run a performance review when a change touches:

- Feed, search, alerts, profile grids, saved lists, or maps.
- Image upload, image display, or storage variants.
- Background refresh, polling, push registration, or provider fallback.
- New dependencies with native modules or large runtime surface.

## Guardrails

- `npm run check:ops` validates this doc exists and names the core mobile risk areas.
- `npm run check:platform` protects native config and platform support.
- `npm run check:release` is the release-level gate for changes that affect native config, environment, or provider behavior.
- Run a targeted device smoke test for changes that affect list density, map rendering, image display, startup, or weak-network behavior.
- Performance work must preserve existing UX semantics: do not remove animations, change visible hierarchy, alter gestures, or shorten meaningful transitions just to appear faster. Improve latency through request dedupe, memoization, stable callbacks, bounded lists, thumbnail use, and avoiding redundant provider fetches.
