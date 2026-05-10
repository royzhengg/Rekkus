const _legacy = {
  light: {
    text: '#1A1A18',
    background: '#FAFAF8',
    tint: '#D4522A',
    tabIconDefault: '#A8A8A2',
    tabIconSelected: '#1A1A18',
  },
  dark: {
    text: '#1A1A18',
    background: '#FAFAF8',
    tint: '#D4522A',
    tabIconDefault: '#A8A8A2',
    tabIconSelected: '#1A1A18',
  },
}
export default _legacy

export const lightColors = {
  bg: '#FAFAF8',
  surface: '#F2F2EF',
  surface2: '#E8E8E4',
  border: 'rgba(0,0,0,0.08)',
  border2: 'rgba(0,0,0,0.14)',
  text: '#1A1A18',
  text2: '#6B6B66',
  text3: '#A8A8A2',
  accent: '#D4522A',
  info: '#2A6DD4',
  success: '#1D9E75',
  warning: '#EF9F27',
  liked: '#E24B4A',
  errorBg: '#FEF0F0',
  overlay: 'rgba(0,0,0,0.35)',
  white: '#FFFFFF',
}

export const darkColors = {
  bg: '#141412',
  surface: '#1E1E1C',
  surface2: '#2A2A28',
  border: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.14)',
  text: '#F0F0EC',
  text2: '#A8A8A2',
  text3: '#6B6B66',
  accent: '#E8673D',
  info: '#5B93E8',
  success: '#28C98D',
  warning: '#F5B340',
  liked: '#E24B4A',
  errorBg: '#3D1A1A',
  overlay: 'rgba(0,0,0,0.55)' as const,
  white: '#FFFFFF',
}

// Static fallback — only for StyleSheet.create at module level in legacy/non-themed code
export const colors = lightColors

export const imgColors: Record<string, string> = {
  warm: '#EDE4DA',
  green: '#DCE8D8',
  blue: '#D8E2EE',
  pink: '#EDD8E2',
  clay: '#E8D8CC',
  sage: '#D6E2D6',
}
