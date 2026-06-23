import fs from 'fs'
import path from 'path'
import { StateBbox } from './states'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const CACHE_DIR = path.join(process.cwd(), 'supabase/seeds/osm')
const CACHE_MAX_AGE_DAYS = 7

export interface OsmNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  tags: Record<string, string>
}

export interface OsmWay {
  type: 'way'
  id: number
  center: { lat: number; lon: number }
  tags: Record<string, string>
}

export type OsmElement = OsmNode | OsmWay

function cachePath(stateCode: string): string {
  return path.join(CACHE_DIR, `${stateCode.toLowerCase()}.json`)
}

function isCacheFresh(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath)
    const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24)
    return ageDays < CACHE_MAX_AGE_DAYS
  } catch {
    return false
  }
}

function buildOverpassQuery(bbox: StateBbox): string {
  const { south, west, north, east } = bbox
  const bboxStr = `${south},${west},${north},${east}`
  return `[out:json][timeout:120][bbox:${bboxStr}];
(
  node["amenity"~"restaurant|cafe|bar|pub|fast_food|ice_cream|food_court"];
  way["amenity"~"restaurant|cafe|bar|pub|fast_food|ice_cream|food_court"];
  node["shop"~"bakery|coffee|deli|confectionery|pastry"];
  way["shop"~"bakery|coffee|deli|confectionery|pastry"];
);
out center tags;`
}

export async function fetchState(state: StateBbox, dryRun: boolean, forceRefresh = false): Promise<OsmElement[]> {
  fs.mkdirSync(CACHE_DIR, { recursive: true })

  const cached = cachePath(state.code)
  if (!forceRefresh && isCacheFresh(cached)) {
    console.log(`  [${state.code}] Using cached snapshot (< ${CACHE_MAX_AGE_DAYS} days old)`)
    const raw = JSON.parse(fs.readFileSync(cached, 'utf8'))
    return raw.elements as OsmElement[]
  }

  if (dryRun) {
    console.log(`  [${state.code}] dry-run: would fetch from Overpass (no cache found)`)
    return []
  }

  console.log(`  [${state.code}] Fetching from Overpass API…`)
  const query = buildOverpassQuery(state)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)

  let elements: OsmElement[]
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Rekkus-ImportScript/1.0 (OSM place import; contact: royzhengg@gmail.com)',
      },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { elements: OsmElement[] }
    elements = json.elements ?? []
  } catch (err) {
    console.error(`  [${state.code}] Overpass failed: ${err}. No Geofabrik fallback in this version — retry later.`)
    return []
  } finally {
    clearTimeout(timeout)
  }

  fs.writeFileSync(cached, JSON.stringify({ elements }, null, 2))
  console.log(`  [${state.code}] Fetched ${elements.length} elements → cached`)
  return elements
}
