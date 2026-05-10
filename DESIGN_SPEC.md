# Rekkus — Design System

Living reference for the design system, component APIs, and screen specs.
Read this before building any screen or component.

---

## Colour Tokens

All colours come from `constants/Colors.ts` via `useThemeColors()`. Never hardcode hex values in screens.

| Token        | Light              | Dark                     | Usage                     |
| ------------ | ------------------ | ------------------------ | ------------------------- |
| `c.bg`       | `#FAFAF8`          | `#141412`                | Screen background         |
| `c.surface`  | `#F2F2EF`          | `#1E1E1C`                | Cards, inputs             |
| `c.surface2` | `#E8E8E4`          | `#2A2A28`                | Secondary surfaces        |
| `c.border`   | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | Subtle dividers           |
| `c.border2`  | `rgba(0,0,0,0.14)` | `rgba(255,255,255,0.14)` | Visible borders           |
| `c.text`     | `#1A1A18`          | `#F0F0EC`                | Primary text              |
| `c.text2`    | `#6B6B66`          | `#A8A8A2`                | Secondary text            |
| `c.text3`    | `#A8A8A2`          | `#6B6B66`                | Placeholders, tertiary    |
| `c.accent`   | `#D4522A`          | `#E8673D`                | Brand accent              |
| `c.info`     | `#2A6DD4`          | `#5B93E8`                | Hashtags, links           |
| `c.success`  | `#1D9E75`          | `#28C98D`                | Cost indicators           |
| `c.warning`  | `#EF9F27`          | `#F5B340`                | Star ratings              |
| `c.liked`    | `#E24B4A`          | `#E24B4A`                | Liked heart               |
| `c.errorBg`  | `#FEF0F0`          | `#3D1A1A`                | Error backgrounds         |
| `c.overlay`  | `rgba(0,0,0,0.35)` | `rgba(0,0,0,0.55)`       | Photo overlays            |
| `c.white`    | `#FFFFFF`          | `#FFFFFF`                | Static white (Google btn) |

Image placeholder colours (`imgColors` from `constants/Colors.ts`):
`warm` · `green` · `blue` · `pink` · `clay` · `sage`

---

## Typography Scale

Import from `constants/Typography.ts`.

```ts
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
```

| Token             | Value | Usage                       |
| ----------------- | ----- | --------------------------- |
| `fontSize.xs`     | 10    | Timestamps, secondary meta  |
| `fontSize.sm`     | 11    | Hashtags, badges, labels    |
| `fontSize.base`   | 13    | Body text, captions         |
| `fontSize.md`     | 14    | Descriptions, back buttons  |
| `fontSize.lg`     | 15    | Screen titles, post titles  |
| `fontSize.xl`     | 16    | Create screen title input   |
| `fontSize['2xl']` | 18    | Section headings            |
| `fontSize['3xl']` | 22    | Wordmark (DM Serif Display) |

| Token                 | Value   |
| --------------------- | ------- |
| `fontWeight.regular`  | `'400'` |
| `fontWeight.medium`   | `'500'` |
| `fontWeight.semibold` | `'600'` |
| `fontWeight.bold`     | `'700'` |

| Token                | Value |
| -------------------- | ----- |
| `lineHeight.tight`   | 16    |
| `lineHeight.normal`  | 20    |
| `lineHeight.relaxed` | 24    |

---

## Spacing & Radius Scale

Import from `constants/Spacing.ts`.

```ts
import { spacing, radius } from '@/constants/Spacing'
```

| Token        | Value | Usage                     |
| ------------ | ----- | ------------------------- |
| `spacing[1]` | 4     | Tight gaps                |
| `spacing[2]` | 8     | Small gaps                |
| `spacing[3]` | 12    | Medium gaps               |
| `spacing[4]` | 16    | Screen horizontal padding |
| `spacing[5]` | 20    | Section padding           |
| `spacing[6]` | 24    | Large gaps                |
| `spacing[8]` | 32    | XL spacing                |

| Token         | Value | Usage                 |
| ------------- | ----- | --------------------- |
| `radius.sm`   | 6     | Small chips           |
| `radius.md`   | 10    | Cards, chips          |
| `radius.lg`   | 12    | Inputs, modals        |
| `radius.pill` | 20    | Primary buttons       |
| `radius.full` | 999   | Avatars, round badges |

---

## Design Library — `components/ui/`

Zero business logic. Purely presentational. Used to enforce visual consistency.

### `ScreenHeader`

```tsx
import { ScreenHeader } from '@/components/ui/ScreenHeader'

;<ScreenHeader
  title="@username" // optional — centre text
  left={<BackButton />} // optional — left slot (60px wide)
  right={<SettingsIcon />} // optional — right slot (60px wide)
  border={true} // optional — bottom border (default: true)
/>
```

Replaces all 9 × `topBar` style blocks. Height fixed at 56px.

### `FormInput`

```tsx
import { FormInput } from '@/components/ui/FormInput'

;<FormInput
  label="Email"
  value={email}
  onChangeText={setEmail}
  placeholder="you@example.com"
  right={<EyeIcon />} // optional — right slot
  error="Invalid email" // optional — error message below
  secureTextEntry
/>
```

### `PrimaryButton`

```tsx
import { PrimaryButton } from '@/components/ui/PrimaryButton'

;<PrimaryButton
  label="Continue"
  onPress={handleSubmit}
  loading={isLoading} // shows ActivityIndicator
  disabled={!isValid}
/>
```

`borderRadius: 20`, `backgroundColor: c.text`, `color: c.bg`.

### `EmptyState`

```tsx
import { EmptyState } from '@/components/ui/EmptyState'

;<EmptyState
  title="No posts yet."
  subtitle="Share your first food experience."
  icon={<SomeIcon />} // optional
/>
```

---

## Feature Components — `components/`

### `ThumbGrid`

3-column thumbnail grid for post collections.

```tsx
import { ThumbGrid } from '@/components/ThumbGrid'

;<ThumbGrid posts={myPosts} />
```

Returns `null` for empty arrays — render your own empty state above it.

### `ProfileHeader`

Shared header used in both own profile and other-user profile screens.

```tsx
import { ProfileHeader } from '@/components/ProfileHeader'

;<ProfileHeader
  initials="SL"
  avatarBg="#FBEAF0"
  avatarColor="#993556"
  displayName="Sarah Lee"
  badgeLabel="Local expert" // null → no badge
  postCount={24}
  followersLabel="1.4k"
  followingLabel={312}
  bio="Sydney food lover."
  locationLabel="Surry Hills, Sydney"
  avgFoodRating="4.3" // null → hidden
  totalLikesLabel="2.1k"
  savedSpotsCount={8} // optional — own profile only
/>
```

### `Avatar`

```tsx
import { Avatar } from '@/components/Avatar'

;<Avatar username="sarah" size={32} imageUrl={url} />
```

### `OpenBadge`

```tsx
import { OpenBadge } from '@/components/OpenBadge'

;<OpenBadge openNow={true} />
```

### `MapMarker`

Custom Google Maps marker (charcoal pin + optional name label).

```tsx
import { MapMarker } from '@/components/MapMarker'

;<Marker coordinate={coord} anchor={{ x: 0.5, y: 1 }}>
  <MapMarker name="Ramen Haus" />
</Marker>
```

### `ErrorBoundary`

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

;<ErrorBoundary fallback={<CustomFallback />}>
  <ChildScreen />
</ErrorBoundary>
```

---

## Icons

All icons from `@/components/icons`. Never inline SVGs or define local icon functions in screens.

```tsx
import { HeartIcon, BookmarkIcon, ChevronLeft, PinIcon, ... } from '@/components/icons'
```

Icons accept optional `size` and `color` props. They call `useThemeColors()` internally when no `color` is passed.

---

## Ratings

```tsx
import { Stars, Dollars, PostRatingStrip } from '@/components/RatingDisplay'

// Compact strip for post cards
<PostRatingStrip food={post.food} vibe={post.vibe} cost={post.cost} />

// Individual
<Stars value={4.5} />
<Dollars value={2} />
```

Never render emoji ratings or `'$'.repeat(n)` in JSX.

---

## Analytics

All tracking goes through `lib/analytics.ts`. Never call `supabase.from('analytics_events')` directly.

```ts
import { analytics } from '@/lib/analytics'

analytics.viewPost(user?.id ?? null, postId)
analytics.likePost(user.id, postId)
analytics.search(user?.id ?? null, query, results.length)
analytics.screen(user?.id ?? null, 'Feed')
```

---

## Feature Flags

```ts
import { isEnabled } from '@/lib/featureFlags'

if (isEnabled('directMessages')) { ... }
```

Edit `lib/featureFlags.ts` to toggle features. Add new flags there before building gated features.

---

## Services Layer

All Supabase queries go through `lib/services/`. Never query supabase directly from a screen.

```ts
import { likePost, fetchUserLikes } from '@/lib/services/posts'
import { fetchProfile, updateProfile } from '@/lib/services/users'
import { fetchComments, addComment } from '@/lib/services/comments'
```

---

## Theme Pattern

```tsx
const c = useThemeColors()
const styles = useMemo(() => makeStyles(c), [c])

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({ ... })
}
```

Never use module-level `StyleSheet.create` with colour tokens.

---

## SafeAreaView Edges

```tsx
// Root tab screens
<SafeAreaView edges={['top', 'bottom']}>

// Inner screens (pushed onto stack)
<SafeAreaView edges={['top']}>
```

---

## Navigation

- **Stack:** post detail, location detail, user profile, settings
- **Tabs:** Feed, Search, Post, Alerts, Profile
- Back navigation uses `router.back()` — never hardcode routes for back
- Deep link params via `useLocalSearchParams()`

---

## Screen Specs

### Bottom Navigation

Five tabs: Feed · Search · Post (centre, no label) · Alerts · Profile

Active: `c.text`. Inactive: `c.text3`. Post button: 42×42 rounded rect, `bg: c.text`, icon `c.bg`.

### Feed

Two-column masonry grid. Tabs: Following (chronological) · Discover (algorithmic).
Card: photo (3:4), title 2-line, creator avatar 16px + username, like count. `borderRadius: 10`, `border: 0.5`.

### Post Detail

56px top bar → 4:3 photo → actions bar → creator block → title → body → ratings → location pill → hashtags → comments → pinned comment input.

### Search

Default: search bar + category chips + trending list.
Active: result count label + 2-col grid (same as feed).

### Create Review

Single scroll: photo upload → title → body → ratings (Food/Vibe/Cost) → location → hashtags.
Post button disabled until title ≥ 3 chars.

### Profile (own)

Top bar: `@handle` + Settings. Header: avatar 72px + stats + name + bio + location + Edit/Share. Tabs: Posts · Saved · Liked.

### Profile (other user)

Same header. Actions: Follow + Message. Tab: Posts only.

---

## Key UX Patterns

- **Loading:** skeleton placeholders (`c.surface2` background), not spinners
- **Errors:** toast at bottom, auto-dismiss 3s
- **Empty states:** `EmptyState` component — icon + title + subtitle, generous padding
- **Haptics:** light on like/save; medium on post submit
- **Auth gate:** `requireAuth()` before any write — never hard-redirect guests
