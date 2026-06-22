import { useMemo } from 'react'
import type { Post } from '@/types/domain'
import { haversineKm } from '../utils/geo'
import {
  computePeopleResults,
  matchesPlaceFilters,
  matchesPostFilters,
  sortPosts,
} from '../utils/searchScoring'
import type { PlaceResult, PersonResult, SearchFilters, TopFeedItem, UserLocation } from './searchTypes'
import type { CuisineAffinities } from './useSearchHistory'
import type { SearchCandidate } from '../search/types'
import type {
  CuisineExpansion,
  GooglePrediction,
} from '../utils/searchScoring'

export type { PersonResult, PlaceResult }
export type { CuisineExpansion, GooglePrediction }

interface UseSearchResultsArgs {
  candidates: SearchCandidate[]
  hydratedPosts: Post[]
  posts: Post[]
  words: string[]
  userLocation: UserLocation
  isAroundMe: boolean
  filters: SearchFilters | undefined
  filtersKey: string
  expansionCuisines: Array<{ cuisine_type: string; match_count: number }>
  query: string
  searchAffinities?: CuisineAffinities
}

interface UseSearchResultsReturn {
  postResults: Post[]
  peopleResults: PersonResult[]
  placeResults: PlaceResult[]
  placeDistances: Map<string, number>
  expansionLabel: string | null
  topFeed: TopFeedItem[]
}

export function useSearchResults({
  candidates,
  hydratedPosts,
  posts,
  words,
  userLocation,
  isAroundMe,
  filters,
  filtersKey: _filtersKey,
  expansionCuisines,
  query,
}: UseSearchResultsArgs): UseSearchResultsReturn {
  const allPosts = useMemo(() => [...posts, ...hydratedPosts], [posts, hydratedPosts])
  const postById = useMemo(
    () => new Map(allPosts.map(p => [p.dbId, p])),
    [allPosts]
  )

  const postResults = useMemo(() => {
    const scored = candidates
      .filter((c): c is SearchCandidate & { kind: 'post' } => c.kind === 'post')
      .map(c => ({ post: postById.get(c.id), score: c.rankingScore }))
      .filter((x): x is { post: Post; score: number } => x.post != null)
      .filter(x => matchesPostFilters(x.post, filters))
    return sortPosts(scored, filters, userLocation).map(x => x.post)
  }, [candidates, postById, filters, userLocation])

  const dbUsers = useMemo(
    () =>
      candidates
        .filter((c): c is SearchCandidate & { kind: 'person' } => c.kind === 'person')
        .map(c => c.item),
    [candidates]
  )

  const peopleResults = useMemo(
    () => computePeopleResults({ words, dbUsers, isAroundMe }),
    [words, dbUsers, isAroundMe]
  )

  const personResultByUserId = useMemo(() => {
    const map = new Map<string, PersonResult>()
    dbUsers.forEach((user, i) => {
      const pr = peopleResults[i]
      if (pr) map.set(user.id, pr)
    })
    return map
  }, [dbUsers, peopleResults])

  const { placeResults, placeDistances } = useMemo(() => {
    const places: PlaceResult[] = []
    const distances = new Map<string, number>()

    for (const c of candidates) {
      if (c.kind !== 'place') continue
      const place = c.item
      if (!matchesPlaceFilters(place, filters)) continue
      places.push(place)
      if (userLocation && place.latitude != null && place.longitude != null) {
        distances.set(place.id, haversineKm(userLocation.lat, userLocation.lng, place.latitude, place.longitude))
      }
    }

    return { placeResults: places, placeDistances: distances }
  }, [candidates, filters, userLocation])

  const topFeed = useMemo((): TopFeedItem[] => {
    const result: TopFeedItem[] = []
    for (const c of candidates) {
      if (result.length >= 12) break
      if (c.kind === 'post') {
        const post = postById.get(c.id)
        if (post && matchesPostFilters(post, filters)) result.push({ kind: 'post', data: post })
      } else if (c.kind === 'place') {
        if (matchesPlaceFilters(c.item, filters)) {
          const distanceKm =
            userLocation && c.item.latitude != null && c.item.longitude != null
              ? haversineKm(userLocation.lat, userLocation.lng, c.item.latitude, c.item.longitude)
              : undefined
          result.push({ kind: 'place', data: c.item, ...(distanceKm !== undefined ? { distanceKm } : {}) })
        }
      } else if (c.kind === 'person') {
        const pr = personResultByUserId.get(c.id)
        if (pr) result.push({ kind: 'person', data: pr })
      } else if (c.kind === 'dish') {
        result.push({ kind: 'dish', data: c.item })
      }
    }
    return result
  }, [candidates, postById, filters, userLocation, personResultByUserId])

  const expansionLabel = useMemo(() => {
    if (words.length === 0 || isAroundMe || expansionCuisines.length === 0) return null
    const usedExpansion = candidates.some(c => c.source === 'expanded')
    if (!usedExpansion) return null
    const cuisines = expansionCuisines.slice(0, 2).map(c => c.cuisine_type)
    if (cuisines.length === 0) return null
    return `Showing ${cuisines.join(' / ')} results related to ${query.trim()}`
  }, [words.length, expansionCuisines, query, candidates, isAroundMe])

  return { postResults, peopleResults, placeResults, placeDistances, expansionLabel, topFeed }
}
