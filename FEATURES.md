# Rekkus — Feature Tracker

Track of all implemented screens, flows, and features. Update as new work is shipped.

Feature areas with their own design docs: [Feed](FEED.md) · [Search](SEARCH.md)

---

## Screens

### Tab bar — `app/(tabs)/`

| Screen          | File                     | Status                                     |
| --------------- | ------------------------ | ------------------------------------------ |
| Feed            | `app/(tabs)/feed.tsx`    | ✅ Done                                    |
| Search          | `app/(tabs)/search.tsx`  | ✅ Done                                    |
| Create (post)   | `app/(tabs)/post.tsx`    | ✅ Done                                    |
| Places          | `app/(tabs)/places.tsx`  | ✅ Done                                    |
| Profile         | `app/(tabs)/profile.tsx` | ✅ Done                                    |
| Alerts (no tab) | `app/(tabs)/alerts.tsx`  | ✅ Done — accessible via bell icon in Feed |

### Post detail — `app/post/`

| Screen      | File                | Status  |
| ----------- | ------------------- | ------- |
| Post detail | `app/post/[id].tsx` | ✅ Done |

### Location — `app/location/`

| Screen        | File                         | Status  |
| ------------- | ---------------------------- | ------- |
| Location info | `app/location/[placeId].tsx` | ✅ Done |
| Location map  | `app/location/map.tsx`       | ✅ Done |

### Auth — `app/(auth)/`

| Screen                         | File                            | Status  |
| ------------------------------ | ------------------------------- | ------- |
| Welcome                        | `app/(auth)/welcome.tsx`        | ✅ Done |
| Sign in                        | `app/(auth)/login.tsx`          | ✅ Done |
| Sign up (step 1 — credentials) | `app/(auth)/signup.tsx`         | ✅ Done |
| Sign up (step 2 — profile)     | `app/(auth)/signup-profile.tsx` | ✅ Done |

### Settings — `app/settings/`

| Screen          | File                               | Status  |
| --------------- | ---------------------------------- | ------- |
| Settings hub    | `app/settings/index.tsx`           | ✅ Done |
| Edit profile    | `app/settings/edit-profile.tsx`    | ✅ Done |
| Change email    | `app/settings/change-email.tsx`    | ✅ Done |
| Change password | `app/settings/change-password.tsx` | ✅ Done |

---

## Features

### Feed

- Wordmark top bar with notification bell — taps to open Alerts screen
- Following / Discover tab switcher (visual only — not yet data-backed)
- Two-column masonry grid of post cards
- Post card: coloured image placeholder, title (2-line clamp), avatar + like count
- Tap card → push to post detail

### Search

- Search input with clear button
- Discovery page (no query): People to follow chips, Trending now, Popular places
- Results page: People / Posts / Places in separate sections with counts
- BM25-style field-weighted scoring: title & cuisine_type(3) > tags/location(2) > creator(1.5) > body(1)
- STOP_WORDS: optional filler words ("food", "restaurant", etc.) don't need to match
- AND logic: all non-stop words must match somewhere — prevents irrelevant partial results
- Debounced (300ms) Supabase search for real users + restaurants, merged with local mock data
- Searching by cuisine type (e.g. "chinese") surfaces posts even if the word isn't in the title/body

### Create (post)

- Photo upload area (dashed border 4:3 placeholder) / preview strip after selection
- Title input (max 100 chars, counter)
- Body / review input (multiline)
- Food rating (1–5 stars, gold)
- Vibe rating (1–5 stars, gold)
- Cost rating (1–4 dollar signs, green)
- Cuisine type picker (ActionSheetIOS, 16 options) — saved to post and restaurant row
- Location picker — Google Places Autocomplete (REST, no library), upserts to `restaurants` table
- Hashtag tokeniser (space/enter adds blue pill token)
- Auth gate on mount — guests are prompted before accessing

### Alerts

- Not a bottom nav tab — accessible via bell icon in Feed header
- Empty state with bell icon and copy
- Like, comment, follow notifications from Supabase
- Pull-to-refresh
- Auth gate on mount — guests are prompted before accessing

### Places

- Dedicated bottom nav tab (replaced Alerts tab)
- **List view**: alphabetical with letter headers (A, B, C…) or sorted by "Last saved" / "Oldest saved"
- Sort button → ActionSheetIOS with 3 options: A–Z, Last saved, Oldest saved
- **Map view**: Google Maps (`PROVIDER_GOOGLE`) with pins for all saved locations
- Tapping a pin → bottom card slides up with name, address, "View detail" + "Open in Maps" buttons
- "Open in Maps" → ActionSheetIOS to choose Apple Maps or Google Maps
- Map stays live/pannable while card is open; tap map to dismiss card
- `useFocusEffect` refreshes data on tab focus

### Profile

- Username top bar + settings gear (navigates to /settings)
- Centered 80px avatar circle with initials
- Reviewer badge pill (✦ Explorer / Quality hunter / Prolific reviewer / Local expert) — computed from post count + avg food rating
- Stats card (surface card): Posts / Followers / Following
- Bio and location tag (suburb, city, country — fetched from Supabase)
- Food stats strip: avg food rating · saved spots count · total likes received
- Favourite spots horizontal scroll (from `useSavedLocations`) — conditional, hidden if empty
- Edit profile / Share action buttons
- Text-label tabs: Posts / Saved / Liked
- 3-column thumbnail grid with mock images (picsum.photos)
- Auth gate on mount — guests are prompted before accessing

### Other user profiles (`app/user/[username].tsx`)

- Accessible by tapping any creator name in feed, post detail, or search
- Same centred layout with reviewer badge + stats card + bio
- Follow + Message buttons (Follow auth-gated)
- Posts-only tab (Saved/Liked are private)

### Location feature

- Location pill on post detail → taps open Location info screen
- Geocode-on-tap for old posts with no coordinates (Places Text Search API)
- Bookmark icon next to location pill on post detail to save/unsave
- **Location info screen** (`location/[placeId].tsx`):
  - Photo carousel (up to 6 photos from Google Places, horizontal scroll, 220px)
  - "No images available" placeholder when none exist
  - Name, category, price level, Open/Closed badge (from Google Places Details API)
  - Ratings card: Google ⭐ rating + review count; Rekkus 🍴/🎭/💰 averages in one surface block
  - Rekkus ratings computed from PostsContext posts matched by placeId or restaurant name
  - Contact rows: address (→ ActionSheetIOS Apple/Google Maps), phone (→ `tel:`), website (→ in-app browser), hours (collapsible — shows today by default, tap to expand all days)
  - Posts section: compact rows (60×60 thumbnail, creator, title, ratings, likes)
  - Post sort — ActionSheetIOS: Most liked (default), Newest, Oldest
  - Header: back button, navigation icon (→ full-screen map), bookmark icon (save/unsave)
- **Location map screen** (`location/map.tsx`):
  - Full-screen Google Maps with single pin
  - Tap pin → Reanimated bottom card slides up: name, ⭐ Google rating, Open/Closed badge, Rekkus ratings, phone
  - "Open in Maps" → ActionSheetIOS (Apple Maps / Google Maps)
  - Tap map to dismiss card (debounced to avoid marker/map press conflict)
- `saved_locations` Supabase table (user_id + restaurant_id, RLS)
- `restaurants` table with `google_place_id` unique constraint for deduplication
- `food_rating`, `vibe_rating`, `cost_rating` columns on `posts` table (migration `20240110000000_post_ratings.sql`)

### Post detail

- 4:3 photo area with dot pagination indicators
- Like / comment / save / share action bar
- Follow pill button
- Ratings chips (food stars, vibe stars, cost dollars)
- Location pill with bookmark icon — save location directly from post
- Hashtag pills
- Comment input + send button
- All interactive actions (like, save, follow, comment send) gated — guests shown auth prompt

### Auth flow

- Email + password sign-in
- Email + password sign-up (2 steps: credentials → profile)
- Google OAuth (WebBrowser + token extraction + setSession)
- Session persistence via Supabase (expo-sqlite/localStorage)
- Soft auth gate — guests browse freely, prompted on interaction
- `AuthContext` — user, session, loading; signIn/signUp/updateProfile/signInWithGoogle/signOut
- `AuthGateContext` — `requireAuth()` shows bottom sheet modal if not signed in
- `AuthPromptModal` — bottom sheet with "Join Rekkus." CTA

### Settings

- Settings hub with sections: Account, Notifications, Privacy, Appearance, About, Danger zone
- Toggles persisted to `user_settings` Supabase table (upsert on change)
- Edit profile: avatar upload (expo-image-picker → Supabase Storage), username, display name, bio
- Change email: re-auth then `supabase.auth.updateUser({ email })`
- Change password: re-auth then `supabase.auth.updateUser({ password })`
- Sign out: confirmation alert → `supabase.auth.signOut()`
- Delete account: confirmation alert → contact support prompt

---

## Infrastructure

| Area                 | File(s)                                                    | Notes                                                                |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Design tokens        | `constants/Colors.ts`                                      | `colors`, `imgColors`                                                |
| Supabase client      | `lib/supabase.ts`                                          | Typed with `Database`                                                |
| Database types       | `types/database.ts`                                        | All tables including `user_settings`, `saved_locations`              |
| Mock data            | `lib/data.ts`                                              | 6 posts, 10 restaurants                                              |
| Posts context        | `lib/PostsContext.tsx`                                     | In-memory; `addPost()`                                               |
| Auth context         | `lib/AuthContext.tsx`                                      | Full Supabase auth                                                   |
| Auth gate context    | `lib/AuthGateContext.tsx`                                  | Soft gate + modal                                                    |
| Settings context     | `lib/SettingsContext.tsx`                                  | Loads/saves `user_settings`                                          |
| Fonts                | `assets/fonts/DMSerifDisplay-Regular.ttf`                  | Wordmark only                                                        |
| DB migration         | `supabase/migrations/20240101000000_initial_schema.sql`    | Full schema + RLS + storage                                          |
| DB migration         | `supabase/migrations/20240103000000_saved_locations.sql`   | `saved_locations` table + RLS                                        |
| DB migration         | `supabase/migrations/20240110000000_post_ratings.sql`      | `food_rating`, `vibe_rating`, `cost_rating` on posts                 |
| DB migration         | `supabase/migrations/20240115000000_user_location.sql`     | `suburb`, `city`, `country` on users                                 |
| DB migration         | `supabase/migrations/20240116000000_post_cuisine_type.sql` | `cuisine_type` on posts                                              |
| Search hook          | `lib/hooks/useSearch.ts`                                   | BM25-style scoring; debounced Supabase merge                         |
| Mock users           | `lib/data.ts` → `MOCK_USERS`                               | 5 users with bios, locations, follower counts                        |
| Saved locations hook | `lib/hooks/useSavedLocations.ts`                           | Fetches saved locations with restaurant join; refreshes on tab focus |
| Alerts hook          | `lib/hooks/useAlerts.ts`                                   | Fetches likes + comments in parallel; pull-to-refresh                |
| Google Places API    | REST (no library)                                          | Autocomplete, Place Details, Text Search, Photos — key in `.env`     |
| Google Maps          | `react-native-maps` 1.27.2                                 | `PROVIDER_GOOGLE`, requires native build                             |
| Tab bar              | `app/(tabs)/_layout.tsx`                                   | Custom SVG icons, no Ionicons                                        |
| Custom post button   | `components/TabBarPostButton.tsx`                          | Auth-gated + button                                                  |
| Auth prompt modal    | `components/AuthPromptModal.tsx`                           | Bottom sheet CTA                                                     |
| Root layout          | `app/_layout.tsx`                                          | Provider stack + font load                                           |
| Settings layout      | `app/settings/_layout.tsx`                                 | Stack with no header                                                 |

---

## Not yet built

- Real backend data (feed, search, post detail all use mock data)
- Following / Discover feed split (UI tabs exist, not data-backed)
- Saved / Liked tabs in profile (uses mock post slice, not real saves/likes table)
- Share sheet
- Comment threads / replies
- Follow/unfollow real backend call
- Forgot password flow
- Connected accounts management (Google disconnect)
- Push notifications
- Deep linking / universal links
