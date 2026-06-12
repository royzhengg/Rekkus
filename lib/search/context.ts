import { resolveFromAliasCache, resolveSuburbQuery } from '@/lib/utils/locationResolver'
import { fallbackParsedQuery, parseSearchQuery } from '@/lib/utils/queryParser'
import {
  classifySearchIntent,
  resolveLocationSource,
} from '@/lib/utils/searchIntent'
import { boundingBoxForRadius, parseWords } from '@/lib/utils/searchScoring'
import type { SearchContext, SearchOptions, UserLocation } from './types'

type BuildSearchContextArgs = {
  query: string
  userLocation: UserLocation
  options?: SearchOptions | undefined
}

export async function buildSearchContext({
  query,
  userLocation,
  options = {},
}: BuildSearchContextArgs): Promise<SearchContext> {
  const words = parseWords(query)
  const mode = options.mode ?? 'search'
  const radiusKm = options.radiusKm ?? 10
  const isAroundMe = mode === 'aroundMe'
  const normalizedQuery = words.join(' ')
  const parsed = normalizedQuery.length > 0 ? parseSafely(normalizedQuery) : fallbackParsedQuery(query)
  const intent = classifySearchIntent(normalizedQuery, {
    parsedIntent: parsed.intent,
    hasLocationTerms: parsed.locationTerms.length > 0,
  })
  const suburbFilter = await resolveSuburbFilter(parsed.locationTerms)
  const locationSource = options.locationSource ?? resolveLocationSource('gps', userLocation != null)

  const placeQuery = parsed.searchWords.join(' ') || normalizedQuery
  const dishQuery = parsed.dishTerms.join(' ') || placeQuery
  const dishIntentActive =
    !isAroundMe &&
    dishQuery.length > 0 &&
    (parsed.intent === 'dish' || parsed.intent === 'mixed' || intent.kind === 'food_dish')

  return {
    rawQuery: query,
    query: normalizedQuery,
    words,
    parsed,
    intent: intent.kind,
    mode,
    radiusKm,
    userId: options.userId ?? null,
    filters: options.filters,
    userLocation,
    locationSource,
    suburbFilter,
    bounds: isAroundMe && userLocation ? boundingBoxForRadius(userLocation, radiusKm) : undefined,
    hasQuery: words.length > 0 || isAroundMe,
    isAroundMe,
    dishIntentActive,
    dishQuery,
    placeQuery,
  }
}

function parseSafely(query: string) {
  try {
    return parseSearchQuery(query)
  } catch {
    return fallbackParsedQuery(query)
  }
}

async function resolveSuburbFilter(locationTerms: string[]): Promise<string | undefined> {
  if (locationTerms.length === 0) return undefined
  const locationPhrase = locationTerms.join(' ')
  const alias = resolveFromAliasCache(locationPhrase)
  if (alias) return alias
  try {
    return (await resolveSuburbQuery(locationPhrase)) ?? undefined
  } catch {
    return undefined
  }
}
