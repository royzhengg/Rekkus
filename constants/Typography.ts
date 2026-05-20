export const fontSize = {
  micro: 6.5,
  '3xs': 8,
  '2xs': 9,
  xs: 10,
  sm: 11,
  sm2: 11.5,
  bodySm: 12,
  base: 13,
  md: 14,
  lg: 15,
  xl: 16,
  title: 17,
  '2xl': 18,
  '2.5xl': 20,
  '3xl': 22,
  '4xl': 24,
  iconLg: 25,
  '5xl': 26,
  '6xl': 28,
  '7xl': 30,
  '8xl': 32,
  '9xl': 34,
  '10xl': 36,
  display: 42,
} as const

export const fontWeight = {
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
}

export const lineHeight = {
  xxs: 15,
  tight: 16,
  compact: 17,
  small: 18,
  body: 19,
  normal: 20,
  loose: 21,
  title: 22,
  titleRelaxed: 23,
  relaxed: 24,
  display: 26,
  hero: 28,
} as const

export const typography = {
  bodyBase: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.normal,
    fontWeight: fontWeight.regular,
  },
  bodySmall: {
    fontSize: fontSize.sm,
    lineHeight: 18,
    fontWeight: fontWeight.regular,
  },
  bodyLarge: {
    fontSize: fontSize.md,
    lineHeight: lineHeight.relaxed,
    fontWeight: fontWeight.regular,
  },
  caption: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.tight,
    fontWeight: fontWeight.regular,
  },
  label: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.tight,
    fontWeight: fontWeight.medium,
  },
  heading: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.relaxed,
    fontWeight: fontWeight.semibold,
  },
} as const

export const { bodyBase, bodySmall, bodyLarge, caption, label, heading } = typography
