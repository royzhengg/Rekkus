# Testing Governance

Owner: Engineering

Testing exists to protect release confidence without slowing every small change.

## Unit Test Suite (Jest)

**Preset:** `jest-expo` — handles React Native transforms, Expo module mocks, and platform setup.

**Config:** `jest.config.js` at repo root.

**Test locations:**

| Directory | Purpose |
| --- | --- |
| `tests/unit/lib/utils/` | Pure utility functions (no mocking required) |
| `tests/unit/lib/services/` | Service functions (mock `@/lib/supabase` and `@/lib/analytics`) |
| `tests/unit/lib/hooks/` | Hooks (use `renderHook` from `@testing-library/react-native`) |
| `tests/type-safety/` | Type-guard tests using Node's native `node:test` runner — NOT Jest |

**Commands:**

```bash
npm run test:unit       # run the serial Jest unit suite
npm run check:coverage  # run the serial suite with CI coverage ratchets
npm run test:type-safety # run scanner and boundary fixtures
```

**Coverage contract:** `lib/utils/` statements must remain at least 10%. B-512 also ratchets statement coverage on shared regression surfaces: `lib/routes/index.ts` 100%, `lib/utils/searchScoring.ts` 48%, `lib/services/search.ts` 32%, `lib/services/posts/types.ts` 100%, `lib/hooks/useSearch.ts` 50%, `lib/hooks/useAutocomplete.ts` 94%, and `lib/hooks/useRestaurantSearch.ts` 86%. Raise these floors when coverage expands; do not lower them to accommodate removed tests.

**Mocking patterns:**

- Supabase: `jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))` — then use `jest.mocked(supabase.from).mockReturnValue({ select: jest.fn()... })`
- Reanimated hooks: `jest.mock('react-native-reanimated', () => ({ useReducedMotion: jest.fn() }))`
- Feature flags / external deps that have module-load side-effects: mock at the top of the test file before importing the module under test

**Note:** Expo public environment values may be present or inlined during Jest transforms. Provider tests mock `@/lib/config` plus network/telemetry boundaries, rather than depending on a developer's local `.env`.

## Default Checks

| Change type | Required checks |
| --- | --- |
| Docs only | `npm run check:docs`, `npm run check:ops` |
| Operations/backlog | `npm run check:ops`, `npm run check:hygiene` |
| TypeScript or React Native | `npm run typecheck`, `npm run lint` when practical |
| Release or env | `npm run check:release` |
| Platform config | `npm run check:platform` |
| Dependencies | `npm run check:deps`, `npm run check:ops` |
| New pure utility or service function | `npm run test:unit` |

## Philosophy

- Prefer deterministic checks for repo rules, release gates, and docs drift.
- Add targeted tests around shared hooks, services, and cross-feature behavior.
- Use manual smoke testing for flows that need device capabilities until automated coverage exists.
- Keep test scope proportional to blast radius.

## Guardrails

- `package.json` must expose the core check scripts used by local work and CI.
- `scripts/ops/check-operations.js` validates the existence of this testing contract.
- New risky workflows should document the smallest repeatable verification path.
- `jest.config.js` `coverageThreshold` enforces aggregate utility and protected-module floors — do not lower them.
- `scripts/lib/async-safety-rules.js` is fixture-tested by `tests/type-safety/asyncSafetyRules.test.js` and enforced by `check:risk-guardrails`.
