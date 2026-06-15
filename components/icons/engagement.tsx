import React from 'react'
import { Svg, Path, Circle, Line } from 'react-native-svg'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

export const BellIcon = React.memo(function BellIcon({ size = 17 }: { size?: number }) {
  const { text2 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={text2}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  )
})

export const HeartIcon = React.memo(function HeartIcon({
  filled = false,
  size = 21,
}: {
  filled?: boolean
  size?: number
}) {
  const { liked, text2 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? liked : 'none'}
      stroke={filled ? liked : text2}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  )
})

export const SaveIcon = React.memo(function SaveIcon({
  filled = false,
  size = 21,
  activeColor,
  inactiveColor,
}: {
  filled?: boolean
  size?: number
  activeColor?: string
  inactiveColor?: string
}) {
  const { text, text2 } = useThemeColors()
  const stroke = filled ? (activeColor ?? text) : (inactiveColor ?? text2)
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? stroke : 'none'}
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  )
})

export const CommentIcon = React.memo(function CommentIcon({ size = 21 }: { size?: number }) {
  const { text2 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={text2}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  )
})

export const MessageIcon = React.memo(function MessageIcon({
  size = 21,
  color,
}: {
  size?: number
  color?: string
}) {
  const { text2 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? text2}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Svg>
  )
})

export const ShareIcon = React.memo(function ShareIcon({
  size = 21,
  color,
}: {
  size?: number
  color?: string
}) {
  const { text2 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? text2}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={18} cy={5} r={3} />
      <Circle cx={6} cy={12} r={3} />
      <Circle cx={18} cy={19} r={3} />
      <Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} />
      <Line x1={15.41} y1={6.51} x2={8.59} y2={10.49} />
    </Svg>
  )
})

export const SendIcon = React.memo(function SendIcon({
  active,
  size = 18,
  color,
}: {
  active: boolean
  size?: number | undefined
  color?: string | undefined
}) {
  const { text, text3 } = useThemeColors()
  const stroke = color ?? (active ? text : text3)
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <Line x1={22} y1={2} x2={11} y2={13} />
      <Path d="M22 2L15 22 11 13 2 9l20-7z" />
    </Svg>
  )
})
