---
name: ambitious-refactoring
description: Guides agents to favor correct end-state architecture over cautious compatibility work. Use when planning or implementing refactors, schema changes, domain restructuring, migrations, API moves, or when the user says to be ambitious, avoid half-measures, remove shims, break things, or do it properly.
---

# Ambitious Refactoring

Use this skill when architecture work benefits from a clean, coordinated end state instead of cautious compatibility layers.

## Core Principle

This project values a clean, correct end state over cautious compatibility work.

When the user asks for architecture work, schema redesign, domain slicing, API moves, or "do it properly," assume they are comfortable with coordinated breaking changes on the branch. Do not preserve old shapes just because they already exist.

## Default Stance

- Prefer the better model, even if it breaks current imports, generated API paths, tests, or data shape.
- Avoid half-right transitional code unless it is explicitly needed for a production migration step.
- Do not keep export shims, compatibility wrappers, duplicate sources of truth, or legacy fields by default.
- If a concept has moved domains, move the implementation and callers. Do not leave a facade that secretly delegates to the old location.
- If schema semantics are wrong, change the schema and add a migration path. Do not contort new code around old fields.
- After breaking changes, update all callers, tests, generated types, and directly affected docs.

## Compatibility Rule

Compatibility is not automatically valuable in this repo.

Preserve compatibility only for:

- A deployed production transition that needs a clear temporary migration sequence.
- External integrations that cannot be changed in the same branch.
- A user-requested incremental rollout.

Otherwise, remove legacy paths in the same change. A branch can break while it is being reshaped; the final branch should be internally coherent.

## Migration Mindset

This app is small enough that production data can be molded during release.

For Convex schema changes:

1. Design the target schema first.
2. Update code to use the target schema as the source of truth.
3. Add explicit migrations for existing production data.
4. Remove old fields and old code paths once the migration path exists.

Do not keep old fields around just because code used to read them.

## Shims And Re-exports

Treat export shims as a smell.

Bad default:

```ts
// Old location after the implementation moved.
export * from "../domains/newOwner/api";
```

Better default:

- Move callers to the new domain path.
- Delete the old file.
- Regenerate Convex types.
- Run build and tests.

Use a shim only when the user explicitly wants a staged migration.

## Domain Refactors

When moving toward domain slices:

- The owning domain should contain the implementation, not just an `api.ts` facade.
- Cross-domain imports should point at the owning domain's explicit module.
- Root-level Convex public modules should not remain as hidden implementation owners after a domain move.
- Shared code should stay in `convex/shared/` only if it is truly generic kernel code used across domains or frontend/backend boundaries.

## Validation Expectations

After ambitious restructuring:

- Run `npx convex codegen`.
- Run `npm run build`.
- Run `npm test` when behavior or tests are affected.
- Check lints for edited files.
- Fix failures by completing the move, not by restoring old compatibility unless there is a real migration need.

## How To Communicate

Be direct about breaking changes.

Say what changed, what old path or field was removed, what migration is needed, and what validation passed. Do not apologize for breaking old shapes when the new shape is intentional.
