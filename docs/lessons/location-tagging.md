# Location Tagging

How location works in Rekkus — and the rules any new entry point must follow.

## How it works

Every piece of user content (post, shared place in messages) is linked to a **place row** via a `place_id` foreign key. The place row owns all location data: name, address, coordinates, Google Place ID. Content rows never store coordinates or name strings directly.

At display time, a JOIN to `places` yields `place_name`, `place_address`, `place_lat`, `place_lng` on the read model. These flow through as `post.location`, `post.address`, `post.lat`, `post.lng` on the domain type.

## The primitives (always reuse these)

| Need | Use |
| --- | --- |
| User's device GPS | `UserLocationContext` via `useUserLocation()` hook |
| Place search UI | `<PlacePicker>` component (`components/PlacePicker/`) |
| Place search logic | `usePlaceSearch` hook |
| Result of a user picking a place | `SelectedPlace` type from `lib/services/places` |
| Writing a new Google Places result to DB | `upsertPlace()` from `lib/services/places` |
| Rendering a tagged location | `<LocationTag>` component (`components/LocationTag.tsx`) |

## Rules

**Never call `expo-location` directly in a screen or feature.** Use `useUserLocation()` which reads from `UserLocationContext`. The context requests GPS once, persists via AsyncStorage, and broadcasts to all consumers.

**Never build a custom place picker.** Use `<PlacePicker value={...} onSelect={...} onClear={...} />`. It owns the search input, nearby chips, distance-grouped dropdown, and `SelectedPlace` output internally.

**Never insert to the `places` table inline.** Always call `upsertPlace(detail, googlePlaceId, cuisine)` — it handles the upsert with `onConflict: 'google_place_id'` correctly.

**Never store raw coordinates or a place name string on a content row.** Store `place_id` (UUID FK). Coordinates and name come from the JOIN at read time.

**Never re-implement the pin-icon + name display.** Use `<LocationTag name={post.location} onPress={...} />`.

## DB pattern

```
posts.place_id → places.id
places { latitude, longitude, restaurant_geog (PostGIS geography column) }
```

Nearby queries use `places_within_radius(p_lat, p_lng, p_radius_metres)` — a PostGIS `ST_DWithin` function. Do not add new bounding-box or client-side Haversine calculations.

## Draft safety

When resuming a `post_drafts` row, always validate `selected_place.placeId` against the live `places` table before pre-filling the form. If the row no longer exists, clear `selectedPlace` and surface a toast to the user.

## Distance labels

The distance grouping thresholds (≤2km Nearby, ≤50km Further away, ≤250km Regional, ≤4000km National) are defined in `distanceGroupForPrediction()` in `lib/services/places.ts`. Labels are in `DISTANCE_GROUP_LABELS` in `components/PlacePicker/`. Edit in one place, changes everywhere.
