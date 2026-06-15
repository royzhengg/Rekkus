export type ActivityStatusKind = 'hidden' | 'active_now' | 'recently_active' | 'inactive'

export type ActivityStatus = {
  kind: ActivityStatusKind
  label: string | null
  minutesAgo: number | null
}

const ACTIVE_NOW_MS = 5 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS

export function getActivityStatus(lastSeenAt: string | null | undefined, now = Date.now()): ActivityStatus {
  if (!lastSeenAt) return { kind: 'hidden', label: null, minutesAgo: null }

  const seenAt = new Date(lastSeenAt).getTime()
  if (!Number.isFinite(seenAt)) return { kind: 'hidden', label: null, minutesAgo: null }

  const diff = Math.max(0, now - seenAt)
  const minutesAgo = Math.floor(diff / 60_000)

  if (diff < ACTIVE_NOW_MS) {
    return { kind: 'active_now', label: 'Active now', minutesAgo }
  }

  if (diff < ONE_HOUR_MS) {
    return { kind: 'recently_active', label: `Active ${Math.max(5, minutesAgo)}m ago`, minutesAgo }
  }

  if (diff < ONE_DAY_MS) {
    const hoursAgo = Math.floor(diff / ONE_HOUR_MS)
    return { kind: 'recently_active', label: `Active ${hoursAgo}h ago`, minutesAgo }
  }

  return { kind: 'inactive', label: 'Inactive', minutesAgo }
}
