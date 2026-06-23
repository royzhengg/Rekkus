type PlaceEnrichmentInput = {
  name: string
  cuisine_type: string | null
}

type OsmTags = Record<string, string | undefined>

type PlaceAttributes = {
  cuisine_type: string | null
  occasion_tags: string[]
}

function sanitizeOccasionTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

const FINE_DINING_TERMS = ['omakase', 'kaiseki', 'degustation', 'tasting menu', 'haute cuisine']

const FAST_FOOD_CHAINS = [
  "mcdonald's", 'mcdonalds', 'kfc', 'hungry jacks', "hungry jack's",
  'subway', 'dominos', "domino's", 'pizza hut', 'red rooster',
  'oporto', 'nandos', "nando's", "grill'd",
]

const BAR_TERMS = ['tavern', 'pub', 'bar', 'brewery', 'taproom', 'alehouse']

const OSM_CUISINE_TO_REKKUS: Record<string, string> = {
  sushi: 'Japanese',
  ramen: 'Japanese',
  japanese: 'Japanese',
  udon: 'Japanese',
  tempura: 'Japanese',
  burger: 'Burgers',
  burgers: 'Burgers',
  pizza: 'Italian',
  italian: 'Italian',
  pasta: 'Italian',
  chinese: 'Chinese',
  indian: 'Indian',
  curry: 'Indian',
  thai: 'Thai',
  vietnamese: 'Vietnamese',
  pho: 'Vietnamese',
  mexican: 'Mexican',
  korean: 'Korean',
  greek: 'Greek',
  lebanese: 'Lebanese',
  turkish: 'Turkish',
  french: 'French',
  spanish: 'Spanish',
  coffee: 'Cafe',
  cafe: 'Cafe',
  sandwich: 'Cafe',
}

export function inferOccasionTags(place: PlaceEnrichmentInput): string[] {
  const nameLower = place.name.toLowerCase()
  const cuisineLower = (place.cuisine_type ?? '').toLowerCase()
  const combined = `${nameLower} ${cuisineLower}`

  const tags: string[] = []

  if (FINE_DINING_TERMS.some(t => combined.includes(t))) {
    tags.push('fine_dining', 'special')
    return [...new Set(tags)].map(sanitizeOccasionTag)
  }

  const cuisineType = (place.cuisine_type ?? '').toLowerCase()
  if (cuisineType === 'fast food' || cuisineType === 'fast_food') {
    tags.push('quick_bite', 'casual')
    return [...new Set(tags)].map(sanitizeOccasionTag)
  }

  if (FAST_FOOD_CHAINS.some(chain => nameLower.includes(chain))) {
    tags.push('quick_bite', 'casual')
    return [...new Set(tags)].map(sanitizeOccasionTag)
  }

  if (BAR_TERMS.some(t => nameLower.includes(t))) {
    tags.push('casual', 'group')
    return [...new Set(tags)].map(sanitizeOccasionTag)
  }

  if (cuisineType === 'cafe') {
    tags.push('casual', 'quick_bite')
    return [...new Set(tags)].map(sanitizeOccasionTag)
  }

  return []
}

export function mapOsmTagsToPlaceAttributes(osmTags: OsmTags): PlaceAttributes {
  const amenity = osmTags.amenity ?? ''
  const cuisine = (osmTags.cuisine ?? '').toLowerCase()

  const cuisineType = OSM_CUISINE_TO_REKKUS[cuisine] ?? null

  const occasion_tags: string[] = []

  if (amenity === 'fast_food') {
    occasion_tags.push('quick_bite', 'casual')
  } else if (amenity === 'bar') {
    occasion_tags.push('casual', 'group')
  } else if (amenity === 'cafe') {
    occasion_tags.push('casual')
  }

  return {
    cuisine_type: cuisineType,
    occasion_tags: [...new Set(occasion_tags)].map(sanitizeOccasionTag),
  }
}
