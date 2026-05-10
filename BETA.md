# Beta / Launch Checklist

Everything that must be turned on, wired up, or changed before the app goes to beta testing or live.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Auth & Email

- [ ] Switch Supabase Auth from Inbucket (local dev) to Resend SMTP — configure in Supabase Dashboard → Auth → SMTP
- [ ] Confirm prod Supabase Auth redirect URLs (deep link scheme, e.g. `rekkus://`)
- [ ] Enable email confirmation in prod (currently may be disabled for dev)
- [ ] Set auth rate limits (sign-up, OTP, password reset) appropriate for prod volume

---

## Environment

- [ ] Set `EXPO_PUBLIC_SUPABASE_URL` → prod project URL
- [ ] Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` → prod anon key
- [ ] Set `EXPO_PUBLIC_GOOGLE_PLACES_KEY` → prod key with billing enabled and domain/bundle restrictions
- [ ] Confirm Google Places API quota is sufficient for expected search volume
- [ ] Remove any hardcoded dev values (check all `process.env.EXPO_PUBLIC_*` usages)

---

## Data Layer

- [ ] Replace `PostsContext` mock `POSTS` array with real Supabase query (`posts` table, ordered by `created_at DESC`)
- [ ] Add `created_at` to `Post` interface once reading from Supabase
- [ ] Wire `PostsContext.refresh()` to re-fetch from Supabase (currently resets to mock array)
- [ ] Add pagination / infinite scroll to feed (currently loads all posts at once)

---

## Social Graph

- [ ] Implement Follow / Unfollow — write to `follows` table (follower_id, following_id)
- [ ] Filter `useFollowingFeed` to posts from followed users (`follows` table join)
- [ ] Update follow count on profile after follow/unfollow

---

## Feed & Discover

- [ ] Add `created_at` to Post → enable time decay scoring in `useFollowingFeed`
- [ ] Replace hardcoded `'Sydney'` city in `useDiscover` with `useUserLocation().city` (GPS)
- [ ] Wire `post_save` / `post_like` analytics events — use to power trending pool in Discover
- [ ] Engagement velocity boost: weight early engagement 1.5× (needs `created_at`)
- [ ] Empty Following state: show suggested people + CTA to Discover when no followed users

---

## Analytics

- [ ] Add `post_view` event tracking in `app/post/[id].tsx` on screen load
- [ ] Add `post_save` event in `toggleSave` handlers (`post/[id].tsx`, `location/[placeId].tsx`)
- [ ] Add `post_like` event in `toggleLike` handler (`post/[id].tsx`)
- [ ] Confirm `analytics_events` RLS allows insert for authenticated users only

---

## Search

- [ ] Confirm Google Places Autocomplete key is the same as Places Details key (or separate)
- [ ] Add request throttling / caching if Places API usage is high
- [ ] `useSearchHistory` currently falls back to `{}` for new users — verify Discover still ranks sensibly with no history

---

## Notifications

- [ ] Push notifications — not built. Decide: Expo Notifications + Supabase edge function, or skip for beta?

---

## Deep Linking

- [ ] Configure Expo deep link scheme (`app.json` → `scheme: "rekkus"`)
- [ ] Wire Supabase Auth magic link / OAuth redirect to deep link
- [ ] Test post and profile deep links open the correct screen

---

## App Config (`app.json`)

- [ ] Set production bundle ID (`ios.bundleIdentifier`, `android.package`)
- [ ] Add app icon (1024×1024 PNG, no alpha)
- [ ] Add splash screen image
- [ ] Set correct `version` and `buildNumber` / `versionCode`
- [ ] Configure EAS Build profile (`eas.json`) for production
- [ ] Set `privacy` URLs (Privacy Policy, Terms of Service) for App Store submission

---

## Supabase / Database

- [ ] Audit all table RLS policies — ensure no tables are publicly writable in prod
- [ ] `users` table: confirm insert policy only allows the authenticated user to create their own row
- [ ] `analytics_events`: insert allowed for authenticated users; reads allowed for aggregate queries (no PII leakage)
- [ ] `posts`, `likes`, `saves`, `comments`: confirm delete policies prevent users deleting others' data
- [ ] Run `supabase db push` against prod project after final migration review
- [ ] Set up Supabase backups (Point-in-Time Recovery or scheduled dumps)

---

## Rate Limits & Abuse

- [ ] `analytics_events` insert: add rate limiting (edge function or RLS policy) to prevent spam
- [ ] Auth sign-up: Supabase rate limit configured (default is reasonable but verify)
- [ ] Google Places API: set per-IP / per-user quotas in Google Cloud Console

---

## Performance

- [ ] Test feed scroll performance with 100+ real posts (currently 6 mock)
- [ ] Test image loading — add `expo-image` or `FastImage` if Unsplash-style images are slow
- [ ] Profile `useDiscover` / `useFollowingFeed` memoisation under real data volume
