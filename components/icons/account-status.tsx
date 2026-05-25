import React from 'react'
import { Svg, Path, Circle, Polyline, Line, Rect } from 'react-native-svg'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

export const UserIcon = React.memo(function UserIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  )
})

export const MailIcon = React.memo(function MailIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Polyline points="22,6 12,13 2,6" />
    </Svg>
  )
})

export const LockIcon = React.memo(function LockIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={11} width={18} height={11} rx={2} ry={2} />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  )
})

export const FilterIcon = React.memo(function FilterIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z" />
    </Svg>
  )
})

export const InfoIcon = React.memo(function InfoIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Line x1={12} y1={16} x2={12} y2={12} />
      <Line x1={12} y1={8} x2={12.01} y2={8} />
    </Svg>
  )
})

export const RefreshIcon = React.memo(function RefreshIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="23 4 23 10 17 10" />
      <Polyline points="1 20 1 14 7 14" />
      <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Svg>
  )
})

export const CheckCircleIcon = React.memo(function CheckCircleIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Polyline points="22 4 12 14.01 9 11.01" />
    </Svg>
  )
})

export const XCircleIcon = React.memo(function XCircleIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Line x1={15} y1={9} x2={9} y2={15} />
      <Line x1={9} y1={9} x2={15} y2={15} />
    </Svg>
  )
})

export const FireIcon = React.memo(function FireIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  )
})
