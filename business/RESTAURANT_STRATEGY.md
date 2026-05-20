# Restaurant Strategy

Purpose: define how restaurants eventually become active participants in Rekkus.

## Current Direction

- Start with user-generated restaurant value.
- Add claiming, metadata correction, analytics, and first-party content after user engagement proves demand.
- Keep restaurant tools lightweight until operational support exists.

## First-Party Data Slice

- Users can create a restaurant record when provider lookup is unavailable; `create_user_restaurant` records provenance, source, and audit evidence.
- Restaurant detail pages expose bounded actions for edit suggestions, duplicate reports, community verification, and ownership claims.
- Duplicate reports and metadata corrections collect evidence only; canonical edits and merges remain human-reviewed through the admin/data governance workflow.
- Rekkus post photos and Rekkus food ratings take precedence over Google photos and ratings. Google remains fallback enrichment, not canonical restaurant truth.
