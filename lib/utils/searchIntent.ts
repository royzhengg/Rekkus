import { CUISINE_ALIASES, getCuisineSynonyms } from './cuisineSynonyms'

export type SearchIntentKind = 'food_dish' | 'restaurant_name' | 'location' | 'mixed' | 'general'
export type RestaurantTagIntentKind =
  | 'restaurant_name'
  | 'venue_category'
  | 'dish_or_menu_item'
  | 'location_query'
  | 'general'
export type SearchLocationSource = 'gps' | 'manual' | 'none'
export type SearchFallbackReason =
  | 'local_results_present'
  | 'bounded_locality'
  | 'unbounded_restaurant_name'
  | 'explicit_location_query'
  | 'ambiguous_food_without_location'

export type SearchIntent = {
  kind: SearchIntentKind
  confidence: number
}

export type RestaurantTagIntent = {
  kind: RestaurantTagIntentKind
  providerIntent: SearchIntentKind
  confidence: number
}

export type SearchFallbackDecision = {
  shouldUseGoogleFallback: boolean
  suppressed: boolean
  reason: SearchFallbackReason
}

const FOOD_TERMS = new Set([
  'bbq',
  'barbecue',
  'beef',
  'burger',
  'burgers',
  'chicken',
  'coffee',
  'dumpling',
  'dumplings',
  'fried',
  'katsu',
  'noodle',
  'noodles',
  'pasta',
  'pho',
  'pizza',
  'pork',
  'ramen',
  'steak',
  'sushi',
  'taco',
  'tacos',
  'thai',
])

const RESTAURANT_NAME_TERMS = new Set([
  'chat thai',
  'din tai fung',
  'hurricanes grill',
  "hurricane's grill",
  'mamak',
  'tottis',
  "totti's",
])

const LOCATION_TERMS = new Set([
  'bondi',
  'chatswood',
  'haymarket',
  'melbourne',
  'parramatta',
  'sydney',
])

const LOCATION_PREPOSITIONS = new Set(['around', 'at', 'in', 'near'])

const VENUE_CATEGORY_TERMS = new Set([
  'bar',
  'bars',
  'bakery',
  'bakeries',
  'breakfast',
  'brunch',
  'cafe',
  'cafes',
  'coffee',
  'dessert',
  'desserts',
  'diner',
  'diners',
  'food',
  'gelato',
  'icecream',
  'icecreams',
  'ice',
  'pub',
  'pubs',
  'restaurant',
  'restaurants',
  'takeaway',
])

const RESTAURANT_TAG_DISH_TERMS = new Set([
  'egg',
  'eggs',
  'omelet',
  'omelets',
  'omelette',
  'omelettes',
])

function normalizeTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)
}

function normalizedPhrase(query: string): string {
  return normalizeTokens(query).join(' ')
}

function isFoodToken(token: string): boolean {
  return FOOD_TERMS.has(token) || getCuisineSynonyms(token).length > 0
}

function isVenueCategoryToken(token: string): boolean {
  return VENUE_CATEGORY_TERMS.has(token) || Object.prototype.hasOwnProperty.call(CUISINE_ALIASES, token)
}

function isRestaurantTagDishToken(token: string): boolean {
  return RESTAURANT_TAG_DISH_TERMS.has(token) || isFoodToken(token)
}

function hasLocationSignal(tokens: string[], hasParsedLocationTerms: boolean): boolean {
  if (hasParsedLocationTerms) return true
  return tokens.some(token => LOCATION_TERMS.has(token)) ||
    tokens.some((token, index) => LOCATION_PREPOSITIONS.has(token) && index < tokens.length - 1)
}

export function classifySearchIntent(
  query: string,
  options: { parsedIntent?: string; hasLocationTerms?: boolean } = {}
): SearchIntent {
  const tokens = normalizeTokens(query)
  if (tokens.length === 0) return { kind: 'general', confidence: 0.2 }

  const phrase = normalizedPhrase(query)
  const hasLocation = hasLocationSignal(tokens, options.hasLocationTerms === true)
  const foodTokenCount = tokens.filter(isFoodToken).length
  const hasFood = foodTokenCount > 0

  if (hasLocation && hasFood) return { kind: 'mixed', confidence: 0.86 }
  if (hasLocation) return { kind: 'location', confidence: 0.82 }

  if (options.parsedIntent === 'dish') return { kind: 'food_dish', confidence: 0.88 }
  if (options.parsedIntent === 'mixed') return { kind: hasFood ? 'food_dish' : 'mixed', confidence: 0.76 }
  if (RESTAURANT_NAME_TERMS.has(phrase)) return { kind: 'restaurant_name', confidence: 0.92 }

  const allFoodTokens = foodTokenCount === tokens.length
  if (hasFood && (allFoodTokens || tokens.length <= 2)) return { kind: 'food_dish', confidence: 0.84 }

  if (options.parsedIntent === 'restaurant') return { kind: 'restaurant_name', confidence: 0.78 }

  if (tokens.length >= 2 || /'s\b/i.test(query)) {
    return { kind: 'restaurant_name', confidence: 0.72 }
  }

  return { kind: 'general', confidence: 0.45 }
}

export function classifyRestaurantTagIntent(query: string): RestaurantTagIntent {
  const tokens = normalizeTokens(query)
  if (tokens.length === 0) {
    return { kind: 'general', providerIntent: 'general', confidence: 0.2 }
  }

  const base = classifySearchIntent(query)
  if (base.kind === 'location' || base.kind === 'mixed') {
    return { kind: 'location_query', providerIntent: base.kind, confidence: base.confidence }
  }

  const venueTokenCount = tokens.filter(isVenueCategoryToken).length
  if (venueTokenCount > 0 && venueTokenCount === tokens.length) {
    return { kind: 'venue_category', providerIntent: 'food_dish', confidence: 0.87 }
  }

  const dishTokenCount = tokens.filter(isRestaurantTagDishToken).length
  if (dishTokenCount > 0 && dishTokenCount === tokens.length) {
    return { kind: 'dish_or_menu_item', providerIntent: 'food_dish', confidence: 0.86 }
  }

  if (base.kind === 'food_dish') {
    return { kind: 'dish_or_menu_item', providerIntent: 'food_dish', confidence: base.confidence }
  }

  if (base.kind === 'restaurant_name') {
    return { kind: 'restaurant_name', providerIntent: 'restaurant_name', confidence: base.confidence }
  }

  return { kind: 'general', providerIntent: 'general', confidence: base.confidence }
}

export function resolveLocationSource(status: string, hasCoords: boolean): SearchLocationSource {
  if (!hasCoords) return 'none'
  return status === 'manual' ? 'manual' : 'gps'
}

export function decideSearchProviderFallback({
  hasLocality,
  intent,
  localPlaceCount,
  expandedPlaceCount,
}: {
  hasLocality: boolean
  intent: SearchIntentKind
  localPlaceCount: number
  expandedPlaceCount: number
}): SearchFallbackDecision {
  if (localPlaceCount > 0 || expandedPlaceCount > 0) {
    return { shouldUseGoogleFallback: false, suppressed: false, reason: 'local_results_present' }
  }

  if (hasLocality) {
    return { shouldUseGoogleFallback: true, suppressed: false, reason: 'bounded_locality' }
  }

  if (intent === 'location' || intent === 'mixed') {
    return { shouldUseGoogleFallback: true, suppressed: false, reason: 'explicit_location_query' }
  }

  // Suppress food/dish queries without location: Google returns restaurants (not dish venues)
  // and without a location bias the results are too broad to be useful.
  if (intent === 'food_dish') {
    return { shouldUseGoogleFallback: false, suppressed: true, reason: 'ambiguous_food_without_location' }
  }

  // For restaurant_name and general: fall back to Google — these are useful even without location.
  return { shouldUseGoogleFallback: true, suppressed: false, reason: 'unbounded_restaurant_name' }
}
