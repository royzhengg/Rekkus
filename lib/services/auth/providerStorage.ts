import AsyncStorage from '@react-native-async-storage/async-storage'
import { OAUTH_PROVIDERS } from '@/lib/utils/authProviders'
import { isValidProviderStateRecord, type ProviderStateRecord } from './providerState'

const KEY = 'auth:provider_state:v1'
// Increment suffix if ProviderStateRecord shape changes; old key is abandoned (no migration needed).

export async function loadPersistedProviderState(): Promise<ProviderStateRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isValidProviderStateRecord(parsed)) {
      await AsyncStorage.removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    try { await AsyncStorage.removeItem(KEY) } catch { /* best-effort cleanup */ }
    return null
  }
}

export async function persistProviderState(state: ProviderStateRecord): Promise<void> {
  // Strip 'connecting' before persisting — if app is killed during reconnect,
  // the provider returns to 'revoked' on restart rather than staying stuck in 'connecting'.
  const stable = Object.fromEntries(
    OAUTH_PROVIDERS.map(p => [p, state[p] === 'connecting' ? 'revoked' : state[p]])
  ) as ProviderStateRecord
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(stable))
  } catch {
    // Non-fatal. State is correct in memory; next session refreshes from network.
  }
}

export async function clearPersistedProviderState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY)
  } catch {
    // Best-effort on sign-out.
  }
}
