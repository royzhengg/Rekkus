import type { CuisineOption } from '@/types/domain'

export const CUISINES: CuisineOption[] = [
  { label: 'Afghan', value: 'Afghan' },
  { label: 'African', value: 'African' },
  { label: 'American', value: 'American', aliases: ['bbq', 'burger', 'wings'] },
  { label: 'Argentinian', value: 'Argentinian' },
  { label: 'Australian', value: 'Australian' },
  { label: 'Brazilian', value: 'Brazilian' },
  { label: 'British', value: 'British' },
  { label: 'Cambodian', value: 'Cambodian' },
  { label: 'Caribbean', value: 'Caribbean' },
  { label: 'Chinese', value: 'Chinese', aliases: ['dumpling', 'dim sum', 'wonton'] },
  { label: 'Ethiopian', value: 'Ethiopian' },
  { label: 'Filipino', value: 'Filipino' },
  { label: 'French', value: 'French', aliases: ['croissant', 'crepe'] },
  { label: 'German', value: 'German' },
  { label: 'Greek', value: 'Greek', aliases: ['gyros', 'souvlaki'] },
  { label: 'Indian', value: 'Indian', aliases: ['curry', 'biryani', 'naan'] },
  { label: 'Indonesian', value: 'Indonesian', aliases: ['rendang', 'nasi', 'satay'] },
  { label: 'Italian', value: 'Italian', aliases: ['pizza', 'pasta', 'risotto'] },
  { label: 'Japanese', value: 'Japanese', aliases: ['ramen', 'sushi', 'udon'] },
  { label: 'Korean', value: 'Korean', aliases: ['bibimbap', 'kimchi', 'kbbq'] },
  { label: 'Laotian', value: 'Laotian' },
  { label: 'Lebanese', value: 'Lebanese', aliases: ['falafel', 'hummus'] },
  { label: 'Malaysian', value: 'Malaysian' },
  { label: 'Mediterranean', value: 'Mediterranean', aliases: ['mezze', 'tzatziki'] },
  { label: 'Mexican', value: 'Mexican', aliases: ['taco', 'burrito'] },
  { label: 'Middle Eastern', value: 'Middle Eastern', aliases: ['kebab', 'shawarma'] },
  { label: 'Nepalese', value: 'Nepalese' },
  { label: 'Peruvian', value: 'Peruvian' },
  { label: 'Portuguese', value: 'Portuguese' },
  { label: 'Spanish', value: 'Spanish', aliases: ['tapas', 'paella'] },
  { label: 'Sri Lankan', value: 'Sri Lankan' },
  { label: 'Taiwanese', value: 'Taiwanese' },
  { label: 'Thai', value: 'Thai', aliases: ['pad thai', 'tom yum'] },
  { label: 'Turkish', value: 'Turkish', aliases: ['kebab', 'baklava'] },
  { label: 'Vietnamese', value: 'Vietnamese', aliases: ['pho', 'banh mi'] },
  { label: 'Other cuisine', value: 'Other cuisine' },
].sort((a, b) => a.label.localeCompare(b.label))

const CUISINE_BY_VALUE = new Map(CUISINES.map(cuisine => [cuisine.value.toLowerCase(), cuisine.value]))

export function normalizeCuisine(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  return CUISINE_BY_VALUE.get(trimmed.toLowerCase()) ?? trimmed
}

export function searchCuisines(query: string): CuisineOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return CUISINES
  return CUISINES.filter(
    cuisine =>
      cuisine.label.toLowerCase().includes(q) ||
      cuisine.aliases?.some(alias => alias.toLowerCase().includes(q))
  )
}
