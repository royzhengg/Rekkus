import { buildContextualQuickStarts } from '@/lib/hooks/useContextualQuickStarts'

function queriesFor(hour: number, affinities: Record<string, number> = {}): string[] {
  return buildContextualQuickStarts(affinities, hour).map(chip => chip.query)
}

describe('buildContextualQuickStarts', () => {
  it('returns breakfast-oriented chips in the morning without evening-only fallback', () => {
    expect(queriesFor(8)).toEqual(['brunch', 'breakfast', 'cafe', 'ramen'])
  })

  it('returns lunch-oriented chips at midday', () => {
    expect(queriesFor(12)).toEqual(['quick bite', 'lunch', 'ramen', 'cheap'])
  })

  it('returns evening chips without brunch as pure fallback', () => {
    expect(queriesFor(20)).toEqual(['date night', 'dinner', 'ramen', 'cheap'])
  })

  it('inserts top cuisine affinities before time defaults', () => {
    expect(queriesFor(8, { italian: 0.4, japanese: 0.9, mexican: 0.7 })).toEqual([
      'japanese',
      'mexican',
      'brunch',
      'breakfast',
    ])
  })

  it('dedupes cuisine chips that overlap time defaults', () => {
    expect(queriesFor(8, { cafe: 1, japanese: 0.8 })).toEqual([
      'cafe',
      'japanese',
      'brunch',
      'breakfast',
    ])
  })

  it('returns static fallback defaults outside contextual windows with no affinities', () => {
    expect(queriesFor(23)).toEqual(['ramen', 'brunch', 'date night', 'cheap'])
  })
})
