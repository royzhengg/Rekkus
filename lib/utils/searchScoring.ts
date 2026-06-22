import { normalizeCuisine } from '@/lib/dataSources/cuisines'
import { demoUsers } from '@/lib/dataSources/demoData'
import type { PlaceResult, PersonResult, SearchFilters, UserLocation } from '@/lib/hooks/searchTypes'
import type { CuisineAffinities } from '@/lib/hooks/useSearchHistory'
import type { PopularityCacheRow } from '@/lib/services/places'
import type { Post, PostMediaType } from '@/types/domain'
import { CUISINE_ALIASES, cuisineMatchesAlias, getCuisineSynonyms } from './cuisineSynonyms'
import { haversineKm, distanceBoost } from './geo'

export const STOP_WORDS = new Set([
  'food',
  'restaurant',
  'restaurants',
  'place',
  'places',
  'spot',
  'spots',
  'the',
  'a',
  'an',
  'in',
  'at',
  'for',
  'and',
  'or',
  'near',
  'with',
  'best',
  'good',
  'great',
  'nice',
])

// When a query word is a known cuisine-type identifier (e.g. "chinese", "italian"),
// skip name matching and score only against cuisine_type. This prevents "Chinese Tuxedo"
// from outranking actual Chinese places for the query "chinese".
export const CUISINE_TYPE_WORDS = new Set(Object.keys(CUISINE_ALIASES))

// Food-type identifiers returned by Google Places Autocomplete.
// Places with these types get a boost in scoring — they're actual food venues.
export const FOOD_PLACE_TYPES = new Set([
  'restaurant',
  'food',
  'cafe',
  'meal_takeaway',
  'meal_delivery',
  'bakery',
  'bar',
])

export function parseWords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/#/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0)
}

export function scorePost(post: Post, words: string[]): number {
  let total = 0
  let requiredCount = 0
  let matchedCount = 0
  for (const word of words) {
    const isStop = STOP_WORDS.has(word)
    if (!isStop) requiredCount++
    let wordScore = 0
    if (post.title.toLowerCase().includes(word)) wordScore += 3
    if (post.cuisine_type?.toLowerCase().includes(word)) wordScore += 3
    if (post.tags.some(t => t.includes(word))) wordScore += 2
    if (post.location.toLowerCase().includes(word)) wordScore += 2
    if (post.creator.toLowerCase().includes(word)) wordScore += 1.5
    if (post.body.toLowerCase().includes(word)) wordScore += 1
    // Cuisine synonym expansion: "ramen" also scores against Japanese cuisine posts
    if (wordScore === 0) {
      const expansions = getCuisineSynonyms(word)
      for (const synonym of expansions) {
        if (post.cuisine_type?.toLowerCase().includes(synonym)) {
          wordScore += 2
          break
        }
      }
    }
    if (!isStop && wordScore > 0) matchedCount++
    total += wordScore
  }
  if (requiredCount > 0 && matchedCount < requiredCount) return 0
  if (requiredCount === 0 && total === 0) return 0
  return total
}

export function scorePerson(p: PersonResult, words: string[]): number {
  const username = p.username.toLowerCase()
  const name = p.displayName.toLowerCase()
  let total = 0
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue
    const nameWords = name.split(/\s+/)
    if (username === word || nameWords.some(n => n === word)) total += 4
    else if (username.startsWith(word)) total += 3
    else if (username.includes(word) || name.includes(word)) total += 2
  }
  // Log-scaled tie-breaker: surfaces active creators over zero-activity accounts
  // without overriding text match (Math.log1p(10000) * 0.1 ≈ 0.92 — less than one match tier)
  total += Math.log1p(p.followerCount ?? 0) * 0.1
  return total
}

// Returns a score based on how well a search word matches tokens in a text field.
// Strong match (word covers ≥80% of token): full score — "indian" → "indian"/"indians"
// Weak match (word covers 40-79% of token): reduced score — "indian" → "indianapolis"
// This keeps loosely-relevant results visible but ranked well below direct matches.
export function fieldScore(text: string, word: string, strong: number): number {
  const tokens = text.split(/[\s,\-()[\]/]+/).filter(Boolean)
  for (const t of tokens) {
    if (!t.startsWith(word)) continue
    const coverage = word.length / t.length
    if (coverage >= 0.8) return strong
    if (coverage >= 0.4) return strong * 0.33
  }
  return 0
}

export function scorePlace(p: PlaceResult, words: string[]): number {
  const name = p.name.toLowerCase()
  const cuisine = (p.cuisine_type ?? '').toLowerCase()
  const city = (p.city ?? '').toLowerCase()
  const address = (p.address ?? '').toLowerCase()
  let total = 0
  let requiredCount = 0
  let matchedCount = 0
  for (const word of words) {
    const isStop = STOP_WORDS.has(word)
    if (!isStop) requiredCount++
    let wordScore = 0
    const isCuisineWord = CUISINE_TYPE_WORDS.has(word)
    if (!isCuisineWord) {
      // Name searches ("kindred", "kuon"): score against name, city, address
      wordScore += fieldScore(name, word, 3)
      wordScore += fieldScore(city, word, 1)
      wordScore += fieldScore(address, word, 1)
    }
    // Cuisine searches ("chinese", "italian"): score only against cuisine_type (raised to 3 pts)
    if (cuisine.includes(word)) wordScore += isCuisineWord ? 3 : 2
    if (cuisineMatchesAlias(cuisine, word)) wordScore += 1.5
    // Cuisine synonym expansion: "ramen" also scores against Japanese cuisine places
    if (wordScore === 0) {
      const expansions = getCuisineSynonyms(word)
      for (const synonym of expansions) {
        if (cuisine.includes(synonym)) {
          wordScore += 2
          break
        }
      }
    }
    if (!isStop && wordScore > 0) matchedCount++
    total += wordScore
  }
  if (requiredCount > 0 && matchedCount < requiredCount) return 0
  return total
}

export function uniqueBadges(...values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter(Boolean) as string[])]
}

export function placeDaypartHint(place: PlaceResult, words: string[]): string | null {
  const cuisine = (place.cuisine_type ?? '').toLowerCase()
  const text = `${place.name} ${cuisine}`.toLowerCase()
  const allTerms = [...words, text]
  const has = (needle: string) => allTerms.some(term => term.includes(needle))
  if (has('brunch') || has('cafe') || has('coffee') || has('bakery')) return 'Breakfast fit'
  if (has('bar') || has('date') || has('izakaya') || has('tapas')) return 'Dinner fit'
  return null
}

export function isWithinRadius(
  place: PlaceResult,
  userLocation: UserLocation,
  radiusKm: number,
  distances: Map<string, number>
): boolean {
  if (!userLocation || place.latitude == null || place.longitude == null) return true
  const km = haversineKm(userLocation.lat, userLocation.lng, place.latitude, place.longitude)
  distances.set(place.id, km)
  return km <= radiusKm
}

export function boundingBoxForRadius(location: { lat: number; lng: number }, radiusKm: number) {
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((location.lat * Math.PI) / 180), 0.01))
  return {
    min_lat: location.lat - latDelta,
    max_lat: location.lat + latDelta,
    min_lng: location.lng - lngDelta,
    max_lng: location.lng + lngDelta,
  }
}

export function popularityBoost(postCount: number, interactionCount: number): number {
  let score = 0
  if (postCount >= 5) score += 1.5
  else if (postCount >= 2) score += 0.75
  else if (postCount >= 1) score += 0.25

  if (interactionCount >= 50) score += 1.5
  else if (interactionCount >= 20) score += 0.8
  else if (interactionCount >= 5) score += 0.4
  else if (interactionCount >= 1) score += 0.2
  return score
}

export function qualityBoost(place: PlaceResult, avgFoodRating: number | null): number {
  let score = 0
  if (avgFoodRating != null) {
    if (avgFoodRating >= 4.5) score += 2.0
    else if (avgFoodRating >= 4.0) score += 1.0
    else if (avgFoodRating >= 3.5) score += 0.5
    return score
  }
  if (place.google_rating != null) {
    if (place.google_rating >= 4.5) score += 0.75
    else if (place.google_rating >= 4.0) score += 0.35
  }
  if (place.google_review_count != null) {
    if (place.google_review_count >= 500) score += 0.4
    else if (place.google_review_count >= 100) score += 0.2
    else if (place.google_review_count >= 20) score += 0.1
  }
  return score
}

export function scoreExpandedPost(post: Post, cuisines: string[]): number {
  const cuisine = post.cuisine_type?.toLowerCase()
  if (!cuisine) return 0
  const idx = cuisines.findIndex(c => cuisine.includes(c))
  if (idx === -1) return 0
  return 1.25 - idx * 0.15
}

export function rekkusPickBoost(post: Post): number {
  let score = 0
  if (post.tasteVerdict === 'worth_a_trip') score += 2.25
  else if (post.tasteVerdict === 'must_order') score += 1.75
  else if (post.tasteVerdict === 'craveable') score += 1
  else if ((post.food ?? 0) >= 4.5) score += 0.8
  else if ((post.food ?? 0) >= 4.0) score += 0.35

  if (post.valueVerdict === 'great_value') score += 0.6
  else if (post.valueVerdict === 'worth_the_splurge') score += 0.45
  return score
}

export function postMediaKinds(post: Post): Set<PostMediaType | 'mixed'> {
  const kinds = new Set<PostMediaType | 'mixed'>()
  const hasImage = !!post.imageUrl || post.media?.some(item => item.type === 'image')
  const hasVideo = !!post.videoUrl || post.media?.some(item => item.type === 'video')
  if (hasImage) kinds.add('image')
  if (hasVideo) kinds.add('video')
  if (hasImage && hasVideo) kinds.add('mixed')
  return kinds
}

export function matchesPostFilters(post: Post, filters?: SearchFilters): boolean {
  if (!filters) return true
  if (filters.cuisine) {
    const wanted = normalizeCuisine(filters.cuisine)
    const actual = normalizeCuisine(post.cuisine_type)
    if (!actual || actual !== wanted) return false
  }
  if (filters.occasions?.length) {
    const selected = new Set(post.occasionTags ?? [])
    if (!filters.occasions.some(value => selected.has(value))) return false
  }
  if (filters.values?.length && (!post.valueVerdict || !filters.values.includes(post.valueVerdict))) {
    return false
  }
  if (filters.mediaTypes?.length) {
    const kinds = postMediaKinds(post)
    if (!filters.mediaTypes.some(kind => kinds.has(kind))) return false
  }
  return true
}

export function matchesPlaceFilters(place: PlaceResult, filters?: SearchFilters): boolean {
  if (!filters) return true
  if (filters.openNow && place.open_now !== true) return false
  if (filters.cuisine) {
    const wanted = normalizeCuisine(filters.cuisine)
    const actual = normalizeCuisine(place.cuisine_type)
    if (!actual || actual !== wanted) return false
  }
  return true
}

export function sortPosts(
  scored: Array<{ post: Post; score: number }>,
  filters: SearchFilters | undefined,
  userLocation: UserLocation
): Array<{ post: Post; score: number }> {
  switch (filters?.sort) {
    case 'newest':
      return [...scored].sort((a, b) => Date.parse(b.post.createdAt ?? '') - Date.parse(a.post.createdAt ?? ''))
    case 'most_saved':
      return [...scored].sort((a, b) => Number(b.post.likes.replace(/[^\d.]/g, '') || 0) - Number(a.post.likes.replace(/[^\d.]/g, '') || 0))
    case 'highest_rekkus_picks':
      return [...scored].sort((a, b) => rekkusPickBoost(b.post) - rekkusPickBoost(a.post) || b.score - a.score)
    case 'nearby':
      if (!userLocation) return scored
      return [...scored].sort((a, b) => {
        const akm = a.post.lat != null && a.post.lng != null ? haversineKm(userLocation.lat, userLocation.lng, a.post.lat, a.post.lng) : Number.POSITIVE_INFINITY
        const bkm = b.post.lat != null && b.post.lng != null ? haversineKm(userLocation.lat, userLocation.lng, b.post.lat, b.post.lng) : Number.POSITIVE_INFINITY
        return akm - bkm
      })
    default:
      return [...scored].sort((a, b) => b.score - a.score)
  }
}

export function scoreExpandedPlace(place: PlaceResult, cuisines: string[]): number {
  const cuisine = place.cuisine_type?.toLowerCase()
  if (!cuisine) return 0
  const idx = cuisines.findIndex(c => cuisine.includes(c))
  if (idx === -1) return 0
  return 1.0 - idx * 0.15
}

export function getContextualBoost(post: Post): number {
  const hour = new Date().getHours()
  const cuisine = post.cuisine_type?.toLowerCase() ?? ''
  const occasion = post.occasionTags ?? []
  if (hour >= 6 && hour < 11) {
    if (cuisine.includes('cafe') || cuisine.includes('bakery')) return 0.8
    if (occasion.includes('quick_bite')) return 0.4
  }
  if (hour >= 18 && hour < 22) {
    if (occasion.includes('date_night') || occasion.includes('special')) return 0.8
    if (occasion.includes('group')) return 0.4
  }
  return 0
}

// Score a Google Autocomplete prediction. Hard-filters non-food venues (hospitals, gyms,
// parks etc.) and adds a +2.0 confirmed-food bonus for food establishments.
export function scoreGooglePrediction(place: PlaceResult, types: string[], words: string[]): number {
  // Reject non-food venues entirely when Google returns type information
  if (types.length > 0 && !types.some(t => FOOD_PLACE_TYPES.has(t))) return 0
  let score = scorePlace(place, words)
  if (score === 0) return 0
  score += 2.0  // Confirmed food venue bonus
  return score
}

// ─── Shared search result types ──────────────────────────────────────────────

export type CuisineExpansion = { cuisine_type: string; match_count: number }

export type GooglePrediction = {
  place_id: string
  structured_formatting: { main_text: string; secondary_text: string }
  types: string[]
}

// ─── Phase orchestration functions ───────────────────────────────────────────
// Pure data transforms consumed by useSearchResults useMemos.

export function computePostResults({
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
}: {
  posts: Post[]
  ftsDbPosts: Post[]
  ftsPostIds: Array<{ id: string; rank: number }>
  expandedDbPosts: Post[]
  dishPostIds: Map<string, { rank: number; match_source: string }>
  words: string[]
  userLocation: UserLocation
  expansionCuisines: CuisineExpansion[]
  isAroundMe: boolean
  filters: SearchFilters | undefined
}): { postResults: Post[]; usedPostExpansion: boolean } {
  if (words.length === 0 || isAroundMe) return { postResults: [], usedPostExpansion: false }

  // FTS path: use server-ranked IDs as primary ordering signal
  const ftsIdMap = new Map(ftsPostIds.map(r => [r.id, r.rank]))
  if (ftsIdMap.size > 0) {
    const allPosts = [
      ...posts,
      ...ftsDbPosts.filter(p => !posts.some(ep => ep.dbId === p.dbId)),
    ]
    const ranked = allPosts
      .filter(p => matchesPostFilters(p, filters))
      .map(p => {
        const ftsRank = p.dbId ? ftsIdMap.get(p.dbId) : undefined
        if (ftsRank == null) return null
        let score = ftsRank * 10
        // Phase 3h: dish search boost
        const dishMatch = p.dbId ? dishPostIds.get(p.dbId) : undefined
        if (dishMatch) score += dishMatch.rank * 15
        score += rekkusPickBoost(p)
        score += getContextualBoost(p)
        if (userLocation && p.lat != null && p.lng != null) {
          score += distanceBoost(haversineKm(userLocation.lat, userLocation.lng, p.lat, p.lng))
        }
        return { post: p, score }
      })
      .filter((x): x is { post: Post; score: number } => x !== null && x.score > 0)
    const sorted = sortPosts(ranked, filters, userLocation)
    return { postResults: sorted.map(x => x.post), usedPostExpansion: false }
  }

  // Fallback: client-side scoring from PostsContext
  const scored = posts
    .filter(p => matchesPostFilters(p, filters))
    .map(p => {
      let score = scorePost(p, words)
      if (score > 0) {
        const dishMatch = p.dbId ? dishPostIds.get(p.dbId) : undefined
        if (dishMatch) score += dishMatch.rank * 15
        score += rekkusPickBoost(p)
        score += getContextualBoost(p)
        if (userLocation && p.lat != null && p.lng != null) {
          score += distanceBoost(haversineKm(userLocation.lat, userLocation.lng, p.lat, p.lng))
        }
      }
      return { post: p, score }
    })
    .filter(x => x.score > 0)
  const sorted = sortPosts(scored, filters, userLocation)
  if (scored.length > 0) {
    return { postResults: sorted.map(x => x.post), usedPostExpansion: false }
  }

  const expandedCuisines = expansionCuisines.map(c => c.cuisine_type.toLowerCase())
  if (expandedCuisines.length === 0) return { postResults: [], usedPostExpansion: false }

  const seenPostIds = new Set(posts.map(p => p.dbId).filter(Boolean))
  const expansionPool = [...posts, ...expandedDbPosts.filter(p => !seenPostIds.has(p.dbId))]
  const expandedPosts = expansionPool
    .filter(p => matchesPostFilters(p, filters))
    .map(p => {
      let score = scoreExpandedPost(p, expandedCuisines)
      if (score > 0) {
        score += rekkusPickBoost(p)
        score += getContextualBoost(p)
        if (userLocation && p.lat != null && p.lng != null) {
          score += distanceBoost(haversineKm(userLocation.lat, userLocation.lng, p.lat, p.lng))
        }
      }
      return { post: p, score }
    })
    .filter(x => x.score > 0)
  const sortedExpanded = sortPosts(expandedPosts, filters, userLocation)
  const expandedPostResults = sortedExpanded.map(x => x.post)
  return { postResults: expandedPostResults, usedPostExpansion: expandedPostResults.length > 0 }
}

export function computePeopleResults({
  words,
  dbUsers,
  isAroundMe,
}: {
  words: string[]
  dbUsers: Array<{ id: string; username: string; full_name: string | null; follower_count?: number }>
  isAroundMe: boolean
}): PersonResult[] {
  if (words.length === 0 || isAroundMe) return []
  const mockMatches = Object.entries(demoUsers)
    .map(([username, u]) => {
      const p: PersonResult = {
        username,
        displayName: u.displayName,
        initials: u.initials,
        avatarBg: u.avatarBg,
        avatarColor: u.avatarColor,
        followers: u.followers,
      }
      return { person: p, score: scorePerson(p, words) }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.person)
  const mockUsernames = new Set(mockMatches.map(p => p.username))
  const dbExtras: PersonResult[] = dbUsers
    .filter(u => !mockUsernames.has(u.username))
    .map(u => {
      const initials = (u.full_name ?? u.username)
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
      return {
        username: u.username,
        displayName: u.full_name ?? u.username,
        initials,
        avatarBg: '#E8E8E4',
        avatarColor: '#6B6B66',
        followers: '—',
        followerCount: u.follower_count ?? 0,
      }
    })
    .sort((a, b) => scorePerson(b, words) - scorePerson(a, words))
  return [...mockMatches, ...dbExtras]
}

export function computePlaceResults({
  posts,
  dbPlaces,
  expandedDbPlaces,
  expansionCuisines,
  googlePredictions,
  interactionCounts,
  popularityCache,
  searchAffinities,
  userLocation,
  savedPlaceIds,
  radiusKm,
  isAroundMe,
  words,
  filters,
}: {
  posts: Post[]
  dbPlaces: PlaceResult[]
  expandedDbPlaces: PlaceResult[]
  expansionCuisines: CuisineExpansion[]
  googlePredictions: GooglePrediction[]
  interactionCounts: Map<string, number>
  popularityCache: Map<string, PopularityCacheRow>
  searchAffinities: CuisineAffinities
  userLocation: UserLocation
  savedPlaceIds: Set<string>
  radiusKm: number
  isAroundMe: boolean
  words: string[]
  filters: SearchFilters | undefined
}): { placeResults: PlaceResult[]; placeDistances: Map<string, number>; usedPlaceExpansion: boolean } {
  if (words.length === 0 && !isAroundMe)
    return { placeResults: [], placeDistances: new Map(), usedPlaceExpansion: false }
  if (isAroundMe && !userLocation)
    return { placeResults: [], placeDistances: new Map(), usedPlaceExpansion: false }

  // Popularity signal: count Rekkus posts per place
  const postCountByPlace = new Map<string, number>()
  // Rekkus avg food rating per place
  const foodRatingSum = new Map<string, number>()
  const foodRatingCount = new Map<string, number>()
  const savedCuisineCounts = new Map<string, number>()
  for (const post of posts) {
    if (post.placeId) {
      postCountByPlace.set(
        post.placeId,
        (postCountByPlace.get(post.placeId) ?? 0) + 1
      )
      if (post.food != null) {
        foodRatingSum.set(
          post.placeId,
          (foodRatingSum.get(post.placeId) ?? 0) + post.food
        )
        foodRatingCount.set(post.placeId, (foodRatingCount.get(post.placeId) ?? 0) + 1)
      }
    }
  }

  const combined = [...dbPlaces]
  const expandedCuisines = expansionCuisines.map(c => c.cuisine_type.toLowerCase())

  const distances = new Map<string, number>()
  const savedPlaces = combined.filter(p => savedPlaceIds.has(p.id))
  for (const place of savedPlaces) {
    const cuisine = place.cuisine_type?.toLowerCase()
    if (cuisine) savedCuisineCounts.set(cuisine, (savedCuisineCounts.get(cuisine) ?? 0) + 1)
  }

  let usedPlaceExpansion = false
  let scoredWithValues = combined
    .filter(p => isWithinRadius(p, userLocation, radiusKm, distances))
    .filter(p => matchesPlaceFilters(p, filters))
    .map(p => {
      const baseScore = isAroundMe ? 1 : scorePlace(p, words)
      if (baseScore <= 0) return { place: p, score: 0 }
      let score = baseScore

      const postCount = postCountByPlace.get(p.id) ?? popularityCache.get(p.id)?.post_count ?? 0
      // Phase 3a: use pre-aggregated cache; fall back to live analytics counts while cache warms
      const cached = popularityCache.get(p.id)
      const interactions = cached?.interaction_count_30d ?? interactionCounts.get(p.id) ?? 0
      score += popularityBoost(postCount, interactions)

      const ratingCount = foodRatingCount.get(p.id) ?? cached?.food_rating_count ?? 0
      let avgFoodRating: number | null = cached?.avg_food_rating ?? null
      if (ratingCount > 0 && avgFoodRating == null) {
        avgFoodRating = (foodRatingSum.get(p.id) ?? 0) / ratingCount
      }
      score += qualityBoost(p, avgFoodRating)
      if (savedPlaceIds.has(p.id)) score += 1.25
      const cuisine = p.cuisine_type?.toLowerCase()
      if (cuisine && savedCuisineCounts.has(cuisine)) score += 0.4
      if (cuisine) {
        score += (searchAffinities[cuisine] ?? 0) * 1.2
      }

      if (userLocation && p.latitude != null && p.longitude != null) {
        const km =
          distances.get(p.id) ??
          haversineKm(userLocation.lat, userLocation.lng, p.latitude, p.longitude)
        score += distanceBoost(km)
        if (km <= 2 && postCount <= 1 && avgFoodRating != null && avgFoodRating >= 4) score += 0.5
      }

      return { place: p, score }
    })
    .filter(x => x.score > 0)

  if (scoredWithValues.length === 0 && expandedCuisines.length > 0) {
    const expandedNames = new Set(combined.map(p => p.name.toLowerCase()))
    const expandedCombined = [
      ...combined,
      ...expandedDbPlaces.filter(p => !expandedNames.has(p.name.toLowerCase())),
    ]

    scoredWithValues = expandedCombined
      .filter(p => isWithinRadius(p, userLocation, radiusKm, distances))
      .filter(p => matchesPlaceFilters(p, filters))
      .map(p => {
        const baseScore = scoreExpandedPlace(p, expandedCuisines)
        if (baseScore <= 0) return { place: p, score: 0 }
        let score = baseScore

        const postCount = postCountByPlace.get(p.id) ?? popularityCache.get(p.id)?.post_count ?? 0
        const cachedExp = popularityCache.get(p.id)
        const interactions = cachedExp?.interaction_count_30d ?? interactionCounts.get(p.id) ?? 0
        score += popularityBoost(postCount, interactions)

        const ratingCount = foodRatingCount.get(p.id) ?? cachedExp?.food_rating_count ?? 0
        let avgFoodRating: number | null = cachedExp?.avg_food_rating ?? null
        if (ratingCount > 0 && avgFoodRating == null) {
          avgFoodRating = (foodRatingSum.get(p.id) ?? 0) / ratingCount
        }
        score += qualityBoost(p, avgFoodRating)
        if (savedPlaceIds.has(p.id)) score += 1.25
        const cuisine = p.cuisine_type?.toLowerCase()
        if (cuisine && savedCuisineCounts.has(cuisine)) score += 0.4
        if (cuisine) {
          score += (searchAffinities[cuisine] ?? 0) * 1.2
        }

        if (userLocation && p.latitude != null && p.longitude != null) {
          const km =
            distances.get(p.id) ??
            haversineKm(userLocation.lat, userLocation.lng, p.latitude, p.longitude)
          score += distanceBoost(km)
          if (km <= 2 && postCount <= 1 && avgFoodRating != null && avgFoodRating >= 4)
            score += 0.5
        }

        return { place: p, score }
      })
      .filter(x => x.score > 0)
    usedPlaceExpansion = scoredWithValues.length > 0
  }

  // Score Google predictions and merge into the pool (not append at end)
  const knownIds = new Set(scoredWithValues.map(x => x.place.google_place_id).filter(Boolean))
  const knownNames = new Set(scoredWithValues.map(x => x.place.name.toLowerCase()))

  const googleScored = googlePredictions
    .filter(
      p =>
        !knownIds.has(p.place_id) &&
        !knownNames.has(p.structured_formatting.main_text.toLowerCase())
    )
    .map(p => {
      const place: PlaceResult = {
        id: p.place_id,
        name: p.structured_formatting.main_text,
        address: p.structured_formatting.secondary_text,
        city: null,
        suburb: null,
        cuisine_type: null,
        google_place_id: p.place_id,
        latitude: null,
        longitude: null,
        google_rating: null,
        google_review_count: null,
        fromGoogle: true,
      }
      return { place, score: scoreGooglePrediction(place, p.types ?? [], words) }
    })
    .filter(x => x.score > 0)

  // Merge local/Supabase and Google results, sort all together by score
  const sortMode = filters?.sort
  const allSorted = [...scoredWithValues, ...googleScored]
    .sort((a, b) => {
      if (sortMode === 'nearby') {
        const akm = distances.get(a.place.id) ?? Number.POSITIVE_INFINITY
        const bkm = distances.get(b.place.id) ?? Number.POSITIVE_INFINITY
        return akm - bkm
      }
      if (sortMode === 'highest_rekkus_picks') {
        const apostCount = postCountByPlace.get(a.place.id) ?? 0
        const bpostCount = postCountByPlace.get(b.place.id) ?? 0
        return bpostCount - apostCount || b.score - a.score
      }
      return b.score - a.score
    })
    .map(x => {
      const km = distances.get(x.place.id)
      return {
        ...x.place,
        hint: placeDaypartHint(x.place, words),
        badges: uniqueBadges(
          km != null && km <= 5 ? 'Near you' : null,
          savedPlaceIds.has(x.place.id) ? 'Saved' : null,
          x.place.open_now === true ? 'Open now' : x.place.open_now === false ? 'Closed' : null
        ),
      }
    })

  return { placeResults: allSorted, placeDistances: distances, usedPlaceExpansion }
}
