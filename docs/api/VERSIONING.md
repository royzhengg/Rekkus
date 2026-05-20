# API Versioning

API versioning owns how Rekkus evolves service contracts, Edge Functions, and database-backed APIs without breaking clients.

## Current Rule

Pre-MVP uses additive changes, typed service wrappers, and migrations instead of public API versioning. Versioned external APIs are not required until Rekkus exposes stable public or partner APIs.

## Compatibility Rules

- Prefer additive columns and optional fields.
- Keep route and service names stable.
- Add migrations rather than editing historical migrations.
- Deprecate old fields with a documented replacement before removing usage.
- Edge Function payload changes should remain backward compatible during beta.

## When To Introduce Explicit Versions

Add explicit API versions when:

- External clients or partners depend on contracts.
- Restaurant owner tooling requires stable APIs.
- Breaking payload changes cannot be avoided.

Record durable versioning decisions as ADRs.

