# ADR 0020 — Ubiquitous Language: place, post, collection, save

**Status:** Accepted  
**Date:** 2026-06-15  
**Deciders:** Roy Zheng

## Context

Rekkus accumulated seven naming inconsistencies across DB, services, types, routes, UI copy, tests, and docs as the product evolved:

| Layer | Old term | Problem |
| --- | --- | --- |
| DB table | `restaurants` | "Restaurant" is a food-establishment subtype, not the canonical Rekkus entity (a "place" covers cafés, food courts, pop-ups, etc.) |
| DB table | `saved_locations` | "Location" is a geographic concept, not a saved domain entity |
| UI copy / feature | "bookmark" | Mixed with "save" — two words for one action |
| UI label | "Lists" | Shadowed by iOS/Android system lists; misread as read-only |
| UI copy | "review" (for UGC) | Implied star-rating editorial content; Rekkus posts are richer and subjective |
| Code | `restaurantId` (camelCase FK) | Domain FK should match canonical entity name |
| Code | `SavedLocation` / `useSavedLocations` | Should match the renamed table |

## Decision

Establish one canonical word per concept across every layer — database through docs:

| Concept | Canonical term | Eliminated terms |
| --- | --- | --- |
| Food establishment | **place** | restaurant, location, venue |
| User-created save grouping | **collection** | list |
| Save action / section | **save / saved** | bookmark, favourite |
| User-generated content | **post** | review |
| Profile featured places | **top spots** | (unchanged) |
| Internal UUID FK to places | **placeId** | restaurantId |
| Google Places external ID | **googlePlaceId** | placeId (old overloaded usage) |

## Intentional exceptions

The following audit/compliance tables are **never renamed** — their `restaurant_` prefix maps to the old canonical name and must be preserved for regulatory audit trails and foreign-key immutability in migration history:

- `restaurant_audit_events`
- `restaurant_sources`
- `restaurant_provider_cache`
- `restaurant_aliases`
- `restaurant_merge_events`
- `restaurant_observations`
- `restaurant_ownership_events`

Their `restaurant_id` FK columns also keep that name. A comment in migration `20260614000001_rename_restaurants_to_places.sql` explains the historical naming.

## Consequences

### Positive
- Single word per concept makes the codebase searchable, reviewable, and onboard-able without a glossary lookup
- DB, service, domain type, route, and UI copy all agree — reduces translation bugs at layer boundaries
- `googlePlaceId` is no longer ambiguous with the internal UUID `placeId`

### Negative
- ~1 500 rename occurrences across migrations, services, types, features, tests, and docs (one-time cost)
- Infra tables retain `restaurant_` prefix — requires an exception comment in docs and any audit of these tables

## Related

- [ADR 0002](0002-provider-independent-restaurant-graph.md) — original "restaurant graph" design; historical naming retained in that ADR for accuracy
- Migration `20260614000001_rename_restaurants_to_places.sql` — DB execution record
- `docs/architecture/NAMING.md` — live naming rules including the infra-table exception
- `design/UX_Copywriting_Guide.md` — canonical term list for UX copy
