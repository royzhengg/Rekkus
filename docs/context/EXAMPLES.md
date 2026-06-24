# Examples

Side-by-side patterns. Follow the "Good" column.

## 1. Querying Data

```tsx
// GOOD — call a named service function from a hook
// lib/hooks/usePlaceDetail.ts
import { getPlace } from '@/lib/services/places/queries';
const place = await getPlace(placeId);

// BAD — direct Supabase access in a screen
// features/places/PlaceDetailScreen.tsx
import { supabase } from '@/lib/supabase';
const { data } = await supabase.from('places').select('*').eq('id', placeId);
```

## 2. Feature → Service Layering

```tsx
// GOOD — screen → hook → service → supabase
// features/places/PlaceDetailScreen.tsx
const { place } = usePlaceDetail(placeId);

// lib/hooks/usePlaceDetail.ts
const place = await getPlace(placeId);

// lib/services/places/queries.ts
export async function getPlace(id: PlaceId) { /* supabase call here */ }

// BAD — screen → supabase directly (violates service boundary)
// features/places/PlaceDetailScreen.tsx
const { data } = await supabase.from('places').select(...);
```

## 3. Using Domain Types

```tsx
// GOOD — use type aliases from lib/types/
import type { PlaceRow } from '@/lib/types/places';
const place: PlaceRow = data;

// BAD — raw DB type in a feature file
import type { Database } from '@/types/database';
type PlaceRow = Database['public']['Tables']['places']['Row'];
```

## 4. Branded ID Usage

```tsx
// GOOD — use constructor function
import { asPlaceId } from '@/lib/types/branded';
const placeId = asPlaceId(rawString);

// BAD — direct cast (bypasses runtime validation)
const placeId = rawString as PlaceId;
```

## 5. Analytics

```tsx
// GOOD — events ship in the same PR as the feature
// features/places/PlaceDetailScreen.tsx
useEffect(() => {
  trackEvent(EVENTS.PLACE_DETAIL_VIEWED, { place_id: placeId });
}, [placeId]);

// BAD — deferred analytics
// TODO: add analytics for place detail view (follow-up PR)
```

## 6. Type-Safe External Data

```tsx
// GOOD — narrow before use
function isValidPlace(data: unknown): data is PlaceRow {
  return typeof data === 'object' && data !== null && 'id' in data;
}
const parsed: unknown = JSON.parse(raw);
if (!isValidPlace(parsed)) throw new Error('Invalid place payload');

// BAD — cast without narrowing
const place = JSON.parse(raw) as PlaceRow; // no runtime check
```
