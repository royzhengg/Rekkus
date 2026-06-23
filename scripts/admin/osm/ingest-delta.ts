import { SupabaseClient } from '@supabase/supabase-js'
import { TransformedRow } from './transform'

const BATCH_SIZE = 500
const PROTECTED_LEVELS = new Set(['community_verified', 'owner_verified'])

export interface DeltaStats {
  updated: number
  logged: number
  skipped: number
}

interface ExistingPlace {
  id: string
  osm_id: string
  verification_level: string
}

async function fetchExistingPlaces(
  supabase: SupabaseClient,
  osmIds: string[],
): Promise<Map<string, ExistingPlace>> {
  const result = new Map<string, ExistingPlace>()

  for (let i = 0; i < osmIds.length; i += BATCH_SIZE) {
    const chunk = osmIds.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('places')
      .select('id, osm_id, verification_level')
      .in('osm_id', chunk)

    if (error) {
      console.error('  [ingest-delta] fetch existing places error:', error.message)
      continue
    }

    for (const row of data ?? []) {
      result.set(row.osm_id, row as ExistingPlace)
    }
  }

  return result
}

async function logSkippedAuditEvents(
  supabase: SupabaseClient,
  protected_: Array<{ existing: ExistingPlace; incoming: TransformedRow }>,
): Promise<void> {
  for (let i = 0; i < protected_.length; i += BATCH_SIZE) {
    const chunk = protected_.slice(i, i + BATCH_SIZE)
    const auditRows = chunk.map(({ existing, incoming }) => ({
      actor_type: 'system',
      actor_id: null,
      action: 'osm_delta_skipped',
      entity_type: 'place',
      entity_id: existing.id,
      source_type: 'osm_delta',
      reason: 'verification_level protected',
      before_summary: { verification_level: existing.verification_level },
      after_summary: {
        name: incoming.place.name,
        address: incoming.place.address,
        cuisine_type: incoming.place.cuisine_type,
        latitude: incoming.place.latitude,
        longitude: incoming.place.longitude,
      },
    }))

    const { error } = await supabase.from('restaurant_audit_events').insert(auditRows)
    if (error) {
      console.error('  [ingest-delta] audit insert error:', error.message)
    }
  }
}

async function applyUpdates(
  supabase: SupabaseClient,
  updatable: Array<{ existing: ExistingPlace; incoming: TransformedRow }>,
  importRunId: string,
): Promise<number> {
  let successCount = 0

  for (let i = 0; i < updatable.length; i += BATCH_SIZE) {
    const chunk = updatable.slice(i, i + BATCH_SIZE)

    const placeUpdates = chunk.map(({ existing, incoming }) => ({
      id: existing.id,
      name: incoming.place.name,
      address: incoming.place.address,
      suburb: incoming.place.suburb,
      city: incoming.place.city,
      latitude: incoming.place.latitude,
      longitude: incoming.place.longitude,
      cuisine_type: incoming.place.cuisine_type,
      cuisine_slug: incoming.place.cuisine_slug,
      // verification_level intentionally omitted — preserve existing value
    }))

    const { error: placesErr } = await supabase.from('places').upsert(placeUpdates, {
      onConflict: 'id',
      ignoreDuplicates: false,
    })

    if (placesErr) {
      console.error('  [ingest-delta] places update error:', placesErr.message)
      continue
    }

    successCount += chunk.length

    const placeIdByOsmId = new Map(chunk.map(({ existing }) => [existing.osm_id, existing.id]))

    const contactRows = chunk
      .map(({ incoming }) => ({
        place_id: placeIdByOsmId.get(incoming.place.osm_id),
        ...incoming.contact,
      }))
      .filter(r => r.place_id)

    const featuresRows = chunk
      .map(({ incoming }) => ({
        place_id: placeIdByOsmId.get(incoming.place.osm_id),
        ...incoming.features,
      }))
      .filter(r => r.place_id)

    const providerRows = chunk
      .map(({ incoming }) => ({
        place_id: placeIdByOsmId.get(incoming.place.osm_id),
        ...incoming.provider,
        osm_import_run_id: importRunId,
        osm_imported_at: new Date().toISOString(),
      }))
      .filter(r => r.place_id)

    const hoursRows = chunk
      .filter(({ incoming }) => incoming.opening_hours && placeIdByOsmId.has(incoming.place.osm_id))
      .map(({ incoming }) => ({
        place_id: placeIdByOsmId.get(incoming.place.osm_id)!,
        ...incoming.opening_hours!,
      }))

    await Promise.all([
      supabase.from('place_contact').upsert(contactRows, { onConflict: 'place_id' }),
      supabase.from('place_features').upsert(featuresRows, { onConflict: 'place_id' }),
      supabase.from('place_provider_metadata').upsert(providerRows, { onConflict: 'place_id' }),
      hoursRows.length > 0
        ? supabase.from('place_opening_hours').upsert(hoursRows, { onConflict: 'place_id,source' })
        : Promise.resolve(),
    ])
  }

  return successCount
}

export async function ingestDelta(
  supabase: SupabaseClient,
  rows: TransformedRow[],
  importRunId: string,
  dryRun: boolean,
): Promise<DeltaStats> {
  const stats: DeltaStats = { updated: 0, logged: 0, skipped: 0 }

  const osmIds = rows.map(r => r.place.osm_id)
  const existingByOsmId = await fetchExistingPlaces(supabase, osmIds)

  const protected_: Array<{ existing: ExistingPlace; incoming: TransformedRow }> = []
  const updatable: Array<{ existing: ExistingPlace; incoming: TransformedRow }> = []

  for (const row of rows) {
    const existing = existingByOsmId.get(row.place.osm_id)
    if (!existing) {
      // New place — full import job handles inserts; delta only updates existing
      stats.skipped++
      continue
    }

    if (PROTECTED_LEVELS.has(existing.verification_level)) {
      protected_.push({ existing, incoming: row })
    } else {
      updatable.push({ existing, incoming: row })
    }
  }

  console.log(
    `  [delta] ${updatable.length} updatable, ${protected_.length} protected (will audit-log), ${stats.skipped} new (skipped)`,
  )

  if (!dryRun) {
    await logSkippedAuditEvents(supabase, protected_)
    stats.updated = await applyUpdates(supabase, updatable, importRunId)
  } else {
    stats.updated = updatable.length
  }

  stats.logged = protected_.length
  return stats
}
