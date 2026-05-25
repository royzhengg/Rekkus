import AsyncStorage from '@react-native-async-storage/async-storage'
import { analytics } from '@/lib/analytics'
import { isRecord, parseJsonWithGuard } from '@/lib/utils/safeJson'

const PREFIX = 'rekkus:offline-cache:'

type CacheEnvelope<T> = {
  savedAt: string
  value: T
}

function isCacheEnvelope(value: unknown): value is CacheEnvelope<unknown> {
  return isRecord(value) && typeof value.savedAt === 'string' && 'value' in value
}

export async function readOfflineCache<T>(
  key: string,
  valueGuard: (value: unknown) => value is T
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`)
    if (!raw) return null
    const parsed = parseJsonWithGuard(raw, isCacheEnvelope)
    if (!parsed) {
      analytics.actionError(null, 'runtime_boundary', 'offline_cache_envelope_invalid')
      return null
    }
    if (!valueGuard(parsed.value)) {
      analytics.actionError(null, 'runtime_boundary', 'offline_cache_value_invalid')
      return null
    }
    return parsed.value
  } catch {
    return null
  }
}

export async function writeOfflineCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${PREFIX}${key}`,
      JSON.stringify({ savedAt: new Date().toISOString(), value })
    )
  } catch {
    // Offline cache writes should never block the live path.
  }
}

export async function clearOfflineCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${PREFIX}${key}`)
  } catch {
    // Cache eviction failure is non-blocking; future reads can overwrite stale entries.
  }
}
