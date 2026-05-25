const cooldowns = new Map<string, number>()

export function isCoolingDown(key: string, windowMs: number): boolean {
  const now = Date.now()
  const last = cooldowns.get(key)
  if (last && now - last < windowMs) return true
  cooldowns.set(key, now)
  return false
}

// Pure read — does not update the timestamp
export function checkCooldown(key: string, windowMs: number): boolean {
  const last = cooldowns.get(key)
  return !!(last && Date.now() - last < windowMs)
}

// Explicit set — call after a failure event to start a cooldown
export function setCooldown(key: string): void {
  cooldowns.set(key, Date.now())
}
