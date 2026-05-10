export function parseLikes(s: string): number {
  const n = parseFloat(s)
  return s.includes('k') ? n * 1000 : n
}

export function todayHoursIndex(): number {
  return (new Date().getDay() + 6) % 7
}

const AVATAR_PALETTES = [
  { bg: '#FBEAF0', color: '#993556' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#F1EEFE', color: '#534AB7' },
  { bg: '#F2F2EF', color: '#4A4A45' },
]

export function avatarPalette(username: string): { bg: string; color: string } {
  return AVATAR_PALETTES[username.charCodeAt(0) % AVATAR_PALETTES.length]
}
