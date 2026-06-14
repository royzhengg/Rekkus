---
name: create-feature
description: Systematically create a new feature in Rekkus end-to-end — clarify, research, plan, implement, validate, and update docs. Use when user wants to build a new feature, implement a backlog item, add functionality, or says "create feature", "build this", or "implement X".
---

# Create Feature

## 1. Clarify (do not skip)

Ask before writing any code:

- What does this feature do? Who is the user?
- What are the acceptance criteria (what does "done" look like)?
- Which BACKLOG.md section does it belong to?
- Any known constraints (DB schema, existing APIs, platform limits)?

Do not proceed until these are answered.

## 2. Research

Read in this order:

1. `AGENTS.md` — execution principles and repo rules
2. `BACKLOG.md` — current priorities and any related work
3. Relevant `docs/` — architecture, security, product docs for the area
4. Existing code — components, hooks, services that can be **reused** (prefer reuse over new code)

If DB is involved: read `supabase/schema.sql`.
If animations are involved: read `lib/animations.ts`.

## 3. Reserve Backlog ID

1. Read `backlog-counter.md` — get the next available ID
2. Increment it immediately (claim the ID)
3. Add a stub row to `BACKLOG.md` in the correct section

Never invent an ID without going through `backlog-counter.md`.

## 4. Plan

Enter Plan mode. Design as **vertical slices** — each slice is thin but end-to-end demoable.

Repo rules to enforce in the plan:
- `app/` — Expo Router wrappers only; no logic
- `features/` — screen implementations and feature-local components
- `components/ui/` — reusable primitives, no business logic
- `components/` — cross-feature shared UI
- `lib/services/` — Supabase, Google, Expo, network calls
- `lib/hooks/` — reusable hooks
- `lib/contexts/` — React providers
- `types/domain.ts` — app-facing domain types

No new dependencies without clear justification.

## 5. Implement

Execute the approved plan. Follow the checklist in [CHECKLIST.md](CHECKLIST.md).

## 6. Analytics (never defer)

Every feature must ship with its analytics events in the same PR:

- Screen/component impression event
- Primary interaction events (taps, submissions)
- Exit/dismiss events

Add them via `lib/analytics.ts`. See `docs/analytics/ANALYTICS.md` for event naming conventions.

## 7. Validate

```
npm run validate
```

If touching unsafe-input guards, provider parsing, scanner rules, or Edge Function payload guards:

```
npm run test:type-safety
```

Fix all errors before marking done.

## 8. End-of-Task Checklist

- [ ] BACKLOG.md — mark item shipped; insert discovered work in the right section
- [ ] Route/folder change → update `docs/architecture/ARCHITECTURE.md` and `REPO_MAP.md`
- [ ] Auth/storage/backend → update `docs/security/SECURITY.md`
- [ ] Product behaviour → update `product/FEATURES.md` + matching product doc
- [ ] Analytics/feed/search → update `docs/analytics/ANALYTICS.md` or `product/SEARCH.md`
- [ ] Design/copy → update `design/DESIGN_SPEC.md`
- [ ] Durable architecture decision → write ADR in `docs/adr/`
- [ ] Non-obvious decisions → record in `docs/lessons/<topic>.md`
