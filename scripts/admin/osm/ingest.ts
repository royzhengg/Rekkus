import { SupabaseClient } from '@supabase/supabase-js'
import { TransformedRow } from './transform'

const BATCH_SIZE = 500

export interface IngestStats {
  imported: number
  updated: number
  skipped: number
}

export async function ingestBatch(
  supabase: SupabaseClient,
  rows: TransformedRow[],
  importRunId: string,
  skipOsmIds: Set<string>,
  dryRun: boolean,
): Promise<IngestStats> {
  const stats: IngestStats = { imported: 0, updated: 0, skipped: 0 }

  const eligible = rows.filter(r => !skipOsmIds.has(r.place.osm_id))
  stats.skipped = rows.length - eligible.length

  if (dryRun) {
    stats.imported = eligible.length
    return stats
  }

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE)

    // Upsert places (identity only)
    const { data: placesData, error: placesErr } = await supabase
      .from('places')
      .upsert(
        batch.map(r => ({
          ...r.place,
          // Do not overwrite community_verified or owner_verified fields
        })),
        {
          onConflict: 'osm_id',
          ignoreDuplicates: false,
        },
      )
      .select('id, osm_id')

    if (placesErr) {
      console.error('  [ingest] places upsert error:', placesErr.message)
      continue
    }

    const placeIdByOsmId = new Map<string, string>(
      (placesData ?? []).map((p: { id: string; osm_id: string }) => [p.osm_id, p.id]),
    )

    // Build sub-table rows with resolved place_ids
    const contactRows = batch
      .map(r => ({ place_id: placeIdByOsmId.get(r.place.osm_id), ...r.contact }))
      .filter(r => r.place_id)

    const featuresRows = batch
      .map(r => ({ place_id: placeIdByOsmId.get(r.place.osm_id), ...r.features }))
      .filter(r => r.place_id)

    const providerRows = batch
      .map(r => ({
        place_id: placeIdByOsmId.get(r.place.osm_id),
        ...r.provider,
        osm_import_run_id: importRunId,
        osm_imported_at: new Date().toISOString(),
      }))
      .filter(r => r.place_id)

    const sourcesRows = batch
      .map(r => ({
        place_id: placeIdByOsmId.get(r.place.osm_id),
        source: 'osm',
        payload: r.raw_payload,
      }))
      .filter(r => r.place_id)

    const hoursRows = batch
      .filter(r => r.opening_hours && placeIdByOsmId.has(r.place.osm_id))
      .map(r => ({
        place_id: placeIdByOsmId.get(r.place.osm_id)!,
        ...r.opening_hours!,
      }))

    await Promise.all([
      supabase.from('place_contact').upsert(contactRows, { onConflict: 'place_id' }),
      supabase.from('place_features').upsert(featuresRows, { onConflict: 'place_id' }),
      supabase.from('place_provider_metadata').upsert(providerRows, { onConflict: 'place_id' }),
      supabase.from('place_sources').insert(sourcesRows),
      hoursRows.length > 0
        ? supabase.from('place_opening_hours').upsert(hoursRows, { onConflict: 'place_id,source' })
        : Promise.resolve(),
    ])

    stats.imported += batch.length
  }

  return stats
}
