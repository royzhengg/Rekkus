import { useState, useMemo, useEffect, useRef } from 'react'
import { analytics } from '@/lib/analytics'
import type { Post } from '@/types/domain'
import { useAutocomplete } from './useAutocomplete'
import { usePosts } from '../contexts/PostsContext'
import {
  embedQuery,
  searchSemantic,
  searchTextFallback,
  searchUsers,
  parsePlaceDisplayData,
  parseDishDisplayData,
  searchPlacesByBounds,
  logSearchQuery,
} from '../services/search'
import { haversineKm } from '../utils/geo'
import type {
  DishResult,
  PersonResult,
  PlaceResult,
  SearchFilters,
  SearchMode,
  SearchOptions,
  SearchSortMode,
  SearchSuggestion,
  TopFeedItem,
  UserLocation,
} from './searchTypes'

// Re-export shared types so existing callers keep working
export type { DishResult, PlaceResult, SearchFilters, TopFeedItem, UserLocation, SearchOptions, PersonResult, SearchMode, SearchSortMode, SearchSuggestion }

const AVATAR_BG_COLORS = ['#F5E6D8', '#D8E8F5', '#E8F5D8', '#F5D8E8', '#F5F5D8']
const AVATAR_TEXT_COLORS = ['#8B4513', '#1A5276', '#1A6B2A', '#7B1A5A', '#6B6B1A']

function mapUserToPersonResult(user: {
  id: string
  username: string
  full_name: string | null
  follower_count: number
  post_count: number
}, index: number): PersonResult {
  const displayName = user.full_name ?? user.username
  const initials = displayName
    .split(/\s+/)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const colorIdx = index % AVATAR_BG_COLORS.length
  const followerCount = user.follower_count
  const followers =
    followerCount >= 1_000_000
      ? `${(followerCount / 1_000_000).toFixed(1)}M`
      : followerCount >= 1_000
      ? `${(followerCount / 1_000).toFixed(1)}K`
      : `${followerCount}`
  return {
    username: user.username,
    displayName,
    initials,
    avatarBg: AVATAR_BG_COLORS[colorIdx] ?? '#EDE4DA',
    avatarColor: AVATAR_TEXT_COLORS[colorIdx] ?? '#5F5F5A',
    followers,
    followerCount,
  }
}

function matchesPlaceFilters(place: PlaceResult, filters: SearchFilters | undefined): boolean {
  if (!filters) return true
  if (filters.cuisine && place.cuisine_type?.toLowerCase() !== filters.cuisine.toLowerCase()) return false
  return true
}

export function useSearch(
  query: string,
  userLocation: UserLocation = null,
  options: SearchOptions = {}
) {
  const { posts } = usePosts()
  const [postResults, setPostResults] = useState<Post[]>([])
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([])
  const [placeDistances, setPlaceDistances] = useState<Map<string, number>>(new Map())
  const [dishEntityResults, setDishEntityResults] = useState<DishResult[]>([])
  const [peopleResults, setPeopleResults] = useState<PersonResult[]>([])
  const [topFeed, setTopFeed] = useState<TopFeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

  const suggestions = useAutocomplete(query, userLocation)

  const trimmed = query.trim()
  const mode = options.mode ?? 'search'
  const isAroundMe = mode === 'aroundMe'
  const filters = options.filters

  const postById = useMemo(
    () => new Map(posts.map(p => [p.dbId, p])),
    [posts]
  )

  useEffect(() => {
    const requestId = ++requestIdRef.current

    function clear() {
      setPostResults([])
      setPlaceResults([])
      setPlaceDistances(new Map())
      setDishEntityResults([])
      setPeopleResults([])
      setTopFeed([])
      setLoading(false)
    }

    if (!trimmed && !isAroundMe) {
      clear()
      return
    }

    if (isAroundMe && !userLocation) {
      clear()
      return
    }

    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        if (isAroundMe && userLocation) {
          // Around-me: bounding box place search, no vector
          const radiusKm = options.radiusKm ?? 10
          const latDelta = radiusKm / 111
          const lngDelta = radiusKm / (111 * Math.cos((userLocation.lat * Math.PI) / 180))
          const bounds = {
            min_lat: userLocation.lat - latDelta,
            max_lat: userLocation.lat + latDelta,
            min_lng: userLocation.lng - lngDelta,
            max_lng: userLocation.lng + lngDelta,
          }
          const places = await searchPlacesByBounds(bounds)
          if (requestId !== requestIdRef.current) return

          const distances = new Map<string, number>()
          for (const p of places) {
            if (p.latitude != null && p.longitude != null) {
              distances.set(p.id, haversineKm(userLocation.lat, userLocation.lng, p.latitude, p.longitude))
            }
          }
          const filtered = places.filter(p => matchesPlaceFilters(p, filters))
          setPlaceResults(filtered)
          setPlaceDistances(distances)
          setPostResults([])
          setDishEntityResults([])
          setPeopleResults([])
          setTopFeed(filtered.slice(0, 12).map(p => {
            const distanceKm = distances.get(p.id)
            return distanceKm != null
              ? { kind: 'place' as const, data: p, distanceKm }
              : { kind: 'place' as const, data: p }
          }))
          setLoading(false)
          return
        }

        // Run semantic (for posts/dishes + embedded places) and text fallback
        // (for the 58k OSM places without embeddings) in parallel. Merge and
        // deduplicate so both sources contribute to results.
        const [embedding, users] = await Promise.all([
          embedQuery(trimmed),
          searchUsers(trimmed),
        ])

        if (requestId !== requestIdRef.current) return

        const [semanticRows, fallbackRows] = await Promise.all([
          embedding
            ? searchSemantic(embedding, options.userId, 50, userLocation?.lat, userLocation?.lng)
            : Promise.resolve([]),
          searchTextFallback(trimmed, 20, userLocation?.lat, userLocation?.lng),
        ])

        if (requestId !== requestIdRef.current) return

        let newPostResults: Post[] = []
        let newPlaceResults: PlaceResult[] = []
        let newDishResults: DishResult[] = []
        const newTopFeed: TopFeedItem[] = []
        const distances = new Map<string, number>()
        const seenPlaceIds = new Set<string>()
        const seenDishIds = new Set<string>()
        const q = trimmed.toLowerCase()

        // Process semantic results first (posts + dishes + high-confidence embedded places)
        for (const row of semanticRows) {
          if (row.entity_type === 'place') {
            const place = parsePlaceDisplayData({ ...row.display_data, id: row.entity_id })
            // Drop semantic place results where cuisine_type is set and clearly
            // doesn't match the query — prevents "Japanese" for "Indian" searches.
            if (
              place.cuisine_type &&
              !place.cuisine_type.toLowerCase().includes(q) &&
              !place.name.toLowerCase().includes(q)
            ) continue
            if (!matchesPlaceFilters(place, filters)) continue
            seenPlaceIds.add(place.id)
            newPlaceResults.push(place)
            if (userLocation && place.latitude != null && place.longitude != null) {
              distances.set(place.id, haversineKm(userLocation.lat, userLocation.lng, place.latitude, place.longitude))
            }
          } else if (row.entity_type === 'post') {
            const post = postById.get(row.entity_id)
            if (post) newPostResults.push(post)
          } else if (row.entity_type === 'dish') {
            seenDishIds.add(row.entity_id)
            newDishResults.push(parseDishDisplayData(row.entity_id, row.display_data))
          }
        }

        // Merge text fallback results — adds OSM places without embeddings
        for (const row of fallbackRows) {
          if (row.entity_type === 'place') {
            if (seenPlaceIds.has(row.entity_id)) continue
            const place = parsePlaceDisplayData({ ...row.display_data, id: row.entity_id })
            if (!matchesPlaceFilters(place, filters)) continue
            seenPlaceIds.add(place.id)
            newPlaceResults.push(place)
            if (userLocation && place.latitude != null && place.longitude != null) {
              distances.set(place.id, haversineKm(userLocation.lat, userLocation.lng, place.latitude, place.longitude))
            }
          } else if (row.entity_type === 'dish') {
            if (seenDishIds.has(row.entity_id)) continue
            seenDishIds.add(row.entity_id)
            newDishResults.push(parseDishDisplayData(row.entity_id, row.display_data))
          }
        }

        // Sort places: nearby first (when location available), then by name relevance
        newPlaceResults.sort((a, b) => {
          const da = distances.get(a.id) ?? Infinity
          const db = distances.get(b.id) ?? Infinity
          return da - db
        })

        // Build topFeed from merged sorted places + posts + dishes
        for (const place of newPlaceResults) {
          if (newTopFeed.length >= 12) break
          const distanceKm = distances.get(place.id)
          newTopFeed.push(distanceKm != null ? { kind: 'place', data: place, distanceKm } : { kind: 'place', data: place })
        }
        for (const post of newPostResults) {
          if (newTopFeed.length >= 12) break
          newTopFeed.push({ kind: 'post', data: post })
        }
        for (const dish of newDishResults) {
          if (newTopFeed.length >= 12) break
          newTopFeed.push({ kind: 'dish', data: dish })
        }

        const newPeopleResults = users.map((u, i) => mapUserToPersonResult(u, i))
        // Add people to top feed (after entity results)
        for (const pr of newPeopleResults) {
          if (newTopFeed.length >= 12) break
          newTopFeed.push({ kind: 'person', data: pr })
        }

        void analytics.search(options.userId ?? null, trimmed, newPostResults.length + newPlaceResults.length + newDishResults.length)

        const totalResults = newPostResults.length + newPlaceResults.length + newDishResults.length
        logSearchQuery({
          userId: options.userId ?? null,
          query: trimmed,
          resultsCount: totalResults,
          searchLat: userLocation?.lat ?? null,
          searchLng: userLocation?.lng ?? null,
          sessionId: options.sessionId ?? null,
        })

        setLoading(false)
        setPostResults(newPostResults)
        setPlaceResults(newPlaceResults)
        setPlaceDistances(distances)
        setDishEntityResults(newDishResults)
        setPeopleResults(newPeopleResults)
        setTopFeed(newTopFeed)
      } catch {
        if (requestId !== requestIdRef.current) return
        setLoading(false)
        setPostResults([])
        setPlaceResults([])
        setPlaceDistances(new Map())
        setDishEntityResults([])
        setPeopleResults([])
        setTopFeed([])
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      if (requestIdRef.current === requestId) requestIdRef.current += 1
    }
  }, [trimmed, isAroundMe, userLocation, options.userId, options.radiusKm, options.sessionId, postById, filters])

  return {
    postResults,
    peopleResults,
    placeResults,
    placeDistances,
    dishEntityResults,
    topFeed,
    suggestions,
    loading,
    hasQuery: trimmed.length > 0 || isAroundMe,
  }
}
