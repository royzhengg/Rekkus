import AsyncStorage from '@react-native-async-storage/async-storage'

const PREFIX = 'rekkus:offline-cache:'

type CacheEnvelope<T> = {
  savedAt: string
  value: T
}

export async function readOfflineCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    return parsed.value ?? null
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
  } catch {}
}
