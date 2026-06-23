# Rekkus — Ubiquitous Language Glossary

One word per concept, everywhere: DB → services → types → routes → UI copy → docs.

Update this file whenever a canonical term is added, changed, or an exception is granted.

---

## Canonical Domain Terms

| Concept | Canonical term | Layer usage | Eliminated terms |
| --- | --- | --- | --- |
| Food establishment | **place** | `places` table · `place_id` FK · `/places/[placeId]` route · `Place` TS type · "Place" in UI | restaurant, location, venue, spot |
| Save action / saved items | **save / saved** | `saved_places`, `saved_dishes`, `saves` tables · `handleSave()` · "Save" in UI | bookmark, favourite |
| User-organised save group | **collection** | `collections` table · "Collections" tab label | list |
| User-generated content unit | **post** | `posts` table · `Post` TS type · "Post" in UI | review |
| Profile featured places | **top spots** | `user_top_spots` table · "Top Spots" in UI | (unchanged) |
| Internal UUID FK to a place | **placeId** | FK columns (`place_id`) · TS type fields · RPC params (`p_place_id`) | restaurantId |
| Google Places external ID | **googlePlaceId** | `places.google_place_id` column · TS field · provider source records | placeId (old overloaded usage) |

---

## Intentional Exceptions — Historical Infrastructure Tables

The following tables and their `restaurant_id` FK columns keep the `restaurant_` prefix permanently and must **not** be renamed:

| Table | Purpose |
| --- | --- |
| `restaurant_audit_events` | Append-only audit trail for place graph changes |
| `restaurant_sources` | Provider provenance (Google, OSM, owner/user/admin) |
| `restaurant_provider_cache` | TTL-governed provider snapshots |
| `restaurant_aliases` | Duplicate, old-ID, and alternate-name hints |
| `restaurant_merge_events` | Canonical merge history with rollback references |
| `restaurant_observations` | First-party user/system facts awaiting trust or promotion |
| `restaurant_ownership_events` | Claim, approval, transfer, and removal history |

**Rationale:** Immutable append-only audit tables. Renaming breaks rollback references, migration history, and compliance retention. DB functions that write exclusively to these tables (e.g. `record_restaurant_provider_snapshot`) fall under the same exception and also retain `restaurant_` in their names and parameter names.

See [ADR 0020](adr/0020-ubiquitous-language-place-post-collection.md) for the full decision record.

---

## Search Stop Words

`VENUE_CATEGORY_TERMS` in `lib/utils/searchScoring.ts` and `lib/utils/searchIntent.ts` retain `'restaurant'` / `'restaurants'` as **user-input matching stop words** — these reflect what people type into the search box, not the domain entity name. Do not remove them.

Similarly, Google Places API type strings (`'restaurant'`, `'food'`, `'cafe'`, etc.) appear in provider-integration code and must remain verbatim.

---

## Related References

| Resource | Covers |
| --- | --- |
| [docs/architecture/NAMING.md](architecture/NAMING.md) | Naming conventions: snake_case, PascalCase, route patterns, infra exception list |
| [docs/adr/0020-ubiquitous-language-place-post-collection.md](adr/0020-ubiquitous-language-place-post-collection.md) | Decision rationale, consequences, historical context |
| [design/UX_Copywriting_Guide.md](../design/UX_Copywriting_Guide.md) | British English, "Tap" not "Click", full caps for status labels |
| [docs/analytics/ANALYTICS.md](analytics/ANALYTICS.md) | Event taxonomy (`place_view`, `post_save`, etc.) |
