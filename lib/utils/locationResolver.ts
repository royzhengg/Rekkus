import { fetchSuburbAliases, cacheSuburbLookup, resolveSuburbRpc } from '../services/suburbs'

let cachedAliases: Map<string, string> | null = null

/** Load suburb abbreviation cache from DB on app start. Call once in root layout. */
export async function loadSuburbAliasCache(): Promise<void> {
  const rows = await fetchSuburbAliases()
  cachedAliases = new Map(rows.map(r => [r.alias.toLowerCase(), r.canonical_name]))
}

/** Sync alias lookup (0ms) — resolves 'cbd', 'darlo', 'parra' etc. */
export function resolveFromAliasCache(term: string): string | null {
  return cachedAliases?.get(term.toLowerCase().trim()) ?? null
}

/** Async DB lookup using pg_trgm on suburb_lookups + places.suburb. */
export async function resolveSuburbQuery(term: string): Promise<string | null> {
  return resolveSuburbRpc(term)
}

/**
 * Feed a Google-resolved suburb back into suburb_lookups so future requests
 * hit our DB instead of calling Google Places again.
 */
export async function cacheResolvedSuburb(params: {
  name: string
  state?: string | null
  lat?: number | null
  lng?: number | null
}): Promise<void> {
  await cacheSuburbLookup({
    name: params.name,
    state: params.state ?? null,
    lat: params.lat ?? null,
    lng: params.lng ?? null,
  })
}
