# UI Library

Living reference for all icons, UI primitives, and recommended packages. Update when adding new assets.

---

## Icons — `@/components/icons`

All icons: custom SVG via `react-native-svg`. Each calls `useThemeColors()` internally. All accept `size` prop (px). Most accept `color` to override the default token.

Accessibility rule: icon-only buttons need an accessible label or adjacent visible text. Action sheets and modals should use accessible roles and dismiss labels. New reusable controls must preserve touch targets, readable contrast, text scaling, and clear error states.

### Navigation & Layout

| Component | Default size | Default color | Key props |
|---|---|---|---|
| `ArrowLeft` | 20 | `text` | — |
| `ChevronLeft` | 16 | `text2` | — |
| `ChevronRight` | 16 | `text3` | — |
| `ChevronDown` | 12 | `text3` | `expanded: boolean` |
| `NavIcon` | 17 | `text2` | — |

### Actions

| Component | Default size | Default color | Key props |
|---|---|---|---|
| `PlusIcon` | 18 | `text3` | `color?` |
| `CloseIcon` | 10 | `text2` | `color?` |
| `EditIcon` | 18 | `text2` | `color?` |
| `TrashIcon` | 18 | `text2` | `color?` |
| `RefreshIcon` | 18 | `text2` | `color?` |
| `FilterIcon` | 18 | `text2` | `color?` |
| `SortIcon` | 13 | `text2` | — |
| `CheckIcon` | 18 | `text2` | `color?` |

### Social

| Component | Default size | Default color | Key props |
|---|---|---|---|
| `HeartIcon` | 21 | `text2` / `liked` | `filled?: boolean` |
| `BookmarkIcon` | 21 | `text2` / `text` | `filled?`, `activeColor?`, `inactiveColor?` |
| `CommentIcon` | 21 | `text2` | — |
| `ShareIcon` | 21 | `text2` | `color?` |
| `SendIcon` | 18 | `text3` / `text` | `active: boolean` |
| `StarIcon` | 18 | `text2` / `accent` | `filled?: boolean`, `color?` |

### Ratings & State

| Component | Default size | Default color | Key props |
|---|---|---|---|
| `CheckCircleIcon` | 18 | `text2` | `color?` — pass `c.success` for green |
| `XCircleIcon` | 18 | `text2` | `color?` — pass error color for red |
| `FireIcon` | 18 | `text2` | `color?` — trending/hot badge |

### Discovery & Search

| Component | Default size | Default color | Key props |
|---|---|---|---|
| `SearchIcon` | 16 | `text3` | `color?` |
| `BellIcon` | 17 | `text2` | — |

### Profile & People

| Component | Default size | Default color | Key props |
|---|---|---|---|
| `UserIcon` | 18 | `text2` | `color?` |
| `GridIcon` | 18 | `text2` | `color?` — profile grid view |
| `ListIcon` | 18 | `text2` | `color?` — profile list view |

### Location & Contact

| Component | Default size | Default color | Key props |
|---|---|---|---|
| `PinIcon` | 14 | `text3` | `color?` |
| `GlobeIcon` | 14 | `text3` | — |
| `PhoneIcon` | 14 | `text3` | — |
| `NavIcon` | 17 | `text2` | — |

### Forms & Auth

| Component | Default size | Default color | Key props |
|---|---|---|---|
| `MailIcon` | 18 | `text3` | `color?` |
| `LockIcon` | 18 | `text3` | `color?` |
| `EyeIcon` | 18 | `text3` | `open?: boolean` |
| `CameraIcon` | 18 | `text2` | `color?` |
| `InfoIcon` | 18 | `text3` | `color?` |

### System & Settings

| Component | Default size | Default color | Key props |
|---|---|---|---|
| `SettingsIcon` | 17 | `text2` | — |
| `DotsIcon` | 17 | `text2` | — |
| `ClockIcon` | 14 | `text3` | — |
| `ImagePlaceholder` | 24 | `#B4B2A9` | `color?` |

---

## UI Primitives — `@/components/ui/`

Zero business logic. Theme-aware via `useThemeColors()`.

| Component | File | When to use |
|---|---|---|
| `ScreenHeader` | `ui/ScreenHeader` | 56 px top bar. Props: `title`, `left` (slot), `right` (slot) |
| `FormInput` | `ui/FormInput` | Labelled text input. Props: `label`, `right` (slot), `error` |
| `ErrorMessage` | `ui/ErrorMessage` | Shared themed error box. Props: `message`, `style?` |
| `IconButton` | `ui/IconButton` | Icon-only actions with a minimum 44x44pt hit area. Props: `children`, `onPress`, `accessibilityLabel`, `size?`, `variant?`, `style?`, `disabled?` |
| `PrimaryButton` | `ui/PrimaryButton` | Primary CTA. Props: `label`, `onPress`, `loading?`, `disabled?` |
| `Chip` | `ui/Chip` | Selectable filters, quick starts, and compact pill actions. Props: `label`, `onPress`, `selected?`, `variant?`, `leading?`, `detail?`, `disabled?` |
| `EmptyState` | `ui/EmptyState` | All empty / error placeholders. Props: `icon`, `title`, `subtitle` |
| `RekkusActionSheet` | `ui/RekkusActionSheet` | Rekkus bottom-sheet chooser for sort, map app, cuisine, create launchers, post options, confirmations, and other action lists. Supports descriptions, icons, accents, tile rows, loading, selected, and destructive states. |

Use `IconButton` for compact icon-only controls instead of raw `TouchableOpacity`; it preserves 34-40px visual buttons while adding hitSlop for a 44pt touch target.
Use `Chip` instead of screen-local `*Pill` / `*Chip` styles. Use `EmptyState` instead of inline empty markup.

### `RekkusActionSheet`

Use this for app choice/action lists instead of `ActionSheetIOS` or non-permission `Alert.alert`, unless there is a platform-specific reason to use native UI. Permission prompts may still use native system UI; app confirmations, reports, destructive actions, saved states, and retry guidance should use Rekkus sheets.

```tsx
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'

;<RekkusActionSheet
  visible={sortOpen}
  title="Sort places"
  subtitle="Optional helper copy"
  options={[
    { label: 'A-Z', value: 'alpha', selected: sortBy === 'alpha' },
    { label: 'Last saved', value: 'recent', selected: sortBy === 'recent' },
  ]}
  onSelect={setSortBy}
  onDismiss={() => setSortOpen(false)}
/>
```

Behavior: themed `Modal`, slide animation, backdrop dismiss, Android back support via `onRequestClose`, safe-area bottom padding, selected option checkmark, and scroll support for long option lists.

Supported patterns: one-button notice, two-button confirmation, destructive confirmation, picker list, selected-state list, loading row, icon row, and tile actions. Use accent colours for positive actions and the destructive style only for irreversible or safety-sensitive actions.

---

## Feature Components — `@/components/`

| Component | When to use |
|---|---|
| `Avatar` | Avatar circle with initials fallback and image |
| `ProfileHeader` | Shared profile header — stats, bio, avatar, badge |
| `PostCard` | Shared feed post surface: media, creator, dish/title/body, Rekkus Picks, place, tags, actions |
| `PostMediaCarousel` | Shared image/video carousel for feed, detail, and share preview; shows video and count badges |
| `PostPicksSummary` | Compact Taste/Value/Occasion summary for every post surface |
| `ThumbGrid` | 3-col thumbnail grid for post collections with video/carousel badges |
| `PostUploadProgress` | Compact publish job row with thumbnail, status, progress, failed dismiss state |
| `RatingDisplay` | Stars, Vibes, Dollars, PostRatingStrip, compact RatingInputRow |
| `OpenBadge` | Open / closed status badge |
| `MapMarker` | Custom Google Maps marker |
| `ErrorBoundary` | Class-based React error boundary (wrap screens) |
| `AuthPromptModal` | Guest-to-auth prompt modal |

Post action chips and draft/upload rows should use hairline borders, white/light fills, compact 11-13px labels, and accent/destructive color only for active, successful, or irreversible states.

---

## @expo/vector-icons (already installed)

`@expo/vector-icons` is installed and available. Prefer custom SVG icons from `@/components/icons` for design consistency. Only reach for vector-icons when a specific glyph doesn't exist in the custom set.

**Available sets:** `Ionicons`, `MaterialIcons`, `MaterialCommunityIcons`, `FontAwesome5`, `Feather`, `AntDesign`, `Entypo`, `EvilIcons`, `Octicons`, `SimpleLineIcons`, `Zocial`

```tsx
import { Ionicons } from '@expo/vector-icons'
// <Ionicons name="rocket" size={24} color={c.text} />
```

Browse icons: https://icons.expo.fyi

---

## Recommended Packages

Ranked by UX impact. None are installed yet — approve each before installing.

### High Priority

| Package | Install | What it unlocks |
|---|---|---|
| `@gorhom/bottom-sheet` | `npx expo install @gorhom/bottom-sheet` | Filter drawers, action sheets, comment panels — essential mobile pattern. Requires `react-native-gesture-handler` + `react-native-reanimated` (both present). |
| `@shopify/flash-list` | `npx expo install @shopify/flash-list` | Drop-in FlatList replacement. Dramatically better feed scroll performance via recycled cells. |
| `expo-haptics` | `npx expo install expo-haptics` | Haptic feedback on likes, saves, button presses. One-line API: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` |

### Medium Priority

| Package | Install | What it unlocks |
|---|---|---|
| `sonner-native` | `npm install sonner-native` | Toast notifications (success, error, info, promise). Animated, stackable, easy API: `toast.success('Saved!')` |
| `react-native-skeleton-placeholder` | `npm install react-native-skeleton-placeholder` | Shimmer loading placeholders for feed cards and profile screens while data fetches |

### Low Priority / Verify First

| Package | Notes |
|---|---|
| `react-native-gesture-handler` | Likely already available transitively via `expo-router`. Run `npx expo install react-native-gesture-handler` only if bottom-sheet setup requires it explicitly. |
| `moti` | Declarative animation primitives on top of Reanimated. Useful for animated presence (mount/unmount). Only add if Reanimated's raw API feels verbose for a specific use case. |

---

## Design Tokens

### Colors — `@/constants/Colors`

```ts
import { useThemeColors } from '@/lib/ThemeContext'
const c = useThemeColors()

c.bg          // screen background
c.surface     // card / input background
c.surface2    // secondary surface
c.text        // primary text
c.text2       // secondary text
c.text3       // tertiary / placeholder
c.border      // dividers
c.border2     // subtle borders
c.accent      // brand orange (#D4522A)
c.info        // info blue
c.success     // success green
c.warning     // warning yellow
c.liked       // heart red
c.errorBg     // error background
c.overlay     // modal scrim
c.white       // always white
```

### Typography — `@/constants/Typography`

```ts
import { bodyBase, bodySmall, caption, label, heading } from '@/constants/Typography'

bodyBase  // default copy
bodySmall // supporting copy
caption   // dense metadata
label     // chips and compact labels
heading   // compact headings
```

### Spacing — `@/constants/Spacing`

```ts
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'

spacing[1] // 4    spacing[2] // 8    spacing[3] // 12
spacing[4] // 16   spacing[5] // 20   spacing[6] // 24
spacing[8] // 32

radius.xs // 4    radius.sm // 6    radius.md // 10
radius.lg // 14   radius.xl // 18   radius.pill // 20
radius.full // 999
```
