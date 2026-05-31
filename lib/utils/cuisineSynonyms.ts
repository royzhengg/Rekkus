import type { RekkusOccasionTag } from '../../types/domain'

export type SearchSynonymType = 'cuisine' | 'occasion' | 'dietary'

export type SearchSynonymRow = {
  term: string
  canonical: string
  type: SearchSynonymType
}

export const CUISINE_SYNONYMS: Record<string, string[]> = {
  // Japanese
  ramen: ['japanese'],
  sushi: ['japanese'],
  tempura: ['japanese'],
  yakitori: ['japanese'],
  udon: ['japanese'],
  sashimi: ['japanese'],
  izakaya: ['japanese'],
  tonkatsu: ['japanese'],
  // Chinese
  dumpling: ['chinese', 'asian'],
  dumplings: ['chinese', 'asian'],
  'dim sum': ['chinese'],
  noodle: ['chinese', 'asian'],
  noodles: ['chinese', 'asian'],
  wonton: ['chinese'],
  // Italian
  pizza: ['italian'],
  pasta: ['italian'],
  risotto: ['italian'],
  gelato: ['italian'],
  // Mexican
  taco: ['mexican'],
  tacos: ['mexican'],
  burrito: ['mexican'],
  quesadilla: ['mexican'],
  nachos: ['mexican'],
  // Indian
  curry: ['indian'],
  biryani: ['indian'],
  naan: ['indian'],
  tikka: ['indian'],
  masala: ['indian'],
  // Vietnamese
  pho: ['vietnamese'],
  banh: ['vietnamese'],
  bahn: ['vietnamese'],
  // American
  burger: ['american'],
  burgers: ['american'],
  bbq: ['american'],
  wings: ['american'],
  // Middle Eastern / Lebanese
  falafel: ['middle eastern', 'lebanese'],
  hummus: ['middle eastern', 'lebanese'],
  // Thai / Indonesian
  pad: ['thai'],
  satay: ['thai', 'indonesian'],
  tom: ['thai'],
  // French
  croissant: ['french', 'bakery'],
  crepe: ['french'],
  baguette: ['french'],
  // Spanish
  tapas: ['spanish'],
  paella: ['spanish'],
  // German / European
  schnitzel: ['german', 'european'],
  bratwurst: ['german'],
  // Turkish / Middle Eastern
  kebab: ['turkish', 'middle eastern'],
  shawarma: ['turkish', 'middle eastern'],
  // Greek
  gyros: ['greek'],
  souvlaki: ['greek'],
  // Cafe / Australian
  brunch: ['cafe', 'australian'],
  smashed: ['cafe', 'australian'],
  // Indonesian
  nasi: ['indonesian', 'asian'],
  rendang: ['indonesian'],
  gado: ['indonesian'],
  mie: ['indonesian', 'asian'],
  bakso: ['indonesian'],
  // Korean
  bibimbap: ['korean'],
  kimchi: ['korean'],
  bulgogi: ['korean'],
  japchae: ['korean'],
  kbbq: ['korean'],
  // Mediterranean
  mezze: ['mediterranean', 'middle eastern'],
  tzatziki: ['greek', 'mediterranean'],
  baklava: ['turkish', 'greek'],
}

export const CUISINE_ALIASES: Record<string, string[]> = {
  american: ['burger', 'burgers', 'bbq', 'wings', 'diner'],
  asian: ['dumpling', 'dumplings', 'noodle', 'noodles', 'satay', 'nasi', 'mie'],
  australian: ['brunch', 'smashed avo', 'cafe'],
  bakery: ['croissant', 'baguette', 'pastry'],
  cafe: ['brunch', 'coffee', 'smashed avo', 'breakfast'],
  chinese: ['dumpling', 'dumplings', 'dim sum', 'wonton', 'noodle', 'noodles'],
  french: ['croissant', 'crepe', 'baguette'],
  german: ['schnitzel', 'bratwurst'],
  greek: ['gyros', 'souvlaki', 'tzatziki'],
  indian: ['curry', 'biryani', 'naan', 'tikka', 'masala'],
  indonesian: ['nasi', 'rendang', 'gado', 'mie', 'bakso', 'satay'],
  italian: ['pizza', 'pasta', 'risotto', 'gelato', 'tiramisu'],
  japanese: ['ramen', 'sushi', 'tempura', 'yakitori', 'udon', 'sashimi', 'izakaya', 'tonkatsu'],
  korean: ['bibimbap', 'kimchi', 'bulgogi', 'japchae', 'kbbq'],
  lebanese: ['falafel', 'hummus', 'shawarma'],
  mediterranean: ['mezze', 'tzatziki'],
  mexican: ['taco', 'tacos', 'burrito', 'quesadilla', 'nachos'],
  'middle eastern': ['falafel', 'hummus', 'kebab', 'shawarma', 'mezze'],
  spanish: ['tapas', 'paella'],
  thai: ['pad thai', 'satay', 'tom yum', 'green curry'],
  turkish: ['kebab', 'shawarma', 'baklava'],
  vietnamese: ['pho', 'banh mi', 'bahn mi'],
}

export function cuisineMatchesAlias(cuisine: string | null | undefined, word: string): boolean {
  const normalized = cuisine?.trim().toLowerCase()
  if (!normalized) return false
  return (CUISINE_ALIASES[normalized] ?? []).some(alias => alias.includes(word))
}

export const OCCASION_SYNONYMS: Partial<Record<string, RekkusOccasionTag>> = {
  'date night': 'date_night', 'date': 'date_night', 'romantic': 'date_night',
  'casual': 'casual', 'catch up': 'casual', 'coffee': 'casual',
  'quick bite': 'quick_bite', 'quick': 'quick_bite', 'takeaway': 'quick_bite',
  'group': 'group', 'family': 'group', 'friends': 'group',
  'special': 'special', 'celebration': 'special', 'birthday': 'special',
  'anniversary': 'special', 'fine dining': 'special', 'fancy': 'special',
  'solo': 'solo', 'alone': 'solo',
}

export const DIETARY_TERMS: Record<string, string[]> = {
  'vegan': ['vegan'],
  'vegetarian': ['vegetarian'],
  'halal': ['halal'],
  'kosher': ['kosher'],
  'gluten free': ['gluten_free'],
  'gluten-free': ['gluten_free'],
  'dairy free': ['dairy_free'],
}

export function fallbackSearchSynonymRows(): SearchSynonymRow[] {
  return [
    ...Object.entries(CUISINE_SYNONYMS).flatMap(([term, cuisines]) =>
      cuisines.map(canonical => ({ term, canonical, type: 'cuisine' as const }))
    ),
    ...Object.entries(OCCASION_SYNONYMS).flatMap(([term, canonical]) =>
      canonical ? [{ term, canonical, type: 'occasion' as const }] : []
    ),
    ...Object.entries(DIETARY_TERMS).flatMap(([term, canonicals]) =>
      canonicals.map(canonical => ({ term, canonical, type: 'dietary' as const }))
    ),
  ]
}

let runtimeCuisineSynonyms: Record<string, string[]> = { ...CUISINE_SYNONYMS }
let runtimeOccasionSynonyms: Partial<Record<string, RekkusOccasionTag>> = { ...OCCASION_SYNONYMS }
let runtimeDietaryTerms: Record<string, string[]> = { ...DIETARY_TERMS }

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function mergeRecordValue<T extends string>(record: Record<string, T[]>, key: string, value: T): void {
  const current = record[key] ?? []
  if (!current.includes(value)) record[key] = [...current, value]
}

export function applySearchSynonymRows(rows: SearchSynonymRow[]): void {
  const cuisines: Record<string, string[]> = {}
  const occasions: Partial<Record<string, RekkusOccasionTag>> = {}
  const dietary: Record<string, string[]> = {}

  for (const row of rows) {
    const term = normalizeKey(row.term)
    const canonical = normalizeKey(row.canonical)
    if (!term || !canonical) continue
    if (row.type === 'cuisine') {
      mergeRecordValue(cuisines, term, canonical)
    } else if (row.type === 'occasion' && isRekkusOccasionTag(canonical)) {
      occasions[term] = canonical
    } else if (row.type === 'dietary') {
      mergeRecordValue(dietary, term, canonical)
    }
  }

  runtimeCuisineSynonyms = { ...CUISINE_SYNONYMS, ...cuisines }
  runtimeOccasionSynonyms = { ...OCCASION_SYNONYMS, ...occasions }
  runtimeDietaryTerms = { ...DIETARY_TERMS, ...dietary }
}

export function resetSearchSynonymsForTest(): void {
  runtimeCuisineSynonyms = { ...CUISINE_SYNONYMS }
  runtimeOccasionSynonyms = { ...OCCASION_SYNONYMS }
  runtimeDietaryTerms = { ...DIETARY_TERMS }
}

export function getCuisineSynonyms(term: string): string[] {
  return runtimeCuisineSynonyms[normalizeKey(term)] ?? []
}

export function hasCuisineSynonym(term: string): boolean {
  return runtimeCuisineSynonyms[normalizeKey(term)] !== undefined
}

export function getCuisineSynonymTerms(): string[] {
  return Object.keys(runtimeCuisineSynonyms)
}

export function getOccasionSynonym(term: string): RekkusOccasionTag | undefined {
  return runtimeOccasionSynonyms[normalizeKey(term)]
}

export function hasOccasionSynonym(term: string): boolean {
  return runtimeOccasionSynonyms[normalizeKey(term)] !== undefined
}

export function getOccasionSynonymTerms(): string[] {
  return Object.keys(runtimeOccasionSynonyms)
}

export function getDietaryTerms(term: string): string[] {
  return runtimeDietaryTerms[normalizeKey(term)] ?? []
}

export function hasDietaryTerm(term: string): boolean {
  return runtimeDietaryTerms[normalizeKey(term)] !== undefined
}

export function getDietaryTermKeys(): string[] {
  return Object.keys(runtimeDietaryTerms)
}

export function getSearchPhraseKeys(): string[] {
  return [
    ...getCuisineSynonymTerms(),
    ...getOccasionSynonymTerms(),
    ...getDietaryTermKeys(),
  ]
}

function isRekkusOccasionTag(value: string): value is RekkusOccasionTag {
  return (
    value === 'date_night' ||
    value === 'casual' ||
    value === 'quick_bite' ||
    value === 'group' ||
    value === 'special' ||
    value === 'solo'
  )
}

export const QUALITY_TERMS = new Set([
  'best', 'top', 'hidden', 'gem', 'cheap', 'budget', 'affordable',
  'fancy', 'expensive', 'splurge', 'michelin', 'popular', 'trending',
  'underrated', 'overrated', 'must', 'order', 'try',
])

export const LOCATION_INDICATORS = new Set(['near', 'in', 'around', 'at', 'nearby'])
