import { isEnabled } from '@/lib/featureFlags'
import { fetchPlaceAutocompleteJson } from '@/lib/services/googlePlaces'
import {
  fetchDishGraphEvidence,
  resolveSearchExpansion,
  searchDishes,
  searchDishPostIds,
  searchPlaces,
  searchPostIds,
  searchUsers,
} from '@/lib/services/search'
import {
  fetchSearchPersonalizationSignals,
  type SearchPersonalizationSignals,
} from '@/lib/services/searchPersonalization'
import {
  fetchTrendingEntitySignals,
  type TrendingEntitySignals,
} from '@/lib/services/trending'
import { cacheResolvedSuburb } from '@/lib/utils/locationResolver'
import { isRecord } from '@/lib/utils/safeJson'
import {
  decideSearchProviderFallback,
  type SearchFallbackDecision,
  type SearchFallbackReason,
} from '@/lib/utils/searchIntent'
import { scorePlace, scorePost } from '@/lib/utils/searchScoring'
import type { Post } from '@/types/domain'
import { rankSearchCandidates } from './ranking'
import type {
  DishPostCandidate,
  DishResult,
  PlaceResult,
  RankedPostCandidate,
  SearchCandidatePayload,
  SearchContext,
  SearchExplanationBadge,
  SearchGraphEvidence,
  SearchPersonalizationReason,
  SearchPipelineResult,
  SearchProviderPrediction,
  SearchUserResult,
} from './types'

type RunSearchPipelineArgs = {
  posts: Post[]
}

export async function runSearchPipeline(
  context: SearchContext,
  { posts }: RunSearchPipelineArgs
): Promise<SearchPipelineResult> {
  if (!context.hasQuery || (context.isAroundMe && !context.userLocation)) {
    return emptyPipelineResult(context)
  }

  const geoPromise = shouldRunGeocodeFallback(context)
    ? fetchPlaceAutocompleteJson(context.parsed.locationTerms.join(' '), null).then(res => ({
        predictions: (res.predictions ?? []).filter(isSearchProviderPrediction),
      }))
    : Promise.resolve({ predictions: [] as SearchProviderPrediction[] })

  const [users, places, postFts, dishPosts, geoResult, dishEntities, personalization, trending] = await Promise.all([
    searchUsers(context.query),
    searchPlaces(context.placeQuery, context.userLocation, context.bounds, context.suburbFilter),
    context.isAroundMe ? Promise.resolve([]) : searchPostIds(context.placeQuery, context.userLocation),
    context.dishIntentActive
      ? searchDishPostIds(context.dishQuery, context.userLocation)
      : Promise.resolve([]),
    geoPromise,
    context.dishIntentActive
      ? searchDishes(context.dishQuery, context.userLocation)
      : Promise.resolve([]),
    fetchSearchPersonalizationSignals(context.userId),
    fetchTrendingEntitySignals(context.suburbFilter),
  ])
  const dishGraphEvidence = await fetchDishGraphEvidence(dishEntities.map(dish => dish.id))

  if (shouldRunGeocodeFallback(context)) {
    const firstPrediction = geoResult.predictions[0]
    if (firstPrediction?.structured_formatting.main_text) {
      void cacheResolvedSuburb({ name: firstPrediction.structured_formatting.main_text })
    }
  }

  const strictPostCount = context.isAroundMe
    ? 0
    : posts.filter(post => scorePost(post, context.words) > 0).length
  const strictPlaceCount = context.isAroundMe
    ? places.length
    : places.filter(place => scorePlace(place, context.words) > 0).length

  const expansion = await resolveSearchExpansion({
    isAroundMe: context.isAroundMe,
    strictPostCount,
    strictPlaceCount,
    words: context.words,
    q: context.query,
  })
  const expandedPlaceMatchCount = expansion.expandedPlaces.filter(place =>
    scorePlace(place, context.words) > 0
  ).length
  const providerFallbackDecision = context.isAroundMe
    ? noProviderFallback('local_results_present')
    : decideSearchProviderFallback({
        hasLocality: context.userLocation != null,
        intent: context.intent,
        localPlaceCount: strictPlaceCount,
        expandedPlaceCount: expandedPlaceMatchCount,
      })

  const providerPredictions = providerFallbackDecision.shouldUseGoogleFallback
    ? (await fetchPlaceAutocompleteJson(context.query, context.userLocation)).predictions?.filter(
        isSearchProviderPrediction
      ) ?? []
    : []

  const rawCandidates = buildSearchCandidates({
    posts,
    users,
    places,
    postFts,
    dishPosts,
    dishEntities,
    dishGraphEvidence,
    expandedPlaces: expansion.expandedPlaces,
    providerPredictions,
    personalization,
    trending,
  })
  const candidates = rankSearchCandidates(context, rawCandidates)
  const placeExplanationBadges = placeBadgeMap(candidates)
  const placesWithTrustBadges = applyPlaceExplanationBadges(places, placeExplanationBadges)
  const expandedPlacesWithTrustBadges = applyPlaceExplanationBadges(
    expansion.expandedPlaces,
    placeExplanationBadges
  )

  return {
    context,
    users,
    places: placesWithTrustBadges,
    postFts,
    dishPosts,
    dishEntities,
    expansionCuisines: expansion.cuisines,
    expandedPosts: expansion.expandedPosts,
    expandedPlaces: expandedPlacesWithTrustBadges,
    providerPredictions,
    providerFallbackDecision,
    providerFallbackSuppressed: providerFallbackDecision.suppressed,
    providerFallbackReason: providerFallbackDecision.reason,
    candidates,
  }
}

function placeBadgeMap(
  candidates: SearchPipelineResult['candidates']
): Map<string, SearchExplanationBadge[]> {
  const badges = new Map<string, SearchExplanationBadge[]>()
  for (const candidate of candidates) {
    if (candidate.kind !== 'place' || candidate.source === 'provider') continue
    if (candidate.explanationBadges.length > 0) badges.set(candidate.id, candidate.explanationBadges)
  }
  return badges
}

function applyPlaceExplanationBadges(
  places: PlaceResult[],
  badgesById: Map<string, SearchExplanationBadge[]>
): PlaceResult[] {
  return places.map(place => {
    const badges = badgesById.get(place.id)
    if (!badges || badges.length === 0) return place
    return {
      ...place,
      badges: [...new Set([...(place.badges ?? []), ...badges])],
    }
  })
}

function emptyPipelineResult(context: SearchContext): SearchPipelineResult {
  const providerFallbackDecision = noProviderFallback('local_results_present')
  return {
    context,
    users: [],
    places: [],
    postFts: [],
    dishPosts: [],
    dishEntities: [],
    expansionCuisines: [],
    expandedPosts: [],
    expandedPlaces: [],
    providerPredictions: [],
    providerFallbackDecision,
    providerFallbackSuppressed: false,
    providerFallbackReason: providerFallbackDecision.reason,
    candidates: [],
  }
}

function noProviderFallback(reason: SearchFallbackReason): SearchFallbackDecision {
  return { shouldUseGoogleFallback: false, suppressed: false, reason }
}

function shouldRunGeocodeFallback(context: SearchContext): boolean {
  return (
    isEnabled('locationGeocodeFallback') &&
    context.parsed.locationTerms.length > 0 &&
    context.suburbFilter == null &&
    context.userLocation == null
  )
}

function buildSearchCandidates({
  posts,
  users,
  places,
  postFts,
  dishPosts,
  dishEntities,
  dishGraphEvidence,
  expandedPlaces,
  providerPredictions,
  personalization,
  trending,
}: {
  posts: Post[]
  users: SearchUserResult[]
  places: PlaceResult[]
  postFts: RankedPostCandidate[]
  dishPosts: DishPostCandidate[]
  dishEntities: DishResult[]
  dishGraphEvidence: Map<string, SearchGraphEvidence>
  expandedPlaces: PlaceResult[]
  providerPredictions: SearchProviderPrediction[]
  personalization: SearchPersonalizationSignals
  trending: TrendingEntitySignals
}): SearchCandidatePayload[] {
  const postCreatedAt = new Map<string, string | null>()
  for (const post of posts) {
    if (post.dbId) postCreatedAt.set(post.dbId, post.createdAt ?? null)
  }

  return [
    ...postFts.map(post => ({
      kind: 'post' as const,
      id: post.id,
      source: 'post_fts' as const,
      rank: post.rank,
      createdAt: postCreatedAt.get(post.id) ?? null,
      ...postMetadata(post.id, personalization, trending),
    })),
    ...dishPosts.map(post => ({
      kind: 'post' as const,
      id: post.id,
      source: 'dish_post' as const,
      rank: post.rank,
      createdAt: postCreatedAt.get(post.id) ?? null,
      matchSource: post.match_source,
      ...postMetadata(post.id, personalization, trending),
    })),
    ...dishEntities.map((dish, index) => ({
      kind: 'dish' as const,
      id: dish.id,
      source: 'dish_fts' as const,
      rank: dish.save_count + dish.post_count || dishEntities.length - index,
      item: dish,
      ...graphEvidenceMetadata(dishGraphEvidence.get(dish.id)),
      ...dishMetadata(dish, personalization, trending),
    })),
    ...places.map((place, index) => ({
      kind: 'place' as const,
      id: place.id,
      source: 'local' as const,
      rank: places.length - index,
      item: place,
      ...graphEvidenceMetadata(placeGraphEvidence(place)),
      ...placeMetadata(place, personalization, trending),
    })),
    ...expandedPlaces.map((place, index) => ({
      kind: 'place' as const,
      id: place.id,
      source: 'expanded' as const,
      rank: expandedPlaces.length - index,
      item: place,
      ...graphEvidenceMetadata(placeGraphEvidence(place)),
      ...placeMetadata(place, personalization, trending),
    })),
    ...providerPredictions.map((prediction, index) => ({
      kind: 'place' as const,
      id: prediction.place_id,
      source: 'provider' as const,
      rank: providerPredictions.length - index,
      item: {
        id: prediction.place_id,
        name: prediction.structured_formatting.main_text,
        address: prediction.structured_formatting.secondary_text,
        city: null,
        suburb: null,
        cuisine_type: null,
        google_place_id: prediction.place_id,
        latitude: null,
        longitude: null,
        google_rating: null,
        google_review_count: null,
        fromGoogle: true,
      },
    })),
    ...users.map((user, index) => ({
      kind: 'person' as const,
      id: user.id,
      source: 'user' as const,
      rank: users.length - index,
      item: user,
    })),
  ]
}

function postMetadata(
  postId: string,
  personalization: SearchPersonalizationSignals,
  trending: TrendingEntitySignals
) {
  const personalizationReasons: SearchPersonalizationReason[] = []
  if (personalization.savedPostIds.includes(postId)) personalizationReasons.push('saved_post')
  const trendingScore = trending.postScores.get(postId) ?? 0
  return {
    ...(personalizationReasons.length > 0
      ? { personalizationBoost: 0.8, personalizationReasons }
      : {}),
    ...(trendingScore > 0 ? { trendingScore } : {}),
  }
}

function dishMetadata(
  dish: DishResult,
  personalization: SearchPersonalizationSignals,
  trending: TrendingEntitySignals
) {
  const personalizationReasons: SearchPersonalizationReason[] = []
  if (personalization.savedDishIds.includes(dish.id)) personalizationReasons.push('saved_dish')
  if (matchesRecentCuisine(dish.cuisine_type, personalization)) {
    personalizationReasons.push('recent_cuisine')
  }
  if (matchesRecentQuery(dish.name, personalization)) personalizationReasons.push('recent_search')
  const trendingScore = trending.dishScores.get(dish.id) ?? 0
  return {
    ...(personalizationReasons.length > 0
      ? {
          personalizationBoost: Math.min(1.2, personalizationReasons.length * 0.4),
          personalizationReasons,
        }
      : {}),
    ...(trendingScore > 0 ? { trendingScore } : {}),
  }
}

function placeMetadata(
  place: PlaceResult,
  personalization: SearchPersonalizationSignals,
  trending: TrendingEntitySignals
) {
  const personalizationReasons: SearchPersonalizationReason[] = []
  if (personalization.savedRestaurantIds.includes(place.id)) {
    personalizationReasons.push('saved_restaurant')
  }
  if (matchesRecentCuisine(place.cuisine_type, personalization)) {
    personalizationReasons.push('recent_cuisine')
  }
  if (matchesRecentArea(place, personalization)) personalizationReasons.push('recent_area')
  const trendingScore = trending.placeScores.get(place.id) ?? 0
  return {
    ...(personalizationReasons.length > 0
      ? {
          personalizationBoost: Math.min(1.2, personalizationReasons.length * 0.4),
          personalizationReasons,
        }
      : {}),
    ...(trendingScore > 0 ? { trendingScore } : {}),
  }
}

function placeGraphEvidence(place: PlaceResult): SearchGraphEvidence | undefined {
  if (!place.top_dishes || place.top_dishes.length === 0) return undefined
  return {
    servingRestaurantIds: [place.id],
    servingRestaurantCount: 1,
    supportingPostIds: [],
  }
}

function graphEvidenceMetadata(evidence: SearchGraphEvidence | undefined) {
  return evidence ? { graphEvidence: evidence } : {}
}

function matchesRecentCuisine(
  cuisine: string | null,
  personalization: SearchPersonalizationSignals
): boolean {
  const normalized = cuisine?.trim().toLowerCase()
  return Boolean(normalized && personalization.recentCuisines.includes(normalized))
}

function matchesRecentQuery(value: string, personalization: SearchPersonalizationSignals): boolean {
  const normalized = value.trim().toLowerCase()
  return personalization.recentQueries.some(query => query.includes(normalized) || normalized.includes(query))
}

function matchesRecentArea(
  place: PlaceResult,
  personalization: SearchPersonalizationSignals
): boolean {
  const terms = [place.suburb, place.city, place.address]
    .filter((term): term is string => typeof term === 'string')
    .map(term => term.trim().toLowerCase())
  return personalization.recentAreas.some(area => terms.some(term => term.includes(area)))
}

function isSearchProviderPrediction(value: unknown): value is SearchProviderPrediction {
  if (!isRecord(value) || !isRecord(value.structured_formatting)) return false
  return (
    typeof value.place_id === 'string' &&
    Array.isArray(value.types) &&
    value.types.every(type => typeof type === 'string') &&
    typeof value.structured_formatting.main_text === 'string' &&
    typeof value.structured_formatting.secondary_text === 'string'
  )
}
