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

import type { RekkusOccasionTag } from '../../types/domain'

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

export const QUALITY_TERMS = new Set([
  'best', 'top', 'hidden', 'gem', 'cheap', 'budget', 'affordable',
  'fancy', 'expensive', 'splurge', 'michelin', 'popular', 'trending',
  'underrated', 'overrated', 'must', 'order', 'try',
])

export const LOCATION_INDICATORS = new Set(['near', 'in', 'around', 'at', 'nearby'])
