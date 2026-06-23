import {
  CUISINE_ALIASES,
  QUALITY_TERMS,
  LOCATION_INDICATORS,
  getDietaryTerms,
  getOccasionSynonym,
  getSearchPhraseKeys,
  getCuisineSynonymTerms,
  hasCuisineSynonym,
} from './cuisineSynonyms'
import { resolveFromAliasCache } from './locationResolver'
import type { RekkusOccasionTag } from '../../types/domain'

export type QueryIntent =
  | 'cuisine'
  | 'dish'
  | 'place'
  | 'location'
  | 'occasion'
  | 'dietary'
  | 'mixed'
  | 'general'

export type ParsedQuery = {
  raw: string
  normalised: string
  intent: QueryIntent
  cuisineTerms: string[]
  dishTerms: string[]
  locationTerms: string[]
  occasionTerms: RekkusOccasionTag[]
  dietaryTerms: string[]
  qualityTerms: string[]
  /** Cleaned terms to send to FTS — no location/occasion/dietary/quality noise */
  searchWords: string[]
  /** True when query looks like a partial word (< 4 chars or no space typed yet) */
  isPrefix: boolean
  /** Multi-word matches extracted before word-level processing, e.g. "pad thai" */
  detectedPhrases: string[]
  /** Canonical suburb name resolved from locationTerms; null if not resolved */
  resolvedSuburb: string | null
}

function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function _buildNgrams(words: string[], n: number): string[] {
  const result: string[] = []
  for (let i = 0; i <= words.length - n; i++) {
    result.push(words.slice(i, i + n).join(' '))
  }
  return result
}

export function parseSearchQuery(raw: string): ParsedQuery {
  try {
    const normalised = normalise(raw)
    const allWords = normalised.split(' ').filter(w => w.length > 0)

    if (allWords.length === 0) {
      return fallbackParsedQuery(raw)
    }

    // Step 1: Phrase detection — check bigrams and trigrams against known phrase keys
    const removedIndices = new Set<number>()
    const detectedPhrases: string[] = []

    const phraseSources = getSearchPhraseKeys().filter(k => k.includes(' '))

    for (const n of [3, 2]) {
      for (let i = 0; i <= allWords.length - n; i++) {
        if (Array.from({ length: n }).some((_, j) => removedIndices.has(i + j))) continue
        const phrase = allWords.slice(i, i + n).join(' ')
        if (phraseSources.includes(phrase)) {
          detectedPhrases.push(phrase)
          for (let j = 0; j < n; j++) removedIndices.add(i + j)
        }
      }
    }

    let remaining = allWords.filter((_, i) => !removedIndices.has(i))

    // Step 2: Extract location terms — consume words after a LOCATION_INDICATOR
    const locationTerms: string[] = []
    const locationRemoved = new Set<number>()
    for (let i = 0; i < remaining.length; i++) {
      const word = remaining[i]
      if (word && LOCATION_INDICATORS.has(word)) {
        locationRemoved.add(i)
        let j = i + 1
        while (j < remaining.length) {
          const locationWord = remaining[j]
          if (!locationWord || LOCATION_INDICATORS.has(locationWord)) break
          locationTerms.push(locationWord)
          locationRemoved.add(j)
          j++
        }
        i = j - 1
      }
    }
    remaining = remaining.filter((_, i) => !locationRemoved.has(i))

    // Step 3: Extract occasion terms (words + bigrams)
    const occasionTerms: RekkusOccasionTag[] = []
    const occasionRemoved = new Set<number>()
    // Check bigrams first
    for (let i = 0; i < remaining.length - 1; i++) {
      const first = remaining[i]
      const second = remaining[i + 1]
      if (!first || !second) continue
      const bigram = `${first} ${second}`
      const occasion = getOccasionSynonym(bigram)
      if (occasion) {
        occasionTerms.push(occasion)
        occasionRemoved.add(i)
        occasionRemoved.add(i + 1)
      }
    }
    // Then singles
    for (let i = 0; i < remaining.length; i++) {
      if (occasionRemoved.has(i)) continue
      const word = remaining[i]
      if (!word) continue
      const occasion = getOccasionSynonym(word)
      if (occasion) {
        occasionTerms.push(occasion)
        occasionRemoved.add(i)
      }
    }
    remaining = remaining.filter((_, i) => !occasionRemoved.has(i))

    // Step 4: Extract dietary terms (words + bigrams)
    const dietaryTerms: string[] = []
    const dietaryRemoved = new Set<number>()
    for (let i = 0; i < remaining.length - 1; i++) {
      const first = remaining[i]
      const second = remaining[i + 1]
      if (!first || !second) continue
      const bigram = `${first} ${second}`
      const dietary = getDietaryTerms(bigram)
      if (dietary.length > 0) {
        dietaryTerms.push(...dietary)
        dietaryRemoved.add(i)
        dietaryRemoved.add(i + 1)
      }
    }
    for (let i = 0; i < remaining.length; i++) {
      if (dietaryRemoved.has(i)) continue
      const word = remaining[i]
      if (!word) continue
      const dietary = getDietaryTerms(word)
      if (dietary.length > 0) {
        dietaryTerms.push(...dietary)
        dietaryRemoved.add(i)
      }
    }
    remaining = remaining.filter((_, i) => !dietaryRemoved.has(i))

    // Step 5: Extract quality terms
    const qualityTerms: string[] = []
    const qualityRemoved = new Set<number>()
    for (let i = 0; i < remaining.length; i++) {
      const word = remaining[i]
      if (word && QUALITY_TERMS.has(word)) {
        qualityTerms.push(word)
        qualityRemoved.add(i)
      }
    }
    remaining = remaining.filter((_, i) => !qualityRemoved.has(i))

    // Step 6: Classify remaining words into cuisine / dish / place tokens
    const cuisineTerms: string[] = []
    const dishTerms: string[] = []
    const placeTokens: string[] = []

    for (const word of remaining) {
      if (Object.keys(CUISINE_ALIASES).includes(word)) {
        cuisineTerms.push(word)
      } else if (hasCuisineSynonym(word)) {
        dishTerms.push(word)
      } else {
        placeTokens.push(word)
      }
    }

    // Phrases classified into dishes or cuisine
    for (const phrase of detectedPhrases) {
      if (hasCuisineSynonym(phrase)) {
        dishTerms.push(phrase)
      } else {
        const occasion = getOccasionSynonym(phrase)
        const dietary = getDietaryTerms(phrase)
        if (occasion) {
          occasionTerms.push(occasion)
        } else if (dietary.length > 0) {
          dietaryTerms.push(...dietary)
        } else {
          dishTerms.push(phrase)
        }
      }
    }

    // Step 7: Assign intent
    const intentCounts = [
      cuisineTerms.length > 0,
      dishTerms.length > 0,
      placeTokens.length > 0,
      locationTerms.length > 0,
      occasionTerms.length > 0,
      dietaryTerms.length > 0,
    ].filter(Boolean).length

    let intent: QueryIntent
    if (intentCounts === 0) {
      intent = 'general'
    } else if (intentCounts > 1) {
      intent = 'mixed'
    } else if (cuisineTerms.length > 0) {
      intent = 'cuisine'
    } else if (dishTerms.length > 0) {
      intent = 'dish'
    } else if (locationTerms.length > 0) {
      intent = 'location'
    } else if (occasionTerms.length > 0) {
      intent = 'occasion'
    } else if (dietaryTerms.length > 0) {
      intent = 'dietary'
    } else {
      intent = 'place'
    }

    // Step 8: isPrefix — partial word typed
    const isPrefix =
      raw.trim().length < 4 ||
      (!raw.includes(' ') &&
        !getCuisineSynonymTerms().includes(normalised) &&
        !Object.keys(CUISINE_ALIASES).includes(normalised))

    // Step 9: Build searchWords (FTS-worthy terms, no noise)
    const searchWords = [
      ...cuisineTerms,
      ...dishTerms,
      ...placeTokens,
    ].filter((w, i, arr) => arr.indexOf(w) === i) // dedupe

    // Step 10: Resolve suburb from location terms synchronously (alias cache)
    const locationPhrase = locationTerms.join(' ')
    const resolvedSuburb = locationPhrase ? resolveFromAliasCache(locationPhrase) : null

    return {
      raw,
      normalised,
      intent,
      cuisineTerms,
      dishTerms,
      locationTerms,
      occasionTerms: [...new Set(occasionTerms)],
      dietaryTerms: [...new Set(dietaryTerms)],
      qualityTerms,
      searchWords,
      isPrefix,
      detectedPhrases,
      resolvedSuburb,
    }
  } catch {
    return fallbackParsedQuery(raw)
  }
}

function fallbackParsedQuery(raw: string): ParsedQuery {
  const normalised = raw.toLowerCase().trim()
  const searchWords = normalised
    .split(/\s+/)
    .filter(w => w.length > 0 && !LOCATION_INDICATORS.has(w))
  return {
    raw,
    normalised,
    intent: 'general',
    cuisineTerms: [],
    dishTerms: [],
    locationTerms: [],
    occasionTerms: [],
    dietaryTerms: [],
    qualityTerms: [],
    searchWords,
    isPrefix: false,
    detectedPhrases: [],
    resolvedSuburb: null,
  }
}
