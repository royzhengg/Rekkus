# Lessons Learnt — Rekkus

Rules and patterns we've discovered the hard way. Apply these from the start on any new feature.

---

## Architecture

### Preserve private text by linking to context, not copying content

Comment bodies, message bodies, report notes, captions, and free-form private text should stay in their owner tables and moderation flows. Notifications, alerts, analytics, and audit events should use context-safe labels like “commented on your post” plus entity IDs.

**Why:** It keeps push payloads, analytics, and audit logs privacy-safe while still giving users a clear path back to the relevant content.

---

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

### Use design-system primitives for chips and empty states

New chips, pills, filters, quick starts, and compact selectable actions must use `components/ui/Chip.tsx`. Empty tabs, empty lists, and no-result states must use `components/ui/EmptyState.tsx`.

New screen styles should use `spacing`, `radius`, and semantic typography presets instead of raw padding, radius, font size, weight, or line height values. `check:design` blocks reintroduced custom chip and empty-state patterns, and `check:tokens` blocks raw token values across `features/` and `components/`.

---

### `PostRatingStrip` replaces all emoji ratings

Anywhere a post's food / vibe / cost rating is shown, use:

```tsx
import { PostRatingStrip } from '@/components/RatingDisplay'
;<PostRatingStrip food={post.food} vibe={post.vibe} cost={post.cost} />
```

Never write `🍴{post.food}`, `🎭{post.vibe}`, or `'$'.repeat(post.cost)` in JSX.

---

### Prefer context-preserving launchers for tab actions

The central Create `+` should open a Rekkus sheet over the screen the user is viewing. Do not rely on focusing an already-mounted tab screen to decide whether to resume drafts or start fresh; tab state can silently bypass the user's expected choice.

### Keep ranking invisible and UI simple

Restaurant tagging and search can rank by relevance, popularity, distance, and Rekkus-owned signals, but the UI should stay as one clean list unless the user explicitly opens filters. Do not expose internal ranking buckets as visible sections.

### Rekkus Picks are the user-facing rating language

New create, feed, and post-detail surfaces should show Taste, Value, and Occasion. Food/Vibe/Cost remain compatibility fields for old data and aggregates, not primary UI.

### Dark mode maps still need colour

Dark mode is not grayscale mode. Keep water blue, parks green, roads warm, labels readable, and markers high-contrast so Places remains useful at night.

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

## UX Copy Standards

Always consult `design/UX_Copywriting_Guide.md` when designing new features or flows — even if specific rules are later overridden, it is the required starting point for copy decisions.

### Rules

- **British English** is the spelling standard throughout the app
- **Full caps only for status labels** (e.g. `ACTIVE`, `PENDING`) — never for section headings, modal titles, or button labels
- **Use "Tap" / "return"** — never "Click" / "enter" — this is a mobile app
- **"Create account"** is the canonical term everywhere — never "Sign up"
- **CTAs must be specific** — "Complete profile", "Post review", "Update password" — never "Finish", "Submit", or "OK" in isolation
- **Empty states**: state the fact cleanly and prompt the next action — remove passive filler like "Check back later"
- **Error messages**: always say what happened and what to do next — "That password doesn't match. Please try again." not "Current password is incorrect."
- **Industry terms** like "privacy policy" and "terms of service" are lowercase — they are not proper nouns
- **Placeholders** should match their label when they add no independent value (e.g. a "Confirm password" label → "Confirm password" placeholder, not "Repeat password")

---

## Search

### Geographic reference data belongs in the database, not in TypeScript

We initially planned a hardcoded `SUBURB_ALIASES` TS map for suburb resolution. This fails because: (1) adding a new suburb requires a code deploy, (2) the list is always incomplete, (3) there is no fuzzy matching for typos. The right approach is a DB table seeded from an authoritative source (`schappim/australian-postcodes`, ~16k rows) with a pg_trgm index for fuzzy matching, plus a small curated `suburb_aliases` table for colloquialisms ("CBD", "darlo"). The client caches the small alias table on startup for zero-latency common lookups; the comprehensive table is queried via an indexed DB function (`resolve_suburb_query`).

**Apply when:** adding any geographic filter, location suggestion, or address matching feature.

---

### Cache-first, API-last — build the data flywheel from day one

Every external API call (Google Places, geocoding) should store its result in our DB so the next request from any user never hits the API again. The `restaurant_provider_cache` table already does this for restaurant details (30-day TTL per Google ToS). The missing piece before search enrichment: suburb geocoding results were not fed back into `suburb_lookups`. Now they are — `cacheResolvedSuburb()` in `lib/utils/locationResolver.ts` inserts any Google-resolved suburb so future searches find it in the DB for free.

**Rule:** before calling any paid API, check the DB first. After calling it, store the result with an appropriate TTL. This compounds — the more users use the app, the less we pay and the faster search becomes.

**Apply when:** adding any new external API integration.

---

---

## Phase 0 Audit Learnings (2026-05-20)

### Token definition without enforcement is false confidence

Spacing.ts, Typography.ts, Colors.ts, and lib/animations.ts were all correctly defined, but features/ bypassed them with hardcoded values (74 hex colors, 1,000+ raw px spacing values, 100+ inline fontSize values). A token system that is not enforced by a CI check (`check:tokens`, `check:darkmode`) does not exist in practice — it is documentation only.

**Apply when:** adding any new design token. Add the CI check in the same PR, or the token will be ignored.

---

### God component gravity: decompose before the file exceeds 600 LOC

ConversationScreen (2,375 LOC), SearchScreen (1,893 LOC), and PostDetailScreen (1,290 LOC) grew because each new feature landed in the nearest existing screen without a size guardrail. After 1,000 LOC, adding a feature doubles the regression surface and makes parallel work impossible. The `check:architecture` script (fail if features/ file >600 LOC) prevents this class from silently compounding.

**Apply when:** adding any feature to an existing screen. If it pushes the file past 600 LOC, extract first.

---

### Dark mode regressions are invisible without a sweep tool

`#fff`, `#FEE2E2`, and `white` in auth screens only manifest as regressions in dark mode on-device. Light-mode development never catches them. The `check:darkmode` CI script (grep for literal light-only hex codes in features/) is the only reliable prevention. Without it, each new screen adds more hardcoded light values.

**Apply when:** adding any color or background to a screen. Run `check:darkmode` before committing.

---

### Animation tokens must be implemented in the same PR they are defined

`EMOJI_STAGGER_MS` was defined in lib/animations.ts but never called — dead code. Animation tokens defined without implementation accumulate as aspirational comments. Rule: if a new animation constant is added to lib/animations.ts, it must be used in the same PR. Otherwise, delete it.

**Apply when:** adding any animation token, timing constant, or press scale to lib/animations.ts.

---

### `as any` is contagious — fix with typed wrapper functions, not inline casts

220 `as any` instances originated from a pattern of bypassing Supabase client typing with inline casts. Each instance suppresses type errors locally but breaks the type graph upstream. The fix is typed wrapper functions in the service file (using types/database.ts generated types). The ESLint rule `@typescript-eslint/no-explicit-any` is the only prevention — AGENTS.md rules alone do not enforce it.

**Apply when:** any new Supabase call is written. Create a typed wrapper function in lib/services/. Never cast.

---

### AGENTS.md engineering rules need CI enforcement to be effective

Rules like "use tokens" and "no direct DB in screens" in AGENTS.md are advisory until backed by a CI check or ESLint rule. Without enforcement: PostDetailScreen accumulated 10+ direct supabase calls despite the existing rule. For each architectural rule in AGENTS.md, there must be a corresponding automated check. The rule and its check should be added together.

**Apply when:** adding any new rule to AGENTS.md. Ask: "What check enforces this?" Add both or add neither.

---

### Bug prevention automation compounds; bug fixing does not

Fixing 74 hardcoded hex colors is one sprint. Adding `check:tokens` to CI prevents all future occurrences permanently at zero marginal cost. For any recurring bug class (dark mode regressions, direct DB in screens, as-any proliferation), implement the preventative check before fixing existing instances. The check has higher ROI than the fix.

**Apply when:** closing any bug fix. Before closing, ask: "What check prevents this class from returning?"

---

### Dark mode bug class: `backgroundColor` with hardcoded white/light values

Auth screens (Login, Signup, Welcome, SignupProfile) had `backgroundColor: '#FEF0F0'` for error boxes and `backgroundColor: '#fff'` for Google buttons. In dark mode, `c.text` (light) rendered on these static white backgrounds — invisible. Settings screens (ChangePassword, ChangeEmail) had `backgroundColor: '#FEE2E2'` with the same pattern.

Fix: replace with `c.errorBg` (light `#FEF0F0` / dark `#3D1A1A`) and `c.surface` (adapts per theme). Both tokens already existed in Colors.ts.

Prevention: `scripts/check-darkmode.sh` catches `backgroundColor` using `#fff`, `#ffffff`, `#FEE2E2`, `#FEF0F0`, or `'white'` in features/ and components/. It runs via `npm run check:darkmode` and is part of `check:hygiene`. It excludes `fill=` lines (SVG brand colors) and `color:` props (white text/icons on dark overlays are intentional).

Key distinction: `color: '#fff'` on an icon or text overlaid on a photo/colored button is intentional and not caught. `backgroundColor: '#fff'` on a UI element that sits on the screen background is always wrong — use `c.surface`, `c.bg`, or `c.white`.

**Apply when:** adding any new screen, modal, or UI component. Never use a hardcoded hex for `backgroundColor`. Always use a `useThemeColors()` token.

### Shared UI must own repeated error and icon-button patterns

Auth/settings screens drifted into duplicate error boxes, and compact icon-only buttons repeated 34x34 styles without a 44pt hit target. Repeated UI primitives should move into `components/ui/` before the next copy is added.

Fix: `ErrorMessage` owns themed error boxes and `IconButton` owns compact icon-only controls with computed hitSlop.

Prevention: `check:a11y` catches legacy compact icon-button style definitions, and `check:tokens` scans `components/` as well as `features/` so component-level overlay literals do not bypass CI.

**Apply when:** adding any new error state, modal backdrop, or icon-only action. Use the primitive and theme token first; add `check:tokens-ignore` only for intentional media-on-photo treatments.

---

### Update this file after any non-obvious lesson learnt during a new feature

---

### Service-boundary fixes should remove the allowlist entry

Moving direct Supabase calls out of a screen is only half the fix if the architecture check still allowlists that screen. The regression guard is complete when the screen imports no Supabase client and `scripts/check-architecture.sh` no longer exempts it.

Fix: when PostDetailScreen, CreateGroupScreen, and EditProfileScreen were moved behind services, their Supabase allowlist entries were removed in the same change.

Prevention: run `npm run check:architecture` after each service-boundary cleanup and verify the cleaned file is not still listed under `SUPABASE_ALLOWLIST`.

**Apply when:** closing any ARCH item that moves DB or storage calls from `features/` or `app/` into `lib/services/`.
