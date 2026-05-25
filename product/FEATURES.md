# Rekkus — Feature Tracker

Track of all implemented screens, flows, and features. Update as new work is shipped.

Feature areas with their own design docs: [Feed](FEED.md) · [Search](SEARCH.md)

---

## Screens

### Tab bar — `app/(tabs)/`

| Screen          | File                     | Status                                                |
| --------------- | ------------------------ | ----------------------------------------------------- |
| Feed            | `app/(tabs)/feed.tsx`    | ✅ Done                                               |
| Search          | `app/(tabs)/search.tsx`  | ✅ Done                                               |
| Create (post)   | `app/(tabs)/create.tsx`    | ✅ Done — 3-step wizard (basics → details → preview)  |
| Places          | `app/(tabs)/restaurants.tsx`  | ✅ Done                                               |
| Profile         | `app/(tabs)/profile.tsx` | ✅ Done                                               |
| Alerts (no tab) | `app/(tabs)/alerts.tsx`  | ✅ Done — accessible via bell icon in Feed            |

### Post detail — `app/posts/`

| Screen      | File                | Status  |
| ----------- | ------------------- | ------- |
| Post detail | `app/posts/[postId].tsx` | ✅ Done |

### Location — `app/restaurants/`

| Screen        | File                         | Status  |
| ------------- | ---------------------------- | ------- |
| Restaurant info | `app/restaurants/[restaurantId]/index.tsx` | ✅ Done |
| Restaurant map  | `app/restaurants/[restaurantId]/map.tsx`       | ✅ Done |

### Auth — `app/(auth)/`

| Screen                         | File                              | Status  |
| ------------------------------ | --------------------------------- | ------- |
| Welcome                        | `app/(auth)/welcome.tsx`          | ✅ Done |
| Sign in                        | `app/(auth)/login.tsx`            | ✅ Done |
| Sign up (step 1 — credentials) | `app/(auth)/signup.tsx`           | ✅ Done |
| Sign up (step 2 — profile)     | `app/(auth)/signup-profile.tsx`   | ✅ Done |
| Forgot password                | `app/(auth)/forgot-password.tsx`  | ✅ Done |
| Reset password (deep link)     | `app/(auth)/reset-password.tsx`   | ✅ Done |

### Settings — `app/settings/`

| Screen             | File                                  | Status  |
| ------------------ | ------------------------------------- | ------- |
| Settings hub       | `app/settings/index.tsx`              | ✅ Done |
| Edit profile       | `app/settings/edit-profile.tsx`       | ✅ Done |
| Change email       | `app/settings/change-email.tsx`       | ✅ Done |
| Change password    | `app/settings/change-password.tsx`    | ✅ Done |
| Connected accounts | `app/settings/connected-accounts.tsx` | ✅ Done |

---

## Features

### Feed

- Wordmark top bar with Messages and notification buttons
- Following / Discover tab switcher backed by shared `PostsContext`
- Single-column food-first post cards using shared hierarchy: media → creator → title/body → Rekkus Picks → place → tags → actions.
- Mixed photo/video posts show carousel count and video badges without forcing masonry compromises; profile grids show video/carousel affordances.
- Feed shows `PostUploadProgress` for background publish jobs with thumbnail, stronger status hierarchy, progress, posted success, and failed dismiss state.
- Tap card → push to post detail
- Supabase-first feed data in live mode, with demo fallback only when data mode allows mock content
- Scroll-based pagination: loads 20 visible posts at a time, requests more Supabase rows when the shared feed cursor has more, and resets on tab switch
- Following ranks followed posts with recency decay, quality, likes, and completeness signals.
- Discover ranks with trending post analytics, opt-in nearby distance, search-history affinity, onboarding topics, quality, and cuisine diversity.
- Empty Following state suggests people and offers a Discover CTA; pull-to-refresh can show a new-post indicator.
- Feed view/refresh diagnostics are tracked through privacy-safe analytics metadata.

### Search

- Search input with clear button
- Live results and compact suggestions update as users type; suggestions use the `suggest_searches` RPC plus recent/cuisine fallbacks without taking over the results page.
- Compact search header with a trailing filter button for Nearby, cuisine, occasion, value, media, open-now, and sort filters
- Discovery page (no query): Quick starts row, compact Trending now suggestions, Popular places, staff-pick collections when available, and lower-priority Creators you may like
- Results page: Top / Dishes / People / Places tabs; Top shows the best available places, dish posts, and people from the existing ranked result sets
- Active filters render as quiet tokens; permanent filter rails stay hidden until the user searches or opens the sheet
- Search filters are applied in `useSearch`: cuisine, Rekkus Picks occasion/value, media type, open-now, and sort modes for Best match, Nearby, Newest, Most saved, and Highest Picks
- Dish/post results capped at 20 in the Dishes tab with a quiet "Show N more" tappable link; resets on each new query
- BM25-style field-weighted scoring: title & cuisine_type(3) > tags/location(2) > creator(1.5) > body(1)
- STOP_WORDS: optional filler words ("food", "restaurant", etc.) don't need to match
- AND logic: all non-stop words must match somewhere — prevents irrelevant partial results
- Debounced (300ms) Supabase search for real users + restaurants, merged with demo data only when `EXPO_PUBLIC_DATA_MODE` allows it
- Searching by cuisine type (e.g. "chinese") surfaces posts even if the word isn't in the title/body
- Zero-result cuisine expansion: backend RPC infers likely cuisines from existing Rekkus content, so long-tail dish queries can fall back without a large synonym list, LLM, embeddings, or query cache
- Location ranking is opt-in: users can tap Nearby, then use current location or enter a suburb/postcode fallback in the filter sheet; Search does not request GPS on mount.
- Cuisine taxonomy lives in `lib/dataSources/cuisines.ts`, is searchable alphabetically, and excludes restaurant types such as cafe, bakery, bar, and fine dining.
- Search uses live Supabase users/restaurants/posts where available and only merges demo data when data mode allows mock content.
- Search analytics include session query chains and result-click positions.

### Create (post)

- Modern media-first composer: camera and library actions are primary, with draft-safe progress through Media → Review → Share.
- Media picker accepts ordered mixed media: up to 10 total items, up to 3 videos, and 60 seconds per video; photos/videos can be reordered together.
- Hybrid media preparation starts immediately after selection through `lib/services/postMediaProcessing.ts`, using `react-native-compressor` on-device first and the `process-post-media` Edge Function as the server-side orchestration fallback.
- Draft safety: background autosave remains an invisible recovery net, while explicit **Save** is available on every create step and writes an account-synced saved draft.
- When saved drafts exist, tapping Create opens a compact Rekkus **New post** / Drafts choice sheet instead of guessing which draft to load.
- Saved drafts sync through Supabase, include private draft media previews, show newest first, and can be resumed, duplicated with numbered names, saved as a new draft, or soft-discarded without creating a public post.
- **Dish tagging**: dish tags stay photo-only; mixed posts clearly mark taggable photos, video-only posts hide tagging, and tags carry `mediaLocalId`/`mediaId` so they survive reorder.
- **3:4 cover crop**: "3:4 cover" button → `launchImageLibraryAsync({ allowsEditing: true, aspect: [3,4] })` → replaces cover photo with native-cropped version
- Title input (max 100 chars, counter)
- Body / review input (multiline)
- **Rekkus Picks** replace primary Food/Vibe/Cost entry with Taste, Value, and Occasion chips. Selecting a chip reveals helper copy such as "Worth a trip — Good enough to go out of your way for." Legacy numeric ratings remain populated for compatibility.
- Cuisine picker uses a searchable alphabetical list from `lib/dataSources/cuisines.ts`; cuisine is separate from restaurant type.
- **Best dish field**: freetext (max 60 chars) in Step 2; saved as `best_dish` on posts; aggregated on location page
- Location picker — local-first restaurant lookup with Google Places Autocomplete fallback (REST, no library), updates while typing, shows cuisine/location context in one unified ranked list, links to canonical `restaurants.id`, and records source/observation metadata.
- Hashtag tokeniser (space/enter adds blue pill token)
- Share preview shows the real post content without fake like/comment/share chrome.
- Auth gate on mount — guests are prompted before accessing

### Alerts

- Not a bottom nav tab — accessible via bell icon in Feed header
- Empty state with bell icon and copy
- Like, comment, follow notifications from Supabase
- Pull-to-refresh
- Auth gate on mount — guests are prompted before accessing

### Messages

Direct messaging is live behind `directMessages: enabled: true`. Not a bottom nav tab — accessible from profile, post, and place contexts.

- **Conversation types**: 1:1 direct and named group chats (2+ other participants required); senders the recipient does not follow land in Message Requests inbox
- **Supported message types**: `text` (up to 2,000 chars), `image`, `video` (up to 60s/100 MB), `audio` (voice note), `gif` (GIPHY picker), `sticker` (Rekkus-branded), `file` (up to 50 MB), `location` (map card), `post_share`, `place_share`, `system`
- **Composer attachments**: chat-style icon tray from `+` with Media, GIF, Location, and File; camera remains a one-tap shortcut; Media opens one library picker for both photos and videos
- **Message interactions**: long-press context menu (React, Reply, Copy, Forward, Pin, Delete/Report); swipe-to-reply; emoji reactions synced via Supabase Realtime; true erasure on delete (body + attachment nulled)
- **Conversation UX**: typing indicators (Supabase Presence); online/active status in header; day separators; per-message read receipts; multiple pinned messages per conversation; in-conversation search (toggle header mode); link tap → safety confirmation before external browser
- **Inbox**: swipe actions — Pin, Mute, Archive (right); Mark as unread (left); pending Message Requests shown as a subtle inline row only when non-empty; Archived chats and all request/archive counts live in the header overflow menu; pinned conversations sorted to top; rich preview text for non-text types; tab bar unread badge (realtime via `useUnreadMessageCount`)
- **Archived chats**: `/messages/archived` lists per-user archived conversations from the header overflow menu and supports unarchive without deleting history
- **Message requests**: direct and group requests use per-participant request state; accepting promotes only the current user into the inbox, while declining a group request does not affect other members
- **Group chats**: create from New Group screen (select 2+ contacts, set name, optional avatar); admin role (add/remove members, promote admin, edit name/avatar); leave group (auto-promotes admin); system messages for join/leave/rename
- **Conversation info screen**: Members tab (participant list with admin badges, long-press admin actions); Media tab (shared photos + videos 3-column grid); Pinned tab (all pinned messages with per-message unpin)
- **Content moderation**: all image/video passes through `moderate-content` Edge Function (CSAM hash check + NCMEC reporting); text checked against keyword blocklist; spam rate limits enforced server-side; blocked users cannot initiate or continue conversations
- **Sharing entry points**: Post detail → share sheet → New Message → sends a metadata-rich, tappable `post_share` card; Place detail → "Send via message" → sends `place_share` card
- Message notifications use privacy-safe generic copy; body never in push payload; respects `notif_messages` and per-conversation `muted_until`

### Places

- Dedicated bottom nav tab (replaced Alerts tab)
- **List view**: alphabetical with letter headers (A, B, C…) or sorted by "Last saved" / "Oldest saved"
- Sort button → `RekkusActionSheet` with 3 options: A–Z, Last saved, Oldest saved
- **Post-visit prompt**: after explicit location use, `usePostVisitPrompt` checks GPS against saved locations (200m radius); dismissible banner at top of list — "Been to [restaurant]? Tap to leave a review" → navigates to post creation with restaurant prefilled
- **Map view**: Google Maps (`PROVIDER_GOOGLE`) with pins for all saved locations
- Tapping a pin → bottom card slides up with name, address, "View detail" + "Open in Maps" buttons
- "Open in Maps" → `RekkusActionSheet` to choose Apple Maps or Google Maps
- Map stays live/pannable while card is open; tap map to dismiss card
- Dark-mode map tiles use a richer Rekkus dark style with blue water, green parks, warm roads, readable labels, and distinct POIs rather than a black/grey-only treatment.
- Locate control requests GPS only when tapped; saved places still render without location permission.
- `useFocusEffect` refreshes data on tab focus
- Saved posts and saved places hydrate from a best-effort device cache while Supabase refreshes.

### Profile

- Username top bar + settings gear (navigates to /settings)
- Centered 80px avatar circle with initials
- Reviewer badge pill (✦ Explorer / Quality hunter / Prolific reviewer / Local expert) — computed from post count + avg food rating
- Stats card (surface card): Posts / Followers / Following
- Bio and location tag (suburb, city, country — fetched from Supabase)
- Food stats strip: avg food rating · saved spots count · total likes received
- **Taste Profile card**: top 3 cuisines by avg food rating, preferred spend range, avg vibe score — shown when ≥3 posts with cuisine data exist
- Favourite spots horizontal scroll (from `useSavedLocations`) — conditional, hidden if empty
- Edit profile / Share action buttons
- Text-label tabs: Posts / Saved / Liked
- 3-column thumbnail grid with mock images (picsum.photos)
- All three grids paginated: Saved/Liked via cursor-based Supabase pages (20/page); Posts via client-side slice (30/page); "Load more" button in ThumbGrid footer
- Auth gate on mount — guests are prompted before accessing

### Other user profiles (`app/user/[username].tsx`)

- Accessible by tapping any creator name in feed, post detail, or search
- Same centred layout with reviewer badge + stats card + bio
- Follow + Message buttons (Follow auth-gated; Message is auth-gated and opens/reuses a direct thread behind `directMessages`)
- Posts-only tab (Saved/Liked are private)
- Posts grid paginated (30/page, client-side) via `usePagedList`

### Restaurant feature

- Location pill on post detail → taps open Restaurant info screen
- Geocode-on-tap for old posts with no coordinates (Places Text Search API)
- Bookmark icon next to location pill on post detail to save/unsave
- **Restaurant info screen** (`restaurants/[restaurantId].tsx`):
  - Photo carousel (up to 6 photos, horizontal scroll, 220px) prefers Rekkus post photos before Google Places photos.
  - "No images available" placeholder when none exist
  - Name, category, price level, Open/Closed badge (from Google Places Details API)
  - Ratings card: Google ⭐ rating + review count; Rekkus 🍴/🎭/💰 averages in one surface block
  - Rekkus ratings computed from PostsContext posts matched by placeId or restaurant name
  - "Improve this place" action sheet lets authenticated users suggest metadata edits, report duplicates, submit community verification, or submit an ownership claim.
  - Contact rows: address (→ `RekkusActionSheet` Apple/Google Maps), phone (→ `tel:`), website (→ in-app browser), hours (collapsible — shows today by default, tap to expand all days)
  - **Popular dishes**: aggregated from `dish_tags` across all posts; horizontal chip row; shows name + count badge when tagged by multiple posts
  - Posts section: compact rows (60×60 thumbnail, creator, title, ratings, likes)
  - Post sort — `RekkusActionSheet`: Most liked (default), Newest, Oldest
  - **Recency-weighted Rekkus ratings**: posts within last 90 days count 2×; shows "(based on recent reviews)" when recent posts exist
  - **Most mentioned dishes**: aggregated from `best_dish` on posts; mentions with canonical `dish_id` open dish detail, while unlinked legacy text stays display-only.
  - Header: back button, navigation icon (→ full-screen map), bookmark icon (save/unsave)
- **Restaurant map screen** (`restaurants/[restaurantId]/map.tsx`):
  - Full-screen Google Maps with single pin
  - Tap pin → Reanimated bottom card slides up: name, ⭐ Google rating, Open/Closed badge, Rekkus ratings, phone
  - "Open in Maps" → `RekkusActionSheet` (Apple Maps / Google Maps)
  - Tap map to dismiss card (debounced to avoid marker/map press conflict)
- Canonical dish detail pages (`/dishes/[dishId]`) show first-party linked-post imagery/evidence, the canonical restaurant, bookmarking, and collection actions; no provider image lookup or free-text canonical guessing.
- `Saved` is the visible tab destination: overview first, then Dishes, Places, Posts, and Collections drill-ins. `Saved > Places` retains list/map, intent status, permission, and post-visit prompt behaviour.
- `saved_locations` stores private saved restaurant intent; `saved_dishes` stores private canonical dish bookmarks; post bookmarks remain in `saves`.
- Collections organise saved content and can contain canonical dishes, posts, and restaurants. Adding an item ensures its bookmark exists; confirmed unsave removes its collection memberships atomically.
- Map selected-place card can toggle a saved restaurant between Want to try and Been here.
- `restaurants` table with canonical Rekkus IDs plus first-party provenance, verification status, source/alias/cache/observation/audit tables, and user-created restaurant RPC for self-reliant restaurant identity.
- `food_rating`, `vibe_rating`, `cost_rating` columns on `posts` table (migration `20240110000000_post_ratings.sql`)

### Post detail

- Full-width `PostMediaCarousel` supports mixed photos/videos with compatibility fallback for old image/video fields
- Supabase-first post lookup by UUID when opened from a deep link or refreshed live feed/search row
- Post detail tracks post view, like/save/comment, dwell time, and restaurant revisit signals through privacy-safe analytics.
- Compact like / comment / save / share action bar with optimistic rollback and inline `ErrorMessage` feedback on write failures
- Follow pill button
- Rekkus Picks summary appears near the top when available. Post detail no longer shows legacy Food/Vibe/Cost cards; old numeric fields remain compatibility data for rendering/search fallbacks.
- Owners can open **Edit post** from the post options sheet. Edits reuse the Create composer, save to the same post ID, and record privacy-minimized edit evidence.
- Location pill with bookmark icon — save location directly from post; geocode failures show inline `ErrorMessage` feedback
- Tappable hashtag pills open Search with the tag prefilled
- Shared post message cards route back to Post Detail
- **Reactions row**: Helpful 👍 / Love This ❤️ / Thanks 🙏 / Oh No 😬 — stored in `post_reactions` table, toggleable, auth-gated
- Comment input + send button
- **Comment threading**: tap Reply on any comment → indented reply with thread line; reply banner in input bar shows "Replying to @username" with dismiss (✕); `comment_reply` push notification sent to parent comment author; replies shown in `useAlerts` under new `comment_reply` type
- All interactive actions (like, save, follow, comment send, reply) gated — guests shown auth prompt

### Auth flow

- Email + password sign-in
- Email + password sign-up (2 steps: credentials → profile)
- Profile setup requires 3+ food interests stored as `user_topic_follows` for initial Discover ranking.
- Google OAuth (WebBrowser + token extraction + setSession)
- Forgot password — sends reset email via `resetPasswordForEmail`; success state shows inbox prompt
- Password recovery deep link — `DeepLinkHandler` in `_layout.tsx` parses recovery tokens from `rekkus://` URL, sets session, navigates to reset-password screen
- Reset password screen — sets new password via `supabase.auth.updateUser({ password })`; navigates to feed on success
- Session persistence via Supabase (expo-sqlite/localStorage)
- Soft auth gate — guests browse freely, prompted on interaction
- `AuthContext` — user, session, loading; signIn/signUp/updateProfile/signInWithGoogle/resetPasswordForEmail/linkGoogle/unlinkIdentity/signOut
- `AuthGateContext` — `requireAuth()` shows bottom sheet modal if not signed in
- `AuthPromptModal` — bottom sheet with "Join Rekkus." CTA

### Settings

- Settings hub with sections: Account, Notifications, Privacy, Appearance, About, Danger zone
- Toggles persisted to `user_settings` Supabase table (upsert on change)
- **Appearance / Theme**: 3-way selector — Light, Dark, Follow OS. Stored as `theme_mode TEXT ('light'|'dark'|'system')` in `user_settings`. `'system'` resolves via `useColorScheme()` at runtime. Map tiles (Google Maps) apply a dark tile style (`constants/mapStyles.ts`) when dark mode is active.
- Notification toggles include likes, comments/replies, followers, mentions/tags, and private messages
- Edit profile: avatar upload (expo-image-picker → Supabase Storage), username, display name, bio
- Change email: re-auth then `supabase.auth.updateUser({ email })`
- Change password: re-auth then `supabase.auth.updateUser({ password })`
- Connected accounts: shows Google identity from `user.identities`; connect via `linkIdentity`; disconnect via `unlinkIdentity` (blocked if sole identity)
- Sign out: confirmation alert → `supabase.auth.signOut()`
- Delete account: confirmation alert → contact support prompt

### Compliance and trust gaps

- Report/block/moderation foundation exists for posts, comments, and profiles; full admin moderation dashboard remains future work before public UGC scale.
- Location-powered flows use contextual permission and manual suburb/postcode fallback; precise coordinates stay out of analytics.
- Privacy/data requests are email-routed through the privacy screen until full self-serve deletion/export automation ships.
- Food safety, health inspection, and allergen claims are intentionally not a current product surface.

---

→ See [../docs/architecture/ARCHITECTURE.md](../docs/architecture/ARCHITECTURE.md) for stack, project structure, DB schema, hooks, and integrations.
→ See [../BACKLOG.md](../BACKLOG.md) for all outstanding work.
