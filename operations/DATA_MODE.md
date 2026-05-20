# Data Mode Governance

Owner: Engineering

`EXPO_PUBLIC_DATA_MODE` is the boundary between demo behavior and live release behavior.

## Modes

| Mode | Use | Mock data allowed |
| --- | --- | --- |
| `mock` | Local demos and isolated UI work | Yes |
| `mixed` | Development with local mocks plus live services as needed | Yes |
| `live` | Staging, beta, and production release candidates | No |

## Runtime Contract

- `lib/config.ts` owns `DATA_MODE`, `ALLOW_MOCK_DATA`, and `IS_LIVE_DATA`.
- Data-source selection belongs behind `lib/dataSources/` and service boundaries.
- `lib/mocks/` is allowed for demo fixtures only.
- `app/` and `features/` must not import `lib/mocks/` directly.
- Staging, beta, and production release checks must use `EXPO_PUBLIC_DATA_MODE=live`.

## Guardrails

- `scripts/check-hygiene.js` blocks direct mock imports from route and feature surfaces.
- `scripts/check-hygiene.js` blocks beta/prod runs that are not using live data.
- `scripts/ops/check-operations.js` validates this governance doc, runtime config, and hygiene coverage.

## Release Review

Before beta or production, confirm:

- No fixture-only screens are reachable in live mode.
- Release notes identify any intentional demo or fallback behavior.
- Service failures degrade through product-owned empty states instead of mock content.
