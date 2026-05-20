const cooldowns = new Map<string, number>()

export function isCoolingDown(key: string, windowMs: number): boolean {
  const now = Date.now()
  const last = cooldowns.get(key)
  if (last && now - last < windowMs) return true
  cooldowns.set(key, now)
  return false
}
