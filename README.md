# Rekkus

Rekkus is a React Native + Expo food discovery app backed by Supabase, Google Places, and Expo services.

## Quick Start

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`
3. Fill the public Expo values in `.env`
4. Start locally: `npm run start`

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run start` | Start Expo |
| `npm run ios` | Run iOS native build |
| `npm run android` | Run Android native build |
| `npm run lint` | Lint TypeScript/React Native files |
| `npm run typecheck` | Typecheck app code |
| `npm run check:platform` | Verify platform config and iOS/Android guardrails |
| `npm run check:docs` | Verify markdown links |
| `npm run check:hygiene` | Verify source hygiene and safety rules |
| `npm run check:release` | Run release-oriented static checks |

## Environments

`EXPO_PUBLIC_APP_ENV` must be one of `development`, `staging`, `beta`, or `production`.

`EXPO_PUBLIC_DATA_MODE` must be one of `mock`, `mixed`, or `live`. Beta and production builds must use `live`.

All `EXPO_PUBLIC_*` values are public client values. Never put service-role keys, SMTP secrets, or private provider secrets in Expo public env vars.

## Doc Map

- Root authority:
  - [PRODUCT.md](PRODUCT.md): strategic product truth
  - [BACKLOG.md](BACKLOG.md): execution order and operational roadmap
  - [AGENTS.md](AGENTS.md): canonical AI/operator guide
  - [AI_RULES.md](AI_RULES.md): AI philosophy and constraints
  - [REPO_MAP.md](REPO_MAP.md): fast navigation and ownership map
  - [CLAUDE.md](CLAUDE.md): compatibility shim to `AGENTS.md`
- Root specialized docs kept temporarily until their later operating folders are complete: [CONTRIBUTING.md](CONTRIBUTING.md)
- Operations docs: [operations/README.md](operations/README.md), [operations/RELEASE.md](operations/RELEASE.md), [operations/BETA.md](operations/BETA.md)
- Reference docs: [docs/README.md](docs/README.md), [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md), [docs/security/SECURITY.md](docs/security/SECURITY.md), [docs/analytics/ANALYTICS.md](docs/analytics/ANALYTICS.md), [docs/LESSONS.md](docs/LESSONS.md)
- Business docs: [business/README.md](business/README.md)
- Product behavior docs: [product/README.md](product/README.md), [product/FEATURES.md](product/FEATURES.md), [product/FEED.md](product/FEED.md), [product/SEARCH.md](product/SEARCH.md)
- Design docs: [design/README.md](design/README.md), [design/DESIGN_SPEC.md](design/DESIGN_SPEC.md), [design/UI_LIBRARY.md](design/UI_LIBRARY.md), [design/UX_Copywriting_Guide.md](design/UX_Copywriting_Guide.md)

Authority order: `PRODUCT.md` → `BACKLOG.md` → `AGENTS.md` → specialized docs.

## Documentation Governance

- Root docs are reserved for authority entrypoints and temporary specialized docs that have not moved into `docs/`, `operations/`, or `business/` yet.
- Extend an existing doc before creating a new one.
- Move domain docs into their owner folder instead of adding more root markdown.
- Archive or mark stale docs when they are superseded.
- Meaningful changes must update docs in the same change: architecture changes update architecture/repo-map docs, product behavior changes update `product/`, design changes update `design/`, release/env changes update `operations/`, and security changes update `docs/security/SECURITY.md`.
