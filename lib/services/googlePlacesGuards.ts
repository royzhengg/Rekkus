export type GoogleAreaSuggestion = {
  place_id: string
  description: string
  structured_formatting: { main_text: string; secondary_text: string }
}

export type GooglePrediction = GoogleAreaSuggestion & {
  types?: string[]
}

export type GooglePlaceMetadata = {
  name?: string
  formatted_address?: string
  geometry?: { location: { lat: number; lng: number } }
  business_status?: string
  formatted_phone_number?: string
  website?: string
  price_level?: number
  types?: string[]
  opening_hours?: { open_now?: boolean; weekday_text?: string[] }
  photos?: { photo_reference?: string }[]
  rating?: number
  user_ratings_total?: number
}

export type GooglePlaceDetail = GooglePlaceMetadata & {
  name: string
  formatted_address: string
  geometry: { location: { lat: number; lng: number } }
}

export type GoogleTextSearchPlace = GooglePlaceDetail & {
  place_id: string
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function hasAllowedGoogleStatus(value: unknown): boolean {
  if (!isRecord(value)) return false
  const status = value.status
  return status === undefined || status === 'OK' || status === 'ZERO_RESULTS'
}

export function googlePredictionsEnvelope(value: unknown): { predictions?: unknown[] } | null {
  if (!isRecord(value)) return null
  const predictions = value.predictions
  return { predictions: Array.isArray(predictions) ? predictions : [] }
}

export function googleResultEnvelope<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): { result?: T } | null {
  if (!isRecord(value)) return null
  if (!('result' in value)) return {}
  return guard(value.result) ? { result: value.result } : {}
}

export function googleResultsEnvelope<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): { results?: T[] } | null {
  if (!isRecord(value)) return null
  const results = value.results
  return { results: Array.isArray(results) ? results.filter(guard) : [] }
}

export function isGoogleAreaSuggestion(value: unknown): value is GoogleAreaSuggestion {
  if (!isRecord(value) || !isRecord(value.structured_formatting)) return false
  return (
    typeof value.place_id === 'string' &&
    typeof value.description === 'string' &&
    typeof value.structured_formatting.main_text === 'string' &&
    typeof value.structured_formatting.secondary_text === 'string'
  )
}

export function isGooglePrediction(value: unknown): value is GooglePrediction {
  if (!isRecord(value)) return false
  const types = value.types
  if (!isGoogleAreaSuggestion(value)) return false
  return types === undefined || (
    Array.isArray(types) &&
    types.every((type: unknown) => typeof type === 'string')
  )
}

function isLocation(value: unknown): value is { lat: number; lng: number } {
  return isRecord(value) && typeof value.lat === 'number' && typeof value.lng === 'number'
}

function isGeometry(value: unknown): value is { location: { lat: number; lng: number } } {
  return isRecord(value) && isLocation(value.location)
}

function isPhoto(value: unknown): value is { photo_reference?: string } {
  return isRecord(value) && (value.photo_reference === undefined || typeof value.photo_reference === 'string')
}

function isOpeningHours(value: unknown): value is { open_now?: boolean; weekday_text?: string[] } {
  return isRecord(value) &&
    (value.open_now === undefined || typeof value.open_now === 'boolean') &&
    (value.weekday_text === undefined || (Array.isArray(value.weekday_text) && value.weekday_text.every(text => typeof text === 'string')))
}

export function isGooglePlaceMetadata(value: unknown): value is GooglePlaceMetadata {
  if (!isRecord(value)) return false
  if (value.name !== undefined && typeof value.name !== 'string') return false
  if (value.formatted_address !== undefined && typeof value.formatted_address !== 'string') return false
  if (value.geometry !== undefined && !isGeometry(value.geometry)) return false
  if (value.business_status !== undefined && typeof value.business_status !== 'string') return false
  if (value.formatted_phone_number !== undefined && typeof value.formatted_phone_number !== 'string') return false
  if (value.website !== undefined && typeof value.website !== 'string') return false
  if (value.price_level !== undefined && typeof value.price_level !== 'number') return false
  if (value.rating !== undefined && typeof value.rating !== 'number') return false
  if (value.user_ratings_total !== undefined && typeof value.user_ratings_total !== 'number') return false
  if (value.types !== undefined && (!Array.isArray(value.types) || !value.types.every(type => typeof type === 'string'))) return false
  if (value.photos !== undefined && (!Array.isArray(value.photos) || !value.photos.every(isPhoto))) return false
  if (value.opening_hours !== undefined && !isOpeningHours(value.opening_hours)) return false
  return true
}

export function isGooglePlaceDetail(value: unknown): value is GooglePlaceDetail {
  return (
    isGooglePlaceMetadata(value) &&
    typeof value.name === 'string' &&
    typeof value.formatted_address === 'string' &&
    isGeometry(value.geometry)
  )
}

export function isGoogleTextSearchPlace(value: unknown): value is GoogleTextSearchPlace {
  return isRecord(value) && typeof value.place_id === 'string' && isGooglePlaceDetail(value)
}

export function isGooglePlaceIdResult(value: unknown): value is { place_id: string } {
  return isRecord(value) && typeof value.place_id === 'string'
}
