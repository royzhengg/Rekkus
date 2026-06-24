export function parseLikes(s: string): number {
  const n = parseFloat(s)
  return s.includes('k') ? n * 1000 : n
}

export function todayHoursIndex(): number {
  return (new Date().getDay() + 6) % 7
}

const DEFAULT_AVATAR_PALETTE = { bg: '#FBEAF0', color: '#993556' }
const AVATAR_PALETTES = [
  DEFAULT_AVATAR_PALETTE,
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#F1EEFE', color: '#534AB7' },
  { bg: '#F2F2EF', color: '#4A4A45' },
]

export function avatarPalette(username: string): { bg: string; color: string } {
  return AVATAR_PALETTES[username.charCodeAt(0) % AVATAR_PALETTES.length] ?? DEFAULT_AVATAR_PALETTE
}

export function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days < 1) return 'today'
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google',
  apple: 'Apple Maps',
  osm: 'OpenStreetMap',
  foursquare: 'Foursquare',
  tripadvisor: 'TripAdvisor',
  yelp: 'Yelp',
}

export function formatProviderName(provider: string | undefined): string {
  if (!provider) return 'External provider'
  return PROVIDER_NAMES[provider.toLowerCase()] ?? provider
}
