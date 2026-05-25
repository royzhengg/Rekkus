# Engineering Governance

This doc owns source-of-truth boundaries and engineering constraints that should stay stable as MVP work adds live data.

---

## Source-Of-Truth Ownership

| Area | Source Of Truth | Implementation Boundary | Notes |
| --- | --- | --- | --- |
| Product strategy | [../../PRODUCT.md](../../PRODUCT.md) | Docs only | Strategic positioning and execution order inputs. |
| Execution order | [../../BACKLOG.md](../../BACKLOG.md) | Docs only | Completed rows stay as shipped history. |
| AI/operator behavior | [../../AGENTS.md](../../AGENTS.md), [../../AI_RULES.md](../../AI_RULES.md) | Agent workflow | Prefer deterministic systems before AI. |
| Documentation lifecycle | [../GOVERNANCE.md](../GOVERNANCE.md) | Docs only | Owners, budgets, lifecycle, ADR policy. |
| App routes | `app/` wrappers plus [ARCHITECTURE.md](ARCHITECTURE.md) route naming | Expo Router | `features/` owns screen implementation. |
| Screen implementation | `features/` | React Native screens | Keep business logic out of route wrappers. |
| Reusable primitives | `components/ui/` | UI components | No business logic. |
| Cross-feature UI | `components/` | UI components | Shared app UI and icons. |
| Domain types | `types/domain.ts` | TypeScript | App-facing types. |
| Database types | `types/database.ts` | TypeScript | Generated Supabase types only. |
| Supabase access | `lib/services/` | Service wrappers | Screens should not add direct Supabase logic. |
| Google Places access | `lib/services/googlePlaces.ts` | Service wrapper | Google is enrichment and fallback, not core serving truth. |
| Runtime config | `lib/config.ts`, `app.config.js` | Env/config layer | Public env values only. |
| Mock/demo data | `lib/mocks/`, `lib/dataSources/` | Data-source boundary | `app/` and `features/` must not import mocks directly. |
| Naming conventions | [NAMING.md](NAMING.md) | Code, routes, DB, analytics | Prefer stable, searchable names over local aliases. |
| Data governance | [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md) | Canonical IDs, audits, repairs, metadata | Keep entity identity stable and repairable. |
| Mobile performance | [PERFORMANCE.md](PERFORMANCE.md) | Screens, hooks, services | Review lists, maps, images, startup, and provider calls before scale. |
| Analytics events | `lib/analytics.ts`, [../analytics/ANALYTICS.md](../analytics/ANALYTICS.md) | Analytics abstraction | Keep events privacy-safe and useful for ranking. |
| Release and environments | [../../operations/RELEASE.md](../../operations/RELEASE.md) | Operations docs/checks | Staging, beta, production promotion gates. |
| Security and abuse | [../security/SECURITY.md](../security/SECURITY.md) | Services, Supabase, operations | RLS remains the authorization backstop. |

If a change creates a new owner boundary, update this map and [../../REPO_MAP.md](../../REPO_MAP.md).

---

## Engineering Constraints

- Preserve iOS and Android as first-class targets; web is best-effort.
- Keep `app/` as Expo Router orchestration only.
- Keep external provider calls behind `lib/services/`.
- Use `useThemeColors()` and memoized styles for themed UI.
- Put reusable icons in `components/icons.tsx`.
- Use `RekkusActionSheet` for choice/action lists.
- Avoid new dependencies unless they clearly reduce maintenance, cost, or risk.
- Prefer additive migrations and reversible rollout paths.
- Gate authenticated writes in app code and rely on Supabase RLS for authorization.
- Keep service-role secrets only in Supabase Edge Functions.
- Keep `EXPO_PUBLIC_*` values free of private secrets.
- Preserve `EXPO_PUBLIC_DATA_MODE=live` for staging, beta, and production.
- Route mock/demo data through data-source boundaries only.
- Record durable provider, architecture, data, release, or security decisions as ADRs.
- Follow [NAMING.md](NAMING.md) for route, table, event, file, and product-language names.
- Follow [PERFORMANCE.md](PERFORMANCE.md) when touching lists, maps, images, startup, or provider-heavy flows.
- `npm run lint` is a fatal-warning gate for actionable hygiene: unused imports, duplicate imports, unsafe typing, TypeScript suppression policy, non-null assertions, restricted imports, hooks rules, and console usage.
- `check:risk-guardrails` fails empty catches, deep relative imports, and untracked TODO/FIXME/HACK markers; `check:architecture` ratchets oversized shared files through backlog-linked allowlists.
- `check:stale-flags` blocks unreferenced feature flags and supports only backlog-linked ratchets if existing debt is discovered. Fatal floating-promise, misused-promise, and exhaustive hook-dependency rules are active and must remain clean.

---

## Repository Boundary Maturity

The master plan names possible future folders. Do not add them until a real owner boundary exists.

| Folder | Current Status | Rule |
| --- | --- | --- |
| `app/` | Active | Expo Router wrappers only. |
| `features/` | Active | Screen implementations and feature-local components. |
| `components/` | Active | Shared UI and primitives. |
| `lib/services/` | Active | Provider and network boundaries. |
| `lib/hooks/` | Active | Reusable hooks. |
| `lib/contexts/` | Active | React providers. |
| `constants/` | Active | Design tokens. |
| `types/` | Active | App and generated database types. |
| `supabase/` | Active | Migrations and Edge Functions. |
| `scripts/` | Active | Local guardrails and maintenance checks. |
| `docs/`, `product/`, `business/`, `operations/` | Active | Documentation owner folders. |
| `server/`, `infra/`, `tooling/`, `schemas/` | Future | Add only when responsibilities no longer fit existing owners. |
| `moderation/`, `analytics/`, `store/`, `domain/` | Future | Add only after complexity justifies a dedicated boundary. |

When considering a new top-level folder, first ask whether an existing owner can hold the work. If the new folder is justified, update [../../REPO_MAP.md](../../REPO_MAP.md), this doc, and the relevant backlog row.

---

## Required Checks By Change Type

| Change Type | Checks |
| --- | --- |
| Docs only | `npm run check:docs`, `npm run check:hygiene` |
| TypeScript or React Native | Docs checks plus `npm run lint`, `npm run typecheck`, `npm run check:unsafe-any`, `npm run check:risk-guardrails`, `npm run check:circular-deps` |
| Native config, route, or environment | `npm run check:platform`, `npm run check:release` |
| Release or migration flow | `npm run check:release` |
| Mobile performance-sensitive flow | `npm run check:hygiene`, `npm run typecheck`, targeted device smoke test |
| Security/backend behavior | `npm run check:hygiene`, `npm run check:architecture`, `npm run typecheck`, relevant manual RLS/release checks |
