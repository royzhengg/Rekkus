export type SearchChip = {
  label: string
  emoji: string
  query: string
}

export const CHIPS: SearchChip[] = [
  { label: 'Ramen', emoji: '🍜', query: 'ramen' },
  { label: 'Brunch', emoji: '☀️', query: 'brunch' },
  { label: 'Dumplings', emoji: '🥟', query: 'dumplings' },
  { label: 'Date night', emoji: '🌙', query: 'date night' },
  { label: 'Cheap eats', emoji: '💸', query: 'cheap' },
  { label: 'Japanese', emoji: '🍣', query: 'japanese' },
  { label: 'Burgers', emoji: '🍔', query: 'burger' },
  { label: 'Breakfast', emoji: '🍳', query: 'breakfast' },
  { label: 'Cafe', emoji: '☕', query: 'cafe' },
  { label: 'Quick bite', emoji: '🥪', query: 'quick bite' },
  { label: 'Lunch', emoji: '🥗', query: 'lunch' },
  { label: 'Dinner', emoji: '🍽️', query: 'dinner' },
]

export const DEFAULT_QUICK_START_QUERIES = ['ramen', 'brunch', 'date night', 'cheap']
