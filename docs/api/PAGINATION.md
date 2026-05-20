# Pagination

Pagination owns list-loading rules for feed, saved content, comments, search results, and future dashboards.

## Rules

- Prefer cursor-based pagination for Supabase-backed user content.
- Keep client-side slicing for small local/demo collections only.
- Maintain stable item order between refreshes.
- Show loading-more, empty, and end states distinctly.
- Avoid unbounded provider calls from scroll events.

## Current Helpers

| Helper | Role |
| --- | --- |
| [../../lib/hooks/usePagedList.ts](../../lib/hooks/usePagedList.ts) | Client-side visible/load-more helper. |
| [../../lib/hooks/useSavedPosts.ts](../../lib/hooks/useSavedPosts.ts) | Cursor-based saved posts pagination. |
| [../../lib/hooks/useLikedPosts.ts](../../lib/hooks/useLikedPosts.ts) | Cursor-based liked posts pagination. |

## Review Triggers

Update this doc when changing pagination defaults, page sizes, cursor fields, or list-loading behavior.

