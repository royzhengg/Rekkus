import { fetchDistinctCuisineTypes } from '../services/search'
import { loadDynamicCuisines } from '../utils/cuisineSynonyms'

const TTL_MS = 24 * 60 * 60 * 1000

let loaded = false
let loadedAt = 0

export async function ensureVocabularyLoaded(): Promise<void> {
  if (loaded && Date.now() - loadedAt < TTL_MS) return
  try {
    const cuisines = await fetchDistinctCuisineTypes()
    loadDynamicCuisines(cuisines)
    loaded = true
    loadedAt = Date.now()
  } catch (err) {
    console.warn('[search] vocabulary load failed, using static lists only', err)
  }
}

export function _resetVocabCacheForTest(opts: { expireNow?: boolean } = {}): void {
  if (opts.expireNow) {
    loadedAt = 0
  } else {
    loaded = false
    loadedAt = 0
  }
}
