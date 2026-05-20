import type { RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'

export const TASTE_PICK_OPTIONS: Array<{
  value: RekkusTasteVerdict
  label: string
  helper: string
  legacyFood: number
}> = [
  { value: 'not_for_me', label: 'Not for me', helper: "Wouldn't order again, but someone else might.", legacyFood: 1 },
  { value: 'good', label: 'Good', helper: 'Solid and enjoyable.', legacyFood: 2 },
  { value: 'craveable', label: 'Craveable', helper: "You'd come back for this.", legacyFood: 3 },
  { value: 'must_order', label: 'Must order', helper: 'The dish people should get here.', legacyFood: 4 },
  { value: 'worth_a_trip', label: 'Worth a trip', helper: 'Good enough to go out of your way for.', legacyFood: 5 },
]

export const VALUE_PICK_OPTIONS: Array<{
  value: RekkusValueVerdict
  label: string
  helper: string
  legacyCost: number
}> = [
  { value: 'not_worth_it', label: 'Not worth it', helper: 'Price felt higher than the experience.', legacyCost: 4 },
  { value: 'fair', label: 'Fair', helper: 'About right for what you got.', legacyCost: 2 },
  { value: 'great_value', label: 'Great value', helper: 'Better than expected for the price.', legacyCost: 1 },
  { value: 'worth_the_splurge', label: 'Worth the splurge', helper: 'Expensive, but still worth it.', legacyCost: 4 },
]

export const OCCASION_PICK_OPTIONS: Array<{
  value: RekkusOccasionTag
  label: string
  helper: string
}> = [
  { value: 'quick_bite', label: 'Quick bite', helper: 'Easy, low-effort stop.' },
  { value: 'solo', label: 'Solo', helper: 'Comfortable to enjoy on your own.' },
  { value: 'casual', label: 'Casual', helper: 'Good for an easy catch-up.' },
  { value: 'date_night', label: 'Date night', helper: 'Feels right for two.' },
  { value: 'group', label: 'Group', helper: 'Works well with friends or a group.' },
  { value: 'special', label: 'Special', helper: 'Good for a celebration or treat.' },
]

export function tasteLabel(value?: RekkusTasteVerdict | null): string {
  return TASTE_PICK_OPTIONS.find(option => option.value === value)?.label ?? ''
}

export function valueLabel(value?: RekkusValueVerdict | null): string {
  return VALUE_PICK_OPTIONS.find(option => option.value === value)?.label ?? ''
}

export function occasionLabel(value?: RekkusOccasionTag | null): string {
  return OCCASION_PICK_OPTIONS.find(option => option.value === value)?.label ?? ''
}

export function legacyFoodToTaste(food: number | null | undefined): RekkusTasteVerdict | undefined {
  if (!food) return undefined
  return TASTE_PICK_OPTIONS[Math.max(0, Math.min(4, Math.round(food) - 1))]?.value
}

export function tasteToLegacyFood(value?: RekkusTasteVerdict): number {
  return TASTE_PICK_OPTIONS.find(option => option.value === value)?.legacyFood ?? 3
}

export function valueToLegacyCost(value?: RekkusValueVerdict): number {
  return VALUE_PICK_OPTIONS.find(option => option.value === value)?.legacyCost ?? 2
}
