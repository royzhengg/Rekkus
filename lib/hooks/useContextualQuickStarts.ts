import { useMemo } from 'react'
import {
  CHIPS,
  DEFAULT_QUICK_START_QUERIES,
  type SearchChip,
} from '@/lib/dataSources/searchQuickStarts'
import type { CuisineAffinities } from './useSearchHistory'

const QUICK_START_COUNT = 4
const MAX_PERSONALISED_CHIPS = 2
const GENERIC_CUISINE_EMOJI = '🍽️'

const TIME_OF_DAY_QUERIES = {
  morning: ['brunch', 'breakfast', 'cafe'],
  midday: ['quick bite', 'lunch'],
  evening: ['date night', 'dinner'],
} as const

type DayPart = keyof typeof TIME_OF_DAY_QUERIES

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function dayPartForHour(hour: number): DayPart | null {
  if (hour >= 6 && hour <= 10) return 'morning'
  if (hour >= 11 && hour <= 15) return 'midday'
  if (hour >= 17 && hour <= 22) return 'evening'
  return null
}

function chipForQuery(query: string): SearchChip | null {
  const normalized = normalizeQuery(query)
  return CHIPS.find(chip => normalizeQuery(chip.query) === normalized) ?? null
}

function chipForCuisine(cuisine: string): SearchChip {
  const normalized = normalizeQuery(cuisine)
  return chipForQuery(normalized) ?? {
    label: titleCase(normalized),
    emoji: GENERIC_CUISINE_EMOJI,
    query: normalized,
  }
}

function isBlockedFallback(query: string, dayPart: DayPart | null): boolean {
  const normalized = normalizeQuery(query)
  if (dayPart === null) return false
  if (normalized === 'brunch') return dayPart !== 'morning'
  if (normalized === 'date night') return dayPart !== 'evening'
  return false
}

function addUniqueChip(chips: SearchChip[], seen: Set<string>, chip: SearchChip): void {
  const key = normalizeQuery(chip.query)
  if (!key || seen.has(key)) return
  seen.add(key)
  chips.push(chip)
}

export function buildContextualQuickStarts(
  cuisineAffinities: CuisineAffinities,
  hour: number
): SearchChip[] {
  const dayPart = dayPartForHour(hour)
  const chips: SearchChip[] = []
  const seen = new Set<string>()

  const cuisineChips = Object.entries(cuisineAffinities)
    .filter(([, affinity]) => affinity > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_PERSONALISED_CHIPS)
    .map(([cuisine]) => chipForCuisine(cuisine))

  for (const chip of cuisineChips) {
    addUniqueChip(chips, seen, chip)
  }

  const timeQueries = dayPart === null ? [] : TIME_OF_DAY_QUERIES[dayPart]
  for (const query of timeQueries) {
    const chip = chipForQuery(query)
    if (chip) addUniqueChip(chips, seen, chip)
    if (chips.length >= QUICK_START_COUNT) return chips
  }

  for (const query of DEFAULT_QUICK_START_QUERIES) {
    if (isBlockedFallback(query, dayPart)) continue
    const chip = chipForQuery(query)
    if (chip) addUniqueChip(chips, seen, chip)
    if (chips.length >= QUICK_START_COUNT) return chips
  }

  return chips
}

export function useContextualQuickStarts(cuisineAffinities: CuisineAffinities): SearchChip[] {
  const hour = new Date().getHours()
  return useMemo(
    () => buildContextualQuickStarts(cuisineAffinities, hour),
    [cuisineAffinities, hour]
  )
}
