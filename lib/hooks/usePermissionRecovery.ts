import { useCallback, useState } from 'react'
import { Linking } from 'react-native'

type PermissionResult = { granted: boolean; canAskAgain: boolean }

export function usePermissionRecovery() {
  const [recoveryVisible, setRecoveryVisible] = useState(false)
  const [recoveryMessage, setRecoveryMessage] = useState('')

  const request = useCallback(async (
    requestFn: () => Promise<PermissionResult>,
    deniedMessage: string
  ): Promise<PermissionResult> => {
    const result = await requestFn()
    // Only surface the settings sheet when the OS won't show the system dialog again.
    // On Android first denial canAskAgain is true — re-triggering the request is correct.
    // On iOS after first denial canAskAgain is false — must go to Settings.
    if (!result.granted && !result.canAskAgain) {
      setRecoveryMessage(deniedMessage)
      setRecoveryVisible(true)
    }
    return result
  }, [])

  const dismissRecovery = useCallback(() => {
    setRecoveryVisible(false)
    setRecoveryMessage('')
  }, [])

  const openSettings = useCallback(() => {
    setRecoveryVisible(false)
    setRecoveryMessage('')
    void Linking.openSettings()
  }, [])

  return { request, recoveryVisible, recoveryMessage, dismissRecovery, openSettings }
}
