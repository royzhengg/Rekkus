import type { SearchSortMode, PlaceResult } from '@/lib/hooks/useSearch'
export { CHIPS } from '@/lib/dataSources/searchQuickStarts'

export const TRENDING = [
  { tag: '#ramen', count: '4.2k posts' },
  { tag: '#sydneybrunch', count: '3.8k posts' },
  { tag: '#hiddengem', count: '2.9k posts' },
  { tag: '#melbournefood', count: '2.1k posts' },
  { tag: '#dumplings', count: '1.7k posts' },
  { tag: '#datenight', count: '1.4k posts' },
]

export const SEARCH_SORTS: Array<{ key: SearchSortMode; label: string }> = [
  { key: 'best_match', label: 'Best match' },
  { key: 'nearby', label: 'Nearby' },
  { key: 'newest', label: 'Newest' },
  { key: 'most_saved', label: 'Most saved' },
  { key: 'highest_rekkus_picks', label: 'Highest Picks' },
]

export type ResultTab = 'top' | 'dishes' | 'people' | 'places'

export const RESULT_TABS: { key: ResultTab; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'dishes', label: 'Dishes' },
  { key: 'places', label: 'Places' },
  { key: 'people', label: 'People' },
]

export function shortPlaceLocation(
  place: Pick<PlaceResult, 'suburb' | 'city' | 'address'>
): string | null {
  if (place.suburb) return place.suburb
  if (place.city) return place.city
  const addressParts = (place.address ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
  return addressParts.slice(0, 2).join(', ') || null
}
