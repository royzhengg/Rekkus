# Lessons Learnt — Rekkus

Rules and patterns we've discovered the hard way. Apply these from the start on any new feature.

---

## Architecture

### Extract data fetching into custom hooks

Never write Supabase queries directly inside screen components. Put them in `lib/hooks/useXxx.ts`. Screens render UI; hooks fetch data.

**Pattern:**

```ts
// lib/hooks/useSavedLocations.ts
export function useSavedLocations(userId: string | undefined) {
  // all fetch logic here
  return { savedLocations, error, refresh }
}
// screen: const { savedLocations } = useSavedLocations(user?.id)
```

**Why:** When queries are inline, they're hard to test, hard to reuse, and the screen file grows unmanageable. Hooks also make it trivial to swap Supabase for a different backend later.

---

### Always handle errors from Supabase

Every query must check `error` and surface it. Silent failures make debugging impossible.

**Pattern:**

```ts
const { data, error } = await supabase.from('table').select(...)
if (error) { setError(error.message); return }
```

**Why:** Supabase can fail for many reasons (RLS, network, schema changes). Without an error state the user sees nothing and you have no signal.

---

### Add `.limit()` to every query from the start

Every Supabase query must have an explicit limit. Use `100` as a default cap; bump when adding pagination.

```ts
.select('...').eq('user_id', userId).limit(100)
```

**Why:** Unbounded queries return everything in the table as the dataset grows. Adding limits later requires finding every query across the codebase.

---

## Performance

### Wrap list-item components in `React.memo`

Any component rendered inside a list (map, FlatList, etc.) should be memoized.

```tsx
const PostCard = React.memo(function PostCard({ post, colWidth }) { ... })
```

**Why:** Without memo, a parent state change (e.g. tab switch, theme toggle) re-renders every card even if nothing about the card changed.

---

### Use `useCallback` for handlers passed to memoized children

`React.memo` is useless if the props passed to the child are new references every render.

```tsx
const navigateTo = useCallback((loc) => { ... }, [router])
// pass as: onPress={navigateTo}
```

**Why:** An inline `onPress={() => navigateTo(loc)}` creates a new function every render, defeating the memo.

---

### Use `react-native-reanimated` for all animations — never `Animated` from react-native

Reanimated runs on the UI thread; `Animated` runs on the JS thread.

```tsx
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
const slideY = useSharedValue(300)
slideY.value = withSpring(0, { damping: 20, stiffness: 180 })
const style = useAnimatedStyle(() => ({ transform: [{ translateY: slideY.value }] }))
```

**Why:** JS-thread animations stutter during any JS work (navigation, data fetching). UI-thread animations are guaranteed 60fps.

---

### Wrap icon components in `React.memo`

Standalone icon functions that call `useThemeColors()` should be memoized at the module level.

```tsx
const BellIcon = React.memo(function BellIcon() {
  const colors = useThemeColors()
  return <Svg ...>
})
```

**Why:** Icon components defined as plain functions recreate on every render of the parent. In a tab bar or list header this fires constantly.

---

### `useMemo` for computed/derived values used in render

Any value computed from state that's used in JSX or passed to a child should be memoized.

```tsx
const validLocations = useMemo(
  () => savedLocations.filter(l => l.restaurants?.latitude != null),
  [savedLocations]
)
```

---

## Native / Maps

### Google Maps on iOS requires THREE things — all must be present

1. `iosGoogleMapsApiKey` (not `googleMapsApiKey`) in the react-native-maps plugin config in `app.json`
2. `pod 'react-native-maps/Google'` in `ios/Podfile`
3. `GMSServices.provideAPIKey(...)` called in `AppDelegate.swift` before any other setup

Missing any one of these causes a blank/white/black map with no error message.

---

### Always keep `MapView` mounted — never conditionally render it

Use `opacity: 0` + `pointerEvents: 'none'` to hide it, not conditional rendering or `display: 'none'`.

```tsx
<View style={[StyleSheet.absoluteFill, isHidden && { opacity: 0 }]} pointerEvents={isHidden ? 'none' : 'auto'}>
  <MapView ... />
</View>
```

**Why:** `MapView` needs to initialise with real dimensions. Conditional rendering gives it zero size on first mount → blank tiles. `display: 'none'` removes it from the native hierarchy → same problem.

---

### Add `tracksViewChanges={false}` to all `<Marker>` components

```tsx
<Marker coordinate={...} tracksViewChanges={false} onPress={...} />
```

**Why:** The default (`true`) causes every marker to re-render on every frame, tanking FPS on maps with many pins.

---

## Supabase Queries

### Parallelise independent queries with `Promise.all`

```ts
const [likesRes, commentsRes] = await Promise.all([
  supabase.from('likes').select(...),
  supabase.from('comments').select(...),
])
```

**Why:** Sequential awaits add latency equal to the sum of all requests. Independent queries should always run in parallel.

---

## Styling

### Always use `useMemo(() => makeStyles(c), [c])` — never module-level StyleSheet with colours

```tsx
const colors = useThemeColors()
const styles = useMemo(() => makeStyles(colors), [colors])
```

**Why:** Module-level `StyleSheet.create` with colour tokens runs once at import time and never updates. Theme changes and dark mode won't apply.

---

## Shared Components

### Never re-implement UI that already exists in components/

Before writing any icon, badge, rating display, or profile block — check `components/` first.

| Need                        | Import from                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| Any SVG icon                | `@/components/icons`                                                 |
| User avatar initials circle | `@/components/Avatar`                                                |
| Star or dollar rating       | `@/components/RatingDisplay` (`Stars`, `Dollars`, `PostRatingStrip`) |
| Open / Closed pill badge    | `@/components/OpenBadge`                                             |
| Profile header block        | `@/components/ProfileHeader`                                         |

**Why:** Every time an inline icon or badge was defined in a screen, it drifted from the version in another screen. Inconsistencies compound silently. Shared components make visual consistency free.

---

### `PostRatingStrip` replaces all emoji ratings

Anywhere a post's food / vibe / cost rating is shown, use:

```tsx
import { PostRatingStrip } from '@/components/RatingDisplay'
;<PostRatingStrip food={post.food} vibe={post.vibe} cost={post.cost} />
```

Never write `🍴{post.food}`, `🎭{post.vibe}`, or `'$'.repeat(post.cost)` in JSX.

---

### `OpenBadge` replaces all inline open/closed badge styles

```tsx
import { OpenBadge } from '@/components/OpenBadge'
{
  hasOpenInfo && <OpenBadge openNow={isOpen} />
}
```

Never copy the `openBadge*` style block into a new screen.

---

## Hook Declaration Order

### Declare `useMemo`/`useCallback` dependencies before the hook that uses them

```tsx
// ✓ correct
const validLocations = useMemo(() => ..., [savedLocations])
const zoom = useCallback(() => {
  const center = validLocations[0] // safe — declared above
}, [selectedLocation, validLocations])

// ✗ wrong — zoom callback references validLocations before its declaration
const zoom = useCallback(() => { ... }, [validLocations])
const validLocations = useMemo(...)
```

**Why:** JavaScript hoists `const` to temporal dead zone — referencing it before declaration throws at runtime. TypeScript may not catch this.

---

## Utilities / Config

### Never duplicate utility functions — centralise at first reuse

`parseLikes`, `todayHoursIndex`, `avatarPalette` were each defined in 3–4 files before being extracted. The rule: as soon as a function appears in a second file, move it to `lib/utils/` and import it everywhere.

---

### Never use `process.env` directly in screens or hooks

Always read env vars from `lib/config.ts`:

```ts
// lib/config.ts
export const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? ''

// screens/hooks
import { GOOGLE_PLACES_KEY } from '@/lib/config'
```

`process.env` was scattered across 4 files before centralisation. Finding and updating keys became a search problem.

---

## Services Layer

### Supabase calls belong in `lib/services/`, not in screens

Screens that query Supabase directly can't be tested, reused, or mocked. All database operations go in typed service functions:

```ts
// lib/services/posts.ts
export async function likePost(postId: string, userId: string): Promise<void> { ... }

// screen
import { likePost } from '@/lib/services/posts'
```

---

## Analytics

### All analytics calls go through `lib/analytics.ts`

Never call `supabase.from('analytics_events')` directly in screens. The abstraction:

- makes event schema changes a single-file update
- lets analytics be swapped out without touching every screen
- prevents analytics from crashing the app (errors are caught internally)

---

## Design System

### Magic numbers in styles accumulate into inconsistency

When font sizes, spacing, and border radii are hardcoded per screen, they drift. After 10 screens the padding on a card is 16 in one place and 18 in another. Fix: import from `constants/Typography`, `constants/Spacing`, `constants/Colors` — one value, used everywhere.

---

### `ScreenHeader` replaces the repeated 56px topBar pattern

The `topBar` style block (height 56, paddingH 16, borderBottom) was copy-pasted into 9 screens. Now use `components/ui/ScreenHeader`:

```tsx
<ScreenHeader title="@username" left={<BackBtn />} right={<SettingsIcon />} />
```

---

### `ThumbGrid` replaces duplicated 3-col photo grids

The thumbnail grid was copy-pasted between `profile.tsx` and `user/[username].tsx`. It now lives in `components/ThumbGrid.tsx` and is imported by both.

---

## Dead Code

### Expo template files must be deleted at project setup

`EditScreenInfo`, `ExternalLink`, `StyledText`, `Themed`, `useColorScheme`, `useClientOnlyValue` are Expo template artifacts. They conflict with the app's theme system and confuse new engineers. Delete them during project initialisation — never leave them in place.

---

## To add when discovered

_Update this file after any non-obvious lesson learnt during a new feature._
