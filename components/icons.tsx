import React from 'react'
import { Svg, Path, Circle, Polyline, Line, Rect } from 'react-native-svg'
import { useThemeColors } from '@/lib/ThemeContext'

// All shared SVG icons. Each calls useThemeColors() internally (CLAUDE.md rule).
// Pass `size` to override the default. Pass `color`/`activeColor`/`inactiveColor`
// where the icon has state-dependent colours.

export const ChevronLeft = React.memo(function ChevronLeft({ size = 16 }: { size?: number }) {
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
    >
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  )
})

export const ChevronDown = React.memo(function ChevronDown({
  expanded,
  size = 12,
}: {
  expanded: boolean
  size?: number
}) {
  const { text3 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={text3}
      strokeWidth={2}
      strokeLinecap="round"
    >
      <Polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
    </Svg>
  )
})

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

export const BookmarkIcon = React.memo(function BookmarkIcon({
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
}: {
  active: boolean
  size?: number
}) {
  const { text, text3 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? text : text3}
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <Line x1={22} y1={2} x2={11} y2={13} />
      <Path d="M22 2L15 22 11 13 2 9l20-7z" />
    </Svg>
  )
})

export const SearchIcon = React.memo(function SearchIcon({ size = 16 }: { size?: number }) {
  const { text3 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={text3}
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </Svg>
  )
})

export const CloseIcon = React.memo(function CloseIcon({
  size = 10,
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
      strokeWidth={2}
      strokeLinecap="round"
    >
      <Line x1={18} y1={6} x2={6} y2={18} />
      <Line x1={6} y1={6} x2={18} y2={18} />
    </Svg>
  )
})

export const PinIcon = React.memo(function PinIcon({
  size = 14,
  color,
}: {
  size?: number
  color?: string
}) {
  const { text3 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? text3}
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx={12} cy={10} r={3} />
    </Svg>
  )
})

export const PhoneIcon = React.memo(function PhoneIcon({ size = 14 }: { size?: number }) {
  const { text3 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={text3}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.02z" />
    </Svg>
  )
})

export const GlobeIcon = React.memo(function GlobeIcon({ size = 14 }: { size?: number }) {
  const { text3 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={text3}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={12} cy={12} r={10} />
      <Line x1={2} y1={12} x2={22} y2={12} />
      <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Svg>
  )
})

export const ClockIcon = React.memo(function ClockIcon({ size = 14 }: { size?: number }) {
  const { text3 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={text3}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={12} cy={12} r={10} />
      <Polyline points="12 6 12 12 16 14" />
    </Svg>
  )
})

export const NavIcon = React.memo(function NavIcon({ size = 17 }: { size?: number }) {
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
      <Path d="M3 11l19-9-9 19-2-8-8-2z" />
    </Svg>
  )
})

export const SettingsIcon = React.memo(function SettingsIcon({ size = 17 }: { size?: number }) {
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
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  )
})

export const DotsIcon = React.memo(function DotsIcon({ size = 17 }: { size?: number }) {
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
    >
      <Circle cx={12} cy={5} r={1} fill={text2} stroke="none" />
      <Circle cx={12} cy={12} r={1} fill={text2} stroke="none" />
      <Circle cx={12} cy={19} r={1} fill={text2} stroke="none" />
    </Svg>
  )
})

export const SortIcon = React.memo(function SortIcon({ size = 13 }: { size?: number }) {
  const { text2 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={text2}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <Line x1={3} y1={6} x2={21} y2={6} />
      <Line x1={7} y1={12} x2={17} y2={12} />
      <Line x1={11} y1={18} x2={13} y2={18} />
    </Svg>
  )
})

export const ImagePlaceholder = React.memo(function ImagePlaceholder({
  size = 24,
  color,
}: {
  size?: number
  color?: string
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? '#B4B2A9'}
      strokeWidth={0.8}
      strokeLinecap="round"
    >
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Circle cx={8.5} cy={8.5} r={1.5} />
      <Polyline points="21 15 16 10 5 21" />
    </Svg>
  )
})

export const ChevronRight = React.memo(function ChevronRight({ size = 16 }: { size?: number }) {
  const { text3 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={text3}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  )
})

export const ArrowLeft = React.memo(function ArrowLeft({ size = 20 }: { size?: number }) {
  const { text } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={text}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
})

export const CameraIcon = React.memo(function CameraIcon({
  size = 18,
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
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx={12} cy={13} r={4} />
    </Svg>
  )
})

export const EyeIcon = React.memo(function EyeIcon({
  open = true,
  size = 18,
}: {
  open?: boolean
  size?: number
}) {
  const { text3 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={text3}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {open ? (
        <>
          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <Path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
        </>
      ) : (
        <>
          <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <Path d="M1 1l22 22" />
        </>
      )}
    </Svg>
  )
})

export const PlusIcon = React.memo(function PlusIcon({
  size = 18,
  color,
}: {
  size?: number
  color?: string
}) {
  const { text3 } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? text3}
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <Line x1={12} y1={5} x2={12} y2={19} />
      <Line x1={5} y1={12} x2={19} y2={12} />
    </Svg>
  )
})
