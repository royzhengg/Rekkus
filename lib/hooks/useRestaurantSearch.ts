import { useState, useRef, useCallback, useEffect } from 'react'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import {
  fetchPredictions,
  fetchPlaceDetails,
  upsertRestaurant,
  searchRestaurantsByText,
  fetchNearbyRestaurants,
} from '@/lib/services/restaurants'
import type { Prediction, SelectedPlace } from '@/lib/services/restaurants'

type UseRestaurantSearchParams = {
  cuisineType: string
  onPlaceSelected: (place: SelectedPlace | null) => void
}

type UseRestaurantSearchReturn = {
  locationSearch: string
  predictions: Prediction[]
  predictionsLoading: boolean
  selectingPlace: boolean
  nearbyPlaces: Prediction[]
  nearbyLoading: boolean
  searchFocused: boolean
  showNearby: boolean
  showDropdown: boolean
  handleSearchChange: (text: string) => void
  selectPrediction: (item: Prediction) => Promise<void>
  onSearchFocus: () => void
  onSearchBlur: () => void
  clearSearch: () => void
}

function mergeRestaurantPredictions(
  dbResults: Prediction[],
  googleResults: Prediction[]
): Prediction[] {
  const seen = new Set<string>()
  return [...dbResults, ...googleResults]
    .map((item, index) => ({
      item,
      score:
        (item.source === 'rekkus' || item.dbDetails ? 100 : 0) +
        (item.score ?? 0) -
        index * 0.01,
    }))
    .filter(({ item }) => {
      const name = item.structured_formatting.main_text.toLowerCase()
      const key = item.place_id || name
      const looseKey = name.replace(/\s+/g, ' ').trim()
      if (seen.has(key) || seen.has(looseKey)) return false
      seen.add(key)
      seen.add(looseKey)
      return true
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}

export function useRestaurantSearch({
  cuisineType,
  onPlaceSelected,
}: UseRestaurantSearchParams): UseRestaurantSearchReturn {
  const userLocation = useUserLocation()

  const [locationSearch, setLocationSearch] = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [predictionsLoading, setPredictionsLoading] = useState(false)
  const [selectingPlace, setSelectingPlace] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [nearbyPlaces, setNearbyPlaces] = useState<Prediction[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestRef = useRef(0)
  const nearbyRequestRef = useRef(0)
  const selectionRequestRef = useRef(0)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      searchRequestRef.current += 1
      nearbyRequestRef.current += 1
      selectionRequestRef.current += 1
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    }
  }, [])

  const handleSearchChange = useCallback(
    (text: string) => {
      setLocationSearch(text)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const requestId = searchRequestRef.current + 1
      searchRequestRef.current = requestId
      if (text.length < 2) {
        setPredictions([])
        setPredictionsLoading(false)
        return
      }
      setPredictionsLoading(true)
      debounceRef.current = setTimeout(() => {
        // DB-first: query restaurants table via FTS (GIN index), then Google for new places
        void (async () => {
          try {
            const [dbResults, googleResults] = await Promise.all([
              searchRestaurantsByText(text, 8),
              fetchPredictions(text, userLocation.coords),
            ])
            if (!mountedRef.current || searchRequestRef.current !== requestId) return
            setPredictions(mergeRestaurantPredictions(dbResults, googleResults).slice(0, 8))
          } finally {
            if (mountedRef.current && searchRequestRef.current === requestId) {
              setPredictionsLoading(false)
            }
          }
        })()
      }, 300)
    },
    [userLocation.coords]
  )

  const selectPrediction = useCallback(
    async (item: Prediction) => {
      const requestId = ++selectionRequestRef.current
      searchRequestRef.current += 1
      nearbyRequestRef.current += 1
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setSelectingPlace(true)
      setSearchFocused(false)
      setLocationSearch('')
      setPredictions([])
      setNearbyPlaces([])

      if (item.dbDetails) {
        // Fast path: restaurant already in our DB — no Google API call needed
        if (mountedRef.current && selectionRequestRef.current === requestId) {
          onPlaceSelected({
            placeId: item.place_id,
            name: item.structured_formatting.main_text,
            address: item.dbDetails.address,
            lat: item.dbDetails.lat,
            lng: item.dbDetails.lng,
            restaurantId: item.dbDetails.restaurantId,
          })
          setSelectingPlace(false)
        }
        return
      }

      // Slow path: new restaurant from Google — fetch details and upsert
      const detail = await fetchPlaceDetails(item.place_id)
      if (!mountedRef.current || selectionRequestRef.current !== requestId) return
      if (detail) {
        const restaurantId = await upsertRestaurant(detail, item.place_id, cuisineType || undefined)
        if (!mountedRef.current || selectionRequestRef.current !== requestId) return
        onPlaceSelected({
          placeId: item.place_id,
          name: item.structured_formatting.main_text,
          address: detail.formatted_address,
          lat: detail.geometry.location.lat,
          lng: detail.geometry.location.lng,
          restaurantId,
        })
      }
      if (mountedRef.current && selectionRequestRef.current === requestId) {
        setSelectingPlace(false)
      }
    },
    [cuisineType, onPlaceSelected]
  )

  const onSearchFocus = useCallback(() => {
    setSearchFocused(true)
    if (!locationSearch && userLocation.coords) {
      const requestId = ++nearbyRequestRef.current
      setNearbyLoading(true)
      void fetchNearbyRestaurants(userLocation.coords, 1)
        .then(results => {
          if (mountedRef.current && nearbyRequestRef.current === requestId) {
            setNearbyPlaces(results)
          }
        })
        .finally(() => {
          if (mountedRef.current && nearbyRequestRef.current === requestId) {
            setNearbyLoading(false)
          }
        })
    }
  }, [locationSearch, userLocation.coords])

  const onSearchBlur = useCallback(() => {
    nearbyRequestRef.current += 1
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    blurTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setSearchFocused(false)
    }, 150)
  }, [])

  const clearSearch = useCallback(() => {
    searchRequestRef.current += 1
    nearbyRequestRef.current += 1
    selectionRequestRef.current += 1
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLocationSearch('')
    setPredictions([])
    setPredictionsLoading(false)
    setNearbyPlaces([])
    setNearbyLoading(false)
    setSelectingPlace(false)
  }, [])

  const showNearby =
    searchFocused && locationSearch.length < 2 && (nearbyLoading || nearbyPlaces.length > 0)
  const showDropdown =
    searchFocused && locationSearch.length >= 2 && (predictions.length > 0 || !predictionsLoading)

  return {
    locationSearch,
    predictions,
    predictionsLoading,
    selectingPlace,
    nearbyPlaces,
    nearbyLoading,
    searchFocused,
    showNearby,
    showDropdown,
    handleSearchChange,
    selectPrediction,
    onSearchFocus,
    onSearchBlur,
    clearSearch,
  }
}
