# Lessons: Testing

## `EXPO_PUBLIC_*` env vars are compile-time constants in Jest

`babel-preset-expo` inlines `EXPO_PUBLIC_*` variables at Babel transform time. Assigning to `process.env.EXPO_PUBLIC_*` at runtime inside a test has no effect, and a developer `.env` can unexpectedly enable network-backed code. To test branches gated on these vars, mock `@/lib/config` and any network/telemetry boundary or inject the key.

## Coverage thresholds must be achievable on day one

Set `coverageThreshold` at current coverage, not a future aspirational number. Document the target progression in a comment so the next engineer knows where it is heading:

```js
// Current: validation.ts (100%) → aggregate ~1.7%
// Target: 5% → 20% → 50% as scoring / query parsing gain tests
coverageThreshold: { './lib/utils/': { statements: 1 } }
```

## Critical shared paths need per-module coverage ratchets

Aggregate thresholds can stay green while a high-risk route builder, transform, service, or async hook loses all behavioural coverage. B-512 adds per-file floors for the route, search-scoring, search-service, post-transform, and async-hook surfaces it protects. Run coverage serially so the small gate is deterministic and open-handle failures remain visible.

## `tests/type-safety/` uses Node's native `test` runner

The `tests/type-safety/` suite imports from `node:test` and `node:assert`, not Jest. Always exclude it from Jest via `testPathIgnorePatterns`:

```js
testPathIgnorePatterns: ['/node_modules/', '/tests/type-safety/']
```

Running it through Jest will fail with `SyntaxError` or missing globals.

## Disable Watchman in Jest config

Agent sandboxes and some local machines cannot write Watchman's state directory. Set `watchman: false` in `jest.config.js` so `npm run test:unit`, `check:coverage`, and hygiene checks use Node crawling and do not fail before tests run.

## External API providers need an independent feature flag

GIF providers, geocoding APIs, and other external services should have their own feature flag so they can be disabled without a release or toggling the parent feature. This allows kill-switch response to quota overruns, billing surprises, or provider outages.

## Track test compiler configuration, not emitted scratch output

Type-safety fixtures need a committed `tsconfig` so compiler-option changes are reviewable and IDE diagnostics point at source configuration. Use supported current module-resolution settings for Node-executed tests, and keep emitted JavaScript or comparison snapshots under ignored `.temp/` output only.
