# Rekkus — Design System

Living reference for the design system, component APIs, and screen specs.
Read this before building any screen or component.

---

## Rekkus Picks And Legacy Ratings

Create-post entry uses **Rekkus Picks** as the primary customer-facing rating language:

| Group | Options | UI rule |
| --- | --- | --- |
| Taste | Not for me, Good, Craveable, Must order, Worth a trip | Selected chip reveals helper copy. |
| Value | Not worth it, Fair, Great value, Worth the splurge | Selected chip reveals helper copy. |
| Occasion | Quick bite, Solo, Casual, Date night, Group, Special | Multi-select up to three tags. |

Helper text must stay plain and decision-oriented, for example: "Worth a trip — Good enough to go out of your way for." Legacy Food/Vibe/Cost ratings remain data-compatible for old posts and aggregate fallbacks, but new post/detail UI should prefer Rekkus Picks.

## Legacy Rating System

All rating rendering — display and interactive input — goes through `components/RatingDisplay.tsx`. Never build a local star/diamond/dollar row; import from there.

| Dimension | Display component | Input symbol | Exported color constant | Max |
|-----------|-------------------|-------------|-------------------------|-----|
| Food      | `Stars`           | ★           | `STAR_ON` (`#EF9F27`)  | 5   |
| Vibe      | `Vibes`           | ◆           | `VIBE_ON` (`#8B6FBE`)  | 5   |
| Cost      | `Dollars`         | $           | `DOLLAR_ON` (`#1D9E75`)| 4   |

For post/feed rows use `PostRatingStrip`. For interactive input (e.g. post creation) use `RatingInputRow` with the canonical `symbol` and `colorOn` values from the table above.

> **Rule:** `Stars` is food-only. Using `Stars` for vibe is a bug — use `Vibes` instead.

## Post Media Layout

- Use `PostMediaCarousel` for feed/detail/search-compatible post media. It supports ordered photos and videos, carousel count, video badges, legacy `imageUrl`/`videoUrl` fallback, and native video controls. Only visible feed/post-detail media receives muted autoplay eligibility; Reduce Motion always pauses autoplay.
- Use `PostCard` for feed cards so mixed media, Rekkus Picks, creator, place, and action hierarchy stay consistent.
- Keep dish tagging photo-only until video timestamp tagging has its own model. Mixed posts should clearly expose which photos can be tagged.
- Dense screens should show thumbnails or compact rows first; avoid masonry when mixed media aspect ratios make scanning unstable.

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
| `c.text2`    | `#5F5F5A`          | `#A8A8A2`                | Secondary text            |
| `c.text3`    | `#686862`          | `#94948E`                | Placeholders, tertiary    |
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
import { bodyBase, bodySmall, bodyLarge, caption, label, heading } from '@/constants/Typography'
```

Prefer semantic presets for new UI:

| Preset      | Usage                                |
| ----------- | ------------------------------------ |
| `bodyBase`  | Default body copy and empty titles   |
| `bodySmall` | Supporting copy and empty subtitles  |
| `bodyLarge` | Longer readable descriptions         |
| `caption`   | Dense metadata and timestamps        |
| `label`     | Chips, compact buttons, small labels |
| `heading`   | Compact section and screen headings  |

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

### Dynamic Type / OS Text Scaling

React Native `Text` scales with iOS Dynamic Type and Android Font Size by default (no cap). Unbounded scaling hides actions in fixed-height containers. Rules:

- **Never** use `allowFontScaling={false}` — this breaks accessibility.
- **Layout-critical elements** (headers, chips, tabs, action bars, wordmarks): set `maxFontSizeMultiplier={maxFontSizeMultiplier.layout}` (1.3×). Import from `constants/Typography`.
- **Scrollable body copy** that has room to wrap: set `maxFontSizeMultiplier={maxFontSizeMultiplier.body}` (1.5×).
- Body text inside a full-screen scrollable surface can omit `maxFontSizeMultiplier` if there is no fixed-height container around it.

Test at: iOS Settings → Accessibility → Larger Accessibility Sizes (max); Android Settings → Display → Font Size (largest). Verify no primary action is clipped or hidden.

`check:tokens` enforces no raw `fontSize` / `fontWeight` / `lineHeight` literals in `features/`, `components/`, `app/`, and `lib/contexts/`.

---

## Spacing & Radius Scale

Import spacing from `constants/Spacing.ts` and radius from `constants/Radius.ts`.

```ts
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
```

Elevation is tokenised too:

```ts
import { elevation } from '@/constants/Elevation'
```

Use `elevation.xs` for subtle labels, `sm` for lifted controls/sheets, `md` for modal surfaces, and `lg` for floating action/context cards. Do not hand-write `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, or `elevation` in feature/component styles.

| Token        | Value | Usage                     |
| ------------ | ----- | ------------------------- |
| `spacing[1]` | 4     | Tight gaps                |

## Accessibility Checklist

Before public beta and for every new interactive flow:

- VoiceOver/manual screen-reader pass on auth, feed, search, create, post detail, restaurant detail, profile, settings, and report/block flows.
- Icon-only buttons need accessible labels or adjacent visible text.
- Touch targets should be at least 44x44 where layout allows.
- Text must remain readable with OS text scaling and must not overlap controls.
- Color contrast must be checked for primary text, secondary text, errors, ratings, and disabled states.
- Errors must be visible in text, not color alone.
- Report/block and privacy actions must be reachable without gesture-only navigation.
- All interactive `TextInput` fields must have `accessibilityLabel` (placeholder text is not announced by VoiceOver).
- All result rows (`PlaceRow`, `PostCompactRow`) must have `accessibilityRole="button"` and a descriptive `accessibilityLabel` that conveys the item name without requiring the user to explore child elements.
- Search result tab buttons require `minHeight: 44` — `minHeight: 32` is insufficient per Apple HIG.
- B-541 audit (2026-05-31): search screens (`SearchScreen`, `SearchResultsTab`, `DiscoveryPage`, `SearchFiltersSheet`, `searchShared`) passed `check:a11y`.
| `spacing[2]` | 8     | Small gaps                |
| `spacing[3]` | 12    | Medium gaps               |
| `spacing[4]` | 16    | Screen horizontal padding |
| `spacing[5]` | 20    | Section padding           |
| `spacing[6]` | 24    | Large gaps                |
| `spacing[8]` | 32    | XL spacing                |

| Token         | Value | Usage                 |
| ------------- | ----- | --------------------- |
| `radius.xs`   | 4     | Tiny badges, media indicators |
| `radius.sm`   | 6     | Small controls                |
| `radius.md`   | 10    | Cards, chips                  |
| `radius.lg`   | 14    | Inputs, panels                |
| `radius.xl`   | 18    | Larger chips                  |
| `radius.pill` | 20    | Primary buttons               |
| `radius.full` | 999   | Avatars, round badges         |

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

;<EmptyState
  loading
  title="Opening create"
  subtitle="Checking for saved drafts."
/>
```

### `RekkusActionSheet`

```tsx
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'

;<RekkusActionSheet
  visible={open}
  title="Sort places"
  options={[
    { label: 'A-Z', value: 'alpha', selected: sortBy === 'alpha' },
    { label: 'Last saved', value: 'recent', selected: sortBy === 'recent' },
  ]}
  onSelect={setSortBy}
  onDismiss={() => setOpen(false)}
/>
```

Use for sort controls, map app choices, cuisine pickers, confirmations, success notices, report/block flows, actionable failure recovery, and other short/medium action lists. Routine failures use `<ErrorMessage>` rather than a dismiss-only sheet or failure alert. Prefer this Rekkus popup over `ActionSheetIOS` and non-permission confirmation alerts; keep full-screen workflows such as dish tagging as dedicated modals.

Standard behaviour: bottom sheet, themed backdrop, safe-area bottom padding, handle, selected-state checkmark, scrollable options, backdrop dismiss, and Android back dismiss.

Copy rules: titles should name the user decision or result, subtitles should explain the consequence in one plain sentence, and destructive options should use explicit verbs such as `Delete message` or `Block user`.

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
  onPressFollowers={() => openFollowers()}
  onPressFollowing={() => openFollowing()}
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

## Theme Selector Component

Used in Settings → Appearance. A single card row with a segmented 3-pill control.

| Option    | Value stored |
| --------- | ------------ |
| Light     | `'light'`    |
| Dark      | `'dark'`     |
| Follow OS | `'system'`   |

Active pill: `backgroundColor: colors.text`, label `color: colors.bg`. Inactive: transparent background, `color: colors.text`. Border: `0.5pt colors.border2`, `borderRadius: 8`. Pills share a horizontal `flexDirection: 'row'` container with `overflow: 'hidden'`.

Use `useIsDarkMode()` (from `lib/contexts/ThemeContext`) wherever a boolean dark-mode flag is needed (e.g. map tile style selection).

`Autoplay videos` is a separate Appearance toggle. It controls muted visible-only post autoplay and defaults on; OS Reduce Motion overrides it without removing manual playback controls.

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
- **Tabs:** Feed, Search, Saved, Profile. Create is a floating action, not a destination tab.
- Back navigation uses `router.back()` — never hardcode routes for back
- Deep link params via `useLocalSearchParams()`

---

## Screen Specs

### Onboarding (B-240)

3-step progressive disclosure sequence for new accounts. Each step uses `SafeAreaView edges={['top']}`, a 56px top bar with back chevron + step indicator (`1 of 3` / `2 of 3`), and a full-width `PrimaryButton` CTA at the bottom.

**Step 1 — Profile** (`/(auth)/onboarding-profile`): `fontSize['5xl']` title + `fontSize.md` subtitle. `@` prefixed username field (min 3 chars, lowercase a–z 0–9 _ .), display name field. Continue disabled until both valid.

**Step 2 — Interests** (`/(auth)/onboarding-interests`): same header pattern. Chip grid from `ONBOARDING_TOPICS`. Active chip: `backgroundColor: c.text`, `borderColor: c.text`, text `c.bg`. Inactive: `c.surface` / `c.border`. Min-height 44pt per chip. Selected-count caption below grid. Continue disabled until ≥3 selected.

**Step 3 — Location** (`/(auth)/onboarding-location`): centred layout, `SafeAreaView edges={['top','bottom']}`. Large map-pin icon (`c.accent`, 48×48). `fontSize['5xl']` title + `fontSize.lg` body (max-width 280). Two CTAs stacked: "Enable location" (primary) + "Not now" (secondary, `c.text3`, min 44pt). No back affordance shown (step completes onboarding regardless).

**Feed nudge**: shown once after onboarding on `/(tabs)/feed`. Dismissable card above the scroll area (inside the safe area): `c.surface` background, `radius.lg`, border `c.border`. Title + subtitle row, then two equal-width pill buttons ("Post a dish" primary, "Explore nearby" secondary). Dismiss ✕ in top-right corner (44pt hit area). Cleared from AsyncStorage (`rekkus:first-feed-visit:v1`) on first interaction or dismiss.

**Dish tag onboarding tooltip** (B-405): shown once on first photo add in `StepMedia`. Inline row between the media strip and the "Tag dishes" button. Accent-tinted background (`c.accent + 12` fill, `c.accent + 24` border), `radius.md3`. One-line body text (`fontSize.bodySm`, `c.text2`) with a ✕ dismiss button (44pt hit area, `accessibilityRole="button"`, `accessibilityLabel="Dismiss tip"`). Fades in via `FadeIn.duration(200)` (skipped when `reduceMotion`). Gated by AsyncStorage key `rekkus:dish-tag-onboarding:v1`; fires `dish_tag_onboarding_shown` analytics event on show. Never reappears after dismiss.

### Bottom Navigation

Four destination tabs: Feed · Search · Saved · Profile. A centred floating Create action sits above the bar and launches contribution without changing the meaning of tab navigation.

B-531 evaluates an iOS-only system-material backdrop for this same tab bar, behind the disabled-by-default `iosTabBarMaterial` flag in development/staging only. The tab destinations and floating Create visual/behavior do not change. Android, beta, production, and iOS Reduce Transparency use the opaque token-backed bar.

Active: `c.text`. Inactive: `c.text3`. Floating Create button: 56x56 circle, `bg: c.text`, icon `c.bg`, minimum 44pt interaction area.

### Feed

Single-column, media-first post cards. Tabs: Following (chronological) · Discover (algorithmic).
Card hierarchy: media → creator → dish/title → body preview → Rekkus Picks → place → tags → actions. Use white/light surfaces, hairline dividers, compact metadata, and accent only for active/selected states.

### Post Detail

56px top bar → media carousel → compact action bar → Rekkus Picks → creator → title/body → location/save-location pill → tappable hashtags → reaction chips → comments → pinned comment input.

Post detail action states:
- Like, save post, save location, follow, and reactions optimistically update; write failures roll back and show `<ErrorMessage>` feedback.
- Offline reversible actions may remain optimistic with the root `ConnectivityNotice` identifying pending sync; authored or destructive actions use `<ErrorMessage>` reconnect guidance and never auto-submit later.
- Hashtags route to Search with the tag prefilled.
- Share routes through New Message and sends a tappable `post_share` card back to Post Detail.
- Comments keep reply/report as compact row actions under the comment body.

### Search

Default: search bar + category chips + trending list.
Active: result count label + 2-col grid (same as feed).
Zero-results: `NoResultsCard` (`features/search/NoResultsCard.tsx`) — heading "No results for X" + 3 alternative `Chip` actions from local taste signals with `CHIPS` as static fallback. Never show a blank screen.

### Create Review

Create composer: Title -> restaurant/place -> food media, then Review, then Share preview. Camera and Library are primary actions; mixed media uses drag-to-reorder thumbnails, item 0 is Cover, and dish tags apply to photos only. 3:4 cover and Tag dishes are compact icon pills below the strip. Review is core-first: compact icon-led Taste/Value/Occasion chips -> written review -> always-visible Best dish -> collapsed Optional details for Cuisine and Tags. Existing cuisine/tag values automatically expand Optional details and remain summarised when collapsed. Selected pick helper copy remains visible; visible Food/Vibe/Cost cards do not return. Header actions share size, weight, hit area, and disabled styling; Share hides the top Save and keeps Save draft in the final action area. Share edit actions use step names: Edit media and Edit review.

**Step 1 (Media) spacing tokens (B-404):** `titleSection.paddingTop` = `spacing.px10` (10px); `locationSection.paddingTop` = `spacing[1]` (4px); `photoEmpty.marginTop` = `spacing[2]` (8px); `photoEmpty.aspectRatio` = 2.2 (~156px tall on 375px screen). These values keep the restaurant search and dish tagging prompt visible above the fold without scrolling on standard phone sizes.

### Post Collections

Profile grids use `ThumbGrid`: 3-column thumbnails with video/carousel badges and a clear tap affordance. Empty states use a soft icon circle plus concise copy.

### Saved Library And Dish Detail

The visible tab is **Saved**. It opens an overview with Dishes, Places, Posts, and Collections; Places preserves its list/map and visit-prompt utility inside that drill-in. Dish detail leads with first-party post imagery, dish name, canonical restaurant, bookmark, collection action, and linked post evidence. Only canonical dish mentions are tappable.

Collection picking uses a `RekkusActionSheet` list plus a private create action. Mixed collection detail uses one row language for dish, post, and place members in saved order.

### Upload & Drafts

`PostUploadProgress` appears as a compact media row with thumbnail, status hierarchy, progress, posted success, and failed dismiss state. Draft rows look like saved post previews with thumbnail, title, restaurant/media/date metadata, and compact Duplicate/Delete actions.

Create launcher: the floating Create action opens a Rekkus sheet over the current screen. With saved drafts it shows **New post** and **Edit a draft** only; never show a long draft list in the launcher.

### Profile (own)

Top bar: `@handle` + Settings. Header: avatar 72px + stats + name + bio + location + Edit/Share. Tabs: Posts · Saved · Liked; Saved opens the unified Saved destination.

### Profile (other user)

Same header. Actions: Follow + Message. Tab: Posts only.

---

## Key UX Patterns

- **Loading:** `ActivityIndicator` for compact actions and pagination; skeleton placeholders (`c.surface2` background) for predictable content; `<EmptyState loading>` only for blocking full-screen waits without a useful content shape
- **Errors:** `<ErrorMessage>` for routine failures; `RekkusActionSheet` only when recovery choices are available
- **Success/info:** `useToast()` from `lib/contexts/ToastContext` — 3 s auto-dismiss bottom overlay, `accessibilityLiveRegion="polite"`; never use `Alert.alert` for success/info; never add per-screen banner variants
- **Connectivity:** one root `<ConnectivityNotice>` for offline/pending/sync status; do not duplicate banners in individual screens
- **Empty states:** `EmptyState` component — icon + title + subtitle, generous padding
- **Haptics:** light on like/save; medium on post submit
- **Auth gate:** `requireAuth()` before any write — never hard-redirect guests
