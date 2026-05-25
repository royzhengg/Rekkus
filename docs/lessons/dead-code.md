# Lessons: Dead Code

## Expo template files must be deleted at project setup

`EditScreenInfo`, `ExternalLink`, `StyledText`, `Themed`, `useColorScheme`, `useClientOnlyValue` are Expo template artifacts. They conflict with the app's theme system and confuse new engineers. Delete them during project initialisation — never leave them in place.

## Knip phase 2: unused exports are caught via per-file ignoreIssues baseline

Knip v6 has no `ignoreExports` config field. The correct mechanism for a per-file export ratchet baseline is `ignoreIssues`: map specific file paths to `['exports', 'types']` to suppress those categories for that file only. Add `types/database.ts` to the `entry` array instead — knip cannot trace indexed-type access (`Database['public']['Tables']['foo']['Row']`) so generated type files appear as false positives without this.

When enabling phase 2: (1) add `types/database.ts` to `entry`, (2) remove `export` from any module-internal symbols that leaked it, (3) run `knip` and add each still-flagged file to `ignoreIssues` as a dated baseline, (4) remove `'exports'` and `'types'` from `exclude`. New files and new violations in non-baselined files are caught immediately. Clear baseline entries as features are wired — imports make exports live automatically.

## Feature flags defined but never gated are decorative

A flag in `lib/featureFlags.ts` with no `isEnabled()` call site provides zero kill-switch value — the feature always ships regardless of the flag value or any Supabase override. Every flag must have at least one `isEnabled()` gate at its feature entry point (screen guard, hook early-return, or service branch). `check:stale-flags` enforces this and is part of `check:hygiene` and CI. When a feature becomes permanently on with no rollback path, delete its flag rather than leaving it as metadata.
