import { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'

export function useReduceTransparency(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(Platform.OS === 'ios')

  useEffect(() => {
    if (Platform.OS !== 'ios') return

    let active = true
    void AccessibilityInfo.isReduceTransparencyEnabled().then(enabled => {
      if (active) setReduceTransparency(enabled)
    })
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency
    )

    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  return Platform.OS === 'ios' && reduceTransparency
}
