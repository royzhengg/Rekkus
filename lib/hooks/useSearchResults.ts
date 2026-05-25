import { useMemo } from 'react'
import type { Post } from '@/types/domain'
import {
  computePostResults,
  computePeopleResults,
  computePlaceResults,
} from '../utils/searchScoring'
import type { PlaceResult, PersonResult, SearchFilters, UserLocation } from './searchTypes'
import type { CuisineAffinities } from './useSearchHistory'
import type { PopularityCacheRow } from '../services/restaurants'
import type {
  CuisineExpansion,
  GooglePrediction,
} from '../utils/searchScoring'

export type { PersonResult, PlaceResult }
export type { CuisineExpansion, GooglePrediction }

interface UseSearchResultsArgs {
  posts: Post[]
  ftsDbPosts: Post[]
  ftsPostIds: Array<{ id: string; rank: number }>
  expandedDbPosts: Post[]
  dishPostIds: Map<string, { rank: number; match_source: string }>
  dbUsers: Array<{ id: string; username: string; full_name: string | null }>
  words: string[]
  userLocation: UserLocation
  expansionCuisines: CuisineExpansion[]
  isAroundMe: boolean
  filters: SearchFilters | undefined
  filtersKey: string
  dbPlaces: PlaceResult[]
  expandedDbPlaces: PlaceResult[]
  googlePredictions: GooglePrediction[]
  interactionCounts: Map<string, number>
  popularityCache: Map<string, PopularityCacheRow>
  savedRestaurantIds: Set<string>
  radiusKm: number
  searchAffinities: CuisineAffinities
  query: string
}

interface UseSearchResultsReturn {
  postResults: Post[]
  peopleResults: PersonResult[]
  placeResults: PlaceResult[]
  placeDistances: Map<string, number>
  expansionLabel: string | null
}

export function useSearchResults({
  posts,
  ftsDbPosts,
  ftsPostIds,
  expandedDbPosts,
  dishPostIds,
  dbUsers,
  words,
  userLocation,
  expansionCuisines,
  isAroundMe,
  filters,
  filtersKey: _filtersKey,
  dbPlaces,
  expandedDbPlaces,
  googlePredictions,
  interactionCounts,
  popularityCache,
  savedRestaurantIds,
  radiusKm,
  searchAffinities,
  query,
}: UseSearchResultsArgs): UseSearchResultsReturn {
  const { postResults, usedPostExpansion } = useMemo(
    () =>
      computePostResults({
        posts,
        ftsDbPosts,
        ftsPostIds,
        expandedDbPosts,
        dishPostIds,
        words,
        userLocation,
        expansionCuisines,
        isAroundMe,
        filters,
      }),
    [posts, ftsDbPosts, ftsPostIds, expandedDbPosts, dishPostIds, words, userLocation, expansionCuisines, isAroundMe, filters]
  )

  const peopleResults = useMemo(
    () => computePeopleResults({ words, dbUsers, isAroundMe }),
    [words, dbUsers, isAroundMe]
  )

  const { placeResults, placeDistances, usedPlaceExpansion } = useMemo(
    () =>
      computePlaceResults({
        posts,
        dbPlaces,
        expandedDbPlaces,
        expansionCuisines,
        googlePredictions,
        interactionCounts,
        popularityCache,
        searchAffinities,
        userLocation,
        savedRestaurantIds,
        radiusKm,
        isAroundMe,
        words,
        filters,
      }),
    [
      posts,
      words,
      dbPlaces,
      expandedDbPlaces,
      expansionCuisines,
      googlePredictions,
      interactionCounts,
      popularityCache,
      searchAffinities,
      userLocation,
      savedRestaurantIds,
      radiusKm,
      isAroundMe,
      filters,
    ]
  )

  const expansionLabel = useMemo(() => {
    if (
      words.length === 0 ||
      isAroundMe ||
      expansionCuisines.length === 0 ||
      (!usedPostExpansion && !usedPlaceExpansion)
    )
      return null
    const cuisines = expansionCuisines.slice(0, 2).map(c => c.cuisine_type)
    if (cuisines.length === 0) return null
    return `Showing ${cuisines.join(' / ')} results related to ${query.trim()}`
  }, [words.length, expansionCuisines, query, usedPostExpansion, usedPlaceExpansion, isAroundMe])

  return { postResults, peopleResults, placeResults, placeDistances, expansionLabel }
}
