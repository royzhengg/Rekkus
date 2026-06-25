import type { DiscoveryColors, ProvenanceType } from './types'

export const PROVENANCE_LABELS: Record<ProvenanceType, string> = {
  FOLLOWING: 'Following',
  LOCAL: 'Saved nearby',
  STAFF: 'Staff pick',
  TRENDING: 'Trending this week',
  NEW: 'Fresh this week',
  POPULAR: 'Popular',
  YOU_SAVED: 'You saved',
  RECENT: 'Recent',
  SIMILAR_TO_YOU: 'Similar to you',
}

export function provenanceColors(colors: DiscoveryColors, provenance: ProvenanceType) {
  switch (provenance) {
    case 'LOCAL':
      return { bg: colors.chipCategorySageBg, text: colors.chipCategorySageText, rail: colors.chipCategorySageText }
    case 'FOLLOWING':
    case 'SIMILAR_TO_YOU':
      return { bg: colors.chipCategoryBlueBg, text: colors.chipCategoryBlueText, rail: colors.chipCategoryBlueText }
    case 'STAFF':
    case 'TRENDING':
    case 'NEW':
      return { bg: colors.chipActiveBg, text: colors.chipActiveText, rail: colors.accent }
    case 'YOU_SAVED':
    case 'RECENT':
      return { bg: colors.chipStrongBg, text: colors.chipStrongText, rail: colors.text }
    case 'POPULAR':
    default:
      return { bg: colors.surface, text: colors.text2, rail: colors.text3 }
  }
}

