# Lessons: Shared Components

## Never re-implement UI that already exists in components/

Before writing any icon, badge, rating display, or profile block — check `components/` first.

| Need                        | Import from                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| Any SVG icon                | `@/components/icons`                                                 |
| User avatar initials circle | `@/components/Avatar`                                                |
| Star or dollar rating       | `@/components/RatingDisplay` (`Stars`, `Dollars`, `PostRatingStrip`) |
| Open / Closed pill badge    | `@/components/OpenBadge`                                             |
| Profile header block        | `@/components/ProfileHeader`                                         |

**Why:** Every time an inline icon or badge was defined in a screen, it drifted from the version in another screen. Inconsistencies compound silently. Shared components make visual consistency free.

## Use design-system primitives for chips and empty states

New chips, pills, filters, quick starts, and compact selectable actions must use `components/ui/Chip.tsx`. Empty tabs, empty lists, and no-result states must use `components/ui/EmptyState.tsx`.

New screen styles should use `spacing`, `radius`, and semantic typography presets instead of raw padding, radius, font size, weight, or line height values. `check:design` blocks reintroduced custom chip and empty-state patterns, and `check:tokens` blocks raw token values across `features/` and `components/`.

---

## `PostRatingStrip` replaces all emoji ratings

Anywhere a post's food / vibe / cost rating is shown, use:

```tsx
import { PostRatingStrip } from '@/components/RatingDisplay'
;<PostRatingStrip food={post.food} vibe={post.vibe} cost={post.cost} />
```

Never write `🍴{post.food}`, `🎭{post.vibe}`, or `'$'.repeat(post.cost)` in JSX.

---

## Prefer context-preserving launchers for tab actions

The central Create `+` should open a Rekkus sheet over the screen the user is viewing. Do not rely on focusing an already-mounted tab screen to decide whether to resume drafts or start fresh; tab state can silently bypass the user's expected choice.

## Keep ranking invisible and UI simple

Restaurant tagging and search can rank by relevance, popularity, distance, and Rekkus-owned signals, but the UI should stay as one clean list unless the user explicitly opens filters. Do not expose internal ranking buckets as visible sections.

## Rekkus Picks are the user-facing rating language

New create, feed, and post-detail surfaces should show Taste, Value, and Occasion. Food/Vibe/Cost remain compatibility fields for old data and aggregates, not primary UI.

## Dark mode maps still need colour

Dark mode is not grayscale mode. Keep water blue, parks green, roads warm, labels readable, and markers high-contrast so Places remains useful at night.

---

## `OpenBadge` replaces all inline open/closed badge styles

```tsx
import { OpenBadge } from '@/components/OpenBadge'
{
  hasOpenInfo && <OpenBadge openNow={isOpen} />
}
```

Never copy the `openBadge*` style block into a new screen.

---

## `PostCardSkeleton` replaces `ActivityIndicator` for feed loading

Use `PostCardSkeleton` when the Following feed is loading (`!followingLoaded`). Never use `ActivityIndicator` as a content-level loading placeholder: it is appropriate for action buttons (submit, send) and pagination scroll footers, while `<EmptyState loading>` is reserved for blocking waits that have no useful content silhouette.

```tsx
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton'

{!followingLoaded ? (
  <View style={styles.feedList}>
    {Array.from({ length: 4 }).map((_, i) => <PostCardSkeleton key={i} />)}
  </View>
) : (
  // render actual posts
)}
```

Four skeletons fill a typical iPhone viewport (~880px) without leaving blank space below the fold.

## Failed upload UX requires explicit recovery

When an upload fails, users must see an actionable recovery path — not just a dismiss button. `PostUploadProgress` shows "Go to draft" (navigates to the create tab + clears the failed job) alongside a dismiss X. `CreatePostSheets` shows a "Try again" option in the draft notice when a retry handler is provided.

Never add a failed upload state with only `clearJob()` as the action. Always surface at minimum a navigation path back to the create screen.
