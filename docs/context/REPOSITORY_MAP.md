# Repository Map

Decision table: I need to… → Put it in…

| I need to… | Put it in… |
|---|---|
| Add a feature screen | `features/<domain>/<ScreenName>.tsx` |
| Add a reusable UI primitive | `components/ui/<ComponentName>.tsx` |
| Add a cross-feature UI component | `components/<ComponentName>.tsx` |
| Add a reusable hook | `lib/hooks/use<Name>.ts` |
| Add a React context / provider | `lib/contexts/<Name>Context.tsx` |
| Add a read query (Supabase) | `lib/services/<domain>/queries.ts` |
| Add a write mutation (Supabase) | `lib/services/<domain>/mutations.ts` |
| Add a DB-row type alias | `lib/types/<domain>.ts` |
| Add a product domain type | `types/domain.ts` |
| Add a DB migration | `supabase/migrations/<timestamp>_<description>.sql` |
| Change the schema | Edit files in `supabase/schema/` then regenerate `schema.sql` |
| Document a business invariant | `docs/domains/<domain>/invariants.md` |
| Record an architecture decision | `docs/adr/ADR-<NNN>-<slug>.md` |
| Add a unit test | `tests/unit/<mirrors-src-path>.test.ts(x)` |
| Add a type-safety test | `tests/type-safety/<name>.test.ts` |
| Define analytics event constants | `lib/analytics/events.ts` |
| Add a design spec or copy rule | `design/DESIGN_SPEC.md` or `design/UX_Copywriting_Guide.md` |
