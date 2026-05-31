# Lessons: Utilities / Config

## Never duplicate utility functions — centralise at first reuse

`parseLikes`, `todayHoursIndex`, `avatarPalette` were each defined in 3–4 files before being extracted. The rule: as soon as a function appears in a second file, move it to `lib/utils/` and import it everywhere.

---

## Never use `process.env` directly in screens or hooks

Always read env vars from `lib/config.ts`:

```ts
// lib/config.ts
export const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? ''

// screens/hooks
import { GOOGLE_PLACES_KEY } from '@/lib/config'
```

`process.env` was scattered across 4 files before centralisation. Finding and updating keys became a search problem.

Public observability config follows the same rule. Read `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_SENTRY_ENABLED` from `lib/config.ts`; keep `SENTRY_AUTH_TOKEN` build-only in EAS secrets for source-map upload.

The Sentry Expo plugin also needs `SENTRY_ORG` and `SENTRY_PROJECT` build metadata. Pass them as plugin options from EAS environment variables; a bare plugin registration creates noisy local warnings and leaves release source-map setup incomplete.

Disabling Sentry capture is a runtime-policy change, not a reason to remove the Expo plugin. Keep plugin wiring intact, gate both initialisation and `Sentry.wrap` behind explicit enablement plus a DSN, and continue to keep auth tokens EAS-only.

---

## Use `scripts/lib/args.js` for all CLI argument parsing in scripts/

All scripts must import from `scripts/lib/args.js` instead of writing `process.argv.slice(2)` or `new Set(process.argv)` inline.

```js
const { parseFlags, hasFlag, getArg, argv, printHelp } = require('./lib/args') // top-level scripts
const { parseFlags } = require('../lib/args') // ops scripts
```

**Why:** 20+ ops scripts each duplicated `const args = new Set(process.argv.slice(2))`. Inconsistencies crept in — some used `.has()`, others `.includes()` — and there was no canonical TTY/CI color detection. Centralising removes all divergence.

**How to apply:** Add `--help` to every new check script using `printHelp()`. Use `argv()` when you need the raw array (e.g. script name list for run-parallel). Use `parseFlags()` when you need a Set for `.has()` lookups.

**Guardrail:** `check:scripts` (Rule 2) fails CI if any script outside `scripts/lib/args.js` uses `process.argv.slice(2)` or `new Set(process.argv)` directly.

---

## Prevent monolith re-accumulation in ops scripts: extract to checks/, pass result as param, add a LOC ratchet

`scripts/ops/check-operations.js` grew to 1,274 LOC with 44 functions and no exports, making it impossible to unit test individual checks.

**Pattern:**

1. Create `scripts/ops/checks/` and group functions by concern (backlog, feature-flags, governance, docs, external).
2. Each extracted function accepts `result = { failures: [], warnings: [] }` as a final parameter instead of closing over a module-level global. This makes them testable without subprocess invocation.
3. For functions that need injectable dependencies (e.g. `existsFn`), accept them as optional parameters with production defaults: `function checkBacklogEvidence(byId, result, { existsFn = exists } = {})`. Tests pass mock functions; the orchestrator uses the default.
4. The orchestrator (`check-operations.js`) becomes imports + `run()` + output helpers (~260 LOC).
5. Add a Rule in `check-scripts.js` that fails CI if any `scripts/ops/*.js` (direct, not in subdirs) exceeds 300 LOC.

**Why:** Without a LOC ratchet, the monolith re-grows silently over time. The rule catches accumulation at the point of addition, not after the fact.

**Guardrail:** `check:scripts` (Rule 4) now fails CI if any `scripts/ops/*.js` exceeds 300 LOC. Tests in `tests/unit/lib/scripts/checkOperations.test.ts` guard the extracted check logic.

---

## Manual release evidence should be generated, then validated

Use a small CLI when a release step needs human device evidence. Generate a Markdown checklist into ignored `.temp/` output, let the tester fill it, and provide a `--check <path>` mode that fails when required items are not checked. This keeps release evidence reviewable without turning manual smoke testing into hidden process.

---

## Parse unknown input at the boundary

Storage, route params, provider JSON, and message metadata are not trusted app types. Parse JSON as `unknown`, then use a focused guard before returning typed data.

**Pattern:** `parseJsonWithGuard(raw, isStringArray)`; route params go through `routeParamString` / `routeParamNumber`.

**Why:** A single unsafe cache/provider value can poison shared hooks and downstream inference.

**Guardrail:** Add or update `test:type-safety` fixtures whenever a shared parser or narrowing helper changes.
