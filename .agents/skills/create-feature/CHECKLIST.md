# Create Feature — Implementation Checklist

Use this during Step 5 (Implement). Tick off each item as you complete it.

## Before Writing Code

- [ ] Acceptance criteria agreed with user
- [ ] Backlog ID reserved in `backlog-counter.md` and stub added to `BACKLOG.md`
- [ ] Plan approved in Plan mode
- [ ] Existing components/hooks/services checked for reuse
- [ ] `supabase/schema.sql` read (if DB involved)
- [ ] `lib/animations.ts` read (if animations involved)

## File Placement

- [ ] Router wrappers only in `app/` (no logic)
- [ ] Screen implementations in `features/<feature-name>/`
- [ ] Reusable primitives in `components/ui/` (no business logic)
- [ ] Cross-feature shared UI in `components/`
- [ ] Supabase/network calls in `lib/services/`
- [ ] Reusable hooks in `lib/hooks/`
- [ ] React providers in `lib/contexts/`
- [ ] App-facing types in `types/domain.ts`
- [ ] No imports of `lib/mocks` from `app/` or `features/`

## Animations (if applicable)

- [ ] Spring tokens from `lib/animations.ts` — no inline spring configs
- [ ] 120Hz rules respected (no JS-thread animations on scroll)
- [ ] No legacy `Animated` API — use Reanimated

## Analytics

- [ ] Screen impression event added
- [ ] Primary interaction events added (taps, submissions, selections)
- [ ] Exit/dismiss events added
- [ ] Events follow naming conventions in `docs/analytics/ANALYTICS.md`
- [ ] Events fire via `lib/analytics.ts`

## Quality

- [ ] No new dependency added without clear justification
- [ ] `npm run validate` passes (or `npm run validate:full` for PR handoff)
- [ ] `npm run test:type-safety` passes (if touching input guards or Edge Functions)
- [ ] No `console.log` or debug code left in

## Documentation

- [ ] BACKLOG.md — item marked shipped; discovered work inserted
- [ ] ARCHITECTURE.md + REPO_MAP.md updated (if route/folder changed)
- [ ] SECURITY.md updated (if auth/storage/backend touched)
- [ ] product/FEATURES.md updated (if product behaviour changed)
- [ ] ANALYTICS.md updated (if new analytics events added)
- [ ] ADR written (if durable architecture decision made)
- [ ] `docs/lessons/<topic>.md` updated (if non-obvious decision/tradeoff)
