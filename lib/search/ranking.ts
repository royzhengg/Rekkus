import type { SearchIntentKind } from '@/lib/utils/searchIntent'
import type {
  SearchCandidate,
  SearchCandidateKind,
  SearchCandidatePayload,
  SearchContext,
  SearchDiversitySlot,
  SearchExplanationBadge,
  SearchRankingReason,
} from './types'

type EntityWeightConfig = Record<SearchIntentKind, Record<SearchCandidateKind, number>>

const SEARCH_RELEVANCE_V2_CONFIG = {
  sourceRankWeight: 1,
  freshness: {
    maxFreshnessBoost: 0.9,
    maxColdStartBoost: 0.6,
    maxPopularityDecay: 0.6,
    decayWindowDays: 30,
    staleAfterDays: 90,
    lowVolumePostRank: 1,
    lowVolumeDishPosts: 2,
    lowVolumePlacePosts: 1,
  },
  personalization: {
    maxBoost: 1.2,
  },
  trending: {
    maxBoost: 0.8,
    scoreDivisor: 20,
  },
  trust: {
    exactMatchBoost: 0.75,
    nearYouBoost: 0.4,
    popularNearbyBoost: 0.35,
    keywordStuffingPenalty: 2.5,
    nearbyKm: 2,
    popularNearbyPostCount: 3,
    maxRepeatedQueryToken: 3,
  },
  sourceTrustBoosts: {
    local: 1.5,
    expanded: 0.5,
    provider: -1.5,
    post_fts: 0.75,
    dish_post: 1,
    dish_fts: 1,
    user: 0,
  },
  entityWeights: {
    food_dish: { dish: 8, post: 7, place: 5, person: 0.5 },
    mixed: { dish: 7, post: 6, place: 6, person: 0.5 },
    restaurant_name: { place: 8, dish: 4, post: 4, person: 1 },
    location: { place: 8, post: 4, dish: 3, person: 0.5 },
    general: { place: 5, post: 5, dish: 4, person: 2 },
  } satisfies EntityWeightConfig,
  diversityPreludeKinds: ['dish', 'post', 'place'] satisfies SearchCandidateKind[],
}

export function rankSearchCandidates(
  context: SearchContext,
  candidates: SearchCandidatePayload[]
): SearchCandidate[] {
  const ranked = candidates.map(candidate => rankCandidate(context, candidate))
  const deduped = suppressDuplicateCandidates(ranked)
  const sorted = deduped.sort((a, b) => compareRankedCandidates(context, a, b))
  if (!shouldApplyDiversityPrelude(context)) return sorted
  return applyDiversityPrelude(sorted)
}

function rankCandidate(context: SearchContext, candidate: SearchCandidatePayload): SearchCandidate {
  const rankingReasons: SearchRankingReason[] = ['source_rank', 'intent_entity_weight']
  const entityWeight = SEARCH_RELEVANCE_V2_CONFIG.entityWeights[context.intent][candidate.kind]
  const sourceBoost = sourceTrustBoost(candidate)
  const freshness = freshnessSignal(candidate, Date.now())
  const personalizationBoost = boundedPersonalizationBoost(candidate)
  const trendingBoost = boundedTrendingBoost(candidate)
  const trust = trustSignal(context, candidate)
  if (sourceBoost.reason) rankingReasons.push(sourceBoost.reason)
  rankingReasons.push(...trust.reasons)
  if (freshness.freshnessBoost > 0) rankingReasons.push('freshness_boost')
  if (freshness.coldStartBoost > 0) rankingReasons.push('cold_start_exposure')
  if (freshness.popularityDecay < 0) rankingReasons.push('popularity_decay')
  if (personalizationBoost > 0) rankingReasons.push('personalized_signal')
  if (trendingBoost > 0) rankingReasons.push('trending_signal')
  return {
    ...candidate,
    rankingScore:
      candidate.rank * SEARCH_RELEVANCE_V2_CONFIG.sourceRankWeight +
      entityWeight +
      sourceBoost.value +
      freshness.freshnessBoost +
      freshness.coldStartBoost +
      freshness.popularityDecay +
      personalizationBoost +
      trendingBoost +
      trust.scoreAdjustment,
    rankingReasons,
    explanationBadges: explanationBadges(trust.badges, trendingBoost),
  }
}

function trustSignal(
  context: SearchContext,
  candidate: SearchCandidatePayload
): {
  scoreAdjustment: number
  reasons: SearchRankingReason[]
  badges: SearchExplanationBadge[]
} {
  const cfg = SEARCH_RELEVANCE_V2_CONFIG.trust
  const reasons: SearchRankingReason[] = []
  const badges: SearchExplanationBadge[] = []
  let scoreAdjustment = 0

  if (candidate.source !== 'provider' && isExactMatch(context.query, candidateDisplayText(candidate))) {
    scoreAdjustment += cfg.exactMatchBoost
    reasons.push('exact_match')
    badges.push('Exact match')
  }

  if (candidate.kind === 'place' && candidate.source !== 'provider') {
    const distanceKm = placeDistanceKm(context, candidate)
    if (distanceKm != null && distanceKm <= cfg.nearbyKm) {
      scoreAdjustment += cfg.nearYouBoost
      reasons.push('nearby_signal')
      badges.push('Near you')
      if (placePostCount(candidate) >= cfg.popularNearbyPostCount) {
        scoreAdjustment += cfg.popularNearbyBoost
        reasons.push('popular_nearby')
        badges.push('Popular nearby')
      }
    }
  }

  if (isKeywordStuffed(context, candidate)) {
    scoreAdjustment -= cfg.keywordStuffingPenalty
    reasons.push('keyword_stuffing_penalty')
  }

  return { scoreAdjustment, reasons, badges }
}

function explanationBadges(
  badges: SearchExplanationBadge[],
  trendingBoost: number
): SearchExplanationBadge[] {
  const next = [...badges]
  if (trendingBoost > 0) next.push('Trending')
  return [...new Set(next)]
}

function isExactMatch(query: string, value: string): boolean {
  const normalizedQuery = normalizeSearchText(query)
  const normalizedValue = normalizeSearchText(value)
  return normalizedQuery.length > 0 && normalizedValue === normalizedQuery
}

function candidateDisplayText(candidate: SearchCandidatePayload): string {
  if (candidate.kind === 'dish') return candidate.item.name
  if (candidate.kind === 'place') return candidate.item.name
  if (candidate.kind === 'person') return `${candidate.item.username} ${candidate.item.full_name ?? ''}`
  return ''
}

function isKeywordStuffed(context: SearchContext, candidate: SearchCandidatePayload): boolean {
  const text = normalizeSearchText(candidateDisplayText(candidate))
  if (!text) return false
  const tokens = text.split(' ').filter(Boolean)
  if (tokens.length < 4) return false
  const queryTokens = new Set(context.words.map(normalizeSearchText).filter(Boolean))
  if (queryTokens.size === 0) return false
  const counts = new Map<string, number>()
  for (const token of tokens) {
    if (!queryTokens.has(token)) continue
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  return [...counts.values()].some(count => count > SEARCH_RELEVANCE_V2_CONFIG.trust.maxRepeatedQueryToken)
}

function suppressDuplicateCandidates(candidates: SearchCandidate[]): SearchCandidate[] {
  const byKey = new Map<string, SearchCandidate>()
  for (const candidate of candidates) {
    const key = duplicateKey(candidate)
    if (!key) {
      byKey.set(`unique:${candidate.kind}:${candidate.id}`, candidate)
      continue
    }
    const existing = byKey.get(key)
    if (!existing || compareDuplicateCandidates(candidate, existing) < 0) {
      byKey.set(key, candidate)
    }
  }
  return [...byKey.values()]
}

function duplicateKey(candidate: SearchCandidate): string | null {
  if (candidate.kind === 'place') {
    const googlePlaceId = normalizeSearchText(candidate.item.google_place_id ?? '')
    return googlePlaceId ? `place:${googlePlaceId}` : null
  }
  if (candidate.kind === 'dish') {
    const name = normalizeSearchText(candidate.item.name)
    return name ? `dish:${name}` : null
  }
  if (candidate.kind === 'person') {
    const username = normalizeSearchText(candidate.item.username)
    return username ? `person:${username}` : null
  }
  return null
}

function compareDuplicateCandidates(a: SearchCandidate, b: SearchCandidate): number {
  const sourceDelta = duplicateSourcePriority(a.source) - duplicateSourcePriority(b.source)
  if (sourceDelta !== 0) return sourceDelta
  if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore
  if (b.rank !== a.rank) return b.rank - a.rank
  return a.id.localeCompare(b.id)
}

function duplicateSourcePriority(source: SearchCandidatePayload['source']): number {
  if (source === 'local' || source === 'post_fts' || source === 'dish_fts' || source === 'user') return 0
  if (source === 'dish_post' || source === 'expanded') return 1
  return 2
}

function boundedPersonalizationBoost(candidate: SearchCandidatePayload): number {
  const boost = candidate.personalizationBoost ?? 0
  if (boost <= 0) return 0
  return Math.min(boost, SEARCH_RELEVANCE_V2_CONFIG.personalization.maxBoost)
}

function boundedTrendingBoost(candidate: SearchCandidatePayload): number {
  const score = candidate.trendingScore ?? 0
  if (score <= 0) return 0
  const cfg = SEARCH_RELEVANCE_V2_CONFIG.trending
  return Math.min(cfg.maxBoost, score / cfg.scoreDivisor)
}

function freshnessSignal(
  candidate: SearchCandidatePayload,
  now: number
): { freshnessBoost: number; coldStartBoost: number; popularityDecay: number } {
  if (candidate.kind === 'person' || candidate.source === 'provider') {
    return { freshnessBoost: 0, coldStartBoost: 0, popularityDecay: 0 }
  }

  const cfg = SEARCH_RELEVANCE_V2_CONFIG.freshness
  const latestAt = latestFreshnessTimestamp(candidate)
  const firstAt = firstFreshnessTimestamp(candidate)
  const latestFactor = recencyFactor(latestAt, now)
  const firstFactor = recencyFactor(firstAt, now)
  const freshnessBoost = cfg.maxFreshnessBoost * latestFactor
  const coldStartBoost = isColdStartCandidate(candidate)
    ? cfg.maxColdStartBoost * firstFactor
    : 0
  const popularityDecay = shouldDecayPopularity(candidate, latestFactor)
    ? -cfg.maxPopularityDecay
    : 0

  return { freshnessBoost, coldStartBoost, popularityDecay }
}

function latestFreshnessTimestamp(candidate: SearchCandidatePayload): string | null | undefined {
  if (candidate.kind === 'post') return candidate.createdAt
  if (candidate.kind === 'dish') return candidate.item.latestPostedAt
  if (candidate.kind === 'place') return candidate.item.latestPostedAt ?? candidate.item.createdAt
  return null
}

function firstFreshnessTimestamp(candidate: SearchCandidatePayload): string | null | undefined {
  if (candidate.kind === 'post') return candidate.createdAt
  if (candidate.kind === 'dish') return candidate.item.firstPostedAt ?? candidate.item.latestPostedAt
  if (candidate.kind === 'place') {
    return candidate.item.firstPostedAt ?? candidate.item.latestPostedAt ?? candidate.item.createdAt
  }
  return null
}

function recencyFactor(value: string | null | undefined, now: number): number {
  if (!value) return 0
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || timestamp > now) return 0
  const ageDays = (now - timestamp) / 86_400_000
  const cfg = SEARCH_RELEVANCE_V2_CONFIG.freshness
  if (ageDays >= cfg.staleAfterDays) return 0
  return Math.max(0, 1 - ageDays / cfg.decayWindowDays)
}

function isColdStartCandidate(candidate: SearchCandidatePayload): boolean {
  const cfg = SEARCH_RELEVANCE_V2_CONFIG.freshness
  if (candidate.kind === 'post') return candidate.rank <= cfg.lowVolumePostRank
  if (candidate.kind === 'dish') return candidate.item.post_count <= cfg.lowVolumeDishPosts
  if (candidate.kind === 'place') return placePostCount(candidate) <= cfg.lowVolumePlacePosts
  return false
}

function shouldDecayPopularity(candidate: SearchCandidatePayload, latestFactor: number): boolean {
  if (latestFactor > 0) return false
  if (candidate.kind === 'dish') return candidate.item.post_count > SEARCH_RELEVANCE_V2_CONFIG.freshness.lowVolumeDishPosts
  if (candidate.kind === 'place') return placePostCount(candidate) > SEARCH_RELEVANCE_V2_CONFIG.freshness.lowVolumePlacePosts
  return false
}

function placePostCount(candidate: Extract<SearchCandidatePayload, { kind: 'place' }>): number {
  return Math.max(0, candidate.item.postCount ?? 0)
}

function placeDistanceKm(
  context: SearchContext,
  candidate: Extract<SearchCandidatePayload, { kind: 'place' }>
): number | null {
  const location = context.userLocation
  const { latitude, longitude } = candidate.item
  if (!location || latitude == null || longitude == null) return null
  const toRadians = (value: number) => value * Math.PI / 180
  const radiusKm = 6371
  const deltaLat = toRadians(latitude - location.lat)
  const deltaLng = toRadians(longitude - location.lng)
  const originLat = toRadians(location.lat)
  const targetLat = toRadians(latitude)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(originLat) * Math.cos(targetLat) *
      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function sourceTrustBoost(candidate: SearchCandidatePayload): {
  value: number
  reason?: SearchRankingReason
} {
  const boost = SEARCH_RELEVANCE_V2_CONFIG.sourceTrustBoosts[candidate.source]
  if (candidate.source === 'local') return { value: boost, reason: 'local_source' }
  if (candidate.source === 'expanded') return { value: boost, reason: 'expanded_source' }
  if (candidate.source === 'provider') return { value: boost, reason: 'provider_source' }
  return { value: boost }
}

function shouldApplyDiversityPrelude(context: SearchContext): boolean {
  return context.intent === 'food_dish' || context.intent === 'mixed'
}

function applyDiversityPrelude(candidates: SearchCandidate[]): SearchCandidate[] {
  const selectedIds = new Set<string>()
  const prelude: SearchCandidate[] = []
  for (const kind of SEARCH_RELEVANCE_V2_CONFIG.diversityPreludeKinds) {
    const match = candidates.find(candidate => candidate.kind === kind && !selectedIds.has(candidate.id))
    if (!match) continue
    selectedIds.add(match.id)
    prelude.push(withDiversitySlot(match, kind))
  }
  return [
    ...prelude,
    ...candidates.filter(candidate => !selectedIds.has(candidate.id)),
  ]
}

function withDiversitySlot(candidate: SearchCandidate, kind: SearchCandidateKind): SearchCandidate {
  const diversitySlot = diversitySlotForKind(kind)
  if (!diversitySlot) return candidate
  return {
    ...candidate,
    diversitySlot,
    rankingReasons: [...candidate.rankingReasons, 'diversity_prelude'],
  }
}

function diversitySlotForKind(kind: SearchCandidateKind): SearchDiversitySlot | undefined {
  if (kind === 'dish') return 'top_dish'
  if (kind === 'post') return 'top_post'
  if (kind === 'place') return 'top_place'
  return undefined
}

function compareRankedCandidates(
  context: SearchContext,
  a: SearchCandidate,
  b: SearchCandidate
): number {
  if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore
  const entityDelta = entityPriority(context, a.kind) - entityPriority(context, b.kind)
  if (entityDelta !== 0) return entityDelta
  if (b.rank !== a.rank) return b.rank - a.rank
  return a.id.localeCompare(b.id)
}

function entityPriority(context: SearchContext, kind: SearchCandidateKind): number {
  return Object.keys(SEARCH_RELEVANCE_V2_CONFIG.entityWeights[context.intent]).indexOf(kind)
}
