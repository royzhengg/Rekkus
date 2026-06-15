import { getActivityStatus } from '@/lib/utils/activityStatus'

describe('getActivityStatus', () => {
  const now = new Date('2026-06-13T00:00:00.000Z').getTime()

  it('hides missing, invalid, and future-ish values safely', () => {
    expect(getActivityStatus(null, now)).toEqual({ kind: 'hidden', label: null, minutesAgo: null })
    expect(getActivityStatus('not-a-date', now)).toEqual({ kind: 'hidden', label: null, minutesAgo: null })
    expect(getActivityStatus('2026-06-13T00:01:00.000Z', now)).toEqual({
      kind: 'active_now',
      label: 'Active now',
      minutesAgo: 0,
    })
  })

  it('formats active now below five minutes', () => {
    expect(getActivityStatus('2026-06-12T23:56:00.000Z', now)).toEqual({
      kind: 'active_now',
      label: 'Active now',
      minutesAgo: 4,
    })
  })

  it('formats minute and hour recency up to one day', () => {
    expect(getActivityStatus('2026-06-12T23:55:00.000Z', now).label).toBe('Active 5m ago')
    expect(getActivityStatus('2026-06-12T23:01:00.000Z', now).label).toBe('Active 59m ago')
    expect(getActivityStatus('2026-06-12T23:00:00.000Z', now).label).toBe('Active 1h ago')
    expect(getActivityStatus('2026-06-12T01:00:00.000Z', now).label).toBe('Active 23h ago')
  })

  it('marks stale known activity inactive for detail surfaces', () => {
    expect(getActivityStatus('2026-06-12T00:00:00.000Z', now)).toEqual({
      kind: 'inactive',
      label: 'Inactive',
      minutesAgo: 1440,
    })
  })
})
