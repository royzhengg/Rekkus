import { OsmElement } from './fetch'

export interface PlaceRow {
  name: string
  address: string | null
  suburb: string | null
  city: string | null
  country: string
  latitude: number
  longitude: number
  osm_id: string
  cuisine_type: string | null
  cuisine_slug: string | null
  canonical_source: string
  verification_level: string
  created_source: string
}

export interface ContactRow {
  phone: string | null
  website: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
}

export interface FeaturesRow {
  wheelchair: string | null
  outdoor_seating: boolean | null
  takeaway: boolean | null
  delivery: boolean | null
  dietary_flags: string[]
  payment_methods: string[]
  smoking: string | null
  internet_access: string | null
  capacity: number | null
}

export interface ProviderRow {
  amenity_type: string | null
  brand: string | null
  brand_wikidata: string | null
  operator: string | null
  price_level: number | null
  floor_level: string | null
  start_date: string | null
  wikidata_id: string | null
  wikipedia_url: string | null
  image_url: string | null
  description: string | null
  alt_names: Record<string, string> | null
  state: string | null
  postcode: string | null
  osm_check_date: string | null
  raw_osm_tags: Record<string, string>
}

export interface OpeningHoursRow {
  hours_text: string
  source: string
  is_current: boolean
}

export interface TransformedRow {
  place: PlaceRow
  contact: ContactRow
  features: FeaturesRow
  provider: ProviderRow
  opening_hours: OpeningHoursRow | null
  raw_payload: Record<string, unknown>
}

const CUISINE_SLUG_MAP: Record<string, string> = {
  pizza: 'italian', italian: 'italian', pasta: 'italian',
  japanese: 'japanese', ramen: 'japanese', sushi: 'japanese', sashimi: 'japanese',
  chinese: 'chinese', cantonese: 'chinese', dim_sum: 'chinese', yum_cha: 'chinese',
  korean: 'korean',
  thai: 'thai',
  vietnamese: 'vietnamese', pho: 'vietnamese',
  indian: 'indian', curry: 'indian',
  mexican: 'mexican', tex_mex: 'mexican',
  american: 'american', burger: 'american', bbq: 'american',
  greek: 'greek',
  lebanese: 'lebanese', middle_eastern: 'middle_eastern',
  french: 'french',
  spanish: 'spanish',
  seafood: 'seafood', fish_and_chips: 'seafood',
  australian: 'australian', modern_australian: 'australian',
  coffee_shop: 'cafe', cafe: 'cafe',
  bakery: 'bakery',
  ice_cream: 'dessert', dessert: 'dessert',
  fast_food: 'fast_food',
}

function cuisineSlug(raw: string | undefined): string | null {
  if (!raw) return null
  const first = (raw.split(';')[0] ?? '').trim().toLowerCase().replace(/[\s-]/g, '_')
  if (!first) return null
  return CUISINE_SLUG_MAP[first] ?? first
}

function boolTag(val: string | undefined): boolean | null {
  if (val === 'yes') return true
  if (val === 'no') return false
  return null
}

function altNames(tags: Record<string, string>): Record<string, string> | null {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(tags)) {
    const m = k.match(/^name:([a-z]{2,5})$/)
    if (m?.[1]) result[m[1]] = v
  }
  return Object.keys(result).length > 0 ? result : null
}

function dietaryFlags(tags: Record<string, string>): string[] {
  const flags: string[] = []
  const map: Record<string, string> = {
    'diet:vegan': 'vegan',
    'diet:vegetarian': 'vegetarian',
    'diet:halal': 'halal',
    'diet:kosher': 'kosher',
    'diet:gluten_free': 'gluten_free',
  }
  for (const [k, slug] of Object.entries(map)) {
    if (tags[k] === 'yes') flags.push(slug)
  }
  return flags
}

function paymentMethods(tags: Record<string, string>): string[] {
  const methods: string[] = []
  for (const [k, v] of Object.entries(tags)) {
    if (k.startsWith('payment:') && v === 'yes') {
      methods.push(k.replace('payment:', ''))
    }
  }
  return methods
}

function buildAddress(tags: Record<string, string>): string | null {
  const house = tags['addr:housenumber']
  const street = tags['addr:street']
  if (!street) return null
  return house ? `${house} ${street}` : street
}

export function transform(el: OsmElement, capitalCity: string): TransformedRow | null {
  const tags = el.tags ?? {}
  const name = tags.name
  if (!name?.trim()) return null

  const lat = el.type === 'node' ? el.lat : el.center.lat
  const lon = el.type === 'node' ? el.lon : el.center.lon

  const place: PlaceRow = {
    name: name.trim(),
    address: buildAddress(tags),
    suburb: tags['addr:suburb'] ?? tags.neighbourhood ?? null,
    city: tags['addr:city'] ?? capitalCity,
    country: tags['addr:country'] ?? 'Australia',
    latitude: lat,
    longitude: lon,
    osm_id: `${el.type}/${el.id}`,
    cuisine_type: tags.cuisine?.split(';')[0]?.trim() ?? null,
    cuisine_slug: cuisineSlug(tags.cuisine),
    canonical_source: 'osm',
    verification_level: 'osm_only',
    created_source: 'osm',
  }

  const contact: ContactRow = {
    phone: tags.phone ?? tags['contact:phone'] ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    instagram_url: tags['contact:instagram'] ?? null,
    facebook_url: tags['contact:facebook'] ?? null,
    tiktok_url: tags['contact:tiktok'] ?? null,
  }

  const features: FeaturesRow = {
    wheelchair: tags.wheelchair ?? null,
    outdoor_seating: boolTag(tags.outdoor_seating),
    takeaway: boolTag(tags.takeaway),
    delivery: boolTag(tags.delivery),
    dietary_flags: dietaryFlags(tags),
    payment_methods: paymentMethods(tags),
    smoking: tags.smoking ?? null,
    internet_access: tags.internet_access ?? null,
    capacity: tags.capacity ? parseInt(tags.capacity, 10) : null,
  }

  const provider: ProviderRow = {
    amenity_type: tags.amenity ?? tags.shop ?? null,
    brand: tags.brand ?? null,
    brand_wikidata: tags['brand:wikidata'] ?? null,
    operator: tags.operator ?? null,
    price_level: null,
    floor_level: tags.level ?? null,
    start_date: tags.start_date ?? null,
    wikidata_id: tags.wikidata ?? null,
    wikipedia_url: tags.wikipedia ?? null,
    image_url: tags.image ?? null,
    description: tags.description ?? null,
    alt_names: altNames(tags),
    state: tags['addr:state'] ?? null,
    postcode: tags['addr:postcode'] ?? null,
    osm_check_date: tags.check_date ?? null,
    raw_osm_tags: tags,
  }

  const opening_hours: OpeningHoursRow | null = tags.opening_hours
    ? { hours_text: tags.opening_hours, source: 'osm', is_current: true }
    : null

  return { place, contact, features, provider, opening_hours, raw_payload: el as unknown as Record<string, unknown> }
}
