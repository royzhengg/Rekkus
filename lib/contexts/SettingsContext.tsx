import React, { createContext, useContext, useEffect, useState } from 'react'
import { analytics } from '@/lib/analytics'
import { useActivityHeartbeat } from '@/lib/hooks/useActivityHeartbeat'
import {
  DEFAULT_SETTINGS,
  fetchSettings,
  updatePrivateAccount,
  type PrivateAccountUpdateResult,
  type Settings,
} from '@/lib/services/settings'
import { useAuth } from './AuthContext'
import { useConnectivity } from './ConnectivityContext'

interface SettingsContextValue {
  settings: Settings
  loading: boolean
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>
  updatePrivateAccountSetting: (value: boolean) => Promise<PrivateAccountUpdateResult>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loading: false,
  updateSetting: async () => {},
  updatePrivateAccountSetting: async value => ({
    privateAccount: value,
    approvedRequesterIds: [],
    approvedCount: 0,
  }),
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { runDeferredMutation } = useConnectivity()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(false)

  useActivityHeartbeat(user?.id, settings.show_activity_status)

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

  async function updatePrivateAccountSetting(value: boolean): Promise<PrivateAccountUpdateResult> {
    const previous = settings
    setSettings({ ...settings, private_account: value })
    if (!user) return { privateAccount: value, approvedRequesterIds: [], approvedCount: 0 }
    analytics.privacySettingChanged(user.id, 'private_account', value)
    try {
      const result = await updatePrivateAccount(value)
      setSettings(current => ({ ...current, private_account: result.privateAccount }))
      if (!value && result.approvedCount > 0) {
        analytics.followRequestStateChanged(user.id, 'approved_auto_public')
      }
      return result
    } catch {
      setSettings(previous)
      analytics.actionError(user.id, 'update_settings', 'provider_error')
      throw new Error('Your privacy setting could not be updated. Check your connection and try again.')
    }
  }

  async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (key === 'private_account' && typeof value === 'boolean') {
      await updatePrivateAccountSetting(value)
      return
    }
    const next = { ...settings, [key]: value }
    setSettings(next)
    if (!user) return
    if (key === 'private_account' || key === 'show_activity_status') {
      analytics.privacySettingChanged(user.id, key, Boolean(value))
    } else if (
      key === 'notif_likes' || key === 'notif_comments' || key === 'notif_followers' ||
      key === 'notif_mentions' || key === 'notif_messages'
    ) {
      analytics.notificationSettingChanged(user.id, key, Boolean(value))
    }
    try {
      await runDeferredMutation({ kind: 'setting', setting: key, value })
    } catch {
      analytics.actionError(user.id, 'update_settings', 'provider_error')
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSetting, updatePrivateAccountSetting }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
