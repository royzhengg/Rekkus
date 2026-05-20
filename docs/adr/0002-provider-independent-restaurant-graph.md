# ADR 0002: Provider-Independent Restaurant Graph

## Status

Accepted

## Context

Repeated provider calls are costly and make Rekkus dependent on external maps/place systems. Rekkus needs restaurant identity, dish graph, taste graph, saves, corrections, and ranking to work from its own data first.

## Decision

`restaurants.id` is the canonical Rekkus restaurant ID. External IDs live in `restaurant_sources`; provider snapshots live in `restaurant_provider_cache`; first-party facts live in `restaurant_observations`; duplicate and merge hints live in `restaurant_aliases`; canonical mutations are recorded in `restaurant_audit_events`.

Lookup order is canonical Rekkus data, aliases/sources, trusted observations, provider cache, compliant open/cheap provider, and Google fallback.

## Consequences

- Google remains useful for fallback and bootstrapping, but not as canonical truth.
- Future OSM, owner-submitted, admin-created, or alternative provider data can be added without changing restaurant identity.
- Provider-derived fields need promotion rules before becoming canonical.
