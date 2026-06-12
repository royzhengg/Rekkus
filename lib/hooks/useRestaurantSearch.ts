import { useState, useRef, useCallback, useEffect } from 'react'
import { analytics } from '@/lib/analytics'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import {
  distanceGroupForPrediction,
  fetchPredictions,
  fetchPlaceDetails,
  upsertPlaceStubs,
  upsertRestaurant,
  searchRestaurantsByText,
  fetchNearbyRestaurants,
} from '@/lib/services/restaurants'
import type { Prediction, SelectedPlace } from '@/lib/services/restaurants'
import {
  classifyRestaurantTagIntent,
  decideSearchProviderFallback,
  resolveLocationSource,
} from '@/lib/utils/searchIntent'
import type { RestaurantTagIntent } from '@/lib/utils/searchIntent'

type UseRestaurantSearchParams = {
  cuisineType: string
  userId?: string | null | undefined
  onPlaceSelected: (place: SelectedPlace | null) => void
}

type RestaurantSelectionSource = 'nearby' | 'prediction'

const RESTAURANT_TAG_DB_RESULT_LIMIT = 12
const RESTAURANT_TAG_PROVIDER_TOP_UP_THRESHOLD = 6
const RESTAURANT_TAG_VISIBLE_RESULT_LIMIT = 10

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
  locationStatus: ReturnType<typeof useUserLocation>['status']
  locationConstrained: boolean
  restaurantTagIntent: RestaurantTagIntent
  requestLocationAndSearch: () => Promise<void>
  handleSearchChange: (text: string) => void
  selectPrediction: (item: Prediction, source?: RestaurantSelectionSource) => Promise<void>
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
    .map(({ item }) => ({
      ...item,
      distanceGroup: item.distanceGroup ?? distanceGroupForPrediction(item.distanceKm, item.source),
    }))
}

function groupPredictionsByDistance(predictions: Prediction[]): Prediction[] {
  const order: NonNullable<Prediction['distanceGroup']>[] = [
    'nearby',
    'city',
    'state',
    'country',
    'worldwide',
  ]
  return order.flatMap(group => predictions.filter(item => item.distanceGroup === group))
}

function fallbackPlaceCountForTagging(localPlaceCount: number): number {
  return localPlaceCount > 0 && localPlaceCount < RESTAURANT_TAG_PROVIDER_TOP_UP_THRESHOLD
    ? 0
    : localPlaceCount
}

export function useRestaurantSearch({
  cuisineType,
  userId,
  onPlaceSelected,
}: UseRestaurantSearchParams): UseRestaurantSearchReturn {
  const userLocation = useUserLocation()
  const { status: locationStatus, requestLocation } = userLocation

  const [locationSearch, setLocationSearch] = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [predictionsLoading, setPredictionsLoading] = useState(false)
  const [selectingPlace, setSelectingPlace] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [nearbyPlaces, setNearbyPlaces] = useState<Prediction[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [restaurantTagIntent, setRestaurantTagIntent] = useState<RestaurantTagIntent>({
    kind: 'general',
    providerIntent: 'general',
    confidence: 0.2,
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestRef = useRef(0)
  const nearbyRequestRef = useRef(0)
  const selectionRequestRef = useRef(0)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const locationSearchRef = useRef(locationSearch)
  locationSearchRef.current = locationSearch
  // Always-current coords — avoids stale closure in handleSearchChange
  const latestCoordsRef = useRef(userLocation.coords)
  latestCoordsRef.current = userLocation.coords

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
    (text: string, coordsOverride?: ReturnType<typeof useUserLocation>['coords']) => {
      setLocationSearch(text)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const requestId = searchRequestRef.current + 1
      searchRequestRef.current = requestId
      const query = text.trim()
      const nextRestaurantTagIntent = classifyRestaurantTagIntent(query)
      setRestaurantTagIntent(nextRestaurantTagIntent)
      if (query.length < 2) {
        setPredictions([])
        setPredictionsLoading(false)
        return
      }
      setPredictionsLoading(true)
      // Snapshot coords at call time: prefer explicit override (from requestLocationAndSearch),
      // otherwise use the always-current ref so we never capture a stale closure.
      const effectiveCoords = coordsOverride !== undefined ? coordsOverride : latestCoordsRef.current
      debounceRef.current = setTimeout(() => {
        // DB-first: query restaurants table via FTS (GIN index), then Google for new places
        void (async () => {
          try {
            analytics.restaurantSearchTermEntered(userId ?? null, query)
            const dbResults = await searchRestaurantsByText(
              query,
              RESTAURANT_TAG_DB_RESULT_LIMIT,
              effectiveCoords
            )
            if (!mountedRef.current || searchRequestRef.current !== requestId) return
            const tagIntent = classifyRestaurantTagIntent(query)
            const locationSource = resolveLocationSource(locationStatus, effectiveCoords != null)
            const topUpThinLocalResults =
              dbResults.length > 0 && dbResults.length < RESTAURANT_TAG_PROVIDER_TOP_UP_THRESHOLD
            const fallbackDecision = decideSearchProviderFallback({
              hasLocality: effectiveCoords != null,
              intent: tagIntent.providerIntent,
              localPlaceCount: fallbackPlaceCountForTagging(dbResults.length),
              expandedPlaceCount: 0,
            })
            const fallbackReason = topUpThinLocalResults && fallbackDecision.shouldUseGoogleFallback
              ? 'thin_local_results'
              : fallbackDecision.reason
            const googleResults = fallbackDecision.shouldUseGoogleFallback
              ? await fetchPredictions(query, effectiveCoords)
              : []
            if (fallbackDecision.shouldUseGoogleFallback) {
              analytics.restaurantTaggingGoogleFallbackUsed(
                userId ?? null,
                query,
                tagIntent.kind,
                fallbackReason,
                effectiveCoords != null,
                locationSource
              )
              // Best-effort: persist place_id stubs so future searches hit our DB first
              void upsertPlaceStubs(googleResults)
            } else if (fallbackDecision.suppressed) {
              analytics.restaurantTaggingGoogleFallbackSuppressed(
                userId ?? null,
                query,
                tagIntent.kind,
                fallbackReason,
                locationSource
              )
            }
            if (!mountedRef.current || searchRequestRef.current !== requestId) return
            const merged = groupPredictionsByDistance(
              mergeRestaurantPredictions(dbResults, googleResults)
            ).slice(0, RESTAURANT_TAG_VISIBLE_RESULT_LIMIT)
            if (merged.length === 0) {
              analytics.restaurantSearchZeroResults(userId ?? null, query)
            }
            setPredictions(merged)
          } finally {
            if (mountedRef.current && searchRequestRef.current === requestId) {
              setPredictionsLoading(false)
            }
          }
        })()
      }, 300)
    },
    [userId, locationStatus]
  )

  const requestLocationAndSearch = useCallback(async () => {
    setSearchFocused(true)
    const freshCoords = await requestLocation()
    if (freshCoords && locationSearchRef.current.trim().length >= 2) {
      handleSearchChange(locationSearchRef.current, freshCoords)
    }
  }, [requestLocation, handleSearchChange])

  const selectPrediction = useCallback(
    async (item: Prediction, source: RestaurantSelectionSource = 'prediction') => {
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
          analytics.restaurantSelected(
            userId ?? null,
            item.place_id,
            source,
            item.dbDetails.restaurantId,
            cuisineType || undefined
          )
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
        analytics.restaurantSelected(
          userId ?? null,
          item.place_id,
          source,
          restaurantId,
          cuisineType || undefined
        )
      }
      if (mountedRef.current && selectionRequestRef.current === requestId) {
        setSelectingPlace(false)
      }
    },
    [cuisineType, onPlaceSelected, userId]
  )

  const onSearchFocus = useCallback(() => {
    setSearchFocused(true)
    if (!locationSearch && userLocation.coords) {
      const requestId = ++nearbyRequestRef.current
      setNearbyLoading(true)
      void fetchNearbyRestaurants(userLocation.coords, 1)
        .then(results => {
          if (mountedRef.current && nearbyRequestRef.current === requestId) {
            setNearbyPlaces(groupPredictionsByDistance(results.map(item => ({
              ...item,
              distanceGroup: item.distanceGroup ?? distanceGroupForPrediction(item.distanceKm, item.source),
            }))))
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
    setRestaurantTagIntent({ kind: 'general', providerIntent: 'general', confidence: 0.2 })
    setPredictionsLoading(false)
    setNearbyPlaces([])
    setNearbyLoading(false)
    setSelectingPlace(false)
  }, [])

  const showNearby =
    searchFocused && locationSearch.length < 2 && (nearbyLoading || nearbyPlaces.length > 0)
  const showDropdown =
    searchFocused && locationSearch.length >= 2 && (predictions.length > 0 || !predictionsLoading)
  const locationConstrained = userLocation.coords != null

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
    locationStatus,
    locationConstrained,
    restaurantTagIntent,
    requestLocationAndSearch,
    handleSearchChange,
    selectPrediction,
    onSearchFocus,
    onSearchBlur,
    clearSearch,
  }
}
