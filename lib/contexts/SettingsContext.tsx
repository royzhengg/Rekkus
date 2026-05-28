import React, { createContext, useContext, useEffect, useState } from 'react'
import { analytics } from '@/lib/analytics'
import { DEFAULT_SETTINGS, fetchSettings, type Settings } from '@/lib/services/settings'
import { useAuth } from './AuthContext'
import { useConnectivity } from './ConnectivityContext'

interface SettingsContextValue {
  settings: Settings
  loading: boolean
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loading: false,
  updateSetting: async () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { runDeferredMutation } = useConnectivity()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS)
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchSettings(user.id)
      .then(nextSettings => {
        setSettings(nextSettings)
      })
      .catch(() => {
        analytics.actionError(user.id, 'load_settings', 'provider_error')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user])

  async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    if (!user) return
    try {
      await runDeferredMutation({ kind: 'setting', setting: key, value })
    } catch {
      analytics.actionError(user.id, 'update_settings', 'provider_error')
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
