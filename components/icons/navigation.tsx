import React from 'react'
import { Svg, Path, Circle, Polyline, Line } from 'react-native-svg'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

export const ChevronLeft = React.memo(function ChevronLeft({ size = 16 }: { size?: number }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text2} strokeWidth={1.5} strokeLinecap="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  )
})

export const ChevronDown = React.memo(function ChevronDown({ expanded, size = 12 }: { expanded: boolean; size?: number }) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text3} strokeWidth={2} strokeLinecap="round">
      <Polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
    </Svg>
  )
})

export const SearchIcon = React.memo(function SearchIcon({ size = 16, color }: { size?: number; color?: string }) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text3} strokeWidth={1.5} strokeLinecap="round">
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </Svg>
  )
})

export const CloseIcon = React.memo(function CloseIcon({ size = 10, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={2} strokeLinecap="round">
      <Line x1={18} y1={6} x2={6} y2={18} />
      <Line x1={6} y1={6} x2={18} y2={18} />
    </Svg>
  )
})

export const PinIcon = React.memo(function PinIcon({ size = 14, color }: { size?: number; color?: string }) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text3} strokeWidth={1.5} strokeLinecap="round">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx={12} cy={10} r={3} />
    </Svg>
  )
})

export const PhoneIcon = React.memo(function PhoneIcon({ size = 14 }: { size?: number }) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.02z" />
    </Svg>
  )
})

export const GlobeIcon = React.memo(function GlobeIcon({ size = 14 }: { size?: number }) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Line x1={2} y1={12} x2={22} y2={12} />
      <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Svg>
  )
})

export const ClockIcon = React.memo(function ClockIcon({ size = 14 }: { size?: number }) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Polyline points="12 6 12 12 16 14" />
    </Svg>
  )
})

export const NavIcon = React.memo(function NavIcon({ size = 17 }: { size?: number }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 11l19-9-9 19-2-8-8-2z" />
    </Svg>
  )
})

export const SettingsIcon = React.memo(function SettingsIcon({ size = 17 }: { size?: number }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  )
})

export const DotsIcon = React.memo(function DotsIcon({ size = 17 }: { size?: number }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text2} strokeWidth={1.5} strokeLinecap="round">
      <Circle cx={12} cy={5} r={1} fill={text2} stroke="none" />
      <Circle cx={12} cy={12} r={1} fill={text2} stroke="none" />
      <Circle cx={12} cy={19} r={1} fill={text2} stroke="none" />
    </Svg>
  )
})

export const SortIcon = React.memo(function SortIcon({ size = 13 }: { size?: number }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text2} strokeWidth={1.8} strokeLinecap="round">
      <Line x1={3} y1={6} x2={21} y2={6} />
      <Line x1={7} y1={12} x2={17} y2={12} />
      <Line x1={11} y1={18} x2={13} y2={18} />
    </Svg>
  )
})

export const ChevronRight = React.memo(function ChevronRight({ size = 16 }: { size?: number }) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  )
})

export const ArrowLeft = React.memo(function ArrowLeft({ size = 20 }: { size?: number }) {
  const { text } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
})
