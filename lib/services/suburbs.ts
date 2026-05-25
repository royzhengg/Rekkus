import { supabase } from '../supabase'

export type SuburbAliasRow = { alias: string; canonical_name: string }
type SuburbLookupUpsert = { name: string; state: string | null; lat: number | null; lng: number | null }
export async function fetchSuburbAliases(): Promise<SuburbAliasRow[]> {
  const { data, error } = await supabase
    .from('suburb_aliases')
    .select('alias, canonical_name')
    .limit(500)
  if (error) throw error
  return data ?? []
}

export async function cacheSuburbLookup(params: SuburbLookupUpsert): Promise<void> {
  const { error } = await supabase
    .from('suburb_lookups')
    .upsert(
      { name: params.name, state: params.state ?? null, lat: params.lat ?? null, lng: params.lng ?? null },
      { onConflict: 'name' }
    )
  if (error) throw error
}

export async function resolveSuburbRpc(term: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_suburb_query', { input_text: term })
  if (error) throw error
  return data?.[0]?.canonical_suburb ?? null
}
