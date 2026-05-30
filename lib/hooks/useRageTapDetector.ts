import { useCallback, useRef } from 'react'

const WINDOW_MS = 1000
const THRESHOLD = 3

/**
 * Wraps an onPress handler to detect rage taps (≥3 taps within 1 s).
 * Calls onRageTap(tapCount) once per rage burst, then resets the window.
 * The original onPress still fires on every tap.
 */
export function useRageTapDetector(
  onPress: () => void,
  onRageTap: (tapCount: number) => void,
): () => void {
  const timestamps = useRef<number[]>([])

  return useCallback(() => {
    const now = Date.now()
    const recent = timestamps.current.filter(t => now - t < WINDOW_MS)
    recent.push(now)
    timestamps.current = recent

    if (recent.length >= THRESHOLD) {
      onRageTap(recent.length)
      timestamps.current = []
    }

    onPress()
  }, [onPress, onRageTap])
}
