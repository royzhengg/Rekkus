import React from 'react'
import { Svg, Path, Circle, Polyline, Line, Rect } from 'react-native-svg'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

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
  size?: number
  color?: string
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

export const SearchIcon = React.memo(function SearchIcon({
  size = 16,
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
  const colors = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? colors.text3}
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

export const CheckIcon = React.memo(function CheckIcon({
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
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  )
})

export const EditIcon = React.memo(function EditIcon({
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
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  )
})

export const TrashIcon = React.memo(function TrashIcon({
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
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <Line x1={10} y1={11} x2={10} y2={17} />
      <Line x1={14} y1={11} x2={14} y2={17} />
    </Svg>
  )
})

export const StarIcon = React.memo(function StarIcon({
  filled = false,
  size = 18,
  color,
}: {
  filled?: boolean
  size?: number
  color?: string
}) {
  const { accent, text2 } = useThemeColors()
  const stroke = color ?? (filled ? accent : text2)
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
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  )
})

export const UserIcon = React.memo(function UserIcon({
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
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  )
})

export const MailIcon = React.memo(function MailIcon({
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
      strokeLinejoin="round"
    >
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Polyline points="22,6 12,13 2,6" />
    </Svg>
  )
})

export const LockIcon = React.memo(function LockIcon({
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
      strokeLinejoin="round"
    >
      <Rect x={3} y={11} width={18} height={11} rx={2} ry={2} />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  )
})

export const FilterIcon = React.memo(function FilterIcon({
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
      <Path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z" />
    </Svg>
  )
})

export const InfoIcon = React.memo(function InfoIcon({
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
      strokeLinejoin="round"
    >
      <Circle cx={12} cy={12} r={10} />
      <Line x1={12} y1={16} x2={12} y2={12} />
      <Line x1={12} y1={8} x2={12.01} y2={8} />
    </Svg>
  )
})

export const RefreshIcon = React.memo(function RefreshIcon({
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
      <Polyline points="23 4 23 10 17 10" />
      <Polyline points="1 20 1 14 7 14" />
      <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Svg>
  )
})

export const CheckCircleIcon = React.memo(function CheckCircleIcon({
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
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Polyline points="22 4 12 14.01 9 11.01" />
    </Svg>
  )
})

export const XCircleIcon = React.memo(function XCircleIcon({
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
      <Circle cx={12} cy={12} r={10} />
      <Line x1={15} y1={9} x2={9} y2={15} />
      <Line x1={9} y1={9} x2={15} y2={15} />
    </Svg>
  )
})

export const FireIcon = React.memo(function FireIcon({
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
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  )
})

export const GridIcon = React.memo(function GridIcon({
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
      <Rect x={3} y={3} width={7} height={7} />
      <Rect x={14} y={3} width={7} height={7} />
      <Rect x={14} y={14} width={7} height={7} />
      <Rect x={3} y={14} width={7} height={7} />
    </Svg>
  )
})

export const GalleryIcon = React.memo(function GalleryIcon({
  size = 20,
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
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Circle cx={8.5} cy={8.5} r={1.5} />
      <Polyline points="21 15 16 10 5 21" />
    </Svg>
  )
})

export const VideoIcon = React.memo(function VideoIcon({
  size = 20,
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
      <Path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.914L15 14" />
      <Rect x={3} y={8} width={12} height={8} rx={1.5} />
    </Svg>
  )
})

export const MapPinIcon = React.memo(function MapPinIcon({
  size = 20,
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
      <Path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.314-2.686-6-6-6z" />
      <Circle cx={12} cy={8} r={2} />
    </Svg>
  )
})

export const PaperclipIcon = React.memo(function PaperclipIcon({
  size = 20,
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
      <Path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </Svg>
  )
})

export const UsersIcon = React.memo(function UsersIcon({
  size = 20,
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
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
})

export const ListIcon = React.memo(function ListIcon({
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
      <Line x1={8} y1={6} x2={21} y2={6} />
      <Line x1={8} y1={12} x2={21} y2={12} />
      <Line x1={8} y1={18} x2={21} y2={18} />
      <Line x1={3} y1={6} x2={3.01} y2={6} />
      <Line x1={3} y1={12} x2={3.01} y2={12} />
      <Line x1={3} y1={18} x2={3.01} y2={18} />
    </Svg>
  )
})

export const ReplyIcon = React.memo(function ReplyIcon({
  size = 16,
  color,
}: {
  size?: number
  color?: string
}) {
  const { text } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? text}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M9 17l-5-5 5-5" />
      <Path d="M4 12h11a5 5 0 0 1 5 5v1" />
    </Svg>
  )
})

export const CopyIcon = React.memo(function CopyIcon({
  size = 16,
  color,
}: {
  size?: number
  color?: string
}) {
  const { text } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? text}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x={9} y={9} width={13} height={13} rx={2} ry={2} />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  )
})

export const ForwardIcon = React.memo(function ForwardIcon({
  size = 16,
  color,
}: {
  size?: number
  color?: string
}) {
  const { text } = useThemeColors()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? text}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M15 17l5-5-5-5" />
      <Path d="M20 12H9a5 5 0 0 0-5 5v1" />
    </Svg>
  )
})
