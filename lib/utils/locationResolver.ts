import { supabase } from '../supabase'

let cachedAliases: Map<string, string> | null = null

/** Load suburb abbreviation cache from DB on app start. Call once in root layout. */
export async function loadSuburbAliasCache(): Promise<void> {
  const { data } = await supabase
    .from('suburb_aliases' as any)
    .select('alias, canonical_name')
    .limit(500)
  cachedAliases = new Map(
    ((data ?? []) as unknown as Array<{ alias: string; canonical_name: string }>).map(r => [
      r.alias.toLowerCase(),
      r.canonical_name,
    ])
  )
}

/** Sync alias lookup (0ms) — resolves 'cbd', 'darlo', 'parra' etc. */
export function resolveFromAliasCache(term: string): string | null {
  return cachedAliases?.get(term.toLowerCase().trim()) ?? null
}

/** Async DB lookup using pg_trgm on suburb_lookups + restaurants.suburb. */
export async function resolveSuburbQuery(term: string): Promise<string | null> {
  const { data } = await (supabase as any).rpc('resolve_suburb_query', { input_text: term })
  return (data as Array<{ canonical_suburb: string }> | null)?.[0]?.canonical_suburb ?? null
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
  await (supabase as any)
    .from('suburb_lookups')
    .upsert(
      { name: params.name, state: params.state ?? null, lat: params.lat ?? null, lng: params.lng ?? null },
      { onConflict: 'name' }
    )
}
